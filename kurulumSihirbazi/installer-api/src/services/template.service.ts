import fs from "fs-extra";
import path from "path";
import AdmZip from "adm-zip";
import { SettingsService } from "./settings.service";

export interface Template {
  version: string;
  name: string;
  description: string;
  releaseDate: string;
  size: string;
  components: {
    backend: boolean;
    admin: boolean;
    store: boolean;
  };
}

export class TemplateService {
  private defaultTemplatesPath = process.env.TEMPLATES_PATH || "/var/qodify/templates";

  constructor() {}

  private async resolveTemplatesPath() {
    try {
      const settings = new SettingsService();
      const saved = await settings.getSettings();
      return saved.paths?.templates || this.defaultTemplatesPath;
    } catch {
      return this.defaultTemplatesPath;
    }
  }

  private async ensureTemplatesDirectory(basePath?: string) {
    const root = basePath || (await this.resolveTemplatesPath());
    await fs.ensureDir(root);
    await fs.ensureDir(path.join(root, "stable"));
    await fs.ensureDir(path.join(root, "beta"));
    await fs.ensureDir(path.join(root, "archived"));
  }

  async getAvailableTemplates(): Promise<Template[]> {
    const templates: Template[] = [];

    try {
      const templatesPath = await this.resolveTemplatesPath();
      await this.ensureTemplatesDirectory(templatesPath);
      // Scan templates directory
      const categories = ["stable", "beta", "archived"];

      for (const category of categories) {
        const categoryPath = path.join(templatesPath, category);
        if (await fs.pathExists(categoryPath)) {
          const files = await fs.readdir(categoryPath);

          // Group files by version
          const versionMap = new Map<string, Set<string>>();

          for (const file of files) {
            // Expected format: backend-2.4.0.zip
            const match = file.match(/^(backend|admin|store)-(.+)\.zip$/);
            if (match) {
              const [, component, version] = match;
              if (!versionMap.has(version)) {
                versionMap.set(version, new Set());
              }
              versionMap.get(version)!.add(component);
            }
          }

          // Create template entries
          for (const [version, components] of versionMap) {
            if (components.size === 3) {
              // All three components present
              templates.push({
                version,
                name: `Qodify ${version} (${category})`,
                description: this.getVersionDescription(version, category),
                releaseDate: await this.getFileDate(
                  path.join(categoryPath, `backend-${version}.zip`)
                ),
                size: await this.getTotalSize(categoryPath, version),
                components: {
                  backend: components.has("backend"),
                  admin: components.has("admin"),
                  store: components.has("store"),
                },
              });
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to get templates:", error);
    }

    return templates.sort((a, b) => b.version.localeCompare(a.version));
  }

  async getTemplateInfo(version: string): Promise<Template | null> {
    const templates = await this.getAvailableTemplates();
    return templates.find(t => t.version === version) || null;
  }

  async checkTemplateAvailability(version: string = "latest"): Promise<{
    available: boolean;
    missing: string[];
    message?: string;
  }> {
    const requiredComponents = ["backend", "admin", "store"];
    const missing: string[] = [];

    // Map "latest" to actual version
    if (version === "latest") {
      version = "2.4.0"; // Default to latest stable version
    }

    // A component is considered available if it exists in ANY category
    // or directly under the templates root. We don't require all components
    // to be in the same category because extractTemplates() already searches
    // each category per-component.
    const categories = ["stable", "beta", "archived"];
    const templatesPath = await this.resolveTemplatesPath();
    await this.ensureTemplatesDirectory(templatesPath);

    for (const component of requiredComponents) {
      let componentFound = false;

      // Look for the component in categorized folders
      for (const category of categories) {
        const categoryPath = path.join(templatesPath, category, `${component}-${version}.zip`);
        if (await fs.pathExists(categoryPath)) {
          componentFound = true;
          break;
        }
      }

      // If still not found, check templates root directory
      if (!componentFound) {
        const rootPath = path.join(templatesPath, `${component}-${version}.zip`);
        if (await fs.pathExists(rootPath)) {
          componentFound = true;
        }
      }

      if (!componentFound) {
        missing.push(`${component}-${version}.zip`);
      }
    }

    const available = missing.length === 0;

    return {
      available,
      missing,
      message: available
        ? "All required templates are available"
        : `Missing templates: ${missing.join(", ")}. Please upload the missing files.`,
    };
  }

  /**
   * Return per-component file information (exists/size/date) for a version.
   * A component is resolved from the first location it is found in the order:
   *   stable -> beta -> archived -> templates root
   */
  async getComponentsStatus(version: string = "latest"): Promise<{
    [filename: string]: {
      uploaded: boolean;
      size?: string;
      uploadDate?: string; // ISO date (YYYY-MM-DD)
      category?: string;   // stable/beta/archived/root
      path?: string;
    };
  }> {
    if (version === "latest") {
      version = "2.4.0";
    }

    const components = ["backend", "admin", "store"] as const;
    const categories = ["stable", "beta", "archived"] as const;
    const templatesPath = await this.resolveTemplatesPath();
    await this.ensureTemplatesDirectory(templatesPath);
    const result: {
      [filename: string]: {
        uploaded: boolean;
        size?: string;
        uploadDate?: string;
        category?: string;
        path?: string;
      };
    } = {};

    for (const component of components) {
      let foundPath: string | null = null;
      let foundCategory: string | null = null;

      for (const category of categories) {
        const candidate = path.join(templatesPath, category, `${component}-${version}.zip`);
        if (await fs.pathExists(candidate)) {
          foundPath = candidate;
          foundCategory = category;
          break;
        }
      }

      // Check root as last resort
      if (!foundPath) {
        const candidate = path.join(templatesPath, `${component}-${version}.zip`);
        if (await fs.pathExists(candidate)) {
          foundPath = candidate;
          foundCategory = "root";
        }
      }

      const key = `${component}-${version}.zip`;
      if (foundPath) {
        const stats = await fs.stat(foundPath);
        result[key] = {
          uploaded: true,
          size: this.formatBytes(stats.size),
          uploadDate: stats.mtime.toISOString().split("T")[0],
          category: foundCategory || undefined,
          path: foundPath,
        };
      } else {
        result[key] = { uploaded: false };
      }
    }

    return result;
  }

  private getVersionDescription(version: string, category: string): string {
    const descriptions: Record<string, string> = {
      "2.4.0": "Latest stable release with Smart Environment Management",
      "2.3.0": "Stable release with performance optimizations",
      "2.2.0": "Previous stable version",
    };

    let desc = descriptions[version] || "Qodify E-commerce Platform";
    if (category === "beta") desc += " (Beta - Testing only)";
    if (category === "archived") desc += " (Archived - Not recommended)";

    return desc;
  }

  private async getFileDate(filePath: string): Promise<string> {
    try {
      const stats = await fs.stat(filePath);
      return stats.mtime.toISOString().split("T")[0];
    } catch {
      return new Date().toISOString().split("T")[0];
    }
  }

  private async getTotalSize(categoryPath: string, version: string): Promise<string> {
    let totalSize = 0;
    const components = ["backend", "admin", "store"];

    for (const component of components) {
      const filePath = path.join(categoryPath, `${component}-${version}.zip`);
      if (await fs.pathExists(filePath)) {
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
      }
    }

    return this.formatBytes(totalSize);
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  }

  async createTemplate(sourcePath: string, version: string, category = "stable") {
    const components = ["backend", "admin", "store"];
    const templatesPath = await this.resolveTemplatesPath();
    await this.ensureTemplatesDirectory(templatesPath);

    for (const component of components) {
      const componentPath = path.join(sourcePath, component);
      const outputPath = path.join(templatesPath, category, `${component}-${version}.zip`);

      if (await fs.pathExists(componentPath)) {
        console.log(`Creating template for ${component}...`);

        // Clean build artifacts and node_modules
        await this.cleanDirectory(componentPath);

        // Create zip
        const zip = new AdmZip();
        await this.addDirectoryToZip(zip, componentPath, "");
        zip.writeZip(outputPath);

        console.log(`Template created: ${outputPath}`);
      }
    }
  }

  private async cleanDirectory(dirPath: string) {
    const itemsToRemove = [
      "node_modules",
      ".next",
      "dist",
      ".env",
      ".env.local",
      "*.log",
      ".DS_Store",
    ];

    for (const item of itemsToRemove) {
      const itemPath = path.join(dirPath, item);
      if (await fs.pathExists(itemPath)) {
        await fs.remove(itemPath);
      }
    }
  }

  private async addDirectoryToZip(zip: AdmZip, dirPath: string, zipPath: string) {
    const items = await fs.readdir(dirPath);

    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const itemZipPath = path.join(zipPath, item);

      const stats = await fs.stat(itemPath);

      if (stats.isDirectory()) {
        // Skip certain directories
        if (!["node_modules", ".next", "dist", ".git"].includes(item)) {
          await this.addDirectoryToZip(zip, itemPath, itemZipPath);
        }
      } else {
        // Skip certain files
        if (!item.startsWith(".env") && !item.endsWith(".log")) {
          zip.addLocalFile(itemPath, zipPath);
        }
      }
    }
  }

  async importTemplate(zipPath: string, version: string, category = "stable") {
    const templatesPath = await this.resolveTemplatesPath();
    await this.ensureTemplatesDirectory(templatesPath);
    const outputPath = path.join(templatesPath, category);
    await fs.ensureDir(outputPath);

    // Determine component type from filename
    const filename = path.basename(zipPath);
    const match = filename.match(/^(backend|admin|store)/);

    if (!match) {
      throw new Error("Invalid template filename. Must start with backend, admin, or store");
    }

    const component = match[1];
    const targetPath = path.join(outputPath, `${component}-${version}.zip`);

    // Copy file to templates directory
    await fs.copy(zipPath, targetPath);

    console.log(`Template imported: ${targetPath}`);
    return { success: true, path: targetPath };
  }

  async validateTemplate(zipPath: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      const zip = new AdmZip(zipPath);
      const entries = zip.getEntries();

      // Check for required files based on component type
      const filename = path.basename(zipPath);
      const isBackend = filename.includes("backend");
      const isAdmin = filename.includes("admin");
      const isStore = filename.includes("store");

      const requiredFiles = {
        backend: ["package.json", "tsconfig.json", "prisma/schema.prisma"],
        admin: ["package.json", "next.config.ts", "app/layout.tsx"],
        store: ["package.json", "next.config.ts", "app/layout.tsx"],
      };

      let componentType = "";
      if (isBackend) componentType = "backend";
      else if (isAdmin) componentType = "admin";
      else if (isStore) componentType = "store";

      if (!componentType) {
        errors.push("Cannot determine component type from filename");
      } else {
        const required = requiredFiles[componentType as keyof typeof requiredFiles];
        for (const file of required) {
          const found = entries.some(entry => entry.entryName.includes(file));
          if (!found) {
            errors.push(`Missing required file: ${file}`);
          }
        }
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`Invalid zip file: ${error}`],
      };
    }
  }
}
