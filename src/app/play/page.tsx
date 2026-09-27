import type { Metadata } from "next";
import { PlaySetup } from "@/client/play/PlaySetup.tsx";
import { ScreenShell } from "@/client/shell/ScreenShell.tsx";
import type { FormatId } from "@/shared/contract";

export const metadata: Metadata = { title: "Jugar" };

function initialFormat(value: string | undefined): FormatId | null {
  if (value === "gen9ou" || value === "gen9randombattle") return value;
  return null;
}

export default async function PlayPage({ searchParams }: { searchParams: Promise<{ format?: string }> }) {
  const params = await searchParams;
  return (
    <ScreenShell>
      <PlaySetup initialFormat={initialFormat(params.format)} />
    </ScreenShell>
  );
}
