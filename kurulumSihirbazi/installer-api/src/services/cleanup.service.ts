import { PrismaClient } from "@prisma/client";
import IORedis from "ioredis";
import fs from "fs-extra";
import path from "path";
import { DatabaseService } from "./database.service";
import { PM2Service } from "./pm2.service";
import { NginxService } from "./nginx.service";
import Queue from "bull";

export interface CleanupResource {
  database?: {
    name: string;
    host?: string;
    port?: number;
  };
  files?: string[];
  redis?: {
    keys: string[];
    ports?: number[];
  };
  pm2?: string[];
  nginx?: string;
}

export interface CleanupJob {
  domain: string;
  resources: CleanupResource;
  reason: 'failed_setup' | 'user_deletion' | 'expired' | 'manual';
  force?: boolean;
}

export class CleanupService {
  private prisma: PrismaClient;
  private pm2Service: PM2Service;
  private nginxService: NginxService;
  private cleanupQueue: Queue.Queue<CleanupJob>;
  private customersPath = process.env.CUSTOMERS_PATH || "/var/qodify/customers";

  constructor() {
    this.prisma = new PrismaClient();
    this.pm2Service = new PM2Service();
    this.nginxService = new NginxService();

    // Initialize cleanup queue
    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    };

    this.cleanupQueue = new Queue('cleanup-scheduled', {
      redis: redisConfig,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 10000,
        }
      }
    });

    // Start processing scheduled cleanups
    this.initializeWorker();
  }

  private initializeWorker() {
    this.cleanupQueue.process(2, async (job) => {
      const { domain, resources, force } = job.data;

      try {
        await this.performCleanup(domain, resources, force);

        // Log success
        await this.prisma.setupCleanup.create({
          data: {
            domain,
            resources: resources as any,
            status: 'completed',
            completedAt: new Date()
          }
        });

        return { success: true };
      } catch (error: any) {
        console.error(`[CleanupService] Failed to cleanup ${domain}:`, error);

        // Log failure
        await this.prisma.setupCleanup.create({
          data: {
            domain,
            resources: resources as any,
            status: 'failed',
            error: error.message
          }
        });

        throw error;
      }
    });
  }

  /**
   * Perform complete cleanup of customer resources
   */
  public async performCleanup(domain: string, resources: CleanupResource, force: boolean = false): Promise<void> {
    const errors: string[] = [];
    console.log(`[CleanupService] Starting cleanup for ${domain}`, resources);

    // 1. Stop and remove PM2 processes
    if (resources.pm2) {
      for (const processName of resources.pm2) {
        try {
          await this.pm2Service.deleteCustomer(processName);
          console.log(`[CleanupService] PM2 process removed: ${processName}`);
        } catch (error: any) {
          if (!force) errors.push(`PM2 ${processName}: ${error.message}`);
          console.warn(`[CleanupService] Failed to remove PM2 process:`, error.message);
        }
      }
    }

    // 2. Remove Nginx configuration
    if (resources.nginx) {
      try {
        await this.nginxService.removeConfig(resources.nginx);
        console.log(`[CleanupService] Nginx config removed: ${resources.nginx}`);
      } catch (error: any) {
        if (!force) errors.push(`Nginx: ${error.message}`);
        console.warn(`[CleanupService] Failed to remove Nginx config:`, error.message);
      }
    }

    // 3. Drop database
    if (resources.database) {
      try {
        const dbConfig = {
          host: resources.database.host || process.env.DB_HOST || 'localhost',
          port: resources.database.port || parseInt(process.env.DB_PORT || '5432'),
          user: process.env.DB_USER || 'postgres',
          password: process.env.DB_PASSWORD || 'postgres'
        };

        const databaseService = new DatabaseService(dbConfig);
        await databaseService.dropDatabase(resources.database.name);
        console.log(`[CleanupService] Database dropped: ${resources.database.name}`);
      } catch (error: any) {
        if (!force) errors.push(`Database: ${error.message}`);
        console.warn(`[CleanupService] Failed to drop database:`, error.message);
      }
    }

    // 4. Remove files
    if (resources.files) {
      for (const filePath of resources.files) {
        try {
          await fs.remove(filePath);
          console.log(`[CleanupService] Files removed: ${filePath}`);
        } catch (error: any) {
          if (!force) errors.push(`Files ${filePath}: ${error.message}`);
          console.warn(`[CleanupService] Failed to remove files:`, error.message);
        }
      }
    }

    // 5. Clean Redis keys and ports
    if (resources.redis) {
      const redis = new IORedis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      });

      try {
        // Remove specific keys
        if (resources.redis.keys && resources.redis.keys.length > 0) {
          await redis.del(...resources.redis.keys);
          console.log(`[CleanupService] Redis keys removed: ${resources.redis.keys.length} keys`);
        }

        // Release ports
        if (resources.redis.ports && resources.redis.ports.length > 0) {
          await redis.srem('ports:in-use', ...resources.redis.ports.map(String));
          console.log(`[CleanupService] Ports released: ${resources.redis.ports.join(', ')}`);
        }

        // Remove all domain-related keys
        const pattern = `*${domain.replace(/\./g, '_')}*`;
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.del(...keys);
          console.log(`[CleanupService] Domain keys removed: ${keys.length} keys`);
        }

      } catch (error: any) {
        if (!force) errors.push(`Redis: ${error.message}`);
        console.warn(`[CleanupService] Failed to clean Redis:`, error.message);
      } finally {
        redis.disconnect();
      }
    }

    // 6. Remove customer record
    try {
      await this.prisma.customer.deleteMany({
        where: { domain }
      });
      console.log(`[CleanupService] Customer record removed: ${domain}`);
    } catch (error: any) {
      if (!force) errors.push(`Customer record: ${error.message}`);
      console.warn(`[CleanupService] Failed to remove customer record:`, error.message);
    }

    if (errors.length > 0 && !force) {
      throw new Error(`Cleanup errors: ${errors.join(', ')}`);
    }

    console.log(`[CleanupService] Cleanup completed for ${domain}`);
  }

  /**
   * Gather all resources for a domain
   */
  public async gatherResources(domain: string): Promise<CleanupResource> {
    const resources: CleanupResource = {};

    // 1. Check files
    const customerPath = path.join(this.customersPath, domain.replace(/\./g, '-'));
    if (await fs.pathExists(customerPath)) {
      resources.files = [customerPath];
    }

    // 2. Check database
    const dbName = `hodox_customer_${domain.replace(/\./g, '_')}`;
    resources.database = { name: dbName };

    // 3. Check PM2 processes
    resources.pm2 = [
      `${domain}-backend`,
      `${domain}-admin`,
      `${domain}-store`
    ];

    // 4. Check Nginx
    resources.nginx = domain.replace(/\./g, '-');

    // 5. Check Redis
    const redis = new IORedis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    });

    try {
      // Get port allocations
      const portsObj = await redis.hgetall(`ports:${domain}`);
      const ports = Object.values(portsObj).map(p => parseInt(p as string));

      // Get domain-specific keys
      const keys = await redis.keys(`*${domain.replace(/\./g, '_')}*`);

      resources.redis = {
        keys: [...keys, `ports:${domain}`],
        ports
      };

    } finally {
      redis.disconnect();
    }

    return resources;
  }

  /**
   * Schedule cleanup for failed or incomplete setups
   */
  public async scheduleCleanup(domain: string, reason: CleanupJob['reason'], delay: number = 5000): Promise<void> {
    const resources = await this.gatherResources(domain);

    // Create cleanup record
    await this.prisma.setupCleanup.create({
      data: {
        domain,
        resources: resources as any,
        status: 'pending'
      }
    });

    // Schedule job (without name to match default processor)
    await this.cleanupQueue.add({
      domain,
      resources,
      reason
    }, {
      delay
    });

    console.log(`[CleanupService] Cleanup scheduled for ${domain} in ${delay}ms`);
  }

  /**
   * Clean up orphaned resources (runs periodically)
   */
  public async cleanupOrphans(): Promise<void> {
    console.log(`[CleanupService] Starting orphan cleanup scan...`);

    // 1. Find incomplete setups older than 24 hours
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - 24);

    const incompleteJobs = await this.prisma.setupJob.findMany({
      where: {
        status: { in: ['waiting', 'active'] },
        createdAt: { lt: cutoffDate }
      }
    });

    for (const job of incompleteJobs) {
      console.log(`[CleanupService] Found orphaned job: ${job.domain}`);
      await this.scheduleCleanup(job.domain, 'expired');

      // Mark job as failed
      await this.prisma.setupJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          error: 'Job expired (24h timeout)'
        }
      });
    }

    // 2. Find directories without customer records
    const customerDirs = await fs.readdir(this.customersPath);
    const customers = await this.prisma.customer.findMany({
      select: { domain: true }
    });

    const validDomains = new Set(customers.map(c => c.domain.replace(/\./g, '-')));

    for (const dir of customerDirs) {
      if (!validDomains.has(dir) && !dir.startsWith('.')) {
        console.log(`[CleanupService] Found orphaned directory: ${dir}`);

        // Extract domain from directory name
        const domain = dir.replace(/-/g, '.');

        await this.scheduleCleanup(domain, 'expired', 60000); // 1 minute delay
      }
    }

    // 3. Clean old cleanup records
    const oldCleanupDate = new Date();
    oldCleanupDate.setDate(oldCleanupDate.getDate() - 7);

    await this.prisma.setupCleanup.deleteMany({
      where: {
        status: 'completed',
        createdAt: { lt: oldCleanupDate }
      }
    });

    console.log(`[CleanupService] Orphan cleanup scan completed`);
  }

  /**
   * Immediate cleanup (no scheduling)
   */
  public async cleanupImmediate(domain: string, force: boolean = false): Promise<void> {
    const resources = await this.gatherResources(domain);
    await this.performCleanup(domain, resources, force);
  }

  /**
   * Get cleanup history for a domain
   */
  public async getCleanupHistory(domain?: string): Promise<any[]> {
    const where = domain ? { domain } : {};

    return await this.prisma.setupCleanup.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50
    });
  }

  /**
   * Get pending cleanups
   */
  public async getPendingCleanups(): Promise<any[]> {
    return await this.prisma.setupCleanup.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' }
    });
  }

  /**
   * Rollback helper for transactional cleanup
   */
  public createRollbackStack(): {
    add: (fn: () => Promise<void>) => void;
    execute: () => Promise<void>;
  } {
    const stack: Array<() => Promise<void>> = [];

    return {
      add: (fn) => stack.push(fn),
      execute: async () => {
        for (const fn of stack.reverse()) {
          try {
            await fn();
          } catch (error) {
            console.error(`[CleanupService] Rollback error:`, error);
          }
        }
      }
    };
  }
}