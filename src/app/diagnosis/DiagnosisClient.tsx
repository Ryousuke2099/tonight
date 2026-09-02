"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { shuffledQuestions, computeResult, typeCode, type DiagnosisResult } from "@/lib/diagnosis";
import { TYPE_DATA, BALANCE_TYPE, type TypeInfo } from "@/lib/diagnosis-data";
import { setPendingPersonalityType } from "@/lib/pending-personality-type";

type Screen = "intro" | "quiz" | "calculating" | "result";

export default function DiagnosisClient() {
  const [screen, setScreen] = useState<Screen>("intro");
  const [order] = useState(() => shuffledQuestions());
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<DiagnosisResult | null>(null);

  const answeredCount = Object.keys(answers).length;
  const progressPct = (answeredCount / order.length) * 100;

  function start() {
    setScreen("quiz");
    setIndex(0);
    setAnswers({});
  }

  function choose(value: number) {
    const q = order[index];
    setAnswers((prev) => ({ ...prev, [q.id]: value }));
    setTimeout(() => {
      if (index < order.length - 1) {
        setIndex((i) => i + 1);
      } else {
        setScreen("calculating");
        setTimeout(() => {
          setResult(computeResult({ ...answers, [q.id]: value }));
          setScreen("result");
        }, 700);
      }
    }, 300);
  }

  if (screen === "intro") return <IntroScreen onStart={start} />;
  if (screen === "quiz") {
    const q = order[index];
    return (
      <QuizScreen
        promptIndex={index}
        total={order.length}
        progressPct={progressPct}
        prompt={q.prompt}
        left={q.left}
        right={q.right}
        selected={answers[q.id] ?? null}
        onChoose={choose}
        onBack={index > 0 ? () => setIndex((i) => i - 1) : undefined}
      />
    );
  }
  if (screen === "calculating") return <CalculatingScreen />;
  if (result) return <ResultScreen result={result} onRetake={start} />;
  return null;
}

function IntroScreen({ onStart }: { onStart: () => void }) {
  return (
    <main className="min-h-dvh flex flex-col px-6">
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-6 max-w-sm mx-auto w-full">
        <p className="text-5xl">🧭</p>
        <h1 className="text-2xl font-semibold text-moon leading-snug">
          あなたの
          <br />
          対人スタイルは？
        </h1>
        <p className="text-sm text-moon/50">
          20問、約3分。結果はすべて端末内で計算され、外部には送信されません。
        </p>
        <button
          onClick={onStart}
          className="w-full rounded-xl bg-accent text-night font-medium py-3.5 text-sm hover:brightness-105 transition"
        >
          診断をはじめる
        </button>
        <Link href="/" className="text-xs text-moon/30 underline underline-offset-4">
          Tonightのトップへ戻る
        </Link>
      </div>
    </main>
  );
}

function QuizScreen({
  promptIndex,
  total,
  progressPct,
  prompt,
  left,
  right,
  selected,
  onChoose,
  onBack,
}: {
  promptIndex: number;
  total: number;
  progressPct: number;
  prompt: string;
  left: string;
  right: string;
  selected: number | null;
  onChoose: (value: number) => void;
  onBack?: () => void;
}) {
  return (
    <main className="min-h-dvh flex flex-col px-6 py-8">
      <div className="max-w-sm mx-auto w-full flex-1 flex flex-col gap-8">
        <div>
          <div className="h-1 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-accent transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="text-xs text-moon/40 mt-2">
            {promptIndex + 1} / {total}
          </p>
        </div>

        <p className="text-lg text-moon font-medium leading-relaxed pt-4">{prompt}</p>

        <div className="space-y-3">
          <div className="flex justify-between text-xs text-moon/40 px-1">
            <span>{left}</span>
            <span>{right}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            {[1, 2, 3, 4, 5].map((val) => (
              <button
                key={val}
                onClick={() => onChoose(val)}
                aria-label={`5段階中${val}`}
                className={[
                  "h-12 flex-1 rounded-xl border transition-colors",
                  selected === val
                    ? "bg-accent border-accent"
                    : "bg-card border-white/10 hover:bg-card-hover",
                ].join(" ")}
              />
            ))}
          </div>
          <p className="text-xs text-moon/30 text-center pt-1">気持ちに近いところをタップすると次へ進みます</p>
        </div>

        {onBack && (
          <button onClick={onBack} className="text-xs text-moon/40 self-start underline underline-offset-4">
            ← 前の質問
          </button>
        )}
      </div>
    </main>
  );
}

function CalculatingScreen() {
  return (
    <main className="min-h-dvh flex items-center justify-center">
      <p className="text-moon/40 text-sm">診断中…</p>
    </main>
  );
}

function ResultScreen({ result, onRetake }: { result: DiagnosisResult; onRetake: () => void }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [saving, setSaving] = useState(false);

  const isBalance = !result.axisKey;
  const code = typeCode(result);
  const type: TypeInfo = isBalance ? BALANCE_TYPE : TYPE_DATA[code];
  const bodyText = type[result.strength];

  async function continueToApp() {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await fetch("/api/profile/personality-type", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: code }),
      });
      router.push("/diary");
    } else {
      setPendingPersonalityType(code);
      router.push("/login");
    }
  }

  return (
    <main className="min-h-dvh flex flex-col px-6 py-10">
      <div className="max-w-sm mx-auto w-full flex-1 flex flex-col gap-6">
        <div className="text-center space-y-1">
          <p className="text-xs text-accent uppercase tracking-wide">診断結果</p>
          <h1 className="text-2xl font-semibold text-moon">{type.name}</h1>
          {!isBalance && <p className="text-xs text-moon/40">{type.energyLabel}</p>}
          <p className="text-sm text-moon/60 pt-1">{type.tagline}</p>
        </div>

        <div className="rounded-2xl bg-card p-4 space-y-3">
          <p className="text-sm text-moon/80 leading-relaxed">{bodyText}</p>
          <div className="h-px bg-white/10" />
          <p className="text-sm text-moon/70 leading-relaxed">{type.compat}</p>
        </div>

        {!isBalance && type.bestMatch && (
          <div className="rounded-2xl bg-accent-soft ring-1 ring-accent/30 p-4 text-center space-y-1">
            <p className="text-xs text-moon/50">最も相性がよいタイプ</p>
            <p className="text-moon font-medium">{type.bestMatch}</p>
          </div>
        )}

        <div className="space-y-2 pt-2">
          <button
            onClick={continueToApp}
            disabled={saving}
            className="w-full rounded-xl bg-accent text-night font-medium py-3.5 text-sm hover:brightness-105 transition disabled:opacity-50"
          >
            {saving ? "保存中…" : "この結果で交換日記をはじめる"}
          </button>
          <button onClick={onRetake} className="w-full text-xs text-moon/40 underline underline-offset-4 py-2">
            もう一度診断する
          </button>
        </div>
      </div>
    </main>
  );
}
