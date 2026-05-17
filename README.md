# @nds-stack/bun-rate-limit

> Token bucket rate limiter for Bun — in-memory, per-key, zero dependencies.

[![npm version](https://img.shields.io/npm/v/%40nds-stack%2Fbun-rate-limit?color=blue&logo=npm)](https://www.npmjs.com/package/@nds-stack/bun-rate-limit)

---

## Why bun-rate-limit

Bun doesn't include a rate limiter. Most Node.js alternatives include timers, async queues, or Redis dependencies. bun-rate-limit is a pure in-memory token bucket — no timers, no I/O, zero deps.

```typescript
import { TokenBucket } from "@nds-stack/bun-rate-limit";

const limiter = new TokenBucket({ capacity: 10, refillPerSecond: 5 });

// HTTP handler
if (!limiter.tryConsume(ip)) {
  return new Response("rate limited", { status: 429 });
}
```

## API

```typescript
new TokenBucket({ capacity: number, refillPerSecond: number })
```

| Method | Returns | Description |
|--------|---------|-------------|
| `tryConsume(key, cost?)` | `boolean` | Try to consume `cost` tokens (default 1). Returns `false` if insufficient. |
| `remaining(key)` | `number` | Estimated tokens available for a key |
| `reset(key)` | `void` | Remove a key's bucket |
| `resetAll()` | `void` | Remove all buckets |
| `size` | `number` | Number of tracked keys |

## How It Works

**Token bucket algorithm**: Each key has a bucket with `capacity` tokens. On `tryConsume`:
1. Calculate elapsed time since last refill
2. Refill tokens: `new = min(capacity, old + elapsed × rate)`
3. If `new >= cost` → deduct and return `true`
4. Otherwise → return `false`

Refill is calculated lazily on access — no background timers needed. `performance.now()` provides high-precision timing.

## Benchmarks

```
Bun 1.3.13, 10000 iterations x 3 samples

Operation                 | Throughput
--------------------------|-------------
tryConsume (unique keys)  | 2.1M ops/s
tryConsume (same key)     | 3.8M ops/s
remaining                 | 4.2M ops/s
```

## Limitations

- **In-memory only** — buckets are not shared across process instances. Use Redis for distributed rate limiting.
- **Lazy refill** — tokens are refilled on access, not continuously. A key accessed after a long pause gets a full refill.
- **No sliding window** — token bucket is bursty by design. For smooth rate limiting, pair with a small capacity.

## Error Handling

### BunRateLimitError

The module exports a `BunRateLimitError` class that is thrown when invalid options are provided:

```typescript
import { TokenBucket, BunRateLimitError } from "@nds-stack/bun-rate-limit";

// Invalid capacity
new TokenBucket({ capacity: -1, refillPerSecond: 5 });
// → BunRateLimitError: capacity must be a positive integer

// Invalid refillRate
new TokenBucket({ capacity: 10, refillPerSecond: -1 });
// → BunRateLimitError: refillRate must be a positive number

// Cost must be > 0
const bucket = new TokenBucket({ capacity: 10, refillPerSecond: 5 });
bucket.tryConsume("key", 0);
// → BunRateLimitError: cost must be greater than 0

// Negative cost
bucket.tryConsume("key", -1);
// → BunRateLimitError: cost must be greater than 0
```

> `tryConsume()` returns `false` on insufficient tokens — it does **not** throw.

---

## Multi-Instance

Each `TokenBucket` instance is **independent** — buckets are stored in-memory and never shared across processes.

```typescript
// Process A
const limiterA = new TokenBucket({ capacity: 10, refillPerSecond: 5 });
limiterA.tryConsume("user:1"); // consumes from its own state

// Process B (separate instance)
const limiterB = new TokenBucket({ capacity: 10, refillPerSecond: 5 });
limiterB.tryConsume("user:1"); // independent bucket
```

For distributed rate limiting across multiple instances, use an external store like Redis:

```typescript
// Recommended: Redis-backed rate limiter for multi-instance deployments
// This module is in-memory only — pair with an external store when needed
```

---

## Customization Guide

### Log Rate Limit Hits

Wrap `tryConsume` to add logging:

```typescript
const limiter = new TokenBucket({ capacity: 100, refillPerSecond: 10 });

function consumeWithLog(key: string, cost = 1): boolean {
  const allowed = limiter.tryConsume(key, cost);
  if (!allowed) {
    console.warn(`Rate limit hit for ${key}, remaining: ${limiter.remaining(key)}`);
  }
  return allowed;
}
```

### Sliding Window Approximation

Use two token buckets to approximate a sliding window:

```typescript
const shortTerm = new TokenBucket({ capacity: 10, refillPerSecond: 10 });   // 1 second
const longTerm  = new TokenBucket({ capacity: 100, refillPerSecond: 1.67 }); // ~60 seconds

function checkRate(key: string): boolean {
  return shortTerm.tryConsume(key) && longTerm.tryConsume(key);
}
```

### Combine Multiple Buckets (IP + Endpoint)

```typescript
const ipLimiter = new TokenBucket({ capacity: 100, refillPerSecond: 10 });
const epLimiter = new TokenBucket({ capacity: 20,  refillPerSecond: 5 });

function rateLimit(ip: string, endpoint: string): boolean {
  return ipLimiter.tryConsume(ip) && epLimiter.tryConsume(endpoint);
}
```

### Reset Patterns

```typescript
// Reset a specific key
limiter.reset("user:123");

// Reset all buckets daily (e.g., via cron)
setInterval(() => limiter.resetAll(), 24 * 60 * 60 * 1000);
```

---

## Comparison Table

| Feature | Manual Implementation | `express-rate-limit` | `bottleneck` | bun-rate-limit |
|---------|----------------------|---------------------|--------------|----------------|
| Algorithm | Token bucket | Sliding window | Token bucket + queue | Token bucket |
| Bundle size | 0KB | ~15KB + deps | ~10KB + deps | **~0.8KB** |
| Memory per key | ~200 bytes | ~300 bytes | ~500 bytes | **~80 bytes** |
| Async support | Manual | ✅ | ✅ | ❌ Sync only |
| Distributed ready | ❌ | ⚠️ External store | ✅ Redis | ❌ In-memory |
| Bun-native | ✅ | ❌ Polyfills | ❌ Polyfills | ✅ |
| Zero dependencies | ✅ | ❌ | ❌ | ✅ |
| Lazy refill (no timers) | Manual | ❌ | ❌ | ✅ |

---

## License

MIT
