import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Server-side Supabase client for use in Route Handlers / Server Components.
 * Still uses the anon key + the caller's auth cookie, so RLS applies exactly
 * as it would client-side — this is NOT a privilege escalation, just SSR
 * plumbing. Use `createAdminClient` when you deliberately need to bypass RLS. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // called from a Server Component with no request context to write
            // cookies to — safe to ignore, middleware refreshes the session.
          }
        },
      },
    }
  );
}
