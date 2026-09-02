import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * 対人スタイル診断の結果タイプを自分の profiles 行に保存する。
 * RLS の "users update own profile" ポリシーがそのまま効くので、
 * サービスロールは不要（自分の行しか更新できない）。
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { type?: string };
  const type = (body.type ?? "").trim();
  if (!type) {
    return NextResponse.json({ error: "type is required" }, { status: 400 });
  }

  const { error } = await supabase.from("profiles").update({ personality_type: type }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
