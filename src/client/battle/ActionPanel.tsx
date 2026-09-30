"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { PlayerChoice, PlayerRequest, PokemonView, SideView } from "@/shared/contract";
import { MiniSprite } from "@/client/sprites/MiniSprite.tsx";
import { Pokeball, PokeballDeco } from "@/client/ui/Card.tsx";
import { GameButton } from "@/client/ui/GameButton.tsx";
import { Icon, type IconName } from "@/client/ui/Icon.tsx";
import { TypeChip, typeCardColor } from "@/client/ui/TypeChip.tsx";
import { cx } from "@/client/ui/cx.ts";
import { MoveButton } from "./MoveButton.tsx";
import { SwitchCard } from "./SwitchCard.tsx";

type View = "menu" | "fight" | "switch";

function TeamPreview({
  you,
  foe,
  previewSize,
  disabled,
  onConfirm,
}: {
  you: PokemonView[];
  foe: PokemonView[];
  previewSize: number;
  disabled: boolean;
  onConfirm: (order: number[]) => void;
}) {
  const [lead, setLead] = useState<number | null>(null);
  const slots = you.map((mon) => mon.slot);
  const size = previewSize > 0 ? Math.min(previewSize, slots.length) : slots.length;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="font-display text-lg font-bold">¿Qué Pokémon sacarás?</h2>
        <p className="text-sm text-text-dim">Elige a tu primer Pokémon. El resto conserva el orden del equipo.</p>
      </div>
      <ul className="stagger grid grid-cols-3 gap-2">
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
                  "press flex min-h-14 w-full flex-col items-center rounded-[20px] border-2 px-1 py-2",
                  selected ? "border-accent-2 bg-accent-2/10" : "border-line bg-surface-2",
                )}
              >
                <MiniSprite spriteId={mon.spriteId} alt={mon.name} size={48} shiny={mon.shiny} gender={mon.gender} />
                <span className="font-display w-full truncate text-center text-xs font-semibold">{mon.name}</span>
                {selected ? <span className="animate-pop-in text-[10px] font-bold uppercase text-accent-2">Sale primero</span> : null}
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
        size="lg"
        disabled={disabled || lead === null}
        onClick={() => {
          if (lead === null) return;
          onConfirm([lead, ...slots.filter((slot) => slot !== lead)].slice(0, size));
        }}
      >
        Confirmar liderato
      </GameButton>
    </div>
  );
}

function MenuTile({
  label,
  icon,
  color,
  onClick,
  disabled,
  pressed,
  ariaLabel,
  children,
}: {
  label: string;
  ariaLabel?: string;
  icon: IconName;
  color: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      aria-label={ariaLabel}
      className="menu-tile press"
      style={{ "--tile-color": color } as CSSProperties}
    >
      <PokeballDeco />
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/20"><Icon name={icon} className="size-5" /></span>
      <span className="min-w-0 flex-1 leading-tight">
        {label}
        {children}
      </span>
    </button>
  );
}

function BackBar({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <div className="flex min-h-12 items-center gap-2">
      {onBack ? (
        <button type="button" onClick={onBack} aria-label="Atrás" className="-ml-2 flex size-12 shrink-0 items-center justify-center rounded-full text-text hover:bg-surface-2">
          <Icon name="back" className="size-6" />
        </button>
      ) : null}
      <h2 className="font-display min-w-0 flex-1 text-lg font-bold leading-tight">{title}</h2>
    </div>
  );
}

function Waiting({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-3 py-6">
      <Pokeball className="animate-wobble size-9 origin-bottom" />
      <p className="font-display text-sm font-semibold uppercase tracking-widest text-text-dim">{label}</p>
    </div>
  );
}

export function ActionPanel({
  request,
  you,
  foe,
  locked,
  onChoice,
  onForfeit,
}: {
  request: PlayerRequest | null;
  you: SideView | null;
  foe: SideView | null;
  locked: boolean;
  onChoice: (choice: PlayerChoice) => void;
  /** Opens the forfeit confirmation (the "Huir" option of the battle menu). */
  onForfeit?: () => void;
}) {
  const [view, setView] = useState<View>("menu");
  const [tera, setTera] = useState(false);

  useEffect(() => {
    setView("menu");
    setTera(false);
  }, [request?.rqid]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.repeat || locked || !request) return;
      if (document.querySelector("[role='dialog']")) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (event.key === "Escape") {
        if (view !== "menu" && request.kind === "move") setView("menu");
        return;
      }
      if (request.kind !== "move") return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        setView("switch");
        return;
      }
      if (key === "f") {
        event.preventDefault();
        setView("fight");
        return;
      }
      if (key === "t" && request.canTerastallize) {
        event.preventDefault();
        setTera((value) => !value);
        return;
      }
      if (view === "switch") return;
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
  }, [locked, onChoice, request, view, tera]);

  if (locked) return <Waiting label="Resolviendo turno…" />;
  if (!request || request.kind === "wait") return <Waiting label="Esperando…" />;
  if (request.kind === "teamPreview") {
    return (
      <div className="mx-auto w-full max-w-3xl px-3 py-3 sm:px-4">
        <TeamPreview key={request.rqid} you={you?.team ?? []} foe={foe?.team ?? []} previewSize={request.teamPreviewSize} disabled={locked} onConfirm={(order) => onChoice({ kind: "teamPreview", order })} />
      </div>
    );
  }

  const forced = request.kind === "switch";
  const current: View = forced ? "switch" : view;
  const teraType = request.canTerastallize;

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-col gap-3 px-3 py-3 sm:px-4">
      {current === "menu" ? (
        <div key="menu" className="panel-slide grid grid-cols-2 gap-2.5">
          <MenuTile label="Luchar" icon="bolt" color="#dc2f3c" onClick={() => setView("fight")} />
          <MenuTile label="Pokémon" icon="swap" color="#26a377" onClick={() => setView("switch")} />
          <MenuTile
            label="Tera"
            ariaLabel={teraType ? `Teracristalizar (${teraType})` : "Teracristalizar no disponible"}
            icon="gem"
            color={teraType ? typeCardColor(teraType) : "#8f9384"}
            disabled={!teraType}
            onClick={() => {
              setTera(true);
              setView("fight");
            }}
          >
            {teraType ? (
              <span className="mt-0.5 block"><TypeChip type={teraType} size="sm" tone="soft" /></span>
            ) : (
              <span className="mt-0.5 block text-xs font-medium text-white/85">No disponible</span>
            )}
          </MenuTile>
          <MenuTile label="Huir" icon="flag" color="#5f6b7a" disabled={!onForfeit} onClick={() => onForfeit?.()}>
            <span className="mt-0.5 block text-xs font-medium text-white/85">Rendirse</span>
          </MenuTile>
          <p className="col-span-2 hidden text-[11px] text-text-dim lg:block">Teclas: F luchar, 1–4 movimientos, T teracristal, S cambiar, Esc volver.</p>
        </div>
      ) : null}

      {current === "fight" ? (
        <div key="fight" className="panel-slide flex flex-col gap-2.5">
          <BackBar title="¿Qué movimiento?" onBack={() => setView("menu")} />
          <div className="grid grid-cols-2 gap-2.5">
            {request.moves.map((move) => (
              <MoveButton key={move.slot} move={move} disabled={locked} tera={tera} onSelect={(slot) => onChoice({ kind: "move", slot, terastallize: tera || undefined })} />
            ))}
          </div>
          {teraType ? (
            <button
              type="button"
              aria-pressed={tera}
              onClick={() => setTera((value) => !value)}
              className={cx(
                "press font-display flex min-h-12 items-center justify-center gap-2 rounded-full border-2 px-3 text-sm font-semibold",
                tera ? "border-accent-2 bg-accent-2 text-white" : "border-line bg-surface text-text",
              )}
            >
              <Icon name="gem" className="size-4" />
              Teracristalizar
              <TypeChip type={teraType} size="sm" />
            </button>
          ) : null}
        </div>
      ) : null}

      {current === "switch" ? (
        <div key="switch" className="panel-slide flex min-h-0 flex-col gap-2">
          {forced ? (
            <div>
              <BackBar title={request.reviving ? "¿A qué Pokémon revivirás?" : "¿Qué Pokémon sacarás?"} />
              {request.reviving ? (
                <p className="text-sm text-text-dim">Bendición Revivir recupera la mitad de los PS de un aliado debilitado. El Pokémon activo sigue en el campo.</p>
              ) : null}
            </div>
          ) : (
            <BackBar title="Cambiar de Pokémon" onBack={() => setView("menu")} />
          )}
          {request.trapped && !forced ? <p className="text-sm text-text-dim">No puedes cambiar: tu Pokémon está atrapado.</p> : null}
          <div className="stagger flex flex-col gap-2">
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
        </div>
      ) : null}
    </div>
  );
}
