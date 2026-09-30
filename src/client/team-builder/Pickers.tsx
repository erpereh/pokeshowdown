"use client";

import { TypeChip } from "@/client/ui/TypeChip";
import type { MoveSummary, NamedEntry, SpeciesSummary } from "@/shared/contract";
import { useEffect, useState } from "react";
import { errorMessage, isAbort, searchItems, searchSpecies } from "./api";
import { Combobox, MoveFacts } from "./controls";
import { useDebounced } from "./hooks";
import { ItemIcon, MiniSprite } from "./media";
import { baseStatTotal } from "./model";

export function SpeciesField({
  id,
  disabled,
  onPick,
}: {
  id: string;
  disabled?: boolean;
  onPick: (species: SpeciesSummary) => void;
}) {
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 250);
  const [options, setOptions] = useState<SpeciesSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = debounced.trim();
    if (q.length < 1) {
      setOptions([]);
      setLoading(false);
      setError(null);
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    void searchSpecies(q, ac.signal)
      .then((result) => {
        setOptions(result.species);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (isAbort(caught)) return;
        setOptions([]);
        setError(errorMessage(caught));
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [debounced]);

  return (
    <div data-testid="species-search">
      <Combobox
        id={id}
        label="Especie"
        placeholder="Busca por nombre, por ejemplo Garchomp"
        query={query}
        onQueryChange={setQuery}
        options={options}
        loading={loading}
        disabled={disabled}
        emptyLabel={query.trim() ? "Ninguna especie coincide." : "Escribe para buscar en la Dex."}
        hint="Flechas para recorrer, Enter para elegir."
        getKey={(species) => species.id}
        onSelect={(species) => {
          onPick(species);
          setQuery("");
        }}
        renderOption={(species) => (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <MiniSprite spriteId={species.spriteId} alt={species.name} size={48} />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-display font-semibold">{species.name}</span>
                <span className="text-xs text-text-dim">{species.tier}</span>
                <span className="tabular text-xs text-text-dim">Total {baseStatTotal(species.baseStats)}</span>
              </span>
              <span className="mt-1 flex flex-wrap gap-1">
                {species.types.map((type) => (
                  <TypeChip key={type} type={type} size="sm" />
                ))}
              </span>
            </span>
          </span>
        )}
      />
      {error ? <p className="mt-1 text-sm text-danger">{error}</p> : null}
    </div>
  );
}

export function ItemField({
  id,
  item,
  requiredItem,
  onChange,
}: {
  id: string;
  item: string;
  requiredItem: string | null;
  onChange: (item: string) => void;
}) {
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 250);
  const [options, setOptions] = useState<NamedEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spriteNum, setSpriteNum] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!item) {
      setSpriteNum(undefined);
      return;
    }
    const ac = new AbortController();
    void searchItems(item, ac.signal)
      .then((result) => {
        const match = result.items.find((entry) => entry.name.toLowerCase() === item.toLowerCase());
        setSpriteNum(match?.spriteNum);
      })
      .catch((caught: unknown) => {
        if (!isAbort(caught)) setSpriteNum(undefined);
      });
    return () => ac.abort();
  }, [item]);

  useEffect(() => {
    const q = debounced.trim();
    if (requiredItem || q.length < 1) {
      setOptions([]);
      setLoading(false);
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    void searchItems(q, ac.signal)
      .then((result) => {
        setOptions(result.items);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (isAbort(caught)) return;
        setOptions([]);
        setError(errorMessage(caught));
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [debounced, requiredItem]);

  if (requiredItem) {
    const shown = item || requiredItem;
    return (
      <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-[var(--radius-card)] border-2 border-line bg-surface-2 px-3 py-2">
        {spriteNum !== undefined ? <ItemIcon spriteNum={spriteNum} name={shown} size={24} /> : null}
        <span className="min-w-0 flex-1">
          <span className="block font-display text-xs font-semibold uppercase tracking-wide text-text-dim">Objeto</span>
          <span className="block truncate">{shown}</span>
          <span className="block text-xs text-text-dim">Este objeto es obligatorio para la especie.</span>
        </span>
        {item !== requiredItem ? (
          <button type="button" className="min-h-11 px-2 text-sm font-semibold text-accent" onClick={() => onChange(requiredItem)}>
            Equipar {requiredItem}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      {item ? (
        <div className="mb-2 flex min-h-11 items-center gap-2">
          {spriteNum !== undefined ? <ItemIcon spriteNum={spriteNum} name={item} size={24} /> : null}
          <span className="min-w-0 flex-1 truncate text-sm">{item}</span>
          <button type="button" className="min-h-11 shrink-0 px-2 text-sm text-text-dim underline-offset-2 hover:underline" onClick={() => onChange("")}>
            Quitar objeto
          </button>
        </div>
      ) : null}
      <Combobox
        id={id}
        label={item ? "Cambiar objeto" : "Objeto"}
        placeholder="Busca un objeto"
        query={query}
        onQueryChange={setQuery}
        options={options}
        loading={loading}
        emptyLabel={query.trim() ? "Ningún objeto coincide." : "Escribe para buscar un objeto."}
        getKey={(entry) => entry.id}
        onSelect={(entry) => {
          onChange(entry.name);
          setSpriteNum(entry.spriteNum);
          setQuery("");
        }}
        renderOption={(entry) => (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            {entry.spriteNum !== undefined ? <ItemIcon spriteNum={entry.spriteNum} name={entry.name} size={24} /> : null}
            <span className="min-w-0">
              <span className="block font-display font-semibold">{entry.name}</span>
              {entry.shortDesc ? <span className="block text-xs text-text-dim">{entry.shortDesc}</span> : null}
            </span>
          </span>
        )}
      />
      {error ? <p className="mt-1 text-sm text-danger">{error}</p> : null}
    </div>
  );
}

export function MoveList({
  idPrefix,
  moves,
  learnset,
  onChange,
}: {
  idPrefix: string;
  moves: readonly string[];
  learnset: readonly MoveSummary[];
  onChange: (index: number, name: string) => void;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const slots = [0, 1, 2, 3];
  const q = query.trim().toLowerCase();
  const filtered = learnset.filter((move) => {
    if (!q) return true;
    return move.name.toLowerCase().includes(q) || move.type.toLowerCase().includes(q);
  });

  return (
    <section className="flex flex-col gap-3" aria-labelledby={`${idPrefix}-moves`}>
      <h3 id={`${idPrefix}-moves`} className="font-display text-lg font-semibold">
        Movimientos
      </h3>
      {learnset.length === 0 ? <p className="text-sm text-text-dim">Los movimientos aprendibles aparecen al cargar la especie.</p> : null}
      {slots.map((index) => {
        const current = moves[index] ?? "";
        const summary = learnset.find((move) => move.name === current);
        const used = new Set(moves.filter((move, moveIndex) => move && moveIndex !== index));
        return (
          <div key={index} className="rounded-[var(--radius-card)] border border-line p-3">
            <p className="font-display text-xs font-semibold uppercase tracking-wide text-text-dim">Movimiento {index + 1}</p>
            {current ? (
              <div className="mt-2 min-w-0">
                <p className="font-display text-base font-semibold">{current}</p>
                {summary ? (
                  <>
                    <div className="mt-1">
                      <MoveFacts
                        type={summary.type}
                        category={summary.category}
                        basePower={summary.basePower}
                        accuracy={summary.accuracy}
                        pp={summary.pp}
                      />
                    </div>
                    {summary.priority !== 0 ? (
                      <p className="mt-1 text-xs text-text-dim">
                        Prioridad {summary.priority > 0 ? `+${summary.priority}` : summary.priority}
                      </p>
                    ) : null}
                    {summary.shortDesc ? <p className="mt-1 text-sm text-text-dim">{summary.shortDesc}</p> : null}
                  </>
                ) : (
                  <p className="mt-1 text-xs text-text-dim">Este movimiento no está en la lista aprendible cargada.</p>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-text-dim">Vacío</p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="min-h-11 rounded-[var(--radius-card)] border border-line-strong px-3 text-sm font-semibold"
                aria-expanded={open === index}
                onClick={() => {
                  setOpen((value) => (value === index ? null : index));
                  setQuery("");
                }}
              >
                {current ? "Cambiar" : "Elegir movimiento"}
              </button>
              {current ? (
                <button
                  type="button"
                  className="min-h-11 px-3 text-sm text-text-dim underline-offset-2 hover:underline"
                  onClick={() => onChange(index, "")}
                >
                  Quitar
                </button>
              ) : null}
            </div>
            {open === index ? (
              <div className="mt-3">
                <Combobox
                  id={`${idPrefix}-move-${index}`}
                  label={`Buscar movimiento ${index + 1}`}
                  placeholder="Filtra por nombre o tipo"
                  query={query}
                  onQueryChange={setQuery}
                  options={filtered}
                  emptyLabel={learnset.length === 0 ? "Aún no hay movimientos cargados." : "Ningún movimiento coincide."}
                  getKey={(move) => move.id}
                  isDisabled={(move) => used.has(move.name)}
                  onSelect={(move) => {
                    onChange(index, move.name);
                    setOpen(null);
                    setQuery("");
                  }}
                  renderOption={(move) => (
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-display font-semibold">{move.name}</span>
                        {used.has(move.name) ? <span className="text-xs text-danger">Ya usado</span> : null}
                      </span>
                      <MoveFacts
                        type={move.type}
                        category={move.category}
                        basePower={move.basePower}
                        accuracy={move.accuracy}
                        pp={move.pp}
                      />
                      {move.shortDesc ? <span className="text-xs text-text-dim">{move.shortDesc}</span> : null}
                    </span>
                  )}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
