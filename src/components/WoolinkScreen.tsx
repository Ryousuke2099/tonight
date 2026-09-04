"use client";

import { useRouter } from "next/navigation";

/** Woolink の共通「スマホ枠」レイアウト。profile / settings / notifications /
 * help などの単純なページで使う。 */
export default function WoolinkScreen({
  title,
  children,
  back = "/home",
}: {
  title: string;
  children: React.ReactNode;
  back?: string;
}) {
  const router = useRouter();
  return (
    <main style={{ minHeight: "100vh", display: "flex", justifyContent: "center", background: "#0a1230" }}>
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          minHeight: "100vh",
          background: "radial-gradient(120% 60% at 50% 100%, #48619a 0%, #223464 45%, #0d1442 100%)",
          color: "#eef0fb",
          display: "flex",
          flexDirection: "column",
          padding: "22px 20px 40px",
        }}
      >
        <h1 style={{ fontSize: 18, margin: "0 0 18px", fontWeight: 700 }}>{title}</h1>
        <div style={{ flex: 1 }}>{children}</div>
        <button
          type="button"
          onClick={() => router.push(back)}
          style={{
            alignSelf: "flex-start",
            marginTop: 24,
            padding: "10px 20px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.5)",
            background: "none",
            color: "#eef0fb",
            fontSize: 13,
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          ← 戻る
        </button>
      </div>
    </main>
  );
}
