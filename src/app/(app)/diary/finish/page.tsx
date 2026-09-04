import Image from "next/image";
import Link from "next/link";
import "./finish.css";

export default function DiaryFinishPage() {
  return (
    <main className="finish-page">
      <div className="finish-phone">
        <section className="finish-content">
          <div className="finish-message">
            <p className="finish-title">送信しました</p>

            <div className="finish-sheep-stamp">
              <Image
                className="finish-sheep"
                src="/home/guide-sheep.svg"
                alt="送信を知らせるガイド羊"
                width={150}
                height={150}
                priority
              />
            </div>

            <p className="finish-caption">交換相手からの返信を楽しみにお待ちください</p>
          </div>

          <div className="finish-footer-actions">
            <Link className="finish-home-btn" href="/diary">
              交換日記ホームへ
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
