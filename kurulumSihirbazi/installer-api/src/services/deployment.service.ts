import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs-extra";
import path from "path";
import AdmZip from "adm-zip";
import { v4 as uuidv4 } from "uuid";
import { parse as parseDotenv } from "dotenv";
import { mergeEnvFile } from "../utils/env-merge";
import { CustomerService } from "./customer.service";
import { DatabaseService, PgAdminConfig } from "./database.service";
import { NginxService } from "./nginx.service";
import { PM2Service } from "./pm2.service";
import { io } from "../index";
import { SettingsService } from "./settings.service";

const execAsync = promisify(exec);

export interface DeploymentConfig {
  domain: string;
  storeName: string;
  adminEmail: string;
  adminPassword: string;
  dbPrefix?: string;
  templateVersion: string;
  initialData: "empty" | "demo" | "import";
  db?: {
    host?: string;
    port?: number;
    user?: string;
    password?: string;
  };
  database?: {
    name?: string;
    user?: string;
    password?: string;
  };
  redis?: {
    host?: string;
    port?: number;
    prefix?: string;
  };
}

export class DeploymentService {
  private customerService: CustomerService;
  private databaseService: DatabaseService;
  private nginxService: NginxService;
  private pm2Service: PM2Service;

  private templatesPath = process.env.TEMPLATES_PATH || "/var/qodify/templates";
  private customersPath = process.env.CUSTOMERS_PATH || "/var/qodify/customers";
  private settingsService = new SettingsService();

  constructor() {
    this.customerService = new CustomerService();
    this.databaseService = new DatabaseService();
    this.nginxService = new NginxService();
    this.pm2Service = new PM2Service();
  }

  async deployCustomer(config: DeploymentConfig) {
    const customerId = uuidv4();
    const customerDomain = config.domain.replace(/\./g, "-");
    const customerPath = path.join(this.customersPath, customerDomain);

    // Check if this is local mode
    const isLocalMode = this.isLocalDomain(config.domain);

    // Get available ports
    const basePort = await this.customerService.getNextAvailablePort();
    const ports = {
      backend: basePort,
      admin: basePort + 1,
      store: basePort + 2,
    };

    let createdDbName: string | undefined;
    try {
      this.emitProgress(config.domain, "templates", "📦 Template'ler çıkarılıyor...");
      // 1. Extract templates
      await this.extractTemplates(customerPath, config.templateVersion);

      // Validate essential files exist post-extract
      await this.validateExtractedTemplates(customerPath);

      // 2. Create database
      this.emitProgress(config.domain, "database", "🗄️ Veritabanı oluşturuluyor...");
      const saved = await this.settingsService.getSettings();
      const dbAdminConfig: PgAdminConfig = {
        host: config.db?.host || saved.db?.host || process.env.DB_HOST || "localhost",
        port: config.db?.port || saved.db?.port || parseInt(process.env.DB_PORT || "5432"),
        user: config.db?.user || saved.db?.user || process.env.DB_USER || "postgres",
        password: config.db?.password || saved.db?.password || process.env.DB_PASSWORD || "postgres",
      };
      this.databaseService = new DatabaseService(dbAdminConfig);
      const desiredName = (config.database?.name || "").trim();
      const fallbackName = `qodify_${(config.dbPrefix || customerDomain).replace(/[^a-zA-Z0-9_]/g, "_")}`;
      const dbName = (desiredName ? desiredName.replace(/[^a-zA-Z0-9_]/g, "_") : fallbackName);
      createdDbName = dbName;
      const appDbUser = (config.database?.user || "qodify_user").replace(/[^a-zA-Z0-9_]/g, "_");
      const appDbPassword = config.database?.password || "qodify_pass";
      await this.databaseService.createDatabase(dbName, appDbUser, appDbPassword);

      // 3. Configure environment variables
      this.emitProgress(config.domain, "env", "⚙️ Ortam değişkenleri yazılıyor...");
      await this.configureEnvironment(customerPath, {
        domain: config.domain,
        dbName,
        ports,
        storeName: config.storeName,
        db: dbAdminConfig,
        appDb: { user: appDbUser, password: appDbPassword },
        redis: {
          host: config.redis?.host || saved.redis?.host || process.env.REDIS_HOST || "localhost",
          port: config.redis?.port || saved.redis?.port || parseInt(process.env.REDIS_PORT || "6379"),
          prefix: config.redis?.prefix || saved.redis?.prefix || config.domain.replace(/\./g, "_"),
        },
      });

      // 4. Install dependencies
      this.emitProgress(config.domain, "deps", "📥 Bağımlılıklar yükleniyor...");
      await this.installDependencies(customerPath);

      // 5. Run migrations
      this.emitProgress(config.domain, "migrate", "🔄 Migration'lar uygulanıyor...");
      await this.runMigrations(path.join(customerPath, "backend"));

      // 6. Seed initial data
      if (config.initialData === "demo") {
        this.emitProgress(config.domain, "seed", "🌱 Demo verileri yükleniyor...");
        await this.seedData(path.join(customerPath, "backend"));
      }

      // 7. Build applications (in local mode build only backend, run frontends in dev via PM2)
      if (isLocalMode) {
        this.emitProgress(config.domain, "build", "🏗️ Backend derleniyor (local mod)...");
        await this.buildApplications(customerPath, { buildAdmin: false, buildStore: false, prune: false });
      } else {
        this.emitProgress(config.domain, "build", "🏗️ Uygulamalar derleniyor...");
        await this.buildApplications(customerPath, { buildAdmin: true, buildStore: true, prune: true });
      }

      // 8. Configure PM2
      this.emitProgress(config.domain, "pm2", "🚀 PM2 yapılandırılıyor...");
      await this.pm2Service.createEcosystem(config.domain, customerPath, ports, { devMode: isLocalMode });

      // 9. Configure Nginx (skip in local mode)
      if (!isLocalMode) {
        this.emitProgress(config.domain, "nginx", "🌐 Nginx yapılandırılıyor...");
        await this.nginxService.createConfig(config.domain, ports);
      } else {
        this.emitProgress(config.domain, "nginx-skip", "🏠 Local mod - Nginx atlandı");
      }

      // 10. Start services
      this.emitProgress(config.domain, "start", "✅ Servisler başlatılıyor...");
      await this.pm2Service.startCustomer(config.domain);

      // 11. Save customer data
      await this.customerService.saveCustomer({
        id: customerId,
        domain: config.domain,
        status: "running",
        createdAt: new Date().toISOString(),
        ports,
        resources: { cpu: 0, memory: 0 },
        mode: isLocalMode ? "local" : "production",
        db: {
          name: dbName,
          user: appDbUser,
          host: dbAdminConfig.host,
          port: dbAdminConfig.port,
          schema: "public",
        },
        redis: {
          host: (saved.redis?.host || process.env.REDIS_HOST || "localhost") as string,
          port: (saved.redis?.port || parseInt(process.env.REDIS_PORT || "6379")) as number,
          prefix: (saved.redis?.prefix || config.domain.replace(/\./g, "_")) as string,
        },
      });

      // Return appropriate URLs based on mode
      const urls = isLocalMode ? {
        store: `http://localhost:${ports.store}`,
        admin: `http://localhost:${ports.admin}`,
        api: `http://localhost:${ports.backend}`,
      } : {
        store: `https://${config.domain}`,
        admin: `https://${config.domain}/qpanel`,
        api: `https://${config.domain}/api`,
      };

      return {
        success: true,
        customerId,
        domain: config.domain,
        urls,
        ports,
        mode: isLocalMode ? "local" : "production",
      };
      this.emitProgress(config.domain, "done", "🎉 Kurulum tamamlandı");
    } catch (error) {
      console.error("Deployment failed:", error);

      // Rollback on failure
      // Attempt rollback with dbName if available
      try {
        await this.rollback(customerPath, config.domain, customerId, createdDbName);
      } catch {}

      throw error;
    }
  }

  private async extractTemplates(customerPath: string, version: string) {
    // Ensure clean customer directory
    await fs.remove(customerPath).catch(() => {});
    await fs.ensureDir(customerPath);

    // Map "latest" to actual version
    if (version === "latest") {
      version = "2.4.0";
    }

    const templates = ["backend", "admin", "store"];
    for (const template of templates) {
      // First check in categorized folders
      let templateZip = null;
      const categories = ["stable", "beta", "archived"];

      for (const category of categories) {
        const categoryPath = path.join(this.templatesPath, category, `${template}-${version}.zip`);
        if (await fs.pathExists(categoryPath)) {
          templateZip = categoryPath;
          break;
        }
      }

      // If not found in categories, check root templates directory
      if (!templateZip) {
        templateZip = path.join(this.templatesPath, `${template}-${version}.zip`);
        if (!(await fs.pathExists(templateZip))) {
          throw new Error(`Template not found: ${template}-${version}.zip`);
        }
      }

      const targetPath = path.join(customerPath, template);
      await fs.ensureDir(targetPath);

      const zip = new AdmZip(templateZip);
      zip.extractAllTo(targetPath, true);

      // Normalize structure (flatten common wrappers like __MACOSX or single root folders)
      await this.normalizeExtractedProject(targetPath, template);
    }
  }

  private async validateExtractedTemplates(customerPath: string) {
    const exists = async (p: string) => !!(await fs.pathExists(p));

    // Ensure backend structure
    const backendRoot = path.join(customerPath, "backend");
    const backendPkg = path.join(backendRoot, "package.json");
    if (!(await exists(backendPkg))) {
      // Try to repair by searching for a nested project root and flattening it
      const foundPkg = await this.findFileRecursive(backendRoot, "package.json", 0, 4);
      if (foundPkg) {
        await this.flattenProjectRoot(backendRoot, path.dirname(foundPkg));
      }
    }
    if (!(await exists(path.join(backendRoot, "package.json")))) {
      throw new Error("Backend template geçersiz: package.json bulunamadı");
    }
    if (!(await exists(path.join(backendRoot, "prisma", "schema.prisma")))) {
      // Try to locate prisma dir and move it under backend root
      const foundSchema = await this.findFileRecursive(backendRoot, "schema.prisma", 0, 4);
      if (foundSchema && path.basename(path.dirname(foundSchema)) === "prisma") {
        const srcPrismaDir = path.dirname(foundSchema);
        const dstPrismaDir = path.join(backendRoot, "prisma");
        await fs.ensureDir(dstPrismaDir);
        const items = await fs.readdir(srcPrismaDir);
        for (const it of items) {
          await fs.move(path.join(srcPrismaDir, it), path.join(dstPrismaDir, it), { overwrite: true });
        }
      }
    }
    if (!(await exists(path.join(backendRoot, "prisma", "schema.prisma")))) {
      throw new Error("Backend template geçersiz: prisma/schema.prisma bulunamadı");
    }

    // Ensure admin/store structure
    for (const comp of ["admin", "store"]) {
      const root = path.join(customerPath, comp);
      const pkg = path.join(root, "package.json");
      if (!(await exists(pkg))) {
        const foundPkg = await this.findFileRecursive(root, "package.json", 0, 4);
        if (foundPkg) {
          await this.flattenProjectRoot(root, path.dirname(foundPkg));
        }
      }
      if (!(await exists(path.join(root, "package.json")))) {
        throw new Error(`${comp[0].toUpperCase() + comp.slice(1)} template geçersiz: package.json bulunamadı`);
      }
    }
  }

  // Remove meta entries and flatten single-root-folder structures or nested roots
  private async normalizeExtractedProject(targetPath: string, _component: string) {
    const entries = await fs.readdir(targetPath);
    const filtered = entries.filter((e) => !e.startsWith("__MACOSX") && e !== ".DS_Store" && e !== "._" && e !== "Thumbs.db");
    // If exactly one directory after filtering, flatten it
    if (filtered.length === 1) {
      const single = path.join(targetPath, filtered[0]);
      const stat = await fs.stat(single).catch(() => null);
      if (stat && stat.isDirectory()) {
        const inner = await fs.readdir(single);
        for (const item of inner) {
          await fs.move(path.join(single, item), path.join(targetPath, item), { overwrite: true });
        }
        await fs.remove(single);
      }
    }

    // If still no package.json at root, try to locate nested root and flatten
    const pkgAtRoot = await fs.pathExists(path.join(targetPath, "package.json"));
    if (!pkgAtRoot) {
      const foundPkg = await this.findFileRecursive(targetPath, "package.json", 0, 3);
      if (foundPkg) {
        const projectRoot = path.dirname(foundPkg);
        await this.flattenProjectRoot(targetPath, projectRoot);
      }
    }
  }

  private async flattenProjectRoot(targetPath: string, projectRoot: string) {
    if (path.resolve(targetPath) === path.resolve(projectRoot)) return;
    const items = await fs.readdir(projectRoot);
    for (const it of items) {
      await fs.move(path.join(projectRoot, it), path.join(targetPath, it), { overwrite: true });
    }
    // Clean up wrappers
    const wrappers = await fs.readdir(targetPath);
    for (const w of wrappers) {
      if (w.startsWith("__MACOSX") || w === ".DS_Store" || w === "._" || w === "Thumbs.db") {
        await fs.remove(path.join(targetPath, w)).catch(() => {});
      }
    }
  }

  private async findFileRecursive(dir: string, filename: string, depth = 0, maxDepth = 4): Promise<string | null> {
    if (depth > maxDepth) return null;
    let entries: string[] = [];
    try {
      entries = await fs.readdir(dir);
    } catch {
      return null;
    }
    for (const entry of entries) {
      if (entry === filename) return path.join(dir, entry);
    }
    for (const entry of entries) {
      if (entry.startsWith("__MACOSX") || entry === ".DS_Store" || entry === "._" || entry === "Thumbs.db") continue;
      const full = path.join(dir, entry);
      const st = await fs.stat(full).catch(() => null);
      if (st && st.isDirectory()) {
        const found = await this.findFileRecursive(full, filename, depth + 1, maxDepth);
        if (found) return found;
      }
    }
    return null;
  }

  private async configureEnvironment(customerPath: string, config: any) {
    const { domain, dbName, ports, storeName, db, appDb, redis } = config;
    const isLocal = this.isLocalDomain(domain);

    // URL configuration based on mode
    const urls = isLocal ? {
      app: `http://localhost:${ports.backend}`,
      store: `http://localhost:${ports.store}`,
      admin: `http://localhost:${ports.admin}`,
      api: `http://localhost:${ports.backend}`,
    } : {
      app: `https://${domain}`,
      store: `https://${domain}`,
      admin: `https://${domain}/qpanel`,
      api: `https://${domain}`,
    };

    // Helper to read existing .env (if any)
    const readEnv = async (filePath: string): Promise<Record<string, string>> => {
      try {
        if (await fs.pathExists(filePath)) {
          const raw = await fs.readFile(filePath, "utf8");
          return parseDotenv(raw) as Record<string, string>;
        }
      } catch {}
      return {};
    };

    const writeEnv = async (filePath: string, envObj: Record<string, string>) => {
      // Preserve comments and ordering; only replace provided keys or append missing
      await mergeEnvFile(filePath, envObj);
    };

    // Backend .env: merge with existing instead of overwriting
    const backendEnvPath = path.join(customerPath, "backend", ".env");
    const backendEnvExisting = await readEnv(backendEnvPath);
    const backendUpdates: Record<string, string> = {
      NODE_ENV: isLocal ? "development" : "production",
      PORT: String(ports.backend),
      DATABASE_URL: `postgresql://${appDb?.user || "hodox_user"}:${appDb?.password || "hodox_pass"}@${db?.host || "localhost"}:${db?.port || 5432}/${dbName}?schema=public`,
      AUTO_DETECT_DOMAIN: String(!isLocal),
      PROD_DOMAIN: domain,
      BEHIND_REVERSE_PROXY: String(!isLocal),
      APP_URL: urls.app,
      STORE_URL: urls.store,
      ADMIN_URL: urls.admin,
      REDIS_HOST: String(redis?.host || "localhost"),
      REDIS_PORT: String(redis?.port || 6379),
      REDIS_PREFIX: String(redis?.prefix || domain.replace(/\./g, "_")),
      STORE_NAME: storeName,
    };
    // Ensure JWT secrets exist; generate only if missing
    const tooShort = (v?: string) => !v || String(v).length < 32;
    if (tooShort(backendEnvExisting["JWT_ACCESS_SECRET"])) backendUpdates["JWT_ACCESS_SECRET"] = this.generateSecret();
    if (tooShort(backendEnvExisting["JWT_REFRESH_SECRET"])) backendUpdates["JWT_REFRESH_SECRET"] = this.generateSecret();

    // Security + SMTP defaults
    if (tooShort(backendEnvExisting["SESSION_SECRET"])) backendUpdates["SESSION_SECRET"] = this.generateSecret();
    if (!backendEnvExisting["SMTP_HOST"]) backendUpdates["SMTP_HOST"] = isLocal ? "localhost" : `smtp.${domain}`;
    if (!backendEnvExisting["SMTP_PORT"]) backendUpdates["SMTP_PORT"] = String(isLocal ? 1025 : 587);
    if (!backendEnvExisting["SMTP_SECURE"]) backendUpdates["SMTP_SECURE"] = String(false);
    if (!backendEnvExisting["SMTP_USER"]) backendUpdates["SMTP_USER"] = `noreply@${domain}`;
    if (!backendEnvExisting["SMTP_PASS"]) backendUpdates["SMTP_PASS"] = isLocal ? "devpass" : "changeme";
    if (!backendEnvExisting["SMTP_FROM"]) backendUpdates["SMTP_FROM"] = `noreply@${domain}`;

    // If LOCAL/PROD_DATABASE_URL missing, provide sane defaults; otherwise preserve original
    if (!backendEnvExisting["LOCAL_DATABASE_URL"]) backendUpdates["LOCAL_DATABASE_URL"] = backendUpdates["DATABASE_URL"];
    if (!backendEnvExisting["PROD_DATABASE_URL"]) backendUpdates["PROD_DATABASE_URL"] = backendUpdates["DATABASE_URL"];

    const backendMerged = { ...backendEnvExisting, ...backendUpdates };
    await writeEnv(backendEnvPath, backendMerged);

    // Admin .env: merge
    const adminEnvPath = path.join(customerPath, "admin", ".env");
    const adminEnvExisting = await readEnv(adminEnvPath);
    const adminUpdates: Record<string, string> = {
      NEXT_PUBLIC_AUTO_DETECT_DOMAIN: String(!isLocal),
      NEXT_PUBLIC_PROD_DOMAIN: domain,
      NEXT_PUBLIC_PROD_API_URL: urls.api,
      NEXT_PUBLIC_PROD_APP_URL: urls.admin,
      NEXT_PUBLIC_PROD_STORE_URL: urls.store,
    };
    if (isLocal) adminUpdates["NEXT_PUBLIC_API_URL"] = urls.api;
    const adminMerged = { ...adminEnvExisting, ...adminUpdates };
    await writeEnv(adminEnvPath, adminMerged);

    // Store .env: merge
    const storeEnvPath = path.join(customerPath, "store", ".env");
    const storeEnvExisting = await readEnv(storeEnvPath);
    const storeUpdates: Record<string, string> = {
      NEXT_PUBLIC_AUTO_DETECT_DOMAIN: String(!isLocal),
      NEXT_PUBLIC_PROD_DOMAIN: domain,
      NEXT_PUBLIC_PROD_API_URL: urls.api,
      NEXT_PUBLIC_PROD_SITE_URL: urls.store,
      NEXT_PUBLIC_PROD_ADMIN_URL: urls.admin,
    };
    if (isLocal) storeUpdates["NEXT_PUBLIC_API_URL"] = urls.api;
    const storeMerged = { ...storeEnvExisting, ...storeUpdates };
    await writeEnv(storeEnvPath, storeMerged);
  }

  private async installDependencies(customerPath: string) {
    const apps = ["backend", "admin", "store"];

    for (const app of apps) {
      const appPath = path.join(customerPath, app);
      console.log(`Installing dependencies for ${app}...`);
      // Install full dependencies to allow building (TypeScript, Prisma, etc.)
      await execAsync(`cd '${appPath}' && npm ci`);
    }
  }

  private async runMigrations(backendPath: string) {
    await execAsync(`cd ${backendPath} && npx prisma generate`);
    await execAsync(`cd ${backendPath} && npx prisma migrate deploy`);
  }

  private async seedData(backendPath: string) {
    await execAsync(`cd ${backendPath} && npm run db:seed`);
  }

  private async buildApplications(customerPath: string, opts?: { buildAdmin?: boolean; buildStore?: boolean; prune?: boolean }) {
    // Build backend
    console.log("Building backend...");
    await execAsync(`cd '${path.join(customerPath, "backend")}' && NODE_ENV=production npm run build`);

    // Build admin (optional)
    if (opts?.buildAdmin !== false) {
      console.log("Building admin panel...");
      await execAsync(`cd '${path.join(customerPath, "admin")}' && NODE_ENV=production npm run build`);
    }

    // Build store (optional)
    if (opts?.buildStore !== false) {
      console.log("Building store...");
      await execAsync(`cd '${path.join(customerPath, "store")}' && NODE_ENV=production npm run build`);
    }

    // Optionally prune dev dependencies to reduce footprint for runtime
    try {
      if (opts?.prune) {
        await execAsync(`cd '${path.join(customerPath, "backend")}' && npm prune --production`);
      }
      if (opts?.prune && opts?.buildAdmin !== false) {
        await execAsync(`cd '${path.join(customerPath, "admin")}' && npm prune --production`);
      }
      if (opts?.prune && opts?.buildStore !== false) {
        await execAsync(`cd '${path.join(customerPath, "store")}' && npm prune --production`);
      }
    } catch (e) {
      console.warn("npm prune failed (non-fatal)", e);
    }
  }

  private generateSecret(): string {
    return require("crypto").randomBytes(64).toString("hex");
  }

  private isLocalDomain(domain: string): boolean {
    return domain.endsWith('.local') ||
           domain === 'localhost' ||
           !domain.includes('.') ||
           domain.startsWith('test') ||
           domain.startsWith('local');
  }

  private async rollback(customerPath: string, domain: string, _customerId: string, dbName?: string) {
    console.log("🔄 Rolling back deployment...");

    try {
      // Remove customer directory
      if (await fs.pathExists(customerPath)) {
        await fs.remove(customerPath);
      }

      // Drop database if name provided
      if (dbName && dbName.trim()) {
        await this.databaseService.dropDatabase(dbName);
      }

      // Remove nginx config (only if not local mode)
      if (!this.isLocalDomain(domain)) {
        await this.nginxService.removeConfig(domain);
      }

      // Remove PM2 processes
      await this.pm2Service.deleteCustomer(domain);

      console.log("✅ Rollback completed");
    } catch (error) {
      console.error("Rollback failed:", error);
    }
  }

  private emitProgress(domain: string, step: string, message: string) {
    try {
      io.to(`deployment-${domain}`).emit("deployment-progress", { step, message, domain, ts: Date.now() });
    } catch {}
  }
}
