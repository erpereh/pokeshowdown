import type { PokemonView, SwitchOption } from "@/shared/contract";
import { MiniSprite } from "@/client/sprites/MiniSprite.tsx";
import { HpBar } from "@/client/ui/HpBar.tsx";
import { StatusChip } from "@/client/ui/StatusChip.tsx";
import { toSpriteId } from "@/client/ui/format.ts";
import { cx } from "@/client/ui/cx.ts";

const REASONS = {
  active: "En combate",
  fainted: "Debilitado",
  notFainted: "Aún en pie",
} as const;

export function SwitchCard({
  option,
  mon,
  disabled,
  onPick,
}: {
  option: SwitchOption;
  mon: PokemonView | undefined;
  disabled: boolean;
  onPick: (slot: number) => void;
}) {
  const reason = option.reason ? REASONS[option.reason] : null;
  const blocked = disabled || option.disabled;
  return (
    <button
      type="button"
      disabled={blocked}
      onClick={() => onPick(option.slot)}
      className={cx(
        "flex min-h-14 w-full items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface-2/80 px-3 py-2 text-left",
        "disabled:opacity-45",
      )}
    >
      <MiniSprite
        spriteId={mon?.spriteId ?? toSpriteId(option.species)}
        alt=""
        size={48}
        shiny={mon?.shiny}
        gender={mon?.gender}
        fainted={option.disabled && option.reason === "fainted"}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display font-semibold">{option.name}</span>
        {mon ? <HpBar hp={mon.hp} maxHp={mon.maxHp} reveal="exact" /> : null}
        {reason ? <span className="text-xs text-text-dim">{reason}</span> : null}
      </span>
      {mon?.status ? <StatusChip status={mon.status} /> : null}
    </button>
  );
}
