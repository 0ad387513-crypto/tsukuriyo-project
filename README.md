# tsukuriyo-project

ツクリヨのカード閲覧、デッキ構築、オンライン対戦用Webアプリです。現在の構成はFirebase Sparkプランで動作し、Cloud Functionsは使用しません。

## ローカル確認

```powershell
npm test
pnpm test:rules
```

画面はプロジェクト直下で静的サーバーを起動し、`http://localhost:8765/index.html` を開いて確認します。

## Firebase本番構成（Spark）

- Firebase匿名認証を使用します。Firebase Consoleの「Authentication」→「Sign-in method」で匿名認証を有効にしてください。
- Realtime Database Rulesは `database.rules.json` で管理します。
- Rulesは未認証アクセスを拒否し、UIDと座席所有権、ビルドバージョン、更新連番、前状態ハッシュ、値域を検証します。
- 盤面更新は認証済みの各クライアントがRealtime Databaseのトランザクションで行います。
- 手札と山札のカード内容は共有盤面へ含めず、相手と観戦者には枚数と公開領域だけを同期します。
- 4人戦のドラフト中データは、Spark構成上セッション参加者から読み取り可能です。完全なサーバー秘匿ドラフトにはCloud Functions等の信頼できるバックエンドが必要です。
- 問題報告は秘密情報を除外した診断JSONとして端末へ保存します。サーバーへの自動送信は行いません。
- ターン制限と切断猶予はクライアント間の同期処理で扱います。信頼できるサーバー時刻による強制裁定ではありません。
- 期限切れルームは一覧から除外し、参加クライアントが可能な範囲で削除します。定期サーバー清掃は行いません。
- `functions/` は将来Blazeへ移行する場合の任意実装で、Spark本番ではデプロイも呼び出しもしません。

Rulesだけを反映する場合は次を実行します。

```powershell
firebase deploy --only database --project tsukuriyo-7afe3
```

## オンライン対戦の主な安全策

- Firebase匿名認証とUID単位の座席所有権
- 入室時のトランザクションによる同時参加競合の防止
- ビルドバージョン一致確認
- 更新連番、前状態ハッシュ、状態ハッシュによる巻き戻し・同期ずれ検知
- 操作ログ、再接続、再戦、観戦者アクセス制御
- 3分のターン制限と90秒の切断猶予
- 公開ルーム一覧のカーソルページングと期限切れ除外
- モバイル表示、キーボード操作、動きの軽減設定
- 通常テストとFirebase Database Rules Emulator統合テスト

本番反映状況と外部確認項目は [REMAINING_WORK.md](REMAINING_WORK.md) を参照してください。
