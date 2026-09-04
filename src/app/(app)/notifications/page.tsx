import WoolinkScreen from "@/components/WoolinkScreen";

export default function NotificationsPage() {
  return (
    <WoolinkScreen title="お知らせ">
      <p style={{ fontSize: 13, lineHeight: 1.9, color: "#a9adcf", margin: 0 }}>
        今のところ新しいお知らせはありません。
      </p>
      <p style={{ fontSize: 12, lineHeight: 1.9, color: "#8f94bd", marginTop: 16 }}>
        両思いになった相手との「話せる時間」が来ると、ホームのマッチカードから
        通知でお知らせします（設定で通知を有効にしている場合）。
      </p>
    </WoolinkScreen>
  );
}
