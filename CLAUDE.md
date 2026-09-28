# ツクリヨ（tsukuriyo-project）

ツクリヨのカード閲覧・デッキ構築・オンライン対戦用のブラウザカードゲーム。ビルド工程のない静的サイトで、Firebase（Sparkプラン：匿名認証＋Realtime Database）を使う。

- 本番: https://tsukuriyo-online.netlify.app
- GitHub: `0ad387513-crypto/tsukuriyo-project`

## 最初に読むもの

- `HANDOFF_FROM_CLAUDE.md`：Codex との引き継ぎメモ。作業の前に読み、作業後は同じ形式で追記する
- `AGENTS.md`：Codex 側のルール（ローカル確認用URLなど）
- `REMAINING_WORK.md`、`IMAGE_REPLACEMENT.md`

## 構成

- `index.html`：アプリ本体（約3万行、Vue テンプレートとロジックを1ファイルに収めている）。編集するときは Grep で該当箇所を探してから、範囲を指定して読む
- `version.js`：`TSUKURIYO_BUILD_VERSION`。オンライン対戦ではバージョンが一致する必要がある
- `session.js`、`sync_core.js`、`firebase.js`：オンライン対戦の同期処理
- `construct_battle.js`、`shield_battle.js`、`pack_generator.js`、`divine_effects.js/.css`：モード・演出
- `effect_spec.json`：カード効果の定義
- `database.rules.json`：Realtime Database Rules（本番反映は `firebase deploy --only database --project tsukuriyo-7afe3`）
- `functions/`：将来の Blaze 移行用。Spark本番では使わない
- 画像・音声：`card_images/`、`kami_*`、`bgm/`、`sfx/`、`voices/` など

## 確認方法

- テスト: `npm test`（Node の組み込みテスト機能を使う）。Rules のテストは `pnpm test:rules`（Java と Firebase Emulator が必要）
- 画面確認: `npm run preview` → http://localhost:8765/index.html（ポートは 8765 に固定）。ブラウザ画面では `.claude/launch.json` の `tsukuriyo-static` を使う

## 変更・公開のルール

- 画面や挙動を変えたら `version.js` のパッチ番号を1上げる（例: 1.15.187 → 1.15.188）
- コミットメッセージの形式: `feat: 〜 v1.15.188` / `fix: 〜 v1.15.188`（日本語、末尾にバージョン）
- `main` に push すると Netlify が自動で本番に公開し、GitHub Actions（`verify.yml`）がテストを実行する。**push はユーザーの確認を取ってから行う**
- ユーザーとのやりとりは日本語で行う
