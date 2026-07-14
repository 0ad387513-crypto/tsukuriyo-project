# 作業状況

更新日: 2026-07-14

対象ビルド: v1.15.93

運用プラン: Firebase Spark

公開URL: https://tsukuriyo-online.netlify.app/

## 実装・ローカル検証済み

- [x] Firebase匿名認証を前提としたUID・座席所有権検証
- [x] 手札・山札など秘密領域を共有盤面から除外
- [x] Realtime Databaseトランザクションによる盤面同期
- [x] ビルド一致、更新連番、前ハッシュ、状態ハッシュ検証
- [x] 再接続、操作ログ、再戦、観戦アクセス制御
- [x] 3分のターン制限と90秒の切断猶予
- [x] 公開ルームのページング、期限切れ除外、検索キャンセル
- [x] 診断JSON・公開対戦履歴JSONの保存
- [x] モバイル・キーボード・動きの軽減対応
- [x] 通常テスト47件
- [x] Database Rules Emulator統合テスト15件
- [x] 負荷・同期・セキュリティの自動テスト

## Sparkプランのため採用しない機能

- Cloud Functionsによるサーバー盤面確定、強制タイマー裁定、定期ルーム削除
- Functions向けApp Check強制
- 問題報告のサーバー自動保存
- サーバーだけが読める4人戦ドラフト正本

これらはBlazeプランまたは別の信頼できるバックエンドが必要です。`functions/` のコードは将来用として残しますが、本番では無効です。

## 本番・実機で確認する項目

- [x] Firebase CLIブラウザ認証
- [x] 一時互換Rulesを本番へ反映し、旧クライアントの動作を維持
- [x] Spark対応版Rulesを本番へ反映
- [x] v1.15.93をmainへpushし、GitHub Actions成功を確認
- [x] Netlifyでv1.15.93の公開を確認
- [x] Firebase Consoleで匿名認証が有効であることを実通信で確認
- [ ] iPhone Safari / Android Chromeで実機確認
- [ ] VoiceOver / TalkBackで実機確認

管理者カスタムクレームは、ストラクチャーデッキを本番で編集する管理者を追加するときだけ別途設定します。
