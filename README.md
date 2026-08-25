# Tonight 🌙

「今電話していい、がわかる。」お互い話したい夜だけ、既存の友達とつながる
double opt-in 型の通話マッチングアプリ（MVPプロトタイプ）。

「暇です」を一方的に公開するアプリではありません。AさんとBさんが**双方**
今夜話してもいいと選び、かつ空いている時間が重なった時だけ、初めてお互い
に知らされます。片方だけの意思は、相手には絶対に見えません。

設計の詳細（画面構成・DBスキーマ・マッチングアルゴリズム・招待/ゲストフロー・
プライバシー設計）は [`ARCHITECTURE.md`](./ARCHITECTURE.md) を参照してください。

## セットアップ

### 1. Supabase プロジェクトを作る

[supabase.com](https://supabase.com) で新規プロジェクトを作成し、
`Settings → API` から以下を控えます。

- Project URL
- `anon` `public` key
- `service_role` `secret` key（**絶対にクライアントへ公開しない**）

### 2. スキーマを流し込む

Supabase ダッシュボードの `SQL Editor` を開き、[`supabase/schema.sql`](./supabase/schema.sql)
の中身をそのまま実行してください（テーブル・トリガー・RLS ポリシー・
Realtime publication をすべて含みます。再実行しても安全です）。

`Authentication → Providers → Email` で **Email OTP (magic link)** が
有効になっていることを確認してください（デフォルトで有効です）。

### 3. 環境変数を設定する

```bash
cp .env.local.example .env.local
```

`.env.local` を開いて、手順1で控えた値を入力してください。

| 変数 | 説明 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon/public キー |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role キー。マッチング計算とゲスト（未登録）フローでのみ、サーバー側の Route Handler から使用します。クライアントには一切送られません |
| `NEXT_PUBLIC_DEMO_USER_PASSWORD` | デモユーザー（Haru/Yuki/Mei/Ren/Sora/Takumi）共通パスワード。ブラウザから使うため公開前提です |
| `NEXT_PUBLIC_SITE_URL` | 招待リンクの絶対URL生成に使用（ローカルなら `http://localhost:3000`、本番なら Vercel の URL） |

### 4. 依存関係をインストールして起動

```bash
npm install
npm run dev
```

http://localhost:3000 を開きます。

### 5. デモデータを投入する（推奨）

友達関係が最初から存在する状態でデモできるよう、6人のデモユーザー
（Takumi / Haru / Yuki / Mei / Ren / Sora）を作成し、全員を相互に友達
登録するシードスクリプトを用意しています。

```bash
npm run seed
```

実行後、`/login` 画面のアイコンをタップするだけでそれぞれのデモユーザー
としてログインできます（パスワードは `.env.local` の
`NEXT_PUBLIC_DEMO_USER_PASSWORD`）。何度実行しても安全です（既存ユーザー
はスキップされます）。

### 実際の友達を追加する

デモユーザー同士は最初から相互に友達登録されていますが、実際にサインアップ
した本物のユーザー同士は自動では友達になりません。ホーム画面の「今夜、誰と
話したい？」ステップに「友達のメールアドレスで追加」という欄があるので、
相手が登録したメールアドレスを入力すると、その場で双方向の友達関係が作られ
ます（承認フローなし。close friendsだけの小規模な運用を前提にした簡易実装
です — 見ず知らずの相手に一方的に追加されうる、という意味では今後もう少し
厳格にする余地がありますが、その場合もマッチ自体は双方が毎晩改めて意思表示
しない限り成立しないので、プライバシーの根幹は変わりません）。

### 初回体験を良くする工夫

- **サンプル相手（Haru/Yuki/Mei/Ren）**: 実際にサインアップした（デモ
  ログインではない）ユーザーは、`handle_new_user()` トリガーによって自動
  的にこの4人と友達になります。加えて、`/api/intent` に自分の予定を保存
  するたびに、この4人の「今夜」の予定（誰でもOK・時間帯フル）がまだ無け
  れば自動的に用意されます（`src/lib/demo-companions.ts`）。そのため、
  他のアカウントを一切操作しなくても、自分の予定を登録した瞬間にマッチ
  を体験できます。マッチ画面にはサンプル相手であることが明記されます。
  Takumi/Sora はこの自動追加には含まれません（純粋なデモログイン用）。
- **使い方セクション**: トップページに3ステップの使い方説明を追加済み
  です（`src/app/page.tsx`）。
- **1週間先までの予定登録**: ホーム画面の日付ピッカーで、今日から6日先
  までの好きな日を選んで予定を登録できます（バックエンドは元々
  `date` を自由なパラメータとして扱っていたため、フロント側の変更のみ）。

### 「誰でもOK」でも優先したい友達を選べる

「誰でもOK」モードでも、任意で優先したい友達を選べます（intent_targets は
モードに関わらず保存されるようになりました）。マッチが複数見つかった場合、
優先指定した友達とのマッチが上に表示され、⭐マークが付きます。「特定の
友達を選ぶ」モードでは今まで通り、選んだ友達以外とはマッチしません。

### 当日リマインドメール

先の日付で予定を登録しておくと、その当日にリマインドメールが届く仕組み
です（`src/app/api/cron/reminders/route.ts`）。メール送信には
[Resend](https://resend.com) を、日次起動には GitHub Actions の
scheduled workflow（`.github/workflows/daily-reminders.yml`、毎日
09:00 JST 起動）を使っています。Netlify Scheduled Functions は使って
いません（プランによって使えるか不確かなため）。

有効にするには:

1. [resend.com](https://resend.com) で無料アカウントを作り、API Keys か
   ら新しいキーを発行する。
2. Netlify の Site settings → Environment variables に `RESEND_API_KEY`
   と、ランダムな文字列を決めて `CRON_SECRET` を追加する（本番に反映す
   るには再デプロイが必要です）。
3. GitHub リポジトリの Settings → Secrets and variables → Actions で、
   同じ値を `CRON_SECRET` という名前のシークレットとして追加する（2 と
   完全に同じ文字列にしてください）。

> ⚠️ Resend はドメイン未認証の状態だと、送信先が「自分のResendアカウント
> に登録したメールアドレス」に制限されます。友達それぞれの本物のメール
> アドレスに届けるには、Resend で送信元ドメインを認証する必要があります
> （Resend の Domains 画面から数分でできます）。認証前でも自分宛のテスト
> 送信で仕組み自体は確認できます。

## 複数端末での動作確認（デモシナリオ）

1. **スマホ A**: `/login` から Takumi でログイン → 「話したい友達を選ぶ」
   → 時間帯 22:00〜24:00 を選択 → Haru を選択 → 決定。
2. **スマホ B**: `/login` から Haru でログイン → Takumi を選択 → 時間帯
   23:00〜25:00 を選択 → 決定。
   → 両方の画面に **23:00〜24:00、マッチ** がリアルタイムで表示されます。
3. **スマホ A**: `/invite` からリンクを作成 → LINE 等で共有。
4. **スマホ C（ログインなし）**: リンクを開く → 名前入力 → 「話せる」→
   23:30〜24:30 を選択 → 回答。
   → スマホ A の `/invite` 画面に結果がリアルタイムで反映されます。

## テスト

```bash
npm run lint
npm run build
npx tsx scripts/test-match-logic.ts   # マッチング計算のロジックのみを検証するスモークテスト
```

## デプロイ（Vercel）

1. このリポジトリを Vercel にインポート。
2. `.env.local` と同じ環境変数を Vercel の Project Settings → Environment
   Variables に設定（`NEXT_PUBLIC_SITE_URL` は本番ドメインに変更）。
3. デプロイ後、Supabase の `Authentication → URL Configuration` に本番
   ドメインの `/auth/callback` をリダイレクト先として追加してください。

## スコープ外（意図的に実装していないもの）

要件定義の P2 に対応し、以下は意図的に含めていません: アプリ内音声/ビデオ
通話（WebRTC）、チャット、投稿・タイムライン、知らない人とのマッチング、
AI、課金、詳細プロフィール、位置情報共有、カレンダー連携、SNSフィード。
マッチ後の導線は「LINEで連絡する」「コピーして送る」のみです。
