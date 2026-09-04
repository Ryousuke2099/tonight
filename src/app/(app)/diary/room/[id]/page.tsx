"use client";

import { use, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import WoolinkScreen from "@/components/WoolinkScreen";
import type { DiarySubmission } from "@/types/db";

type State =
  | { kind: "loading" }
  | { kind: "not-found" }
  | {
      kind: "ready";
      partnerName: string;
      partnerAvatar: string | null;
      mine: DiarySubmission | null;
      theirs: DiarySubmission | null;
    };

// Woolink 側にはまだ「相手の日記を読む」画面が存在しない(2026-09-04時点)ので、
// rooms/submissions から実データで組んだ最小版。
export default function DiaryRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: room } = await supabase
        .from("rooms")
        .select("id, user_a_id, user_b_id")
        .eq("id", id)
        .maybeSingle();
      if (!room) {
        setState({ kind: "not-found" });
        return;
      }

      const partnerId = room.user_a_id === user.id ? room.user_b_id : room.user_a_id;

      const [{ data: submissions }, { data: partner }] = await Promise.all([
        supabase.from("submissions").select("*").eq("room_id", id),
        supabase.from("profiles").select("name, avatar_url").eq("id", partnerId).maybeSingle(),
      ]);

      const mine = (submissions ?? []).find((s) => s.user_id === user.id) as DiarySubmission | undefined;
      const theirs = (submissions ?? []).find((s) => s.user_id === partnerId) as DiarySubmission | undefined;

      setState({
        kind: "ready",
        partnerName: partner?.name ?? "相手",
        partnerAvatar: partner?.avatar_url ?? null,
        mine: mine ?? null,
        theirs: theirs ?? null,
      });
    })();
  }, [id, supabase]);

  if (state.kind === "loading") {
    return (
      <WoolinkScreen title="交換日記" back="/diary/history">
        <p style={{ fontSize: 13, color: "#a9adcf" }}>読み込み中…</p>
      </WoolinkScreen>
    );
  }
  if (state.kind === "not-found") {
    return (
      <WoolinkScreen title="交換日記" back="/diary/history">
        <p style={{ fontSize: 13, color: "#a9adcf" }}>この日記は見つかりませんでした。</p>
      </WoolinkScreen>
    );
  }

  const entry = (label: string, avatar: string | null, name: string, sub: DiarySubmission | null) => (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Avatar src={avatar} name={name} size={28} />
        <span style={{ fontSize: 12, fontWeight: 700, color: "#cfd3f0" }}>{label}</span>
      </div>
      <div
        style={{
          padding: "14px 16px",
          borderRadius: 14,
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.1)",
          fontSize: 13,
          lineHeight: 1.8,
          color: "#eef0fb",
          whiteSpace: "pre-wrap",
        }}
      >
        {sub?.diary ?? "（まだありません）"}
      </div>
    </div>
  );

  return (
    <WoolinkScreen title={`${state.partnerName}さんとの交換日記`} back="/diary/history">
      {entry(state.partnerName, state.partnerAvatar, state.partnerName, state.theirs)}
      {entry("あなた", null, "あなた", state.mine)}
    </WoolinkScreen>
  );
}
