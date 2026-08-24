import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tonightDateJST } from "@/lib/date";
import { allSlotIndices } from "@/lib/slots";
import { DEMO_COMPANION_NAMES } from "@/lib/demo-users";

/**
 * Ensures the demo companions (Haru/Yuki/Mei/Ren) have a wide-open
 * ('anyone' mode, full-night availability) daily_intents + availabilities
 * row for `date` — but only when `date` is tonight. This is what lets a
 * brand-new real user register just their own info and immediately see
 * "this is what a match looks like", without needing to log in as anyone
 * else first.
 *
 * Deliberately insert-only (ignoreDuplicates): if a companion account
 * already has a row for today — e.g. because someone is actually testing
 * the app logged in as Haru right now — we never clobber it.
 *
 * Called lazily from POST /api/intent, right before match computation.
 * No Netlify Scheduled Functions / cron needed for this part.
 */
export async function ensureDemoCompanionsActiveFor(admin: SupabaseClient, date: string) {
  if (date !== tonightDateJST()) return;

  const { data: companions } = await admin
    .from("profiles")
    .select("id")
    .eq("is_demo", true)
    .in("name", DEMO_COMPANION_NAMES);
  if (!companions || companions.length === 0) return;

  const nowIso = new Date().toISOString();
  const fullNight = allSlotIndices();

  for (const companion of companions) {
    await admin
      .from("daily_intents")
      .upsert(
        { user_id: companion.id, date, mode: "anyone", updated_at: nowIso },
        { onConflict: "user_id,date", ignoreDuplicates: true }
      );
    await admin
      .from("availabilities")
      .upsert(
        { user_id: companion.id, date, slots: fullNight, updated_at: nowIso },
        { onConflict: "user_id,date", ignoreDuplicates: true }
      );
  }
}
