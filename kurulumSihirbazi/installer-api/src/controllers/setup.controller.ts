import { Router } from "express";
import fs from "fs-extra";
import path from "path";
import { SetupService } from "../services/setup.service";
import { CustomerService } from "../services/customer.service";
import { PM2Service } from "../services/pm2.service";
import { NginxService } from "../services/nginx.service";
import { requireScopes } from "../middleware/scopes";
import { v4 as uuidv4 } from "uuid";
import { SCOPES } from "../constants/scopes";
import { sanitizeDomain } from "../utils/sanitize";
import { err, ok } from "../utils/http";
import rateLimit from "express-rate-limit";
import { AuditService } from "../services/audit.service";
import { LockService } from "../services/lock.service";
import { DemoDataService } from "../services/demo-data.service";

const LOCK_TTL_SEC = 15 * 60; // 15 dakika
const lockService = new LockService();

const setupLimiter = rateLimit({ windowMs: 5 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });

export const setupRouter = Router();
const setupService = new SetupService();
const customerService = new CustomerService();
const pm2Service = new PM2Service();
const nginxService = new NginxService();
const demoService = new DemoDataService();

// Adım 1: Sistem gereksinimlerini kontrol et
setupRouter.get("/requirements", requireScopes(SCOPES.SETUP_RUN), async (req, res): Promise<void> => {
  try {
    const requirements = await setupService.checkSystemRequirements();
    // Partner kullanıcılar için detayları maskele: yalnızca genel durum dön
    const viewer = (req as any).user as { role?: string; partnerId?: string } | undefined;
    const isStaff = viewer?.role === 'SUPER_ADMIN' || viewer?.role === 'ADMIN';
    const isPartner = !isStaff && !!viewer?.partnerId;
    if (isPartner) {
      const hasRequiredError = requirements.some(r => r.required && r.status === 'error');
      const masked = [{ name: 'Sistem', status: hasRequiredError ? 'error' : 'ok', required: true }];
      res.json({ ok: true, requirements: masked });
      return;
    }
    res.json({ ok: true, requirements });
  } catch (error: any) {
    res.status(500).json({ ok: false, message: error.message || "Gereksinim kontrolü başarısız" });
  }
});

// Opsiyonel: Partner kredisi ön-rezervasyonu (Local modda gerekmez)
setupRouter.post("/reserve-credits", setupLimiter, requireScopes(SCOPES.SETUP_RUN), async (req, res): Promise<void> => {
  try {
    const user = req.user!;
    const partnerId: string | undefined = user?.partnerId;
    interface ReserveCreditsBody { domain?: string; isLocal?: boolean }
    const body = (req.body || {}) as ReserveCreditsBody;
    const domain = sanitizeDomain(body.domain || "");
    const isLocal = Boolean(body.isLocal);

    if (!partnerId) {
      // Staff – rezervasyon ve kilit gerekmiyor
      ok(res, { reserved: false });
      return;
    }

    // Concurrency kilidi: partner başına tek kuruluma izin ver
    const lock = await lockService.get(partnerId);
    if (lock) {
      err(res, 409, "SETUP_IN_PROGRESS", "Bu partner için devam eden bir kurulum var.");
      return;
    }

    // Local mod: sadece kilit al, kredi rezervasyonu yok
    if (isLocal) {
      const okLock = await lockService.acquire(partnerId, LOCK_TTL_SEC);
      if (!okLock) { err(res, 409, 'SETUP_IN_PROGRESS', 'Bu partner için devam eden bir kurulum var.'); return; }
      ok(res, { reserved: false });
      return;
    }

    const { PartnerService } = await import("../services/partner.service");
    const svc = new PartnerService();
    const tempRef = `pre-reserve-${domain || 'setup'}-${Date.now()}`;
    const r = await svc.reserveSetup(partnerId, tempRef, user.id);
    if (!r.ok) { err(res, 402, "INSUFFICIENT_CREDIT", `Yetersiz kredi. Gerekli: ${r.price}, Bakiye: ${r.balance ?? 0}`); return; }
    const okLock = await lockService.acquire(partnerId, LOCK_TTL_SEC, r.ledgerId!);
    if (!okLock) { err(res, 409, 'SETUP_IN_PROGRESS', 'Bu partner için devam eden bir kurulum var.'); return; }
    ok(res, { reserved: true, ledgerId: r.ledgerId, price: r.price });
    return;
  } catch (e: any) {
    err(res, 500, "RESERVE_FAILED", e?.message || "Kredi rezervasyonu başarısız");
    return;
  }
});

// Rezervasyon iptal (kullanıcı yarıda bırakırsa)
setupRouter.post("/cancel-reservation", setupLimiter, requireScopes(SCOPES.SETUP_RUN), async (req, res): Promise<void> => {
  try {
    const user = req.user!;
    const partnerId: string | undefined = user?.partnerId;
    const ledgerId = (req.body as any)?.ledgerId as string | undefined;
    if (partnerId) {
      const lock = await lockService.get(partnerId);
      if (lock?.status === 'committing') {
        ok(res, { cancelled: false, reason: 'committing' });
        return;
      }
      if (ledgerId) {
        try {
          const { PartnerService } = await import("../services/partner.service");
          const svc = new PartnerService();
          await svc.cancelReservation(partnerId, ledgerId, 'client-cancel');
        } catch (e) { console.error('Cancel reservation failed:', e); }
      } else if (lock?.ledgerId) {
        try {
          const { PartnerService } = await import("../services/partner.service");
          const svc = new PartnerService();
          await svc.cancelReservation(partnerId, lock.ledgerId, 'client-cancel');
        } catch (e) { console.error('Cancel reservation failed:', e); }
      }
      await lockService.release(partnerId);
    }
    ok(res, { cancelled: true });
    return;
  } catch (e: any) {
    err(res, 500, 'CANCEL_FAILED', e?.message || 'İptal başarısız');
    return;
  }
});

// Adım 2: Veritabanı bağlantısını test et
setupRouter.post("/test-database", requireScopes(SCOPES.SETUP_RUN), async (req, res): Promise<void> => {
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
setupRouter.post("/test-redis", requireScopes(SCOPES.SETUP_RUN), async (req, res): Promise<void> => {
  try {
    const { host = "localhost", port = 6379 } = req.body;

    const result = await setupService.testRedisConnection(host, Number(port));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ ok: false, message: error.message || "Redis test hatası" });
  }
});

// Adım 4: Veritabanı oluştur
setupRouter.post("/create-database", requireScopes(SCOPES.SETUP_RUN), async (req, res): Promise<void> => {
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
// Partnerlar için role kontrolü yerine scope ile geçişe izin veriyoruz; staff için ADMIN/SUPER_ADMIN şartı korunur.
setupRouter.post("/check-templates", setupLimiter, requireScopes(SCOPES.SETUP_RUN), async (req, res): Promise<void> => {
  try {
    const { version = "latest" } = req.body;
    const result = await setupService.checkTemplates(version);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ ok: false, message: error.message || "Template kontrol hatası" });
  }
});

// Adım 6: Template'leri çıkar
setupRouter.post("/extract-templates", setupLimiter, requireScopes(SCOPES.SETUP_RUN), async (req, res): Promise<void> => {
  try {
    const { domain: rawDomain, version = "latest" } = req.body;
    const domain = sanitizeDomain(rawDomain);

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
setupRouter.post("/configure-environment", setupLimiter, requireScopes(SCOPES.SETUP_RUN), async (req, res): Promise<void> => {
  try {
    const domain = sanitizeDomain(req.body?.domain);
    const { dbName, dbUser, dbPassword, dbHost, dbPort, redisHost, redisPort, storeName } = req.body;

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
setupRouter.post("/install-dependencies", setupLimiter, requireScopes(SCOPES.SETUP_RUN), async (req, res): Promise<void> => {
  try {
    const domain = sanitizeDomain(req.body?.domain);

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
setupRouter.post("/run-migrations", setupLimiter, requireScopes(SCOPES.SETUP_RUN), async (req, res): Promise<void> => {
  try {
    const domain = sanitizeDomain(req.body?.domain);

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

// Adım 10: Uygulamaları derle - Improved version ile detaylı log desteği
setupRouter.post("/build-applications", setupLimiter, requireScopes(SCOPES.SETUP_RUN), async (req, res): Promise<void> => {
  try {
    const { isLocal, heapMB, skipTypeCheck } = req.body as { domain: string; isLocal?: boolean; heapMB?: number; skipTypeCheck?: boolean };
    const domain = sanitizeDomain((req.body as any)?.domain);

    if (!domain) {
      res.status(400).json({ ok: false, message: "Domain gerekli" });
      return;
    }

    const result = await setupService.buildApplications(
      domain,
      Boolean(isLocal),
      (message) => {
        setupService.emitProgress(domain, "build", message);
      },
      { heapMB: typeof heapMB === 'number' ? heapMB : undefined, skipTypeCheck: Boolean(skipTypeCheck) }
    );

    // Build başarısız olduğunda detaylı bilgi gönder
    if (!result.ok) {
      // Memory hatası kontrolü
      const isMemoryError = result.stderr?.includes('JavaScript heap out of memory') ||
                           result.stderr?.includes('FATAL ERROR') ||
                           result.message?.includes('bellek yetersizliği');

      res.status(500).json({
        ok: false,
        error: 'Build failed',
        message: result.message || "Derleme başarısız",
        stdout: result.stdout,
        stderr: result.stderr,
        buildLog: result.buildLog,
        errorType: isMemoryError ? 'heap' : 'other',
        suggestion: isMemoryError
          ? 'Node.js bellek yetersizliği. Sunucu RAM’ini arttırın veya NODE_OPTIONS="--max-old-space-size=8192" kullanın.'
          : 'Build loglarını kontrol edin'
      });
      return;
    }

    res.json(result);
  } catch (error: any) {
    console.error('Build endpoint error:', error);
    res.status(500).json({
      ok: false,
      error: 'Internal error',
      message: error.message || "Derleme hatası",
      suggestion: "Sunucu loglarını kontrol edin"
    });
  }
});

// Adım 11: PM2 ve Nginx yapılandırması
setupRouter.post("/configure-services", requireScopes(SCOPES.SETUP_RUN), async (req, res): Promise<void> => {
  try {
    const { domain, ports, isLocal, sslEnable, sslEmail } = req.body as { domain: string; ports: any; isLocal?: boolean; sslEnable?: boolean; sslEmail?: string };

    if (!domain || !ports) {
      res.status(400).json({ ok: false, message: "Domain ve port bilgileri gerekli" });
      return;
    }

    const customerPath = setupService.getCustomerPath(domain);

    // Backend build çıktısı mevcut mu? PM2 başlatmadan önce doğrula
    const backendPath = path.join(customerPath, "backend");
    const distSrcMain = path.join(backendPath, "dist", "src", "main.js");
    const distMain = path.join(backendPath, "dist", "main.js");
    let hasDist = await fs.pathExists(distSrcMain) || await fs.pathExists(distMain);
    if (!hasDist) {
      // dist altında main.js'i rekürsif ara (monorepo yapıları için tolerans)
      const distDir = path.join(backendPath, "dist");
      const queue: string[] = (await fs.pathExists(distDir)) ? [distDir] : [];
      while (queue.length && !hasDist) {
        const dir = queue.shift()!;
        const entries = await fs.readdir(dir);
        for (const e of entries) {
          const full = path.join(dir, e);
          const stat = await fs.stat(full);
          if (stat.isDirectory()) queue.push(full);
          else if (stat.isFile() && e === "main.js") { hasDist = true; break; }
        }
      }
    }
    if (!hasDist) {
      res.status(400).json({ ok: false, message: "Backend build bulunamadı (dist altında main.js tespit edilemedi). Lütfen derleme adımını ve logları kontrol edin." });
      return;
    }

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
      // 1) PM2 ecosystem oluştur
      await pm2Service.createEcosystem(domain, customerPath, ports, { devMode: isLocal });

      // 2) Önce HTTP-only nginx config (certbot webroot için)
      setupService.emitProgress(domain, "service", "Nginx HTTP konfigürasyonu uygulanıyor...");
      await nginxService.createConfig(domain, ports, false);

      // 3) SSL isteniyorsa sertifika al ve 443'e geçir
      if (sslEnable && sslEmail) {
        try {
          // Certbot check/install
          setupService.emitProgress(domain, "service", "Certbot kontrol ediliyor...");
          const hasCertbot = await nginxService.isCertbotInstalled();
          if (!hasCertbot) {
            setupService.emitProgress(domain, "service", "Certbot bulunamadı, yükleniyor...");
            const installRes = await nginxService.installCertbot();
            if (installRes.ok) {
              setupService.emitProgress(domain, "service", `Certbot yüklendi (${installRes.method})`);
            } else {
              setupService.emitProgress(domain, "service", "Certbot kurulamadı. HTTP ile devam ediliyor.");
              // Sertifika adımını atla
              throw new Error("Certbot installation failed");
            }
          }

          setupService.emitProgress(domain, "service", "SSL sertifikası alınıyor (Let’s Encrypt)...");
          await nginxService.obtainSSLCertificate(domain, sslEmail, {
            onProgress: (message, extra) => {
              setupService.emitProgress(domain, "service", message, extra);
            }
          });
          setupService.emitProgress(domain, "service", "SSL etkinleştirildi, 80→443 yönlendiriliyor");
        } catch (e: any) {
          // Sertifika alınamazsa HTTP-only devam et, bilgi ver
          setupService.emitProgress(domain, "service", `SSL alınamadı: ${e?.message || 'hata'}. HTTP ile devam ediliyor`);
        }
      }
    }

    res.json({ ok: true, message: "Servisler yapılandırıldı" });
  } catch (error: any) {
    res.status(500).json({ ok: false, message: error.message || "Servis yapılandırma hatası" });
  }
});

// Adım 12: Kurulumu tamamla ve servisleri başlat
setupRouter.post("/finalize", setupLimiter, requireScopes(SCOPES.SETUP_RUN), async (req, res): Promise<void> => {
  let reserved: { partnerId: string; ledgerId: string } | null = null;
  try {
    const {
      domain: rawDomain,
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
    const domain = sanitizeDomain(rawDomain);

    if (!domain || !ports || !dbName || !storeName) {
      res.status(400).json({ ok: false, message: "Gerekli bilgiler eksik" });
      return;
    }

    // Partner kredisi rezervasyonu (varsa) – atomik düşüm için
    const user = req.user!;
    const partnerId: string | undefined = user?.partnerId;
    const reservationLedgerId: string | undefined = (req.body as any)?.reservationLedgerId;
    if (partnerId && !isLocal) {
      if (reservationLedgerId) {
        reserved = { partnerId, ledgerId: reservationLedgerId };
      } else {
        const { PartnerService } = await import("../services/partner.service");
        const svc = new PartnerService();
        const tempRef = `finalize-${domain}-${Date.now()}`;
        const r = await svc.reserveSetup(partnerId, tempRef, user.id);
        if (!r.ok) {
          err(res, 402, "INSUFFICIENT_CREDIT", `Yetersiz kredi. Gerekli: ${r.price}, Bakiye: ${r.balance ?? 0}`);
          return;
        }
        reserved = { partnerId, ledgerId: r.ledgerId! };
      }
      // Mark committing
      await lockService.updateStatus(partnerId, 'committing', LOCK_TTL_SEC);
    }

    // Local mode kontrolü ve PM2 ile servisleri başlat
    if (isLocal) {
      try {
        const { exec } = require("child_process");
        const { promisify } = require("util");
        const execAsync = promisify(exec);
        await execAsync("pm2 --version");

        // PM2 kuruluysa başlat
        const customerPath = setupService.getCustomerPath(domain);
        await pm2Service.startCustomer(domain, customerPath);
      } catch {
        console.log("PM2 kurulu değil, servisler manuel başlatılmalı");
      }
    } else {
      // Production - PM2 gerekli
      const customerPath = setupService.getCustomerPath(domain);
      await pm2Service.startCustomer(domain, customerPath);
    }

    // Müşteri kaydını oluştur
    const customerId = uuidv4();
    await customerService.saveCustomer({
      id: customerId,
      domain,
      status: "running",
      createdAt: new Date().toISOString(),
      partnerId: partnerId,
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
      admin: `https://${domain}/admin`,
      api: `https://${domain}/api`
    };

    // Rezervasyonu tüketime çevir (commit)
    if (reserved) {
      const { PartnerService } = await import("../services/partner.service");
      const svc = new PartnerService();
      await svc.commitReservation(reserved.partnerId, reserved.ledgerId, customerId);
    }

    // Lock'u serbest bırak
    if (partnerId) { await lockService.release(partnerId); }

    // Audit
    const audit = new AuditService();
    await audit.log({ actorId: user?.id, action: "SETUP_FINALIZE", targetType: "Customer", targetId: customerId, metadata: { domain, partnerId }, ip: req.ip, userAgent: String(req.headers["user-agent"] || "") });

    ok(res, { message: "Kurulum başarıyla tamamlandı!", customerId, domain, urls, mode: isLocal ? "local" : "production" });
    return;
  } catch (error: any) {
    try { if (reserved) { const { PartnerService } = await import("../services/partner.service"); const svc = new PartnerService(); await svc.cancelReservation(reserved.partnerId, reserved.ledgerId, "setup failed"); } } catch {}
    try { await lockService.release((req.user as any)?.partnerId); } catch {}
    res.status(500).json({ ok: false, message: error.message || "Kurulum tamamlama hatası" });
  }
});

// WebSocket bağlantısı için
setupRouter.post("/subscribe", requireScopes(SCOPES.SETUP_RUN), async (req, res): Promise<void> => {
  const { domain } = req.body;

  if (!domain) {
    res.status(400).json({ ok: false, message: "Domain gerekli" });
    return;
  }

  // Socket.io subscription logic handled in client
  res.json({ ok: true, message: "WebSocket subscription için client socket.io kullanmalı" });
});

// Opsiyonel: Kurulum sonrası demo veri içe aktarma
// Body: { domain: string, version?: string, packName?: string, packPath?: string, overwriteUploads?: boolean }
setupRouter.post("/import-demo", requireScopes(SCOPES.SETUP_RUN), async (req, res): Promise<void> => {
  try {
    const body = (req.body || {}) as any;
    const domain = sanitizeDomain(body.domain || "");
    if (!domain) { err(res, 400, "BAD_REQUEST", "Domain gerekli"); return; }

    const result = await demoService.importDemo({
      domain,
      version: body.version,
      template: body.template,
      packName: body.packName,
      packPath: body.packPath,
      overwriteUploads: body.overwriteUploads !== false,
      mode: (body.mode as any) || 'strict',
    });

    if (!result.ok) { err(res, 500, "DEMO_IMPORT_FAILED", result.message); return; }
    ok(res, { ok: true, message: result.message });
  } catch (error: any) {
    err(res, 500, "DEMO_IMPORT_ERROR", error?.message || "Demo içe aktarma hatası");
  }
});
