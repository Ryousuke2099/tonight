# 統合セットアップ手順（2026-09-02）

このブランチ相当の変更で、`TAKUMI-06/tonight`（日調）に **交換日記** と
**対人スタイル診断** をマージした。**写真→動画化**
（`Ryousuke2099/Tornado2026-TearmH`）はExpress/FFmpegの別サービスなので
意図的に取り込まず、外部リンクのままにしてある。詳しい判断理由は
`claude/tornado-2026-app-architecture.md`（プロジェクトdoc）を参照。

このファイルはこのZIP作業がどこで止まっているか、Takuが何をすればいいかを
まとめたもの。作業が終わったら消してよい。

## 1. 何が変わったか

- `supabase/diary_migration.sql`（新規） — 交換日記+診断用のテーブル追加
  （additive、schema.sql は無変更）
- `src/app/diagnosis/`（新規） — 対人スタイル診断。ログイン不要の公開ページ
- `src/app/diary/`（新規） — 交換日記一覧・部屋作成・待合室・部屋の中
- `src/app/api/diary/`, `src/app/api/profile/personality-type/`（新規）
- `src/lib/diagnosis.ts`, `diagnosis-data.ts`, `diary.ts`, `diary-prompts.ts`,
  `pending-personality-type.ts`, `external-links.ts`（新規）
- `src/types/db.ts` — Profile に `personality_type`、DiaryRoom/DiaryEntry型を追加
- `src/app/home/HomeClient.tsx` — ナビに「交換日記」「対人スタイル診断」
  「写真を動画にする（外部リンク）」を追加
- `src/app/page.tsx` — 診断への導線（登録不要）を追加

## 2. 適用手順

1. **Supabaseにマイグレーションを適用**（このサンドボックスから
   `*.supabase.co` へは到達できないため、Takuの手元 or Supabase の
   SQL Editor から実行する必要がある）:
   - Supabaseダッシュボード → 「TAKUMI-06's Project」→ SQL Editor
   - `supabase/diary_migration.sql` の中身を貼り付けて実行
   - 再実行しても安全（`IF NOT EXISTS` / `DROP POLICY IF EXISTS` 使用）
2. **このZIPの中身を既存の `tonight` リポジトリに反映**:
   - 一番簡単なのは、Takuの手元にある `tonight` のクローンにこのZIPの
     中身を上書きコピーしてから `git status` で差分確認 → commit → push
   - このサンドボックスにはTAKUMI-06アカウントへのpush権限がないため、
     コード自体はここまでしか進められていない
3. **環境変数**: `.env.local` は既存のままでOK。
   `NEXT_PUBLIC_VIDEO_STUDIO_URL` は未設定でも
   `https://tornado2026-tearm-h.vercel.app/` にフォールバックする
4. **Netlifyへのデプロイ**: 既存のGitHub連携で自動デプロイされるはず
   （push後、Netlifyのビルドログを確認）

## 3. 動作確認手順（デプロイ後）

1. `/diagnosis` に未ログインでアクセスできることを確認（20問診断→結果表示）
2. ログイン後、結果画面の「この結果で交換日記をはじめる」→ `/diary` に
   遷移し、`personality_type` が保存されることを確認
3. `/diary/new` で既存の友達（デモユーザーでもOK）を選び、モードBの部屋が
   作れることを確認 → 日記を送信 → 相手側アカウントで見えることを確認
4. `/diary/queue` を2つの別アカウント（別ブラウザ/シークレットウィンドウ）
   で同時に開き、即座にマッチしてモードAの部屋が作られることを確認
5. モードAの部屋で両側から「続けたい」を押し、`friendships` に
   双方向で行が増え、Tonightのホームの友達一覧にも出てくることを確認

## 4. 意図的に対応していないもの（次のステップ）

- **通報・ブロック機能**: 交換日記・日調どちらにも未実装。CJM分析で
  「初対面マッチングのため必須」と挙げていた項目 — ハッカソンの時間内では
  優先度的に見送った。コンセプトシート上は「同じ導線からいつでも」という
  仕様のまま。次に着手するなら最優先候補。
- **対人スタイル診断の相性マッチング**: モードAの自動マッチングは「同じ
  診断タイプなら優先、いなければ待機列の先頭」という単純な発見的規則。
  17タイプ同士の本格的な相性表（`compat`文言はあるが数値化はしていない）
  を使った精緻なマッチングは未実装（architecture doc に「未確定」と
  記載済みの項目）。
- **交換日記モードAの期間・往復回数**: `src/lib/diary.ts` に
  `MODE_A_WINDOW_DAYS = 7`, `MODE_A_MAX_EXCHANGES = 5` と仮値を置いている。
  正式な値が決まり次第ここを変えるだけでよい。
- **診断結果のシェア画像機能**: 元の `Tornado_2026`
  にあったcanvas書き出し（PNG保存）は移植していない。時間があれば追加可能。
  現状は結果画面のテキスト表示のみ。
- **グループ交換日記・招待リンクからの自動フレンド化の詳細**: CJM分析の
  段階で挙がっていたが、今回のスコープには含めていない
  （`claude/woolink-concept-sheet.md` の「次のアクション候補」に記載済み）。
- **1日1往復の頻度制限**: 現状は「往復回数の上限」だけを見ており、
  「1日1通まで」のような頻度そのものの制限はかけていない
  （連続で送ろうと思えば送れる）。
