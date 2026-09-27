"use client";

import { useEffect, useState } from "react";
import type { PlayerChoice, PlayerRequest, PokemonView, SideView } from "@/shared/contract";
import { MiniSprite } from "@/client/sprites/MiniSprite.tsx";
import { GameButton } from "@/client/ui/GameButton.tsx";
import { SegmentedControl } from "@/client/ui/SegmentedControl.tsx";
import { TypeChip } from "@/client/ui/TypeChip.tsx";
import { cx } from "@/client/ui/cx.ts";
import { MoveButton } from "./MoveButton.tsx";
import { SwitchCard } from "./SwitchCard.tsx";

type Tab = "fight" | "switch";

function TeamPreview({
  you,
  foe,
  disabled,
  onConfirm,
}: {
  you: PokemonView[];
  foe: PokemonView[];
  disabled: boolean;
  onConfirm: (order: number[]) => void;
}) {
  const [lead, setLead] = useState<number | null>(null);
  const slots = [1, 2, 3, 4, 5, 6];

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="font-display text-lg font-bold">¿Qué Pokémon sacarás?</h2>
        <p className="text-sm text-text-dim">Elige a tu primer Pokémon. El resto conserva el orden del equipo.</p>
      </div>
      <ul className="grid grid-cols-3 gap-2">
        {you.map((mon) => {
          const selected = lead === mon.slot;
          return (
            <li key={mon.slot}>
              <button
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                onClick={() => setLead(mon.slot)}
                className={cx(
                  "flex min-h-14 w-full flex-col items-center rounded-[var(--radius-card)] border px-1 py-2",
                  selected ? "border-accent bg-accent/15" : "border-line bg-bg-0/30",
                )}
              >
                <MiniSprite spriteId={mon.spriteId} alt={mon.name} size={48} shiny={mon.shiny} gender={mon.gender} />
                <span className="w-full truncate text-center text-xs font-semibold">{mon.name}</span>
                {selected ? <span className="text-[10px] font-bold uppercase text-accent">Sale primero</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
      <div>
        <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-text-dim">Equipo rival</h3>
        <ul className="mt-2 grid grid-cols-6 gap-1">
          {foe.map((mon) => (
            <li key={mon.slot} className="min-w-0 text-center">
              <MiniSprite spriteId={mon.spriteId} alt={mon.name} size={40} shiny={mon.shiny} gender={mon.gender} />
              <span className="block truncate text-[10px]">{mon.name}</span>
            </li>
          ))}
        </ul>
      </div>
      <GameButton
        type="button"
        disabled={disabled || lead === null}
        onClick={() => {
          if (lead === null) return;
          onConfirm([lead, ...slots.filter((slot) => slot !== lead)]);
        }}
      >
        Confirmar liderato
      </GameButton>
    </div>
  );
}

export function ActionPanel({
  request,
  you,
  foe,
  locked,
  onChoice,
}: {
  request: PlayerRequest | null;
  you: SideView | null;
  foe: SideView | null;
  locked: boolean;
  onChoice: (choice: PlayerChoice) => void;
}) {
  const [tab, setTab] = useState<Tab>("fight");
  const [tera, setTera] = useState(false);

  useEffect(() => {
    setTab("fight");
    setTera(false);
  }, [request?.rqid]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.repeat || locked || !request) return;
      if (document.querySelector("[role='dialog']")) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (event.key === "Escape") {
        if (tab === "switch" && request.kind === "move") setTab("fight");
        return;
      }
      if (request.kind !== "move") return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        setTab("switch");
        return;
      }
      if (key === "t" && request.canTerastallize) {
        event.preventDefault();
        setTera((value) => !value);
        return;
      }
      if (tab !== "fight") return;
      const index = Number(key);
      if (index >= 1 && index <= 4) {
        const move = request.moves.find((entry) => entry.slot === index);
        if (!move || move.disabled) return;
        event.preventDefault();
        onChoice({ kind: "move", slot: move.slot, terastallize: tera || undefined });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked, onChoice, request, tab, tera]);

  if (locked) {
    return <p className="px-3 py-6 text-center font-display text-sm uppercase tracking-widest text-text-dim">Resolviendo turno…</p>;
  }
  if (!request || request.kind === "wait") {
    return <p className="px-3 py-6 text-center font-display text-sm uppercase tracking-widest text-text-dim">Esperando…</p>;
  }
  if (request.kind === "teamPreview") {
    return (
      <div className="px-3 py-3">
        <TeamPreview you={you?.team ?? []} foe={foe?.team ?? []} disabled={locked} onConfirm={(order) => onChoice({ kind: "teamPreview", order })} />
      </div>
    );
  }

  const forced = request.kind === "switch";
  const showMoves = !forced && tab === "fight";

  return (
    <div className="flex min-h-0 flex-col gap-2 px-2 py-2 sm:px-3">
      {forced ? (
        <div>
          <h2 className="font-display text-lg font-bold">
            {request.reviving ? "¿A qué Pokémon debilitado pasarás?" : "¿Qué Pokémon sacarás?"}
          </h2>
          {request.reviving ? (
            <p className="text-sm text-text-dim">Bendición Revivir solo puede ir a un aliado debilitado.</p>
          ) : null}
        </div>
      ) : (
        <SegmentedControl
          label="Acción"
          value={tab}
          onChange={setTab}
          options={[
            { value: "fight", label: "Luchar" },
            { value: "switch", label: "Pokémon" },
          ]}
        />
      )}
      {showMoves ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            {request.moves.map((move) => (
              <MoveButton key={move.slot} move={move} disabled={locked} onSelect={(slot) => onChoice({ kind: "move", slot, terastallize: tera || undefined })} />
            ))}
          </div>
          {request.canTerastallize ? (
            <button
              type="button"
              aria-pressed={tera}
              onClick={() => setTera((value) => !value)}
              className={cx(
                "flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-card)] border px-3 font-display text-sm font-semibold uppercase",
                tera ? "border-accent bg-accent/15 text-accent" : "border-line text-text",
              )}
            >
              Teracristalizar
              <TypeChip type={request.canTerastallize} size="sm" />
            </button>
          ) : null}
          <p className="hidden text-[11px] text-text-dim lg:block">Teclas: 1–4 movimientos, T teracristal, S cambiar, Esc cerrar.</p>
        </>
      ) : (
        <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
          {request.trapped && !forced ? <p className="text-sm text-text-dim">No puedes cambiar: tu Pokémon está atrapado.</p> : null}
          {request.switches.map((option) => (
            <SwitchCard
              key={option.slot}
              option={option}
              mon={you?.team.find((mon) => mon.slot === option.slot)}
              disabled={locked || (request.trapped && !forced)}
              onPick={(slot) => onChoice({ kind: "switch", slot })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
