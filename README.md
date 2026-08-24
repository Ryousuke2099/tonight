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
