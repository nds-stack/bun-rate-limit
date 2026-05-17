import { describe, test, expect } from "bun:test";
import { TokenBucket, BunRateLimitError } from "../src/index.ts";

describe("TokenBucket", () => {
  test("allows consumption within capacity", () => {
    const tb = new TokenBucket({ capacity: 10, refillPerSecond: 5 });
    expect(tb.tryConsume("key", 3)).toBe(true);
    expect(tb.tryConsume("key", 3)).toBe(true);
    expect(tb.tryConsume("key", 3)).toBe(true);
    expect(tb.tryConsume("key", 3)).toBe(false);
  });

  test("returns remaining tokens", () => {
    const tb = new TokenBucket({ capacity: 10, refillPerSecond: 5 });
    tb.tryConsume("key", 4);
    expect(tb.remaining("key")).toBeCloseTo(6, 2);
  });

  test("refills over time", async () => {
    const tb = new TokenBucket({ capacity: 10, refillPerSecond: 100 });
    tb.tryConsume("key", 10);
    expect(tb.tryConsume("key", 1)).toBe(false);
    await Bun.sleep(50);
    expect(tb.tryConsume("key", 5)).toBe(true);
  });

  test("does not exceed capacity", async () => {
    const tb = new TokenBucket({ capacity: 5, refillPerSecond: 100 });
    await Bun.sleep(100);
    expect(tb.remaining("key")).toBeCloseTo(5, 1);
  });

  test("reset clears bucket", () => {
    const tb = new TokenBucket({ capacity: 5, refillPerSecond: 5 });
    tb.tryConsume("key", 5);
    expect(tb.tryConsume("key", 1)).toBe(false);
    tb.reset("key");
    expect(tb.tryConsume("key", 5)).toBe(true);
  });

  test("resetAll clears all buckets", () => {
    const tb = new TokenBucket({ capacity: 3, refillPerSecond: 5 });
    tb.tryConsume("a", 3);
    tb.tryConsume("b", 3);
    tb.resetAll();
    expect(tb.tryConsume("a", 3)).toBe(true);
    expect(tb.tryConsume("b", 3)).toBe(true);
  });

  test("size returns bucket count", () => {
    const tb = new TokenBucket({ capacity: 5, refillPerSecond: 5 });
    tb.tryConsume("a", 1);
    tb.tryConsume("b", 1);
    tb.tryConsume("c", 1);
    expect(tb.size).toBe(3);
  });

  test("throws on invalid capacity", () => {
    expect(() => new TokenBucket({ capacity: 0, refillPerSecond: 5 })).toThrow();
  });

  test("throws on invalid refill rate", () => {
    expect(() => new TokenBucket({ capacity: 5, refillPerSecond: 0 })).toThrow();
  });

  test("different keys are independent", () => {
    const tb = new TokenBucket({ capacity: 5, refillPerSecond: 5 });
    tb.tryConsume("user:1", 5);
    expect(tb.tryConsume("user:2", 5)).toBe(true);
  });

  test("remaining returns capacity for unknown key", () => {
    const tb = new TokenBucket({ capacity: 10, refillPerSecond: 5 });
    expect(tb.remaining("unknown")).toBe(10);
  });

  test("throws on NaN cost", () => {
    const tb = new TokenBucket({ capacity: 10, refillPerSecond: 5 });
    expect(() => tb.tryConsume("key", NaN)).toThrow("cost must be > 0");
  });

  test("throws on negative cost", () => {
    const tb = new TokenBucket({ capacity: 10, refillPerSecond: 5 });
    expect(() => tb.tryConsume("key", -1)).toThrow("cost must be > 0");
  });

  test("throws on Infinity cost", () => {
    const tb = new TokenBucket({ capacity: 10, refillPerSecond: 5 });
    expect(() => tb.tryConsume("key", Infinity)).toThrow("cost must be > 0");
  });

  test("empty string key works", () => {
    const tb = new TokenBucket({ capacity: 5, refillPerSecond: 5 });
    expect(tb.tryConsume("", 1)).toBe(true);
    expect(tb.tryConsume("", 5)).toBe(false);
    tb.reset("");
    expect(tb.tryConsume("", 5)).toBe(true);
  });

  test("throws on Infinity capacity", () => {
    expect(() => new TokenBucket({ capacity: Infinity, refillPerSecond: 5 })).toThrow("capacity must be > 0");
  });

  test("throws on NaN capacity", () => {
    expect(() => new TokenBucket({ capacity: NaN, refillPerSecond: 5 })).toThrow("capacity must be > 0");
  });

  test("throws on Infinity refillPerSecond", () => {
    expect(() => new TokenBucket({ capacity: 5, refillPerSecond: Infinity })).toThrow("refillPerSecond must be > 0");
  });

  test("throws on NaN refillPerSecond", () => {
    expect(() => new TokenBucket({ capacity: 5, refillPerSecond: NaN })).toThrow("refillPerSecond must be > 0");
  });

  test("remaining() accuracy after tryConsume and refill", async () => {
    const tb = new TokenBucket({ capacity: 100, refillPerSecond: 100 });
    tb.tryConsume("key", 40);
    expect(tb.remaining("key")).toBeCloseTo(60, 2);
    await Bun.sleep(500);
    const rem = tb.remaining("key");
    expect(rem).toBeCloseTo(100, 0);
    expect(tb.tryConsume("key", 100)).toBe(true);
  });

  test("concurrent tryConsume from multiple async contexts", async () => {
    const tb = new TokenBucket({ capacity: 100, refillPerSecond: 1000 });
    const concurrency = 10;
    const promises: Promise<boolean>[] = [];
    for (let i = 0; i < concurrency; i++) {
      promises.push(
        Promise.resolve().then(() => tb.tryConsume("shared", 5)),
      );
    }
    const results = await Promise.all(promises);
    const allowed = results.filter(Boolean).length;
    expect(allowed).toBeGreaterThanOrEqual(1);
    expect(tb.remaining("shared")).toBeGreaterThanOrEqual(100 - allowed * 5);
  });

  test("maxKeys eviction evicts oldest entry", () => {
    const tb = new TokenBucket({ capacity: 10, refillPerSecond: 10, maxKeys: 3 });
    tb.tryConsume("a", 1);
    tb.tryConsume("b", 1);
    tb.tryConsume("c", 1);
    expect(tb.size).toBe(3);
    tb.tryConsume("d", 1);
    expect(tb.size).toBe(3);
    expect(tb.remaining("a")).toBe(10);
    expect(tb.remaining("d")).toBeCloseTo(9, 1);
  });

  test("maxKeys 0 means unlimited", () => {
    const tb = new TokenBucket({ capacity: 10, refillPerSecond: 10, maxKeys: 0 });
    for (let i = 0; i < 1000; i++) {
      tb.tryConsume(`key-${i}`, 1);
    }
    expect(tb.size).toBe(1000);
  });

  test("BunRateLimitError is exported", () => {
    const err = new BunRateLimitError("test");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("BunRateLimitError");
  });
});
