import { Router } from "express";
import { z } from "zod";
import { PartnerService } from "../services/partner.service";
import { AuthService } from "../services/auth.service";
import { err, ok } from "../utils/http";
import { sanitizeString } from "../utils/sanitize";

export const partnerRouter = Router();
const service = new PartnerService();
const authService = new AuthService();

const CreateSchema = z.object({ name: z.string().min(2), setupCredits: z.number().int().positive().optional() });
partnerRouter.post("/", async (req, res) => {
  try {
    const user = (req as any).user as { role: string };
    if (user.role !== "SUPER_ADMIN") return err(res, 403, "FORBIDDEN", "Forbidden");
    const bodyRaw = CreateSchema.parse(req.body || {});
    const p = await service.createPartner(sanitizeString(bodyRaw.name, 128), bodyRaw.setupCredits ?? 1);
    return ok(res, { partner: p });
  } catch (e: any) {
    return err(res, 400, "PARTNER_CREATE_FAILED", e?.message || "Create partner failed");
  }
});

const GrantSchema = z.object({ amount: z.number().int(), note: z.string().optional() });
partnerRouter.post("/:id/credits/grant", async (req, res) => {
  try {
    const user = (req as any).user as { role: string; id: string };
    if (user.role !== "SUPER_ADMIN") return err(res, 403, "FORBIDDEN", "Forbidden");
    const body = GrantSchema.parse(req.body || {});
    const p = await service.grantCredits(req.params.id, body.amount, user.id, body.note);
    return ok(res, { balance: p.balance, pricing: p.pricing });
  } catch (e: any) {
    return err(res, 400, "CREDIT_GRANT_FAILED", e?.message || "Grant failed");
  }
});

const MemberSchema = z.object({ userId: z.string().min(1), role: z.enum(["PARTNER_ADMIN", "PARTNER_INSTALLER"]) });
partnerRouter.post("/:id/members", async (req, res) => {
  try {
    const user = (req as any).user as { role: string };
    if (user.role !== "SUPER_ADMIN") return err(res, 403, "FORBIDDEN", "Forbidden");
    const body = MemberSchema.parse(req.body || {});
    await service.addMember(req.params.id, body.userId, body.role);
    return ok(res);
  } catch (e: any) {
    return err(res, 400, "ADD_MEMBER_FAILED", e?.message || "Add member failed");
  }
});

// List applications (SUPER_ADMIN)
partnerRouter.get("/applications", async (req, res) => {
  try {
    const user = (req as any).user as { role: string };
    if (user.role !== "SUPER_ADMIN") return err(res, 403, "FORBIDDEN", "Forbidden");
    const apps = await service.listApplications(req.query.status as string | undefined);
    return ok(res, { applications: apps });
  } catch (e: any) {
    return err(res, 400, "APPLICATION_LIST_FAILED", e?.message || "List applications failed");
  }
});

// Approve application and optionally create member user
const ApproveSchema = z.object({
  setupCredits: z.number().int().positive().optional(),
  createUser: z.object({ email: z.string().email(), password: z.string().min(6), name: z.string().optional() }).optional(),
  userId: z.string().optional(),
});

partnerRouter.post("/applications/:id/approve", async (req, res) => {
  try {
    const user = (req as any).user as { role: string; id: string };
    if (user.role !== "SUPER_ADMIN") return err(res, 403, "FORBIDDEN", "Forbidden");
    const body = ApproveSchema.parse(req.body || {});
    const app = await service.getApplication(req.params.id);
    if (!app || app.status !== "pending") return err(res, 404, "APP_NOT_FOUND", "Application not found");

    const name = ((app.form as any)?.name ? sanitizeString((app.form as any).name, 128) : "Partner");
    const partner = await service.createPartner(name, body.setupCredits ?? 1);
    await service.approveApplication(app.id, partner.id, user.id);

    let createdUserId: string | null = null;
    if (body.userId) {
      await service.addMember(partner.id, body.userId, "PARTNER_ADMIN");
      createdUserId = body.userId;
    } else if (body.createUser) {
      const u = await authService.register(body.createUser.email, body.createUser.password, "VIEWER", body.createUser.name);
      await service.addMember(partner.id, u.id, "PARTNER_ADMIN");
      createdUserId = u.id;
    }

    return ok(res, { partnerId: partner.id, userId: createdUserId });
  } catch (e: any) {
    return err(res, 400, "APPROVE_FAILED", e?.message || "Approve failed");
  }
});

// Reject application
const RejectSchema = z.object({ reason: z.string().optional() });
partnerRouter.post("/applications/:id/reject", async (req, res) => {
  try {
    const user = (req as any).user as { role: string; id: string };
    if (user.role !== "SUPER_ADMIN") return err(res, 403, "FORBIDDEN", "Forbidden");
    const body = RejectSchema.parse(req.body || {});
    const app = await service.getApplication(req.params.id);
    if (!app || app.status !== "pending") return err(res, 404, "APP_NOT_FOUND", "Application not found");
    await service.rejectApplication(app.id, user.id, body.reason);
    return ok(res);
  } catch (e: any) {
    return err(res, 400, "REJECT_FAILED", e?.message || "Reject failed");
  }
});

// Pricing update (SUPER_ADMIN)
const PricingSchema = z.object({ setupCredits: z.number().int().positive() });
partnerRouter.post("/:id/pricing", async (req, res) => {
  try {
    const user = (req as any).user as { role: string };
    if (user.role !== "SUPER_ADMIN") return err(res, 403, "FORBIDDEN", "Forbidden");
    const body = PricingSchema.parse(req.body || {});
    const p = await service.updatePricing(req.params.id, body.setupCredits);
    return ok(res, { pricing: p });
  } catch (e: any) {
    return err(res, 400, "PRICING_FAILED", e?.message || "Pricing update failed");
  }
});

// Ledger (SUPER_ADMIN or same partner member)
partnerRouter.get("/:id/ledger", async (req, res) => {
  try {
    const viewer = (req as any).user as { role: string; partnerId?: string };
    if (viewer.role !== "SUPER_ADMIN") {
      if (!viewer.partnerId || viewer.partnerId !== req.params.id) return err(res, 403, "FORBIDDEN", "Forbidden");
    }
    const items = await service.getLedger(req.params.id, Number(req.query.take || 50));
    return ok(res, { ledger: items });
  } catch (e: any) {
    return err(res, 400, "LEDGER_FAILED", e?.message || "Ledger fetch failed");
  }
});

partnerRouter.get("/:id/wallet", async (req, res) => {
  try {
    const viewer = (req as any).user as { role: string; id: string; partnerId?: string };
    const p = await service.getById(req.params.id);
    if (!p) return res.status(404).json({ error: "Partner not found" });

    // Erişim: SUPER_ADMIN veya ilgili partner üyesi
    if (viewer.role !== "SUPER_ADMIN") {
      if (!viewer.partnerId || viewer.partnerId !== p.id) return res.status(403).json({ error: "Forbidden" });
    }

    return res.json({ balance: p.wallet?.balance ?? 0, pricing: p.pricing });
  } catch (e: any) {
    return res.status(400).json({ error: e?.message || "Wallet fetch failed" });
  }
});
