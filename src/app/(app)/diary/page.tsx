"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { diaryWindowStart } from "@/lib/diaryWindow";
import "./diary.css";

type Status =
  | { kind: "loading" }
  | { kind: "not-submitted" }
  | { kind: "waiting" }
  | { kind: "matched"; roomId: string };

export default function DiaryPage() {
  const supabase = useMemo(() => createClient(), []);
  const [status, setStatus] = useState<Status>({ kind: "loading" });

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("submissions")
        .select("room_id, created_at")
        .eq("user_id", user.id)
        .gte("created_at", diaryWindowStart().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) {
        setStatus({ kind: "not-submitted" });
      } else if (data.room_id) {
        setStatus({ kind: "matched", roomId: data.room_id as string });
      } else {
        setStatus({ kind: "waiting" });
      }
    })();
  }, [supabase]);

  return (
    <main className="diary-page">
      <div className="diary-phone">
        <section className="diary-content">
          <section className="diary-friend-card">
            <h1>交換日記</h1>
            <p>
              毎晩20:00〜翌20:00の1本勝負。日記を書いて提出すると、
              指定した相手か、相性の合う誰かとその日記が交換されます。
            </p>
          </section>

          <section className="diary-card">
            {status.kind === "loading" && <p className="diary-status">読み込み中…</p>}

            {status.kind === "not-submitted" && (
              <>
                <p className="diary-status">まだ今日は日記を書いていません</p>
                <div className="diary-action">
                  <Link href="/diary/select" className="diary-write-btn">
                    日記を書く！
                  </Link>
                </div>
              </>
            )}

            {status.kind === "waiting" && (
              <p className="diary-status">
                提出済みです。相手が見つかるまでお待ちください（今夜また確認してみてください）。
              </p>
            )}

            {status.kind === "matched" && (
              <>
                <p className="diary-status">今夜の交換が成立しました</p>
                <div className="diary-action">
                  <Link href={`/diary/room/${status.roomId}`} className="diary-write-btn">
                    読む
                  </Link>
                </div>
              </>
            )}
          </section>

          <Link href="/diary/history" className="diary-history-row">
            <svg className="diary-history-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <rect x="5" y="3" width="14" height="18" rx="2" fill="#eef0fb" />
            </svg>
            <span>これまでの日記</span>
          </Link>
        </section>

        <footer className="diary-mascot-row">
          <Image className="diary-mascot" src="/home/guide-sheep.svg" alt="ガイド羊" width={120} height={120} />
          <div className="diary-tip-bubble">写真から動画で日記を作ることもできるよ</div>
        </footer>
      </div>
    </main>
  );
}
