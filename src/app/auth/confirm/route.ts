import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/server/supabase/server";
import { safeNextPath } from "@/client/shell/paths.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OTP_TYPES = new Set<EmailOtpType>(["signup", "invite", "magiclink", "recovery", "email_change", "email"]);

function isOtpType(value: string | null): value is EmailOtpType {
  return value !== null && OTP_TYPES.has(value as EmailOtpType);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const code = url.searchParams.get("code");
  const flowId = url.searchParams.get("sb_flow_id");
  const next = type === "recovery" ? "/auth/update-password" : safeNextPath(url.searchParams.get("next"));

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
    if (!error) redirect(next);
  } else if (tokenHash && isOtpType(type)) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) redirect(next);
  }

  redirect("/auth?error=confirm");
}
