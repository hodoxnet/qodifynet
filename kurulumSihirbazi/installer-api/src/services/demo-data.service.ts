import fs from "fs-extra";
import path from "path";
import os from "os";
import AdmZip from "adm-zip";
import { io } from "../index";
import { CustomerDbRepository } from "../repositories/customer.db.repository";
import { SettingsService } from "./settings.service";
import { DatabaseService } from "./database.service";
import { PM2Repository } from "../repositories/pm2.repository";

export type DemoImportParams = {
  domain: string;
  version?: string;
  template?: string; // ileride birden fazla tema desteği için
  packName?: string; // templates/<ver>/demo/ altındaki zip adı
  packPath?: string; // tam yol ile zip (opsiyonel)
  overwriteUploads?: boolean;
  // strict: hatada dur; best-effort: hataları atlayıp devam; schema-restore: .dump ile şema+veri geri yükle
  mode?: 'strict' | 'best-effort' | 'schema-restore';
};

export class DemoDataService {
  private templatesPath = process.env.TEMPLATES_PATH || "/var/qodify/templates";
  private customersPath = process.env.CUSTOMERS_PATH || "/var/qodify/customers";

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
      try {
        this.emit(domain, "Servisler yeniden başlatılıyor...");
        await pm2.restartAllCustomerProcesses(domain, true);
      } catch (e) {
        this.emit(domain, `PM2 restart hatası: ${e}`);
      }

      // 8) Temizlik
      try { await fs.remove(tmpBase); } catch {}

      this.emit(domain, "✅ Demo veri içe aktarma tamamlandı");
      return { ok: true, message: "Demo veri içe aktarma tamamlandı" };
    } catch (error: any) {
      this.emit(domain, `❌ Demo içe aktarma hatası: ${error?.message || error}`);
      return { ok: false, message: error?.message || "Demo içe aktarma başarısız" };
    }
  }
}
