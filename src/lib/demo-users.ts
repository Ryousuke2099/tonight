// Shared between the seed script and the /login demo buttons so the two
// never drift out of sync.
export interface DemoUserSeed {
  email: string;
  name: string;
  /** Deterministic placeholder avatar (DiceBear, no API key required). */
  avatar_url: string;
}

const names = ["Takumi", "Haru", "Yuki", "Mei", "Ren", "Sora"] as const;

export const DEMO_USERS: DemoUserSeed[] = names.map((name) => ({
  email: `${name.toLowerCase()}@tonight.demo`,
  name,
  avatar_url: `https://api.dicebear.com/9.x/notionists/svg?seed=${name}&backgroundColor=1e2338`,
}));

/**
 * The subset of demo users that every real signup is auto-friended with
 * (see the handle_new_user() trigger in supabase/schema.sql) and kept
 * "always active" for tonight's date (see demo-companions.ts), so a
 * brand-new user sees a real match right after registering only their own
 * info. Takumi/Sora are left out — they stay pure one-tap demo-login
 * accounts, not auto-added to real users' friend lists.
 */
export const DEMO_COMPANION_NAMES = ["Haru", "Yuki", "Mei", "Ren"] as const;
