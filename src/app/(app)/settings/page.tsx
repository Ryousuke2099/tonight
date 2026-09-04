"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import WoolinkScreen from "@/components/WoolinkScreen";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [notifyMsg, setNotifyMsg] = useState<string | null>(null);

  const enableNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotifyMsg("この端末は通知に対応していません。");
      return;
    }
    const perm =
      Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    setNotifyMsg(
      perm === "granted"
        ? "通知を有効にしました。マッチした時間になるとお知らせします。"
        : "通知は許可されませんでした。"
    );
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const btn: React.CSSProperties = {
    display: "block",
    width: "100%",
    padding: "13px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(20,28,62,0.55)",
    color: "#eef0fb",
    fontSize: 14,
    fontWeight: 700,
    fontFamily: "inherit",
    cursor: "pointer",
    marginBottom: 12,
  };

  return (
    <WoolinkScreen title="設定">
      <button type="button" style={btn} onClick={enableNotifications}>
        🔔 マッチ時間の通知を有効にする
      </button>
      {notifyMsg && (
        <p style={{ fontSize: 12, color: "#c3cff0", margin: "0 0 12px" }}>{notifyMsg}</p>
      )}

      <button
        type="button"
        style={{ ...btn, color: "#ffb4b4", borderColor: "rgba(255,180,180,0.3)" }}
        onClick={logout}
      >
        ログアウト
      </button>
    </WoolinkScreen>
  );
}
