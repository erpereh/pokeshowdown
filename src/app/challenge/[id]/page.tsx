import type { Metadata } from "next";
import { ScreenShell } from "@/client/shell/ScreenShell.tsx";
import { ChallengeLobby } from "@/client/social/ChallengeLobby.tsx";

export const metadata: Metadata = { title: "Desafío" };

export default async function ChallengePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ScreenShell>
      <ChallengeLobby challengeId={id} />
    </ScreenShell>
  );
}
