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
  git?: {
    defaultRepo?: string;
    defaultBranch?: string;
    depth?: number;
    username?: string;
    token?: string;
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
      git: { ...current.git, ...partial.git },
    };

    if (partial.git) {
      if (partial.git.depth !== undefined) {
        const depthNum = Number(partial.git.depth);
        if (!Number.isNaN(depthNum)) {
          next.git!.depth = depthNum;
        }
      }
      if (partial.git.token === "") {
        if (next.git) delete next.git.token;
      }
    }

    await fs.ensureDir(path.dirname(this.settingsPath));
    await fs.writeJson(this.settingsPath, next, { spaces: 2 });
    return next;
  }
}
