import type { Metadata } from "next";
import { BattleScreen } from "@/client/battle/BattleScreen.tsx";
import { ScreenShell } from "@/client/shell/ScreenShell.tsx";

export const metadata: Metadata = { title: "Combate" };

export default async function BattlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ScreenShell mode="battle">
      <BattleScreen battleId={id} />
    </ScreenShell>
  );
}
