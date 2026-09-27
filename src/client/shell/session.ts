import { createServerSupabase } from "@/server/supabase/server";
import type { ShellUser } from "./types.ts";

export async function readShellUser(): Promise<ShellUser | null> {
  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;

    const metadata = data.user.user_metadata as { display_name?: unknown } | undefined;
    let displayName = typeof metadata?.display_name === "string" ? metadata.display_name.trim() : "";

    if (!displayName) {
      const { data: profile } = await supabase.from("profiles").select("display_name").eq("user_id", data.user.id).maybeSingle();
      if (profile && typeof profile.display_name === "string") displayName = profile.display_name.trim();
    }

    if (!displayName) displayName = data.user.email?.split("@")[0] || "Entrenador";
    return { displayName, email: data.user.email ?? "" };
  } catch {
    return null;
  }
}
