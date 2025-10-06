import fs from "fs-extra";
import path from "path";
import os from "os";
import AdmZip from "adm-zip";
import { Client } from "pg";
import { io } from "../index";
import { CustomerDbRepository } from "../repositories/customer.db.repository";
import { SettingsService } from "./settings.service";
import { DatabaseService } from "./database.service";
import { PM2Repository } from "../repositories/pm2.repository";
import { mergeEnvFile } from "../utils/env-merge";
import { SetupService } from "./setup.service";

export type DemoImportParams = {
  domain: string;
  version?: string;
  template?: string; // ileride birden fazla tema desteği için
  packName?: string; // templates/<ver>/demo/ altındaki zip adı
  packPath?: string; // tam yol ile zip (opsiyonel)
  overwriteUploads?: boolean;
  // strict: hatada dur; best-effort: hataları atlayıp devam; schema-restore: .dump ile şema+veri geri yükle
  mode?: 'strict' | 'best-effort' | 'schema-restore';
  skipProcessRestart?: boolean;
};

export class DemoDataService {
  private templatesPath = process.env.TEMPLATES_PATH || "/var/qodify/templates";
  private customersPath = process.env.CUSTOMERS_PATH || "/var/qodify/customers";

  private isLocalDomain(domain: string): boolean {
    return domain.includes("localhost") || domain.includes("127.0.0.1") || domain.endsWith(".local");
  }

  private emit(domain: string, message: string, extra?: any) {
    io.to(`deployment-${domain}`).emit("demo-import-output", { message, ...extra });
    io.to(`setup-${domain}`).emit("demo-import-output", { message, ...extra });
    io.to(`deployment-${domain}`).emit("setup-progress", { step: "demo-import", message, ...extra });
    io.to(`setup-${domain}`).emit("setup-progress", { step: "demo-import", message, ...extra });
  }

  private resolvePackPath(params: DemoImportParams): string {
    if (params.packPath && params.packPath.trim()) return params.packPath;
    const version = (params.version && params.version.trim()) || "latest";
    const demoDirCandidates: string[] = [];
    // Kategori dizinleri altında dene
    const categories = ["stable", "beta", "archived"];
    for (const cat of categories) {
      demoDirCandidates.push(path.join(this.templatesPath, cat, version, "demo"));
    }
    // Kök altında dene
    demoDirCandidates.push(path.join(this.templatesPath, version, "demo"));

    const name = params.packName || "demo.zip";
    for (const demoDir of demoDirCandidates) {
      const full = path.join(demoDir, name);
      if (fs.existsSync(full)) return full;
    }
    // Son çare: doğrudan kökte arama
    const rootCandidate = path.join(this.templatesPath, name);
    if (fs.existsSync(rootCandidate)) return rootCandidate;
    throw new Error(`Demo paketi bulunamadı: ${name} (${demoDirCandidates.join(", ")})`);
  }

  async importDemo(params: DemoImportParams): Promise<{ ok: boolean; message: string }>{
    const domain = params.domain;
    const domainSlug = domain.replace(/\./g, "-");
    const customerPath = path.join(this.customersPath, domainSlug);
    const backendPath = path.join(customerPath, "backend");
    const uploadsDest = path.join(backendPath, "uploads");

    // Müşteri ve DB bilgilerini al
    const repo = CustomerDbRepository.getInstance();
    const customer = await repo.getByDomain(domain);
    if (!customer || !customer.db?.name) {
      throw new Error("Müşteri veya veritabanı bilgisi bulunamadı");
    }

    const { db } = customer;

    // Admin DB erişim bilgileri (env > settings.json)
    const settings = await new SettingsService().getSettings();
    const adminCfg = {
      host: process.env.DB_HOST || settings.db?.host || db.host || "localhost",
      port: parseInt(process.env.DB_PORT || String(settings.db?.port || db.port || 5432), 10),
      user: process.env.DB_USER || settings.db?.user || "postgres",
      password: process.env.DB_PASSWORD || settings.db?.password || "postgres",
    };

    // PM2 süreçlerini durdur (dosya çakışmalarını önlemek için)
    const pm2 = PM2Repository.getInstance();
    try { await pm2.stopAllCustomerProcesses(domain); } catch (e) { this.emit(domain, `PM2 süreçleri durdurulamadı: ${e}`); }

    try {
      // 1) Geçici dizine paketi aç
      const packPath = this.resolvePackPath(params);
      this.emit(domain, `Demo paketi bulunuyor: ${packPath}`);
      const tmpBase = await fs.mkdtemp(path.join(os.tmpdir(), `qodify-demo-${domainSlug}-`));
      const zip = new AdmZip(packPath);
      zip.extractAllTo(tmpBase, true);

      // 2) dump dosyasını bul (.sql veya .dump kabul edilir)
      const entries = await fs.readdir(tmpBase);
      let dumpFile: string | null = null;
      for (const e of entries) {
        const full = path.join(tmpBase, e);
        const stat = await fs.stat(full);
        if (stat.isFile() && (e.toLowerCase().endsWith(".sql") || e.toLowerCase().endsWith(".dump"))) { dumpFile = full; break; }
      }
      if (!dumpFile) {
        // alt klasörlerde ara
        const walk = async (dir: string): Promise<string | null> => {
          const items = await fs.readdir(dir);
          for (const it of items) {
            const p = path.join(dir, it);
            const st = await fs.stat(p);
            if (st.isDirectory()) { const f = await walk(p); if (f) return f; }
            else if (st.isFile() && (it.toLowerCase().endsWith(".sql") || it.toLowerCase().endsWith(".dump"))) return p;
          }
          return null;
        };
        dumpFile = await walk(tmpBase);
      }
      if (!dumpFile) throw new Error("Demo paketinde .sql/.dump dosyası bulunamadı");

      // 3) uploads klasörünü bul
      const uploadsCandidates = [path.join(tmpBase, "uploads")];
      let uploadsSrc: string | null = null;
      for (const u of uploadsCandidates) { if (await fs.pathExists(u)) { uploadsSrc = u; break; } }
      if (!uploadsSrc) {
        // alt klasörlerde ara
        const findUploads = async (dir: string): Promise<string | null> => {
          const items = await fs.readdir(dir);
          for (const it of items) {
            const p = path.join(dir, it);
            const st = await fs.stat(p);
            if (st.isDirectory()) {
              if (it === "uploads") return p;
              const f = await findUploads(p); if (f) return f;
            }
          }
          return null;
        };
        uploadsSrc = await findUploads(tmpBase);
      }

      // 4) Backup oluştur
      const backupsDir = path.join(customerPath, "backups", new Date().toISOString().replace(/[:.]/g, "-"));
      await fs.ensureDir(backupsDir);
      const dbService = new DatabaseService(adminCfg);
      this.emit(domain, "Mevcut veritabanı yedekleniyor...");
      const prevPwd = process.env.PGPASSWORD;
      try {
        process.env.PGPASSWORD = adminCfg.password;
        try { await dbService.backupDatabase(db.name, backupsDir); } catch (e) { this.emit(domain, `DB yedekleme uyarı: ${e}`); }
        this.emit(domain, "DB yedeği tamamlandı");

      // 5) Truncate + restore (SQL) veya custom dump (.dump) ile şema+veri geri yükleme
      const isCustom = dumpFile.toLowerCase().endsWith('.dump');
      const mode = params.mode || 'strict';

      if (isCustom && mode === 'schema-restore') {
        this.emit(domain, 'Şema reset + pg_restore başlatılıyor...');
        await dbService.restoreFromCustomDump(db.name, dumpFile, { resetSchema: true });
      } else {
        this.emit(domain, "Mevcut veriler temizleniyor (TRUNCATE ALL)...");
        await dbService.truncateAllTables(db.name, ["_prisma_migrations"]);
        this.emit(domain, `Demo dump uygulanıyor: ${path.basename(dumpFile)}`);
        try {
          await dbService.restoreDatabase(db.name, dumpFile);
        } catch (e: any) {
          if (mode === 'best-effort') {
            // Hataları atlayarak devam et
            const { exec } = await import('child_process');
            const { promisify } = await import('util');
            const execAsync2 = promisify(exec);
            const cmd = `psql -v ON_ERROR_STOP=0 -q -U ${adminCfg.user} -h ${adminCfg.host} -p ${adminCfg.port} -d ${db.name} -f "${dumpFile}"`;
            await execAsync2(cmd, { env: { ...process.env, PGPASSWORD: adminCfg.password }, maxBuffer: 1024 * 1024 * 512 });
            this.emit(domain, 'Uyarı: Bazı satırlar hatalı olabilir (best-effort).');
          } else {
            throw e;
          }
        }
      }
      } finally {
        if (prevPwd === undefined) delete process.env.PGPASSWORD; else process.env.PGPASSWORD = prevPwd;
      }
      if (db.user) {
        this.emit(domain, `Şema yetkileri ${db.user} için yeniden uygulanıyor...`);
        await dbService.ensureSchemaPrivileges(db.name, db.user);
        this.emit(domain, `Şema yetkileri ${db.user} için yeniden uygulandı`);
      } else {
        this.emit(domain, "Uyarı: Müşteri veritabanı kullanıcısı bulunamadı, şema yetkileri tekrar uygulanamadı");
      }
      this.emit(domain, "Demo dump başarıyla uygulandı");

      // 6) Uploads kopyala (varsa)
      if (uploadsSrc && (params.overwriteUploads !== false)) {
        this.emit(domain, `Uploads kopyalanıyor → ${uploadsDest}`);
        await fs.ensureDir(uploadsDest);
        await fs.copy(uploadsSrc, uploadsDest, { overwrite: true, errorOnExist: false });
        this.emit(domain, "Uploads kopyalandı");
      } else {
        this.emit(domain, "Uploads klasörü bulunamadı veya kopyalama devre dışı");
      }

      // 7) PM2 süreçlerini yeniden başlat
      if (params.skipProcessRestart) {
        this.emit(domain, "Servis restart adımı atlandı (2. adımda tamamlanacak)");
      } else {
        try {
          this.emit(domain, "Servisler yeniden başlatılıyor...");
          await pm2.restartAllCustomerProcesses(domain, true);
        } catch (e) {
          this.emit(domain, `PM2 restart hatası: ${e}`);
        }
      }

      // 8) Temizlik
      try { await fs.remove(tmpBase); } catch {}

      this.emit(domain, "✅ Demo veri içe aktarma tamamlandı");
      return { ok: true, message: params.skipProcessRestart ? "Demo veri içe aktarma tamamlandı, refaktör adımına hazır" : "Demo veri içe aktarma tamamlandı" };
    } catch (error: any) {
      this.emit(domain, `❌ Demo içe aktarma hatası: ${error?.message || error}`);
      return { ok: false, message: error?.message || "Demo içe aktarma başarısız" };
    }
  }

  async refactorDemoData(params: { domain: string; targetDomain?: string; restartServices?: boolean }): Promise<{ ok: boolean; message: string }> {
    const domain = params.domain;
    const finalDomain = (params.targetDomain || domain).trim();
    const domainSlug = domain.replace(/\./g, "-");
    const customerPath = path.join(this.customersPath, domainSlug);

    const repo = CustomerDbRepository.getInstance();
    const customer = await repo.getByDomain(domain);
    if (!customer || !customer.db?.name) {
      throw new Error("Müşteri veya veritabanı bilgisi bulunamadı");
    }

    const ports = customer.ports || { backend: 4000, admin: 4001, store: 3000 };
    const isLocal = customer.mode === "local" || this.isLocalDomain(finalDomain);
    const backendUrl = isLocal ? `http://localhost:${ports.backend}` : `https://${finalDomain}`;
    const storeUrl = isLocal ? `http://localhost:${ports.store}` : `https://${finalDomain}`;
    const adminUrl = isLocal ? `http://localhost:${ports.admin}` : `https://${finalDomain}/qpanel`;
    const apiUrl = `${backendUrl}/api`;

    const assetUrl = new URL(storeUrl);
    const assetBase = `${assetUrl.protocol}//${assetUrl.host}`;
    const assetHost = assetUrl.port ? `${assetUrl.hostname}:${assetUrl.port}` : assetUrl.hostname;

    const settings = await new SettingsService().getSettings();
    const adminCfg = {
      host: process.env.DB_HOST || settings.db?.host || customer.db.host || "localhost",
      port: parseInt(process.env.DB_PORT || String(settings.db?.port || customer.db.port || 5432), 10),
      user: process.env.DB_USER || settings.db?.user || "postgres",
      password: process.env.DB_PASSWORD || settings.db?.password || "postgres",
    };

    const pm2 = PM2Repository.getInstance();
    let restartDone = false;
    try { await pm2.stopAllCustomerProcesses(domain); } catch (e) { this.emit(domain, `PM2 süreçleri durdurma uyarısı: ${e}`); }

    const dbClient = new Client({
      host: adminCfg.host,
      port: adminCfg.port,
      user: adminCfg.user,
      password: adminCfg.password,
      database: customer.db.name.replace(/[^a-zA-Z0-9_]/g, "_"),
    } as any);

    try {
      await dbClient.connect();
      this.emit(domain, "Veritabanı URL alanları güncelleniyor...");

      const columnsQuery = `
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND data_type IN ('text', 'character varying')
          AND (
            column_name ~ '(image|logo|banner|icon|cover|thumbnail|picture|photo|background|favicon|poster)'
            OR (column_name = 'url' AND table_name ~ '(image|banner|logo|media|upload|asset|gallery|slider)')
          )
        ORDER BY table_name, column_name;
      `;
      const { rows } = await dbClient.query(columnsQuery);

      let totalUpdates = 0;
      for (const row of rows) {
        const table = row.table_name;
        const column = row.column_name;
        const updateSql = `UPDATE "public"."${table}" SET "${column}" = regexp_replace("${column}", '^https?://[^/]+', $1)
          WHERE "${column}" LIKE 'http%' AND "${column}" LIKE '%/uploads/%' AND "${column}" NOT LIKE $2`;
        try {
          const res = await dbClient.query(updateSql, [assetBase, `${assetBase}%`]);
          const affected = res.rowCount ?? 0;
          if (affected > 0) {
            totalUpdates += affected;
            this.emit(domain, `• ${table}.${column}: ${affected} kayıt güncellendi`);
          }
        } catch (err) {
          this.emit(domain, `⚠️ ${table}.${column} güncellenemedi: ${err}`);
        }
      }

      const legacyHosts = Array.from(new Set([
        'http://localhost:3005',
        'https://localhost:3005',
        'http://localhost:4000',
        'https://localhost:4000',
        'http://localhost',
        'https://localhost',
        'http://127.0.0.1:3005',
        'https://127.0.0.1:3005',
        'http://127.0.0.1:4000',
        'https://127.0.0.1:4000',
        'http://127.0.0.1',
        'https://127.0.0.1',
        'http://demo.qodify.com',
        'https://demo.qodify.com',
        'http://demo.hodoxpro.com',
        'https://demo.hodoxpro.com',
      ].map((host) => host.replace(/\/+$/, '')))).filter((host) => host && host !== assetBase);

      if (legacyHosts.length) {
        const textColumnsQuery = `
          SELECT table_name, column_name, data_type
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND data_type IN ('text', 'character varying')
        `;
        const jsonColumnsQuery = `
          SELECT table_name, column_name, data_type
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND data_type IN ('json', 'jsonb')
        `;

        const textColumns = await dbClient.query(textColumnsQuery);
        for (const col of textColumns.rows) {
          const table = col.table_name;
          const column = col.column_name;
          for (const legacyHost of legacyHosts) {
            const likeParam = `%${legacyHost}%`;
            const updateSql = `UPDATE "public"."${table}" SET "${column}" = replace("${column}", $1, $2) WHERE "${column}" LIKE $3`;
            try {
              const res = await dbClient.query(updateSql, [legacyHost, assetBase, likeParam]);
              const affected = res.rowCount ?? 0;
              if (affected > 0) {
                totalUpdates += affected;
                this.emit(domain, `• ${table}.${column}: ${affected} kayıt ${legacyHost} → ${assetBase}`);
              }
            } catch (err) {
              this.emit(domain, `⚠️ ${table}.${column} (text) güncellemesinde hata: ${err}`);
            }
          }
        }

        const jsonColumns = await dbClient.query(jsonColumnsQuery);
        for (const col of jsonColumns.rows) {
          const table = col.table_name;
          const column = col.column_name;
          const dataType = col.data_type === 'json' ? 'json' : 'jsonb';
          for (const legacyHost of legacyHosts) {
            const likeParam = `%${legacyHost}%`;
            const updateSql = `UPDATE "public"."${table}" SET "${column}" = replace("${column}"::text, $1, $2)::${dataType} WHERE "${column}"::text LIKE $3`;
            try {
              const res = await dbClient.query(updateSql, [legacyHost, assetBase, likeParam]);
              const affected = res.rowCount ?? 0;
              if (affected > 0) {
                totalUpdates += affected;
                this.emit(domain, `• ${table}.${column} (JSON): ${affected} kayıt ${legacyHost} → ${assetBase}`);
              }
            } catch (err) {
              this.emit(domain, `⚠️ ${table}.${column} (JSON) güncellemesinde hata: ${err}`);
            }
          }
        }
      }

      this.emit(domain, `Veritabanı güncellemesi tamamlandı (toplam ${totalUpdates} kayıt)`);

      const backendEnvPath = path.join(customerPath, "backend", ".env");
      const adminEnvPath = path.join(customerPath, "admin", ".env");
      const storeEnvPath = path.join(customerPath, "store", ".env");

      this.emit(domain, "Ortam değişkenleri güncelleniyor...");
      await mergeEnvFile(backendEnvPath, {
        PROD_DOMAIN: finalDomain,
        APP_URL: backendUrl,
        STORE_URL: storeUrl,
        ADMIN_URL: adminUrl,
        AUTO_DETECT_DOMAIN: String(!isLocal),
      });

      const imageHosts = new Set<string>();
      imageHosts.add(assetHost);
      if (!assetHost.startsWith("www.") && assetHost.split(":")[0] !== "localhost") {
        imageHosts.add(`www.${assetHost}`);
      }
      const imageHostEnv = Array.from(imageHosts).join(",");

      await mergeEnvFile(adminEnvPath, {
        NEXT_PUBLIC_AUTO_DETECT_DOMAIN: String(!isLocal),
        NEXT_PUBLIC_PROD_DOMAIN: finalDomain,
        NEXT_PUBLIC_PROD_API_URL: apiUrl,
        NEXT_PUBLIC_API_URL: apiUrl,
        NEXT_PUBLIC_IMAGE_HOSTS: imageHostEnv,
      });

      await mergeEnvFile(storeEnvPath, {
        NEXT_PUBLIC_AUTO_DETECT_DOMAIN: String(!isLocal),
        NEXT_PUBLIC_PROD_DOMAIN: finalDomain,
        NEXT_PUBLIC_PROD_API_URL: apiUrl,
        NEXT_PUBLIC_API_URL: apiUrl,
        NEXT_PUBLIC_IMAGE_HOSTS: imageHostEnv,
      });

      this.emit(domain, "Ön yüz uygulamaları yeniden derleniyor...");
      const setupService = new SetupService();
      const buildResult = await setupService.buildApplications(domain, isLocal, (message) => this.emit(domain, message || "Build ilerliyor"), { skipTypeCheck: true });
      if (!buildResult.ok) {
        throw new Error(buildResult.message || "Build işlemi başarısız");
      }

      if (params.restartServices !== false) {
        this.emit(domain, "Servisler yeniden başlatılıyor...");
        await pm2.restartAllCustomerProcesses(domain, true);
        restartDone = true;
      }

      this.emit(domain, "✅ Refaktör işlemi tamamlandı");
      return { ok: true, message: "Demo görsel URL refaktörü tamamlandı" };
    } finally {
      try { await dbClient.end(); } catch {}
      if (params.restartServices !== false && !restartDone) {
        try {
          this.emit(domain, "Servisler yeniden başlatılıyor (otomatik kurtarma)...");
          await pm2.restartAllCustomerProcesses(domain, true);
        } catch (e) {
          this.emit(domain, `PM2 restart hatası: ${e}`);
        }
      }
    }
  }
}
