"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type GameButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type GameButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<GameButtonVariant, string> = {
  primary:
    "rounded-[var(--radius-card)] border border-[#ffe4a8] bg-[linear-gradient(135deg,#ffe3a6,#ffd479)] text-bg-0 shadow-[inset_0_1px_0_#ffffff60,0_6px_20px_#ffd47918] hover:brightness-110 active:brightness-95",
  secondary:
    "rounded-[var(--radius-card)] border border-line-strong bg-white/5 text-text shadow-[inset_0_1px_0_#ffffff0c] hover:border-accent-2 hover:bg-white/10",
  ghost: "rounded-[var(--radius-card)] text-text-dim hover:bg-white/5 hover:text-text",
  danger:
    "rounded-[var(--radius-card)] border border-danger/60 bg-danger/15 text-danger hover:bg-danger/25 hover:shadow-[0_0_18px_#f0544f44]",
};

const SIZES: Record<GameButtonSize, string> = {
  sm: "min-h-12 px-3 text-sm",
  md: "min-h-12 px-4 text-sm",
  lg: "min-h-14 px-7 text-lg",
};

function classes(variant: GameButtonVariant, size: GameButtonSize, extra?: string) {
  return [
    "game-button font-display inline-flex select-none items-center justify-center gap-2 text-center font-semibold",
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
