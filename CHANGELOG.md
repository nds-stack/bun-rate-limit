# Changelog

## [0.1.0-beta.0] - 2026-05-18

### Fixed
- NaN/Infinity in `cost` now throws instead of silently corrupting state
- NaN/Infinity in constructor options (`capacity`, `refillPerSecond`) now throws
- Unbounded Map growth: added optional `maxKeys` option with eviction
- `#evictStale()` changed from counter-based batch to `setInterval` (with `.unref()`)
- `remaining()` now updates `lastRefill` for consistency with `tryConsume()`
- 13 new tests (24 total): NaN/Infinity guards, remaining() accuracy, maxKeys eviction, concurrent access

## [0.1.0-alpha.0] - 2026-05-15
### Added
- TokenBucket rate limiter with lazy refill
- tryConsume(key, cost?), remaining(key), reset(key)
- Per-key independent buckets
- Zero dependencies
