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

export class CustomerService {
  private readonly customersPath: string;
  private readonly customerRepository: CustomerDbRepository;
  private readonly pm2Repository: PM2Repository;
  private readonly envConfigService: EnvConfigService;
  private readonly logService: LogService;
  private readonly healthService: HealthService;
  private readonly prismaAdminService: PrismaAdminService;

  constructor() {
    this.customersPath = process.env.CUSTOMERS_PATH || path.join(process.cwd(), "../customers");
    this.customerRepository = CustomerDbRepository.getInstance();
    this.pm2Repository = PM2Repository.getInstance();
    this.envConfigService = new EnvConfigService();
    this.logService = new LogService();
    this.healthService = new HealthService();
    this.prismaAdminService = new PrismaAdminService();
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

    return await this.prismaAdminService.runPrismaDbPush(customer.domain, true);
  }

  async runPrismaMigrate(customerId: string): Promise<any> {
    const customer = await this.getCustomerById(customerId);
    if (!customer) throw new Error("Customer not found");

    return await this.prismaAdminService.runPrismaMigrate(customer.domain);
  }

  async runSeed(customerId: string): Promise<any> {
    const customer = await this.getCustomerById(customerId);
    if (!customer) throw new Error("Customer not found");

    return await this.prismaAdminService.runSeed(customer.domain);
  }
}
