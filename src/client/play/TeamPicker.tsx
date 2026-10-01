"use client";

import Link from "next/link";
import { MiniSprite } from "@/client/sprites/MiniSprite.tsx";
import { EmptyState } from "@/client/ui/EmptyState.tsx";
import { GameLink } from "@/client/ui/GameButton.tsx";
import { cx } from "@/client/ui/cx.ts";
import { toSpriteId } from "@/client/ui/format.ts";
import type { PokemonSetData, TeamSummary } from "@/shared/contract";

/** Shared by the single player setup and the online challenge lobby. */

export function TeamPreviewGrid({ sets }: { sets: PokemonSetData[] }) {
  return (
    <ul className="stagger grid grid-cols-3 gap-2">
      {sets.map((set, index) => (
        <li key={`${set.species}-${index}`} className="min-w-0 rounded-[var(--radius-card)] bg-surface-2 p-2 text-center">
          <MiniSprite
            spriteId={toSpriteId(set.species)}
            alt={set.species}
            size={48}
            shiny={set.shiny}
            gender={set.gender === "M" || set.gender === "F" ? set.gender : undefined}
          />
          <p className="font-display truncate text-xs font-semibold">{set.name || set.species}</p>
        </li>
      ))}
    </ul>
  );
}

export function SavedTeamList({
  teams,
  error,
  loading,
  selectedId,
  disabled,
  onSelect,
}: {
  teams: TeamSummary[];
  error: string | null;
  loading: boolean;
  selectedId: string | null;
  disabled?: boolean;
  onSelect: (teamId: string) => void;
}) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      {loading ? <p className="text-sm text-text-dim">Cargando equipos…</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {!loading && !error && teams.length === 0 ? (
        <EmptyState title="Sin equipos" body="Guarda un equipo OU válido para usarlo aquí." action={<GameLink href="/teams/new">Crear equipo</GameLink>} />
      ) : null}
      <ul className="stagger flex flex-col gap-2">
        {teams.map((team) => {
          const selected = selectedId === team.id;
          return (
            <li key={team.id} className="flex flex-col gap-1">
              <button
                type="button"
                disabled={!team.valid || disabled}
                aria-pressed={selected}
                onClick={() => onSelect(team.id)}
                className={cx(
                  "press flex min-h-16 w-full items-center gap-2 rounded-[20px] border-2 px-3 py-2 text-left",
                  selected ? "border-accent-2 bg-accent-2/10" : "border-line bg-surface-2",
                  !team.valid && "opacity-60",
                )}
              >
                <span className="flex shrink-0">
                  {team.spriteIds.slice(0, 6).map((spriteId, index) => (
                    <MiniSprite key={`${team.id}-${index}`} spriteId={spriteId} alt="" size={32} className="-ml-1 first:ml-0" />
                  ))}
                </span>
                <span className="font-display min-w-0 flex-1 truncate font-semibold">{team.name}</span>
                {!team.valid ? <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[10px] font-bold uppercase text-danger">No válido</span> : null}
              </button>
              {!team.valid ? (
                <Link href={`/teams/${team.id}`} className="font-display min-h-11 self-start px-1 text-sm font-semibold uppercase text-accent-2">
                  Editar
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
