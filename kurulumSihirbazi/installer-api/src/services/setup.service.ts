import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs-extra";
import path from "path";
import AdmZip from "adm-zip";
import { DatabaseService, PgAdminConfig } from "./database.service";
import { SystemService } from "./system.service";
import { SettingsService } from "./settings.service";
import { io } from "../index";

const execAsync = promisify(exec);

export interface SetupProgress {
  step: string;
  status: "pending" | "running" | "completed" | "error";
  message: string;
  details?: any;
}

export interface SystemRequirement {
  name: string;
  status: "ok" | "warning" | "error";
  version?: string;
  message?: string;
  required: boolean;
}

export class SetupService {
  private systemService: SystemService;
  private settingsService: SettingsService;
  private databaseService?: DatabaseService;

  private templatesPath = process.env.TEMPLATES_PATH || "/var/qodify/templates";
  private customersPath = process.env.CUSTOMERS_PATH || "/var/qodify/customers";

  constructor() {
    this.systemService = new SystemService();
    this.settingsService = new SettingsService();
  }

  // Adım 1: Sistem gereksinimlerini kontrol et
  async checkSystemRequirements(): Promise<SystemRequirement[]> {
    const requirements: SystemRequirement[] = [];

    // Node.js kontrolü
    const nodeCheck = await this.systemService.checkNodeVersion();
    requirements.push({
      name: "Node.js",
      status: nodeCheck.installed ? "ok" : "error",
      version: nodeCheck.version || undefined,
      message: nodeCheck.installed ? "Node.js kurulu ve çalışıyor" : "Node.js kurulu değil",
      required: true
    });

    // PostgreSQL kontrolü
    const pgStatus = await this.systemService.checkPostgres();
    const pgVersion = await this.systemService.checkPostgresInstalled();
    requirements.push({
      name: "PostgreSQL",
      status: pgStatus === "running" ? "ok" : pgStatus === "error" ? "error" : "warning",
      version: pgVersion.version || undefined,
      message: pgStatus === "running" ? "PostgreSQL çalışıyor" :
               pgStatus === "error" ? "PostgreSQL kurulu değil veya çalışmıyor" :
               "PostgreSQL kurulu ama çalışmıyor olabilir",
      required: true
    });

    // Settings'den default değerleri al (ileride kullanılabilir)
    await this.settingsService.getSettings();

    // Redis kontrolü
    const redisStatus = await this.systemService.checkRedis();
    const redisVersion = await this.systemService.checkRedisInstalled();
    requirements.push({
      name: "Redis",
      status: redisStatus === "running" ? "ok" : redisStatus === "error" ? "error" : "warning",
      version: redisVersion.version || undefined,
      message: redisStatus === "running" ? "Redis çalışıyor" :
               redisStatus === "error" ? "Redis kurulu değil veya çalışmıyor" :
               "Redis kurulu ama çalışmıyor olabilir",
      required: true
    });

    // PM2 kontrolü (local mode'da gerekli değil)
    const pm2Status = await this.systemService.checkPM2();
    const pm2Version = await this.systemService.checkPM2Installed();
    requirements.push({
      name: "PM2",
      status: pm2Status === "running" ? "ok" : pm2Status === "error" ? "warning" : "warning",
      version: pm2Version.version || undefined,
      message: pm2Status === "running" ? "PM2 çalışıyor" :
               pm2Status === "error" ? "PM2 kurulu değil (production için gerekli)" :
               "PM2 kurulu ama daemon çalışmıyor olabilir",
      required: false
    });

    // Nginx kontrolü (local mode'da gerekli değil)
    const nginxStatus = await this.systemService.checkNginx();
    const nginxVersion = await this.systemService.checkNginxInstalled();
    requirements.push({
      name: "Nginx",
      status: nginxStatus === "running" ? "ok" : nginxStatus === "error" ? "warning" : "warning",
      version: nginxVersion.version || undefined,
      message: nginxStatus === "running" ? "Nginx çalışıyor" :
               nginxStatus === "error" ? "Nginx kurulu değil (production için gerekli)" :
               "Nginx kurulu ama çalışmıyor olabilir",
      required: false
    });

    // Disk alanı kontrolü
    const resources = await this.systemService.getSystemResources();
    const diskFreeGB = resources.disk.totalGB - resources.disk.usedGB;
    requirements.push({
      name: "Disk Alanı",
      status: diskFreeGB > 10 ? "ok" : diskFreeGB > 5 ? "warning" : "error",
      message: `${diskFreeGB.toFixed(1)} GB boş alan var`,
      required: true
    });

    return requirements;
  }

  // Adım 2: Veritabanı bağlantısını test et
  async testDatabaseConnection(config: PgAdminConfig): Promise<{ ok: boolean; message: string; version?: string }> {
    try {
      this.databaseService = new DatabaseService(config);
      const result = await this.databaseService.testConnection(config);

      if (result.ok) {
        // Versiyon bilgisini al
        const { stdout } = await execAsync(`psql -h ${config.host} -p ${config.port} -U ${config.user} -c "SELECT version();" 2>&1`, {
          env: { ...process.env, PGPASSWORD: config.password }
        });
        const versionMatch = stdout.match(/PostgreSQL (\d+\.\d+)/);
        const version = versionMatch ? versionMatch[1] : "Unknown";

        return {
          ok: true,
          message: "Veritabanı bağlantısı başarılı",
          version
        };
      }

      return { ...result, message: result.message || "" };
    } catch (error: any) {
      return {
        ok: false,
        message: error.message || "Veritabanı bağlantı hatası"
      };
    }
  }

  // Adım 3: Redis bağlantısını test et
  async testRedisConnection(host: string, port: number): Promise<{ ok: boolean; message: string; version?: string }> {
    try {
      const result = await this.systemService.testRedisConnection(host, port);

      if (result.ok) {
        // Versiyon bilgisini al
        const { stdout } = await execAsync(`redis-cli -h ${host} -p ${port} INFO server 2>&1`);
        const versionMatch = stdout.match(/redis_version:(\d+\.\d+\.\d+)/);
        const version = versionMatch ? versionMatch[1] : "Unknown";

        return {
          ok: true,
          message: "Redis bağlantısı başarılı",
          version
        };
      }

      return { ...result, message: result.message || "" };
    } catch (error: any) {
      return {
        ok: false,
        message: error.message || "Redis bağlantı hatası"
      };
    }
  }

  // Adım 4: Veritabanı oluştur
  async createDatabase(
    dbConfig: PgAdminConfig,
    dbName: string,
    appUser: string,
    appPassword: string
  ): Promise<{ ok: boolean; message: string }> {
    try {
      if (!this.databaseService) {
        this.databaseService = new DatabaseService(dbConfig);
      }

      await this.databaseService.createDatabase(dbName, appUser, appPassword);

      return {
        ok: true,
        message: `Veritabanı '${dbName}' ve kullanıcı '${appUser}' başarıyla oluşturuldu`
      };
    } catch (error: any) {
      return {
        ok: false,
        message: error.message || "Veritabanı oluşturma hatası"
      };
    }
  }

  // Adım 5: Template'leri kontrol et ve hazırla
  async checkTemplates(version: string = "latest"): Promise<{ ok: boolean; message: string; templates?: string[] }> {
    try {
      if (version === "latest") {
        version = "2.4.0";
      }

      const templates = ["backend", "admin", "store"];
      const foundTemplates: string[] = [];

      for (const template of templates) {
        // Kategorilerde ara
        const categories = ["stable", "beta", "archived"];
        let found = false;

        for (const category of categories) {
          const templatePath = path.join(this.templatesPath, category, `${template}-${version}.zip`);
          if (await fs.pathExists(templatePath)) {
            foundTemplates.push(`${category}/${template}-${version}.zip`);
            found = true;
            break;
          }
        }

        // Root'ta ara
        if (!found) {
          const rootPath = path.join(this.templatesPath, `${template}-${version}.zip`);
          if (await fs.pathExists(rootPath)) {
            foundTemplates.push(`${template}-${version}.zip`);
          }
        }
      }

      if (foundTemplates.length === 3) {
        return {
          ok: true,
          message: "Tüm template dosyaları mevcut",
          templates: foundTemplates
        };
      } else {
        return {
          ok: false,
          message: `Bazı template dosyaları eksik. Bulunan: ${foundTemplates.join(", ")}`,
          templates: foundTemplates
        };
      }
    } catch (error: any) {
      return {
        ok: false,
        message: error.message || "Template kontrol hatası"
      };
    }
  }

  // Adım 6: Template'leri çıkar
  async extractTemplates(
    customerDomain: string,
    version: string,
    onProgress?: (message: string) => void
  ): Promise<{ ok: boolean; message: string }> {
    try {
      const customerPath = path.join(this.customersPath, customerDomain.replace(/\./g, "-"));

      // Müşteri klasörünü temizle ve oluştur
      await fs.remove(customerPath).catch(() => {});
      await fs.ensureDir(customerPath);

      if (version === "latest") {
        version = "2.4.0";
      }

      const templates = ["backend", "admin", "store"];

      for (const template of templates) {
        if (onProgress) onProgress(`${template} çıkarılıyor...`);

        // Template ZIP'ini bul
        let templateZip = null;
        const categories = ["stable", "beta", "archived"];

        for (const category of categories) {
          const categoryPath = path.join(this.templatesPath, category, `${template}-${version}.zip`);
          if (await fs.pathExists(categoryPath)) {
            templateZip = categoryPath;
            break;
          }
        }

        if (!templateZip) {
          templateZip = path.join(this.templatesPath, `${template}-${version}.zip`);
          if (!(await fs.pathExists(templateZip))) {
            throw new Error(`Template bulunamadı: ${template}-${version}.zip`);
          }
        }

        const targetPath = path.join(customerPath, template);
        await fs.ensureDir(targetPath);

        const zip = new AdmZip(templateZip);
        zip.extractAllTo(targetPath, true);

        // Yapıyı normalize et (gereksiz wrapper klasörleri kaldır)
        await this.normalizeExtractedStructure(targetPath);
      }

      return {
        ok: true,
        message: "Tüm template'ler başarıyla çıkarıldı"
      };
    } catch (error: any) {
      return {
        ok: false,
        message: error.message || "Template çıkarma hatası"
      };
    }
  }

  // Çıkarılan dosya yapısını normalize et
  private async normalizeExtractedStructure(targetPath: string) {
    const entries = await fs.readdir(targetPath);
    const filtered = entries.filter(e => !e.startsWith("__MACOSX") && e !== ".DS_Store");

    // Tek klasör varsa ve içinde package.json varsa, içeriği üst klasöre taşı
    if (filtered.length === 1) {
      const single = path.join(targetPath, filtered[0]);
      const stat = await fs.stat(single);

      if (stat.isDirectory()) {
        const hasPackageJson = await fs.pathExists(path.join(single, "package.json"));

        if (hasPackageJson) {
          const items = await fs.readdir(single);
          for (const item of items) {
            await fs.move(path.join(single, item), path.join(targetPath, item), { overwrite: true });
          }
          await fs.remove(single);
        }
      }
    }

    // __MACOSX ve .DS_Store dosyalarını temizle
    for (const entry of entries) {
      if (entry.startsWith("__MACOSX") || entry === ".DS_Store") {
        await fs.remove(path.join(targetPath, entry)).catch(() => {});
      }
    }
  }

  // Adım 7: Ortam değişkenlerini yapılandır
  async configureEnvironment(
    customerDomain: string,
    config: {
      dbName: string;
      dbUser: string;
      dbPassword: string;
      dbHost: string;
      dbPort: number;
      redisHost: string;
      redisPort: number;
      ports: { backend: number; admin: number; store: number };
      storeName: string;
    }
  ): Promise<{ ok: boolean; message: string }> {
    try {
      const customerPath = path.join(this.customersPath, customerDomain.replace(/\./g, "-"));
      const isLocal = this.isLocalDomain(customerDomain);

      // Helpers to read/merge env files without clobbering existing values
      const readEnv = async (filePath: string): Promise<Record<string, string>> => {
        try {
          if (await fs.pathExists(filePath)) {
            const raw = await fs.readFile(filePath, "utf8");
            const parsed = require("dotenv").parse(raw) as Record<string, string>;
            return parsed || {};
          }
        } catch {}
        return {};
      };

      const { mergeEnvFile } = await import("../utils/env-merge");
      const writeEnv = async (filePath: string, envObj: Record<string, string>) => {
        await mergeEnvFile(filePath, envObj);
      };

      // Compute URLs
      const appUrl = isLocal ? `http://localhost:${config.ports.backend}` : `https://${customerDomain}`;
      const storeUrl = isLocal ? `http://localhost:${config.ports.store}` : `https://${customerDomain}`;
      const adminUrl = isLocal ? `http://localhost:${config.ports.admin}` : `https://${customerDomain}/qpanel`;

      // Backend .env: merge existing with required updates
      const backendEnvPath = path.join(customerPath, "backend", ".env");
      const backendExisting = await readEnv(backendEnvPath);

      const tooShort = (v?: string) => !v || String(v).length < 32;
      const backendUpdates: Record<string, string> = {
        NODE_ENV: isLocal ? "development" : "production",
        PORT: String(config.ports.backend),
        DATABASE_URL: `postgresql://${config.dbUser}:${config.dbPassword}@${config.dbHost}:${config.dbPort}/${config.dbName}?schema=public`,
        REDIS_HOST: String(config.redisHost),
        REDIS_PORT: String(config.redisPort),
        REDIS_PREFIX: customerDomain.replace(/\./g, "_"),
        AUTO_DETECT_DOMAIN: String(!isLocal),
        PROD_DOMAIN: customerDomain,
        APP_URL: appUrl,
        STORE_URL: storeUrl,
        ADMIN_URL: adminUrl,
        STORE_NAME: config.storeName,
      };
      // Only generate secrets if missing/too short
      if (tooShort(backendExisting["JWT_ACCESS_SECRET"])) backendUpdates["JWT_ACCESS_SECRET"] = this.generateSecret();
      if (tooShort(backendExisting["JWT_REFRESH_SECRET"])) backendUpdates["JWT_REFRESH_SECRET"] = this.generateSecret();
      if (tooShort(backendExisting["SESSION_SECRET"])) backendUpdates["SESSION_SECRET"] = this.generateSecret();
      // SMTP defaults only if missing
      if (!backendExisting["SMTP_HOST"]) backendUpdates["SMTP_HOST"] = isLocal ? "localhost" : `smtp.${customerDomain}`;
      if (!backendExisting["SMTP_PORT"]) backendUpdates["SMTP_PORT"] = String(isLocal ? 1025 : 587);
      if (!backendExisting["SMTP_SECURE"]) backendUpdates["SMTP_SECURE"] = String(false);
      if (!backendExisting["SMTP_USER"]) backendUpdates["SMTP_USER"] = `noreply@${customerDomain}`;
      if (!backendExisting["SMTP_PASS"]) backendUpdates["SMTP_PASS"] = isLocal ? "devpass" : "changeme";
      if (!backendExisting["SMTP_FROM"]) backendUpdates["SMTP_FROM"] = `noreply@${customerDomain}`;

      // Only set LOCAL/PROD_DATABASE_URL if missing; otherwise preserve original
      if (!backendExisting["LOCAL_DATABASE_URL"]) backendUpdates["LOCAL_DATABASE_URL"] = backendUpdates["DATABASE_URL"];
      if (!backendExisting["PROD_DATABASE_URL"]) backendUpdates["PROD_DATABASE_URL"] = backendUpdates["DATABASE_URL"];

      const backendMerged = { ...backendExisting, ...backendUpdates };
      await writeEnv(backendEnvPath, backendMerged);

      // Admin .env: merge
      const adminEnvPath = path.join(customerPath, "admin", ".env");
      const adminExisting = await readEnv(adminEnvPath);
      const adminUpdates: Record<string, string> = {
        NEXT_PUBLIC_AUTO_DETECT_DOMAIN: String(!isLocal),
        NEXT_PUBLIC_PROD_DOMAIN: customerDomain,
        NEXT_PUBLIC_PROD_API_URL: isLocal ? appUrl : `https://${customerDomain}/api`,
      };
      if (isLocal) adminUpdates["NEXT_PUBLIC_API_URL"] = appUrl;
      const adminMerged = { ...adminExisting, ...adminUpdates };
      await writeEnv(adminEnvPath, adminMerged);

      // Store .env: merge
      const storeEnvPath = path.join(customerPath, "store", ".env");
      const storeExisting = await readEnv(storeEnvPath);
      const storeUpdates: Record<string, string> = {
        NEXT_PUBLIC_AUTO_DETECT_DOMAIN: String(!isLocal),
        NEXT_PUBLIC_PROD_DOMAIN: customerDomain,
        NEXT_PUBLIC_PROD_API_URL: isLocal ? appUrl : `https://${customerDomain}/api`,
      };
      if (isLocal) storeUpdates["NEXT_PUBLIC_API_URL"] = appUrl;
      const storeMerged = { ...storeExisting, ...storeUpdates };
      await writeEnv(storeEnvPath, storeMerged);

      return {
        ok: true,
        message: "Ortam değişkenleri yapılandırıldı"
      };
    } catch (error: any) {
      return {
        ok: false,
        message: error.message || "Ortam değişkenleri yapılandırma hatası"
      };
    }
  }

  // Adım 8: Bağımlılıkları yükle
  async installDependencies(
    customerDomain: string,
    onProgress?: (message: string) => void
  ): Promise<{ ok: boolean; message: string }> {
    try {
      const customerPath = path.join(this.customersPath, customerDomain.replace(/\./g, "-"));
      const apps = ["backend", "admin", "store"];

      for (const app of apps) {
        if (onProgress) onProgress(`${app} bağımlılıkları yükleniyor...`);

        const appPath = path.join(customerPath, app);
        await execAsync(`cd "${appPath}" && npm ci`, { timeout: 300000 }); // 5 dakika timeout
      }

      return {
        ok: true,
        message: "Tüm bağımlılıklar yüklendi"
      };
    } catch (error: any) {
      return {
        ok: false,
        message: error.message || "Bağımlılık yükleme hatası"
      };
    }
  }

  // Adım 9: Migration'ları çalıştır
  async runMigrations(customerDomain: string): Promise<{ ok: boolean; message: string }> {
    try {
      const customerPath = path.join(this.customersPath, customerDomain.replace(/\./g, "-"));
      const backendPath = path.join(customerPath, "backend");

      // Prisma generate
      await execAsync(`cd "${backendPath}" && npx prisma generate`);

      // Prisma migrate
      await execAsync(`cd "${backendPath}" && npx prisma migrate deploy`);

      return {
        ok: true,
        message: "Migration'lar başarıyla uygulandı"
      };
    } catch (error: any) {
      return {
        ok: false,
        message: error.message || "Migration hatası"
      };
    }
  }

  // Adım 10: Uygulamaları derle
  async buildApplications(
    customerDomain: string,
    isLocal: boolean,
    onProgress?: (message: string) => void
  ): Promise<{ ok: boolean; message: string }> {
    try {
      const customerPath = path.join(this.customersPath, customerDomain.replace(/\./g, "-"));

      // Backend'i her zaman build et
      if (onProgress) onProgress("Backend derleniyor...");
      await execAsync(`cd "${path.join(customerPath, "backend")}" && npm run build`, { timeout: 300000 });

      // Local mode değilse frontend'leri de build et
      if (!isLocal) {
        if (onProgress) onProgress("Admin paneli derleniyor...");
        await execAsync(`cd "${path.join(customerPath, "admin")}" && npm run build`, { timeout: 300000 });

        if (onProgress) onProgress("Store derleniyor...");
        await execAsync(`cd "${path.join(customerPath, "store")}" && npm run build`, { timeout: 300000 });
      }

      return {
        ok: true,
        message: isLocal ? "Backend derlendi (local mode)" : "Tüm uygulamalar derlendi"
      };
    } catch (error: any) {
      return {
        ok: false,
        message: error.message || "Derleme hatası"
      };
    }
  }

  // Yardımcı metodlar
  private isLocalDomain(domain: string): boolean {
    return domain.endsWith('.local') ||
           domain === 'localhost' ||
           !domain.includes('.') ||
           domain.startsWith('test') ||
           domain.startsWith('local');
  }

  private generateSecret(): string {
    return require('crypto').randomBytes(32).toString('hex');
  }

  // Socket.io ile ilerleme bildirimi
  emitProgress(domain: string, step: string, message: string) {
    io.to(`setup-${domain}`).emit("setup-progress", {
      step,
      message,
      timestamp: new Date().toISOString()
    });
  }
}
