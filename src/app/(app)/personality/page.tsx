"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { QUESTION_BANK } from "@/lib/personality/data-questions";
import { BALANCE_TYPE, TYPE_DATA } from "@/lib/personality/data-types";
import { createClient } from "@/lib/supabase/client";

type Question = {
  id: string;
  axis: "agency" | "candor" | "warmth" | "social" | "energy";
  prompt: string;
  left: string;
  right: string;
};

type EnergyDir = "fast" | "slow";
type Strength = "weak" | "clear" | "strong";

type Result = {
  axisKey: string | null;
  energyDir: EnergyDir;
  amplitude: number;
  theta0: number;
  strength: Strength;
};

type TypeData = {
  name: string;
  energyLabel?: string;
  tagline: string;
  weak: string;
  clear: string;
  strong: string;
  compat: string;
  bestMatch?: string;
};

const questions = QUESTION_BANK as Question[];
const typeData = TYPE_DATA as Record<string, TypeData>;
const balanceType = BALANCE_TYPE as TypeData;

const ANGLES: Record<string, number> = {
  PA: 0,
  BC: 45,
  DE: 90,
  FG: 135,
  HI: 180,
  JK: 225,
  LM: 270,
  NO: 315,
};

function shuffle<T>(array: T[]): T[] {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calculateResult(answers: Record<string, number>): Result {
  const byAxis: Record<string, number[]> = {
    agency: [],
    candor: [],
    warmth: [],
    social: [],
    energy: [],
  };

  questions.forEach((question) => {
    byAxis[question.axis].push(answers[question.id]);
  });

  const d1 = average(byAxis.agency) - 3;
  const d2 = average(byAxis.candor) - 3;
  const d3 = average(byAxis.warmth) - 3;
  const d4 = average(byAxis.social) - 3;

  const scores: Record<string, number> = {
    PA: -d1,
    HI: d1,
    BC: -d2,
    JK: d2,
    DE: -d3,
    LM: d3,
    FG: -d4,
    NO: d4,
  };

  let x = 0;
  let y = 0;

  Object.entries(scores).forEach(([key, score]) => {
    const rad = (ANGLES[key] * Math.PI) / 180;

    x += score * Math.cos(rad);
    y += score * Math.sin(rad);
  });

  x *= 2 / 8;
  y *= 2 / 8;

  const amplitude = Math.sqrt(x * x + y * y);

  let theta0 = (Math.atan2(y, x) * 180) / Math.PI;

  if (theta0 < 0) {
    theta0 += 360;
  }

  const energyAverage = average(byAxis.energy);

  const energyDir: EnergyDir =
    energyAverage < 2.5 ? "fast" : "slow";

  const maxDeviation = Math.max(
    Math.abs(d1),
    Math.abs(d2),
    Math.abs(d3),
    Math.abs(d4)
  );

  const strength: Strength =
    maxDeviation < 0.8
      ? "weak"
      : maxDeviation < 1.5
        ? "clear"
        : "strong";

  const AMPLITUDE_THRESHOLD = 0.5;

  let axisKey: string | null = null;

  if (amplitude >= AMPLITUDE_THRESHOLD) {
    let best: string | null = null;
    let bestDistance = Infinity;

    Object.entries(ANGLES).forEach(([key, angle]) => {
      let difference = Math.abs(theta0 - angle);

      difference = Math.min(
        difference,
        360 - difference
      );

      if (difference < bestDistance - 1e-9) {
        bestDistance = difference;
        best = key;
      } else if (
        Math.abs(difference - bestDistance) < 1e-9 &&
        best !== null &&
        angle < ANGLES[best]
      ) {
        best = key;
      }
    });

    axisKey = best;
  }

  return {
    axisKey,
    energyDir,
    amplitude,
    theta0,
    strength,
  };
}

export default function PersonalityPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [screen, setScreen] = useState<
    "quiz" | "calculating" | "result"
  >("quiz");

  const [order, setOrder] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<
    Record<string, number>
  >({});
  const [result, setResult] = useState<Result | null>(null);

  // 結果の詳細表示
  const [showDetails, setShowDetails] = useState(false);

  // DB保存中
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const answeredCount = Object.keys(answers).length;

  const progress = useMemo(() => {
    if (order.length === 0) return 0;

    return (answeredCount / order.length) * 100;
  }, [answeredCount, order.length]);

  // =========================
  // ページを開いたら診断開始（順番のシャッフルは Math.random を使うので
  // SSR とズレないようマウント後＝クライアントでのみ行う）
  // =========================
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrder(shuffle(questions));
  }, []);

  const selectAnswer = (
    questionId: string,
    value: number
  ) => {
    setAnswers((previous) => ({
      ...previous,
      [questionId]: value,
    }));
  };

  const handleCalculate = () => {
    if (answeredCount !== order.length) return;

    setScreen("calculating");
  };

  // =========================
  // 診断結果を計算
  // =========================
  useEffect(() => {
    if (screen !== "calculating") return;

    const timer = window.setTimeout(async () => {
      const calculated = calculateResult(answers);

      setResult(calculated);

      // =========================
      // DB保存用の性格タイプを作成
      // =========================
      const personalityType = calculated.axisKey
        ? `${calculated.axisKey}_${calculated.energyDir}`
        : "balance";

      setIsSaving(true);
      setSaveError("");

      // ログイン中のユーザーを取得
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error(
          "ログイン情報取得エラー:",
          userError?.message
        );

        setSaveError(
          "ログイン情報を取得できませんでした。"
        );
        setIsSaving(false);
        setScreen("result");
        return;
      }

      // =========================
      // personality_type を保存（RLS 越しの直接 update ではなく API 経由）
      // =========================
      const saveRes = await fetch("/api/profile/personality-type", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: personalityType }),
      });

      if (!saveRes.ok) {
        console.error("性格タイプ保存エラー:", saveRes.status);
        setSaveError("診断結果の保存に失敗しました。");
      }

      setIsSaving(false);
      setScreen("result");
    }, 900);

    return () => window.clearTimeout(timer);
  }, [screen, answers]);

  // 後から設定画面などで再利用できるように残しておく
  const startQuiz = () => {
    setOrder(shuffle(questions));
    setAnswers({});
    setResult(null);
    setShowDetails(false);
    setSaveError("");
    setScreen("quiz");
  };

  const isBalance = result ? !result.axisKey : false;

  const resultType = result
    ? isBalance
      ? balanceType
      : typeData[
          `${result.axisKey}_${result.energyDir}`
        ]
    : null;

  // =========================
  // 診断
  // =========================
  if (screen === "quiz") {
    return (
      <main className="min-h-screen bg-[#fff8ef] px-5 py-8 text-[#3d332c]">
        <div className="mx-auto max-w-xl">
          <header className="mb-8">
            <div className="h-1.5 overflow-hidden rounded-full bg-[#fbeee0]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#ff8a63] to-[#ffc857] transition-all duration-300"
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm font-bold text-[#93857a]">
                回答済み
              </span>

              <span className="text-sm font-bold text-[#93857a]">
                <span className="text-[#ff8a63]">
                  {answeredCount}
                </span>

                <span className="mx-1 opacity-50">
                  /
                </span>

                {order.length}
              </span>
            </div>
          </header>

          <div className="flex flex-col gap-8">
            {order.map((question, questionIndex) => {
              const currentAnswer =
                answers[question.id];

              return (
                <section
                  key={question.id}
                  className="rounded-2xl border border-[#efe1cd] bg-white px-5 py-6"
                >
                  <p className="mb-2 text-xs font-bold text-[#ff8a63]">
                    Q{questionIndex + 1}
                  </p>

                  <p className="text-base font-bold leading-7 sm:text-lg">
                    {question.prompt}
                  </p>

                  <div className="mt-5 flex items-start justify-between gap-4">
                    <p className="flex-1 text-left text-xs leading-5 text-[#93857a] sm:text-sm">
                      {question.left}
                    </p>

                    <p className="flex-1 text-right text-xs leading-5 text-[#93857a] sm:text-sm">
                      {question.right}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-1 sm:gap-2">
                    {[1, 2, 3, 4, 5].map(
                      (value, i) => (
                        <div
                          key={value}
                          className="flex flex-1 items-center"
                        >
                          <button
                            type="button"
                            aria-label={`5段階中${value}`}
                            aria-pressed={
                              value === currentAnswer
                            }
                            onClick={() =>
                              selectAnswer(
                                question.id,
                                value
                              )
                            }
                            className={`mx-auto rounded-full border-2 transition ${
                              value === currentAnswer
                                ? "border-[#ff8a63] bg-gradient-to-b from-[#ff9c78] to-[#ff8a63] shadow-[0_6px_16px_rgba(255,138,99,0.4)] scale-105"
                                : "border-[#efe1cd] bg-white hover:border-[#ff8a63]"
                            } ${
                              value === 1 || value === 5
                                ? "h-[44px] w-[44px] sm:h-[52px] sm:w-[52px]"
                                : value === 2 || value === 4
                                  ? "h-[39px] w-[39px] sm:h-[46px] sm:w-[46px]"
                                  : "h-[34px] w-[34px] sm:h-[38px] sm:w-[38px]"
                            }`}
                          />

                          {i < 4 && (
                            <div className="h-0.5 flex-1 bg-[#efe1cd]" />
                          )}
                        </div>
                      )
                    )}
                  </div>

                  <div className="mt-2 flex justify-between px-1 text-[10px] text-[#b4a69a]">
                    <span>1</span>
                    <span>2</span>
                    <span>3</span>
                    <span>4</span>
                    <span>5</span>
                  </div>
                </section>
              );
            })}
          </div>

          <div className="sticky bottom-0 mt-8 bg-[#fff8ef]/95 pb-5 pt-4 backdrop-blur-sm">
            <button
              type="button"
              onClick={handleCalculate}
              disabled={
                order.length === 0 ||
                answeredCount !== order.length
              }
              className="w-full rounded-full bg-gradient-to-b from-[#ff9c78] to-[#ff8a63] px-9 py-4 text-base font-bold text-white shadow-[0_10px_24px_rgba(255,138,99,0.32)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {order.length === 0
                ? "読み込み中..."
                : answeredCount === order.length
                  ? "診断する"
                  : `あと${order.length - answeredCount}問`}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // =========================
  // 診断中
  // =========================
  if (screen === "calculating") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fff8ef] text-[#3d332c]">
        <div className="flex flex-col items-center gap-5">
          <div className="h-[76px] w-[76px] animate-spin rounded-full border-[7px] border-[#fbeee0] border-t-[#ff8a63]" />

          <p className="text-sm font-medium text-[#93857a]">
            あなたの対人スタイルを診断しています…
          </p>
        </div>
      </main>
    );
  }

  // =========================
  // 結果
  // =========================
  if (
    screen === "result" &&
    result &&
    resultType
  ) {
    const accentColor =
      result.energyDir === "slow" && !isBalance
        ? "text-[#4fb3a6]"
        : "text-[#ff8a63]";

    const accentBorder =
      result.energyDir === "slow" && !isBalance
        ? "border-[#cce9e3]"
        : "border-[#efe1cd]";

    return (
      <main className="min-h-screen bg-[#fff8ef] px-5 py-8 text-[#3d332c]">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-5 pb-10">
          {/* 結果ヘッダー */}
          <section className="rounded-3xl border border-[#efe1cd] bg-white px-6 py-7 text-center">
            <p
              className={`text-xs font-bold tracking-[0.14em] ${accentColor}`}
            >
              {isBalance
                ? "バランスタイプ"
                : resultType.energyLabel}
            </p>

            <h1 className="mt-2 text-3xl font-bold">
              {resultType.name}
            </h1>

            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#93857a]">
              {resultType.tagline}
            </p>

            <div
              className={`mx-auto mt-6 flex h-28 w-28 items-center justify-center rounded-full border ${accentBorder} ${
                result.energyDir === "slow" &&
                !isBalance
                  ? "bg-gradient-to-br from-[#dcf3ee] to-[#fbeee0]"
                  : "bg-gradient-to-br from-[#ffe4d6] to-[#fbeee0]"
              }`}
            >
              <span
                className={`text-4xl font-black ${accentColor}`}
              >
                {resultType.name.charAt(0)}
              </span>
            </div>
          </section>

          {/* 保存エラー */}
          {saveError && (
            <section className="rounded-2xl border border-red-200 bg-white px-5 py-4">
              <p className="text-sm leading-6 text-red-500">
                {saveError}
              </p>
            </section>
          )}

          {/* 最初に見せる説明 */}
          <section className="rounded-2xl border border-[#efe1cd] bg-white px-5 py-5">
            <h2 className="text-sm font-bold text-[#ff8a63]">
              どんな人？
            </h2>

            <p className="mt-2 text-[15px] leading-7">
              {resultType[result.strength]}
            </p>
          </section>

          {/* 詳細表示 */}
          {showDetails && (
            <div className="flex flex-col gap-5">
              <section className="rounded-2xl border border-[#efe1cd] bg-white px-5 py-5">
                <h2 className="text-sm font-bold text-[#ff8a63]">
                  話が合う相手
                </h2>

                <p className="mt-2 text-[15px] leading-7">
                  {resultType.compat}
                </p>
              </section>

              {!isBalance &&
                resultType.bestMatch && (
                  <section className="rounded-2xl border border-[#efe1cd] bg-gradient-to-br from-[#ffe4d6] to-white px-5 py-5 text-center">
                    <p className="text-xs font-bold text-[#93857a]">
                      最も相性がよいタイプ
                    </p>

                    <p className="mt-2 text-xl font-bold text-[#ff8a63]">
                      {resultType.bestMatch}
                    </p>
                  </section>
                )}

              <p className="px-2 text-center text-xs leading-6 text-[#93857a]">
                ※本診断は医学的・臨床的な性格分析ではありません。
                性格は固定的なものではなく変化しうるため、
                気になったときにいつでも再診断できます。
              </p>
            </div>
          )}

          {/* 詳細開閉 */}
          <button
            type="button"
            onClick={() =>
              setShowDetails((previous) => !previous)
            }
            className="w-full rounded-full border border-[#efe1cd] bg-white px-6 py-3 text-sm font-bold text-[#6f6259] transition hover:border-[#ff8a63]"
          >
            {showDetails
              ? "詳細を閉じる"
              : "詳しく見る"}
          </button>

          {/* ホーム */}
        <button
          type="button"
          onClick={() => router.push("/home")}
        >
          ホームへ
        </button>
        </div>
      </main>
    );
  }

  return null;
}