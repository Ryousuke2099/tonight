import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findPrompt } from "@/lib/diary-prompts";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const { data: room, error: roomError } = await supabase.from("diary_rooms").select("*").eq("id", id).maybeSingle();
  if (roomError) return NextResponse.json({ error: roomError.message }, { status: 500 });
  if (!room) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (room.mode === "a") {
    const expired = room.window_expires_at && new Date(room.window_expires_at).getTime() < Date.now();
    const atLimit = room.max_exchanges !== null && room.exchange_count >= room.max_exchanges;
    if (expired || atLimit) {
      return NextResponse.json(
        { error: "この交換日記は期間・往復回数の上限に達しています。「続けたい」がお互いに揃えば知人として続けられます。" },
        { status: 409 }
      );
    }
  }

  const body = (await request.json().catch(() => ({}))) as { body?: string; promptId?: string };
  const text = (body.body ?? "").trim();
  if (!text) return NextResponse.json({ error: "本文を入力してください" }, { status: 400 });
  if (text.length > 2000) return NextResponse.json({ error: "本文が長すぎます" }, { status: 400 });

  const prompt = findPrompt(body.promptId);

  const { data: entry, error: insertError } = await supabase
    .from("diary_entries")
    .insert({ room_id: id, author_id: user.id, body: text, prompt: prompt?.label ?? null })
    .select("*")
    .single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  const { error: updateError } = await supabase
    .from("diary_rooms")
    .update({ exchange_count: room.exchange_count + 1 })
    .eq("id", id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ entry });
}
