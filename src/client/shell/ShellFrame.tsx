"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ToastViewport } from "@/client/ui/Toast.tsx";
import { cx } from "@/client/ui/cx.ts";
import { Icon } from "@/client/ui/Icon.tsx";
import { GameLink } from "@/client/ui/GameButton.tsx";
import { Pokeball } from "@/client/ui/Card.tsx";
import { NAV_ITEMS, navActive, type ShellMode, type ShellUser } from "./types.ts";

function Wordmark() {
  return (
    <Link href="/" aria-label="PokeShowdown, inicio" className="font-display group inline-flex min-h-12 shrink-0 items-center gap-2 text-xl font-bold">
      <Pokeball className="size-8 transition-transform duration-500 ease-[var(--ease-spring)] group-hover:rotate-[360deg]" />
      <span>Poke<span className="text-accent">Showdown</span></span>
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
      <GameLink href="/auth" variant="secondary" size="sm">
        Entrar
      </GameLink>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="card font-display inline-flex min-h-12 max-w-[8rem] items-center gap-2 rounded-full px-3 text-sm font-semibold sm:max-w-[12rem]"
        aria-label={`Cuenta de ${user.displayName}`}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="user" className="size-4 shrink-0" /><span className="hidden truncate min-[390px]:inline">{user.displayName}</span>
      </button>
      {open ? (
        <div id={menuId} className="card animate-pop-in absolute right-0 z-50 mt-2 w-56 origin-top-right rounded-[20px] p-2">
          <p className="truncate px-2 py-1 text-sm font-semibold">{user.displayName}</p>
          {user.email ? <p className="truncate px-2 pb-2 text-xs text-text-dim">{user.email}</p> : null}
          <form action="/auth/signout" method="post">
            <button type="submit" className="font-display min-h-12 w-full rounded-[14px] px-2 text-left text-sm font-semibold text-danger hover:bg-danger/10">
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
    <nav aria-label="Principal" className="card hidden items-center gap-1 rounded-full p-1 lg:flex">
      {NAV_ITEMS.map((item) => {
        const active = navActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "font-display inline-flex min-h-12 items-center rounded-full px-4 text-sm font-semibold transition-colors duration-[var(--dur-fast)]",
              active ? "bg-accent text-white shadow-[0_6px_14px_-8px_#dc2f3c]" : "text-text-dim hover:text-text",
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
      className="mobile-nav lg:hidden"
    >
      <ul className="grid grid-cols-5 gap-1">
        {NAV_ITEMS.map((item) => {
          const active = navActive(pathname, item.href);
          const play = item.href === "/play";
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "nav-tab font-display flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold sm:text-xs",
                  play && "is-play",
                )}
              >
                {play ? (
                  <span className="nav-play-ball bg-surface"><Pokeball className="size-full" /></span>
                ) : (
                  <Icon name={item.icon} className="size-6" />
                )}
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
          "app-header z-40 flex shrink-0 items-center justify-between gap-2 px-4 sm:px-6",
          mode === "battle"
            ? "border-b border-line bg-surface"
            : "sticky top-0 bg-bg-0/85 backdrop-blur-md",
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
              ? "page-enter flex-1"
              : "page-enter app-content mx-auto w-full max-w-6xl flex-1 px-4 pt-4 sm:px-6 sm:pt-8"
        }
      >
        {children}
      </main>
      {mode === "battle" ? null : <BottomTabs />}
      <ToastViewport />
    </div>
  );
}
