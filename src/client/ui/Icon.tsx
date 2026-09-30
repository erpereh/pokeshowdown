import type { SVGProps } from "react";

export type IconName = "home" | "play" | "team" | "saved" | "history" | "arrow" | "user" | "info" | "close" | "spark" | "bolt" | "swap" | "gem" | "flag" | "plus" | "back" | "friends" | "shuffle" | "download" | "upload" | "copy" | "trash" | "up" | "down" | "chevron";
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
  bolt: "M13 2 4 14h7l-1 8 9-12h-7l1-8Z",
  swap: "M4 8h14l-4-4M20 16H6l4 4",
  gem: "M12 2 20 9l-8 13L4 9l8-7ZM4 9h16M12 2v20",
  flag: "M5 21V4m0 0h12l-2.5 4.5L17 13H5",
  plus: "M12 5v14M5 12h14",
  back: "M20 12H4m6-6-6 6 6 6",
  friends: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21v-2a7 7 0 0 1 12.5-4.3M19 14v6m-3-3h6",
  shuffle: "M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5",
  download: "M12 3v12m-5-5 5 5 5-5M4 21h16",
  upload: "M12 21V9m-5 5 5-5 5 5M4 3h16",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  trash: "M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3",
  up: "m6 15 6-6 6 6",
  down: "m6 9 6 6 6-6",
  chevron: "m9 6 6 6-6 6",
};

export function Icon({ name, className, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg {...props} className={className ?? "size-5"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
