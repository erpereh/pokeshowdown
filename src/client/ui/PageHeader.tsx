import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-accent">{eyebrow}</p> : null}
        <h1 className="font-display text-3xl font-bold sm:text-4xl">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-xl text-text-dim">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}
