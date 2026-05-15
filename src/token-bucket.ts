import { BunRateLimitError } from "./errors/index.ts";

interface BucketEntry {
  tokens: number;
  lastRefill: number;
}

export class TokenBucket {
  #buckets = new Map<string, BucketEntry>();
  #capacity: number;
  #refillRate: number;

  constructor(options: { capacity: number; refillPerSecond: number }) {
    if (options.capacity <= 0) throw new BunRateLimitError("capacity must be > 0");
    if (options.refillPerSecond <= 0) throw new BunRateLimitError("refillPerSecond must be > 0");
    this.#capacity = options.capacity;
    this.#refillRate = options.refillPerSecond;
  }

  tryConsume(key: string, cost = 1): boolean {
    const now = performance.now();
    let entry = this.#buckets.get(key);

    if (!entry) {
      entry = { tokens: this.#capacity, lastRefill: now };
      this.#buckets.set(key, entry);
    }

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

    const elapsed = (performance.now() - entry.lastRefill) / 1000;
    return Math.min(this.#capacity, Math.floor(entry.tokens + elapsed * this.#refillRate));
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
}
