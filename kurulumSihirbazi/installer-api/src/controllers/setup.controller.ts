import { Router } from "express";
import { SetupService } from "../services/setup.service";
import { CustomerService } from "../services/customer.service";
import { PM2Service } from "../services/pm2.service";
import { NginxService } from "../services/nginx.service";
import { authorize } from "../middleware/authorize";
import { v4 as uuidv4 } from "uuid";

export const setupRouter = Router();
const setupService = new SetupService();
const customerService = new CustomerService();
const pm2Service = new PM2Service();
const nginxService = new NginxService();

// Adım 1: Sistem gereksinimlerini kontrol et
setupRouter.get("/requirements", authorize("ADMIN", "SUPER_ADMIN"), async (_req, res): Promise<void> => {
  try {
    const requirements = await setupService.checkSystemRequirements();
    res.json({ ok: true, requirements });
  } catch (error: any) {
    res.status(500).json({ ok: false, message: error.message || "Gereksinim kontrolü başarısız" });
  }
});

// Adım 2: Veritabanı bağlantısını test et
setupRouter.post("/test-database", authorize("ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const { host, port, user, password } = req.body;

    if (!host || !port || !user || !password) {
      res.status(400).json({ ok: false, message: "Tüm veritabanı bilgileri gerekli" });
      return;
    }

    const result = await setupService.testDatabaseConnection({
      host,
      port: Number(port),
      user,
      password
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ ok: false, message: error.message || "Veritabanı test hatası" });
  }
});

// Adım 3: Redis bağlantısını test et
setupRouter.post("/test-redis", authorize("ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const { host = "localhost", port = 6379 } = req.body;

    const result = await setupService.testRedisConnection(host, Number(port));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ ok: false, message: error.message || "Redis test hatası" });
  }
});

// Adım 4: Veritabanı oluştur
setupRouter.post("/create-database", authorize("ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const { dbConfig, dbName, appUser, appPassword } = req.body;

    if (!dbConfig || !dbName || !appUser || !appPassword) {
      res.status(400).json({ ok: false, message: "Tüm veritabanı bilgileri gerekli" });
      return;
    }

    const result = await setupService.createDatabase(
      dbConfig,
      dbName,
      appUser,
      appPassword
    );

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ ok: false, message: error.message || "Veritabanı oluşturma hatası" });
  }
});

// Adım 5: Template'leri kontrol et
setupRouter.post("/check-templates", authorize("ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const { version = "latest" } = req.body;
    const result = await setupService.checkTemplates(version);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ ok: false, message: error.message || "Template kontrol hatası" });
  }
});

// Adım 6: Template'leri çıkar
setupRouter.post("/extract-templates", authorize("ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const { domain, version = "latest" } = req.body;

    if (!domain) {
      res.status(400).json({ ok: false, message: "Domain gerekli" });
      return;
    }

    const result = await setupService.extractTemplates(domain, version, (message) => {
      setupService.emitProgress(domain, "extract", message);
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ ok: false, message: error.message || "Template çıkarma hatası" });
  }
});

// Adım 7: Ortam değişkenlerini yapılandır
setupRouter.post("/configure-environment", authorize("ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const { domain, dbName, dbUser, dbPassword, dbHost, dbPort, redisHost, redisPort, storeName } = req.body;

    if (!domain || !dbName || !dbUser || !dbPassword || !storeName) {
      res.status(400).json({ ok: false, message: "Tüm yapılandırma bilgileri gerekli" });
      return;
    }

    // Port tahsis et
    const basePort = await customerService.getNextAvailablePort();
    const ports = {
      backend: basePort,
      admin: basePort + 1,
      store: basePort + 2
    };

    const result = await setupService.configureEnvironment(domain, {
      dbName,
      dbUser,
      dbPassword,
      dbHost: dbHost || "localhost",
      dbPort: dbPort || 5432,
      redisHost: redisHost || "localhost",
      redisPort: redisPort || 6379,
      ports,
      storeName
    });

    res.json({ ...result, ports });
  } catch (error: any) {
    res.status(500).json({ ok: false, message: error.message || "Ortam yapılandırma hatası" });
  }
});

// Adım 8: Bağımlılıkları yükle
setupRouter.post("/install-dependencies", authorize("ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const { domain } = req.body;

    if (!domain) {
      res.status(400).json({ ok: false, message: "Domain gerekli" });
      return;
    }

    const result = await setupService.installDependencies(domain, (message) => {
      setupService.emitProgress(domain, "dependencies", message);
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ ok: false, message: error.message || "Bağımlılık yükleme hatası" });
  }
});

// Adım 9: Migration'ları çalıştır
setupRouter.post("/run-migrations", authorize("ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const { domain } = req.body;

    if (!domain) {
      res.status(400).json({ ok: false, message: "Domain gerekli" });
      return;
    }

    const result = await setupService.runMigrations(domain);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ ok: false, message: error.message || "Migration hatası" });
  }
});

// Adım 10: Uygulamaları derle
setupRouter.post("/build-applications", authorize("ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const { domain, isLocal } = req.body;

    if (!domain) {
      res.status(400).json({ ok: false, message: "Domain gerekli" });
      return;
    }

    const result = await setupService.buildApplications(domain, isLocal, (message) => {
      setupService.emitProgress(domain, "build", message);
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ ok: false, message: error.message || "Derleme hatası" });
  }
});

// Adım 11: PM2 ve Nginx yapılandırması
setupRouter.post("/configure-services", authorize("ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const { domain, ports, isLocal } = req.body;

    if (!domain || !ports) {
      res.status(400).json({ ok: false, message: "Domain ve port bilgileri gerekli" });
      return;
    }

    const customerPath = process.env.CUSTOMERS_PATH
      ? `${process.env.CUSTOMERS_PATH}/${domain.replace(/\./g, "-")}`
      : `/var/qodify/customers/${domain.replace(/\./g, "-")}`;

    // Local mode'da PM2 kontrolü yap
    if (isLocal) {
      // PM2 kurulu mu kontrol et
      try {
        const { exec } = require("child_process");
        const { promisify } = require("util");
        const execAsync = promisify(exec);
        await execAsync("pm2 --version");

        // PM2 kuruluysa ecosystem oluştur
        await pm2Service.createEcosystem(domain, customerPath, ports, { devMode: isLocal });
      } catch (pmError) {
        // PM2 kurulu değilse uyarı ver ama hata verme
        console.log("PM2 kurulu değil, local mode'da manuel başlatma gerekecek");
      }
    } else {
      // Production mode - PM2 gerekli
      await pm2Service.createEcosystem(domain, customerPath, ports, { devMode: isLocal });
      await nginxService.createConfig(domain, ports);
    }

    res.json({ ok: true, message: "Servisler yapılandırıldı" });
  } catch (error: any) {
    res.status(500).json({ ok: false, message: error.message || "Servis yapılandırma hatası" });
  }
});

// Adım 12: Kurulumu tamamla ve servisleri başlat
setupRouter.post("/finalize", authorize("ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const {
      domain,
      ports,
      dbName,
      dbUser,
      dbHost,
      dbPort,
      redisHost,
      redisPort,
      storeName,
      isLocal
    } = req.body;

    if (!domain || !ports || !dbName || !storeName) {
      res.status(400).json({ ok: false, message: "Gerekli bilgiler eksik" });
      return;
    }

    // Local mode kontrolü ve PM2 ile servisleri başlat
    if (isLocal) {
      try {
        const { exec } = require("child_process");
        const { promisify } = require("util");
        const execAsync = promisify(exec);
        await execAsync("pm2 --version");

        // PM2 kuruluysa başlat
        await pm2Service.startCustomer(domain);
      } catch {
        console.log("PM2 kurulu değil, servisler manuel başlatılmalı");
      }
    } else {
      // Production - PM2 gerekli
      await pm2Service.startCustomer(domain);
    }

    // Müşteri kaydını oluştur
    const customerId = uuidv4();
    await customerService.saveCustomer({
      id: customerId,
      domain,
      status: "running",
      createdAt: new Date().toISOString(),
      ports,
      resources: { cpu: 0, memory: 0 },
      mode: isLocal ? "local" : "production",
      db: {
        name: dbName,
        user: dbUser || "qodify_user",
        host: dbHost || "localhost",
        port: dbPort || 5432,
        schema: "public"
      },
      redis: {
        host: redisHost || "localhost",
        port: redisPort || 6379,
        prefix: domain.replace(/\./g, "_")
      },
    });

    // URL'leri hazırla
    const urls = isLocal ? {
      store: `http://localhost:${ports.store}`,
      admin: `http://localhost:${ports.admin}`,
      api: `http://localhost:${ports.backend}`
    } : {
      store: `https://${domain}`,
      admin: `https://${domain}/qpanel`,
      api: `https://${domain}/api`
    };

    res.json({
      ok: true,
      message: "Kurulum başarıyla tamamlandı!",
      customerId,
      domain,
      urls,
      mode: isLocal ? "local" : "production"
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, message: error.message || "Kurulum tamamlama hatası" });
  }
});

// WebSocket bağlantısı için
setupRouter.post("/subscribe", authorize("ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  const { domain } = req.body;

  if (!domain) {
    res.status(400).json({ ok: false, message: "Domain gerekli" });
    return;
  }

  // Socket.io subscription logic handled in client
  res.json({ ok: true, message: "WebSocket subscription için client socket.io kullanmalı" });
});