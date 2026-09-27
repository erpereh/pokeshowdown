import type { Metadata } from "next";
import { ReplayScreen } from "@/client/battle/ReplayScreen.tsx";
import { ScreenShell } from "@/client/shell/ScreenShell.tsx";

export const metadata: Metadata = { title: "Repetición" };

export default async function ReplayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ScreenShell mode="battle">
      <ReplayScreen replayId={id} />
    </ScreenShell>
  );
}
