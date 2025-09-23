import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs-extra";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { parse as parseDotenv } from "dotenv";

const execAsync = promisify(exec);

export interface Customer {
  id: string;
  domain: string;
  status: "running" | "stopped" | "error";
  createdAt: string;
  ports: {
    backend: number;
    admin: number;
    store: number;
  };
  resources: {
    cpu: number;
    memory: number;
  };
  mode?: "local" | "production";
  db?: {
    name: string;
    user: string;
    host: string;
    port: number;
    schema?: string;
  };
  redis?: {
    host: string;
    port: number;
    prefix?: string;
  };
}

export class CustomerService {
  private customersPath = process.env.CUSTOMERS_PATH || "/var/qodify/customers";
  private customerDataPath = path.join(process.cwd(), "data", "customers.json");

  constructor() {
    this.ensureDataDirectory();
  }

  private async ensureDataDirectory() {
    await fs.ensureDir(path.dirname(this.customerDataPath));
    if (!(await fs.pathExists(this.customerDataPath))) {
      await fs.writeJson(this.customerDataPath, []);
    }
  }

  async getAllCustomers(): Promise<Customer[]> {
    try {
      const customers = await fs.readJson(this.customerDataPath);

      // Update status for each customer
      for (const customer of customers) {
        customer.status = await this.getCustomerStatus(customer.domain);
        customer.resources = await this.getCustomerResources(customer.domain);
        await this.enrichCustomerRuntimeInfo(customer);
      }

      return customers;
    } catch (error) {
      console.error("Error reading customers:", error);
      return [];
    }
  }

  async getCustomerById(id: string): Promise<Customer | null> {
    const customers = await this.getAllCustomers();
    return customers.find(c => c.id === id) || null;
  }

  async getCustomerStatus(domain: string): Promise<"running" | "stopped" | "error"> {
    try {
      const { stdout } = await execAsync(`pm2 list | grep ${domain}`);
      if (stdout.includes("online")) return "running";
      if (stdout.includes("stopped")) return "stopped";
      return "error";
    } catch {
      return "stopped";
    }
  }

  async getCustomerResources(domain: string) {
    try {
      const { stdout } = await execAsync(`pm2 jlist`);
      const processes = JSON.parse(stdout);

      const customerProcesses = processes.filter((p: any) =>
        p.name.startsWith(domain)
      );

      if (customerProcesses.length === 0) {
        return { cpu: 0, memory: 0 };
      }

      let totalCpu = 0;
      let totalMemory = 0;

      customerProcesses.forEach((p: any) => {
        totalCpu += p.monit?.cpu || 0;
        totalMemory += p.monit?.memory || 0;
      });

      return {
        cpu: Math.round(totalCpu * 10) / 10,
        memory: Math.round(totalMemory / (1024 * 1024)), // Convert to MB
      };
    } catch {
      return { cpu: 0, memory: 0 };
    }
  }

  async startCustomer(id: string) {
    const customer = await this.getCustomerById(id);
    if (!customer) throw new Error("Customer not found");

    try {
      await execAsync(`pm2 start ecosystem-${customer.domain}.config.js`);
      return { success: true, message: "Customer started" };
    } catch (error) {
      throw new Error(`Failed to start customer: ${error}`);
    }
  }

  async stopCustomer(id: string) {
    const customer = await this.getCustomerById(id);
    if (!customer) throw new Error("Customer not found");

    try {
      await execAsync(`pm2 stop ${customer.domain}-backend ${customer.domain}-admin ${customer.domain}-store`);
      return { success: true, message: "Customer stopped" };
    } catch (error) {
      throw new Error(`Failed to stop customer: ${error}`);
    }
  }

  async restartCustomer(id: string) {
    const customer = await this.getCustomerById(id);
    if (!customer) throw new Error("Customer not found");

    try {
      await execAsync(`pm2 restart ${customer.domain}-backend ${customer.domain}-admin ${customer.domain}-store`);
      return { success: true, message: "Customer restarted" };
    } catch (error) {
      throw new Error(`Failed to restart customer: ${error}`);
    }
  }

  async deleteCustomer(id: string) {
    const customer = await this.getCustomerById(id);
    if (!customer) throw new Error("Customer not found");

    try {
      // Stop PM2 processes
      await execAsync(`pm2 delete ${customer.domain}-backend ${customer.domain}-admin ${customer.domain}-store`).catch(() => {});

      // Remove customer directory
      const customerPath = path.join(this.customersPath, customer.domain.replace(/\./g, "-"));
      await fs.remove(customerPath);

      // Remove from database
      const customers = await fs.readJson(this.customerDataPath);
      const updatedCustomers = customers.filter((c: Customer) => c.id !== id);
      await fs.writeJson(this.customerDataPath, updatedCustomers);

      // Remove nginx config if production mode
      try {
        if (customer.mode === "production") {
          const { NginxService } = await import("./nginx.service");
          const nginx = new NginxService();
          await nginx.removeConfig(customer.domain);
        }
      } catch (e) {
        console.error("Failed to remove nginx config:", e);
      }

      // Drop database if db info present
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

    const validServices = ['backend', 'admin', 'store'];
    if (!validServices.includes(service)) {
      throw new Error(`Invalid service. Must be one of: ${validServices.join(', ')}`);
    }

    try {
      const processName = `${customer.domain}-${service}`;
      const { stdout } = await execAsync(`pm2 logs ${processName} --lines ${lines} --nostream`);
      return {
        logs: stdout,
        service,
        processName
      };
    } catch (error) {
      return {
        logs: `Failed to get logs for ${service}: ${error}`,
        service,
        processName: `${customer.domain}-${service}`
      };
    }
  }

  async getCustomerHealth(id: string) {
    const customer = await this.getCustomerById(id);
    if (!customer) throw new Error("Customer not found");

    const health: any = {
      backend: { status: 'unknown', url: '', error: null },
      admin: { status: 'unknown', url: '', error: null },
      store: { status: 'unknown', url: '', error: null }
    };

    // Check PM2 processes first
    try {
      const { stdout } = await execAsync(`pm2 jlist`);
      const processes = JSON.parse(stdout);

      const backendProcess = processes.find((p: any) => p.name === `${customer.domain}-backend`);
      const adminProcess = processes.find((p: any) => p.name === `${customer.domain}-admin`);
      const storeProcess = processes.find((p: any) => p.name === `${customer.domain}-store`);

      if (!backendProcess || backendProcess.pm2_env.status !== 'online') {
        health.backend.status = 'stopped';
        health.backend.error = 'PM2 process not running';
      }
      if (!adminProcess || adminProcess.pm2_env.status !== 'online') {
        health.admin.status = 'stopped';
        health.admin.error = 'PM2 process not running';
      }
      if (!storeProcess || storeProcess.pm2_env.status !== 'online') {
        health.store.status = 'stopped';
        health.store.error = 'PM2 process not running';
      }
    } catch (error) {
      console.error('Failed to check PM2 status:', error);
    }

    // Check actual HTTP endpoints if processes are running
    const baseUrl = customer.mode === 'local' ? 'http://localhost' : `https://${customer.domain}`;

    // Backend health check
    if (health.backend.status !== 'stopped') {
      health.backend.url = customer.mode === 'local' ? `${baseUrl}:${customer.ports.backend}/health` : `${baseUrl}/api/health`;
      try {
        const { stdout } = await execAsync(`curl -s -o /dev/null -w "%{http_code}" ${health.backend.url}`);
        health.backend.status = stdout === '200' ? 'healthy' : 'error';
        health.backend.httpCode = parseInt(stdout);
      } catch (error) {
        health.backend.status = 'error';
        health.backend.error = `Health check failed: ${error}`;
      }
    }

    // Admin health check
    if (health.admin.status !== 'stopped') {
      health.admin.url = customer.mode === 'local' ? `${baseUrl}:${customer.ports.admin}` : `${baseUrl}/admin`;
      try {
        const { stdout } = await execAsync(`curl -s -o /dev/null -w "%{http_code}" ${health.admin.url}`);
        health.admin.status = ['200', '404'].includes(stdout) ? 'healthy' : 'error';
        health.admin.httpCode = parseInt(stdout);
      } catch (error) {
        health.admin.status = 'error';
        health.admin.error = `Health check failed: ${error}`;
      }
    }

    // Store health check
    if (health.store.status !== 'stopped') {
      health.store.url = customer.mode === 'local' ? `${baseUrl}:${customer.ports.store}` : baseUrl;
      try {
        const { stdout } = await execAsync(`curl -s -o /dev/null -w "%{http_code}" ${health.store.url}`);
        health.store.status = stdout === '200' ? 'healthy' : 'error';
        health.store.httpCode = parseInt(stdout);
      } catch (error) {
        health.store.status = 'error';
        health.store.error = `Health check failed: ${error}`;
      }
    }

    return health;
  }

  async saveCustomer(customer: Customer) {
    const customers = await fs.readJson(this.customerDataPath);
    customers.push(customer);
    await fs.writeJson(this.customerDataPath, customers);
  }

  async getNextAvailablePort(): Promise<number> {
    const customers = await this.getAllCustomers();
    const usedPorts = customers.flatMap(c => [c.ports.backend, c.ports.admin, c.ports.store]);

    let basePort = 4000;
    while (usedPorts.includes(basePort) ||
           usedPorts.includes(basePort + 1) ||
           usedPorts.includes(basePort + 2)) {
      basePort += 3;
    }

    return basePort;
  }

  private async enrichCustomerRuntimeInfo(customer: Customer) {
    // Fill mode if missing
    if (!customer.mode) {
      customer.mode = (!customer.domain.includes('.') || customer.domain.endsWith('.local')) ? 'local' : 'production';
    }

    // If DB/Redis info already present, skip
    if (customer.db && customer.redis) return;

    // Try to parse from backend .env
    const customerPath = path.join(this.customersPath, customer.domain.replace(/\./g, "-"));
    const backendEnvPath = path.join(customerPath, "backend", ".env");
    try {
      if (await fs.pathExists(backendEnvPath)) {
        const raw = await fs.readFile(backendEnvPath, "utf-8");
        const env = parseDotenv(raw);

        // Parse DATABASE_URL: postgresql://user:pass@host:port/dbName?schema=public
        const dbUrl = env["DATABASE_URL"]; 
        if (dbUrl) {
          const parsed = this.parseDatabaseUrl(dbUrl);
          if (parsed) {
            customer.db = {
              name: parsed.database,
              user: parsed.user,
              host: parsed.host,
              port: parsed.port,
              schema: parsed.schema || "public",
            };
          }
        }

        // Redis
        const rh = env["REDIS_HOST"]; 
        const rp = env["REDIS_PORT"]; 
        const rpref = env["REDIS_PREFIX"]; 
        if (rh || rp || rpref) {
          customer.redis = {
            host: rh || "localhost",
            port: rp ? Number(rp) : 6379,
            prefix: rpref,
          } as any;
        }
      }
    } catch (e) {
      // non-fatal
    }
  }

  private parseDatabaseUrl(urlStr: string): { user: string; password?: string; host: string; port: number; database: string; schema?: string } | null {
    try {
      // Strip quotes if present
      const clean = urlStr.replace(/^"|"$/g, "");
      const u = new URL(clean);
      const user = decodeURIComponent(u.username);
      const password = decodeURIComponent(u.password);
      const host = u.hostname;
      const port = Number(u.port || 5432);
      const database = (u.pathname || "/").replace(/^\//, "");
      const schema = u.searchParams.get("schema") || undefined;
      return { user, password, host, port, database, schema };
    } catch (e) {
      return null;
    }
  }
}
