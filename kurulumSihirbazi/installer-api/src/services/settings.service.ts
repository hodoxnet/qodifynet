import fs from "fs-extra";
import path from "path";
import { prisma } from "../db/prisma";

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
    password?: string;
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

type FileSettings = Omit<InstallerSettings, "git">;

const DEFAULT_GIT_BRANCH = "main";
const DEFAULT_GIT_DEPTH = 1;
const DEFAULT_GIT_ROW_ID = 1;

export class SettingsService {
  private settingsPath: string;

  constructor() {
    const dataDir = path.join(process.cwd(), "data");
    this.settingsPath = path.join(dataDir, "settings.json");
  }

  private async readFileSettings(): Promise<FileSettings> {
    try {
      if (!(await fs.pathExists(this.settingsPath))) {
        return {};
      }
      const json = await fs.readJson(this.settingsPath);
      if (json && typeof json === "object") {
        const { git, ...rest } = json as InstallerSettings;
        return rest;
      }
      return {};
    } catch {
      return {};
    }
  }

  private async writeFileSettings(settings: FileSettings): Promise<void> {
    await fs.ensureDir(path.dirname(this.settingsPath));
    await fs.writeJson(this.settingsPath, settings, { spaces: 2 });
  }

  private async getGitSettings() {
    const git = await prisma.gitSettings.findFirst();
    if (!git) {
      return {
        defaultRepo: undefined,
        defaultBranch: DEFAULT_GIT_BRANCH,
        depth: DEFAULT_GIT_DEPTH,
        username: undefined,
        token: undefined,
      };
    }
    return {
      defaultRepo: git.defaultRepo ?? undefined,
      defaultBranch: git.defaultBranch ?? DEFAULT_GIT_BRANCH,
      depth: git.depth ?? DEFAULT_GIT_DEPTH,
      username: git.username ?? undefined,
      token: git.token ?? undefined,
    };
  }

  private async saveGitSettings(partial?: InstallerSettings["git"]): Promise<void> {
    if (!partial) return;

    const existing = await prisma.gitSettings.findFirst();

    const merged = {
      defaultRepo: partial.defaultRepo !== undefined ? partial.defaultRepo : existing?.defaultRepo ?? null,
      defaultBranch: partial.defaultBranch !== undefined ? partial.defaultBranch : existing?.defaultBranch ?? DEFAULT_GIT_BRANCH,
      depth: partial.depth !== undefined ? partial.depth : existing?.depth ?? DEFAULT_GIT_DEPTH,
      username: partial.username !== undefined ? partial.username : existing?.username ?? null,
      token: partial.token === "" ? null : partial.token !== undefined ? partial.token : existing?.token ?? null,
    };

    await prisma.gitSettings.upsert({
      where: { id: existing?.id ?? DEFAULT_GIT_ROW_ID },
      update: merged,
      create: {
        id: existing?.id ?? DEFAULT_GIT_ROW_ID,
        ...merged,
      },
    });
  }

  async getSettings(): Promise<InstallerSettings> {
    const fileSettings = await this.readFileSettings();
    const gitSettings = await this.getGitSettings();
    return {
      ...fileSettings,
      git: gitSettings,
    };
  }

  async saveSettings(partial: InstallerSettings) {
    const { git, ...rest } = partial;

    if (rest.db || rest.redis || rest.paths) {
      const currentFile = await this.readFileSettings();
      const nextFile: FileSettings = {
        db: { ...currentFile.db, ...rest.db },
        redis: { ...currentFile.redis, ...rest.redis },
        paths: { ...currentFile.paths, ...rest.paths },
      };
      await this.writeFileSettings(nextFile);
    }

    await this.saveGitSettings(git);

    return this.getSettings();
  }
}
