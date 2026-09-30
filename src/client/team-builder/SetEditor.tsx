"use client";

import { GameButton } from "@/client/ui/GameButton";
import { PokeballDeco } from "@/client/ui/Card";
import { SegmentedControl } from "@/client/ui/SegmentedControl";
import { TypeChip, typeCardColor, TYPE_NAMES_ES } from "@/client/ui/TypeChip";
import type { NatureEntry, PokemonSetData, SpeciesSummary, StatId, ValidationProblem } from "@/shared/contract";
import { useEffect, useState, type CSSProperties, type Dispatch } from "react";
import { controlClass, Field } from "./controls";
import type { BundleStatus, SpeciesBundle } from "./hooks";
import { PokemonSprite } from "./media";
import { findNature, natureCaption, SLOT_COUNT } from "./model";
import type { DraftAction } from "./model";
import { ItemField, MoveList, SpeciesField } from "./Pickers";
import { ProblemList } from "./PreviewPanel";
import { TrainingFields } from "./TrainingFields";

interface SetEditorProps {
  index: number;
  set: PokemonSetData | null;
  bundle: SpeciesBundle | null;
  bundleStatus: BundleStatus;
  problems: readonly ValidationProblem[];
  natures: readonly NatureEntry[] | null;
  types: readonly string[] | null;
  catalogError: string | null;
  hasEmptySlot: boolean;
  picking: boolean;
  onPickSpecies: (species: SpeciesSummary) => void;
  onRetrySpecies: () => void;
  onRetryCatalog: () => void;
  onNotice: (message: string) => void;
  dispatch: Dispatch<DraftAction>;
}

export function SetEditor({
  index,
  set,
  bundle,
  bundleStatus,
  problems,
  natures,
  types,
  catalogError,
  hasEmptySlot,
  picking,
  onPickSpecies,
  onRetrySpecies,
  onRetryCatalog,
  onNotice,
  dispatch,
}: SetEditorProps) {
  const [section, setSection] = useState<"pokemon" | "set" | "training">("pokemon");
  useEffect(() => setSection("pokemon"), [index]);
  const base = `slot-${index}`;
  const fixedGender = bundle?.species.gender ?? null;
  const forceTera = bundle?.species.forceTeraType ?? null;
  const teraOptions = types ? (set?.teraType && !types.includes(set.teraType) ? [set.teraType, ...types] : types) : set?.teraType ? [set.teraType] : [];

  function patch(partial: Partial<PokemonSetData>) {
    dispatch({ type: "patch", index, patch: partial });
  }

  return (
    <section id="slot-editor" role="tabpanel" aria-labelledby={`slot-tab-${index}`} className="card min-w-0 overflow-hidden rounded-[var(--radius-panel)]" data-testid="set-editor">
      <div
        className="type-card px-4 pb-10 pt-4 transition-[background-color] duration-500"
        style={{ "--card-color": typeCardColor(bundle?.species.types[0] ?? null) } as CSSProperties}
      >
        <PokeballDeco spinning className="-bottom-12 -right-10 w-44" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="soft-pill px-2.5 py-0.5 text-xs">Ranura {index + 1} de {SLOT_COUNT}</span>
            <h2 id="slot-editor-title" className="card-title font-display mt-2 truncate text-3xl font-bold">
              {set ? set.name.trim() || set.species : "Ranura vacía"}
            </h2>
            {set && bundle ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {bundle.species.types.map((type) => (
                  <TypeChip key={type} type={type} tone="soft" />
                ))}
                <span className="soft-pill px-2.5 py-0.5 text-xs">{bundle.species.tier}</span>
              </div>
            ) : null}
          </div>
          {bundle ? <span className="font-display shrink-0 text-lg font-bold text-white/85">#{String(bundle.species.num).padStart(3, "0")}</span> : null}
        </div>
        {set && bundle ? (
          <div key={`${index}-${bundle.species.id}`} className="animate-pop-in relative mx-auto mt-1 flex h-32 w-40 items-end justify-center">
            <PokemonSprite spriteId={bundle.species.spriteId} facing="front" animated shiny={set.shiny} gender={set.gender === "M" || set.gender === "F" ? set.gender : undefined} scale={1.4} alt={set.species} className="drop-shadow-[0_8px_8px_rgb(0_0_0/0.2)]" />
          </div>
        ) : null}
      </div>
      <div className="sheet-surface -mt-7 px-4 pb-4 pt-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        {set ? (
          <details className="editor-tools w-full">
            <summary>Acciones de Pokémon</summary>
            <div className="flex flex-wrap gap-2 p-2">
            <GameButton type="button" variant="secondary" size="md" disabled={index === 0} onClick={() => dispatch({ type: "nudge", index, direction: -1 })}>
              Subir
            </GameButton>
            <GameButton
              type="button"
              variant="secondary"
              size="md"
              disabled={index === SLOT_COUNT - 1}
              onClick={() => dispatch({ type: "nudge", index, direction: 1 })}
            >
              Bajar
            </GameButton>
            <GameButton
              type="button"
              variant="secondary"
              size="md"
              disabled={!hasEmptySlot}
              onClick={() => {
                if (!hasEmptySlot) {
                  onNotice("No hay ranuras libres.");
                  return;
                }
                dispatch({ type: "duplicate", index });
              }}
            >
              Duplicar
            </GameButton>
            <GameButton type="button" variant="danger" size="md" onClick={() => dispatch({ type: "remove", index })}>
              Quitar
            </GameButton>
            </div>
          </details>
        ) : null}
      </div>

      {problems.length > 0 ? <ProblemList
        title="Problemas de este Pokémon"
        problems={problems}
        empty={set ? "Showdown no marca problemas en esta ranura." : "Esta ranura está vacía."}
      /> : null}

      <div className="editor-sections md:hidden">
        <SegmentedControl label="Sección del Pokémon" value={section} onChange={setSection} options={[
          { value: "pokemon", label: "Pokémon" },
          { value: "set", label: "Set" },
          { value: "training", label: "Entrenamiento" },
        ]} />
      </div>

      <div className="mt-4 flex flex-col gap-4">

        {bundleStatus === "loading" && set ? <p className="text-sm text-text-dim">Cargando datos de la especie…</p> : null}
        {bundleStatus === "error" && set ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-danger">No se han podido cargar los datos de esta especie.</p>
            <GameButton type="button" variant="secondary" size="md" onClick={onRetrySpecies}>
              Reintentar
            </GameButton>
          </div>
        ) : null}

        <div className={section === "pokemon" || !set ? "flex flex-col gap-4" : "hidden flex-col gap-4 md:flex"}>
          <SpeciesField id={`${base}-species`} disabled={picking} onPick={onPickSpecies} />
        </div>

        {set ? (
          <>
            <div className={section === "pokemon" ? "flex flex-col gap-4" : "hidden flex-col gap-4 md:flex"}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Apodo" htmlFor={`${base}-nickname`} hint="Opcional. El nombre de especie se queda en inglés.">
                <input
                  id={`${base}-nickname`}
                  className={controlClass}
                  maxLength={30}
                  value={set.name}
                  autoComplete="off"
                  onChange={(event) => patch({ name: event.target.value })}
                />
              </Field>
              <Field label="Nivel" htmlFor={`${base}-level`}>
                <input
                  id={`${base}-level`}
                  className={`${controlClass} tabular`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={100}
                  value={set.level}
                  onChange={(event) => patch({ level: event.target.value === "" ? 1 : Number(event.target.value) })}
                />
              </Field>
            </div>

            <GenderField idPrefix={base} gender={set.gender} fixed={fixedGender} onChange={(gender) => patch({ gender })} />

            <div className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] bg-surface-2 px-3 py-2">
              <label htmlFor={`${base}-shiny`} className="font-display text-sm font-semibold">
                Variocolor
              </label>
              <button
                id={`${base}-shiny`}
                type="button"
                role="switch"
                aria-checked={set.shiny}
                onClick={() => patch({ shiny: !set.shiny })}
                className={`min-h-12 min-w-16 rounded-full px-3 text-sm font-semibold transition-colors ${set.shiny ? "bg-accent-2 text-white" : "bg-line text-text-dim"}`}
              >
                {set.shiny ? "Sí" : "No"}
              </button>
            </div>

            </div>

            <div className={section === "set" ? "flex flex-col gap-4" : "hidden flex-col gap-4 md:flex"}>
            <Field
              label="Tipo Tera"
              htmlFor={`${base}-tera`}
              hint={forceTera ? "Este tipo Tera está fijado por la especie." : undefined}
            >
              <select
                id={`${base}-tera`}
                className={controlClass}
                value={set.teraType}
                disabled={Boolean(forceTera)}
                onChange={(event) => patch({ teraType: event.target.value })}
              >
                <option value="">Elige un tipo</option>
                {teraOptions.map((type) => (
                  <option key={type} value={type}>
                    {TYPE_NAMES_ES[type] ?? type}
                  </option>
                ))}
              </select>
              {catalogError ? (
                <span className="mt-1 flex flex-wrap items-center gap-2 text-sm text-danger">
                  {catalogError}
                  <GameButton type="button" variant="ghost" size="md" onClick={onRetryCatalog}>
                    Reintentar
                  </GameButton>
                </span>
              ) : null}
              {forceTera && set.teraType !== forceTera ? (
                <GameButton type="button" variant="secondary" size="md" className="mt-2" onClick={() => patch({ teraType: forceTera })}>
                  Usar {TYPE_NAMES_ES[forceTera] ?? forceTera}
                </GameButton>
              ) : null}
            </Field>

            <Field label="Habilidad" htmlFor={`${base}-ability`}>
              <select
                id={`${base}-ability`}
                className={controlClass}
                value={set.ability}
                onChange={(event) => patch({ ability: event.target.value })}
              >
                <option value="">Elige una habilidad</option>
                {abilityOptions(bundle, set.ability).map((ability) => (
                  <option key={ability} value={ability}>
                    {ability}
                  </option>
                ))}
              </select>
            </Field>

            <ItemField
              id={`${base}-item`}
              item={set.item}
              requiredItem={bundle?.species.requiredItem ?? null}
              onChange={(item) => patch({ item })}
            />

            <Field label="Naturaleza" htmlFor={`${base}-nature`}>
              <select id={`${base}-nature`} className={controlClass} value={set.nature} onChange={(event) => patch({ nature: event.target.value })}>
                {set.nature && !natures?.some((nature) => nature.name === set.nature) ? <option value={set.nature}>{set.nature}</option> : null}
                {(natures ?? []).map((nature) => (
                  <option key={nature.id} value={nature.name}>
                    {natureCaption(nature)}
                  </option>
                ))}
              </select>
            </Field>

            <MoveList idPrefix={base} moves={set.moves} learnset={bundle?.moves ?? []} onChange={(moveIndex, name) => dispatch({ type: "move", index, moveIndex, name })} />
            </div>

            <div className={section === "training" ? "flex flex-col gap-4" : "hidden flex-col gap-4 md:flex"}>
            <TrainingFields
              index={index}
              set={set}
              onNotice={onNotice}
              onEv={(stat: StatId, value) => dispatch({ type: "ev", index, stat, value })}
              onIv={(stat: StatId, value) => dispatch({ type: "iv", index, stat, value })}
              onEvs={(evs) => dispatch({ type: "evs", index, evs })}
              onIvs={(ivs) => dispatch({ type: "ivs", index, ivs })}
            />
            </div>
            <p className="sr-only">Naturaleza activa: {findNature(natures, set.nature)?.name ?? set.nature}</p>
          </>
        ) : (
          <p className="text-sm text-text-dim">Busca una especie para ocupar esta ranura. Puedes dejar ranuras vacías y guardar el equipo igual.</p>
        )}
      </div>
      </div>
    </section>
  );
}

function abilityOptions(bundle: SpeciesBundle | null, current: string): string[] {
  const fromSpecies = bundle?.species.abilities ?? [];
  if (current && !fromSpecies.includes(current)) return [current, ...fromSpecies];
  return fromSpecies;
}

function GenderField({
  idPrefix,
  gender,
  fixed,
  onChange,
}: {
  idPrefix: string;
  gender: PokemonSetData["gender"];
  fixed: "M" | "F" | "N" | null;
  onChange: (gender: PokemonSetData["gender"]) => void;
}) {
  if (fixed === "N") {
    return (
      <fieldset className="min-w-0">
        <legend className="font-display text-sm font-semibold text-text-dim">Género</legend>
        <p className="mt-2 text-sm">Sin género</p>
        {gender !== "N" ? (
          <GameButton type="button" variant="secondary" size="md" className="mt-2" onClick={() => onChange("N")}>
            Marcar sin género
          </GameButton>
        ) : null}
      </fieldset>
    );
  }

  const options: { value: PokemonSetData["gender"]; label: string; disabled: boolean }[] = [
    { value: "", label: "Aleatorio", disabled: fixed !== null },
    { value: "M", label: "Macho", disabled: fixed === "F" },
    { value: "F", label: "Hembra", disabled: fixed === "M" },
  ];

  return (
    <fieldset className="min-w-0">
      <legend className="font-display text-sm font-semibold text-text-dim">Género</legend>
      {fixed ? <p className="mt-1 text-xs text-text-dim">El género de esta especie es fijo.</p> : null}
      <div className="mt-2 grid grid-cols-3 gap-2">
        {options.map((option) => (
          <label
            key={option.label}
            className={`font-display flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-card)] border-2 px-2 text-sm font-semibold transition-colors ${
              gender === option.value ? "border-accent-2 bg-accent-2/10 text-accent-2" : "border-line bg-surface-2"
            } ${option.disabled ? "opacity-45" : ""}`}
          >
            <input
              type="radio"
              name={`${idPrefix}-gender`}
              className="size-4 accent-accent-2"
              checked={gender === option.value}
              disabled={option.disabled}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
