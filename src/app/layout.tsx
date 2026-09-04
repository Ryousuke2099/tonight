import type { Metadata, Viewport } from "next";
import "./globals.css";

// Deliberately NOT next/font/google: it fetches from fonts.googleapis.com at
// BUILD time, which breaks offline/sandboxed builds. Zen Maru Gothic is loaded
// via a runtime <link> below instead (the ported Woolink route CSS also
// @imports it as a fallback).

export const metadata: Metadata = {
  title: "Woolink — 今夜、話せる友達を見つけよう",
  description:
    "夜、誰かと話したい。でも誘ったら迷惑かな — を解決する、返事を待てる交換日記と両想い通話のアプリ。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0a1230",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Root layout is the right place for a global font link; the
            no-page-custom-font rule predates the App Router. next/font is
            avoided here on purpose (build-time network fetch). */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;500;700&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
