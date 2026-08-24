"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import AvailabilityPicker from "@/components/AvailabilityPicker";
import { formatRange } from "@/lib/slots";
import type { GuestResponseType, SlotIndex } from "@/types/db";

type Step = "loading" | "notfound" | "expired" | "name" | "response" | "availability" | "result";

interface InviteInfo {
  date: string;
  creator: { name: string; avatar_url: string | null };
}

export default function GuestClient({ token }: { token: string }) {
  const [step, setStep] = useState<Step>("loading");
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [guestName, setGuestName] = useState("");
  const [response, setResponse] = useState<GuestResponseType | null>(null);
  const [slots, setSlots] = useState<SlotIndex[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ hasOverlap: boolean; start: number | null; end: number | null } | null>(
    null
  );

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/invite/${token}`);
      if (!res.ok) return setStep("notfound");
      const data = await res.json();
      if (data.expired) return setStep("expired");
      setInvite({ date: data.date, creator: data.creator });
      setStep("name");
    })();
  }, [token]);

  async function submitResponse() {
    setSubmitting(true);
    const res = await fetch(`/api/invite/${token}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestName, response, slots }),
    });
    setSubmitting(false);
    if (res.ok) {
      const data = await res.json();
      setResult({ hasOverlap: data.hasOverlap, start: data.overlapStart, end: data.overlapEnd });
      setStep("result");
    }
  }

  if (step === "loading") {
    return (
      <Centered>
        <p className="text-moon/40 text-sm">読み込み中…</p>
      </Centered>
    );
  }
  if (step === "notfound") {
    return (
      <Centered>
        <p className="text-moon/60 text-sm">このリンクは見つかりませんでした</p>
      </Centered>
    );
  }
  if (step === "expired") {
    return (
      <Centered>
        <p className="text-moon/60 text-sm">このリンクの有効期限が切れています</p>
      </Centered>
    );
  }

  return (
    <main className="min-h-dvh flex flex-col px-5 pt-10 pb-10">
      {invite && step !== "result" && (
        <div className="flex flex-col items-center text-center gap-3 mb-8">
          <Avatar src={invite.creator.avatar_url} name={invite.creator.name} size={56} />
          <p className="text-moon text-sm">
            <span className="font-medium">{invite.creator.name}</span>さんが、今夜話せるか聞いています
          </p>
        </div>
      )}

      {step === "name" && (
        <div className="flex-1 flex flex-col justify-center space-y-4 max-w-sm mx-auto w-full">
          <label className="text-sm text-moon/60">お名前を教えてください</label>
          <input
            autoFocus
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="ニックネームでOK"
            className="w-full rounded-xl bg-card px-4 py-3 text-sm text-moon placeholder:text-moon/30 outline-none focus:ring-2 focus:ring-accent/50"
          />
          <button
            disabled={!guestName.trim()}
            onClick={() => setStep("response")}
            className="w-full rounded-xl bg-accent text-night font-medium py-3 text-sm disabled:opacity-30"
          >
            次へ
          </button>
        </div>
      )}

      {step === "response" && (
        <div className="flex-1 flex flex-col justify-center space-y-4 max-w-sm mx-auto w-full">
          <p className="text-center text-moon text-lg font-medium">今夜、話せる？</p>
          <button
            onClick={() => setStep("availability")}
            className="w-full rounded-xl bg-accent text-night font-medium py-4 text-sm"
          >
            話せる
          </button>
          <button
            onClick={() => {
              setResponse("no");
            }}
            className="w-full rounded-xl bg-white/5 text-moon/70 py-4 text-sm"
          >
            今日は難しい
          </button>
          {response === "no" && (
            <button
              onClick={() => submitResponse()}
              disabled={submitting}
              className="w-full text-center text-xs text-moon/40 underline underline-offset-4"
            >
              {submitting ? "送信中…" : "この内容で送る"}
            </button>
          )}
        </div>
      )}

      {step === "availability" && (
        <div className="flex-1 space-y-6 max-w-sm mx-auto w-full">
          <p className="text-center text-moon text-sm">話せる時間を教えてください</p>
          <AvailabilityPicker
            value={slots}
            onChange={(s) => {
              setSlots(s);
              setResponse("yes");
            }}
          />
          <button
            disabled={slots.length === 0 || submitting}
            onClick={submitResponse}
            className="w-full rounded-xl bg-accent text-night font-medium py-3 text-sm disabled:opacity-30"
          >
            {submitting ? "送信中…" : "回答する"}
          </button>
        </div>
      )}

      {step === "result" && (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 max-w-sm mx-auto w-full">
          <p className="text-4xl">🌙</p>
          {result?.hasOverlap && result.start !== null && result.end !== null ? (
            <>
              <h2 className="text-xl font-medium text-moon">今夜話せそうです</h2>
              <p className="text-accent text-lg font-semibold tabular-nums">
                {formatRange(result.start, result.end)}
              </p>
            </>
          ) : response === "no" ? (
            <>
              <h2 className="text-xl font-medium text-moon">また今度誘ってもらいましょう</h2>
              <p className="text-sm text-moon/50">回答を送りました</p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-medium text-moon">回答を送りました</h2>
              <p className="text-sm text-moon/50">
                時間が重ならなかったか、相手がまだ時間を設定していないようです
              </p>
            </>
          )}

          <div className="pt-6 border-t border-white/10 w-full space-y-2">
            <p className="text-xs text-moon/40">次回からもっと簡単に使うなら</p>
            <Link
              href="/login"
              className="block w-full rounded-xl bg-white/5 text-moon/80 text-sm py-3"
            >
              Tonightに登録する
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="min-h-dvh flex items-center justify-center px-6">{children}</main>;
}
