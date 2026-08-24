import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { MatchWithFriend } from "@/types/db";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  // RLS already scopes this to rows where the caller is user_a or user_b.
  const { data: matches, error } = await supabase
    .from("matches")
    .select("*")
    .eq("date", date)
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!matches || matches.length === 0) return NextResponse.json({ matches: [] });

  const friendIds = matches.map((m) => (m.user_a === user.id ? m.user_b : m.user_a));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, avatar_url")
    .in("id", friendIds);
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const result: MatchWithFriend[] = matches.map((m) => {
    const friendId = m.user_a === user.id ? m.user_b : m.user_a;
    return {
      ...m,
      friend: profileMap.get(friendId) ?? { id: friendId, name: "友達", avatar_url: null },
    };
  });

  return NextResponse.json({ matches: result });
}
