"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import WoolinkScreen from "@/components/WoolinkScreen";

type Row = {
  id: string;
  started_at: string;
  partnerId: string;
  partnerName: string;
  partnerAvatar: string | null;
};

function formatDateJa(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

// Woolink 側にはまだ履歴画面が存在しない(2026-09-04時点)ので、rooms/submissions
// (supabase/woolink_diary_exchange_migration.sql)から実データで組んだ最小版。
export default function DiaryHistoryPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: rooms } = await supabase
        .from("rooms")
        .select("id, started_at, user_a_id, user_b_id")
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
        .order("started_at", { ascending: false });

      if (!rooms || rooms.length === 0) {
        setRows([]);
        return;
      }

      const partnerIds = rooms.map((r) => (r.user_a_id === user.id ? r.user_b_id : r.user_a_id));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, avatar_url")
        .in("id", partnerIds);
      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

      setRows(
        rooms.map((r) => {
          const partnerId = r.user_a_id === user.id ? r.user_b_id : r.user_a_id;
          const p = profileMap.get(partnerId);
          return {
            id: r.id,
            started_at: r.started_at,
            partnerId,
            partnerName: p?.name ?? "相手",
            partnerAvatar: p?.avatar_url ?? null,
          };
        })
      );
    })();
  }, [supabase]);

  return (
    <WoolinkScreen title="これまでの日記" back="/diary">
      {rows === null && <p style={{ fontSize: 13, color: "#a9adcf" }}>読み込み中…</p>}
      {rows?.length === 0 && (
        <p style={{ fontSize: 13, color: "#a9adcf" }}>まだ交換が成立した日記はありません。</p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows?.map((r) => (
          <Link
            key={r.id}
            href={`/diary/room/${r.id}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              borderRadius: 14,
              background: "rgba(255,255,255,0.06)",
              textDecoration: "none",
              color: "#eef0fb",
            }}
          >
            <Avatar src={r.partnerAvatar} name={r.partnerName} size={36} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{r.partnerName}</span>
            <span style={{ fontSize: 12, color: "#9fa5c8" }}>{formatDateJa(r.started_at)}</span>
          </Link>
        ))}
      </div>
    </WoolinkScreen>
  );
}
