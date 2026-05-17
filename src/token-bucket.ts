import { BunRateLimitError } from "./errors/index.ts";

interface BucketEntry {
  tokens: number;
  lastRefill: number;
  lastAccess: number;
}

export class TokenBucket {
  #buckets = new Map<string, BucketEntry>();
  #capacity: number;
  #refillRate: number;
  #maxKeys: number;
  #staleMs: number;
  #cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: { capacity: number; refillPerSecond: number; maxKeys?: number; staleMs?: number }) {
    if (!Number.isFinite(options.capacity) || options.capacity <= 0) throw new BunRateLimitError("capacity must be > 0");
    if (!Number.isFinite(options.refillPerSecond) || options.refillPerSecond <= 0) throw new BunRateLimitError("refillPerSecond must be > 0");
    if (options.maxKeys !== undefined && (!Number.isFinite(options.maxKeys) || options.maxKeys < 0)) throw new BunRateLimitError("maxKeys must be >= 0");

    this.#capacity = options.capacity;
    this.#refillRate = options.refillPerSecond;
    this.#maxKeys = options.maxKeys ?? 0;
    this.#staleMs = options.staleMs ?? 60_000;

    this.#cleanupTimer = setInterval(() => this.#evictStale(), Math.min(this.#staleMs, 60_000));
    if (this.#cleanupTimer && "unref" in this.#cleanupTimer) {
      (this.#cleanupTimer as { unref(): void }).unref();
    }
  }

  tryConsume(key: string, cost = 1): boolean {
    if (!Number.isFinite(cost) || cost <= 0) throw new BunRateLimitError("cost must be > 0");
    if (typeof key !== "string") throw new BunRateLimitError("key must be a string");

    const now = performance.now();
    let entry = this.#buckets.get(key);

    if (!entry) {
      if (this.#maxKeys > 0 && this.#buckets.size >= this.#maxKeys) {
        this.#evictOne();
      }
      entry = { tokens: this.#capacity, lastRefill: now, lastAccess: now };
      this.#buckets.set(key, entry);
    }

    entry.lastAccess = now;
    const elapsed = (now - entry.lastRefill) / 1000;
    const refill = elapsed * this.#refillRate;
    entry.tokens = Math.min(this.#capacity, entry.tokens + refill);
    entry.lastRefill = now;

    if (entry.tokens >= cost) {
      entry.tokens -= cost;
      return true;
    }

    return false;
  }

  remaining(key: string): number {
    const entry = this.#buckets.get(key);
    if (!entry) return this.#capacity;

    const now = performance.now();
    const elapsed = (now - entry.lastRefill) / 1000;
    entry.tokens = Math.min(this.#capacity, entry.tokens + elapsed * this.#refillRate);
    entry.lastRefill = now;
    entry.lastAccess = now;
    return entry.tokens;
  }

  reset(key: string): void {
    this.#buckets.delete(key);
  }

  resetAll(): void {
    this.#buckets.clear();
  }

  get size(): number {
    return this.#buckets.size;
  }

  [Symbol.dispose](): void {
    if (this.#cleanupTimer) {
      clearInterval(this.#cleanupTimer);
      this.#cleanupTimer = null;
    }
  }

  #evictOne(): void {
    const firstKey = this.#buckets.keys().next().value;
    if (firstKey !== undefined) {
      this.#buckets.delete(firstKey);
    }
  }

  #evictStale(): void {
    const now = performance.now();
    for (const [key, entry] of this.#buckets) {
      if (now - entry.lastAccess > this.#staleMs) {
        this.#buckets.delete(key);
      }
    }
  }
}
