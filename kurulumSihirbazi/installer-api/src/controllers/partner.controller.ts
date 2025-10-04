import { Router } from "express";
import { z } from "zod";
import { PartnerService } from "../services/partner.service";
import { AuthService } from "../services/auth.service";
import { err, ok } from "../utils/http";
import { sanitizeString } from "../utils/sanitize";
import rateLimit from "express-rate-limit";
import { verifyOrigin } from "../middleware/origin";
import { AuditService } from "../services/audit.service";

export const partnerRouter = Router();
const service = new PartnerService();
const authService = new AuthService();
const audit = new AuditService();

// Basic origin check for mutating endpoints
partnerRouter.use((req, res, next) => {
  if (["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) return verifyOrigin(req, res, next);
  return next();
});

const adminLimiter = rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

const CreateSchema = z.object({ name: z.string().min(2), setupCredits: z.number().int().positive().optional() });
partnerRouter.post("/", adminLimiter, async (req, res) => {
  try {
    const user = (req as any).user as { role: string };
    if (user.role !== "SUPER_ADMIN") return err(res, 403, "FORBIDDEN", "Forbidden");
    const bodyRaw = CreateSchema.parse(req.body || {});
    const p = await service.createPartner(sanitizeString(bodyRaw.name, 128), bodyRaw.setupCredits ?? 1);
    await audit.log({ actorId: (req as any).user?.id, action: "PARTNER_CREATE", targetType: "Partner", targetId: p.id, metadata: { name: p.name } });
    return ok(res, { partner: p });
  } catch (e: any) {
    return err(res, 400, "PARTNER_CREATE_FAILED", e?.message || "Create partner failed");
  }
});

const GrantSchema = z.object({ amount: z.number().int(), note: z.string().optional() });
partnerRouter.post("/:id/credits/grant", adminLimiter, async (req, res) => {
  try {
    const user = (req as any).user as { role: string; id: string };
    if (user.role !== "SUPER_ADMIN") return err(res, 403, "FORBIDDEN", "Forbidden");
    const body = GrantSchema.parse(req.body || {});
    const p = await service.grantCredits(req.params.id, body.amount, user.id, body.note);
    await audit.log({ actorId: user.id, action: "PARTNER_CREDIT_GRANT", targetType: "Partner", targetId: req.params.id, metadata: { amount: body.amount, note: body.note } });
    return ok(res, { balance: p.balance, pricing: p.pricing });
  } catch (e: any) {
    return err(res, 400, "CREDIT_GRANT_FAILED", e?.message || "Grant failed");
  }
});

// Add member by email - creates new user if not exists (SUPER_ADMIN)
const MemberByEmailSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
  role: z.enum(["PARTNER_ADMIN", "PARTNER_INSTALLER"])
});
partnerRouter.post("/:id/members/by-email", adminLimiter, async (req, res) => {
  try {
    const user = (req as any).user as { role: string; id: string };
    if (user.role !== "SUPER_ADMIN") return err(res, 403, "FORBIDDEN", "Forbidden");
    const body = MemberByEmailSchema.parse(req.body || {});
    const prisma = (await import("../db/prisma")).prisma;

    // Check if user already exists
    let u = await prisma.user.findUnique({ where: { email: body.email } });
    let createdNew = false;

    if (!u) {
      // Create new user
      const argon2 = (await import("argon2")).default;
      const passwordHash = await argon2.hash(body.password, {
        type: argon2.argon2id,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      });

      u = await prisma.user.create({
        data: {
          email: body.email,
          passwordHash,
          name: body.name || body.email.split('@')[0],
          role: 'VIEWER', // Default role for partner members
        }
      });
      createdNew = true;
    }

    await service.addMember(req.params.id, u.id, body.role);
    await audit.log({
      actorId: user.id,
      action: "PARTNER_MEMBER_ADD",
      targetType: "Partner",
      targetId: req.params.id,
      metadata: { by: "email", email: body.email, role: body.role, createdNew }
    });
    return ok(res, { userId: u.id, createdNew });
  } catch (e: any) {
    return err(res, 400, "ADD_MEMBER_EMAIL_FAILED", e?.message || "Add member by email failed");
  }
});

// List partners (SUPER_ADMIN)
partnerRouter.get("/", async (req, res) => {
  try {
    const user = (req as any).user as { role: string };
    if (user.role !== "SUPER_ADMIN") return err(res, 403, "FORBIDDEN", "Forbidden");
    const items = await service.listPartners();
    return ok(res, { partners: items });
  } catch (e: any) {
    return err(res, 400, "PARTNER_LIST_FAILED", e?.message || "List partners failed");
  }
});

// List applications (SUPER_ADMIN) - MUST be before /:id routes
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

// Partner detail (SUPER_ADMIN or owner member)
partnerRouter.get("/:id", async (req, res) => {
  try {
    const viewer = (req as any).user as { role: string; partnerId?: string };
    if (viewer.role !== "SUPER_ADMIN" && viewer.partnerId !== req.params.id) return err(res, 403, "FORBIDDEN", "Forbidden");
    const p = await service.getById(req.params.id);
    if (!p) return err(res, 404, "PARTNER_NOT_FOUND", "Partner not found");
    return ok(res, { partner: p });
  } catch (e: any) {
    return err(res, 400, "PARTNER_FETCH_FAILED", e?.message || "Fetch failed");
  }
});

// Members list (SUPER_ADMIN or owner member)
partnerRouter.get("/:id/members", async (req, res) => {
  try {
    const viewer = (req as any).user as { role: string; partnerId?: string };
    if (viewer.role !== "SUPER_ADMIN" && viewer.partnerId !== req.params.id) return err(res, 403, "FORBIDDEN", "Forbidden");
    const items = await service.listMembers(req.params.id);
    return ok(res, { members: items });
  } catch (e: any) {
    return err(res, 400, "MEMBERS_FAILED", e?.message || "Members fetch failed");
  }
});

// Approve application and optionally create member user
const ApproveSchema = z.object({
  setupCredits: z.number().int().positive().optional(),
  createUser: z.object({ email: z.string().email(), password: z.string().min(6), name: z.string().optional() }).optional(),
  userId: z.string().optional(),
});

partnerRouter.post("/applications/:id/approve", adminLimiter, async (req, res) => {
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

    // Auto-create user from application form if admin credentials exist
    const formData = app.form as any;
    if (formData?.adminEmail && formData?.adminPassword && formData?.adminName) {
      const u = await authService.register(formData.adminEmail, formData.adminPassword, "VIEWER", formData.adminName);
      await service.addMember(partner.id, u.id, "PARTNER_ADMIN");
      createdUserId = u.id;
    }
    // Manual user creation/assignment (override auto-create)
    else if (body.userId) {
      await service.addMember(partner.id, body.userId, "PARTNER_ADMIN");
      createdUserId = body.userId;
    } else if (body.createUser) {
      const u = await authService.register(body.createUser.email, body.createUser.password, "VIEWER", body.createUser.name);
      await service.addMember(partner.id, u.id, "PARTNER_ADMIN");
      createdUserId = u.id;
    }

    await audit.log({ actorId: user.id, action: "PARTNER_APPLICATION_APPROVE", targetType: "PartnerApplication", targetId: app.id, metadata: { partnerId: partner.id, userId: createdUserId } });
    return ok(res, { partnerId: partner.id, userId: createdUserId });
  } catch (e: any) {
    return err(res, 400, "APPROVE_FAILED", e?.message || "Approve failed");
  }
});

// Reject application
const RejectSchema = z.object({ reason: z.string().optional() });
partnerRouter.post("/applications/:id/reject", adminLimiter, async (req, res) => {
  try {
    const user = (req as any).user as { role: string; id: string };
    if (user.role !== "SUPER_ADMIN") return err(res, 403, "FORBIDDEN", "Forbidden");
    const body = RejectSchema.parse(req.body || {});
    const app = await service.getApplication(req.params.id);
    if (!app || app.status !== "pending") return err(res, 404, "APP_NOT_FOUND", "Application not found");
    await service.rejectApplication(app.id, user.id, body.reason);
    await audit.log({ actorId: user.id, action: "PARTNER_APPLICATION_REJECT", targetType: "PartnerApplication", targetId: app.id, metadata: { reason: body.reason } });
    return ok(res);
  } catch (e: any) {
    return err(res, 400, "REJECT_FAILED", e?.message || "Reject failed");
  }
});

// Pricing update (SUPER_ADMIN)
const PricingSchema = z.object({ setupCredits: z.number().int().positive() });
partnerRouter.post("/:id/pricing", adminLimiter, async (req, res) => {
  try {
    const user = (req as any).user as { role: string };
    if (user.role !== "SUPER_ADMIN") return err(res, 403, "FORBIDDEN", "Forbidden");
    const body = PricingSchema.parse(req.body || {});
    const p = await service.updatePricing(req.params.id, body.setupCredits);
    await audit.log({ actorId: (req as any).user?.id, action: "PARTNER_PRICING_UPDATE", targetType: "Partner", targetId: req.params.id, metadata: { setupCredits: body.setupCredits } });
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
