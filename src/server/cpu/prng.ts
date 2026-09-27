import "server-only";
import { createHash } from "node:crypto";

export interface Prng {
  /** Float in [0, 1). */
  next(): number;
}

/** Deterministic PRNG. The only randomness the CPU may use, derived from `seedKey`. */
export function createPrng(seedKey: string): Prng {
  const digest = createHash("sha256").update(String(seedKey)).digest();
  let x = digest.readUInt32LE(0) || 0x6d2b79f5;
  return {
    next() {
      x ^= x << 13;
      x >>>= 0;
      x ^= x >>> 17;
      x >>>= 0;
      x ^= x << 5;
      x >>>= 0;
      return x / 4294967296;
    },
  };
}
