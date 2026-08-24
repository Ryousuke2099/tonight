"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DEMO_USERS } from "@/lib/demo-users";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
    else setSent(true);
  }

  async function demoLogin(demoEmail: string) {
    setError(null);
    setLoadingDemo(demoEmail);
    const demoPassword = process.env.NEXT_PUBLIC_DEMO_USER_PASSWORD || "tonight-demo-pass";
    const { error } = await supabase.auth.signInWithPassword({
      email: demoEmail,
      password: demoPassword,
    });
    setLoadingDemo(null);
    if (error) {
      setError(
        "デモユーザーでのログインに失敗しました。README の手順でシードを実行してください。"
      );
      return;
    }
    router.push("/home");
    router.refresh();
  }

  return (
    <main className="min-h-dvh bg-night flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-10">
        <div className="text-center space-y-2">
          <p className="text-3xl">🌙</p>
          <h1 className="text-xl font-medium text-moon">おかえりなさい</h1>
          <p className="text-sm text-moon/60">今夜話せる友達を見つけよう</p>
        </div>

        <section className="space-y-3">
          <p className="text-xs uppercase tracking-wide text-moon/40">デモで試す</p>
          <div className="grid grid-cols-3 gap-2">
            {DEMO_USERS.map((u) => (
              <button
                key={u.email}
                onClick={() => demoLogin(u.email)}
                disabled={loadingDemo !== null}
                className="flex flex-col items-center gap-1.5 rounded-2xl bg-card px-2 py-3 hover:bg-card-hover transition disabled:opacity-50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u.avatar_url} alt="" className="h-10 w-10 rounded-full bg-night" />
                <span className="text-xs text-moon/80">
                  {loadingDemo === u.email ? "…" : u.name}
                </span>
              </button>
            ))}
          </div>
        </section>

        <div className="flex items-center gap-3 text-moon/30 text-xs">
          <div className="h-px flex-1 bg-moon/10" />
          または
          <div className="h-px flex-1 bg-moon/10" />
        </div>

        <form onSubmit={sendMagicLink} className="space-y-3">
          <input
            type="email"
            required
            placeholder="メールアドレス"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl bg-card px-4 py-3 text-sm text-moon placeholder:text-moon/30 outline-none focus:ring-2 focus:ring-accent/50"
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-accent text-night font-medium py-3 text-sm hover:brightness-105 transition"
          >
            ログインリンクを送る
          </button>
          {sent && (
            <p className="text-xs text-moon/60 text-center">
              メールを確認してください（届いたリンクを開くとログインできます）
            </p>
          )}
          {error && <p className="text-xs text-red-300 text-center">{error}</p>}
        </form>
      </div>
    </main>
  );
}
