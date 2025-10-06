import { Router } from "express";
import { CustomerService } from "../services/customer.service";
import { authorize } from "../middleware/authorize";
import { requireScopes } from "../middleware/scopes";
import { SCOPES } from "../constants/scopes";
import { z } from "zod";
import { sanitizeDomain, sanitizeString } from "../utils/sanitize";
import { ok, err } from "../utils/http";

export const customerRouter = Router();
const customerService = new CustomerService();

// Get all customers
customerRouter.get("/", authorize("VIEWER", "OPERATOR", "ADMIN", "SUPER_ADMIN"), requireScopes(SCOPES.CUSTOMER_READ_OWN), async (req, res): Promise<void> => {
  try {
    const customers = await customerService.getAllCustomers();
    const user = req.user;
    if (user?.partnerId) {
      ok(res, { customers: customers.filter(c => c.partnerId === user.partnerId) });
      return;
    }
    ok(res, { customers });
    return;
  } catch (error) {
    err(res, 500, "CUSTOMERS_LIST_FAILED", "Failed to fetch customers");
    return;
  }
});

// Get next available base port
customerRouter.get("/next-port", requireScopes(SCOPES.SETUP_RUN), async (_req, res): Promise<void> => {
  try {
    const repo = (await import("../repositories/customer.db.repository")).CustomerDbRepository.getInstance();
    const base = await repo.getNextAvailablePort();
    ok(res, { base, backend: base, admin: base + 1, store: base + 2 });
    return;
  } catch (e: any) {
    err(res, 500, "NEXT_PORT_FAILED", e?.message || "Failed to get next port");
    return;
  }
});

// Get customer by ID
customerRouter.get("/:id", authorize("VIEWER", "OPERATOR", "ADMIN", "SUPER_ADMIN"), requireScopes(SCOPES.CUSTOMER_READ_OWN), async (req, res): Promise<void> => {
  try {
    const customer = await customerService.getCustomerById(req.params.id);
    if (!customer) { err(res, 404, "CUSTOMER_NOT_FOUND", "Customer not found"); return; }
    const user = req.user;
    if (user?.partnerId && customer.partnerId && customer.partnerId !== user.partnerId) { err(res, 403, "FORBIDDEN", "Forbidden"); return; }
    ok(res, { customer });
    return;
  } catch (error) {
    err(res, 500, "CUSTOMER_FETCH_FAILED", "Failed to fetch customer");
    return;
  }
});

// Admin CRUD (DB tabanlı)
const CustomerCreateSchema = z.object({
  domain: z.string().min(3),
  partnerId: z.string().optional(),
  mode: z.enum(["local", "production"]).optional(),
  ports: z.object({ backend: z.number().int().positive(), admin: z.number().int().positive(), store: z.number().int().positive() }),
  db: z.object({ name: z.string(), user: z.string(), host: z.string(), port: z.number().int(), schema: z.string().optional() }).optional(),
  redis: z.object({ host: z.string(), port: z.number().int(), prefix: z.string().optional() }).optional(),
});

customerRouter.post("/", authorize("ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const raw = CustomerCreateSchema.parse(req.body || {});
    const domain = sanitizeDomain(raw.domain);
    const { v4: uuidv4 } = await import("uuid");
    const id = uuidv4();
    const now = new Date().toISOString();
    await customerService.saveCustomer({
      id,
      domain,
      status: "stopped",
      createdAt: now,
      partnerId: raw.partnerId,
      mode: raw.mode || "local",
      ports: raw.ports,
      resources: { cpu: 0, memory: 0 },
      db: raw.db ? { ...raw.db, name: sanitizeString(raw.db.name, 128), user: sanitizeString(raw.db.user, 128), host: sanitizeString(raw.db.host, 128), schema: raw.db.schema || "public" } : undefined,
      redis: raw.redis ? { ...raw.redis, host: sanitizeString(raw.redis.host, 128), prefix: raw.redis.prefix ? sanitizeString(raw.redis.prefix, 128) : undefined } : undefined,
    });
    ok(res, { id });
    return;
  } catch (e: any) {
    err(res, 400, "CUSTOMER_CREATE_FAILED", e?.message || "Create failed");
    return;
  }
});

const CustomerUpdateSchema = CustomerCreateSchema.partial();
customerRouter.put("/:id", authorize("ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const id = req.params.id;
    const raw = CustomerUpdateSchema.parse(req.body || {});
    const updates: any = {};
    if (raw.domain) updates.domain = sanitizeDomain(raw.domain);
    if (raw.partnerId !== undefined) updates.partnerId = raw.partnerId;
    if (raw.mode) updates.mode = raw.mode;
    if (raw.ports) updates.ports = raw.ports;
    if (raw.db) updates.db = { ...raw.db, name: raw.db.name ? sanitizeString(raw.db.name, 128) : undefined, user: raw.db.user ? sanitizeString(raw.db.user, 128) : undefined, host: raw.db.host ? sanitizeString(raw.db.host, 128) : undefined };
    if (raw.redis) updates.redis = { ...raw.redis, host: raw.redis.host ? sanitizeString(raw.redis.host, 128) : undefined, prefix: raw.redis.prefix ? sanitizeString(raw.redis.prefix, 128) : undefined };
    const next = await customerService.updateCustomer?.(id, updates as any);
    if (!next) { err(res, 404, "CUSTOMER_NOT_FOUND", "Customer not found"); return; }
    ok(res, { customer: next });
    return;
  } catch (e: any) {
    err(res, 400, "CUSTOMER_UPDATE_FAILED", e?.message || "Update failed");
    return;
  }
});

// DELETE: DB'den sil (tam silme)
customerRouter.delete("/:id", authorize("ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const hard = String(req.query.hard || "").toLowerCase() === "true";
    if (hard) {
      try {
        const result = await customerService.deleteCustomer(req.params.id);
        ok(res, result);
        return;
      } catch (e: any) {
        err(res, 500, "CUSTOMER_HARD_DELETE_FAILED", e?.message || "Hard delete failed");
        return;
      }
    } else {
      const repo = (await import("../repositories/customer.db.repository")).CustomerDbRepository.getInstance();
      const okDel = await repo.delete(req.params.id);
      if (!okDel) { err(res, 404, "CUSTOMER_NOT_FOUND", "Customer not found"); return; }
      ok(res);
      return;
    }
  } catch (e: any) {
    err(res, 400, "CUSTOMER_DELETE_FAILED", e?.message || "Delete failed");
    return;
  }
});

// Deploy endpoint removed - using setup.service.ts instead

// Customer actions
customerRouter.post("/:id/start", authorize("OPERATOR", "ADMIN", "SUPER_ADMIN", "PARTNER_ADMIN", "PARTNER_INSTALLER"), async (req, res): Promise<void> => {
  try {
    const result = await customerService.startCustomer(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to start customer" });
  }
});

customerRouter.post("/:id/stop", authorize("OPERATOR", "ADMIN", "SUPER_ADMIN", "PARTNER_ADMIN", "PARTNER_INSTALLER"), async (req, res): Promise<void> => {
  try {
    const result = await customerService.stopCustomer(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to stop customer" });
  }
});

customerRouter.post("/:id/restart", authorize("OPERATOR", "ADMIN", "SUPER_ADMIN", "PARTNER_ADMIN", "PARTNER_INSTALLER"), async (req, res): Promise<void> => {
  try {
    const result = await customerService.restartCustomer(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to restart customer" });
  }
});

customerRouter.post("/:id/delete", authorize("ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const result = await customerService.deleteCustomer(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to delete customer" });
  }
});

// Get customer logs
customerRouter.get("/:id/logs", authorize("VIEWER", "OPERATOR", "ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const service = req.query.service as string || 'backend';
    const lines = parseInt(req.query.lines as string) || 100;
    const logs = await customerService.getCustomerLogs(req.params.id, service, lines);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch logs" });
  }
});

// Get customer service health
customerRouter.get("/:id/health", authorize("VIEWER", "OPERATOR", "ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const health = await customerService.getCustomerHealth(req.params.id);
    res.json(health);
  } catch (error) {
    res.status(500).json({ error: "Failed to check health" });
  }
});

// Get environment configuration
customerRouter.get("/:id/env-config", authorize("VIEWER", "OPERATOR", "ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const envConfig = await customerService.getEnvConfig(req.params.id);
    res.json(envConfig);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch environment configuration" });
  }
});

// Update environment configuration
customerRouter.put("/:id/env-config", authorize("ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const result = await customerService.updateEnvConfig(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to update environment configuration" });
  }
});

// Restart specific service with PM2
customerRouter.post("/:id/restart-service", authorize("OPERATOR", "ADMIN", "SUPER_ADMIN", "PARTNER_ADMIN", "PARTNER_INSTALLER"), async (req, res): Promise<void> => {
  try {
    const { service } = req.body; // 'backend', 'admin', or 'store'
    const result = await customerService.restartService(req.params.id, service);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to restart service" });
  }
});

// Get admin users
customerRouter.get("/:id/admins", authorize("VIEWER", "OPERATOR", "ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const result = await customerService.getAdmins(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch admin users" });
  }
});

// Create admin user
customerRouter.post("/:id/admins", authorize("ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const result = await customerService.createAdmin(req.params.id, { email, password, name });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to create admin user" });
  }
});

// Prisma database operations
customerRouter.post("/:id/database/generate", authorize("ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const result = await customerService.runPrismaGenerate(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to run Prisma generate" });
  }
});

customerRouter.post("/:id/database/push", authorize("ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const result = await customerService.runPrismaDbPush(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to run Prisma db push" });
  }
});

customerRouter.post("/:id/database/migrate", authorize("ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const result = await customerService.runPrismaMigrate(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to run Prisma migrate" });
  }
});

customerRouter.post("/:id/database/seed", authorize("ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const result = await customerService.runSeed(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to run seed" });
  }
});

// Deployment bilgisi
customerRouter.get("/:id/deployment", authorize("ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const info = await customerService.getDeploymentInfo(req.params.id);
    res.json({ success: true, info });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error?.message || "Deployment bilgisi alınamadı" });
  }
});

// Git üzerinden güncelle
customerRouter.post("/:id/update/git", authorize("ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const result = await customerService.updateFromGit(req.params.id, req.body || {});
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error?.message || "Git güncellemesi başarısız" });
  }
});

// Bağımlılıkları yeniden yükle
customerRouter.post("/:id/update/install-dependencies", authorize("ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const result = await customerService.installDependencies(req.params.id);
    if (!result?.ok) {
      res.status(500).json(result);
      return;
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error?.message || "Bağımlılık yükleme hatası" });
  }
});

// Build işlemi
customerRouter.post("/:id/update/build", authorize("ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const body = (req.body || {}) as { heapMB?: number; skipTypeCheck?: boolean };
    const result = await customerService.buildApplications(req.params.id, {
      heapMB: typeof body.heapMB === 'number' ? body.heapMB : undefined,
      skipTypeCheck: Boolean(body.skipTypeCheck)
    });
    if (!result?.ok) {
      res.status(500).json(result);
      return;
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ ok: false, message: error?.message || "Build işlemi başarısız" });
  }
});
