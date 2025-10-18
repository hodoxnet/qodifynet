import { Router } from "express";
import { SetupQueueService, SetupJobData } from "../services/setup-queue.service";
import { CleanupService } from "../services/cleanup.service";
import { requireScopes } from "../middleware/scopes";
import { authenticate } from "../middleware/auth";
import { SCOPES } from "../constants/scopes";
import { sanitizeDomain } from "../utils/sanitize";
import { err, ok } from "../utils/http";
import rateLimit from "express-rate-limit";
import { createBullBoard } from "@bull-board/api";
import { BullAdapter } from "@bull-board/api/bullAdapter";
import { ExpressAdapter } from "@bull-board/express";
import Queue from "bull";
import { LockService } from "../services/lock.service";
import { PartnerService } from "../services/partner.service";

// Rate limiting
const setupQueueLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  limit: 20, // 20 requests per 5 minutes
  standardHeaders: true,
  legacyHeaders: false
});

export const setupQueueRouter = Router();
const setupQueueService = SetupQueueService.getInstance();
const cleanupService = new CleanupService();
const lockService = new LockService();
const PARTNER_LOCK_TTL_SEC = 15 * 60;

class QueueReservationError extends Error {
  public status: number;
  public code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

interface ReservationParams {
  partnerId: string;
  userId: string;
  domain: string;
  isLocal: boolean;
  reservationLedgerId?: string;
}

async function ensurePartnerReservation({ partnerId, userId, domain, isLocal, reservationLedgerId }: ReservationParams): Promise<string | undefined> {
  const existingLock = await lockService.get(partnerId);

  if (existingLock) {
    if (existingLock.status === 'committing') {
      throw new QueueReservationError(409, 'SETUP_IN_PROGRESS', 'Bu partner için devam eden bir kurulum var.');
    }
    const ledger = reservationLedgerId ?? existingLock.ledgerId;
    const updated = await lockService.updateStatus(partnerId, 'reserved', PARTNER_LOCK_TTL_SEC);
    if (!updated) {
      const reacquired = await lockService.acquire(partnerId, PARTNER_LOCK_TTL_SEC, ledger);
      if (!reacquired) {
        throw new QueueReservationError(409, 'SETUP_IN_PROGRESS', 'Bu partner için devam eden bir kurulum var.');
      }
    }
    return ledger;
  }

  if (reservationLedgerId) {
    const reacquired = await lockService.acquire(partnerId, PARTNER_LOCK_TTL_SEC, reservationLedgerId);
    if (!reacquired) {
      throw new QueueReservationError(409, 'SETUP_IN_PROGRESS', 'Bu partner için devam eden bir kurulum var.');
    }
    return reservationLedgerId;
  }

  if (isLocal) {
    const okLock = await lockService.acquire(partnerId, PARTNER_LOCK_TTL_SEC);
    if (!okLock) {
      throw new QueueReservationError(409, 'SETUP_IN_PROGRESS', 'Bu partner için devam eden bir kurulum var.');
    }
    return undefined;
  }

  const partnerService = new PartnerService();
  const tempRef = `queue-reserve-${domain || 'setup'}-${Date.now()}`;
  const reservation = await partnerService.reserveSetup(partnerId, tempRef, userId);

  if (!reservation.ok || !reservation.ledgerId) {
    if ('price' in reservation && typeof reservation.price === 'number') {
      throw new QueueReservationError(402, 'INSUFFICIENT_CREDIT', `Yetersiz kredi. Gerekli: ${reservation.price}, Bakiye: ${reservation.balance ?? 0}`);
    }
    throw new QueueReservationError(500, 'RESERVE_FAILED', 'Kredi rezervasyonu başarısız');
  }

  const okLock = await lockService.acquire(partnerId, PARTNER_LOCK_TTL_SEC, reservation.ledgerId);
  if (!okLock) {
    await partnerService.cancelReservation(partnerId, reservation.ledgerId, 'queue-lock-failed');
    throw new QueueReservationError(409, 'SETUP_IN_PROGRESS', 'Bu partner için devam eden bir kurulum var.');
  }

  return reservation.ledgerId;
}

// Bull Board setup for monitoring
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
};

const setupQueue = new Queue('setup-queue', { redis: redisConfig });
const cleanupQueue = new Queue('cleanup-queue', { redis: redisConfig });
const cleanupScheduledQueue = new Queue('cleanup-scheduled', { redis: redisConfig });

const serverAdapter = new ExpressAdapter();
const DASHBOARD_BASE_PATH = '/api/setup-queue/dashboard';
serverAdapter.setBasePath(DASHBOARD_BASE_PATH);
createBullBoard({
  queues: [
    new BullAdapter(setupQueue),
    new BullAdapter(cleanupQueue),
    new BullAdapter(cleanupScheduledQueue)
  ],
  serverAdapter
});

// Mount Bull Board UI (admin only)
setupQueueRouter.use('/dashboard', authenticate, requireScopes(SCOPES.SETUP_RUN), serverAdapter.getRouter());

/**
 * Create a new setup job
 */
setupQueueRouter.post('/queue', setupQueueLimiter, requireScopes(SCOPES.SETUP_RUN), async (req, res): Promise<void> => {
  try {
    const user = req.user!;
    const { domain: rawDomain, type, config } = req.body;

    // Validate input
    if (!rawDomain || !type || !config) {
      err(res, 400, 'INVALID_INPUT', 'Domain, type ve config gerekli');
      return;
    }

    if (type !== 'template' && type !== 'git') {
      err(res, 400, 'INVALID_TYPE', 'Type "template" veya "git" olmalı');
      return;
    }

    const domain = sanitizeDomain(rawDomain);
    const isLocal = Boolean(config?.isLocal);
    let reservationLedgerId = typeof req.body?.reservationLedgerId === 'string'
      ? (req.body.reservationLedgerId as string)
      : undefined;

    if (user.partnerId) {
      try {
        reservationLedgerId = await ensurePartnerReservation({
          partnerId: user.partnerId,
          userId: user.id,
          domain,
          isLocal,
          reservationLedgerId
        });
      } catch (reservationError: any) {
        if (reservationError instanceof QueueReservationError) {
          err(res, reservationError.status, reservationError.code, reservationError.message);
          return;
        }
        throw reservationError;
      }
    }

    // Check if domain already has an active job
    const activeJobs = await setupQueueService.getActiveJobs();
    const existingJob = activeJobs.find(j => j.domain === domain && ['waiting', 'active'].includes(j.status));

    if (existingJob) {
      err(res, 409, 'JOB_EXISTS', `Bu domain için zaten aktif bir kurulum var: ${existingJob.id}`);
      return;
    }

    // Prepare job data
    const jobData: SetupJobData = {
      domain,
      type,
      config,
      userId: user.id,
      partnerId: user.partnerId,
      reservationLedgerId
    };

    // Create job
    const jobId = await setupQueueService.createJob(jobData);

    ok(res, {
      jobId,
      message: 'Kurulum job\'ı oluşturuldu',
      domain,
      type
    });

  } catch (error: any) {
    if (error instanceof QueueReservationError) {
      err(res, error.status, error.code, error.message);
      return;
    }
    console.error('[SetupQueueController] Create job error:', error);
    err(res, 500, 'CREATE_JOB_ERROR', error.message || 'Job oluşturulamadı');
  }
});

/**
 * Get active jobs
 */
setupQueueRouter.get('/jobs', requireScopes(SCOPES.SETUP_RUN), async (req, res): Promise<void> => {
  try {
    const user = req.user!;
    let jobs = await setupQueueService.getActiveJobs();

    // Filter by partner if not admin
    if (user.partnerId && user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      jobs = jobs.filter(j => j.partnerId === user.partnerId);
    }

    ok(res, { jobs });

  } catch (error: any) {
    console.error('[SetupQueueController] Get jobs error:', error);
    err(res, 500, 'GET_JOBS_ERROR', error.message || 'Job\'lar alınamadı');
  }
});

/**
 * Get job details
 */
setupQueueRouter.get('/job/:jobId', requireScopes(SCOPES.SETUP_RUN), async (req, res): Promise<void> => {
  try {
    const { jobId } = req.params;
    const user = req.user!;

    const job = await setupQueueService.getJob(jobId);

    if (!job) {
      err(res, 404, 'JOB_NOT_FOUND', 'Job bulunamadı');
      return;
    }

    // Check authorization
    if (user.partnerId && user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      if (job.dbRecord?.partnerId !== user.partnerId) {
        err(res, 403, 'FORBIDDEN', 'Bu job\'a erişim yetkiniz yok');
        return;
      }
    }

    ok(res, { job });

  } catch (error: any) {
    console.error('[SetupQueueController] Get job error:', error);
    err(res, 500, 'GET_JOB_ERROR', error.message || 'Job detayları alınamadı');
  }
});

/**
 * Cancel a job
 */
setupQueueRouter.post('/job/:jobId/cancel', setupQueueLimiter, requireScopes(SCOPES.SETUP_RUN), async (req, res): Promise<void> => {
  try {
    const { jobId } = req.params;
    const user = req.user!;

    const job = await setupQueueService.getJob(jobId);

    if (!job) {
      err(res, 404, 'JOB_NOT_FOUND', 'Job bulunamadı');
      return;
    }

    // Check authorization
    if (user.partnerId && user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      if (job.dbRecord?.partnerId !== user.partnerId) {
        err(res, 403, 'FORBIDDEN', 'Bu job\'ı iptal etme yetkiniz yok');
        return;
      }
    }

    const cancelled = await setupQueueService.cancelJob(jobId);

    if (!cancelled) {
      err(res, 400, 'CANNOT_CANCEL', 'Bu job iptal edilemez (tamamlanmış veya başarısız olmuş olabilir)');
      return;
    }

    ok(res, {
      success: true,
      message: 'Job iptal edildi ve temizlik planlandı'
    });

  } catch (error: any) {
    console.error('[SetupQueueController] Cancel job error:', error);
    err(res, 500, 'CANCEL_JOB_ERROR', error.message || 'Job iptal edilemedi');
  }
});

/**
 * Retry a failed job
 */
setupQueueRouter.post('/job/:jobId/retry', setupQueueLimiter, requireScopes(SCOPES.SETUP_RUN), async (req, res): Promise<void> => {
  try {
    const { jobId } = req.params;
    const user = req.user!;

    const job = await setupQueueService.getJob(jobId);

    if (!job) {
      err(res, 404, 'JOB_NOT_FOUND', 'Job bulunamadı');
      return;
    }

    // Check authorization
    if (user.partnerId && user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      if (job.dbRecord?.partnerId !== user.partnerId) {
        err(res, 403, 'FORBIDDEN', 'Bu job\'ı tekrar deneme yetkiniz yok');
        return;
      }
    }

    // Only retry failed jobs
    if (job.status !== 'failed') {
      err(res, 400, 'CANNOT_RETRY', 'Sadece başarısız job\'lar tekrar denenebilir');
      return;
    }

    const isLocal = Boolean(job.data?.config?.isLocal ?? job.dbRecord?.config?.isLocal);
    let reservationLedgerId = typeof job.data?.reservationLedgerId === 'string'
      ? job.data.reservationLedgerId
      : job.dbRecord?.reservationLedgerId;

    if (user.partnerId) {
      try {
        reservationLedgerId = await ensurePartnerReservation({
          partnerId: user.partnerId,
          userId: user.id,
          domain: job.data?.domain || job.dbRecord?.domain || 'unknown-domain',
          isLocal,
          reservationLedgerId
        });
      } catch (reservationError: any) {
        if (reservationError instanceof QueueReservationError) {
          err(res, reservationError.status, reservationError.code, reservationError.message);
          return;
        }
        throw reservationError;
      }
    }

    const newJobId = await setupQueueService.retryJob(jobId, reservationLedgerId);

    ok(res, {
      success: true,
      newJobId,
      message: 'Yeni job oluşturuldu'
    });

  } catch (error: any) {
    if (error instanceof QueueReservationError) {
      err(res, error.status, error.code, error.message);
      return;
    }
    console.error('[SetupQueueController] Retry job error:', error);
    err(res, 500, 'RETRY_JOB_ERROR', error.message || 'Job tekrar denenemedi');
  }
});

/**
 * Clean up resources for a domain
 */
setupQueueRouter.post('/job/:jobId/cleanup', setupQueueLimiter, requireScopes(SCOPES.SETUP_RUN), async (req, res): Promise<void> => {
  try {
    const { jobId } = req.params;
    const { force = false } = req.body;
    const user = req.user!;

    const job = await setupQueueService.getJob(jobId);

    if (!job) {
      err(res, 404, 'JOB_NOT_FOUND', 'Job bulunamadı');
      return;
    }

    // Check authorization
    if (user.partnerId && user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      if (job.dbRecord?.partnerId !== user.partnerId) {
        err(res, 403, 'FORBIDDEN', 'Bu job için temizlik yapma yetkiniz yok');
        return;
      }
    }

    // Perform cleanup
    if (force) {
      // Immediate cleanup
      await cleanupService.cleanupImmediate(job.data.domain, true);
      ok(res, {
        success: true,
        message: 'Temizlik hemen yapıldı (force mode)'
      });
    } else {
      // Schedule cleanup
      await cleanupService.scheduleCleanup(job.data.domain, 'manual');
      ok(res, {
        success: true,
        message: 'Temizlik planlandı'
      });
    }

  } catch (error: any) {
    console.error('[SetupQueueController] Cleanup error:', error);
    err(res, 500, 'CLEANUP_ERROR', error.message || 'Temizlik yapılamadı');
  }
});

/**
 * Get job logs (if available)
 */
setupQueueRouter.get('/job/:jobId/logs', requireScopes(SCOPES.SETUP_RUN), async (req, res): Promise<void> => {
  try {
    const { jobId } = req.params;
    const user = req.user!;

    const job = await setupQueueService.getJob(jobId);

    if (!job) {
      err(res, 404, 'JOB_NOT_FOUND', 'Job bulunamadı');
      return;
    }

    // Check authorization
    if (user.partnerId && user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      if (job.dbRecord?.partnerId !== user.partnerId) {
        err(res, 403, 'FORBIDDEN', 'Bu job\'ın loglarına erişim yetkiniz yok');
        return;
      }
    }

    // Get logs from job data
    const logs = job.failedReason ?
      [{ type: 'error', message: job.failedReason, timestamp: job.finishedAt }] :
      [];

    ok(res, { logs });

  } catch (error: any) {
    console.error('[SetupQueueController] Get logs error:', error);
    err(res, 500, 'GET_LOGS_ERROR', error.message || 'Loglar alınamadı');
  }
});

/**
 * Get queue statistics
 */
setupQueueRouter.get('/stats', requireScopes(SCOPES.SETUP_RUN), async (_req, res): Promise<void> => {
  try {
    const stats = await setupQueueService.getQueueStats();
    ok(res, { stats });

  } catch (error: any) {
    console.error('[SetupQueueController] Get stats error:', error);
    err(res, 500, 'GET_STATS_ERROR', error.message || 'İstatistikler alınamadı');
  }
});

/**
 * Run orphan cleanup (admin only)
 */
setupQueueRouter.post('/cleanup/orphans', setupQueueLimiter, requireScopes(SCOPES.SETUP_RUN), async (req, res): Promise<void> => {
  try {
    const user = req.user!;

    // Admin only
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      err(res, 403, 'FORBIDDEN', 'Bu işlem için admin yetkisi gerekli');
      return;
    }

    // Run async (don't wait)
    cleanupService.cleanupOrphans().catch(error => {
      console.error('[SetupQueueController] Orphan cleanup error:', error);
    });

    ok(res, {
      success: true,
      message: 'Orphan temizliği başlatıldı (arka planda çalışıyor)'
    });

  } catch (error: any) {
    console.error('[SetupQueueController] Orphan cleanup error:', error);
    err(res, 500, 'ORPHAN_CLEANUP_ERROR', error.message || 'Orphan temizliği başlatılamadı');
  }
});

/**
 * Get cleanup history
 */
setupQueueRouter.get('/cleanup/history', requireScopes(SCOPES.SETUP_RUN), async (req, res): Promise<void> => {
  try {
    const { domain } = req.query;
    const user = req.user!;

    // If not admin, can only see own domain cleanups
    let history;
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
      history = await cleanupService.getCleanupHistory(domain as string);
    } else {
      // For partners, would need to implement partner domain filtering
      history = [];
    }

    ok(res, { history });

  } catch (error: any) {
    console.error('[SetupQueueController] Get cleanup history error:', error);
    err(res, 500, 'GET_HISTORY_ERROR', error.message || 'Temizlik geçmişi alınamadı');
  }
});

/**
 * WebSocket event subscription endpoint
 */
setupQueueRouter.post('/subscribe/:jobId', requireScopes(SCOPES.SETUP_RUN), async (req, res): Promise<void> => {
  try {
    const { jobId } = req.params;
    const user = req.user!;

    const job = await setupQueueService.getJob(jobId);

    if (!job) {
      err(res, 404, 'JOB_NOT_FOUND', 'Job bulunamadı');
      return;
    }

    // Check authorization
    if (user.partnerId && user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      if (job.dbRecord?.partnerId !== user.partnerId) {
        err(res, 403, 'FORBIDDEN', 'Bu job\'a abone olma yetkiniz yok');
        return;
      }
    }

    // Client should handle actual WebSocket subscription
    ok(res, {
      success: true,
      message: 'WebSocket ile job-{jobId} room\'una abone olun',
      jobId,
      domain: job.data.domain
    });

  } catch (error: any) {
    console.error('[SetupQueueController] Subscribe error:', error);
    err(res, 500, 'SUBSCRIBE_ERROR', error.message || 'Abonelik oluşturulamadı');
  }
});

/**
 * Check if domain has any jobs (for preventing duplicates)
 */
setupQueueRouter.get('/check/:domain', requireScopes(SCOPES.SETUP_RUN), async (req, res): Promise<void> => {
  try {
    const rawDomain = req.params.domain;
    const domain = sanitizeDomain(rawDomain);

    const activeJobs = await setupQueueService.getActiveJobs();
    const existingJob = activeJobs.find(j => j.domain === domain);

    ok(res, {
      hasActiveJob: !!existingJob,
      job: existingJob || null
    });

  } catch (error: any) {
    console.error('[SetupQueueController] Check domain error:', error);
    err(res, 500, 'CHECK_DOMAIN_ERROR', error.message || 'Domain kontrolü yapılamadı');
  }
});
