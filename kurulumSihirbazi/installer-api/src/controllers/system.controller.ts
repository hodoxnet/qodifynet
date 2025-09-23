import { Router } from "express";
import { SystemService } from "../services/system.service";
import { DatabaseService } from "../services/database.service";
import { SettingsService } from "../services/settings.service";

export const systemRouter = Router();
const systemService = new SystemService();
const settingsService = new SettingsService();

systemRouter.get("/status", async (req, res) => {
  try {
    const status = await systemService.checkSystemStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: "System status check failed" });
  }
});

systemRouter.get("/resources", async (req, res) => {
  try {
    const resources = await systemService.getSystemResources();
    res.json(resources);
  } catch (error) {
    res.status(500).json({ error: "Failed to get system resources" });
  }
});

systemRouter.post("/check-requirements", async (req, res) => {
  try {
    const requirements = await systemService.checkRequirements();
    res.json(requirements);
  } catch (error) {
    res.status(500).json({ error: "Requirements check failed" });
  }
});

systemRouter.post("/check/:service", async (req, res) => {
  try {
    const { service } = req.params;
    const status = await systemService.checkSingleService(service);
    res.json({ status });
  } catch (error) {
    res.status(500).json({ error: "Service check failed" });
  }
});

systemRouter.post("/install/:service", async (req, res) => {
  try {
    const { service } = req.params;
    const { os } = req.body;

    if (!os) {
      return res.status(400).json({ error: "OS is required" });
    }

    const result = await systemService.installService(service, os);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Installation failed" });
  }
});

// Settings - get
systemRouter.get("/settings", async (req, res) => {
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
    };

    res.json(merged);
  } catch (error) {
    res.status(500).json({ error: "Failed to load settings" });
  }
});

// Settings - save
systemRouter.post("/settings", async (req, res) => {
  try {
    const next = await settingsService.saveSettings(req.body || {});
    res.json(next);
  } catch (error) {
    res.status(500).json({ error: "Failed to save settings" });
  }
});

// DB connection test
systemRouter.post("/test/db", async (req, res) => {
  try {
    const { host, port, user, password } = req.body || {};
    const db = new DatabaseService({ host, port, user, password });
    const result = await db.testConnection({ host, port, user, password });
    if (result.ok) return res.json({ ok: true });
    return res.status(400).json({ ok: false, message: result.message });
  } catch (error: any) {
    res.status(500).json({ ok: false, message: error?.message || "DB test failed" });
  }
});

// Redis connection test
systemRouter.post("/test/redis", async (req, res) => {
  try {
    const { host = "localhost", port = 6379 } = req.body || {};
    const result = await systemService.testRedisConnection(host, Number(port));
    if (result.ok) return res.json({ ok: true });
    return res.status(400).json({ ok: false, message: result.message });
  } catch (error: any) {
    res.status(500).json({ ok: false, message: error?.message || "Redis test failed" });
  }
});
