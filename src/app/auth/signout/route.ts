import { NextResponse } from "next/server";
import { createServerSupabase } from "@/server/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function originMatchesHost(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!originMatchesHost(request)) {
    return new Response(null, { status: 403 });
  }
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), 303);
}
