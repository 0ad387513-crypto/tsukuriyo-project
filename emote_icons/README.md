# カミのエモートアイコン

対戦中のエモート（カミをドラッグ／右クリックして選ぶホイールと、吹き出し）で使う表情アイコン。

- 1柱につき1枚のアトラス（3列×2行、1コマ160×160、透過WebP）。ファイル名の末尾は内容のハッシュ（画像ルールの `atlas`：最大1600px・160KB以下）。
- コマの並びはゲームの `EMOTE_TYPES` と同じ：上段 あいさつ・賞賛・驚き ／ 下段 疑問・困惑・大見栄。
- 参照は `index.html` の `KAMI_EMOTE_ICONS`（カミ番号 → ファイル）。容量・寸法は `optimized_assets.json` の `import:emote_icons/…-emotes`。
- 対戦に入るときのロード画面で、両者のカミの分だけ読み込む（`_kamiVisualUrls`）。

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
