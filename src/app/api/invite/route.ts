import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const date: string = body.date ?? new Date().toISOString().slice(0, 10);

  const token = randomBytes(9).toString("base64url");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 1);

  const { data, error } = await supabase
    .from("invite_links")
    .insert({
      creator_user_id: user.id,
      token,
      date,
      expires_at: expiresAt.toISOString(),
    })
    .select("id, token")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "failed to create invite" }, { status: 500 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return NextResponse.json({ id: data.id, token: data.token, url: `${siteUrl}/i/${data.token}` });
}
