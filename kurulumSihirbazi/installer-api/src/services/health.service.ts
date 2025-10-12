import { exec } from "child_process";
import { promisify } from "util";
import { CustomerHealth, ServiceHealth } from "../types/customer.types";
import { PM2Repository } from "../repositories/pm2.repository";

const execAsync = promisify(exec);

export class HealthService {
  private pm2Repository: PM2Repository;
  private healthCache: Map<string, { data: CustomerHealth; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 30000; // 30 saniye cache

  constructor() {
    this.pm2Repository = PM2Repository.getInstance();
  }

  async getCustomerHealth(customer: any): Promise<CustomerHealth> {
    const cacheKey = customer.id;

    // Cache kontrolü
    const cached = this.healthCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    const health: CustomerHealth = {
      backend: { status: 'unknown', url: '', error: null },
      admin: { status: 'unknown', url: '', error: null },
      store: { status: 'unknown', url: '', error: null }
    };

    // PM2 process durumunu kontrol et
    await this.checkPM2Status(customer.domain, health);

    // HTTP endpoint'lerini kontrol et
    await this.checkHttpEndpoints(customer, health);

    // Redis bağlantısını kontrol et
    if (customer.redis) {
      await this.checkCustomerRedisHealth(customer.redis, health);
    }

    // Cache'i güncelle
    this.healthCache.set(cacheKey, {
      data: health,
      timestamp: Date.now()
    });

    return health;
  }

  private async checkPM2Status(domain: string, health: CustomerHealth): Promise<void> {
    try {
      const processes = await this.pm2Repository.getCustomerProcesses(domain);

      const backendProcess = processes.find(p => p.name === `${domain}-backend`);
      const adminProcess = processes.find(p => p.name === `${domain}-admin`);
      const storeProcess = processes.find(p => p.name === `${domain}-store`);

      this.updateServiceStatusFromPM2(health.backend, backendProcess);
      this.updateServiceStatusFromPM2(health.admin, adminProcess);
      this.updateServiceStatusFromPM2(health.store, storeProcess);
    } catch (error) {
      console.error('Failed to check PM2 status:', error);
    }
  }

  private updateServiceStatusFromPM2(service: ServiceHealth, process: any): void {
    if (!process || process.pm2_env?.status !== 'online') {
      service.status = 'stopped';
      service.error = 'PM2 process not running';
    }
  }

  private async checkHttpEndpoints(customer: any, health: CustomerHealth): Promise<void> {
    const baseUrl = customer.mode === 'local'
      ? 'http://localhost'
      : `https://${customer.domain}`;

    // Backend kontrolü
    if (health.backend.status !== 'stopped') {
      health.backend.url = customer.mode === 'local'
        ? `${baseUrl}:${customer.ports.backend}/api/health`
        : `${baseUrl}/api/health`;
      await this.checkEndpoint(health.backend);
    }

    // Admin kontrolü
    if (health.admin.status !== 'stopped') {
      health.admin.url = customer.mode === 'local'
        ? `${baseUrl}:${customer.ports.admin}/admin/login`
        : `${baseUrl}/admin/login`;
      await this.checkEndpoint(health.admin, ['200', '302', '301']);
    }

    // Store kontrolü
    if (health.store.status !== 'stopped') {
      health.store.url = customer.mode === 'local'
        ? `${baseUrl}:${customer.ports.store}`
        : baseUrl;
      await this.checkEndpoint(health.store);
    }
  }

  private async checkEndpoint(
    service: ServiceHealth,
    validCodes: string[] = ['200']
  ): Promise<void> {
    try {
      const { stdout } = await execAsync(
        `curl -s -o /dev/null -w "%{http_code}" "${service.url}" --connect-timeout 5 --max-time 10 -L`
      );
      const httpCode = parseInt(stdout.trim());
      service.httpCode = httpCode;
      service.status = validCodes.includes(stdout.trim()) ? 'healthy' : 'error';

      if (service.status === 'error') {
        service.error = `HTTP ${httpCode}`;
      }
    } catch (error) {
      service.status = 'error';
      service.error = `Health check failed: ${error}`;
    }
  }

  private async checkCustomerRedisHealth(redisConfig: any, health: CustomerHealth): Promise<void> {
    try {
      const result = await this.checkRedisConnection(redisConfig);

      if (!result.connected) {
        console.error('[Redis Health Check] Bağlantı başarısız:', {
          host: redisConfig.host,
          port: redisConfig.port,
          error: result.error
        });
      }

      health.redis = {
        status: result.connected ? 'healthy' : 'error',
        url: `${redisConfig.host}:${redisConfig.port}`,
        error: result.error || null
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Redis Health Check] Beklenmeyen hata:', {
        host: redisConfig.host,
        port: redisConfig.port,
        error: errorMessage
      });

      health.redis = {
        status: 'error',
        url: `${redisConfig.host}:${redisConfig.port}`,
        error: `Beklenmeyen hata: ${errorMessage}`
      };
    }
  }

  async performHealthCheck(url: string): Promise<{
    healthy: boolean;
    statusCode?: number;
    error?: string;
  }> {
    try {
      const { stdout } = await execAsync(
        `curl -s -o /dev/null -w "%{http_code}" "${url}" --connect-timeout 5`
      );
      const statusCode = parseInt(stdout);
      return {
        healthy: statusCode === 200,
        statusCode
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async checkServiceAvailability(host: string, port: number): Promise<boolean> {
    try {
      const { stdout } = await execAsync(
        `nc -z -w 2 ${host} ${port} && echo "open" || echo "closed"`
      );
      return stdout.trim() === 'open';
    } catch {
      return false;
    }
  }

  async checkDatabaseConnection(dbConfig: any): Promise<{
    connected: boolean;
    error?: string;
  }> {
    try {
      const { host, port, user, database } = dbConfig;
      const { stdout } = await execAsync(
        `PGPASSWORD="${dbConfig.password}" psql -h ${host} -p ${port} -U ${user} -d ${database} -c "SELECT 1" -t`
      );
      return {
        connected: stdout.trim() === '1'
      };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async checkRedisConnection(redisConfig: any): Promise<{
    connected: boolean;
    error?: string;
  }> {
    const { host, port, password } = redisConfig;

    try {
      // Environment variable kullanarak şifreyi güvenli şekilde geç
      const env = password ? { ...process.env, REDISCLI_AUTH: password } : process.env;
      const command = `redis-cli -h ${host} -p ${port} ping`;

      const { stdout, stderr } = await execAsync(command, { env });

      const response = stdout.trim();

      // NOAUTH hatası kontrolü
      if (stderr && stderr.includes('NOAUTH')) {
        return {
          connected: false,
          error: 'Authentication required (NOAUTH)'
        };
      }

      if (response === 'PONG') {
        return { connected: true };
      } else {
        return {
          connected: false,
          error: `Beklenmeyen yanıt: ${response}${stderr ? ` | stderr: ${stderr}` : ''}`
        };
      }
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const stderr = error.stderr ? String(error.stderr).trim() : '';

      // NOAUTH hatası kontrolü
      if (stderr.includes('NOAUTH')) {
        return {
          connected: false,
          error: 'Beklenmeyen yanıt: NOAUTH Authentication required.'
        };
      }

      const detailedError = stderr
        ? `${errorMessage} | ${stderr}`
        : errorMessage;

      return {
        connected: false,
        error: `Redis bağlantı hatası (${host}:${port}): ${detailedError}`
      };
    }
  }

  clearCache(customerId?: string): void {
    if (customerId) {
      this.healthCache.delete(customerId);
    } else {
      this.healthCache.clear();
    }
  }

  async getSystemHealth(): Promise<{
    pm2: boolean;
    nginx: boolean;
    postgres: boolean;
    redis: boolean;
  }> {
    const [pm2, nginx, postgres, redis] = await Promise.all([
      this.checkPM2Health(),
      this.checkNginxHealth(),
      this.checkPostgresHealth(),
      this.checkRedisHealth()
    ]);

    return { pm2, nginx, postgres, redis };
  }

  private async checkPM2Health(): Promise<boolean> {
    try {
      await this.pm2Repository.getProcessList();
      return true;
    } catch {
      return false;
    }
  }

  private async checkNginxHealth(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('nginx -t 2>&1');
      return stdout.includes('syntax is ok');
    } catch {
      return false;
    }
  }

  private async checkPostgresHealth(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('pg_isready');
      return stdout.includes('accepting connections');
    } catch {
      return false;
    }
  }

  private async checkRedisHealth(): Promise<boolean> {
    try {
      // Sistem Redis'i için .env'den şifreyi al
      const redisPassword = process.env.REDIS_PASSWORD;
      const env = redisPassword ? { ...process.env, REDISCLI_AUTH: redisPassword } : process.env;

      const { stdout } = await execAsync('redis-cli ping', { env });
      return stdout.trim() === 'PONG';
    } catch {
      return false;
    }
  }
}