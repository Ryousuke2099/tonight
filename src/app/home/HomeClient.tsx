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
import { tonightDateJST, formatDateJa, formatDateShortJa, nextNDatesJST } from "@/lib/date";
import { summarizeSlots } from "@/lib/slots";
import { takePendingPersonalityType } from "@/lib/pending-personality-type";
import { VIDEO_STUDIO_URL } from "@/lib/external-links";
import type { IntentMode, MatchWithFriend, SlotIndex } from "@/types/db";

type Step = "mode" | "friends" | "availability" | "status";

const HOWTO_SEEN_KEY = "tonight_seen_howto";

export default function HomeClient({
  me,
}: {
  me: { id: string; name: string; avatar_url: string | null };
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const dateOptions = useMemo(() => nextNDatesJST(7), []);
  const [date, setDate] = useState(() => tonightDateJST());

  // initialLoading blanks the whole screen only on first mount. Switching
  // dates afterwards uses dateLoading instead (a light overlay), so picking
  // a different date doesn't feel like the whole app reloading.
  const [initialLoading, setInitialLoading] = useState(true);
  const [dateLoading, setDateLoading] = useState(false);
  const [step, setStep] = useState<Step>("mode");
  const [mode, setMode] = useState<IntentMode>("selected");
  const [slots, setSlots] = useState<SlotIndex[]>([]);
  const [targetIds, setTargetIds] = useState<string[]>([]);
  const [friends, setFriends] = useState<FriendOption[]>([]);
  const [matches, setMatches] = useState<MatchWithFriend[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedDates, setSavedDates] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (localStorage.getItem(HOWTO_SEEN_KEY) !== "1") setShowHowTo(true);
      } catch {
        setShowHowTo(true);
      }
    })();
  }, []);

  // 診断→ログインを経由してここに来た場合（診断は/diaryだけでなくどこ経由で
  // ログインしても保留分を拾えるよう、こちらでも同期しておく）。
  useEffect(() => {
    const pending = takePendingPersonalityType();
    if (pending) {
      fetch("/api/profile/personality-type", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: pending }),
      });
    }
  }, []);

  function dismissHowTo() {
    setShowHowTo(false);
    try {
      localStorage.setItem(HOWTO_SEEN_KEY, "1");
    } catch {
      // best-effort only — not critical if it can't persist
    }
  }

  const refreshMatches = useCallback(async () => {
    const res = await fetch(`/api/matches?date=${date}`);
    if (res.ok) {
      const { matches } = await res.json();
      setMatches(matches ?? []);
    }
  }, [date]);

  const refreshSavedDates = useCallback(async () => {
    const res = await fetch(`/api/intent/dates?dates=${dateOptions.join(",")}`);
    if (res.ok) {
      const { dates } = await res.json();
      setSavedDates(new Set<string>(dates ?? []));
    }
  }, [dateOptions]);

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
      await Promise.all([refreshMatches(), refreshSavedDates()]);
      setInitialLoading(false);
      setDateLoading(false);
    })();
  }, [date, refreshMatches, refreshSavedDates]);

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
      // targetIds go through regardless of mode now — a hard restriction in
      // 'selected' mode, an optional priority list in 'anyone' mode.
      body: JSON.stringify({ date, mode, targetIds, slots }),
    });
    setSaving(false);
    if (res.ok) {
      const { matches } = await res.json();
      setMatches(matches ?? []);
      setSubmitted(true);
      setStep("status");
      setSavedDates((prev) => new Set(prev).add(date));
      setToast(true);
      setTimeout(() => setToast(false), 2000);
    }
  }

  function changeDate(d: string) {
    if (d === date) return;
    setDateLoading(true);
    setStep("mode");
    setMode("selected");
    setSlots([]);
    setTargetIds([]);
    setSubmitted(false);
    setDate(d);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const dateLabel = formatDateJa(date);
  const targetNames = friends.filter((f) => targetIds.includes(f.id)).map((f) => f.name);

  if (initialLoading) {
    return (
      <main className="min-h-dvh flex items-center justify-center">
        <p className="text-moon/40 text-sm">読み込み中…</p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh flex flex-col">
      <header className="px-5 pt-6 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-medium text-moon">Tonight</h1>
          <div className="flex items-center gap-2">
            <Avatar src={me.avatar_url} name={me.name} size={32} />
            <button onClick={logout} className="text-xs text-moon/40 hover:text-moon/70">
              ログアウト
            </button>
          </div>
        </div>

        <div>
          <div className="flex gap-1.5 overflow-x-auto snap-x snap-mandatory pb-1">
            {dateOptions.map((d) => (
              <button
                key={d}
                onClick={() => changeDate(d)}
                className={[
                  "shrink-0 snap-start rounded-full px-3 py-1.5 text-xs transition-colors relative",
                  d === date ? "bg-accent text-night font-medium" : "bg-white/5 text-moon/60 hover:bg-white/10",
                ].join(" ")}
              >
                {formatDateShortJa(d)}
                {savedDates.has(d) && (
                  <span
                    aria-hidden
                    className={[
                      "absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full",
                      d === date ? "bg-night" : "bg-accent",
                    ].join(" ")}
                  />
                )}
              </button>
            ))}
          </div>
          <p className="text-xs text-moon/40 mt-1.5">{dateLabel}の予定</p>
        </div>

        <nav className="flex gap-1.5 overflow-x-auto pb-1">
          <Link
            href="/diary"
            className="shrink-0 rounded-full bg-white/5 hover:bg-white/10 text-moon/70 text-xs px-3 py-1.5"
          >
            📔 交換日記
          </Link>
          <Link
            href="/diagnosis"
            className="shrink-0 rounded-full bg-white/5 hover:bg-white/10 text-moon/70 text-xs px-3 py-1.5"
          >
            🧭 対人スタイル診断
          </Link>
          <a
            href={VIDEO_STUDIO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-full bg-white/5 hover:bg-white/10 text-moon/70 text-xs px-3 py-1.5"
          >
            🎬 写真を動画にする ↗
          </a>
        </nav>
      </header>

      <div
        className={[
          "flex-1 px-5 pb-10 transition-opacity",
          dateLoading ? "opacity-40 pointer-events-none" : "",
        ].join(" ")}
      >
        {step === "mode" && (
          <ModeStep
            mode={mode}
            dateLabel={dateLabel}
            showHowTo={showHowTo}
            onDismissHowTo={dismissHowTo}
            onSelect={(m) => {
              setMode(m);
              setStep("friends");
            }}
          />
        )}

        {step === "friends" && (
          <FriendsStep
            mode={mode}
            dateLabel={dateLabel}
            friends={friends}
            targetIds={targetIds}
            onToggle={(id) =>
              setTargetIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
            }
            onAdded={(f) => setFriends((prev) => (prev.some((p) => p.id === f.id) ? prev : [...prev, f]))}
            onBack={() => setStep("mode")}
            onNext={() => setStep("availability")}
          />
        )}

        {step === "availability" && (
          <div className="space-y-6">
            <StepHeader title={`${dateLabel}、話せる時間は？`} />
            <AvailabilityPicker value={slots} onChange={setSlots} />
            <div className="flex gap-2">
              <button
                onClick={() => setStep("friends")}
                className="rounded-xl bg-white/5 text-moon/70 text-sm px-4 py-3"
              >
                戻る
              </button>
              <button
                disabled={slots.length === 0 || saving}
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
            targetNames={targetNames}
            matches={matches}
            submitted={submitted}
            dateLabel={dateLabel}
            onEdit={() => setStep("mode")}
          />
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-accent text-night text-sm font-medium px-4 py-2 rounded-full shadow-lg">
          保存しました 🌙
        </div>
      )}
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

function ModeStep({
  mode,
  dateLabel,
  showHowTo,
  onDismissHowTo,
  onSelect,
}: {
  mode: IntentMode;
  dateLabel: string;
  showHowTo: boolean;
  onDismissHowTo: () => void;
  onSelect: (m: IntentMode) => void;
}) {
  return (
    <div className="space-y-6 pt-4">
      {showHowTo && (
        <div className="rounded-2xl bg-card/80 p-4 space-y-2.5 border border-accent/20">
          <p className="text-xs text-accent uppercase tracking-wide">はじめに</p>
          <ol className="space-y-1.5 text-sm text-moon/70">
            <li>① 上の日付から、話せる日を選ぶ</li>
            <li>② 誰と話したいか選ぶ</li>
            <li>③ 気持ちが重なったら、こっそり教えます</li>
          </ol>
          <button onClick={onDismissHowTo} className="text-xs text-accent/80 underline underline-offset-4">
            わかった
          </button>
        </div>
      )}

      <div className="space-y-1">
        <p className="text-3xl">🌙</p>
        <h2 className="text-xl font-medium text-moon">{dateLabel}、誰かと話したい？</h2>
        <p className="text-sm text-moon/50">相手も同じ気持ちの時だけ、つながります。</p>
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
          description="特定の友達を選ぶ"
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

function FriendsStep({
  mode,
  dateLabel,
  friends,
  targetIds,
  onToggle,
  onAdded,
  onBack,
  onNext,
}: {
  mode: IntentMode;
  dateLabel: string;
  friends: FriendOption[];
  targetIds: string[];
  onToggle: (id: string) => void;
  onAdded: (f: FriendOption) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const isSelected = mode === "selected";
  const canProceed = !isSelected || targetIds.length > 0;

  return (
    <div className="space-y-6">
      <StepHeader
        title={isSelected ? `${dateLabel}、誰と話したい？` : "優先したい友達はいる？"}
        subtitle={isSelected ? undefined : "任意。マッチした時に優先して表示します"}
      />
      {isSelected && (
        <p className="text-xs text-moon/40 bg-white/[0.03] rounded-xl px-4 py-3">
          🔒 あなたが選んだことは、マッチするまで相手にはわかりません
        </p>
      )}
      <FriendSelector friends={friends} selectedIds={targetIds} onToggle={onToggle} />
      <AddFriendForm onAdded={onAdded} />
      {isSelected && (
        <Link href="/invite" className="block text-center text-xs text-accent/80 underline underline-offset-4">
          友達がいない？招待リンクを作る
        </Link>
      )}
      <div className="flex gap-2">
        <button onClick={onBack} className="rounded-xl bg-white/5 text-moon/70 text-sm px-4 py-3">
          戻る
        </button>
        <button
          disabled={!canProceed}
          onClick={onNext}
          className="flex-1 rounded-xl bg-accent text-night font-medium py-3 text-sm disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isSelected ? "次へ" : targetIds.length > 0 ? "次へ" : "スキップ"}
        </button>
      </div>
    </div>
  );
}

function StatusStep({
  mode,
  slots,
  targetNames,
  matches,
  submitted,
  dateLabel,
  onEdit,
}: {
  mode: IntentMode;
  slots: SlotIndex[];
  targetNames: string[];
  matches: MatchWithFriend[];
  submitted: boolean;
  dateLabel: string;
  onEdit: () => void;
}) {
  const summary = summarizeSlots(slots);

  return (
    <div className="space-y-6 pt-4">
      {matches.length > 0 ? (
        <div className="space-y-1">
          <h2 className="text-xl font-medium text-moon">マッチしました</h2>
          <p className="text-sm text-moon/50">{dateLabel}、話せそうな友達がいます</p>
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
          <p className="text-xs text-moon/40 uppercase tracking-wide">{dateLabel}の設定</p>
          <p className="text-moon text-sm">{summary || "時間未設定"}</p>
          <p className="text-moon/60 text-sm">{summarizeTargets(mode, targetNames)}</p>
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

function summarizeTargets(mode: IntentMode, names: string[]): string {
  if (mode === "anyone") {
    return names.length === 0
      ? "友達なら誰とでも話したい"
      : `友達なら誰でも話したい（${namesText(names)}を優先）`;
  }
  return `${namesText(names)}と話したい`;
}

function namesText(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length <= 2) return names.join("、");
  return `${names.slice(0, 2).join("、")}他${names.length - 2}人`;
}
