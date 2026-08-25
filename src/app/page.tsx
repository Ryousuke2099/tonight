import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Walkthrough from "@/components/Walkthrough";

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/home");

  return (
    <main className="min-h-dvh flex flex-col px-6">
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-6 max-w-sm mx-auto w-full">
        <p className="text-5xl">🌙</p>

        <h1 className="text-2xl font-semibold text-moon leading-snug">
          今電話していい、
          <br />
          がわかる。
        </h1>

        <Walkthrough />

        <Link
          href="/login"
          className="w-full rounded-xl bg-accent text-night font-medium py-3.5 text-sm hover:brightness-105 transition"
        >
          今夜話せる友達を探す
        </Link>
      </div>

      <p className="text-center text-xs text-moon/25 pb-6">Tonight — お互い話したい夜だけ、つながる。</p>
    </main>
  );
}
