import { spawn } from "child_process";
import path from "path";
import fs from "fs-extra";
import { SettingsService } from "./settings.service";

export interface GitCloneOptions {
  repoUrl: string;
  branch?: string;
  depth?: number;
  accessToken?: string;
  username?: string;
  commit?: string;
  force?: boolean;
}

export interface GitUpdateOptions {
  branch?: string;
  commit?: string;
  accessToken?: string;
  username?: string;
  reset?: boolean;
}

export interface DeploymentMetadata {
  source: 'git' | 'template';
  repoUrl?: string;
  branch?: string;
  lastCommit?: string;
  lastSyncAt?: string;
  [key: string]: any;
}

export class GitService {
  private customersPath = process.env.CUSTOMERS_PATH || "/var/qodify/customers";
  private metadataFile = "deployment.json";
  private settingsService = new SettingsService();
  private readonly protectedFiles = [
    path.join("backend", ".env"),
    path.join("admin", ".env"),
    path.join("store", ".env"),
  ];

  private async backupProtectedFiles(customerPath: string): Promise<Array<{ fullPath: string; content: Buffer }>> {
    const backups: Array<{ fullPath: string; content: Buffer }> = [];
    console.log(`[GitService] Protected files backup başlıyor: ${customerPath}`);

    for (const rel of this.protectedFiles) {
      const fullPath = path.join(customerPath, rel);
      try {
        if (await fs.pathExists(fullPath)) {
          const stat = await fs.stat(fullPath);
          if (stat.isFile()) {
            const content = await fs.readFile(fullPath);
            backups.push({ fullPath, content });
            console.log(`[GitService] ✅ Yedeklendi: ${fullPath} (${content.length} bytes)`);
          }
        } else {
          console.log(`[GitService] ⚠️ Dosya bulunamadı: ${fullPath}`);
        }
      } catch (err) {
        console.warn(`[GitService] ❌ Protected dosya yedeklenemedi (${fullPath}):`, err);
      }
    }

    console.log(`[GitService] Toplam ${backups.length} dosya yedeklendi`);
    return backups;
  }

  private async restoreProtectedFiles(backups: Array<{ fullPath: string; content: Buffer }>) {
    console.log(`[GitService] Protected files restore başlıyor: ${backups.length} dosya`);

    for (const backup of backups) {
      try {
        await fs.ensureDir(path.dirname(backup.fullPath));
        await fs.writeFile(backup.fullPath, backup.content);
        console.log(`[GitService] ✅ Geri yüklendi: ${backup.fullPath} (${backup.content.length} bytes)`);
      } catch (err) {
        console.warn(`[GitService] ❌ Protected dosya geri yüklenemedi (${backup.fullPath}):`, err);
      }
    }

    console.log(`[GitService] Protected files restore tamamlandı`);
  }

  private sanitizeDomain(domain: string): string {
    return domain.replace(/\./g, "-");
  }

  private getCustomerPath(domain: string): string {
    return path.join(this.customersPath, this.sanitizeDomain(domain));
  }

  private async runGit(cwd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
    return await new Promise((resolve, reject) => {
      const child = spawn("git", args, {
        cwd,
        env: { ...process.env },
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (data) => { stdout += data.toString(); });
      child.stderr?.on("data", (data) => { stderr += data.toString(); });
      child.on("error", (error) => reject(error));
      child.on("close", (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          const message = stderr || stdout || `git ${args.join(" ")} exit code ${code}`;
          reject(new Error(message.trim()));
        }
      });
    });
  }

  private buildRemoteUrl(repoUrl: string, token?: string, username?: string): string {
    if (!token) return repoUrl;
    try {
      const url = new URL(repoUrl);
      if (username) {
        url.username = encodeURIComponent(username);
        url.password = encodeURIComponent(token);
      } else {
        url.username = encodeURIComponent(token);
      }
      return url.toString();
    } catch {
      return repoUrl;
    }
  }

  private async ensureGit(): Promise<void> {
    await this.runGit(process.cwd(), ["--version"]);
  }

  private async getCurrentBranch(cwd: string): Promise<string | undefined> {
    try {
      const { stdout } = await this.runGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
      return stdout.trim();
    } catch {
      return undefined;
    }
  }

  private async getCurrentCommit(cwd: string): Promise<string | undefined> {
    try {
      const { stdout } = await this.runGit(cwd, ["rev-parse", "HEAD"]);
      return stdout.trim();
    } catch {
      return undefined;
    }
  }

  private async readMetadataFile(customerPath: string): Promise<DeploymentMetadata | null> {
    const filePath = path.join(customerPath, this.metadataFile);
    if (!(await fs.pathExists(filePath))) return null;
    try {
      const data = await fs.readJson(filePath);
      return data as DeploymentMetadata;
    } catch {
      return null;
    }
  }

  private async writeMetadata(customerPath: string, metadata: DeploymentMetadata): Promise<void> {
    const filePath = path.join(customerPath, this.metadataFile);
    await fs.writeJson(filePath, metadata, { spaces: 2 });
  }

  private async applyCloneDefaults(options: GitCloneOptions): Promise<GitCloneOptions> {
    const settings = await this.settingsService.getSettings();
    const git = settings.git || {};
    const depth = options.depth ?? git.depth;
    return {
      repoUrl: options.repoUrl || git.defaultRepo || "",
      branch: options.branch || git.defaultBranch,
      depth: depth !== undefined ? Number(depth) : undefined,
      accessToken: options.accessToken || git.token,
      username: options.username || git.username,
      commit: options.commit,
      force: options.force,
    };
  }

  private async applyUpdateDefaults(options: (GitUpdateOptions & { repoUrl?: string })): Promise<GitUpdateOptions & { repoUrl?: string }> {
    const settings = await this.settingsService.getSettings();
    const git = settings.git || {};
    return {
      ...options,
      repoUrl: options.repoUrl || git.defaultRepo,
      branch: options.branch || git.defaultBranch,
      accessToken: options.accessToken || git.token,
      username: options.username || git.username,
    };
  }

  async cloneRepository(domain: string, options: GitCloneOptions): Promise<{ branch?: string; commit?: string }> {
    await this.ensureGit();
    const merged = await this.applyCloneDefaults(options);
    if (!merged.repoUrl) {
      throw new Error("Git depo adresi bulunamadı. Lütfen Git Ayarları'nı kontrol edin.");
    }

    const remote = this.buildRemoteUrl(merged.repoUrl, merged.accessToken, merged.username);
    const customerPath = this.getCustomerPath(domain);
    const parentDir = path.dirname(customerPath);
    await fs.ensureDir(parentDir);

    if (await fs.pathExists(customerPath)) {
      if (merged.force) {
        await fs.remove(customerPath);
      } else {
        throw new Error("Müşteri klasörü zaten mevcut. force=true parametresiyle yeniden deneyin.");
      }
    }

    const cloneArgs = ["clone"];
    if (merged.depth && merged.depth > 0) {
      cloneArgs.push("--depth", String(merged.depth));
    }
    if (merged.branch) {
      cloneArgs.push("--branch", merged.branch, "--single-branch");
    }
    cloneArgs.push(remote, customerPath);

    await this.runGit(parentDir, cloneArgs);

    if (merged.commit) {
      await this.runGit(customerPath, ["checkout", merged.commit]);
    }

    const branch = merged.branch || await this.getCurrentBranch(customerPath);
    const commit = await this.getCurrentCommit(customerPath);
    await this.writeMetadata(customerPath, {
      source: 'git',
      repoUrl: merged.repoUrl,
      branch,
      lastCommit: commit,
      lastSyncAt: new Date().toISOString(),
    });

    return { branch, commit };
  }

  async updateRepository(domain: string, options: GitUpdateOptions & { repoUrl?: string }): Promise<{ branch?: string; commit?: string }> {
    await this.ensureGit();
    const customerPath = this.getCustomerPath(domain);
    if (!(await fs.pathExists(customerPath))) {
      throw new Error("Müşteri klasörü bulunamadı");
    }

    const metadata = await this.readMetadataFile(customerPath);
    if (!metadata || metadata.source !== 'git' || !metadata.repoUrl) {
      throw new Error("Git kaynak bilgisi bulunamadı. Bu müşteri git ile kurulmamış olabilir.");
    }

    const merged = await this.applyUpdateDefaults({ ...options, repoUrl: options.repoUrl || metadata.repoUrl });
    if (!merged.repoUrl) {
      throw new Error("Git depo adresi tanımlı değil");
    }

    const remote = this.buildRemoteUrl(merged.repoUrl, merged.accessToken, merged.username);

    const backups = await this.backupProtectedFiles(customerPath);

    try {
      await this.runGit(customerPath, ["remote", "set-url", "origin", remote]);

      const targetBranch = merged.branch || metadata.branch || "main";
      await this.runGit(customerPath, ["fetch", "origin", targetBranch]);

      try {
        await this.runGit(customerPath, ["checkout", targetBranch]);
      } catch {
        await this.runGit(customerPath, ["checkout", "-B", targetBranch, `origin/${targetBranch}`]);
      }

      if (merged.reset === false) {
        await this.runGit(customerPath, ["pull", "origin", targetBranch]);
      } else {
        await this.runGit(customerPath, ["reset", "--hard", `origin/${targetBranch}`]);
      }

      if (merged.commit) {
        await this.runGit(customerPath, ["checkout", merged.commit]);
      }
    } finally {
      await this.restoreProtectedFiles(backups);
    }

    const branch = await this.getCurrentBranch(customerPath);
    const commit = await this.getCurrentCommit(customerPath);
    await this.writeMetadata(customerPath, {
      ...metadata,
      repoUrl: merged.repoUrl,
      branch,
      lastCommit: commit,
      lastSyncAt: new Date().toISOString(),
    });

    return { branch, commit };
  }

  async getMetadata(domain: string): Promise<DeploymentMetadata | null> {
    const customerPath = this.getCustomerPath(domain);
    if (!(await fs.pathExists(customerPath))) return null;
    return await this.readMetadataFile(customerPath);
  }

  async recordTemplateSource(domain: string, data: Partial<DeploymentMetadata>): Promise<void> {
    const customerPath = this.getCustomerPath(domain);
    await this.writeMetadata(customerPath, {
      source: 'template',
      lastSyncAt: new Date().toISOString(),
      ...data,
    });
  }
}
