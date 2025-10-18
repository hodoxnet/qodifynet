import Queue from "bull";
import { PrismaClient } from "@prisma/client";
import { SetupService } from "./setup.service";
import { CustomerService } from "./customer.service";
import { PM2Service } from "./pm2.service";
import { NginxService } from "./nginx.service";
import { DemoDataService } from "./demo-data.service";
import { PartnerService } from "./partner.service";
import { LockService } from "./lock.service";
import { io } from "../index";
import IORedis from "ioredis";
import os from "os";

const CANCELLED_ERROR = 'CANCELLED_BY_USER';

export interface SetupJobData {
  domain: string;
  type: 'git';
  cancelled?: boolean;
  config: {
    // Common
    storeName: string;
    dbConfig?: {
      host: string;
      port: number;
      user: string;
      password: string;
    };
    redisConfig?: {
      host: string;
      port: number;
      password?: string;
    };
    isLocal?: boolean;
    sslEnable?: boolean;
    sslEmail?: string;

    // Git specific
    repoUrl?: string;
    branch?: string;
    depth?: number;
    accessToken?: string;
    username?: string;
    commit?: string;

    // Demo data
    importDemo?: boolean;
    demoPackName?: string;
    demoPackPath?: string;
  };
  userId?: string;
  partnerId?: string;
  reservationLedgerId?: string;
}

export interface SetupJobProgress {
  percent: number;
  step: string;
  message: string;
  details?: any;
}

export class SetupQueueService {
  private static instance: SetupQueueService;
  private setupQueue: Queue.Queue<SetupJobData>;
  private cleanupQueue: Queue.Queue;
  private prisma: PrismaClient;
  private setupService: SetupService;
  private customerService: CustomerService;
  private pm2Service: PM2Service;
  private nginxService: NginxService;
  private demoService: DemoDataService;
  private partnerService: PartnerService;
  private lockService: LockService;

  private readonly MAX_CONCURRENT_JOBS = this.calculateConcurrency();
  private readonly PORT_ALLOCATION_LOCK_KEY = 'port:allocation:lock';
  private readonly PORT_ALLOCATION_LOCK_TTL = 5000; // 5 seconds
  private readonly PARTNER_LOCK_EXTEND_SEC = 60 * 60; // 60 dakika

  private constructor() {
    // Redis connection reuse (ioredis kullanıyoruz)
    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    };

    // Setup queue
    this.setupQueue = new Queue('setup-queue', {
      redis: redisConfig,
      defaultJobOptions: {
        removeOnComplete: false,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        }
      }
    });

    // Cleanup queue
    this.cleanupQueue = new Queue('cleanup-queue', {
      redis: redisConfig,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
      }
    });

    // Initialize services
    this.prisma = new PrismaClient();
    this.setupService = new SetupService();
    this.customerService = new CustomerService();
    this.pm2Service = new PM2Service();
    this.nginxService = new NginxService();
    this.demoService = new DemoDataService();
    this.partnerService = new PartnerService();
    this.lockService = new LockService();

    // Start processing
    this.initializeWorkers();
    this.attachEventListeners();
  }

  public static getInstance(): SetupQueueService {
    if (!SetupQueueService.instance) {
      SetupQueueService.instance = new SetupQueueService();
    }
    return SetupQueueService.instance;
  }

  private calculateConcurrency(): number {
    const totalMemoryGB = os.totalmem() / (1024 ** 3);
    const cpuCores = os.cpus().length;

    // Her kurulum ~2GB RAM kullanır varsayalım
    const memoryBasedLimit = Math.floor(totalMemoryGB / 2);
    const cpuBasedLimit = cpuCores * 2;

    // Minimum 1, maksimum 10
    return Math.max(1, Math.min(memoryBasedLimit, cpuBasedLimit, 10));
  }

  private initializeWorkers() {
    // Setup worker
    this.setupQueue.process(this.MAX_CONCURRENT_JOBS, async (job) => {
      const { domain, type } = job.data;

      try {
        await this.updateJobStatus(job.id.toString(), 'active', { startedAt: new Date() });
        await this.refreshPartnerLock(job);

        if (type !== 'git') {
          throw new Error(`Unsupported setup type: ${type}`);
        }

        const { customerId } = await this.processGitSetup(job);

        await this.commitPartnerReservation(job, customerId);

        await this.updateJobStatus(job.id.toString(), 'completed', {
          completedAt: new Date(),
          progress: 100,
          customerId,
          reservationLedgerId: null
        });

        this.emitJobUpdate(job.id.toString(), 'completed', {
          success: true,
          domain,
          message: 'Kurulum başarıyla tamamlandı!'
        });

        return { success: true, domain };

      } catch (error: any) {
        const isCancelled = this.isJobCancelled(job) || error?.message === CANCELLED_ERROR;

        if (isCancelled) {
          const currentProgress = job.progress();
          const progressPercent = typeof currentProgress === 'number'
            ? currentProgress
            : typeof (currentProgress as any)?.percent === 'number'
              ? (currentProgress as any).percent
              : 0;

          await this.cancelPartnerReservation(job, 'cancelled');

          await this.updateJobStatus(job.id.toString(), 'cancelled', {
            completedAt: new Date(),
            progress: progressPercent,
            error: 'Kullanıcı tarafından iptal edildi',
            reservationLedgerId: null
          });

          await this.scheduleCleanup(domain);

          if (!(error instanceof Error)) {
            error = new Error(CANCELLED_ERROR);
          }
          error.message = CANCELLED_ERROR;

          throw error;
        }

        console.error(`[SetupQueue] Job ${job.id} failed:`, error);

        await this.updateJobStatus(job.id.toString(), 'failed', {
          error: error.message || 'Unknown error'
        });

        const maxAttempts = job.opts.attempts || 3;
        if (job.attemptsMade >= maxAttempts) {
          await this.cancelPartnerReservation(job, error?.message || 'job_failed');
          await this.scheduleCleanup(domain);
        } else {
          await this.refreshPartnerLock(job);
        }

        throw error;
      }
    });

    // Cleanup worker
    this.cleanupQueue.process(5, async (job) => {
      const { domain } = job.data;

      try {
        await this.performCleanup(domain);
        return { success: true };
      } catch (error) {
        console.error(`[CleanupQueue] Failed to cleanup ${domain}:`, error);
        throw error;
      }
    });
  }

  private attachEventListeners() {
    // Setup queue events
    this.setupQueue.on('completed', async (job, result) => {
      console.log(`[SetupQueue] Job ${job.id} completed:`, result);

      // Ensure DB status is updated
      await this.updateJobStatus(job.id.toString(), 'completed', {
        completedAt: new Date(),
        progress: 100
      });

      this.emitJobUpdate(job.id.toString(), 'completed', { result });
    });

    this.setupQueue.on('failed', async (job, error) => {
      if (error?.message === CANCELLED_ERROR) {
        if (job) {
          console.info(`[SetupQueue] Job ${job.id} cancelled by user.`);
          this.emitJobUpdate(job.id.toString(), 'cancelled', {
            reason: 'Kullanıcı tarafından iptal edildi'
          });
        }
        return;
      }

      console.error(`[SetupQueue] Job ${job?.id} failed:`, error?.message);

      if (job) {
        await this.updateJobStatus(job.id.toString(), 'failed', {
          error: error?.message || 'Unknown error',
          completedAt: new Date()
        });

        this.emitJobUpdate(job.id.toString(), 'failed', { error: error?.message });

        if (job.attemptsMade >= (job.opts.attempts || 3)) {
          console.log(`[SetupQueue] Job ${job.id} max attempts reached, scheduling cleanup`);
          await this.scheduleCleanup(job.data.domain);
        }
      }
    });

    this.setupQueue.on('progress', (job, progress: any) => {
      // Update current step in DB
      if (progress && typeof progress === 'object') {
        const step = progress.step;
        const message = progress.message;
        const currentStep = step && message ? `${step}: ${message}` : step || message;

        if (currentStep) {
          this.updateJobStatus(job.id.toString(), undefined as any, {
            currentStep,
            progress: progress.percent || 0
          }).catch(e => console.error('Failed to update progress:', e));
        }
      }

      this.emitJobUpdate(job.id.toString(), 'progress', progress);
    });

    this.setupQueue.on('stalled', async (job) => {
      console.warn(`[SetupQueue] Job ${job.id} stalled - auto cancelling`);

      try {
        // Mark as cancelled in DB
        await this.updateJobStatus(job.id.toString(), 'cancelled', {
          error: 'Job stalled and was automatically cancelled',
          completedAt: new Date()
        });

        await this.cancelPartnerReservation(job as Queue.Job<SetupJobData>, 'stalled');

        // Remove from queue
        await job.remove();

        // Schedule cleanup
        await this.scheduleCleanup(job.data.domain);

        this.emitJobUpdate(job.id.toString(), 'cancelled', {
          reason: 'Job stalled and was automatically cancelled'
        });
      } catch (error) {
        console.error(`[SetupQueue] Failed to handle stalled job ${job.id}:`, error);
      }
    });
  }

  private async processGitSetup(job: Queue.Job<SetupJobData>): Promise<{ customerId: string }> {
    const { domain, config } = job.data;
    const jobId = job.id.toString();

    this.setupService.registerJobContext(domain, jobId);

    try {
      const onProgress = (step: string, message: string, percent?: number) => {
        const progressData = { step, message, percent: percent || 0 };
        job.progress(progressData);

        io.to(`job-${jobId}`).emit(`job-${jobId}-log`, {
          timestamp: new Date().toISOString(),
          level: 'info',
          message,
          step,
          percent
        });
      };

      this.ensureNotCancelled(job);

      onProgress('dns', 'DNS doğrulaması yapılıyor...', 5);

      this.ensureNotCancelled(job);
      onProgress('extract', 'Git deposu klonlanıyor...', 10);
      const gitResult = await this.setupService.prepareFromGit(domain, {
        repoUrl: config.repoUrl!,
        branch: config.branch,
        depth: config.depth,
        accessToken: config.accessToken,
        username: config.username,
        commit: config.commit
      }, (msg) => {
        onProgress('extract', msg, 15);
      });

      if (!gitResult.ok) {
        throw new Error(gitResult.message || 'Git deposu hazırlanamadı');
      }

      this.ensureNotCancelled(job);
      onProgress('database', 'Veritabanı oluşturuluyor...', 20);
      const dbName = `hodox_customer_${domain.replace(/\./g, '_')}`;
      const dbUser = `qodify_${domain.replace(/\./g, '_')}`;
      const dbPassword = this.generatePassword();

      if (config.dbConfig) {
        this.ensureNotCancelled(job);
        await this.setupService.createDatabase(
          config.dbConfig,
          dbName,
          dbUser,
          dbPassword
        );
      }

      this.ensureNotCancelled(job);
      onProgress('ports', 'Port tahsisi yapılıyor...', 30);
      const ports = await this.allocatePorts(domain);

      this.ensureNotCancelled(job);
      onProgress('environment', 'Ortam değişkenleri yapılandırılıyor...', 35);
      await this.setupService.configureEnvironment(domain, {
        dbName,
        dbUser,
        dbPassword,
        dbHost: config.dbConfig?.host || 'localhost',
        dbPort: config.dbConfig?.port || 5432,
        redisHost: config.redisConfig?.host || 'localhost',
        redisPort: config.redisConfig?.port || 6379,
        redisPassword: config.redisConfig?.password,
        ports,
        storeName: config.storeName
      });

      this.ensureNotCancelled(job);
      onProgress('dependencies', 'Bağımlılıklar yükleniyor...', 40);
      await this.setupService.installDependencies(domain, (msg) => {
        onProgress('dependencies', msg, 45);
      });

      this.ensureNotCancelled(job);
      onProgress('migrations', 'Veritabanı migration\'ları çalıştırılıyor...', 50);
      await this.setupService.runMigrations(domain, dbName, dbUser);

      this.ensureNotCancelled(job);
      onProgress('build', 'Uygulamalar derleniyor...', 60);
      await this.setupService.buildApplications(domain, config.isLocal || false, (msg) => {
        onProgress('build', msg, 65);
      });

      this.ensureNotCancelled(job);
      onProgress('services', 'PM2 ve Nginx yapılandırılıyor...', 70);
      const customerPath = this.setupService.getCustomerPath(domain);

      if (config.isLocal) {
        try {
          this.ensureNotCancelled(job);
          await this.pm2Service.createEcosystem(domain, customerPath, ports, { devMode: true });
        } catch (e) {
          console.log('PM2 local modda kullanılamadı:', e);
        }
      } else {
        this.ensureNotCancelled(job);
        await this.pm2Service.createEcosystem(domain, customerPath, ports, { devMode: false });
        await this.nginxService.createConfig(domain, ports, false);

        if (config.sslEnable && config.sslEmail) {
          try {
            this.ensureNotCancelled(job);
            onProgress('services', 'SSL sertifikası alınıyor...', 75);
            await this.nginxService.obtainSSLCertificate(domain, config.sslEmail);
          } catch (e) {
            console.warn('SSL sertifikası alınamadı:', e);
          }
        }
      }

      this.ensureNotCancelled(job);
      onProgress('start', 'Servisler başlatılıyor...', 80);
      if (!config.isLocal || await this.checkPM2Available()) {
        await this.pm2Service.startCustomer(domain, customerPath);
      }

      this.ensureNotCancelled(job);
      onProgress('finalize', 'Müşteri kaydı oluşturuluyor...', 90);
      const customerId = await this.createCustomerRecord(job.data, {
        dbName,
        dbUser,
        dbHost: config.dbConfig?.host || 'localhost',
        dbPort: config.dbConfig?.port || 5432,
        ports
      });

      await this.updateJobStatus(job.id.toString(), 'active', { customerId });

      if (config.importDemo) {
        this.ensureNotCancelled(job);
        onProgress('demo', 'Demo veriler içe aktarılıyor...', 95);
        await this.demoService.importDemo({
          domain,
          packName: config.demoPackName,
          packPath: config.demoPackPath,
          overwriteUploads: true,
          mode: 'strict' as any,
          skipProcessRestart: false
        });
      }

      onProgress('completed', 'Kurulum tamamlandı!', 100);

      return { customerId };
    } finally {
      this.setupService.unregisterJobContext(domain, jobId);
    }
  }

  private async allocatePorts(domain: string): Promise<{ backend: number; admin: number; store: number }> {
    const redis = new IORedis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    });

    const lockToken = `${process.pid}-${Date.now()}-${Math.random()}`;
    let lockAcquired = false;

    try {
      // Acquire lock
      const lockResult = await redis.set(
        this.PORT_ALLOCATION_LOCK_KEY,
        lockToken,
        'PX', this.PORT_ALLOCATION_LOCK_TTL,
        'NX'
      );

      lockAcquired = Boolean(lockResult);

      if (!lockAcquired) {
        // Wait and retry
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.allocatePorts(domain);
      }

      // Get used ports from Redis
      const usedPortsStr = await redis.smembers('ports:in-use');
      const usedPorts = new Set(usedPortsStr.map(p => parseInt(p)));

      // CRITICAL FIX: Also check database for existing customer ports
      // This handles cases where Redis was cleared or not initialized
      const existingCustomers = await this.prisma.customer.findMany({
        select: { portsBackend: true, portsAdmin: true, portsStore: true }
      });

      for (const customer of existingCustomers) {
        if (customer.portsBackend) usedPorts.add(Number(customer.portsBackend));
        if (customer.portsAdmin) usedPorts.add(Number(customer.portsAdmin));
        if (customer.portsStore) usedPorts.add(Number(customer.portsStore));
      }

      console.log(`[SetupQueue] Port allocation - Total used ports: ${usedPorts.size}`);

      // Find available port range
      let basePort = 4000;
      while (usedPorts.has(basePort) || usedPorts.has(basePort + 1) || usedPorts.has(basePort + 2)) {
        basePort += 3;
      }

      console.log(`[SetupQueue] Allocated ports for ${domain}: ${basePort}, ${basePort + 1}, ${basePort + 2}`);

      // Reserve ports in Redis
      await redis.sadd('ports:in-use', basePort, basePort + 1, basePort + 2);
      await redis.hset(`ports:${domain}`, {
        backend: basePort,
        admin: basePort + 1,
        store: basePort + 2
      });

      return {
        backend: basePort,
        admin: basePort + 1,
        store: basePort + 2
      };

    } finally {
      // Release lock only if we acquired it in this invocation
      if (lockAcquired) {
        try {
          const currentValue = await redis.get(this.PORT_ALLOCATION_LOCK_KEY);
          if (currentValue === lockToken) {
            await redis.del(this.PORT_ALLOCATION_LOCK_KEY);
          }
        } catch (error) {
          console.warn('[SetupQueue] Port kilidi serbest bırakılamadı:', error);
        }
      }
      redis.disconnect();
    }
  }

  private async createCustomerRecord(jobData: SetupJobData, dbInfo: any): Promise<string> {
    const { domain, config, partnerId } = jobData;
    const { v4: uuidv4 } = require('uuid');
    const customerId = uuidv4();

    await this.customerService.saveCustomer({
      id: customerId,
      domain,
      status: 'running',
      createdAt: new Date().toISOString(),
      partnerId,
      ports: dbInfo.ports,
      resources: { cpu: 0, memory: 0 },
      mode: config.isLocal ? 'local' : 'production',
      db: {
        name: dbInfo.dbName,
        user: dbInfo.dbUser,
        host: dbInfo.dbHost,
        port: dbInfo.dbPort,
        schema: 'public'
      },
      redis: {
        host: config.redisConfig?.host || 'localhost',
        port: config.redisConfig?.port || 6379,
        password: config.redisConfig?.password,
        prefix: domain.replace(/\./g, '_')
      }
    });

    return customerId;
  }

  private async performCleanup(domain: string) {
    // Get cleanup record
    const cleanup = await this.prisma.setupCleanup.findFirst({
      where: { domain, status: 'pending' },
      orderBy: { createdAt: 'desc' }
    });

    if (!cleanup) {
      console.log(`[Cleanup] No pending cleanup for ${domain}`);
      return;
    }

    const resources = cleanup.resources as any;
    const errors: string[] = [];

    try {
      // 1. Stop PM2 processes
      if (resources.pm2) {
        try {
          await this.pm2Service.deleteCustomer(domain);
        } catch (e: any) {
          errors.push(`PM2: ${e.message}`);
        }
      }

      // 2. Remove Nginx config
      if (resources.nginx) {
        try {
          await this.nginxService.removeConfig(domain);
        } catch (e: any) {
          errors.push(`Nginx: ${e.message}`);
        }
      }

      // 3. Drop database
      if (resources.database) {
        try {
          const { DatabaseService } = await import('./database.service');
          const dbService = new DatabaseService({
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres'
          });
          await dbService.dropDatabase(resources.database);
        } catch (e: any) {
          errors.push(`Database: ${e.message}`);
        }
      }

      // 4. Remove files
      if (resources.files) {
        try {
          const fs = await import('fs-extra');
          await fs.remove(resources.files);
        } catch (e: any) {
          errors.push(`Files: ${e.message}`);
        }
      }

      // 5. Clean Redis keys
      if (resources.redis) {
        try {
          const redis = new IORedis({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
          });

          // Delete port allocations
          await redis.del(`ports:${domain}`);

          // Remove from used ports
          const ports = resources.redis.ports;
          if (ports) {
            const portStrings = Object.values(ports).map(p => String(p));
            if (portStrings.length > 0) {
              await redis.srem('ports:in-use', ...portStrings);
            }
          }

          // Delete all domain-specific keys
          const keys = await redis.keys(`*${domain.replace(/\./g, '_')}*`);
          if (keys.length > 0) {
            await redis.del(...keys);
          }

          redis.disconnect();
        } catch (e: any) {
          errors.push(`Redis: ${e.message}`);
        }
      }

      // Update cleanup record
      await this.prisma.setupCleanup.update({
        where: { id: cleanup.id },
        data: {
          status: errors.length > 0 ? 'failed' : 'completed',
          error: errors.length > 0 ? errors.join(', ') : null,
          completedAt: new Date()
        }
      });

    } catch (error: any) {
      await this.prisma.setupCleanup.update({
        where: { id: cleanup.id },
        data: {
          status: 'failed',
          error: error.message
        }
      });
      throw error;
    }
  }

  private async scheduleCleanup(domain: string) {
    // Create cleanup record
    const resources = await this.gatherResourcesForCleanup(domain);

    await this.prisma.setupCleanup.create({
      data: {
        domain,
        resources,
        status: 'pending'
      }
    });

    // Schedule cleanup job (without name to match default processor)
    await this.cleanupQueue.add({ domain }, {
      delay: 5000 // 5 seconds delay
    });
  }

  private async gatherResourcesForCleanup(domain: string): Promise<any> {
    const resources: any = {};

    // Check what resources were created
    const customerPath = this.setupService.getCustomerPath(domain);
    const fs = await import('fs-extra');

    if (await fs.pathExists(customerPath)) {
      resources.files = customerPath;
    }

    // Check database
    const dbName = `hodox_customer_${domain.replace(/\./g, '_')}`;
    resources.database = dbName;

    // Check PM2
    resources.pm2 = true;

    // Check Nginx
    resources.nginx = true;

    // Check Redis
    const redis = new IORedis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    });

    const portsStr = await redis.hgetall(`ports:${domain}`);
    redis.disconnect();

    if (portsStr && Object.keys(portsStr).length > 0) {
      resources.redis = { ports: portsStr };
    }

    return resources;
  }

  private async updateJobStatus(jobId: string, status?: string, updates?: any) {
    try {
      const data: any = { ...updates };
      if (status) {
        data.status = status;
      }

      await this.prisma.setupJob.update({
        where: { jobId },
        data
      });
    } catch (error) {
      console.error(`[SetupQueue] Failed to update job status:`, error);
    }
  }

  private emitJobUpdate(jobId: string, event: string, data: any) {
    // Emit to job-specific room
    io.to(`job-${jobId}`).emit(`job-${jobId}-${event}`, data);

    // Emit to global active jobs room
    io.to('active-jobs').emit('job-update', {
      jobId,
      event,
      data,
      timestamp: new Date().toISOString()
    });
  }

  private generatePassword(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(16).toString('hex');
  }

  private async checkPM2Available(): Promise<boolean> {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      await execAsync('pm2 --version');
      return true;
    } catch {
      return false;
    }
  }

  private isJobCancelled(job: Queue.Job<SetupJobData>): boolean {
    return Boolean((job.data as any)?.cancelled);
  }

  private ensureNotCancelled(job: Queue.Job<SetupJobData>) {
    if (this.isJobCancelled(job)) {
      throw new Error(CANCELLED_ERROR);
    }
  }

  private async refreshPartnerLock(job: Queue.Job<SetupJobData>) {
    const partnerId = job.data.partnerId;
    if (!partnerId) return;
    try {
      const lock = await this.lockService.get(partnerId);
      const ledgerId = lock?.ledgerId ?? job.data.reservationLedgerId;
      const updated = await this.lockService.updateStatus(partnerId, lock?.status ?? 'reserved', this.PARTNER_LOCK_EXTEND_SEC);
      if (!updated) {
        await this.lockService.acquire(partnerId, this.PARTNER_LOCK_EXTEND_SEC, ledgerId);
      }
    } catch (error) {
      console.warn(`[SetupQueue] Partner kilidi yenilenemedi (${partnerId}):`, error);
    }
  }

  private async commitPartnerReservation(job: Queue.Job<SetupJobData>, customerId?: string) {
    const partnerId = job.data.partnerId;
    if (!partnerId) return;
    const isLocal = Boolean(job.data.config?.isLocal);

    try {
      if (isLocal) {
        await this.lockService.release(partnerId);
        return;
      }

      const ledgerId = job.data.reservationLedgerId;
      if (!ledgerId) {
        await this.lockService.release(partnerId);
        return;
      }

      await this.lockService.updateStatus(partnerId, 'committing', this.PARTNER_LOCK_EXTEND_SEC);
      const committed = await this.partnerService.commitReservation(partnerId, ledgerId, customerId ?? `queue-${job.id}`);
      if (!committed) {
        throw new Error('Rezervasyon commit edilemedi');
      }

      await this.lockService.release(partnerId);
      job.data.reservationLedgerId = undefined;
      try {
        await this.prisma.setupJob.update({
          where: { jobId: job.id.toString() },
          data: { reservationLedgerId: null }
        });
      } catch {}
    } catch (error) {
      console.error(`[SetupQueue] Partner rezervasyonu tamamlanamadı (${partnerId}):`, error);
      try { await this.lockService.release(partnerId); } catch {}
      throw error;
    }
  }

  private async cancelPartnerReservation(job: Queue.Job<SetupJobData>, reason: string) {
    const partnerId = job.data.partnerId;
    if (!partnerId) return;
    const isLocal = Boolean(job.data.config?.isLocal);
    const ledgerId = job.data.reservationLedgerId;

    try {
      if (!isLocal) {
        const lock = await this.lockService.get(partnerId);
        const cancelLedger = ledgerId ?? lock?.ledgerId;
        if (cancelLedger) {
          const cancelled = await this.partnerService.cancelReservation(partnerId, cancelLedger, reason);
          if (!cancelled) {
            console.warn(`[SetupQueue] Rezervasyon iptali başarısız (${partnerId}, ${cancelLedger})`);
          }
        }
      }
    } catch (error) {
      console.warn(`[SetupQueue] Rezervasyon iptali hata verdi (${partnerId}):`, error);
    } finally {
      job.data.reservationLedgerId = undefined;
      try { await this.lockService.release(partnerId); } catch {}
      try {
        await this.prisma.setupJob.update({
          where: { jobId: job.id.toString() },
          data: { reservationLedgerId: null }
        });
      } catch {}
    }
  }

  /**
   * Sync existing customer ports to Redis
   * Useful after Redis restart or initialization
   */
  public async syncCustomerPortsToRedis(): Promise<{ synced: number; ports: number[] }> {
    const redis = new IORedis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    });

    try {
      const customers = await this.prisma.customer.findMany({
        select: { domain: true, portsBackend: true, portsAdmin: true, portsStore: true }
      });

      const allPorts: number[] = [];

      for (const customer of customers) {
        const domainPorts: number[] = [];

        if (customer.portsBackend) {
          domainPorts.push(Number(customer.portsBackend));
          allPorts.push(Number(customer.portsBackend));
        }
        if (customer.portsAdmin) {
          domainPorts.push(Number(customer.portsAdmin));
          allPorts.push(Number(customer.portsAdmin));
        }
        if (customer.portsStore) {
          domainPorts.push(Number(customer.portsStore));
          allPorts.push(Number(customer.portsStore));
        }

        // Add to Redis
        if (domainPorts.length > 0) {
          await redis.sadd('ports:in-use', ...domainPorts.map(String));
          await redis.hset(`ports:${customer.domain}`, {
            backend: customer.portsBackend,
            admin: customer.portsAdmin,
            store: customer.portsStore
          });
        }
      }

      console.log(`[SetupQueue] Synced ${customers.length} customers with ${allPorts.length} ports to Redis`);

      return { synced: customers.length, ports: allPorts };

    } finally {
      redis.disconnect();
    }
  }

  // Public API methods

  public async createJob(data: SetupJobData): Promise<string> {
    const payload: SetupJobData = { ...data };
    delete (payload as any).cancelled;

    if (payload.partnerId) {
      try {
        const refreshed = await this.lockService.updateStatus(payload.partnerId, 'reserved', this.PARTNER_LOCK_EXTEND_SEC);
        if (!refreshed) {
          await this.lockService.acquire(payload.partnerId, this.PARTNER_LOCK_EXTEND_SEC, payload.reservationLedgerId);
        }
      } catch (error) {
        console.warn(`[SetupQueue] Partner kilidi uzatılamadı (${payload.partnerId}):`, error);
      }
    }

    // First create the Bull job to get its ID (without name to match default processor)
    const job = await this.setupQueue.add(payload);

    // Then create database record with the actual job ID
    await this.prisma.setupJob.create({
      data: {
        jobId: job.id.toString(),
        domain: payload.domain,
        type: payload.type,
        status: 'waiting',
        config: payload.config as any,
        createdBy: payload.userId,
        partnerId: payload.partnerId,
        reservationLedgerId: payload.reservationLedgerId
      }
    });

    return job.id.toString();
  }

  public async getJob(jobId: string): Promise<any> {
    const job = await this.setupQueue.getJob(jobId);
    const dbRecord = await this.prisma.setupJob.findUnique({
      where: { jobId }
    });

    if (!job) {
      if (!dbRecord) {
        return null;
      }

      return {
        id: dbRecord.jobId,
        domain: dbRecord.domain,
        type: dbRecord.type,
        status: dbRecord.status,
        progress: dbRecord.progress ?? 0,
        progressPercent: dbRecord.progress ?? 0,
        currentStep: dbRecord.currentStep,
        attemptsMade: 0,
        createdAt: dbRecord.createdAt,
        processedAt: dbRecord.startedAt,
        finishedAt: dbRecord.completedAt,
        failedReason: dbRecord.error,
        config: dbRecord.config,
        data: {
          domain: dbRecord.domain,
          type: dbRecord.type,
          config: dbRecord.config,
          reservationLedgerId: dbRecord.reservationLedgerId
        },
        reservationLedgerId: dbRecord.reservationLedgerId,
        customerId: dbRecord.customerId,
        dbRecord
      };
    }

    const state = this.isJobCancelled(job) ? 'cancelled' : await job.getState();
    const rawProgress = job.progress();
    const progressPercent = typeof rawProgress === 'number'
      ? rawProgress
      : typeof (rawProgress as any)?.percent === 'number'
        ? (rawProgress as any).percent
        : dbRecord?.progress ?? 0;

    const combinedConfig = (job.data && 'config' in job.data) ? job.data.config : undefined;

    let derivedStep: string | undefined = dbRecord?.currentStep || undefined;
    if (rawProgress && typeof rawProgress === 'object') {
      const step = (rawProgress as any).step as string | undefined;
      const message = (rawProgress as any).message as string | undefined;
      if (step && message) {
        derivedStep = `${step}: ${message}`;
      } else if (step) {
        derivedStep = step;
      }
    }

    return {
      id: job.id.toString(),
      domain: job.data.domain,
      type: job.data.type,
      status: state,
      progress: rawProgress,
      progressPercent,
      currentStep: derivedStep,
      attemptsMade: job.attemptsMade,
      createdAt: new Date(job.timestamp),
      processedAt: job.processedOn ? new Date(job.processedOn) : null,
      finishedAt: job.finishedOn ? new Date(job.finishedOn) : null,
      failedReason: job.failedReason,
      config: combinedConfig ?? dbRecord?.config,
      data: job.data,
      reservationLedgerId: job.data.reservationLedgerId ?? dbRecord?.reservationLedgerId,
      customerId: dbRecord?.customerId,
      dbRecord
    };
  }

  public async getActiveJobs(): Promise<any[]> {
    const queueJobs = await this.setupQueue.getJobs(['waiting', 'active', 'delayed']);

    const jobMap = new Map<string, any>();

    await Promise.all(
      queueJobs.map(async (job) => {
        const jobId = job.id.toString();
        const dbRecord = await this.prisma.setupJob.findUnique({
          where: { jobId }
        });

        const rawProgress = job.progress();
        const progressPercent = typeof rawProgress === 'number'
          ? rawProgress
          : typeof (rawProgress as any)?.percent === 'number'
            ? (rawProgress as any).percent
            : dbRecord?.progress ?? 0;

        let currentStep = dbRecord?.currentStep;
        if (rawProgress && typeof rawProgress === 'object') {
          const step = (rawProgress as any).step as string | undefined;
          const message = (rawProgress as any).message as string | undefined;
          if (step && message) {
            currentStep = `${step}: ${message}`;
          } else if (step) {
            currentStep = step;
          }
        }

        const bullState = await job.getState();
        const status = this.isJobCancelled(job) ? 'cancelled' : bullState;

        jobMap.set(jobId, {
          id: jobId,
          domain: job.data.domain,
          type: job.data.type,
          status,
          progress: progressPercent,
          createdAt: new Date(job.timestamp),
          currentStep,
          partnerId: dbRecord?.partnerId,
          customerId: dbRecord?.customerId,
          reservationLedgerId: job.data.reservationLedgerId ?? dbRecord?.reservationLedgerId,
          finishedAt: job.finishedOn ? new Date(job.finishedOn) : dbRecord?.completedAt ?? null
        });
      })
    );

    const recentCompleted = await this.prisma.setupJob.findMany({
      where: {
        status: { in: ['completed', 'failed', 'cancelled'] }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    for (const record of recentCompleted) {
      if (jobMap.has(record.jobId)) continue;
      jobMap.set(record.jobId, {
        id: record.jobId,
        domain: record.domain,
        type: record.type,
        status: record.status,
        progress: record.progress ?? (record.status === 'completed' ? 100 : 0),
        createdAt: record.createdAt,
        currentStep: record.currentStep,
        partnerId: record.partnerId,
        customerId: record.customerId,
        reservationLedgerId: record.reservationLedgerId,
        finishedAt: record.completedAt ?? null
      });
    }

    const jobsWithDetails = Array.from(jobMap.values()).sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime;
    });

    return jobsWithDetails;
  }

  public async cancelJob(jobId: string): Promise<boolean> {
    const job = await this.setupQueue.getJob(jobId);

    if (!job) {
      return false;
    }

    const state = await job.getState();

    // Can only cancel waiting or active jobs
    if (state === 'waiting') {
      await this.cancelPartnerReservation(job, 'cancelled');
      await job.remove();

      await this.updateJobStatus(jobId, 'cancelled', {
        completedAt: new Date(),
        error: 'Kullanıcı tarafından iptal edildi',
        reservationLedgerId: null
      });

      this.emitJobUpdate(jobId, 'cancelled', {
        reason: 'Kullanıcı tarafından iptal edildi'
      });

      await this.scheduleCleanup(job.data.domain);

      return true;
    }

    if (state === 'active') {
      const updatedData = { ...job.data, cancelled: true } as SetupJobData & { cancelled: boolean };
      await job.update(updatedData);
      job.data.cancelled = true;
      await job.discard().catch(() => {});

      const currentProgress = job.progress();
      const progressPercent = typeof currentProgress === 'number'
        ? currentProgress
        : typeof (currentProgress as any)?.percent === 'number'
          ? (currentProgress as any).percent
          : 0;

      await this.updateJobStatus(jobId, 'cancelled', {
        error: 'Kullanıcı tarafından iptal edildi',
        progress: progressPercent
      });

      this.emitJobUpdate(jobId, 'cancelled', {
        reason: 'Kullanıcı tarafından iptal edildi'
      });

      return true;
    }

    return false;
  }

  public async retryJob(jobId: string, reservationLedgerId?: string): Promise<string> {
    const job = await this.setupQueue.getJob(jobId);

    if (!job) {
      throw new Error('Job not found');
    }

    // Create new job with same data
    const newJobData: SetupJobData = { ...job.data };
    if (typeof reservationLedgerId !== 'undefined') {
      newJobData.reservationLedgerId = reservationLedgerId;
    }
    delete (newJobData as any).cancelled;

    const newJobId = await this.createJob(newJobData);

    return newJobId;
  }

  public async cleanupResources(domain: string): Promise<void> {
    await this.scheduleCleanup(domain);
  }

  public async getQueueStats(): Promise<any> {
    const [
      waitingCount,
      activeCount,
      completedCount,
      failedCount,
      delayedCount
    ] = await Promise.all([
      this.setupQueue.getWaitingCount(),
      this.setupQueue.getActiveCount(),
      this.setupQueue.getCompletedCount(),
      this.setupQueue.getFailedCount(),
      this.setupQueue.getDelayedCount()
    ]);

    return {
      waiting: waitingCount,
      active: activeCount,
      completed: completedCount,
      failed: failedCount,
      delayed: delayedCount,
      total: waitingCount + activeCount + completedCount + failedCount + delayedCount,
      concurrency: this.MAX_CONCURRENT_JOBS
    };
  }
}
