"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { buildCallQuery } from "../callQuery";
import "./friends.css";

type Friend = { id: string; name: string; avatar_url: string | null; is_demo?: boolean };

function PersonIcon() {
  return (
    <svg viewBox="0 0 40 40" width="22" height="22">
      <circle cx="20" cy="15" r="7" fill="#eef0fb" />
      <path
        d="M6 34c0-8 6-13 14-13s14 5 14 13"
        fill="none"
        stroke="#eef0fb"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CallFriendsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const date = searchParams.get("date");

  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/friends");
      if (res.ok) {
        const { friends } = await res.json();
        setFriends(friends ?? []);
        if ((friends ?? []).length > 0) setSelectedId(friends[0].id);
      }
    })();
  }, []);

  async function addFriend() {
    if (!email.trim() || adding) return;
    setAdding(true);
    setError(null);
    const res = await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    setAdding(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "追加できませんでした");
      return;
    }
    const { friend } = await res.json();
    if (friend) {
      setFriends((prev) => (prev.some((f) => f.id === friend.id) ? prev : [...prev, friend]));
      setSelectedId(friend.id);
    }
    setEmail("");
  }

  const selectedFriend = friends.find((f) => f.id === selectedId) ?? null;

  return (
    <main className="friends-page">
      <div className="friends-phone">
        <section className="friends-content">
          <div className="friends-scroll-area">
            <h1 className="friends-page-title">誰と話したい？</h1>

            <p className="friends-notice">
              <svg
                className="friends-notice-icon"
                viewBox="0 0 24 24"
                width="13"
                height="13"
                aria-hidden="true"
              >
                <rect x="5" y="10" width="14" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="1.8" />
              </svg>
              あなたが選んだことは、マッチするまで相手にはわかりません
            </p>

            <div className="friends-contact-list" role="radiogroup" aria-label="話したい相手">
              {friends.length === 0 && (
                <p style={{ fontSize: 13, color: "rgba(238,240,251,0.55)", padding: "8px 2px" }}>
                  まだ友達がいません。下のメールアドレス欄から追加できます。
                </p>
              )}

              {friends.map((friend) => (
                <button
                  key={friend.id}
                  type="button"
                  className={`friends-contact-row${selectedId === friend.id ? " is-selected" : ""}`}
                  onClick={() => setSelectedId(friend.id)}
                >
                  <span className="friends-avatar avatar-1">
                    {friend.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={friend.avatar_url} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%" }} />
                    ) : (
                      <PersonIcon />
                    )}
                  </span>

                  <span className="friends-contact-main">
                    <span className="friends-contact-name">{friend.name}</span>
                    {friend.is_demo && <span className="friends-contact-tag">🌙 サンプル</span>}
                  </span>

                  <span className="friends-radio-dot" aria-hidden="true" />
                </button>
              ))}

              <div className="friends-invite-box">
                <label className="friends-invite-label" htmlFor="inviteEmail">
                  友達のメールアドレスで追加
                </label>

                <div className="friends-invite-row">
                  <input
                    type="email"
                    id="inviteEmail"
                    className="friends-invite-input"
                    placeholder="friend@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <button
                    type="button"
                    className="friends-invite-btn"
                    onClick={addFriend}
                    disabled={adding}
                  >
                    {adding ? "…" : "追加"}
                  </button>
                </div>
                {error && <p style={{ fontSize: 12, color: "#ffb4b4", margin: "6px 0 0" }}>{error}</p>}
              </div>
            </div>

            <Link href="/invite" className="friends-invite-link">
              友達がいない？招待リンクを作る
            </Link>
          </div>

          <div className="friends-footer-actions">
            <Link
              className={`friends-next-btn${selectedFriend ? "" : " is-disabled"}`}
              href={
                selectedFriend
                  ? `/call/time${buildCallQuery({
                      date,
                      who: "friend",
                      friend: selectedFriend.id,
                      fname: selectedFriend.name,
                    })}`
                  : "#"
              }
              aria-disabled={!selectedFriend}
            >
              次へ
            </Link>

            <div className="friends-back-btn-wrap">
              <button type="button" className="friends-back-btn" onClick={() => router.back()}>
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
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function CallFriendsPage() {
  return (
    <Suspense fallback={null}>
      <CallFriendsContent />
    </Suspense>
  );
}
