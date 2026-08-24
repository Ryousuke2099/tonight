/**
 * Seeds the six demo users (Takumi/Haru/Yuki/Mei/Ren/Sora), a fully-connected
 * friend graph between them, and confirms their emails so the /login demo
 * buttons work immediately.
 *
 * Usage:
 *   node --env-file=.env.local -r tsx/cjs scripts/seed.ts
 *   (or just `npm run seed`, which wires this up)
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.
 * Safe to re-run — existing users/friendships are left alone.
 */
import { createClient } from "@supabase/supabase-js";
import { DEMO_USERS } from "../src/lib/demo-users";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const demoPassword = process.env.NEXT_PUBLIC_DEMO_USER_PASSWORD || "tonight-demo-pass";

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Copy .env.local.example to .env.local and fill in your Supabase project's values first."
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function findUserByEmail(email: string) {
  // admin.listUsers doesn't filter by email server-side pre-v2.45, so page
  // through — fine at demo-data scale (6 users).
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email === email);
    if (found) return found;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function ensureDemoUser(seed: (typeof DEMO_USERS)[number]) {
  const existing = await findUserByEmail(seed.email);
  if (existing) {
    console.log(`✓ ${seed.name} already exists`);
    return existing.id;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: seed.email,
    password: demoPassword,
    email_confirm: true,
    user_metadata: { name: seed.name, avatar_url: seed.avatar_url },
  });
  if (error || !data.user) throw error ?? new Error(`failed to create ${seed.email}`);
  console.log(`+ created ${seed.name}`);
  return data.user.id;
}

async function ensureFriendship(a: string, b: string) {
  const { error } = await admin
    .from("friendships")
    .upsert({ user_id: a, friend_id: b }, { onConflict: "user_id,friend_id", ignoreDuplicates: true });
  if (error) throw error;
}

async function main() {
  console.log(`Seeding ${DEMO_USERS.length} demo users…`);
  const ids: string[] = [];
  for (const seed of DEMO_USERS) {
    ids.push(await ensureDemoUser(seed));
  }

  console.log("Wiring up a fully-connected friend graph…");
  for (let i = 0; i < ids.length; i++) {
    for (let j = 0; j < ids.length; j++) {
      if (i === j) continue;
      await ensureFriendship(ids[i], ids[j]);
    }
  }

  console.log("\nDone. Demo login password:", demoPassword);
  console.log("Sign in as any of:", DEMO_USERS.map((u) => u.name).join(", "), "from /login.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
