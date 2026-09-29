import type { BoostId, SideId, SideView } from "@/shared/contract";
import { ItemIcon } from "@/client/sprites/ItemIcon.tsx";
import { HpBar } from "@/client/ui/HpBar.tsx";
import { StatusChip } from "@/client/ui/StatusChip.tsx";
import { TypeChip } from "@/client/ui/TypeChip.tsx";
import { BOOST_SHORT, VOLATILE_ES, effectId, genderMark } from "./labels.ts";

function BallRow({ side }: { side: SideView }) {
  const count = Math.max(side.teamSize, 1);
  const fainted = side.team.filter((mon) => mon.fainted).length;
  const remaining = Math.max(0, count - fainted);
  return (
    <div className="mt-1 flex gap-1" aria-label={`${remaining} de ${count} Pokémon en pie`}>
      {Array.from({ length: count }, (_, index) => {
        const mon = side.team.find((entry) => entry.slot === index + 1);
        const isFainted = Boolean(mon?.fainted);
        const known = Boolean(mon);
        return (
          <span
            key={index}
            title={mon ? `${mon.name}${isFainted ? " debilitado" : ""}` : "Sin revelar"}
            className="inline-block size-2.5 rounded-full border border-white/70"
            style={{
              background: isFainted
                ? "#9aa4c055"
                : known
                  ? "linear-gradient(#f0544f 0 46%, #111729 46% 54%, #eef2ff 54% 100%)"
                  : "transparent",
            }}
          />
        );
      })}
    </div>
  );
}

function Boosts({ boosts }: { boosts: Partial<Record<BoostId, number>> }) {
  const entries = Object.entries(boosts).filter((entry): entry is [BoostId, number] => typeof entry[1] === "number" && entry[1] !== 0);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([stat, amount]) => (
        <span key={stat} className={`rounded bg-black/40 px-1 text-[10px] font-bold ${amount > 0 ? "text-success" : "text-danger"}`}>
          {amount > 0 ? `+${amount}` : amount} {BOOST_SHORT[stat]}
        </span>
      ))}
    </div>
  );
}

export function HudCard({ sideId, side }: { sideId: SideId; side: SideView }) {
  const mon = side.active;
  const mark = mon ? genderMark(mon.gender) : null;
  return (
    <div data-fx-hud={sideId} className="pointer-events-none rounded-[var(--radius-card)] border border-line-strong bg-bg-0/90 px-2.5 py-2 shadow-[inset_0_1px_0_#ffffff10,0_8px_24px_#00000055]">
      <p className="font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-text-dim">{sideId === "p1" ? "Tú" : "Rival"}</p>
      {mon ? (
        <>
          <div className="flex items-center gap-1">
            <p className="min-w-0 flex-1 truncate font-display text-sm font-bold leading-tight">
              {mon.name}{" "}
              {mark ? (
                <span className={mon.gender === "M" ? "text-accent-2" : "text-type-fairy"} aria-label={mon.gender === "M" ? "macho" : "hembra"}>
                  {mark}
                </span>
              ) : null}
            </p>
            <span className="tabular shrink-0 text-[11px] text-text-dim">Nv.{mon.level}</span>
            {mon.item && mon.itemSpriteNum != null ? <ItemIcon spriteNum={mon.itemSpriteNum} name={mon.item} size={18} /> : null}
          </div>
          <HpBar hp={mon.hp} maxHp={mon.maxHp} reveal={sideId === "p1" ? "exact" : "percent"} />
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {mon.status ? <StatusChip status={mon.status} /> : null}
            {mon.terastallized ? <TypeChip type={mon.terastallized} size="sm" /> : null}
            <Boosts boosts={mon.boosts} />
          </div>
          {mon.volatiles.length > 0 ? (
            <p className="mt-0.5 truncate text-[10px] text-text-dim">
              {mon.volatiles
                .slice(0, 2)
                .map((volatile) => VOLATILE_ES[effectId(volatile)] ?? volatile)
                .join(" · ")}
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-xs text-text-dim">Sin Pokémon en juego</p>
      )}
      <BallRow side={side} />
    </div>
  );
}
