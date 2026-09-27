export interface ShellUser {
  displayName: string;
  email: string;
}

export type ShellMode = "app" | "hero" | "battle";

export const NAV_ITEMS = [
  { href: "/play", label: "Jugar" },
  { href: "/teams", label: "Equipos" },
  { href: "/saved", label: "Partidas" },
  { href: "/history", label: "Historial" },
] as const;

export function navActive(pathname: string, href: string): boolean {
  if (href === "/history") return pathname.startsWith("/history") || pathname.startsWith("/replay");
  return pathname === href || pathname.startsWith(`${href}/`);
}
