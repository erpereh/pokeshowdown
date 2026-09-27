import type { BattleResult, FormatId } from "@/shared/contract";

export function formatName(id: FormatId): string {
  return id === "gen9ou" ? "Gen 9 OU" : "Gen 9 Random Battle";
}

export function formatBlurb(id: FormatId): string {
  return id === "gen9ou" ? "Equipos propios o aleatorios validados" : "Equipos oficiales generados por Showdown";
}

export function resultBadge(
  result: BattleResult | null,
  endReason: "normal" | "forfeit" | null,
): { text: string; className: string } {
  if (endReason === "forfeit") return { text: "Rendición", className: "border-line-strong text-text-dim" };
  if (result === "win") return { text: "Victoria", className: "border-success/50 text-success" };
  if (result === "loss") return { text: "Derrota", className: "border-danger/50 text-danger" };
  if (result === "tie") return { text: "Empate", className: "border-accent-2/50 text-accent-2" };
  return { text: "En curso", className: "border-accent/40 text-accent" };
}

export function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

/** Showdown toID: lowercase and strip every non-alphanumeric. */
export function toSpriteId(species: string): string {
  return species.toLowerCase().replace(/[^a-z0-9]+/g, "");
}
