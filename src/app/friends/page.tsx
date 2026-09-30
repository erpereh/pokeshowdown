import type { Metadata } from "next";
import { ScreenShell } from "@/client/shell/ScreenShell.tsx";
import { PageHeader } from "@/client/ui/PageHeader.tsx";

export const metadata: Metadata = { title: "Amigos" };

export default function FriendsPage() {
  return (
    <ScreenShell>
      <PageHeader title="Amigos" />
    </ScreenShell>
  );
}
