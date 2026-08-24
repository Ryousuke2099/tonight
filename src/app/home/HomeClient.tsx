"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AvailabilityPicker from "@/components/AvailabilityPicker";
import FriendSelector, { type FriendOption } from "@/components/FriendSelector";
import AddFriendForm from "@/components/AddFriendForm";
import MatchCard from "@/components/MatchCard";
import Avatar from "@/components/Avatar";
import { tonightDateJST, formatDateJa } from "@/lib/date";
import { summarizeSlots } from "@/lib/slots";
import type { IntentMode, MatchWithFriend, SlotIndex } from "@/types/db";

type Step = "mode" | "availability" | "friends" | "status";

export default function HomeClient({
  me,
}: {
  me: { id: string; name: string; avatar_url: string | null };
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const date = useMemo(() => tonightDateJST(), []);

  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("mode");
  const [mode, setMode] = useState<IntentMode>("selected");
  const [slots, setSlots] = useState<SlotIndex[]>([]);
  const [targetIds, setTargetIds] = useState<string[]>([]);
  const [friends, setFriends] = useState<FriendOption[]>([]);
  const [matches, setMatches] = useState<MatchWithFriend[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const refreshMatches = useCallback(async () => {
    const res = await fetch(`/api/matches?date=${date}`);
    if (res.ok) {
      const { matches } = await res.json();
      setMatches(matches ?? []);
    }
  }, [date]);

  useEffect(() => {
    (async () => {
      const [friendsRes, intentRes] = await Promise.all([
        fetch("/api/friends"),
        fetch(`/api/intent?date=${date}`),
      ]);
      if (friendsRes.ok) {
        const { friends } = await friendsRes.json();
        setFriends(friends ?? []);
      }
      if (intentRes.ok) {
        const { intent } = await intentRes.json();
        if (intent) {
          setMode(intent.mode);
          setSlots(intent.slots ?? []);
          setTargetIds(intent.targetIds ?? []);
          setSubmitted(true);
          setStep("status");
        }
      }
      await refreshMatches();
      setLoading(false);
    })();
  }, [date, refreshMatches]);

  useEffect(() => {
    const channel = supabase
      .channel(`matches-${me.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches", filter: `user_a=eq.${me.id}` },
        () => refreshMatches()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches", filter: `user_b=eq.${me.id}` },
        () => refreshMatches()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, me.id, refreshMatches]);

  async function submit() {
    setSaving(true);
    const res = await fetch("/api/intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, mode, targetIds: mode === "selected" ? targetIds : [], slots }),
    });
    setSaving(false);
    if (res.ok) {
      const { matches } = await res.json();
      setMatches(matches ?? []);
      setSubmitted(true);
      setStep("status");
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-dvh flex items-center justify-center">
        <p className="text-moon/40 text-sm">読み込み中…</p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh flex flex-col">
      <header className="flex items-center justify-between px-5 pt-6 pb-4">
        <div>
          <p className="text-xs text-moon/40">{formatDateJa(date)}</p>
          <h1 className="text-lg font-medium text-moon">Tonight</h1>
        </div>
        <div className="flex items-center gap-2">
          <Avatar src={me.avatar_url} name={me.name} size={32} />
          <button onClick={logout} className="text-xs text-moon/40 hover:text-moon/70">
            ログアウト
          </button>
        </div>
      </header>

      <div className="flex-1 px-5 pb-10">
        {step === "mode" && (
          <ModeStep
            mode={mode}
            onSelect={(m) => {
              setMode(m);
              setStep("availability");
            }}
          />
        )}

        {step === "availability" && (
          <div className="space-y-6">
            <StepHeader
              title="今夜、話せる時間は？"
              subtitle="20:00〜翌2:00の間で、話せそうな時間を選んでください"
            />
            <AvailabilityPicker value={slots} onChange={setSlots} />
            <div className="flex gap-2">
              <button
                onClick={() => setStep("mode")}
                className="rounded-xl bg-white/5 text-moon/70 text-sm px-4 py-3"
              >
                戻る
              </button>
              <button
                disabled={slots.length === 0}
                onClick={() => (mode === "selected" ? setStep("friends") : submit())}
                className="flex-1 rounded-xl bg-accent text-night font-medium py-3 text-sm disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {saving ? "保存中…" : "次へ"}
              </button>
            </div>
          </div>
        )}

        {step === "friends" && (
          <div className="space-y-6">
            <StepHeader title="今夜、誰と話したい？" subtitle="複数選べます" />
            <p className="text-xs text-moon/40 bg-white/[0.03] rounded-xl px-4 py-3">
              🔒 あなたが選んだことは、マッチするまで相手にはわかりません
            </p>
            <FriendSelector
              friends={friends}
              selectedIds={targetIds}
              onToggle={(id) =>
                setTargetIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
              }
            />
            <AddFriendForm
              onAdded={(f) =>
                setFriends((prev) => (prev.some((p) => p.id === f.id) ? prev : [...prev, f]))
              }
            />
            <Link href="/invite" className="block text-center text-xs text-accent/80 underline underline-offset-4">
              友達がいない？招待リンクを作る
            </Link>
            <div className="flex gap-2">
              <button
                onClick={() => setStep("availability")}
                className="rounded-xl bg-white/5 text-moon/70 text-sm px-4 py-3"
              >
                戻る
              </button>
              <button
                disabled={targetIds.length === 0 || saving}
                onClick={submit}
                className="flex-1 rounded-xl bg-accent text-night font-medium py-3 text-sm disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {saving ? "保存中…" : "決定"}
              </button>
            </div>
          </div>
        )}

        {step === "status" && (
          <StatusStep
            mode={mode}
            slots={slots}
            targetCount={targetIds.length}
            matches={matches}
            submitted={submitted}
            onEdit={() => setStep("mode")}
          />
        )}
      </div>
    </main>
  );
}

function StepHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="space-y-1 pt-2">
      <h2 className="text-xl font-medium text-moon">{title}</h2>
      {subtitle && <p className="text-sm text-moon/50">{subtitle}</p>}
    </div>
  );
}

function ModeStep({ mode, onSelect }: { mode: IntentMode; onSelect: (m: IntentMode) => void }) {
  return (
    <div className="space-y-6 pt-4">
      <div className="space-y-1">
        <p className="text-3xl">🌙</p>
        <h2 className="text-xl font-medium text-moon">今夜、誰かと話したい？</h2>
        <p className="text-sm text-moon/50">
          相手も話したい時だけ、つながります。あなたの気持ちが一方的に伝わることはありません。
        </p>
      </div>

      <div className="space-y-3">
        <OptionCard
          emoji="👋"
          title="誰でもOK"
          description="友達の中なら誰でも話したい"
          selected={mode === "anyone"}
          onClick={() => onSelect("anyone")}
        />
        <OptionCard
          emoji="🎯"
          title="話したい友達を選ぶ"
          description="特定の友達を選んで、今夜の気持ちを伝える"
          selected={mode === "selected"}
          onClick={() => onSelect("selected")}
        />
      </div>
    </div>
  );
}

function OptionCard({
  emoji,
  title,
  description,
  selected,
  onClick,
}: {
  emoji: string;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "w-full text-left rounded-2xl p-4 flex items-start gap-3 transition-colors",
        selected ? "bg-accent-soft ring-1 ring-accent/40" : "bg-card hover:bg-card-hover",
      ].join(" ")}
    >
      <span className="text-2xl leading-none">{emoji}</span>
      <span>
        <span className="block text-moon font-medium">{title}</span>
        <span className="block text-moon/50 text-sm mt-0.5">{description}</span>
      </span>
    </button>
  );
}

function StatusStep({
  mode,
  slots,
  targetCount,
  matches,
  submitted,
  onEdit,
}: {
  mode: IntentMode;
  slots: SlotIndex[];
  targetCount: number;
  matches: MatchWithFriend[];
  submitted: boolean;
  onEdit: () => void;
}) {
  const summary = summarizeSlots(slots);

  return (
    <div className="space-y-6 pt-4">
      {matches.length > 0 ? (
        <div className="space-y-1">
          <h2 className="text-xl font-medium text-moon">マッチしました</h2>
          <p className="text-sm text-moon/50">今夜、話せそうな友達がいます</p>
        </div>
      ) : (
        <div className="space-y-1 text-center pt-6">
          <p className="text-3xl">🌙</p>
          <h2 className="text-xl font-medium text-moon">あとは待つだけ。</h2>
          <p className="text-sm text-moon/50">あなたが誰を選んだかは公開されません</p>
        </div>
      )}

      {matches.length > 0 && (
        <div className="space-y-3">
          {matches.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </div>
      )}

      {submitted && (
        <div className="rounded-2xl bg-card p-4 space-y-2">
          <p className="text-xs text-moon/40 uppercase tracking-wide">今日の設定</p>
          <p className="text-moon text-sm">{summary || "時間未設定"}</p>
          <p className="text-moon/60 text-sm">
            {mode === "anyone" ? "友達なら誰とでも話したい" : `${targetCount}人となら話したい`}
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={onEdit} className="flex-1 rounded-xl bg-white/5 text-moon/70 text-sm py-3">
          設定を変更する
        </button>
        <Link
          href="/invite"
          className="flex-1 text-center rounded-xl bg-white/5 text-moon/70 text-sm py-3"
        >
          友達を招待する
        </Link>
      </div>
    </div>
  );
}
