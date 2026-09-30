import Link from "next/link";
import type { ReactNode } from "react";
import { PokeballDeco } from "./Card.tsx";
import { Icon } from "./Icon.tsx";

export function PageHeader({
  title,
  subtitle,
  action,
  backHref,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  backHref?: string;
}) {
  return (
    <header className="relative isolate mb-6 flex flex-wrap items-end justify-between gap-4">
      <PokeballDeco spinning className="-right-16 -top-24 w-56 text-text opacity-[0.05] sm:-top-28 sm:w-64" />
      <div className="min-w-0">
        {backHref ? (
          <Link href={backHref} aria-label="Volver" className="-ml-3 mb-2 flex size-12 items-center justify-center rounded-full text-text hover:bg-surface">
            <Icon name="back" className="size-6" />
          </Link>
        ) : null}
        <h1 className="font-display text-[2rem] font-bold leading-tight sm:text-4xl">{title}</h1>
        {subtitle ? <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-text-dim">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}
