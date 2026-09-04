"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import "../welcome.css";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/");
        return;
      }
      // tonight は handle_new_user トリガーで profiles を自動作成するので、
      // ここでは診断済みかどうかだけ見て分岐する。
      const { data: profile } = await supabase
        .from("profiles")
        .select("personality_type")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.personality_type) {
        router.replace("/home");
        return;
      }
      setChecking(false);
    })();
  }, [router, supabase]);

  if (checking) {
    return (
      <main className="welcome-page">
        <div className="welcome-phone">
          <div className="welcome-intro">
            <p className="welcome-copy">確認中…</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="welcome-page">
      <div className="welcome-phone">
        <div className="welcome-intro">
          <p className="welcome-copy">ようこそ Woolinkへ！</p>

          <div className="welcome-panel">
            <div className="welcome-panel-copy">
              <p className="welcome-panel-heading">対人スタイル診断</p>
              <p>
                いくつかの質問に答えると
                <br />
                あなたの対人タイプがわかります。
                <br />
                相性の良い相手との交換日記に使われます。
              </p>
              <p className="welcome-panel-emphasis">数分で終わります</p>
            </div>
          </div>

          <button
            type="button"
            className="welcome-next-btn"
            onClick={() => router.push("/diagnosis")}
          >
            診断を受ける
          </button>

          <button
            type="button"
            onClick={() => router.push("/home")}
            style={{
              background: "none",
              border: "none",
              color: "#c3cff0",
              fontSize: 13,
              textDecoration: "underline",
              textUnderlineOffset: 4,
              cursor: "pointer",
            }}
          >
            あとで
          </button>
        </div>
      </div>
    </main>
  );
}
