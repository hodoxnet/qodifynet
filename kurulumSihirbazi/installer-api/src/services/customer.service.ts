import fs from "fs-extra";
import path from "path";
import { Customer } from "../types/customer.types";
// import { CustomerRepository } from "../repositories/customer.repository";
import { CustomerDbRepository } from "../repositories/customer.db.repository";
import { PM2Repository } from "../repositories/pm2.repository";
import { EnvConfigService } from "./env-config.service";
import { LogService } from "./log.service";
import { HealthService } from "./health.service";
import { PrismaAdminService } from "./prisma-admin.service";
import { GitService, GitUpdateOptions, DeploymentMetadata } from "./git.service";
import { SetupService } from "./setup.service";
import { DatabaseService } from "./database.service";
import { SettingsService } from "./settings.service";

export class CustomerService {
  private readonly customersPath: string;
  private readonly customerRepository: CustomerDbRepository;
  private readonly pm2Repository: PM2Repository;
  private readonly envConfigService: EnvConfigService;
  private readonly logService: LogService;
  private readonly healthService: HealthService;
  private readonly prismaAdminService: PrismaAdminService;
  private readonly gitService: GitService;
  private readonly setupService: SetupService;
  private readonly settingsService: SettingsService;

  constructor() {
    this.customersPath = process.env.CUSTOMERS_PATH || path.join(process.cwd(), "../customers");
    this.customerRepository = CustomerDbRepository.getInstance();
    this.pm2Repository = PM2Repository.getInstance();
    this.envConfigService = new EnvConfigService();
    this.logService = new LogService();
    this.healthService = new HealthService();
    this.prismaAdminService = new PrismaAdminService();
    this.gitService = new GitService();
    this.setupService = new SetupService();
    this.settingsService = new SettingsService();
  }

  /**
   * SettingsService'ten veya environment'tan admin DB config'i alır
   * Production'da settings önceliklidir
   */
  private async getAdminDbConfig() {
    const settings = await this.settingsService.getSettings();
    return {
      host: process.env.DB_HOST || settings.db?.host || "localhost",
      port: parseInt(process.env.DB_PORT || String(settings.db?.port || 5432)),
      user: process.env.DB_USER || settings.db?.user || "postgres",
      password: process.env.DB_PASSWORD || settings.db?.password || "postgres",
    };
  }

  async getAllCustomers(): Promise<Customer[]> {
    try {
      const customers = await this.customerRepository.getAll();

      // Performans optimizasyonu: Paralel işlem
      const enrichedCustomers = await Promise.all(
        customers.map(async (customer) => {
          const [status, resources] = await Promise.all([
            this.pm2Repository.getCustomerStatus(customer.domain),
            this.pm2Repository.calculateCustomerResources(customer.domain)
          ]);

          customer.status = status;
          customer.resources = resources;
          await this.envConfigService.enrichCustomerWithEnvData(customer, this.customersPath);

          return customer;
        })
      );

      return enrichedCustomers;
    } catch (error) {
      console.error("Error reading customers:", error);
      return [];
    }
  }

  async getCustomerById(id: string): Promise<Customer | null> {
    const customer = await this.customerRepository.getById(id);
    if (customer) {
      // Güncel durumu ekle
      customer.status = await this.pm2Repository.getCustomerStatus(customer.domain);
      customer.resources = await this.pm2Repository.calculateCustomerResources(customer.domain);
      await this.envConfigService.enrichCustomerWithEnvData(customer, this.customersPath);
    }
    return customer;
  }

  // Admin CRUD helpers (DB tabanlı repo ile)
  async updateCustomer(id: string, updates: Partial<Customer>) {
    return await this.customerRepository.update(id, updates);
  }

  async getCustomerStatus(domain: string): Promise<"running" | "stopped" | "error"> {
    return await this.pm2Repository.getCustomerStatus(domain);
  }

  async getCustomerResources(domain: string) {
    return await this.pm2Repository.calculateCustomerResources(domain);
  }

  async startCustomer(id: string) {
    const customer = await this.getCustomerById(id);
    if (!customer) throw new Error("Customer not found");

    try {
      await this.pm2Repository.startAllCustomerProcesses(customer.domain);
      return { success: true, message: "Customer started" };
    } catch (error) {
      throw new Error(`Failed to start customer: ${error}`);
    }
  }

  async stopCustomer(id: string) {
    const customer = await this.getCustomerById(id);
    if (!customer) throw new Error("Customer not found");

    try {
      await this.pm2Repository.stopAllCustomerProcesses(customer.domain);
      return { success: true, message: "Customer stopped" };
    } catch (error) {
      throw new Error(`Failed to stop customer: ${error}`);
    }
  }

  async restartCustomer(id: string) {
    const customer = await this.getCustomerById(id);
    if (!customer) throw new Error("Customer not found");

    try {
      await this.pm2Repository.restartAllCustomerProcesses(customer.domain, true);
      return { success: true, message: "Customer restarted" };
    } catch (error) {
      throw new Error(`Failed to restart customer: ${error}`);
    }
  }

  async deleteCustomer(id: string) {
    const customer = await this.getCustomerById(id);
    if (!customer) throw new Error("Customer not found");

    try {
      // PM2 proseslerini durdur
      try {
        await this.pm2Repository.deleteAllCustomerProcesses(customer.domain);
      } catch {
        // ignore
      }

      // Redis anahtarlarını temizle (prefix bazlı)
      try {
        const host = customer.redis?.host || process.env.REDIS_HOST || "localhost";
        const port = customer.redis?.port || parseInt(process.env.REDIS_PORT || "6379");
        const password = customer.redis?.password || process.env.REDIS_PASSWORD || undefined;
        const prefix = customer.redis?.prefix || customer.domain.replace(/\./g, "_");
        const { default: Redis } = await import('ioredis');
        const redis = new Redis({ host, port, password, lazyConnect: true, maxRetriesPerRequest: 0, enableOfflineQueue: false, retryStrategy: () => null } as any);
        await redis.connect().catch(() => {});
        if (redis.status === 'ready') {
          const patterns = [
            `${prefix}:*`,
            `${prefix}_*`,
          ];
          for (const pattern of patterns) {
            let cursor = '0';
            do {
              const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', '1000');
              cursor = next;
              if (keys && keys.length) {
                // pipeline delete for performance
                const pipe = redis.pipeline();
                keys.forEach(k => pipe.del(k));
                await pipe.exec().catch(() => {});
              }
            } while (cursor !== '0');
          }
        }
        try { await redis.quit(); } catch {}
      } catch (e) {
        console.warn("Redis cleanup failed:", e);
      }

      // Müşteri dizinini kaldır
      const customerPath = path.join(this.customersPath, customer.domain.replace(/\./g, "-"));
      await fs.remove(customerPath);

      // Veritabanından kaldır
      await this.customerRepository.delete(id);

      // Production modundaysa nginx config'i kaldır
      try {
        if (customer.mode === "production") {
          const { NginxService } = await import("./nginx.service");
          const nginx = new NginxService();
          await nginx.removeConfig(customer.domain);
        }
      } catch (e) {
        console.error("Failed to remove nginx config:", e);
      }

      // DB bilgisi varsa veritabanını sil
      try {
        if (customer.db?.name) {
          const { SettingsService } = await import("./settings.service");
          const { DatabaseService } = await import("./database.service");
          const settings = new SettingsService();
          const saved = await settings.getSettings();
          const dbAdmin = new DatabaseService({
            host: process.env.DB_HOST || saved.db?.host || "localhost",
            port: parseInt(process.env.DB_PORT || String(saved.db?.port || 5432)),
            user: process.env.DB_USER || saved.db?.user || "postgres",
            password: process.env.DB_PASSWORD || saved.db?.password || "postgres",
          });
          await dbAdmin.dropDatabase(customer.db.name);
        }
      } catch (e) {
        console.error("Failed to drop customer database:", e);
      }

      return { success: true, message: "Customer deleted" };
    } catch (error) {
      throw new Error(`Failed to delete customer: ${error}`);
    }
  }

  async getCustomerLogs(id: string, service: string = 'backend', lines: number = 100) {
    const customer = await this.getCustomerById(id);
    if (!customer) throw new Error("Customer not found");

    return await this.logService.getCustomerLogs(customer.domain, service, lines);
  }

  async getCustomerHealth(id: string) {
    const customer = await this.getCustomerById(id);
    if (!customer) throw new Error("Customer not found");

    return await this.healthService.getCustomerHealth(customer);
  }

  async saveCustomer(customer: Customer) {
    await this.customerRepository.save(customer);
  }

  async getNextAvailablePort(): Promise<number> {
    return await this.customerRepository.getNextAvailablePort();
  }


  async getEnvConfig(customerId: string): Promise<any> {
    const customer = await this.getCustomerById(customerId);
    if (!customer) throw new Error("Customer not found");

    return await this.envConfigService.getEnvConfig(customerId, customer.domain, customer.ports);
  }

  async updateEnvConfig(customerId: string, updates: any): Promise<any> {
    const customer = await this.getCustomerById(customerId);
    if (!customer) throw new Error("Customer not found");

    return await this.envConfigService.updateEnvConfig(customer.domain, updates);
  }

  async restartService(customerId: string, service?: string): Promise<any> {
    const customer = await this.getCustomerById(customerId);
    if (!customer) throw new Error("Customer not found");

    try {
      if (service) {
        const serviceName = `${customer.domain}-${service}`;
        await this.pm2Repository.restartProcess(serviceName, true);
        return {
          success: true,
          message: `Service ${serviceName} restarted successfully`
        };
      } else {
        await this.pm2Repository.restartAllCustomerProcesses(customer.domain, true);
        return {
          success: true,
          message: `All services for ${customer.domain} restarted successfully`
        };
      }
    } catch (error) {
      console.error("Error restarting service:", error);
      throw error;
    }
  }

  async createAdmin(customerId: string, adminData: { email: string; password: string; name?: string }): Promise<any> {
    const customer = await this.getCustomerById(customerId);
    if (!customer) throw new Error("Customer not found");

    return await this.prismaAdminService.createAdmin(customer.domain, adminData);
  }

  async getAdmins(customerId: string): Promise<any> {
    const customer = await this.getCustomerById(customerId);
    if (!customer) throw new Error("Customer not found");

    return await this.prismaAdminService.getAdmins(customer.domain);
  }

  async runPrismaGenerate(customerId: string): Promise<any> {
    const customer = await this.getCustomerById(customerId);
    if (!customer) throw new Error("Customer not found");

    return await this.prismaAdminService.runPrismaGenerate(customer.domain);
  }

  async runPrismaDbPush(customerId: string): Promise<any> {
    const customer = await this.getCustomerById(customerId);
    if (!customer) throw new Error("Customer not found");

    // Prisma db push öncesi ownership'leri otomatik düzelt
    if (customer.db?.name && customer.db?.user) {
      try {
        console.log(`Fixing database ownership for ${customer.domain}...`);

        // Admin DB config'i settings'ten al
        const adminDbConfig = await this.getAdminDbConfig();
        const databaseService = new DatabaseService(adminDbConfig);

        const fixResult = await databaseService.fixDatabaseOwnership(
          customer.db.name,
          customer.db.user
        );
        if (fixResult.success) {
          console.log(`Ownership fixed: ${fixResult.message}`);
        } else {
          console.warn(`Ownership fix warning: ${fixResult.message}`);
        }
      } catch (error: any) {
        console.warn("Ownership fix failed, continuing with db push:", error.message);
      }
    }

    return await this.prismaAdminService.runPrismaDbPush(customer.domain, true);
  }

  async runPrismaMigrate(customerId: string): Promise<any> {
    const customer = await this.getCustomerById(customerId);
    if (!customer) throw new Error("Customer not found");

    return await this.prismaAdminService.runPrismaMigrate(customer.domain);
  }

  async runSeed(customerId: string, opts?: { type?: 'essential' | 'demo'; path?: string }): Promise<any> {
    const customer = await this.getCustomerById(customerId);
    if (!customer) throw new Error("Customer not found");

    return await this.prismaAdminService.runSeed(customer.domain, opts);
  }

  async getDeploymentInfo(customerId: string): Promise<DeploymentMetadata | null> {
    const customer = await this.getCustomerById(customerId);
    if (!customer) throw new Error("Customer not found");
    return await this.gitService.getMetadata(customer.domain);
  }

  async updateFromGit(customerId: string, options: GitUpdateOptions & { repoUrl?: string }): Promise<any> {
    const customer = await this.getCustomerById(customerId);
    if (!customer) throw new Error("Customer not found");

    this.setupService.emitProgress(customer.domain, "git", "Git deposu güncelleniyor...");
    const result = await this.gitService.updateRepository(customer.domain, options);
    this.setupService.emitProgress(
      customer.domain,
      "git",
      `Güncellendi: ${result.commit ? result.commit.substring(0, 7) : ""}${result.branch ? ` (${result.branch})` : ""}`.trim()
    );

    return {
      success: true,
      message: "Git deposu güncellendi",
      branch: result.branch,
      commit: result.commit
    };
  }

  async installDependencies(customerId: string): Promise<any> {
    const customer = await this.getCustomerById(customerId);
    if (!customer) throw new Error("Customer not found");

    return await this.setupService.installDependencies(customer.domain);
  }

  async buildApplications(customerId: string, options?: { heapMB?: number; skipTypeCheck?: boolean }): Promise<any> {
    const customer = await this.getCustomerById(customerId);
    if (!customer) throw new Error("Customer not found");
    const isLocal = customer.mode === "local";
    return await this.setupService.buildApplications(
      customer.domain,
      isLocal,
      undefined,
      options
    );
  }

  /**
   * Veritabanı ownership'lerini manuel olarak düzeltir
   * Git güncellemesi sonrası Prisma hatalarını çözmek için kullanılır
   */
  async fixDatabaseOwnership(customerId: string): Promise<any> {
    const customer = await this.getCustomerById(customerId);
    if (!customer) throw new Error("Customer not found");

    if (!customer.db?.name || !customer.db?.user) {
      return {
        success: false,
        message: "Veritabanı bilgileri eksik"
      };
    }

    try {
      // Admin DB config'i settings'ten al
      const adminDbConfig = await this.getAdminDbConfig();
      const databaseService = new DatabaseService(adminDbConfig);

      const result = await databaseService.fixDatabaseOwnership(
        customer.db.name,
        customer.db.user
      );

      return {
        success: result.success,
        message: result.message,
        fixed: result.fixed
      };
    } catch (error: any) {
      console.error("Database ownership fix failed:", error);
      return {
        success: false,
        message: error.message || "Ownership fix başarısız"
      };
    }
  }

  /**
   * Remote Git repository'deki branch listesini getirir
   */
  async listGitBranches(customerId: string): Promise<string[]> {
    const customer = await this.getCustomerById(customerId);
    if (!customer) throw new Error("Customer not found");

    return await this.gitService.listRemoteBranches(customer.domain);
  }
}
