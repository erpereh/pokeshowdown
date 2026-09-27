import "server-only";
import type { CpuContext } from "./context.ts";
import { foePressure, type ScoredMove, scoreMove } from "./scoring.ts";

/** Terastallize the best move when STAB gain is at least 1.3× or the tera type flips a weakness. */
export function shouldTerastallize(ctx: CpuContext, best: ScoredMove | null, teraType: string | null): boolean {
  if (!best || !teraType || ctx.self.terastallized) return false;
  if (flipsWeakness(ctx, teraType)) return true;
  if (!best.damaging || best.score <= 1) return false;
  const boosted = scoreMove(ctx, { slot: best.slot, id: best.id, name: best.id }, true);
  return boosted.stab >= best.stab * 1.3 && boosted.score + 1e-4 >= best.score * 1.3;
}

export function flipsWeakness(ctx: CpuContext, teraType: string): boolean {
  if (!ctx.foe || !teraType || teraType === "Stellar") return false;
  const before = foePressure(ctx, ctx.self.types);
  const after = foePressure(ctx, [teraType]);
  return before >= 2 && after <= 1;
}
