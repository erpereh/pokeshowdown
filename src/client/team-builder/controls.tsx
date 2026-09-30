"use client";

import { CategoryIcon, categoryLabel } from "@/client/ui/CategoryIcon";
import { TypeChip } from "@/client/ui/TypeChip";
import type { MoveCategory } from "@/shared/contract";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export const controlClass =
  "min-h-12 w-full min-w-0 rounded-[var(--radius-card)] border-2 border-line bg-surface-2 px-3 text-base text-text placeholder:text-text-dim/80 transition-colors focus:border-accent-2 focus:bg-surface disabled:cursor-not-allowed disabled:opacity-50";

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={htmlFor} className="font-display text-sm font-semibold text-text-dim">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-text-dim">{hint}</p> : null}
    </div>
  );
}

export function FormatBadge() {
  return (
    <span className="font-display inline-flex min-h-7 items-center rounded-full bg-accent-2/10 px-2.5 text-xs font-semibold uppercase tracking-wide text-accent-2">
      Gen 9 OU
    </span>
  );
}

export function ValidityBadge({ valid }: { valid: boolean | null }) {
  const label = valid === null ? "Sin comprobar" : valid ? "Válido" : "No válido";
  const tone =
    valid === null ? "bg-surface-2 text-text-dim" : valid ? "bg-success/10 text-success" : "bg-danger/10 text-danger";
  return (
    <span className={`font-display inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-semibold uppercase ${tone}`}>
      {label}
    </span>
  );
}

export function EmptySlotMark({ size = 48 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full border-2 border-dashed border-line-strong font-display text-xl text-accent"
      style={{ width: size, height: size }}
    >
      +
    </span>
  );
}

interface ComboboxProps<T> {
  id: string;
  label: string;
  placeholder: string;
  query: string;
  onQueryChange: (value: string) => void;
  options: readonly T[];
  loading?: boolean;
  emptyLabel: string;
  hint?: string;
  disabled?: boolean;
  getKey: (option: T) => string;
  onSelect: (option: T) => void;
  renderOption: (option: T, active: boolean) => ReactNode;
  isDisabled?: (option: T) => boolean;
}

export function Combobox<T>({
  id,
  label,
  placeholder,
  query,
  onQueryChange,
  options,
  loading,
  emptyLabel,
  hint,
  disabled,
  getKey,
  onSelect,
  renderOption,
  isDisabled,
}: ComboboxProps<T>) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const visible = options.slice(0, 40);

  useEffect(() => {
    setActive(0);
  }, [query, options.length]);

  useEffect(() => {
    if (!open) return;
    document.getElementById(`${id}-opt-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, id]);

  function move(step: number) {
    if (!visible.length) return;
    setActive((current) => {
      let next = current;
      for (let hop = 0; hop < visible.length; hop += 1) {
        next = (next + step + visible.length) % visible.length;
        const option = visible[next];
        if (option && !isDisabled?.(option)) return next;
      }
      return current;
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActive(0);
        return;
      }
      move(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActive(0);
        return;
      }
      move(-1);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const option = visible[active];
      if (open && option && !isDisabled?.(option)) {
        onSelect(option);
        setOpen(false);
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  }

  const activeOption = visible[active];
  const activeId = activeOption ? `${id}-opt-${active}` : undefined;

  return (
    <div
      ref={rootRef}
      className="min-w-0"
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <Field label={label} htmlFor={id} hint={hint}>
        <input
          id={id}
          role="combobox"
          className={controlClass}
          placeholder={placeholder}
          value={query}
          disabled={disabled}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open ? activeId : undefined}
          onChange={(event) => {
            onQueryChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
      </Field>
      {open && !disabled ? (
        <div className="animate-pop-in mt-2 overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-soft)]">
          <p className="sr-only">Flechas para recorrer, Enter para elegir.</p>
          {loading ? <p className="px-3 py-3 text-sm text-text-dim">Buscando…</p> : null}
          {!loading && visible.length === 0 ? <p className="px-3 py-3 text-sm text-text-dim">{emptyLabel}</p> : null}
          {visible.length > 0 ? (
            <ul id={listId} role="listbox" aria-label={label} className="max-h-64 overflow-y-auto">
              {visible.map((option, index) => {
                const blocked = isDisabled?.(option) ?? false;
                const selected = index === active;
                return (
                  <li key={getKey(option)} role="presentation">
                    <button
                      id={`${id}-opt-${index}`}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      aria-disabled={blocked || undefined}
                      disabled={blocked}
                      className={`flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left ${
                        selected ? "bg-accent-2/10" : "hover:bg-surface-2"
                      } disabled:opacity-45`}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => {
                        if (blocked) return;
                        onSelect(option);
                        setOpen(false);
                      }}
                    >
                      {renderOption(option, selected)}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {options.length > visible.length ? (
            <p className="border-t border-line px-3 py-2 text-xs text-text-dim">Sigue escribiendo para acotar la lista.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function MoveFacts({
  type,
  category,
  basePower,
  accuracy,
  pp,
}: {
  type: string;
  category: MoveCategory;
  basePower: number;
  accuracy: number | true;
  pp: number;
}) {
  const accuracyLabel = accuracy === true ? "asegurada" : String(accuracy);
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-text-dim">
      <TypeChip type={type} size="sm" />
      <span className="inline-flex items-center gap-1">
        <CategoryIcon category={category} />
        {categoryLabel(category)}
      </span>
      <span aria-label={`potencia ${basePower || "ninguna"}`}>Pot. {basePower || "—"}</span>
      <span aria-label={`precisión ${accuracyLabel}`}>Prec. {accuracy === true ? "—" : accuracy}</span>
      <span className="tabular">PP {pp}</span>
    </span>
  );
}
