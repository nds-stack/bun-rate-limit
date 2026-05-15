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

## License

MIT
