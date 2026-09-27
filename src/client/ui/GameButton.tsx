"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type GameButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type GameButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<GameButtonVariant, string> = {
  primary:
    "clip-angled bg-accent text-bg-0 hover:brightness-110 hover:shadow-[0_0_24px_#ffc83d66] active:brightness-95",
  secondary:
    "rounded-[var(--radius-card)] border border-line-strong bg-surface-2 text-text hover:border-accent-2 hover:shadow-[0_0_18px_#4fd1ff33]",
  ghost: "rounded-[var(--radius-card)] text-text-dim hover:bg-white/5 hover:text-text",
  danger:
    "rounded-[var(--radius-card)] border border-danger/60 bg-danger/15 text-danger hover:bg-danger/25 hover:shadow-[0_0_18px_#f0544f44]",
};

const SIZES: Record<GameButtonSize, string> = {
  sm: "min-h-9 px-3 text-sm",
  md: "min-h-11 px-5 text-base",
  lg: "min-h-14 px-7 text-lg",
};

function classes(variant: GameButtonVariant, size: GameButtonSize, extra?: string) {
  return [
    "font-display inline-flex select-none items-center justify-center gap-2 font-semibold uppercase tracking-wide",
    "transition-[filter,box-shadow,background-color,border-color,color,transform] duration-[var(--dur-fast)] ease-[var(--ease-out-game)]",
    "disabled:pointer-events-none disabled:opacity-45 active:translate-y-px",
    VARIANTS[variant],
    SIZES[size],
    extra ?? "",
  ].join(" ");
}

interface GameButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: GameButtonVariant;
  size?: GameButtonSize;
  loading?: boolean;
  children: ReactNode;
}

export function GameButton({ variant = "primary", size = "md", loading, className, children, disabled, ...rest }: GameButtonProps) {
  return (
    <button {...rest} disabled={disabled || loading} aria-busy={loading || undefined} className={classes(variant, size, className)}>
      {loading ? <Spinner className="size-4" /> : null}
      {children}
    </button>
  );
}

interface GameLinkProps {
  href: string;
  variant?: GameButtonVariant;
  size?: GameButtonSize;
  className?: string;
  children: ReactNode;
}

export function GameLink({ href, variant = "primary", size = "md", className, children }: GameLinkProps) {
  return (
    <Link href={href} className={classes(variant, size, className)}>
      {children}
    </Link>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Cargando"
      className={`inline-block animate-spin-slow rounded-full border-2 border-current border-t-transparent ${className ?? "size-5"}`}
    />
  );
}
