"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DEMO_USERS } from "@/lib/demo-users";

// 説明カルーセルとは独立した、ログインだけを担当する画面。
// Google OAuth / マジックリンク / ワンタップのデモログイン の3経路。
export default function LoginScreen() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError("Googleログインに失敗しました: " + error.message);
  };

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
    else setSent(true);
  };

  const demoLogin = async (demoEmail: string) => {
    setError(null);
    setBusy(demoEmail);
    const demoPassword = process.env.NEXT_PUBLIC_DEMO_USER_PASSWORD || "tonight-demo-pass";
    const { error } = await supabase.auth.signInWithPassword({
      email: demoEmail,
      password: demoPassword,
    });
    setBusy(null);
    if (error) {
      setError("デモログインに失敗しました。シード（npm run seed）を実行してください。");
      return;
    }
    router.push("/onboarding");
    router.refresh();
  };

  return (
    <div className="login-screen">
      <Image
        className="login-logo"
        src="/woolink-logo.svg"
        alt="Woolink"
        width={300}
        height={100}
        priority
      />

      <p className="login-tagline">ようこそ Woolinkへ！</p>

      <button type="button" className="welcome-next-btn" onClick={handleGoogleLogin}>
        Googleでログイン
      </button>

      <form onSubmit={sendMagicLink} style={{ width: "min(80vw, 300px)", display: "flex", flexDirection: "column", gap: 10 }}>
        <input
          type="email"
          required
          placeholder="メールアドレス"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid rgba(238,240,251,0.25)",
            background: "rgba(13,20,66,0.35)",
            color: "#eef0fb",
            fontSize: 14,
            outline: "none",
          }}
        />
        <button
          type="submit"
          className="welcome-next-btn"
          style={{ width: "100%" }}
        >
          ログインリンクを送る
        </button>
        {sent && (
          <p style={{ fontSize: 12, color: "#c3cff0", margin: 0 }}>
            メールを確認してください（届いたリンクを開くとログイン）
          </p>
        )}
      </form>

      <div style={{ width: "min(80vw, 300px)" }}>
        <p style={{ fontSize: 11, letterSpacing: "0.08em", color: "rgba(238,240,251,0.5)", margin: "0 0 8px" }}>
          デモで試す
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {DEMO_USERS.map((u) => (
            <button
              key={u.email}
              type="button"
              onClick={() => demoLogin(u.email)}
              disabled={busy !== null}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                padding: "10px 4px",
                borderRadius: 14,
                border: "none",
                background: "rgba(13,20,66,0.35)",
                color: "#eef0fb",
                fontSize: 12,
                cursor: "pointer",
                opacity: busy !== null ? 0.5 : 1,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={u.avatar_url}
                alt=""
                style={{ width: 36, height: 36, borderRadius: "50%", background: "#1e2338" }}
              />
              <span>{busy === u.email ? "…" : u.name}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <p style={{ fontSize: 12, color: "#ffb4b4", margin: 0 }}>{error}</p>}
    </div>
  );
}
