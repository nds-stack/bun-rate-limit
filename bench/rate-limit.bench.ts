/* eslint-disable no-console */
import { TokenBucket } from "../src/index.ts";

const iterations = 10_000;
const samples = 3;

function bench(fn: () => void): number {
  fn();
  const start = performance.now();
  for (let s = 0; s < samples; s++) fn();
  return Math.round((iterations * samples) / ((performance.now() - start) / 1000));
}

const tb = new TokenBucket({ capacity: 1000, refillPerSecond: 10000 });

const results = [
  { name: "tryConsume (hit)", ops: bench(() => { for (let i = 0; i < iterations; i++) tb.tryConsume(`k${i}`, 1); }) },
  { name: "tryConsume (same key)", ops: bench(() => { for (let i = 0; i < iterations; i++) tb.tryConsume("same", 1); }) },
  { name: "remaining", ops: bench(() => { for (let i = 0; i < iterations; i++) tb.remaining("test"); }) },
];

const pad = (s: string, n: number) => s.padEnd(n);
const opPad = results.reduce((m, r) => Math.max(m, r.name.length), 0);

console.log("--- bun-rate-limit Benchmark ---");
console.log(`Bun ${Bun.version}, ${iterations} iterations x ${samples} samples\n`);
console.log(`${pad("Operation", opPad + 2)} | ${pad("Throughput", 14)}`);
console.log(`${"-".repeat(opPad + 2)}-|-${"-".repeat(14)}`);

for (const r of results) {
  const ops = r.ops > 1_000_000 ? `${(r.ops / 1_000_000).toFixed(1)}M ops/s` : `${(r.ops / 1_000).toFixed(0)}K ops/s`;
  console.log(`${pad(r.name, opPad + 2)} | ${pad(ops, 14)}`);
}
