import { Router } from "express";
import { SystemService } from "../services/system.service";
import { DatabaseService } from "../services/database.service";
import { SettingsService } from "../services/settings.service";
import { authorize } from "../middleware/authorize";

export const systemRouter = Router();
const systemService = new SystemService();
const settingsService = new SettingsService();

systemRouter.get("/status", authorize("VIEWER", "OPERATOR", "ADMIN", "SUPER_ADMIN"), async (_req, res): Promise<void> => {
  try {
    const status = await systemService.checkSystemStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: "System status check failed" });
  }
});

systemRouter.get("/resources", authorize("VIEWER", "OPERATOR", "ADMIN", "SUPER_ADMIN"), async (_req, res): Promise<void> => {
  try {
    const resources = await systemService.getSystemResources();
    res.json(resources);
  } catch (error) {
    res.status(500).json({ error: "Failed to get system resources" });
  }
});

systemRouter.post("/check-requirements", authorize("ADMIN", "SUPER_ADMIN"), async (_req, res): Promise<void> => {
  try {
    const requirements = await systemService.checkRequirements();
    res.json(requirements);
  } catch (error) {
    res.status(500).json({ error: "Requirements check failed" });
  }
});

systemRouter.post("/check/:service", authorize("ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const { service } = req.params;
    const status = await systemService.checkSingleService(service);
    res.json({ status });
  } catch (error) {
    res.status(500).json({ error: "Service check failed" });
  }
});

systemRouter.post("/install/:service", authorize("ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const { service } = req.params;
    const { os } = req.body;

    if (!os) {
      res.status(400).json({ error: "OS is required" });
      return;
    }

    const result = await systemService.installService(service, os);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Installation failed" });
  }
});

// Settings - get
systemRouter.get("/settings", authorize("VIEWER", "OPERATOR", "ADMIN", "SUPER_ADMIN"), async (_req, res): Promise<void> => {
  try {
    const saved = await settingsService.getSettings();

    const envDefaults = {
      db: {
        host: process.env.DB_HOST || "localhost",
        port: parseInt(process.env.DB_PORT || "5432"),
        user: process.env.DB_USER || "postgres",
        password: process.env.DB_PASSWORD || "postgres",
      },
      redis: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
        // prefix is customer-specific; keep empty by default
        prefix: "",
      },
      paths: {
        templates: process.env.TEMPLATES_PATH || "/var/qodify/templates",
        customers: process.env.CUSTOMERS_PATH || "/var/qodify/customers",
      },
    };

    const merged = {
      db: {
        host: saved.db?.host ?? envDefaults.db.host,
        port: saved.db?.port ?? envDefaults.db.port,
        user: saved.db?.user ?? envDefaults.db.user,
        password: saved.db?.password ?? envDefaults.db.password,
      },
      redis: {
        host: saved.redis?.host ?? envDefaults.redis.host,
        port: saved.redis?.port ?? envDefaults.redis.port,
        prefix: saved.redis?.prefix ?? envDefaults.redis.prefix,
      },
      paths: {
        templates: saved.paths?.templates ?? envDefaults.paths.templates,
        customers: saved.paths?.customers ?? envDefaults.paths.customers,
      },
    };

    res.json(merged);
  } catch (error) {
    res.status(500).json({ error: "Failed to load settings" });
  }
});

// Settings - save
systemRouter.post("/settings", authorize("ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const next = await settingsService.saveSettings(req.body || {});
    res.json(next);
  } catch (error) {
    res.status(500).json({ error: "Failed to save settings" });
  }
});

// DB connection test
systemRouter.post("/test/db", authorize("ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const { host, port, user, password } = req.body || {};
    const db = new DatabaseService({ host, port, user, password });
    const result = await db.testConnection({ host, port, user, password });
    if (result.ok) {
      res.json({ ok: true });
      return;
    }
    res.status(400).json({ ok: false, message: result.message });
  } catch (error: any) {
    res.status(500).json({ ok: false, message: error?.message || "DB test failed" });
  }
});

// Redis connection test
systemRouter.post("/test/redis", authorize("ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const { host = "localhost", port = 6379 } = req.body || {};
    const result = await systemService.testRedisConnection(host, Number(port));
    if (result.ok) {
      res.json({ ok: true });
      return;
    }
    res.status(400).json({ ok: false, message: result.message });
  } catch (error: any) {
    res.status(500).json({ ok: false, message: error?.message || "Redis test failed" });
  }
});
