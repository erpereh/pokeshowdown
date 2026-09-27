"use client";

import { GameButton } from "@/client/ui/GameButton";
import type { NatureEntry, PokemonSetData, StatId } from "@/shared/contract";
import { useState } from "react";
import { controlClass, Field } from "./controls";
import { EV_PRESETS, EV_TOTAL, evTotal, PERFECT_IVS, spread252, STAT_IDS, STAT_LABEL, ZERO_EVS } from "./model";

interface TrainingFieldsProps {
  index: number;
  set: PokemonSetData;
  onEv: (stat: StatId, value: number) => void;
  onIv: (stat: StatId, value: number) => void;
  onEvs: (evs: PokemonSetData["evs"]) => void;
  onIvs: (ivs: PokemonSetData["ivs"]) => void;
  onNotice: (message: string) => void;
}

export function TrainingFields({ index, set, onEv, onIv, onEvs, onIvs, onNotice }: TrainingFieldsProps) {
  const base = `slot-${index}`;
  const total = evTotal(set.evs);
  const left = EV_TOTAL - total;
  const [primary, setPrimary] = useState<StatId>("atk");
  const [secondary, setSecondary] = useState<StatId>("spe");
  const [dump, setDump] = useState<StatId>("hp");

  function applySpread() {
    const evs = spread252(primary, secondary, dump);
    if (!evs) {
      onNotice("Elige tres estadísticas distintas para el reparto 252 / 252 / 4.");
      return;
    }
    onEvs(evs);
  }

  return (
    <section className="flex flex-col gap-4" aria-labelledby={`${base}-training`}>
      <h3 id={`${base}-training`} className="font-display text-lg font-semibold">
        Entrenamiento
      </h3>
      <div>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="font-display text-xs font-semibold uppercase tracking-wide text-text-dim">EVs</h4>
          <p className={`tabular text-sm ${left < 0 ? "text-danger" : "text-accent"}`}>
            {left < 0 ? `Te pasas por ${Math.abs(left)} EVs` : `Te quedan ${left} EVs`}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {STAT_IDS.map((stat) => (
            <div key={stat} className="grid grid-cols-[4.75rem_minmax(0,1fr)_4.75rem] items-center gap-2">
              <label htmlFor={`${base}-ev-${stat}`} className="text-sm">
                {STAT_LABEL[stat]}
              </label>
              <input
                id={`${base}-ev-${stat}`}
                type="range"
                min={0}
                max={252}
                step={1}
                value={set.evs[stat]}
                aria-valuemin={0}
                aria-valuemax={252}
                aria-valuenow={set.evs[stat]}
                aria-valuetext={`${set.evs[stat]} de 252`}
                className="h-11 w-full min-w-0 accent-accent"
                onChange={(event) => onEv(stat, Number(event.target.value))}
              />
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={252}
                aria-label={`${STAT_LABEL[stat]} EVs, valor numérico`}
                className={`${controlClass} tabular px-2 text-center`}
                value={set.evs[stat]}
                onChange={(event) => onEv(stat, event.target.value === "" ? 0 : Number(event.target.value))}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <h4 className="font-display text-xs font-semibold uppercase tracking-wide text-text-dim">Repartos rápidos</h4>
        <div className="flex flex-wrap gap-2">
          {EV_PRESETS.map((preset) => (
            <GameButton key={preset.id} type="button" variant="secondary" size="md" onClick={() => onEvs(preset.evs)}>
              {preset.label}
            </GameButton>
          ))}
          <GameButton type="button" variant="ghost" size="md" onClick={() => onEvs(ZERO_EVS)}>
            Vaciar EVs
          </GameButton>
        </div>
        <fieldset className="grid gap-2 rounded-[var(--radius-card)] border border-line p-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <legend className="px-1 font-display text-xs font-semibold uppercase tracking-wide text-text-dim">
            Reparto 252 / 252 / 4
          </legend>
          <SpreadSelect id={`${base}-spread-a`} label="252" value={primary} onChange={setPrimary} />
          <SpreadSelect id={`${base}-spread-b`} label="252" value={secondary} onChange={setSecondary} />
          <SpreadSelect id={`${base}-spread-c`} label="4" value={dump} onChange={setDump} />
          <GameButton type="button" variant="secondary" size="md" onClick={applySpread}>
            Aplicar
          </GameButton>
        </fieldset>
      </div>
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-display text-xs font-semibold uppercase tracking-wide text-text-dim">IVs</h4>
          <div className="flex flex-wrap gap-2">
            <GameButton type="button" variant="ghost" size="md" onClick={() => onIvs(PERFECT_IVS)}>
              IVs a 31
            </GameButton>
            <GameButton type="button" variant="ghost" size="md" onClick={() => onIvs(ZERO_EVS)}>
              IVs a 0
            </GameButton>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {STAT_IDS.map((stat) => (
            <Field key={stat} label={STAT_LABEL[stat]} htmlFor={`${base}-iv-${stat}`}>
              <input
                id={`${base}-iv-${stat}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={31}
                className={`${controlClass} tabular`}
                value={set.ivs[stat]}
                onChange={(event) => onIv(stat, event.target.value === "" ? 0 : Number(event.target.value))}
              />
            </Field>
          ))}
        </div>
      </div>
    </section>
  );
}

function SpreadSelect({ id, label, value, onChange }: { id: string; label: string; value: StatId; onChange: (stat: StatId) => void }) {
  return (
    <Field label={label} htmlFor={id}>
      <select id={id} className={controlClass} value={value} onChange={(event) => onChange(event.target.value as StatId)}>
        {STAT_IDS.map((stat) => (
          <option key={stat} value={stat}>
            {STAT_LABEL[stat]}
          </option>
        ))}
      </select>
    </Field>
  );
}
