import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/client/auth/AuthCard.tsx";
import { ScreenShell } from "@/client/shell/ScreenShell.tsx";
import { readShellUser } from "@/client/shell/session.ts";

export const metadata: Metadata = { title: "Cambiar contraseña" };

export default async function UpdatePasswordPage() {
  const user = await readShellUser();
  if (!user) redirect("/auth?mode=recovery&error=confirm");
  return (
    <ScreenShell mode="hero" user={user}>
      <AuthCard initialMode="password" nextPath="/" confirmError={false} />
    </ScreenShell>
  );
}
