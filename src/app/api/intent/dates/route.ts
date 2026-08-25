import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Given a comma-separated `dates` query param, returns the subset the
 * caller already has a saved daily_intents row for — used by the home
 * screen's date picker to show a small dot under dates with a plan already
 * set, without fetching each date's full intent one by one.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const datesParam = searchParams.get("dates");
  if (!datesParam) return NextResponse.json({ error: "dates required" }, { status: 400 });
  const dates = datesParam.split(",").filter(Boolean);
  if (dates.length === 0) return NextResponse.json({ dates: [] });

  const { data, error } = await supabase
    .from("daily_intents")
    .select("date")
    .eq("user_id", user.id)
    .in("date", dates);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ dates: (data ?? []).map((d) => d.date as string) });
}
