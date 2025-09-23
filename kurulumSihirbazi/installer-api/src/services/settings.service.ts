import fs from "fs-extra";
import path from "path";

export type InstallerSettings = {
  db?: {
    host?: string;
    port?: number;
    user?: string;
    password?: string;
  };
  redis?: {
    host?: string;
    port?: number;
    prefix?: string;
  };
  paths?: {
    templates?: string;
    customers?: string;
  };
};

export class SettingsService {
  private settingsPath: string;

  constructor() {
    const dataDir = path.join(process.cwd(), "data");
    this.settingsPath = path.join(dataDir, "settings.json");
  }

  async getSettings(): Promise<InstallerSettings> {
    try {
      if (!(await fs.pathExists(this.settingsPath))) {
        return {};
      }
      const json = await fs.readJson(this.settingsPath);
      return json || {};
    } catch {
      return {};
    }
  }

  async saveSettings(partial: InstallerSettings) {
    const current = await this.getSettings();
    const next: InstallerSettings = {
      ...current,
      ...partial,
      db: { ...current.db, ...partial.db },
      redis: { ...current.redis, ...partial.redis },
      paths: { ...current.paths, ...partial.paths },
    };
    await fs.ensureDir(path.dirname(this.settingsPath));
    await fs.writeJson(this.settingsPath, next, { spaces: 2 });
    return next;
  }
}
