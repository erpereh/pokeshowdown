import type { SVGProps } from "react";

export type IconName = "home" | "play" | "team" | "saved" | "history" | "arrow" | "user" | "info" | "close" | "spark";
const paths: Record<IconName, string> = {
  home: "m3 10 9-7 9 7M5 9v11h5v-6h4v6h5V9",
  play: "m9 5 11 7-11 7V5ZM4 5v14",
  team: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21v-3a7 7 0 0 1 14 0v3M17 4a4 4 0 0 1 0 8M22 21v-3a7 7 0 0 0-3-6",
  saved: "M7 3h10a3 3 0 0 1 3 3v15l-8-5-8 5V6a3 3 0 0 1 3-3Z",
  history: "M3 11a9 9 0 1 1 2.7 7.4M3 4v7h7M12 7v5l3 2",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0",
  info: "M12 8h.01M12 11v6M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z",
  close: "m6 6 12 12M6 18 18 6",
  spark: "m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z",
};

export function Icon({ name, className, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg {...props} className={className ?? "size-5"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
