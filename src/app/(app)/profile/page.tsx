"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import WoolinkScreen from "@/components/WoolinkScreen";
import { TYPE_DATA, BALANCE_TYPE } from "@/lib/personality/data-types";

type ProfileRow = {
  name: string;
  avatar_url: string | null;
  personality_type: string | null;
  public_user_id: string | null;
};

function typeLabel(pt: string | null): string {
  if (!pt) return "未診断";
  if (pt === "balance") return (BALANCE_TYPE as { name: string }).name ?? "バランス型";
  const t = (TYPE_DATA as Record<string, { name: string }>)[pt];
  return t?.name ?? pt;
}

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [friendCount, setFriendCount] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("name, avatar_url, personality_type, public_user_id")
          .eq("id", user.id)
          .maybeSingle();
        setProfile(data as ProfileRow | null);
      }
      const res = await fetch("/api/friends");
      if (res.ok) {
        const { friends } = await res.json();
        setFriendCount((friends ?? []).length);
      }
    })();
  }, [supabase]);

  const row = (label: string, value: string) => (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "13px 0",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        fontSize: 14,
      }}
    >
      <span style={{ color: "#b7bce0" }}>{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
    </div>
  );

  return (
    <WoolinkScreen title="プロフィール">
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
        <Avatar src={profile?.avatar_url ?? null} name={profile?.name ?? "you"} size={56} />
        <p style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{profile?.name ?? "…"}</p>
      </div>

      {row("対人スタイル", typeLabel(profile?.personality_type ?? null))}
      {row("友達", friendCount === null ? "…" : `${friendCount}人`)}

      {profile?.public_user_id && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 12, color: "#b7bce0", margin: "0 0 6px" }}>
            公開ID（交換日記でこの相手に送りたい、と伝えるときに使えます）
          </p>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(profile.public_user_id!);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {
                // クリップボード権限が無い環境では静かに諦める
              }
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(20,28,62,0.55)",
              color: "#eef0fb",
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: "0.08em",
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            <span>{profile.public_user_id}</span>
            <span style={{ fontSize: 12, fontWeight: 400, color: "#9fa5c8" }}>
              {copied ? "コピーしました" : "タップでコピー"}
            </span>
          </button>
        </div>
      )}

      <Link
        href="/personality"
        style={{
          display: "block",
          marginTop: 20,
          textAlign: "center",
          padding: "13px",
          borderRadius: 999,
          background: "linear-gradient(135deg, #6f7bf2 0%, #4b57d6 100%)",
          color: "#fff",
          fontSize: 14,
          fontWeight: 700,
          textDecoration: "none",
        }}
      >
        対人スタイル診断をやり直す
      </Link>
    </WoolinkScreen>
  );
}
