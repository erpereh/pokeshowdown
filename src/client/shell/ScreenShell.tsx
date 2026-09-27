import type { ReactNode } from "react";
import { readShellUser } from "./session.ts";
import { ShellFrame } from "./ShellFrame.tsx";
import type { ShellMode, ShellUser } from "./types.ts";

export async function ScreenShell({
  children,
  mode = "app",
  user,
}: {
  children: ReactNode;
  mode?: ShellMode;
  user?: ShellUser | null;
}) {
  const resolved = user === undefined ? await readShellUser() : user;
  return (
    <ShellFrame user={resolved} mode={mode}>
      {children}
    </ShellFrame>
  );
}
