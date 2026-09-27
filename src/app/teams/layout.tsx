import { ScreenShell } from "@/client/shell/ScreenShell";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Equipos",
  description: "Constructor de equipos Gen 9 OU.",
};

export default async function TeamsLayout({ children }: { children: ReactNode }) {
  return <ScreenShell>{children}</ScreenShell>;
}
