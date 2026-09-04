"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitDiary } from "@/lib/diaryExchange";
import "./confirm.css";

type Recipient =
  | { type: "stranger" }
  | { type: "friend"; publicUserId: string }
  | null;

export default function DiaryConfirmPage() {
  const router = useRouter();
  const [diary] = useState(() =>
    typeof window === "undefined" ? "" : localStorage.getItem("draftDiary") ?? ""
  );
  const [recipient, setRecipient] = useState<Recipient>(null);
  const [friendInput, setFriendInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const normalizedFriendId = friendInput.trim().toUpperCase();
  const canSendToPublicId = diary.trim().length > 0 && normalizedFriendId.length > 0 && !isSubmitting;

  const handleFriendInput = (value: string) => {
    const publicUserId = value.toUpperCase();
    setFriendInput(publicUserId);
    setRecipient(publicUserId.trim() ? { type: "friend", publicUserId: publicUserId.trim() } : null);
    setError("");
  };

  const handleSend = async (targetPublicUserId: string | null) => {
    if (!diary.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError("");

    try {
      await submitDiary(diary, targetPublicUserId);
      localStorage.removeItem("draftDiary");
      router.replace("/diary/finish");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "日記の提出に失敗しました。");
      setIsSubmitting(false);
    }
  };

  const handleStrangerSend = () => {
    setRecipient({ type: "stranger" });
    setFriendInput("");
    void handleSend(null);
  };

  return (
    <main className="friend-page">
      <div className="friend-phone">
        <main className="content">
          <div className="scroll-area">
            <button type="button" className="back-btn" onClick={() => router.back()} disabled={isSubmitting}>
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                <path
                  d="M15 5l-7 7 7 7"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              戻る
            </button>

            <div className="content-preview">
              {diary ? (
                <p className="diary-preview-text">{diary}</p>
              ) : (
                <p>日記の本文がありません。戻って入力してください。</p>
              )}
            </div>

            <h1 className="section-title center">誰に送る？</h1>

            <button
              type="button"
              className={`stranger-btn ${recipient?.type === "stranger" ? "is-selected" : ""}`}
              onClick={handleStrangerSend}
              disabled={!diary.trim() || isSubmitting}
            >
              {isSubmitting && recipient?.type === "stranger" ? "送信中..." : "初めて出会う誰かに"}
            </button>

            <h2 className="section-title">公開IDを指定して送る</h2>

            <input
              type="text"
              className="friend-input"
              value={friendInput}
              onChange={(event) => handleFriendInput(event.target.value)}
              placeholder="公開IDを入力"
              autoCapitalize="characters"
              autoComplete="off"
              disabled={isSubmitting}
            />

            <p className="recipient-help">相手もあなたを指定して提出すると、交換が成立します。</p>

            {error && (
              <p className="submit-error" role="alert">
                {error}
              </p>
            )}

            <button
              type="button"
              className={`send-btn ${!canSendToPublicId ? "is-disabled" : ""}`}
              onClick={() => void handleSend(normalizedFriendId)}
              disabled={!canSendToPublicId}
            >
              {isSubmitting ? "送信中..." : "送信"}
            </button>
          </div>
        </main>
      </div>
    </main>
  );
}
