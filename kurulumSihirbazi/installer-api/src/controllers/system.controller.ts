import { Router } from "express";
import { SystemService } from "../services/system.service";
import { DatabaseService } from "../services/database.service";
import { InstallerSettings, SettingsService } from "../services/settings.service";
import { authorize } from "../middleware/authorize";
import { PM2Service } from "../services/pm2.service";
import { detectPm2 } from "../utils/pm2-utils";

export const systemRouter = Router();
const systemService = new SystemService();
const settingsService = new SettingsService();
const pm2Service = new PM2Service();

function buildSettingsResponse(saved: InstallerSettings) {
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
      prefix: "",
    },
    paths: {
      templates: process.env.TEMPLATES_PATH || "/var/qodify/templates",
      customers: process.env.CUSTOMERS_PATH || "/var/qodify/customers",
    },
  };

  const gitSaved = saved.git || {};

  return {
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
    git: {
      defaultRepo: gitSaved.defaultRepo ?? "",
      defaultBranch: gitSaved.defaultBranch ?? "main",
      depth: gitSaved.depth ?? 1,
      username: gitSaved.username ?? "",
      tokenSet: Boolean(gitSaved.token),
    },
  };
}

systemRouter.get("/status", authorize("SUPER_ADMIN"), async (_req, res): Promise<void> => {
  try {
    const status = await systemService.checkSystemStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: "System status check failed" });
  }
});

systemRouter.get("/resources", authorize("SUPER_ADMIN"), async (_req, res): Promise<void> => {
  try {
    const resources = await systemService.getSystemResources();
    res.json(resources);
  } catch (error) {
    res.status(500).json({ error: "Failed to get system resources" });
  }
});

// PM2 controls
systemRouter.get("/pm2/info", authorize("SUPER_ADMIN"), async (_req, res): Promise<void> => {
  try {
    const info = await detectPm2();
    res.json({
      bin: info?.bin || null,
      version: info?.version || null,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to get PM2 info" });
  }
});

systemRouter.get("/pm2/list", authorize("SUPER_ADMIN"), async (_req, res): Promise<void> => {
  try {
    const list = await pm2Service.pm2List();
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: "Failed to get PM2 process list" });
  }
});

systemRouter.post("/pm2/save", authorize("SUPER_ADMIN"), async (_req, res): Promise<void> => {
  const result = await pm2Service.pm2Save();
  res.status(result.success ? 200 : 500).json(result);
});

systemRouter.post("/pm2/startup", authorize("SUPER_ADMIN"), async (_req, res): Promise<void> => {
  const result = await pm2Service.pm2Startup();
  res.status(result.success ? 200 : 500).json(result);
});

systemRouter.post("/pm2/stop-all", authorize("SUPER_ADMIN"), async (_req, res): Promise<void> => {
  const result = await pm2Service.pm2StopAll();
  res.status(result.success ? 200 : 500).json(result);
});

systemRouter.post("/pm2/restart-all", authorize("SUPER_ADMIN"), async (_req, res): Promise<void> => {
  const result = await pm2Service.pm2RestartAll();
  res.status(result.success ? 200 : 500).json(result);
});

systemRouter.post("/pm2/update", authorize("SUPER_ADMIN"), async (_req, res): Promise<void> => {
  const result = await pm2Service.pm2Update();
  res.status(result.success ? 200 : 500).json(result);
});

systemRouter.post("/check-requirements", authorize("SUPER_ADMIN"), async (_req, res): Promise<void> => {
  try {
    const requirements = await systemService.checkRequirements();
    res.json(requirements);
  } catch (error) {
    res.status(500).json({ error: "Requirements check failed" });
  }
});

systemRouter.post("/check/:service", authorize("SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const { service } = req.params;
    const status = await systemService.checkSingleService(service);
    res.json({ status });
  } catch (error) {
    res.status(500).json({ error: "Service check failed" });
  }
});

systemRouter.post("/install/:service", authorize("SUPER_ADMIN"), async (req, res): Promise<void> => {
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
systemRouter.get("/settings", authorize("SUPER_ADMIN"), async (_req, res): Promise<void> => {
  try {
    const saved = await settingsService.getSettings();
    res.json(buildSettingsResponse(saved));
  } catch (error) {
    res.status(500).json({ error: "Failed to load settings" });
  }
});

// Settings - save
systemRouter.post("/settings", authorize("SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const body = (req.body || {}) as InstallerSettings & { git?: any };
    if (body.git) {
      const git = { ...body.git };
      if (typeof git.tokenSet !== "undefined") {
        delete git.tokenSet;
      }
      if (git.clearToken) {
        git.token = "";
        delete git.clearToken;
      }
      body.git = git;
    }

    const next = await settingsService.saveSettings(body);
    res.json(buildSettingsResponse(next));
  } catch (error) {
    res.status(500).json({ error: "Failed to save settings" });
  }
});

// DB connection test
systemRouter.post("/test/db", authorize("SUPER_ADMIN"), async (req, res): Promise<void> => {
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
systemRouter.post("/test/redis", authorize("SUPER_ADMIN"), async (req, res): Promise<void> => {
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
