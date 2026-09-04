"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { fetchIceServers } from "./ice";
import type { SignalEvent, SignalPayload } from "./types";

export type CallPhase =
  | "idle" // 通話していない
  | "calling" // 自分が発信、相手の応答待ち
  | "incoming" // 相手から着信、まだ応答していない
  | "connecting" // offer/answer/ICE ネゴシエーション中
  | "connected" // 音声が流れている
  | "ended" // 正常終了(どちらかが切った / 相手が退出)
  | "failed"; // マイク不許可・接続失敗など

export interface UseCall {
  phase: CallPhase;
  muted: boolean;
  /** connected になってからの経過秒。それ以外は 0。 */
  elapsed: number;
  error: string | null;
  remoteStream: MediaStream | null;
  /** 発信する(phase === "idle" のときのみ有効)。 */
  start: () => void;
  /** 着信に応答する(phase === "incoming" のときのみ有効)。 */
  accept: () => void;
  /** 着信を拒否する。 */
  decline: () => void;
  /** 通話を切る / 発信をキャンセルする。 */
  hangup: () => void;
  toggleMute: () => void;
  /** 終了表示(ended / failed)を閉じて idle に戻す。 */
  reset: () => void;
}

const RING_TIMEOUT_MS = 30_000;

function mediaErrorMessage(e: unknown): string {
  if (e instanceof DOMException) {
    if (e.name === "NotAllowedError" || e.name === "SecurityError")
      return "マイクの使用が許可されませんでした";
    if (e.name === "NotFoundError" || e.name === "OverconstrainedError")
      return "マイクが見つかりませんでした";
  }
  if (e instanceof Error && e.message) return e.message;
  return "通話を開始できませんでした";
}

/**
 * マッチした2人の 1:1 音声通話。シグナリングは Supabase Realtime Broadcast の
 * プライベートチャンネル `call:<matchId>`(RLS で当事者のみに制限、
 * supabase/call_migration.sql 参照)。P2P の音声のみ、映像なし。
 *
 * フロー(グレア無しの素直な有向ネゴシエーション):
 *   発信側 start() → "ring" 送信 → 相手 phase="incoming"
 *   着信側 accept() → "accept" 送信 + PeerConnection/マイク準備
 *   発信側 "accept" 受信 → offer 生成 → "sdp"(offer) 送信
 *   着信側 "sdp"(offer) 受信 → answer 生成 → "sdp"(answer) 送信
 *   両者 "ice" を随時交換 → connected
 */
export function useCall(opts: {
  matchId: string;
  meId: string;
  peerId: string;
  /** false のときはチャンネルを開かない(デモ相手など)。 */
  enabled?: boolean;
}): UseCall {
  const { matchId, meId, peerId, enabled = true } = opts;
  const supabase = useMemo(() => createClient(), []);

  const [phase, setPhase] = useState<CallPhase>("idle");
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  // 通話時間の表示用。connected 中はタイマー effect が上書きする。値が
  // 表示されるのは phase === "connected" のときだけなので、終了後に古い値が
  // 残っていても UI には出ない(次の発信/応答で 0 に戻す)。
  const [elapsed, setElapsed] = useState(0);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pcBuildRef = useRef<Promise<RTCPeerConnection> | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const phaseRef = useRef<CallPhase>("idle");
  const connectedAtRef = useRef<number | null>(null);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const send = useCallback(
    (event: SignalEvent, payload: Omit<SignalPayload, "from"> = {}) => {
      channelRef.current?.send({
        type: "broadcast",
        event,
        payload: { ...payload, from: meId } satisfies SignalPayload,
      });
    },
    [meId]
  );

  const cleanupMedia = useCallback(() => {
    const pc = pcRef.current;
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.getSenders().forEach((s) => s.track?.stop());
      pc.close();
    }
    pcRef.current = null;
    pcBuildRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pendingIceRef.current = [];
    connectedAtRef.current = null;
    setRemoteStream(null);
    setMuted(false);
  }, []);

  const drainIce = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) return;
    const queued = pendingIceRef.current.splice(0);
    for (const c of queued) {
      try {
        await pc.addIceCandidate(c);
      } catch {
        // 相手がすでに切っている等 — 無視して続行
      }
    }
  }, []);

  // PeerConnection は1通話につき必ず1つだけ生成する(accept() と "sdp" ハンドラが
  // 競合しても二重に作らないよう Promise をメモ化)。
  const ensurePc = useCallback(async (): Promise<RTCPeerConnection> => {
    if (pcRef.current) return pcRef.current;
    if (pcBuildRef.current) return pcBuildRef.current;

    pcBuildRef.current = (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("このブラウザ / 接続では通話できません(HTTPS が必要です)");
      }
      const iceServers = await fetchIceServers();
      const pc = new RTCPeerConnection({ iceServers });

      pc.onicecandidate = (e) => {
        if (e.candidate) send("ice", { candidate: e.candidate.toJSON() });
      };
      pc.ontrack = (e) => {
        setRemoteStream(e.streams[0] ?? new MediaStream([e.track]));
      };
      pc.onconnectionstatechange = () => {
        switch (pc.connectionState) {
          case "connected":
            if (connectedAtRef.current === null) connectedAtRef.current = Date.now();
            setPhase("connected");
            break;
          case "failed":
            setError("接続に失敗しました(通信環境が厳しい可能性があります)");
            setPhase("failed");
            break;
          case "disconnected":
          case "closed":
            if (phaseRef.current === "connected") setPhase("ended");
            break;
        }
      };

      const local = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      local.getTracks().forEach((t) => pc.addTrack(t, local));
      localStreamRef.current = local;
      pcRef.current = pc;
      return pc;
    })();

    return pcBuildRef.current;
  }, [send]);

  const fail = useCallback(
    (message: string) => {
      setError(message);
      cleanupMedia();
      setPhase("failed");
    },
    [cleanupMedia]
  );

  // ── Realtime チャンネル購読 ───────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      // プライベートチャンネル(RLS)には現在のアクセストークンが必要。
      // @supabase/ssr の createBrowserClient は Realtime に自動でトークンを
      // 渡さないので、セッションから明示的に setAuth する。
      const {
        data: { session },
      } = await supabase.auth.getSession();
      await supabase.realtime.setAuth(session?.access_token);
      if (cancelled) return;

      const channel = supabase.channel(`call:${matchId}`, {
        config: { broadcast: { self: false }, private: true },
      });
      channelRef.current = channel;

      channel.on("broadcast", { event: "ring" }, ({ payload }) => {
        const p = payload as SignalPayload;
        if (p.from !== peerId) return;
        if (phaseRef.current === "idle") {
          setError(null);
          setPhase("incoming");
        } else if (phaseRef.current === "calling" && meId > peerId) {
          // グレア(両者同時に発信): id の大きい側が着信側に降りる。
          setPhase("incoming");
        }
      });

      channel.on("broadcast", { event: "decline" }, ({ payload }) => {
        const p = payload as SignalPayload;
        if (p.from !== peerId) return;
        setError("相手が応答できませんでした");
        cleanupMedia();
        setPhase("ended");
      });

      channel.on("broadcast", { event: "accept" }, async ({ payload }) => {
        const p = payload as SignalPayload;
        if (p.from !== peerId || phaseRef.current !== "calling") return;
        try {
          setPhase("connecting");
          const pc = await ensurePc();
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          send("sdp", { description: pc.localDescription?.toJSON() });
        } catch (e) {
          fail(mediaErrorMessage(e));
        }
      });

      channel.on("broadcast", { event: "sdp" }, async ({ payload }) => {
        const p = payload as SignalPayload;
        if (p.from !== peerId || !p.description) return;
        try {
          const desc = p.description;
          if (desc.type === "offer") {
            if (phaseRef.current !== "connecting") setPhase("connecting");
            const pc = await ensurePc();
            await pc.setRemoteDescription(desc);
            await drainIce();
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            send("sdp", { description: pc.localDescription?.toJSON() });
          } else if (desc.type === "answer") {
            const pc = pcRef.current;
            if (!pc) return;
            await pc.setRemoteDescription(desc);
            await drainIce();
          }
        } catch {
          fail("通話の確立に失敗しました");
        }
      });

      channel.on("broadcast", { event: "ice" }, async ({ payload }) => {
        const p = payload as SignalPayload;
        if (p.from !== peerId || !p.candidate) return;
        const pc = pcRef.current;
        if (pc?.remoteDescription) {
          try {
            await pc.addIceCandidate(p.candidate);
          } catch {
            // 無視(切断済み等)
          }
        } else {
          pendingIceRef.current.push(p.candidate);
        }
      });

      channel.on("broadcast", { event: "bye" }, ({ payload }) => {
        const p = payload as SignalPayload;
        if (p.from !== peerId) return;
        const wasActive =
          phaseRef.current === "connected" ||
          phaseRef.current === "connecting" ||
          phaseRef.current === "calling";
        cleanupMedia();
        setPhase(wasActive ? "ended" : "idle");
      });

      channel.subscribe((status, err) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error(`[useCall] channel ${status} for call:${matchId}`, err);
        }
      });
    })();

    return () => {
      cancelled = true;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      cleanupMedia();
    };
  }, [enabled, matchId, peerId, meId, supabase, send, ensurePc, drainIce, cleanupMedia, fail]);

  // ── 経過時間タイマー ─────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "connected") return;
    const startedAt = connectedAtRef.current ?? Date.now();
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);
    return () => window.clearInterval(id);
  }, [phase]);

  // ── 発信の呼び出しタイムアウト ───────────────────────────────────────
  useEffect(() => {
    if (phase !== "calling") return;
    const id = window.setTimeout(() => {
      send("bye");
      cleanupMedia();
      setError("応答がありませんでした");
      setPhase("ended");
    }, RING_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [phase, send, cleanupMedia]);

  // ── 操作 ─────────────────────────────────────────────────────────────
  const start = useCallback(() => {
    if (phaseRef.current !== "idle") return;
    setError(null);
    setElapsed(0);
    setPhase("calling");
    send("ring");
  }, [send]);

  const accept = useCallback(async () => {
    if (phaseRef.current !== "incoming") return;
    setError(null);
    setElapsed(0);
    setPhase("connecting");
    send("accept");
    try {
      // offer が届く前にマイク許可 & PeerConnection を用意しておく。
      await ensurePc();
    } catch (e) {
      fail(mediaErrorMessage(e));
    }
  }, [send, ensurePc, fail]);

  const decline = useCallback(() => {
    if (phaseRef.current !== "incoming") return;
    send("decline");
    cleanupMedia();
    setPhase("idle");
  }, [send, cleanupMedia]);

  const hangup = useCallback(() => {
    if (phaseRef.current === "idle") return;
    send("bye");
    cleanupMedia();
    setPhase("ended");
  }, [send, cleanupMedia]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !muted;
    stream.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
    setMuted(next);
  }, [muted]);

  const reset = useCallback(() => {
    if (phaseRef.current === "ended" || phaseRef.current === "failed") {
      setError(null);
      setPhase("idle");
    }
  }, []);

  return {
    phase,
    muted,
    elapsed,
    error,
    remoteStream,
    start,
    accept,
    decline,
    hangup,
    toggleMute,
    reset,
  };
}
