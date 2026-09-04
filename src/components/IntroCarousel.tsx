"use client";

import { Fragment, useState } from "react";
import Image from "next/image";

type IntroPage = {
  heading?: string;
  body: string[];
  emphasis?: string;
};

// 初回説明（4ページ）。実装済み機能（交換日記・性格診断による相性マッチ・両想い通話）と
// 内容がずれないよう、各ページの説明文はそれぞれの画面の実装に合わせている。
const INTRO_PAGES: IntroPage[] = [
  {
    body: ["夜、1人がさみしい", "誰かと話したい", "でも、誘ったら迷惑じゃないかな…"],
    emphasis: "そんなあなたのためのアプリです",
  },
  {
    heading: "①返事に焦らない交換日記",
    body: ["日記を書いたら、返事を待ち眠る。", "ゆっくりやりとりができる交換日記で", "日常の共有ができます。"],
  },
  {
    heading: "②安心できる友達との出会い",
    body: ["あなたの対人タイプを診断。", "結果をもとに相性の良いユーザーと", "交換日記が行えます。"],
  },
  {
    heading: "③友達との両思い通話",
    body: ["話せる時間に話せる人と。", "「今、迷惑じゃないかな」", "を解決します。"],
  },
];

type IntroCarouselProps = {
  // ログイン処理は持たず、最後のページまで進んだことだけを通知する。
  onFinish: () => void;
};

export default function IntroCarousel({ onFinish }: IntroCarouselProps) {
  const [step, setStep] = useState(0);

  const page = INTRO_PAGES[step];
  const isLastPage = step === INTRO_PAGES.length - 1;

  return (
    <div className="welcome-intro">
      <p className="welcome-copy">ようこそ Woolinkへ！</p>

      <div className="welcome-panel">
        <div className="welcome-panel-copy">
          {page.heading && <p className="welcome-panel-heading">{page.heading}</p>}

          <p>
            {page.body.map((line, i) => (
              <Fragment key={i}>
                {line}
                {i < page.body.length - 1 && <br />}
              </Fragment>
            ))}
          </p>

          {page.emphasis && <p className="welcome-panel-emphasis">{page.emphasis}</p>}
        </div>

        <Image
          className="welcome-app-icon"
          src="/app-icon.svg"
          alt=""
          width={380}
          height={130}
          aria-hidden="true"
        />

        <div className="welcome-page-indicators" role="group" aria-label="ページ選択">
          {INTRO_PAGES.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`welcome-page-indicator${i === step ? " is-active" : ""}`}
              aria-label={`${i + 1}ページ目`}
              aria-pressed={i === step}
              onClick={() => setStep(i)}
            />
          ))}
        </div>
      </div>

      <button
        type="button"
        className="welcome-next-btn"
        onClick={() => (isLastPage ? onFinish() : setStep((s) => s + 1))}
      >
        {isLastPage ? "はじめる" : "次へ"}
      </button>
    </div>
  );
}
