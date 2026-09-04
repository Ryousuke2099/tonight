"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { buildCallQuery } from "../callQuery";
import "./who.css";

function CallWhoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const date = searchParams.get("date");

  return (
    <main className="who-page">
      <div className="who-phone">
        <section className="who-content">
          <h1 className="who-page-title">誰と話したい？</h1>

          <section className="who-actions">
            <Link
              className="who-tile"
              href={`/call/time${buildCallQuery({ date, who: "stranger" })}`}
            >
              <span
                className="who-tile-illustration"
                aria-hidden="true"
              >
                <svg viewBox="0 0 48 48" width="40" height="40">
                  <circle
                    cx="24"
                    cy="18"
                    r="8"
                    fill="#eef0fb"
                  />
                  <path
                    d="M10 40c0-9 6-15 14-15s14 6 14 15"
                    fill="none"
                    stroke="#eef0fb"
                    strokeWidth="3.4"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <span className="who-tile-label">だれかと</span>
            </Link>

            <Link
              className="who-tile"
              href={`/call/friends${buildCallQuery({ date, who: "friend" })}`}
            >
              <span
                className="who-tile-illustration"
                aria-hidden="true"
              >
                <svg viewBox="0 0 48 48" width="44" height="40">
                  <circle
                    cx="17"
                    cy="17"
                    r="6.5"
                    fill="#eef0fb"
                  />
                  <circle
                    cx="31"
                    cy="17"
                    r="6.5"
                    fill="#eef0fb"
                  />
                  <path
                    d="M6 39c0-7.5 4.9-12.5 11-12.5S28 31.5 28 39"
                    fill="none"
                    stroke="#eef0fb"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M20 39c0-7.5 4.9-12.5 11-12.5S42 31.5 42 39"
                    fill="none"
                    stroke="#eef0fb"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <span className="who-tile-label">友達と</span>
            </Link>
          </section>

          <div className="who-back-btn-wrap">
            <button
              type="button"
              className="who-back-btn"
              onClick={() => router.back()}
            >
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                aria-hidden="true"
              >
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
        </section>
      </div>
    </main>
  );
}

export default function CallWhoPage() {
  return (
    <Suspense fallback={null}>
      <CallWhoContent />
    </Suspense>
  );
}
