# 画像の差し替え手順

## TOP画面

TOP画面で実際に参照している画像は `top_mode_icons` 内のWebPです。

| メニュー | 差し替えるファイル |
| --- | --- |
| 創世決戦 | `top_mode_icons/genesis4p.webp` |
| 理念構築戦 | `top_mode_icons/construct2p-oblong.webp` |
| シールド戦 | `top_mode_icons/shield2p-oblong.webp` |
| カードリスト | `top_mode_icons/cardlist.webp` |

理念構築戦の推奨サイズは現在と同じ `1024×536px` です。新しい画像をWebPへ変換し、同じファイル名で上書きしてください。保管用の元画像も揃える場合は対応するPNGも同時に上書きします。PNGだけを変更しても画面には反映されません。

差し替え後はローカル画面で `Ctrl+Shift+R` を押し、ブラウザーキャッシュを無視して確認します。問題なければ画像をコミットしてpushします。

## 対戦画面のカミ画像

正方形イラストはリポジトリ内の `kami_illustrations` に格納します。

| カミNo | ファイル名 |
| --- | --- |
| 1 | `スサノオ.webp` |
| 2 | `ヤマトタケル.webp` |
| 3 | `オオクニヌシ.webp` |
| 4 | `タケミカズチ.webp` |
| 5 | `オモイカネ.webp` |
| 6 | `アメノウズメ.webp` |
| 7 | `ヒノカグツチ.webp` |
| 8 | `アマテラス.webp` |
| 9 | `ツクヨミ.webp` |
| 10 | `ヤマタノオロチβ.webp` |

推奨サイズは `512×512px`、形式はWebPです。初回だけ上記の名前で配置し、以後は同じファイルを上書きします。ファイル名を変更する場合だけ `kami_illustrations/manifest.json`も変更してください。

差し替え後は `Ctrl+Shift+R` でローカル画面を再読み込みします。本番反映には画像のコミットとpushが必要です。

## カード全体画像

変換元PNGは次のフォルダへ置きます。これらは容量が大きいため `.gitignore` 対象で、本番へは配信しません。

- 通常カード: `card_images_source/C001_カード名.png` ～ `C198_カード名.png`
- カミカード: `kami_card_images_source/K001_カミ名.png` ～ `K010_カミ名.png`

画面が参照するのは、軽量化済みの次のWebPです。

- 一覧用: `card_images/320/001.webp`、`kami_card_images/320/001.webp`
- 詳細・対戦用: `card_images/600/001.webp`、`kami_card_images/600/001.webp`

同じ番号の元PNGを差し替えた場合は320px版と600px版の両方を再生成します。アプリは軽量WebPを優先し、同梱されていない新規番号だけGoogle Drive画像へフォールバックします。
