import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { PartnerService } from "../services/partner.service";
import { sanitizeString, numericString } from "../utils/sanitize";
import { err, ok } from "../utils/http";

export const partnerPublicRouter = Router();
const service = new PartnerService();

const limiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });
partnerPublicRouter.use(limiter);

const ApplySchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  taxId: z.string().optional(),
  address: z.string().optional(),
  adminEmail: z.string().email().optional(),
  adminName: z.string().optional(),
});

partnerPublicRouter.post("/apply", async (req, res) => {
  try {
    const raw = ApplySchema.parse(req.body || {});
    const body = {
      name: sanitizeString(raw.name, 128),
      email: sanitizeString(raw.email, 160),
      phone: raw.phone ? numericString(raw.phone, 24) : undefined,
      taxId: raw.taxId ? sanitizeString(raw.taxId, 64) : undefined,
      address: raw.address ? sanitizeString(raw.address, 512) : undefined,
      adminEmail: raw.adminEmail ? sanitizeString(raw.adminEmail, 160) : undefined,
      adminName: raw.adminName ? sanitizeString(raw.adminName, 128) : undefined,
    };
    const app = await service.createApplication({ ...body });
    return ok(res, { applicationId: app.id });
  } catch (e: any) {
    return err(res, 400, "APPLY_FAILED", e?.message || "Başvuru alınamadı");
  }
});
