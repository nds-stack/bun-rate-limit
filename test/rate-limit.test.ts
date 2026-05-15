import { describe, test, expect } from "bun:test";
import { TokenBucket } from "../src/index.ts";

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
    expect(tb.remaining("key")).toBe(6);
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
    expect(tb.remaining("key")).toBe(5);
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
});
