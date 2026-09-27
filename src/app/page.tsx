import { HomeHero } from "@/client/home/HomeHero.tsx";
import { ScreenShell } from "@/client/shell/ScreenShell.tsx";
import { readShellUser } from "@/client/shell/session.ts";

export default async function HomePage() {
  const user = await readShellUser();
  return (
    <ScreenShell mode="hero" user={user}>
      <HomeHero loggedIn={user !== null} />
    </ScreenShell>
  );
}
