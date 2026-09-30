import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx.ts";
import { typeCardColor } from "./TypeChip.tsx";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  as?: "div" | "section" | "article" | "aside";
  /** Colours the card like a Pokédex entry of that type, with a decorative Poké Ball. */
  type?: string | null;
  children: ReactNode;
}

export function Card({ as: Tag = "div", type, className, style, children, ...rest }: CardProps) {
  if (type !== undefined) {
    return (
      <Tag {...rest} className={cx("type-card rounded-[var(--radius-panel)]", className)} style={{ "--card-color": typeCardColor(type), ...style } as CSSProperties}>
        <PokeballDeco className="-right-6 -bottom-8 w-32" />
        {children}
      </Tag>
    );
  }
  return (
    <Tag {...rest} className={cx("card rounded-[var(--radius-panel)]", className)} style={style}>
      {children}
    </Tag>
  );
}

export function PokeballDeco({ className, spinning }: { className?: string; spinning?: boolean }) {
  return <span aria-hidden="true" className={cx("pokeball-deco", spinning && "is-spinning", className)} />;
}

/** Full-colour Poké Ball used for the brand, the Play tab and loaders. */
export function Pokeball({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={className ?? "size-6"}>
      <circle cx="24" cy="24" r="22" fill="#fff" stroke="#303943" strokeWidth="3" />
      <path d="M2 24a22 22 0 0 1 44 0Z" fill="#dc2f3c" stroke="#303943" strokeWidth="3" strokeLinejoin="round" />
      <path d="M2.5 24h43" stroke="#303943" strokeWidth="3" />
      <circle cx="24" cy="24" r="7" fill="#fff" stroke="#303943" strokeWidth="3" />
      <circle cx="24" cy="24" r="3" fill="#fff" stroke="#c9d1dc" strokeWidth="1.5" />
      <path d="M11 13a15 15 0 0 1 8-5" stroke="#fff" strokeOpacity=".55" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}
