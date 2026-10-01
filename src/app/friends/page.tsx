import type { Metadata } from "next";
import { ScreenShell } from "@/client/shell/ScreenShell.tsx";
import { FriendsScreen } from "@/client/social/FriendsScreen.tsx";

export const metadata: Metadata = { title: "Amigos" };

export default function FriendsPage() {
  return (
    <ScreenShell>
      <FriendsScreen />
    </ScreenShell>
  );
}
