import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/client/auth/AuthCard.tsx";
import { ScreenShell } from "@/client/shell/ScreenShell.tsx";
import { safeNextPath } from "@/client/shell/paths.ts";
import { readShellUser } from "@/client/shell/session.ts";

export const metadata: Metadata = { title: "Entrar" };

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ next?: string; mode?: string; error?: string }> }) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);
  const user = await readShellUser();
  if (user) redirect(nextPath);

  return (
    <ScreenShell mode="hero" user={null}>
      <AuthCard initialMode={params.mode === "signup" ? "signup" : "login"} nextPath={nextPath} confirmError={params.error === "confirm"} />
    </ScreenShell>
  );
}
