export interface ShellUser {
  displayName: string;
  email: string;
}

export type ShellMode = "app" | "hero" | "battle";

export const NAV_ITEMS = [
  { href: "/friends", label: "Amigos", icon: "friends" },
  { href: "/teams", label: "Equipos", icon: "team" },
  { href: "/play", label: "Jugar", icon: "play" },
  { href: "/saved", label: "Partidas", icon: "saved" },
  { href: "/history", label: "Historial", icon: "history" },
] as const;

export function navActive(pathname: string, href: string): boolean {
  if (href === "/history") return pathname.startsWith("/history") || pathname.startsWith("/replay");
  return pathname === href || pathname.startsWith(`${href}/`);
}
