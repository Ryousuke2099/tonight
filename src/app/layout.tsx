import type { Metadata, Viewport } from "next";
import "./globals.css";

// Deliberately NOT next/font/google here: it requires a live connection to
// fonts.googleapis.com at build time, which breaks offline/sandboxed builds
// (and Vercel's build environment can be flaky about it too). A system font
// stack renders Japanese text via each platform's built-in font (Hiragino on
// iOS/macOS, Noto Sans CJK / Yu Gothic elsewhere) with zero network cost.

export const metadata: Metadata = {
  title: "Tonight — 今夜、話せる友達を見つけよう",
  description:
    "今電話していい、がわかる。お互い話したい夜だけ、友達とつながる double opt-in な通話マッチングアプリ。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#12141f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-night">{children}</body>
    </html>
  );
}
