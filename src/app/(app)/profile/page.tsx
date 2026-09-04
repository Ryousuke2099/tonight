"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import WoolinkScreen from "@/components/WoolinkScreen";
import { TYPE_DATA, BALANCE_TYPE } from "@/lib/personality/data-types";

type ProfileRow = { name: string; avatar_url: string | null; personality_type: string | null };

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

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("name, avatar_url, personality_type")
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
