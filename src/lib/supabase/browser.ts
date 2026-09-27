import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/server/supabase/database.types.ts";

export function createBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase publishable environment");
  }
  return createBrowserClient<Database>(url, key);
}
