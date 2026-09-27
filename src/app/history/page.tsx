import type { Metadata } from "next";
import { BattleList } from "@/client/battles/BattleList.tsx";
import { ScreenShell } from "@/client/shell/ScreenShell.tsx";

export const metadata: Metadata = { title: "Historial" };

export default function HistoryPage() {
  return (
    <ScreenShell>
      <BattleList status="finished" />
    </ScreenShell>
  );
}
