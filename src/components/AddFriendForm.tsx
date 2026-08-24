"use client";

import { useState } from "react";
import type { FriendOption } from "@/components/FriendSelector";

export default function AddFriendForm({ onAdded }: { onAdded: (friend: FriendOption) => void }) {
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    const trimmed = email.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "追加できませんでした");
        return;
      }
      if (body.friend) onAdded(body.friend);
      setEmail("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl bg-card p-3 space-y-2">
      <p className="text-xs text-moon/50">友達のメールアドレスで追加</p>
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="friend@example.com"
          className="flex-1 rounded-lg bg-night-deep border border-white/10 px-3 py-2 text-sm text-moon placeholder:text-moon/30 outline-none focus:border-accent/50"
        />
        <button
          onClick={submit}
          disabled={saving || !email.trim()}
          className="rounded-lg bg-white/10 text-moon text-xs px-3.5 py-2 shrink-0 disabled:opacity-40"
        >
          {saving ? "追加中…" : "追加"}
        </button>
      </div>
      {error && <p className="text-xs text-ember">{error}</p>}
    </div>
  );
}
