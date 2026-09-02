/**
 * 対人スタイル診断 — Structural Summary Method (SSM) スコアリング。
 * SeijiUshida/Tornado_2026 (js/app.js の computeResult) をそのまま移植。
 * すべてクライアント側で完結する計算で、サーバーには送信しない
 * （診断そのもののプライバシー原則— 元リポジトリのREADME/UIにも明記）。
 */
import { ANGLES, QUESTION_BANK, type Axis } from "./diagnosis-data";

export type EnergyDir = "fast" | "slow";
export type Strength = "weak" | "clear" | "strong";

export interface DiagnosisResult {
  axisKey: string | null; // null = バランス型
  energyDir: EnergyDir;
  amplitude: number;
  theta0: number;
  strength: Strength;
}

function avg(list: number[]): number {
  return list.reduce((s, v) => s + v, 0) / list.length;
}

export function computeResult(answers: Record<string, number>): DiagnosisResult {
  const byAxis: Record<Axis, number[]> = { agency: [], candor: [], warmth: [], social: [], energy: [] };
  QUESTION_BANK.forEach((q) => byAxis[q.axis].push(answers[q.id]));

  const d1 = avg(byAxis.agency) - 3; // 主導権 PA-HI
  const d2 = avg(byAxis.candor) - 3; // 素直さ BC-JK
  const d3 = avg(byAxis.warmth) - 3; // 距離感・温度感 DE-LM
  const d4 = avg(byAxis.social) - 3; // 社交性 FG-NO

  const scores: Record<string, number> = {
    PA: -d1, HI: d1,
    BC: -d2, JK: d2,
    DE: -d3, LM: d3,
    FG: -d4, NO: d4,
  };

  let X = 0;
  let Y = 0;
  Object.entries(scores).forEach(([key, score]) => {
    const rad = (ANGLES[key] * Math.PI) / 180;
    X += score * Math.cos(rad);
    Y += score * Math.sin(rad);
  });
  X *= 2 / 8;
  Y *= 2 / 8;

  const amplitude = Math.sqrt(X * X + Y * Y);
  let theta0 = (Math.atan2(Y, X) * 180) / Math.PI;
  if (theta0 < 0) theta0 += 360;

  const energyAvg = avg(byAxis.energy);
  const energyDir: EnergyDir = energyAvg < 2.5 ? "fast" : "slow";

  const maxDev = Math.max(Math.abs(d1), Math.abs(d2), Math.abs(d3), Math.abs(d4));
  const strength: Strength = maxDev < 0.8 ? "weak" : maxDev < 1.5 ? "clear" : "strong";

  const AMPLITUDE_THRESHOLD = 0.5;
  let axisKey: string | null = null;
  if (amplitude >= AMPLITUDE_THRESHOLD) {
    let best: string | null = null;
    let bestDist = Infinity;
    Object.entries(ANGLES).forEach(([key, angle]) => {
      let diff = Math.abs(theta0 - angle);
      diff = Math.min(diff, 360 - diff);
      if (diff < bestDist - 1e-9) {
        bestDist = diff;
        best = key;
      } else if (Math.abs(diff - bestDist) < 1e-9 && best && angle < ANGLES[best]) {
        best = key;
      }
    });
    axisKey = best;
  }

  return { axisKey, energyDir, amplitude, theta0, strength };
}

/** "PA_fast" 形式のタイプコード（バランス型は "balance"）。profiles.personality_type に保存する値。 */
export function typeCode(result: DiagnosisResult): string {
  return result.axisKey ? `${result.axisKey}_${result.energyDir}` : "balance";
}

export function shuffledQuestions(): typeof QUESTION_BANK {
  const a = QUESTION_BANK.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
