import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Public route — guests are never authenticated, so this deliberately uses
// the admin client (server-only) rather than exposing invite_links via RLS
// to anon. It reveals only the inviter's name/avatar and the invite's date,
// never any of the inviter's actual intent or availability.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: invite, error } = await admin
    .from("invite_links")
    .select("id, token, date, expires_at, creator_user_id")
    .eq("token", token)
    .maybeSingle();

  if (error || !invite) {
    return NextResponse.json({ error: "invite not found" }, { status: 404 });
  }

  const expired = new Date(invite.expires_at).getTime() < Date.now();

  const { data: creator } = await admin
    .from("profiles")
    .select("name, avatar_url")
    .eq("id", invite.creator_user_id)
    .maybeSingle();

  return NextResponse.json({
    date: invite.date,
    expired,
    creator: creator ?? { name: "友達", avatar_url: null },
  });
}
