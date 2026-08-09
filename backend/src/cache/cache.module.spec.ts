import { CacheClient } from './cache.module';

describe('CacheClient', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('evicts the oldest entry when the capacity is reached', async () => {
    const cache = new CacheClient(2);
    await cache.set('first', '1');
    await cache.set('second', '2');
    await cache.set('third', '3');

    await expect(cache.get('first')).resolves.toBeNull();
    await expect(cache.get('second')).resolves.toBe('2');
    await expect(cache.get('third')).resolves.toBe('3');
    cache.onModuleDestroy();
  });

  it('sweeps expired entries before applying the capacity limit', async () => {
    jest.useFakeTimers();
    const cache = new CacheClient(2, 60_000);
    await cache.set('expired', '1', 'EX', 1);
    jest.advanceTimersByTime(1_001);
    await cache.set('second', '2');
    await cache.set('third', '3');

    await expect(cache.get('expired')).resolves.toBeNull();
    await expect(cache.get('second')).resolves.toBe('2');
    await expect(cache.get('third')).resolves.toBe('3');
    cache.onModuleDestroy();
  });

  it('rejects invalid expiration values', async () => {
    const cache = new CacheClient();
    await expect(cache.set('key', 'value', 'EX', 0)).rejects.toThrow(
      'Cache TTL must be a positive number',
    );
    cache.onModuleDestroy();
  });
});