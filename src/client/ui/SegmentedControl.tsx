"use client";

import { cx } from "./cx.ts";

interface Option<T extends string> {
  value: T;
  label: string;
}

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
  return (
    <div role="radiogroup" aria-label={label} className={cx("grid rounded-[var(--radius-card)] border border-line bg-bg-0/50 p-1", className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
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
            className={cx(
              "font-display min-h-12 rounded-[14px] px-2 text-sm font-semibold transition-colors duration-[var(--dur-fast)]",
              selected ? "bg-accent-2/15 text-accent-2 shadow-[inset_0_1px_0_#80e3f330]" : "text-text-dim hover:text-text",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
