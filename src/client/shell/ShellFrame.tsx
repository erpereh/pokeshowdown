"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ToastViewport } from "@/client/ui/Toast.tsx";
import { cx } from "@/client/ui/cx.ts";
import { NAV_ITEMS, navActive, type ShellMode, type ShellUser } from "./types.ts";

function Wordmark() {
  return (
    <Link href="/" className="font-display inline-flex min-h-11 items-center text-lg font-bold tracking-wide">
      Poke<span className="text-accent">Showdown</span>
    </Link>
  );
}

function UserMenu({ user }: { user: ShellUser | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) {
    return (
      <Link href="/auth" className="font-display inline-flex min-h-11 items-center rounded-[var(--radius-card)] bg-accent px-4 text-sm font-semibold uppercase text-bg-0">
        Entrar
      </Link>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="font-display inline-flex min-h-11 max-w-[12rem] items-center gap-2 rounded-[var(--radius-card)] border border-line px-3 text-sm font-semibold"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="truncate">{user.displayName}</span>
      </button>
      {open ? (
        <div id={menuId} role="menu" className="glass absolute right-0 z-50 mt-2 w-56 rounded-[var(--radius-card)] p-2 shadow-[0_16px_40px_#00000088]">
          <p className="truncate px-2 py-1 text-sm font-semibold">{user.displayName}</p>
          {user.email ? <p className="truncate px-2 pb-2 text-xs text-text-dim">{user.email}</p> : null}
          <form action="/auth/signout" method="post">
            <button type="submit" role="menuitem" className="font-display min-h-11 w-full rounded-[10px] px-2 text-left text-sm font-semibold uppercase text-danger hover:bg-danger/10">
              Cerrar sesión
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function TopNav({ mode }: { mode: ShellMode }) {
  const pathname = usePathname();
  if (mode === "battle") return null;
  return (
    <nav aria-label="Principal" className="hidden items-center gap-1 md:flex">
      {NAV_ITEMS.map((item) => {
        const active = navActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "font-display inline-flex min-h-11 items-center px-3 text-sm font-semibold uppercase tracking-wide",
              active ? "text-accent" : "text-text-dim hover:text-text",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function BottomTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg-0/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="grid grid-cols-4">
        {NAV_ITEMS.map((item) => {
          const active = navActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "font-display flex min-h-14 flex-col items-center justify-center text-[11px] font-semibold uppercase tracking-wide",
                  active ? "text-accent" : "text-text-dim",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function ShellFrame({ user, mode, children }: { user: ShellUser | null; mode: ShellMode; children: ReactNode }) {
  return (
    <div className={mode === "battle" ? "flex h-dvh flex-col overflow-hidden" : "flex min-h-dvh flex-col overflow-x-hidden"}>
      <header
        className={cx(
          "z-40 flex min-h-14 shrink-0 items-center justify-between gap-3 px-3 sm:px-4",
          "pt-[env(safe-area-inset-top)]",
          mode === "hero"
            ? "fixed inset-x-0 top-0 bg-gradient-to-b from-bg-0/80 to-transparent"
            : mode === "battle"
              ? "border-b border-line bg-bg-0/90 backdrop-blur-md"
              : "sticky top-0 border-b border-line bg-bg-0/90 backdrop-blur-md",
        )}
      >
        <Wordmark />
        <TopNav mode={mode} />
        <UserMenu user={user} />
      </header>
      <main
        className={
          mode === "battle"
            ? "flex min-h-0 flex-1 flex-col overflow-hidden"
            : mode === "hero"
              ? "flex-1"
              : "mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-10"
        }
      >
        {children}
      </main>
      {mode === "battle" ? null : <BottomTabs />}
      <ToastViewport />
    </div>
  );
}
