import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { tonightDateJST } from "@/lib/date";
import { longestContiguousRun, formatRange } from "@/lib/slots";
import type { SlotIndex } from "@/types/db";

/**
 * Fires once a day (see .github/workflows/daily-reminders.yml) and emails
 * everyone who has a daily_intents row for TODAY a same-day reminder — this
 * is what makes the "register up to a week ahead" date picker in
 * HomeClient.tsx actually useful, rather than something people set and
 * forget. Protected by a shared secret instead of user auth, since this is
 * called by an external scheduler with no logged-in session — never expose
 * CRON_SECRET to the client.
 *
 * Idempotent: sent_reminders(user_id, date) is unique, so a retried or
 * duplicate run for the same day never double-emails anyone.
 */
export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: "RESEND_API_KEY is not configured" }, { status: 500 });
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://tonight-mvp.netlify.app";

  const admin = createAdminClient();
  const date = tonightDateJST();

  const { data: intents, error } = await admin.from("daily_intents").select("user_id").eq("date", date);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!intents || intents.length === 0) return NextResponse.json({ sent: 0, date });

  const userIds = intents.map((i) => i.user_id as string);

  const [{ data: profiles }, { data: avails }, { data: alreadySent }] = await Promise.all([
    admin.from("profiles").select("id, name, is_demo").in("id", userIds),
    admin.from("availabilities").select("user_id, slots").eq("date", date).in("user_id", userIds),
    admin.from("sent_reminders").select("user_id").eq("date", date).in("user_id", userIds),
  ]);

  const availMap = new Map((avails ?? []).map((a) => [a.user_id as string, (a.slots as SlotIndex[]) ?? []]));
  const alreadySentIds = new Set((alreadySent ?? []).map((r) => r.user_id as string));

  let sent = 0;
  for (const userId of userIds) {
    if (alreadySentIds.has(userId)) continue;
    const profile = profiles?.find((p) => p.id === userId);
    if (!profile || profile.is_demo) continue; // never email demo/companion accounts

    const { data: userRes } = await admin.auth.admin.getUserById(userId);
    const email = userRes?.user?.email;
    if (!email) continue;

    const slots = availMap.get(userId) ?? [];
    const run = longestContiguousRun(slots);
    const rangeText = run ? formatRange(run.start, run.end) : null;

    const ok = await sendReminderEmail(resendKey, email, profile.name, siteUrl, rangeText);
    if (ok) {
      await admin.from("sent_reminders").insert({ user_id: userId, date });
      sent += 1;
    }
  }

  return NextResponse.json({ sent, date });
}

async function sendReminderEmail(
  apiKey: string,
  to: string,
  name: string,
  siteUrl: string,
  rangeText: string | null
) {
  const rangeLine = rangeText
    ? `<p>登録していた時間: <strong>${rangeText}</strong></p>`
    : "";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Tonight <onboarding@resend.dev>",
        to,
        subject: "🌙 今夜、話したいって登録してましたね",
        html:
          `<p>${name}さん、こんばんは。</p>` +
          `<p>以前、今日話せる時間として登録していました。マッチを確認してみましょう。</p>` +
          rangeLine +
          `<p><a href="${siteUrl}/home">Tonightを開く</a></p>`,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
