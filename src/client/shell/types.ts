export interface ShellUser {
  displayName: string;
  email: string;
}

export type ShellMode = "app" | "hero" | "battle";

export const NAV_ITEMS = [
  { href: "/", label: "Inicio", icon: "home" },
  { href: "/play", label: "Jugar", icon: "play" },
  { href: "/teams", label: "Equipos", icon: "team" },
  { href: "/saved", label: "Partidas", icon: "saved" },
  { href: "/history", label: "Historial", icon: "history" },
] as const;

export function navActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/history") return pathname.startsWith("/history") || pathname.startsWith("/replay");
  return pathname === href || pathname.startsWith(`${href}/`);
}
