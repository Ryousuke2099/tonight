import Link from "next/link";

// Stage 6 で本実装予定。今はガイドリンクが 404 しないための最小版。
export default function HelpPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        background: "#0a1230",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          minHeight: "100vh",
          background:
            "radial-gradient(120% 60% at 50% 100%, #48619a 0%, #223464 45%, #0d1442 100%)",
          color: "#eef0fb",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          textAlign: "center",
          padding: "40px 28px",
        }}
      >
        <h1 style={{ fontSize: 18, margin: 0 }}>Woolink の使い方</h1>
        <p style={{ fontSize: 13, lineHeight: 1.9, color: "#a9adcf", margin: 0, maxWidth: 280 }}>
          ① 交換日記で、返事を待てるゆっくりしたやりとりを。
          <br />
          ② 両思い通話で、話せる時間と相手を選ぶ。
          <br />
          ③ 相手も同じ時間に「話したい」を選んだら、その時間に通話できます。
        </p>
        <Link
          href="/home"
          style={{
            marginTop: 8,
            padding: "12px 22px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.55)",
            color: "#eef0fb",
            fontSize: 13,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          ← ホームへ
        </Link>
      </div>
    </main>
  );
}
