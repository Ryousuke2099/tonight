/**
 * 写真→動画化（Ryousuke2099/Tornado2026-TearmH）は Express/FFmpeg の
 * video-service を伴う別アーキテクチャなので、この統合では取り込まず、
 * 独立モジュールとして外部デプロイのまま維持し、リンクで誘導するだけに
 * している（claude/tornado-2026-app-architecture.md の「システム統合方針」
 * と同じ判断）。
 */
export const VIDEO_STUDIO_URL =
  process.env.NEXT_PUBLIC_VIDEO_STUDIO_URL || "https://tornado2026-tearm-h.vercel.app/";
