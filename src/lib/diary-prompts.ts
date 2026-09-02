/**
 * 交換日記のお題テンプレ。CJM分析（理奈さん/陸さんペルソナ）で「何を書けば
 * いいか毎回悩む」が交換日記の離脱要因として挙がったための機能 —
 * 選ばなくても自由記述できるが、迷ったときの入口として提示する。
 * 固定リストで十分な規模なので DB ではなくコードで持つ（差し替えが容易）。
 */
export interface DiaryPrompt {
  id: string;
  label: string;
}

export const DIARY_PROMPTS: DiaryPrompt[] = [
  { id: "today-good", label: "今日いちばん良かったこと" },
  { id: "today-tired", label: "今日ちょっと疲れたこと" },
  { id: "food", label: "今日食べたもの・食べたいもの" },
  { id: "small-thanks", label: "今日ありがとうと思ったこと" },
  { id: "curious", label: "最近気になっていること" },
  { id: "tomorrow", label: "明日ちょっと楽しみなこと" },
  { id: "random", label: "特に理由はないけど話したいこと" },
];

export function findPrompt(id: string | null | undefined): DiaryPrompt | null {
  if (!id) return null;
  return DIARY_PROMPTS.find((p) => p.id === id) ?? null;
}
