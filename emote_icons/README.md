# カミのエモートアイコン

対戦中のエモート（カミをドラッグ／右クリックして選ぶホイールと、吹き出し）で使う表情アイコン。

- 基本は1柱につき1枚のアトラス（3列×2行、各セル正方形、透過WebP）。ヤマタノオロチは仮面あり・素顔の2枚。ファイル名の末尾は内容のハッシュ（画像ルールの `atlas`：最大1600px・160KB以下）。
- コマの並びはゲームの `EMOTE_TYPES` と同じ：上段 あいさつ・賞賛・驚き ／ 下段 疑問・困惑・大見栄。
- 参照は `index.html` の `KAMI_EMOTE_ICONS`（カミ番号 → ファイル）。容量・寸法は `optimized_assets.json` の `import:emote_icons/…-emotes`。
- 対戦に入るときのロード画面で、両者のカミの分だけ読み込む（`_kamiVisualUrls`）。

## ヤマタノオロチの仮面あり版（2026-10-15）

- 仮面あり：`yamata-no-orochi-masked-emoteAtlas-6ea7c7906698.webp`（840×560・159668バイト）。通常時の6種に使用。お札なしの黒赤の龍面。
- 素顔：既存の `yamata-no-orochi-emoteAtlas-7a31cf6e15ee.webp` を保持。封印が0の時に使用。
- ホイールは自分の状態、吹き出しは話者側の状態で選ぶ。吹き出しを作った時点の版を記録し、後の封印変化で画像が途中から切り替わらないようにする。
- カミ図鑑では両版の計12種を確認可能。先読みは選択されたカミがヤマタノオロチの場合だけ2枚を読み込み、既存の同時読み込み上限を使用。
- 内蔵image_genで作成。参照画像・生成指示・元PNGは `../output/result-portraits-orochi-emotes-20261015/`。比較ページ：`http://localhost:8765/tools/orochi-emotes-preview.html`。

## 元の画像

ユーザー提供の `card-game-emote-icons-v3-transparent.zip`（512×512の透過PNG、10柱×6種）。ZIPのフォルダ番号はゲームのカミ番号と一部異なる（ZIPの05がアメノウズメ＝ゲームの6、06がオモイカネ＝5、08がツクヨミ＝9、09がアマテラス＝8）。

ZIPの表情とゲームのエモートの対応：

| ゲームのエモート | ZIPのファイル |
|---|---|
| あいさつ（greeting） | 01_greeting |
| 賞賛（praise） | 02_praise |
| 驚き（surprise） | 03_surprise |
| 疑問（taunt。台詞は挑発） | 05_smile |
| 困惑（confusion） | 04_confused |
| 大見栄（boast） | 06_victory |
