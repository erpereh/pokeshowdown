"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type GameButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type GameButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<GameButtonVariant, string> = {
  primary:
    "is-primary rounded-full bg-accent text-white shadow-[0_10px_20px_-10px_#dc2f3ccc,inset_0_-3px_0_#00000026] hover:brightness-105 active:brightness-95",
  secondary:
    "rounded-full border-2 border-line bg-surface text-text shadow-[0_6px_16px_-12px_#28345466] hover:border-accent-2 hover:text-accent-2",
  ghost: "rounded-full text-text-dim hover:bg-surface-2 hover:text-text",
  danger:
    "rounded-full border-2 border-danger/30 bg-danger/10 text-danger hover:bg-danger hover:text-white",
};

const SIZES: Record<GameButtonSize, string> = {
  sm: "min-h-12 px-4 text-sm",
  md: "min-h-12 px-5 text-base",
  lg: "min-h-14 px-7 text-lg",
};

function classes(variant: GameButtonVariant, size: GameButtonSize, extra?: string) {
  return [
    "game-button font-display inline-flex select-none items-center justify-center gap-2 text-center font-semibold",
    "transition-[filter,box-shadow,background-color,border-color,color,transform] duration-[var(--dur-fast)] ease-[var(--ease-spring)]",
    "disabled:pointer-events-none disabled:opacity-45 active:scale-[0.96]",
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
