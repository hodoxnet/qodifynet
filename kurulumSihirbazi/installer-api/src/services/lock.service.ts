import Redis from 'ioredis';
import { SettingsService } from './settings.service';

export type LockStatus = 'reserved' | 'committing' | 'completed';
export type LockRecord = { ledgerId?: string; status: LockStatus; timestamp: number };

export class LockService {
  private host: string = '127.0.0.1';
  private port: number = 6379;
  private redis?: Redis;
  private settingsPromise: Promise<void> | null = null;
  private fallback = new Map<string, LockRecord>();
  private CHECK_INTERVAL_MS = 5000;
  private statusCache: { available: boolean; checkedAt: number } = { available: false, checkedAt: 0 };

  constructor() {
    // Fallback cleanup for memory map (TTL ~15 min)
    setInterval(() => this.cleanupFallback(), 60_000);
  }

  private key(partnerId: string) { return `setup:lock:${partnerId}`; }

  private async ensureSettings() {
    if (!this.settingsPromise) {
      this.settingsPromise = (async () => {
        try {
          const settings = await new SettingsService().getSettings();
          if (settings.redis?.host) this.host = settings.redis.host;
          if (settings.redis?.port) this.port = settings.redis.port;
        } catch {}
        const host = process.env.REDIS_HOST || this.host;
        const port = Number(process.env.REDIS_PORT || this.port);
        this.redis = new Redis({ host, port, lazyConnect: true, maxRetriesPerRequest: 0, enableOfflineQueue: false, retryStrategy: () => null });
        this.redis.on('connect', () => { this.statusCache = { available: true, checkedAt: Date.now() }; });
        this.redis.on('error', () => { this.statusCache = { available: false, checkedAt: Date.now() }; });
        try { await this.redis.connect(); this.statusCache = { available: true, checkedAt: Date.now() }; } catch { this.statusCache = { available: false, checkedAt: Date.now() }; }
      })();
    }
    await this.settingsPromise;
  }

  private async redisAvailable(): Promise<boolean> {
    await this.ensureSettings();
    if (!this.redis) return false;
    if (Date.now() - this.statusCache.checkedAt < this.CHECK_INTERVAL_MS) return this.statusCache.available;
    try { await this.redis.ping(); this.statusCache = { available: true, checkedAt: Date.now() }; }
    catch { this.statusCache = { available: false, checkedAt: Date.now() }; }
    return this.statusCache.available;
  }

  async get(partnerId: string): Promise<LockRecord | undefined> {
    if (!(await this.redisAvailable())) return this.getFromFallback(partnerId);
    try {
      const s = await this.redis!.get(this.key(partnerId));
      if (!s) return undefined;
      return JSON.parse(s) as LockRecord;
    } catch { return undefined; }
  }

  async acquire(partnerId: string, ttlSec: number, ledgerId?: string): Promise<boolean> {
    const value = JSON.stringify({ ledgerId, status: 'reserved', timestamp: Date.now() } satisfies LockRecord);
    if (!(await this.redisAvailable())) return this.acquireFallback(partnerId, ttlSec, ledgerId);
    try {
      const result = await this.redis!.set(this.key(partnerId), value, 'EX', ttlSec, 'NX');
      return result === 'OK';
    } catch {
      return this.acquireFallback(partnerId, ttlSec, ledgerId);
    }
  }

  async updateStatus(partnerId: string, status: LockStatus, ttlSec?: number): Promise<boolean> {
    if (!(await this.redisAvailable())) return this.updateFallback(partnerId, status);
    try {
      const current = await this.get(partnerId);
      if (!current) return false;
      const value = JSON.stringify({ ...current, status, timestamp: Date.now() });
      let res: string | null;
      if (typeof ttlSec === 'number') {
        res = await this.redis!.set(this.key(partnerId), value, 'EX', ttlSec, 'XX');
      } else {
        res = await this.redis!.set(this.key(partnerId), value, 'XX');
      }
      return res === 'OK';
    } catch {
      return this.updateFallback(partnerId, status);
    }
  }

  async release(partnerId: string): Promise<void> {
    if (!(await this.redisAvailable())) { this.fallback.delete(partnerId); return; }
    try { await this.redis!.del(this.key(partnerId)); }
    catch { this.fallback.delete(partnerId); }
  }

  // Fallback helpers (with TTL ~15 min)
  private getFromFallback(partnerId: string): LockRecord | undefined {
    const rec = this.fallback.get(partnerId);
    if (!rec) return undefined;
    if (Date.now() - rec.timestamp > 15 * 60 * 1000) { this.fallback.delete(partnerId); return undefined; }
    return rec;
  }
  private acquireFallback(partnerId: string, _ttlSec: number, ledgerId?: string): boolean {
    const existing = this.getFromFallback(partnerId);
    if (existing) return false;
    this.fallback.set(partnerId, { ledgerId, status: 'reserved', timestamp: Date.now() });
    return true;
  }
  private updateFallback(partnerId: string, status: LockStatus): boolean {
    const rec = this.getFromFallback(partnerId);
    if (!rec) return false;
    this.fallback.set(partnerId, { ...rec, status, timestamp: Date.now() });
    return true;
  }
  private cleanupFallback() {
    const now = Date.now();
    for (const [k, v] of this.fallback.entries()) {
      if (now - v.timestamp > 15 * 60 * 1000) this.fallback.delete(k);
    }
  }
}
