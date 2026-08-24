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
