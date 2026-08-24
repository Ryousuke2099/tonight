"use client";

import Avatar from "@/components/Avatar";

export interface FriendOption {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface FriendSelectorProps {
  friends: FriendOption[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}

export default function FriendSelector({ friends, selectedIds, onToggle }: FriendSelectorProps) {
  const selected = new Set(selectedIds);

  if (friends.length === 0) {
    return (
      <p className="text-sm text-moon/50 text-center py-6">
        まだ友達がいません。招待リンクで誘ってみましょう。
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {friends.map((f) => {
        const isSelected = selected.has(f.id);
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onToggle(f.id)}
            className={[
              "w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors text-left",
              isSelected ? "bg-accent-soft ring-1 ring-accent/40" : "bg-card hover:bg-card-hover",
            ].join(" ")}
          >
            <Avatar src={f.avatar_url} name={f.name} />
            <span className="flex-1 text-sm text-moon">{f.name}</span>
            <span
              className={[
                "h-5 w-5 rounded-full border flex items-center justify-center text-[10px] shrink-0",
                isSelected ? "bg-accent border-accent text-night" : "border-moon/30 text-transparent",
              ].join(" ")}
            >
              ✓
            </span>
          </button>
        );
      })}
    </div>
  );
}
