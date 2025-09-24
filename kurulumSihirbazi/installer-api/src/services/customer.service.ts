import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs-extra";
import path from "path";
import { parse as parseDotenv } from "dotenv";
import { parseJsonFromMixedOutput } from "../utils/json-utils";

const execAsync = promisify(exec);
import { detectPm2 } from "../utils/pm2-utils";

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
  private customersPath = process.env.CUSTOMERS_PATH || path.join(process.cwd(), "../customers");
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
      const info = await detectPm2();
      const bin = info?.bin || "pm2";
      const { stdout } = await execAsync(`${bin} jlist`);
      const processes = parseJsonFromMixedOutput(stdout);

      const names = [`${domain}-backend`, `${domain}-admin`, `${domain}-store`];
      const matches = processes.filter((p: any) => names.includes(p.name));
      if (matches.length === 0) return "stopped";
      const anyOnline = matches.some((p: any) => p.pm2_env?.status === 'online');
      const anyErrored = matches.some((p: any) => p.pm2_env?.status === 'errored' || p.pm2_env?.status === 'stopped');
      if (anyOnline) return "running";
      if (anyErrored) return "error";
      return "stopped";
    } catch {
      return "stopped";
    }
  }

  async getCustomerResources(domain: string) {
    try {
      const info = await detectPm2();
      const bin = info?.bin || "pm2";
      const { stdout } = await execAsync(`${bin} jlist`);
      const processes = parseJsonFromMixedOutput(stdout);

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
      const { PM2Service } = await import("./pm2.service");
      const pm2 = new PM2Service();
      await pm2.startCustomer(customer.domain);
      return { success: true, message: "Customer started" };
    } catch (error) {
      throw new Error(`Failed to start customer: ${error}`);
    }
  }

  async stopCustomer(id: string) {
    const customer = await this.getCustomerById(id);
    if (!customer) throw new Error("Customer not found");

    try {
      const { PM2Service } = await import("./pm2.service");
      const pm2 = new PM2Service();
      await pm2.stopCustomer(customer.domain);
      return { success: true, message: "Customer stopped" };
    } catch (error) {
      throw new Error(`Failed to stop customer: ${error}`);
    }
  }

  async restartCustomer(id: string) {
    const customer = await this.getCustomerById(id);
    if (!customer) throw new Error("Customer not found");

    try {
      const { PM2Service } = await import("./pm2.service");
      const pm2 = new PM2Service();
      await pm2.restartCustomer(customer.domain);
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
      try {
        const { PM2Service } = await import("./pm2.service");
        const pm2 = new PM2Service();
        await pm2.deleteCustomer(customer.domain);
      } catch {
        // ignore
      }

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

    // PM2 kurulu mu kontrol et
    const isPM2Available = await this.checkPM2Available();

    if (isPM2Available) {
      // PM2 varsa PM2 loglarını kullan, boşsa dosyaya fallback yap
      try {
        const processName = `${customer.domain}-${service}`;
        const info = await detectPm2();
        const bin = info?.bin || "pm2";
        const { stdout } = await execAsync(`${bin} logs ${processName} --lines ${lines} --nostream`);
        const trimmed = (stdout || "").trim();
        if (trimmed.length > 0) {
          return { logs: stdout, service, processName };
        }
        // fallthrough to file read
      } catch (error) {
        // fallthrough to file read
      }
    }

    // PM2 yoksa veya log komutu başarısız/boş ise dosyadan oku
    try {
      const customerPath = path.join(this.customersPath, customer.domain.replace(/\./g, "-"));
      const logDir = path.join(customerPath, "logs");
      const logFileOut = path.join(logDir, `${customer.domain}-${service}-out.log`);
      const logFileErr = path.join(logDir, `${customer.domain}-${service}-error.log`);

      await fs.ensureDir(logDir);

      const hasOut = await fs.pathExists(logFileOut);
      const hasErr = await fs.pathExists(logFileErr);

      if (!hasOut && !hasErr) {
        return {
          logs: `Log dosyaları henüz oluşmamış. Servis yeni başlıyorsa birkaç saniye bekleyin.\nBeklenen dosyalar:\n- ${logFileOut}\n- ${logFileErr}`,
          service,
          processName: `${customer.domain}-${service}`,
        };
      }

      let collected = "";
      if (hasOut) {
        const { stdout } = await execAsync(`tail -n ${lines} "${logFileOut}"`);
        collected += `# OUT (${logFileOut})\n${stdout}\n`;
      }
      if (hasErr) {
        const { stdout } = await execAsync(`tail -n ${lines} "${logFileErr}"`);
        collected += `# ERROR (${logFileErr})\n${stdout}\n`;
      }

      return {
        logs: collected.trim() || "Log dosyaları boş",
        service,
        processName: `${customer.domain}-${service}`,
      };
    } catch (error) {
      return {
        logs: `Log okuma hatası: ${error}`,
        service,
        processName: `${customer.domain}-${service}`,
      };
    }
  }

  private async checkPM2Available(): Promise<boolean> {
    try {
      const info = await detectPm2();
      return !!info;
    } catch {
      return false;
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
      const info = await detectPm2();
      const bin = info?.bin || "pm2";
      const { stdout } = await execAsync(`${bin} jlist`);
      const processes = parseJsonFromMixedOutput(stdout);

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

  async getEnvConfig(customerId: string): Promise<any> {
    try {
      const customer = await this.getCustomerById(customerId);
      if (!customer) throw new Error("Customer not found");

      const customerPath = path.join(this.customersPath, customer.domain);
      const services = ["backend", "admin", "store"];
      const config: any = {};

      for (const service of services) {
        const envPath = path.join(customerPath, service, ".env");
        if (await fs.pathExists(envPath)) {
          const envContent = await fs.readFile(envPath, "utf8");
          const parsed = parseDotenv(envContent);

          // Only return important config vars, not secrets
          config[service] = {
            NODE_ENV: parsed.NODE_ENV,
            PORT: parsed.PORT,
            DATABASE_URL: parsed.DATABASE_URL ? "***HIDDEN***" : undefined,
            NEXT_PUBLIC_API_URL: parsed.NEXT_PUBLIC_API_URL,
            NEXT_PUBLIC_API_BASE_URL: parsed.NEXT_PUBLIC_API_BASE_URL,
            NEXT_PUBLIC_BACKEND_PORT: parsed.NEXT_PUBLIC_BACKEND_PORT,
            NEXT_PUBLIC_APP_URL: parsed.NEXT_PUBLIC_APP_URL,
            NEXT_PUBLIC_STORE_URL: parsed.NEXT_PUBLIC_STORE_URL,
            NEXT_PUBLIC_PROD_API_URL: parsed.NEXT_PUBLIC_PROD_API_URL,
            NEXT_PUBLIC_PROD_APP_URL: parsed.NEXT_PUBLIC_PROD_APP_URL,
            NEXT_PUBLIC_PROD_STORE_URL: parsed.NEXT_PUBLIC_PROD_STORE_URL,
            APP_URL: parsed.APP_URL,
            STORE_URL: parsed.STORE_URL,
            ADMIN_URL: parsed.ADMIN_URL,
            REDIS_HOST: parsed.REDIS_HOST,
            REDIS_PORT: parsed.REDIS_PORT,
            STORE_NAME: parsed.STORE_NAME,
          };
        }
      }

      return {
        customerId,
        domain: customer.domain,
        ports: customer.ports,
        config
      };
    } catch (error) {
      console.error("Error getting env config:", error);
      throw error;
    }
  }

  async updateEnvConfig(customerId: string, updates: any): Promise<any> {
    try {
      const customer = await this.getCustomerById(customerId);
      if (!customer) throw new Error("Customer not found");

      const customerPath = path.join(this.customersPath, customer.domain);
      const results: any = {};

      // Update each service's env file
      for (const [service, envUpdates] of Object.entries(updates)) {
        if (!envUpdates || typeof envUpdates !== 'object') continue;

        const envPath = path.join(customerPath, service, ".env");
        if (await fs.pathExists(envPath)) {
          // Read existing env
          const envContent = await fs.readFile(envPath, "utf8");
          const lines = envContent.split("\n");
          const newLines: string[] = [];
          const updatedKeys = new Set<string>();

          // Update existing keys
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("#") || trimmed === "") {
              newLines.push(line);
              continue;
            }

            const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
            if (!match) {
              newLines.push(line);
              continue;
            }

            const key = match[1];
            if ((envUpdates as any).hasOwnProperty(key)) {
              newLines.push(`${key}=${(envUpdates as any)[key]}`);
              updatedKeys.add(key);
            } else {
              newLines.push(line);
            }
          }

          // Append new keys that weren't present
          for (const [key, value] of Object.entries(envUpdates as any)) {
            if (!updatedKeys.has(key)) {
              newLines.push(`${key}=${value}`);
            }
          }

          // Write back
          await fs.writeFile(envPath, newLines.join("\n"));
          results[service] = { success: true, updated: Object.keys(envUpdates as any).length };
        }
      }

      return {
        success: true,
        results,
        message: "Environment configuration updated successfully"
      };
    } catch (error) {
      console.error("Error updating env config:", error);
      throw error;
    }
  }

  async restartService(customerId: string, service?: string): Promise<any> {
    try {
      const customer = await this.getCustomerById(customerId);
      if (!customer) throw new Error("Customer not found");

      const info = await detectPm2();
      const pm2Bin = info?.bin || "pm2";

      if (service) {
        // Restart specific service
        const serviceName = `${customer.domain}-${service}`;
        await execAsync(`${pm2Bin} restart ${serviceName} --update-env`);
        return {
          success: true,
          message: `Service ${serviceName} restarted successfully`
        };
      } else {
        // Restart all services for the customer
        const services = ["backend", "admin", "store"];
        for (const svc of services) {
          const serviceName = `${customer.domain}-${svc}`;
          await execAsync(`${pm2Bin} restart ${serviceName} --update-env`);
        }
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
}
