"use client";

import type { CSSProperties } from "react";
import { cx } from "./cx.ts";

interface Option<T extends string> {
  value: T;
  label: string;
}

/** Pokédex-style tabs (radiogroup) with an animated underline. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Option<T>[];
  label: string;
  className?: string;
}) {
  const current = Math.max(0, options.findIndex((option) => option.value === value));
  const width = 100 / Math.max(options.length, 1);
  return (
    <div role="radiogroup" aria-label={label} className={cx("tab-underline", className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              const index = options.indexOf(option);
              let nextIndex: number;
              if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % options.length;
              else if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index + options.length - 1) % options.length;
              else if (event.key === "Home") nextIndex = 0;
              else if (event.key === "End") nextIndex = options.length - 1;
              else return;
              event.preventDefault();
              const next = options[nextIndex];
              if (!next) return;
              onChange(next.value);
              event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role='radio']")[nextIndex]?.focus();
            }}
            className="px-2 text-sm"
          >
            {option.label}
          </button>
        );
      })}
      <span
        aria-hidden="true"
        className="tab-indicator"
        style={{ width: `${width}%`, transform: `translateX(${current * 100}%)` } as CSSProperties}
      />
    </div>
  );
}
