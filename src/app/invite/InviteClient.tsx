"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { lineShareUrl, copyText } from "@/lib/share";
import { formatRange } from "@/lib/slots";

interface GuestResponseRow {
  id: string;
  guest_name: string;
  response: "yes" | "no";
  overlap_start: number | null;
  overlap_end: number | null;
  created_at: string;
}

export default function InviteClient() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [creating, setCreating] = useState(false);
  const [invite, setInvite] = useState<{ id: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [responses, setResponses] = useState<GuestResponseRow[]>([]);

  useEffect(() => {
    if (!invite) return;
    const channel = supabase
      .channel(`invite-${invite.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "guest_responses", filter: `invite_id=eq.${invite.id}` },
        (payload) => {
          setResponses((prev) => [payload.new as GuestResponseRow, ...prev]);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [invite, supabase]);

  async function createInvite() {
    setCreating(true);
    const res = await fetch("/api/invite", { method: "POST", headers: { "Content-Type": "application/json" } });
    setCreating(false);
    if (res.ok) {
      const data = await res.json();
      setInvite({ id: data.id, url: data.url });
    }
  }

  const message = invite
    ? `Tonight\n今夜ちょっと話せる？\n${invite.url}`
    : "";

  return (
    <main className="min-h-dvh flex flex-col px-5 pt-6 pb-10">
      <button onClick={() => router.back()} className="text-sm text-moon/40 mb-8 self-start">
        ← 戻る
      </button>

      {!invite ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
          <p className="text-4xl">🌙</p>
          <div className="space-y-1">
            <h1 className="text-xl font-medium text-moon">今夜話せるか、友達に聞いてみよう。</h1>
            <p className="text-sm text-moon/50 max-w-xs">
              アプリを使っていない友達にもリンクだけで聞けます。登録は不要です。
            </p>
          </div>
          <button
            onClick={createInvite}
            disabled={creating}
            className="rounded-xl bg-accent text-night font-medium px-8 py-3 text-sm disabled:opacity-50"
          >
            {creating ? "作成中…" : "リンクを作る"}
          </button>
        </div>
      ) : (
        <div className="flex-1 space-y-8">
          <div className="space-y-1">
            <h1 className="text-xl font-medium text-moon">リンクができました</h1>
            <p className="text-sm text-moon/50">LINEやDMで送ってみましょう</p>
          </div>

          <div className="rounded-2xl bg-card p-4 space-y-3">
            <p className="text-xs text-moon/40 break-all">{invite.url}</p>
            <div className="flex gap-2">
              <a
                href={lineShareUrl(message)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center rounded-xl bg-[#06C755] text-white text-sm font-medium py-2.5"
              >
                LINEで送る
              </a>
              <button
                onClick={async () => {
                  const ok = await copyText(invite.url);
                  setCopied(ok);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="rounded-xl bg-white/5 text-moon/80 text-sm px-4 py-2.5"
              >
                {copied ? "コピー済み" : "リンクをコピー"}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-moon/40 uppercase tracking-wide">返事を待っています…</p>
            {responses.length === 0 && (
              <p className="text-sm text-moon/40 py-4 text-center">まだ返事はありません</p>
            )}
            {responses.map((r) => (
              <div key={r.id} className="rounded-2xl bg-card p-4 space-y-1">
                <p className="text-moon text-sm font-medium">{r.guest_name}さんが回答しました</p>
                {r.response === "no" && <p className="text-moon/50 text-sm">今日は難しいそうです</p>}
                {r.response === "yes" && r.overlap_start !== null && r.overlap_end !== null && (
                  <p className="text-accent text-sm">
                    🌙 {formatRange(r.overlap_start, r.overlap_end)} なら2人とも話せそう！
                  </p>
                )}
                {r.response === "yes" && r.overlap_start === null && (
                  <p className="text-moon/50 text-sm">
                    話せるそうですが、時間が重なりませんでした（あなたの今夜の時間設定もご確認ください）
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
