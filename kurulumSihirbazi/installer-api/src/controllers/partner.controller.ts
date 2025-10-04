import { Router } from "express";
import { z } from "zod";
import { PartnerService } from "../services/partner.service";

export const partnerRouter = Router();
const service = new PartnerService();

const CreateSchema = z.object({ name: z.string().min(2), setupCredits: z.number().int().positive().optional() });
partnerRouter.post("/", async (req, res) => {
  try {
    const user = (req as any).user as { role: string };
    if (user.role !== "SUPER_ADMIN") return res.status(403).json({ error: "Forbidden" });
    const body = CreateSchema.parse(req.body || {});
    const p = await service.createPartner(body.name, body.setupCredits ?? 1);
    return res.json({ partner: p });
  } catch (e: any) {
    return res.status(400).json({ error: e?.message || "Create partner failed" });
  }
});

const GrantSchema = z.object({ amount: z.number().int(), note: z.string().optional() });
partnerRouter.post("/:id/credits/grant", async (req, res) => {
  try {
    const user = (req as any).user as { role: string; id: string };
    if (user.role !== "SUPER_ADMIN") return res.status(403).json({ error: "Forbidden" });
    const body = GrantSchema.parse(req.body || {});
    const p = await service.grantCredits(req.params.id, body.amount, user.id, body.note);
    return res.json({ balance: p.balance, pricing: p.pricing });
  } catch (e: any) {
    return res.status(400).json({ error: e?.message || "Grant failed" });
  }
});

const MemberSchema = z.object({ userId: z.string().min(1), role: z.enum(["PARTNER_ADMIN", "PARTNER_INSTALLER"]) });
partnerRouter.post("/:id/members", async (req, res) => {
  try {
    const user = (req as any).user as { role: string };
    if (user.role !== "SUPER_ADMIN") return res.status(403).json({ error: "Forbidden" });
    const body = MemberSchema.parse(req.body || {});
    await service.addMember(req.params.id, body.userId, body.role);
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(400).json({ error: e?.message || "Add member failed" });
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
