# TOP用 横長タイトルロゴ

- `tsukuriyo-top-wordmark-1600x400.png`：納品用の改訂版。1600×400px、透過PNG（RGBA）。「ツクリヨ」を横組みの筆文字にし、下に `- RETURN TO THE LEGACIES -` を1行で配置。
- `preview-dark.png`：現在のメニューに近い暗い紺での見え方。下段は440×110px表示の確認。
- `generation.json`：改訂版の生成指示と参照元。`originals/wordmark-hyphens-generated.png` は改訂版の生成時の原寸画像。ハイフンのない旧版は `originals/wordmark-v1-1600x400.png` に保存。

タイトル画面の `ui_decorations/title-key-visual.webp` を字形と筆勢の参考にし、重なっている文字を横組みへ再描画しました。原画からの文字の切り抜きや完全な字形複製ではありません。龍・女性・円形紋章・左右の飾り線は入れていません。

## Claude Codeへの引き継ぎ

現時点では素材のみ作成し、ゲーム画面は変更していません。PCのTOP上端に配置する場合、まず横幅380〜480px程度で確認すると日本語と小さな英字の両方が読めます。背景は透過のまま使用してください。

ゲームへ組み込む際はAGENTS.mdの画像追加ルールに従い、元PNGを直接参照せず、`scripts/import_visual_asset.py` で表示用途に合うWebPへ圧縮し、出力されたハッシュ付きURLを参照してください。圧縮と参照変更に応じて `version.js` と必要な確認を更新してください。
