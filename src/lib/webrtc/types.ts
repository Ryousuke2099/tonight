// WebRTC 通話のシグナリングメッセージ型。すべて Supabase Realtime Broadcast の
// `call:<matchId>` トピック上を流れる。DB には保存しない。

export type SignalEvent = "ring" | "accept" | "decline" | "sdp" | "ice" | "bye";

export interface SignalPayload {
  /** 送信者の user id。自分が送ったメッセージ(self:false でも保険で)を無視するのに使う。 */
  from: string;
  /** event === "sdp" のとき offer / answer。 */
  description?: RTCSessionDescriptionInit;
  /** event === "ice" のとき ICE candidate。 */
  candidate?: RTCIceCandidateInit;
}
