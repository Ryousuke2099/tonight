import type { Metadata } from "next";
import DiagnosisClient from "./DiagnosisClient";

// ログイン不要の公開ページ。診断→交換日記→知人化→日調、という初対面導線の
// 入口（獲得）として機能するため、あえて /home のような認証ガードを付けない。
export const metadata: Metadata = {
  title: "対人スタイル診断 — Tonight",
  description: "20問で分かる、あなたの対人スタイル。結果はすべて端末内で計算され、外部には送信されません。",
};

export default function DiagnosisPage() {
  return <DiagnosisClient />;
}
