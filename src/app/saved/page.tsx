import type { Metadata } from "next";
import { BattleList } from "@/client/battles/BattleList.tsx";
import { ScreenShell } from "@/client/shell/ScreenShell.tsx";

export const metadata: Metadata = { title: "Partidas" };

export default function SavedPage() {
  return (
    <ScreenShell>
      <BattleList status="active" />
    </ScreenShell>
  );
}
