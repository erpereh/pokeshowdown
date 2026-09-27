import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types.ts";
import { supabaseSecretKey, supabaseUrl } from "./env.ts";

export type DbClient = SupabaseClient<Database>;

export function createAdminSupabase(): DbClient {
  return createClient<Database>(supabaseUrl(), supabaseSecretKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
