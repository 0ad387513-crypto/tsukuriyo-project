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
- 画像・音声：`card_images/`、`kami_*`、`tutorial_guide/`、`bgm/`、`sfx/`、`voices/` など
- `kami_cutin/genesis-generation.json`：創世神技カットインの現行URL・生成指示・差し替え履歴（ユーザー提供画像は `mode: "user-provided image; ..."`、旧版は `previousRevisions` に残す）
- `tools/card-editor/`：カード編集室（ローカル専用。`npm run preview` 中に http://localhost:8765/tools/card-editor/ で開く。本番では `_redirects` で404）。使い方は同フォルダの README

## 画像を追加・差し替えるとき（ユーザー指定のルール。詳細は `AGENTS.md`）

- 元のPNG/JPEGを直接使わず、容量上限つきWebPに圧縮し、ファイル名に内容ハッシュ（sha256の先頭12桁）を付ける
  - `cutin`：1600×900・300KB以下 / `sprite`：最大720×720・120KB以下 / `atlas`：最大1600×1600・160KB以下 / `scene`：最大1600×1600・300KB以下
  - 画質82→62まで下げても収まらなければ、上限は緩めずに用途に合わせて解像度を見直す
- 正規の手順は `python scripts/import_visual_asset.py 元画像 --output 保存先.webp --profile 種類 --replace 旧URL`。旧URLの置換（ルート直下の html/js/css・`_headers`・`kami_cutin/preview.html`・`genesis-generation.json`）と `optimized_assets.json` への記録まで行う
- このPCには Python がないため、同じ規則を Node の画像ライブラリ sharp で再現して処理する（sharp はリポジトリに入れず、作業用フォルダに `npm i sharp` して使う。`optimized_assets.json` の項目名は `import:保存先（ハッシュなし）`）
- `tests/asset_contract.test.js` が、ハッシュと実際の中身の一致・容量上限・`bytes < sourceBytes` を検証する
- 画像の差し替えも変更なので `version.js` を上げる
- `card_images/`・`kami_card_images/`・`kami_illustrations/`・`voices/`・`bgm/`・`sfx/` の素材は本番で1年キャッシュし、ゲームは `asset_hashes.js`（中身の識別子の一覧）を使って URL に `?h=` を付けて読み込む。これらを追加・差し替えたら `npm run assets:hash`（`node scripts/build_asset_hashes.js`）で一覧を作り直す（古いままだと `npm test` が失敗し、本番では差し替えが届かない）。コードからこれらのフォルダを参照するときは必ず `assetUrl()` を通す。カード編集室で保存したカード画像は自動で一覧に反映される

## 確認方法

- テスト: `npm test`（Node の組み込みテスト機能を使う）。Rules のテストは `pnpm test:rules`（Java と Firebase Emulator が必要）
- 画面確認: `npm run preview` → http://localhost:8765/index.html（ポートは 8765 に固定）。ブラウザ画面では `.claude/launch.json` の `tsukuriyo-static` を使う

## 変更・公開のルール

- 画面や挙動を変えたら `version.js` のパッチ番号を1上げる（例: 1.15.187 → 1.15.188）
- コミットメッセージの形式: `feat: 〜 v1.15.188` / `fix: 〜 v1.15.188`（日本語、末尾にバージョン）
- `main` に push すると Netlify が自動で本番に公開し、GitHub Actions（`verify.yml`）がテストを実行する。**push はユーザーの確認を取ってから行う**
- ユーザーとのやりとりは日本語で行う
