import { redirect } from "next/navigation";
import { HomeHero } from "@/client/home/HomeHero.tsx";
import { ScreenShell } from "@/client/shell/ScreenShell.tsx";
import { readShellUser } from "@/client/shell/session.ts";

export default async function HomePage() {
  const user = await readShellUser();
  if (user) redirect("/play");
  return (
    <ScreenShell mode="hero" user={user}>
      <HomeHero />
    </ScreenShell>
  );
}
