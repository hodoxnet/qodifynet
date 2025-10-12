import fs from "fs-extra";
import path from "path";
import AdmZip from "adm-zip";
import { promisify } from "util";
import { exec } from "child_process";
import { io } from "../index";
import { CustomerDbRepository } from "../repositories/customer.db.repository";
import { SettingsService } from "./settings.service";
import { DatabaseService } from "./database.service";
import { PM2Service } from "./pm2.service";
import { SetupService } from "./setup.service";

const execAsync = promisify(exec);

export type BackupManifest = {
  customer: { id: string; domain: string };
  timestamp: string;
  include: { artifacts: boolean; logs: boolean };
  engine: { node?: string; postgres?: string };
  files: { dbDump?: string; dirs: string[] };
  sizeBytes?: number;
};

export class BackupService {
  private customersPath: string;
  private settings: SettingsService;
  private repo: CustomerDbRepository;
  private pm2: PM2Service;
  private setup: SetupService;

  constructor() {
    this.customersPath = process.env.CUSTOMERS_PATH || "/var/qodify/customers";
    this.settings = new SettingsService();
    this.repo = CustomerDbRepository.getInstance();
    this.pm2 = new PM2Service();
    this.setup = new SetupService();
  }

  private emit(domain: string, message: string, extra?: any) {
    io.to(`deployment-${domain}`).emit("backup-progress", { message, ...extra });
  }

  private getCustomerPath(domain: string) {
    return path.join(this.customersPath, domain.replace(/\./g, "-"));
  }

  private getBackupsDir(domain: string) {
    return path.join(this.getCustomerPath(domain), "backups");
  }

  private validateBackupId(id: string): string {
    if (!id || typeof id !== 'string') throw new Error('Invalid backup id');
    // Allow only timestamp-like safe characters (letters, digits, _ and -)
    // Our generator uses ISO string with : and . replaced by -, leaving letters like T/Z
    if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('Invalid backup id');
    if (id.includes('..') || id.includes('/') || id.includes('\\')) throw new Error('Invalid backup id');
    return id;
  }

  private resolveBackupFilePath(domain: string, backupId: string): string {
    const safeId = this.validateBackupId(backupId);
    const base = path.resolve(this.getBackupsDir(domain));
    const filePath = path.resolve(base, `${safeId}.zip`);
    // Ensure the resolved path stays within backups directory
    if (!(filePath === base || filePath.startsWith(base + path.sep))) {
      throw new Error('Invalid backup path');
    }
    return filePath;
  }

  async listBackups(domain: string): Promise<Array<{ id: string; createdAt: string; sizeBytes: number; manifest?: BackupManifest }>> {
    const dir = this.getBackupsDir(domain);
    const out: Array<{ id: string; createdAt: string; sizeBytes: number; manifest?: BackupManifest }> = [];
    if (!(await fs.pathExists(dir))) return out;

    const files = await fs.readdir(dir);
    for (const f of files) {
      if (!f.endsWith(".zip")) continue;
      const fp = path.join(dir, f);
      const stat = await fs.stat(fp);
      const id = f.replace(/\.zip$/, "");
      let manifest: BackupManifest | undefined;
      try {
        const zip = new AdmZip(fp);
        const entry = zip.getEntry("backup.json");
        if (entry) {
          const j = JSON.parse(entry.getData().toString("utf-8"));
          manifest = j as BackupManifest;
        }
      } catch {}
      out.push({ id, createdAt: stat.mtime.toISOString(), sizeBytes: stat.size, manifest });
    }
    // Yeni→eski sırala
    out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return out;
  }

  async createBackup(customerId: string, opts?: { includeArtifacts?: boolean; includeLogs?: boolean }) {
    const customer = await this.repo.getById(customerId);
    if (!customer) throw new Error("Customer not found");
    const domain = customer.domain;

    const includeArtifacts = opts?.includeArtifacts === true; // node_modules/.next/dist
    const includeLogs = opts?.includeLogs === true;

    const base = this.getCustomerPath(domain);
    const backupsDir = this.getBackupsDir(domain);
    await fs.ensureDir(backupsDir);
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const workDir = path.join(backupsDir, `.work-${ts}`);
    await fs.ensureDir(workDir);

    try {
      // Progress weights
      const COPY_WEIGHT = 70; // %
      const DB_WEIGHT = 20;   // %
      const ZIP_WEIGHT = 10;  // %

      // 1) Pre-scan files and copy with size-weighted progress
      this.emit(domain, "Dosyalar taranıyor...", { percent: 1 });
      const dirs = ["backend", "admin", "store"] as const;

      type FileItem = { src: string; dst: string; size: number };
      const allFiles: FileItem[] = [];

      for (const d of dirs) {
        const srcRoot = path.join(base, d);
        const dstRoot = path.join(workDir, d);
        const filter = (abs: string) => {
          const rel = path.relative(srcRoot, abs);
          if (rel.startsWith("..")) return false;
          const parts = rel.split(path.sep);
          if (!includeArtifacts) {
            if (parts.includes("node_modules") || parts.includes(".next") || parts.includes("dist")) return false;
          }
          if (!includeLogs && parts.includes("logs")) return false;
          return true;
        };

        const walk = async (srcDir: string) => {
          const entries = await fs.readdir(srcDir);
          for (const e of entries) {
            const abs = path.join(srcDir, e);
            if (!filter(abs)) continue;
            const st = await fs.stat(abs);
            const rel = path.relative(srcRoot, abs);
            const dst = path.join(dstRoot, rel);
            if (st.isDirectory()) {
              await walk(abs);
            } else if (st.isFile()) {
              allFiles.push({ src: abs, dst, size: st.size });
            }
          }
        };
        await walk(srcRoot).catch(() => {});
      }

      const totalBytes = allFiles.reduce((a, b) => a + b.size, 0) || 1;
      let processed = 0;
      this.emit(domain, `Kopyalama başlıyor (${allFiles.length} dosya)...`, { percent: 2 });

      for (const f of allFiles) {
        await fs.ensureDir(path.dirname(f.dst));
        await fs.copyFile(f.src, f.dst);
        processed += f.size;
        const percent = Math.min(COPY_WEIGHT, Math.floor((processed / totalBytes) * COPY_WEIGHT));
        if (percent % 3 === 0) this.emit(domain, `Kopyalanıyor: ${path.basename(f.src)}`, { percent });
      }
      this.emit(domain, "Dosya kopyalama tamamlandı", { percent: COPY_WEIGHT });

      // uploads klasörü symlink ise kaçırılmaması için açıkça dahil et
      try {
        const uploadsSrc = path.join(base, 'backend', 'uploads');
        if (await fs.pathExists(uploadsSrc)) {
          const uploadsDst = path.join(workDir, 'backend', 'uploads');
          await fs.copy(uploadsSrc, uploadsDst, { dereference: true });
        }
      } catch {}

      // .env dosyalarını güvenceye al (dotfile kaçırılmalarına karşı)
      for (const svc of ['backend', 'admin', 'store'] as const) {
        try {
          const envSrc = path.join(base, svc, '.env');
          if (await fs.pathExists(envSrc)) {
            const envDst = path.join(workDir, svc, '.env');
            await fs.ensureDir(path.dirname(envDst));
            await fs.copy(envSrc, envDst);
          }
        } catch {}
      }

      // 2) DB dump (custom compressed) — müşteri DB bilgisi yoksa atla
      const settings = await this.settings.getSettings();
      const adminCfg = {
        host: process.env.DB_HOST || settings.db?.host || "localhost",
        port: parseInt(process.env.DB_PORT || String(settings.db?.port || 5432)),
        user: process.env.DB_USER || settings.db?.user || "postgres",
        password: process.env.DB_PASSWORD || settings.db?.password || "postgres",
      };
      const hasDb = Boolean(customer.db?.name && String(customer.db.name).trim().length > 0);
      let hasDbDump = false;
      if (hasDb) {
        const dumpPath = path.join(workDir, "db.dump");
        this.emit(domain, "Veritabanı yedekleniyor...", { percent: COPY_WEIGHT + 5 });
        // Shell enjeksiyonu riskini engellemek için DatabaseService'in sanitize eden helper'ını kullan
        const dbSvc = new DatabaseService(adminCfg);
        await dbSvc.backupDatabaseCustom(customer.db!.name, dumpPath);
        hasDbDump = true;
        this.emit(domain, "Veritabanı yedeği tamamlandı", { percent: COPY_WEIGHT + DB_WEIGHT });
      } else {
        // DB bilgisi yoksa DB dump'ı atla ama ilerlemeyi ileri sar
        this.emit(domain, "Veritabanı bilgisi bulunamadı, DB yedeği atlanıyor", { percent: COPY_WEIGHT + DB_WEIGHT });
      }

      // 3) Manifest
      const manifest: BackupManifest = {
        customer: { id: customer.id, domain },
        timestamp: new Date().toISOString(),
        include: { artifacts: includeArtifacts, logs: includeLogs },
        engine: {},
        files: { dbDump: hasDbDump ? "db.dump" : undefined, dirs: ["backend", "admin", "store"] },
      };
      await fs.writeJson(path.join(workDir, "backup.json"), manifest, { spaces: 2 });

      // 4) Zip
      this.emit(domain, "Arşiv oluşturuluyor...", { percent: COPY_WEIGHT + DB_WEIGHT + Math.floor(ZIP_WEIGHT * 0.6) });
      const zip = new AdmZip();
      zip.addLocalFolder(workDir, "");
      const outPath = path.join(backupsDir, `${ts}.zip`);
      zip.writeZip(outPath);
      const stat = await fs.stat(outPath);

      this.emit(domain, "Yedekleme tamamlandı", { sizeBytes: stat.size, backupId: ts, percent: 100 });
      return { success: true, backupId: ts, sizeBytes: stat.size };
    } finally {
      // Temizlik
      try { await fs.remove(workDir); } catch {}
    }
  }

  async deleteBackup(customerId: string, backupId: string) {
    const customer = await this.repo.getById(customerId);
    if (!customer) throw new Error("Customer not found");
    const file = this.resolveBackupFilePath(customer.domain, backupId);
    if (!(await fs.pathExists(file))) throw new Error("Backup not found");
    await fs.remove(file);
    return { success: true };
  }

  async getBackupFile(domain: string, backupId: string): Promise<string> {
    const file = this.resolveBackupFilePath(domain, backupId);
    if (!(await fs.pathExists(file))) throw new Error("Backup not found");
    return file;
  }

  async restoreBackup(customerId: string, backupId: string) {
    const customer = await this.repo.getById(customerId);
    if (!customer) throw new Error("Customer not found");
    const domain = customer.domain;
    const base = this.getCustomerPath(domain);
    const zipPath = await this.getBackupFile(domain, backupId);

    // Progress weights (approx)
    const EXTRACT_WEIGHT = 30;
    const COPY_WEIGHT = 40;
    const DB_WEIGHT = 20;
    const START_WEIGHT = 10;

    // 1) PM2 stop
    this.emit(domain, "Servisler durduruluyor...", { percent: 2 });
    try { await this.pm2.stopCustomer(domain); } catch {}

    // 2) Extract to work dir
    const workDir = path.join(base, `.restore-${backupId}`);
    await fs.ensureDir(workDir);
    try {
      this.emit(domain, "Arşiv açılıyor...", { percent: EXTRACT_WEIGHT / 2 });
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(workDir, true);

      // 2.1) Hedef servis dizinlerini temizle (mirror restore) – var olmayan dosyalar da silinsin
      try {
        for (const svc of ["backend", "admin", "store"]) {
          const dstRoot = path.join(base, svc);
          await fs.remove(dstRoot);
          await fs.ensureDir(dstRoot);
        }
        this.emit(domain, "Hedef klasörler temizlendi", { percent: EXTRACT_WEIGHT });
      } catch {}

      // 3) Files overwrite with progress (size-weighted)
      type Item = { src: string; dst: string; size: number };
      const targets: Array<{ name: string; path: string }> = [
        { name: "backend", path: path.join(workDir, "backend") },
        { name: "admin", path: path.join(workDir, "admin") },
        { name: "store", path: path.join(workDir, "store") },
      ];
      const items: Item[] = [];
      for (const t of targets) {
        const srcRoot = t.path;
        const dstRoot = path.join(base, t.name);
        const walk = async (srcDir: string) => {
          const entries = await fs.readdir(srcDir);
          for (const e of entries) {
            const abs = path.join(srcDir, e);
            const st = await fs.stat(abs);
            const rel = path.relative(srcRoot, abs);
            const dst = path.join(dstRoot, rel);
            if (st.isDirectory()) await walk(abs);
            else if (st.isFile()) items.push({ src: abs, dst, size: st.size });
          }
        };
        if (await fs.pathExists(srcRoot)) await walk(srcRoot);
      }
      const total = items.reduce((a, b) => a + b.size, 0) || 1;
      let done = 0;
      this.emit(domain, "Dosyalar geri yükleniyor...", { percent: EXTRACT_WEIGHT });
      for (const it of items) {
        await fs.ensureDir(path.dirname(it.dst));
        await fs.copyFile(it.src, it.dst);
        done += it.size;
        const percent = EXTRACT_WEIGHT + Math.min(COPY_WEIGHT, Math.floor((done / total) * COPY_WEIGHT));
        if (percent % 3 === 0) this.emit(domain, `Kopyalanıyor: ${path.basename(it.src)}`, { percent });
      }
      this.emit(domain, "Dosya kopyalama tamamlandı", { percent: EXTRACT_WEIGHT + COPY_WEIGHT });

      // 4) Database restore (dump varsa ve DB adı varsa)
      if (customer.db?.name) {
        const settings = await this.settings.getSettings();
        const adminCfg = {
          host: process.env.DB_HOST || settings.db?.host || "localhost",
          port: parseInt(process.env.DB_PORT || String(settings.db?.port || 5432)),
          user: process.env.DB_USER || settings.db?.user || "postgres",
          password: process.env.DB_PASSWORD || settings.db?.password || "postgres",
        };
        const db = new DatabaseService(adminCfg);
        const dumpFile = path.join(workDir, "db.dump");
        if (await fs.pathExists(dumpFile)) {
          this.emit(domain, "Veritabanı geri yükleniyor...", { percent: EXTRACT_WEIGHT + COPY_WEIGHT + Math.floor(DB_WEIGHT * 0.5) });
          await db.restoreFromCustomDump(customer.db.name, dumpFile, { resetSchema: true });
          if (customer.db?.user) {
            try { await db.ensureSchemaPrivileges(customer.db.name, customer.db.user); } catch {}
          }
        } else {
          this.emit(domain, "Yedekte DB dump bulunamadı, DB geri yükleme atlandı", { percent: EXTRACT_WEIGHT + COPY_WEIGHT + DB_WEIGHT });
        }
      }

      // 5) Dependencies (if artifacts excluded, ensure deps)
      this.emit(domain, "Bağımlılıklar kontrol ediliyor...", { percent: EXTRACT_WEIGHT + COPY_WEIGHT + DB_WEIGHT });
      for (const d of ["backend", "admin", "store"]) {
        const cwd = path.join(base, d);
        const hasNodeModules = await fs.pathExists(path.join(cwd, "node_modules"));
        if (!hasNodeModules) {
          this.emit(domain, `${d} bağımlılıkları yükleniyor...`);
          await execAsync("npm install --production=false --no-audit --no-fund", { cwd });
        }
      }

      // 6) Production build (artefaktlar yedekte yoksa derle)
      const isLocal = this.isLocalDomain(domain);
      if (!isLocal) {
        this.emit(domain, "Uygulamalar derleniyor...", { percent: EXTRACT_WEIGHT + COPY_WEIGHT + Math.floor(DB_WEIGHT * 0.5) });
        const buildRes = await this.setup.buildApplications(domain, false, (msg) => {
          this.emit(domain, msg || "build", { percent: EXTRACT_WEIGHT + COPY_WEIGHT + Math.floor(DB_WEIGHT * 0.7) });
        }, { skipTypeCheck: true });
        if (!buildRes.ok) {
          throw new Error(buildRes.message || 'Build başarısız');
        }
      }

      // 7) PM2 restart/start
      this.emit(domain, "Servisler başlatılıyor...", { percent: EXTRACT_WEIGHT + COPY_WEIGHT + DB_WEIGHT + Math.floor(START_WEIGHT * 0.6) });
      try { await this.pm2.startCustomer(domain, base); } catch { await this.pm2.restartCustomer(domain); }

      this.emit(domain, "Geri yükleme tamamlandı", { backupId, percent: 100 });
      return { success: true };
    } finally {
      try { await fs.remove(workDir); } catch {}
    }
  }

  private isLocalDomain(domain: string): boolean {
    return domain.endsWith('.local') ||
           domain === 'localhost' ||
           !domain.includes('.') ||
           domain.startsWith('test') ||
           domain.startsWith('local');
  }
}
