"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import "./select.css";

export default function DiarySelectPage() {
  const router = useRouter();

  return (
    <main className="select-page">
      <div className="select-phone">
        <main className="content">
          <h1 className="page-title">どうやって書く？</h1>

          <section className="method-actions">
            <Link className="method-tile" href="/diary/write">
              <span className="method-illustration" aria-hidden="true">
                <svg viewBox="0 0 48 48" width="38" height="38">
                  <rect x="10" y="7" width="24" height="32" rx="3" fill="none" stroke="#eef0fb" strokeWidth="2.4" />
                  <line x1="16" y1="16" x2="28" y2="16" stroke="#eef0fb" strokeWidth="2.2" strokeLinecap="round" />
                  <line x1="16" y1="22" x2="28" y2="22" stroke="#eef0fb" strokeWidth="2.2" strokeLinecap="round" />
                  <line x1="16" y1="28" x2="24" y2="28" stroke="#eef0fb" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </span>
              <span className="method-label">文章で</span>
            </Link>

            {/* 写真から作る機能はまだ未実装（写真→動画は別アプリ「写真を動画にする」で提供）。
                タイルは残しつつ、押せないことが分かるようにしておく。 */}
            <span
              className="method-tile"
              aria-disabled="true"
              style={{ opacity: 0.4, cursor: "not-allowed", pointerEvents: "none" }}
            >
              <span className="method-illustration" aria-hidden="true">
                <svg viewBox="0 0 48 48" width="40" height="40">
                  <rect x="7" y="13" width="34" height="25" rx="4" fill="none" stroke="#eef0fb" strokeWidth="2.4" />
                  <rect x="17" y="8" width="14" height="7" rx="2" fill="none" stroke="#eef0fb" strokeWidth="2.4" />
                  <circle cx="24" cy="26" r="7" fill="none" stroke="#eef0fb" strokeWidth="2.4" />
                </svg>
              </span>
              <span className="method-label">写真から（準備中）</span>
            </span>
          </section>

          <footer className="mascot-row">
            <Image className="mascot" src="/home/guide-sheep.svg" width={120} height={120} alt="ガイド羊" />
            <div className="tip-bubble">文章で書くか、写真から作るか選んでね！</div>
          </footer>

          <div className="back-btn-wrap">
            <button type="button" className="back-btn" onClick={() => router.back()}>
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
        </main>
      </div>
    </main>
  );
}
