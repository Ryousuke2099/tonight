import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/home");

  return (
    <main className="min-h-dvh flex flex-col px-6">
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-8 max-w-sm mx-auto">
        <p className="text-5xl">🌙</p>

        <div className="space-y-3">
          <h1 className="text-2xl font-semibold text-moon leading-snug">
            今電話していい、
            <br />
            がわかる。
          </h1>
          <p className="text-sm text-moon/60 leading-relaxed">
            友達と話したい夜。でも、
            <br />
            「忙しいかな」「電話したら迷惑かな」
            <br />
            「誘って断られたら嫌だな」
            <br />
            そんな気まずさをなくします。
          </p>
        </div>

        <div className="rounded-2xl bg-card/60 p-5 text-left space-y-3 w-full">
          <Feature
            icon="🔒"
            text="あなたが「話したい」と思ったことは、相手が同じ気持ちの時しか伝わりません"
          />
          <Feature icon="🕰️" text="お互いが選んだ時間が重なった時だけ、そっと知らせます" />
          <Feature icon="🤝" text="新しい出会いではなく、今いる友達ともっと話すためのアプリです" />
        </div>

        <div className="w-full text-left space-y-3">
          <p className="text-xs text-moon/40 uppercase tracking-wide text-center">使い方</p>
          <Step number={1} text="今夜〜1週間以内で、話せそうな日と時間を選ぶ" />
          <Step number={2} text="話したい友達を選ぶ（誰でもOKにもできます）" />
          <Step number={3} text="相手も同じ気持ちだった時だけ、こっそりマッチをお知らせ" />
        </div>

        <Link
          href="/login"
          className="w-full rounded-xl bg-accent text-night font-medium py-3.5 text-sm hover:brightness-105 transition"
        >
          今夜話せる友達を探す
        </Link>
      </div>

      <p className="text-center text-xs text-moon/25 pb-6">Tonight — お互い話したい夜だけ、つながる。</p>
    </main>
  );
}

function Feature({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-lg leading-none shrink-0">{icon}</span>
      <p className="text-sm text-moon/70 leading-relaxed">{text}</p>
    </div>
  );
}

function Step({ number, text }: { number: number; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex items-center justify-center h-5 w-5 rounded-full bg-accent-soft text-accent text-[11px] font-medium shrink-0 mt-0.5">
        {number}
      </span>
      <p className="text-sm text-moon/70 leading-relaxed">{text}</p>
    </div>
  );
}
