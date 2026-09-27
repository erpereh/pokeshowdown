"use client";

import { GlassPanel } from "@/client/ui/GlassPanel";
import { TypeChip } from "@/client/ui/TypeChip";
import type { NatureEntry, PokemonSetData, ValidationProblem } from "@/shared/contract";
import type { SpeciesBundle } from "./hooks";
import { PokemonSprite } from "./media";
import { calcAllStats, findNature, natureMod, STAT_IDS, STAT_LABEL, teamProblems } from "./model";

function spriteGender(gender: string): "M" | "F" | undefined {
  return gender === "M" || gender === "F" ? gender : undefined;
}

function genderLabel(gender: string) {
  if (gender === "M") return "Macho";
  if (gender === "F") return "Hembra";
  if (gender === "N") return "Sin género";
  return "Género aleatorio";
}

export function ProblemList({
  title,
  problems,
  empty,
}: {
  title: string;
  problems: readonly ValidationProblem[];
  empty: string;
}) {
  return (
    <section className="min-w-0">
      <h3 className="font-display text-xs font-semibold uppercase tracking-wide text-text-dim">{title}</h3>
      {problems.length === 0 ? (
        <p className="mt-2 text-sm text-text-dim">{empty}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {problems.map((problem, index) => (
            <li key={`${problem.setIndex ?? "team"}-${index}`} className="rounded-[var(--radius-card)] border border-danger/40 bg-danger/10 px-3 py-2">
              <p className="font-display text-xs font-semibold uppercase text-danger">Detalle del validador</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm">{problem.message}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function TeamProblems({
  problems,
  checking,
  error,
  hasSets,
}: {
  problems: readonly ValidationProblem[];
  checking: boolean;
  error: string | null;
  hasSets: boolean;
}) {
  const team = teamProblems(problems);
  return (
    <GlassPanel as="section" aria-label="Legalidad del equipo" className="p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">Legalidad</h2>
        {checking ? <p className="text-xs text-text-dim">Comprobando legalidad…</p> : null}
      </div>
      {error ? <p className="mb-2 text-sm text-danger">{error}</p> : null}
      <ProblemList
        title="Problemas del equipo"
        problems={team}
        empty={hasSets ? "Sin problemas generales. Revisa las ranuras marcadas." : "Añade Pokémon para comprobar el equipo."}
      />
    </GlassPanel>
  );
}

interface PreviewPanelProps {
  set: PokemonSetData | null;
  bundle: SpeciesBundle | null;
  natures: readonly NatureEntry[] | null;
}

export function PreviewPanel({ set, bundle, natures }: PreviewPanelProps) {
  if (!set) {
    return (
      <GlassPanel as="section" aria-label="Vista previa" className="p-4">
        <h2 className="font-display text-lg font-semibold">Vista previa</h2>
        <p className="mt-3 text-sm text-text-dim">Elige una especie para ver el sprite, los tipos y las estadísticas.</p>
      </GlassPanel>
    );
  }

  const nature = findNature(natures, set.nature);
  const stats = bundle ? calcAllStats(bundle.species.baseStats, set, nature) : null;
  const abilities = bundle?.species.abilities ?? (set.ability ? [set.ability] : []);

  return (
    <GlassPanel as="section" aria-label="Vista previa" className="p-4">
      <h2 className="font-display text-lg font-semibold">Vista previa</h2>
      <div className="mt-3">
        <PokemonSprite
          spriteId={bundle?.species.spriteId ?? ""}
          facing="front"
          animated
          shiny={set.shiny}
          gender={spriteGender(set.gender)}
          scale={1.35}
          alt={set.species || "Pokémon"}
        />
      </div>
      <p className="font-display mt-3 text-center text-2xl font-semibold">{set.name.trim() || set.species}</p>
      {set.name.trim() ? <p className="text-center text-sm text-text-dim">{set.species}</p> : null}
      <p className="mt-1 text-center text-sm text-text-dim">
        Nv. {set.level} · {genderLabel(set.gender)}
        {set.shiny ? " · Variocolor" : ""}
      </p>
      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        {(bundle?.species.types ?? []).map((type) => (
          <TypeChip key={type} type={type} />
        ))}
        {set.teraType ? <TypeChip type={set.teraType} /> : null}
      </div>
      {set.teraType ? <p className="mt-1 text-center text-xs text-text-dim">El chip extra es el tipo Tera.</p> : null}
      <div className="mt-4">
        <h3 className="font-display text-xs font-semibold uppercase tracking-wide text-text-dim">Habilidades</h3>
        {abilities.length === 0 ? (
          <p className="mt-1 text-sm text-text-dim">Sin datos de habilidad todavía.</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1">
            {abilities.map((ability) => (
              <li key={ability} className={ability === set.ability ? "text-sm text-text" : "text-sm text-text-dim"}>
                {ability}
                {ability === set.ability ? <span className="text-accent"> · elegida</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-3 text-sm">
        <span className="text-text-dim">Objeto · </span>
        {set.item || "Sin objeto"}
      </p>
      <div className="mt-4">
        <h3 className="font-display text-xs font-semibold uppercase tracking-wide text-text-dim">Estadísticas finales</h3>
        {nature ? <p className="mt-1 text-xs text-text-dim">{nature.name}</p> : null}
        {stats ? (
          <ul className="mt-2 flex flex-col gap-1.5">
            {STAT_IDS.map((stat) => {
              const effect = natureMod(nature, stat);
              const tone = effect > 1 ? "var(--color-success)" : effect < 1 ? "var(--color-danger)" : "var(--color-accent-2)";
              const scale = stat === "hp" ? 720 : 420;
              const width = Math.max(8, Math.min(100, Math.round((stats[stat] / scale) * 100)));
              const mark = effect > 1 ? " +" : effect < 1 ? " −" : "";
              return (
                <li key={stat} className="grid grid-cols-[5.25rem_minmax(0,1fr)_2.75rem] items-center gap-2 text-sm">
                  <span>
                    {STAT_LABEL[stat]}
                    {mark}
                    <span className="sr-only">: {stats[stat]}</span>
                  </span>
                  <span className="h-2 overflow-hidden rounded-full bg-white/10" aria-hidden>
                    <span className="block h-full rounded-full" style={{ width: `${width}%`, background: tone }} />
                  </span>
                  <span className="tabular text-right" aria-hidden>
                    {stats[stat]}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-text-dim">Las estadísticas finales aparecen al cargar la especie.</p>
        )}
      </div>
    </GlassPanel>
  );
}
