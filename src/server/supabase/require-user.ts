import "server-only";
import type { User } from "@supabase/supabase-js";
import { ApiException } from "../http/error.ts";
import type { DbClient } from "./admin.ts";
import { createServerSupabase } from "./server.ts";

export async function requireUser(): Promise<{ supabase: DbClient; user: User }> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new ApiException(401, "unauthorized", "No autenticado");
  }
  return { supabase, user: data.user };
}
