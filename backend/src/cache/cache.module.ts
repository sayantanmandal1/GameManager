import { Module, Global, OnModuleDestroy } from '@nestjs/common';

export const CACHE_CLIENT = 'CACHE_CLIENT';

/**
 * In-memory cache client with a tiny subset of the ioredis API
 * (`get`, `set` with optional `EX <seconds>` TTL, `del`). Lets call
 * sites that previously depended on Redis continue to work without
 * an external service. Not suitable for multi-instance deployments.
 */
export class CacheClient implements OnModuleDestroy {
  private readonly store = new Map<
    string,
    { value: string; expiresAt: number | null }
  >();
  private readonly maxEntries: number;
  private readonly sweepTimer: NodeJS.Timeout;

  constructor(maxEntries = 10_000, sweepIntervalMs = 60_000) {
    this.maxEntries = Math.max(1, maxEntries);
    this.sweepTimer = setInterval(() => this.deleteExpired(), sweepIntervalMs);
    this.sweepTimer.unref?.();
  }

  onModuleDestroy(): void {
    clearInterval(this.sweepTimer);
    this.store.clear();
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  // Overloads mirror the ioredis signatures used in this codebase.
  async set(key: string, value: string): Promise<'OK'>;
  async set(
    key: string,
    value: string,
    mode: 'EX',
    ttlSeconds: number,
  ): Promise<'OK'>;
  async set(
    key: string,
    value: string,
    mode?: 'EX',
    ttlSeconds?: number,
  ): Promise<'OK'> {
    if (
      mode === 'EX' &&
      (typeof ttlSeconds !== 'number' ||
        !Number.isFinite(ttlSeconds) ||
        ttlSeconds <= 0)
    ) {
      throw new Error('Cache TTL must be a positive number');
    }
    const expiresAt =
      mode === 'EX' && typeof ttlSeconds === 'number'
        ? Date.now() + ttlSeconds * 1000
        : null;
    this.deleteExpired();
    this.store.delete(key);
    while (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value as string | undefined;
      if (!oldestKey) break;
      this.store.delete(oldestKey);
    }
    this.store.set(key, { value, expiresAt });
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const k of keys) {
      if (this.store.delete(k)) count++;
    }
    return count;
  }

  private deleteExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt !== null && entry.expiresAt <= now) {
        this.store.delete(key);
      }
    }
  }
}

@Global()
@Module({
  providers: [
    {
      provide: CACHE_CLIENT,
      useFactory: () => new CacheClient(),
    },
  ],
  exports: [CACHE_CLIENT],
})
export class CacheModule {}
