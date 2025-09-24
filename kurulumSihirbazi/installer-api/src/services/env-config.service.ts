import fs from "fs-extra";
import path from "path";
import { parse as parseDotenv } from "dotenv";
import { EnvConfig } from "../types/customer.types";

export class EnvConfigService {
  private readonly customersPath: string;

  constructor() {
    this.customersPath = process.env.CUSTOMERS_PATH || path.join(process.cwd(), "../customers");
  }

  async getEnvConfig(customerId: string, domain: string, ports: any): Promise<any> {
    const customerPath = path.join(this.customersPath, domain.replace(/\./g, "-"));
    const services = ["backend", "admin", "store"];
    const config: EnvConfig = {};

    for (const service of services) {
      const envPath = path.join(customerPath, service, ".env");
      if (await fs.pathExists(envPath)) {
        const envContent = await fs.readFile(envPath, "utf8");
        const parsed = parseDotenv(envContent);

        // Hassas bilgileri gizleyerek önemli config değişkenlerini döndür
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
      domain,
      ports,
      config
    };
  }

  async updateEnvConfig(domain: string, updates: any): Promise<any> {
    const customerPath = path.join(this.customersPath, domain.replace(/\./g, "-"));
    const results: any = {};

    // Her servisin env dosyasını güncelle
    for (const [service, envUpdates] of Object.entries(updates)) {
      if (!envUpdates || typeof envUpdates !== 'object') continue;

      const envPath = path.join(customerPath, service, ".env");
      if (await fs.pathExists(envPath)) {
        // Mevcut env'yi oku
        const envContent = await fs.readFile(envPath, "utf8");
        const lines = envContent.split("\n");
        const newLines: string[] = [];
        const updatedKeys = new Set<string>();

        // Mevcut anahtarları güncelle
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

        // Mevcut olmayan yeni anahtarları ekle
        for (const [key, value] of Object.entries(envUpdates as any)) {
          if (!updatedKeys.has(key)) {
            newLines.push(`${key}=${value}`);
          }
        }

        // Geri yaz
        await fs.writeFile(envPath, newLines.join("\n"));
        results[service] = { success: true, updated: Object.keys(envUpdates as any).length };
      }
    }

    return {
      success: true,
      results,
      message: "Environment configuration updated successfully"
    };
  }

  async enrichCustomerWithEnvData(customer: any, customersPath: string): Promise<void> {
    // Mode bilgisini doldur
    if (!customer.mode) {
      customer.mode = (!customer.domain.includes('.') || customer.domain.endsWith('.local'))
        ? 'local'
        : 'production';
    }

    // DB/Redis bilgisi zaten varsa atla
    if (customer.db && customer.redis) return;

    // Backend .env'den parse etmeyi dene
    const customerPath = path.join(customersPath, customer.domain.replace(/\./g, "-"));
    const backendEnvPath = path.join(customerPath, "backend", ".env");

    try {
      if (await fs.pathExists(backendEnvPath)) {
        const raw = await fs.readFile(backendEnvPath, "utf-8");
        const env = parseDotenv(raw);

        // DATABASE_URL'i parse et: postgresql://user:pass@host:port/dbName?schema=public
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

        // Redis bilgileri
        const rh = env["REDIS_HOST"];
        const rp = env["REDIS_PORT"];
        const rpref = env["REDIS_PREFIX"];
        if (rh || rp || rpref) {
          customer.redis = {
            host: rh || "localhost",
            port: rp ? Number(rp) : 6379,
            prefix: rpref,
          };
        }
      }
    } catch (e) {
      // Kritik olmayan hata
      console.error("Error enriching customer with env data:", e);
    }
  }

  private parseDatabaseUrl(urlStr: string): {
    user: string;
    password?: string;
    host: string;
    port: number;
    database: string;
    schema?: string;
  } | null {
    try {
      // Tırnak işaretlerini temizle
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