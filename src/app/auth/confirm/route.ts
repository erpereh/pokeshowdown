import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/server/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OTP_TYPES = new Set<EmailOtpType>(["signup", "invite", "magiclink", "recovery", "email_change", "email"]);

function safeNext(value: string | null, origin: string): string {
  if (!value) return "/";
  if (/[\u0000-\u001f\u007f\\]/.test(value) || /%(?:09|0a|0d)/i.test(value)) return "/";
  let resolved: URL;
  try {
    resolved = new URL(value, origin);
  } catch {
    return "/";
  }
  if (resolved.origin !== origin) return "/";
  return `${resolved.pathname}${resolved.search}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = safeNext(url.searchParams.get("next"), url.origin);

  if (tokenHash && type && OTP_TYPES.has(type as EmailOtpType)) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    });
    if (!error) redirect(next);
  }

  redirect("/auth?error=confirm");
}
