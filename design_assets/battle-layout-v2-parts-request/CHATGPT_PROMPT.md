# ChatGPT への依頼文（貼り付け用）

現状の説明・素材一覧・寸法は同じフォルダの `README.md` にあります。

## 使い方

- **Codex（このリポジトリを読める環境）で作る場合**：下の依頼文をそのまま貼る。生成指示は Codex がこのファイルから読む。
- **ChatGPTの画面で作る場合**：`README.md` と `reference/` の3枚を添付し、依頼文と、その素材の生成指示（英語）を貼る。
- 1回分が届いたら試作に組み込み、見え方を確かめてから次へ進む。

## 経緯：画風を変えて作り直す（2026-10-08）

初回のバッチ1（`design_assets/battle-layout-v2-parts-v1/`）を試作に組み込んだところ、ユーザーの判断で次の理由から画風を変えることになった。

- 全体が安っぽく見える。金がテカテカのグラデーションで、浮き彫りの立体感が強く、ゲームのアイコンにありがちな「金ピカ」になっている。
- 重厚な金具・丸い玉・家紋のような飾りは「水戸黄門みたい」で世界観に合わない。
- 日輪のギザギザの光条はクリップアートのように見える。
- マナの星は素材にせず、コードで描くひし形の四芒星に戻した（作らない）。

新しい方向は「黒漆に細い金線で描く、控えめな蒔絵」。金の量と艶を減らし、平らな塗りと細く均一な線、広い余白で上品に見せる。光らせる演出はゲーム側で「今押せるもの」だけに付けるので、素材そのものは光らせない。

## バッチ1・作り直しの依頼文（4点）

```text
ツクリヨの星戦画面（新しい配置の試作）の素材を、画風を変えて作り直してください。

作業前に次を読んでください。
- C:\Users\maekawa\dev\tsukuriyo-project\AGENTS.md
- C:\Users\maekawa\dev\tsukuriyo-project\design_assets\battle-layout-v2-parts-request\README.md（現状の説明・素材一覧・寸法）
- 同じフォルダの CHATGPT_PROMPT.md の「経緯」（作り直す理由と新しい方向）
- 初回の納品 design_assets\battle-layout-v2-parts-v1\（寸法・位置合わせ・納品の形式はこれと同じでよい。画風は参照しないこと）

作り直すのは次の4点です（マナの星は作りません）。
1. 日輪の円盤 sun-disc.png
2. 月輪の円盤 moon-disc.png
4. カミの窓の額縁 kami-frame.png
5. 神技の札（3状態） skill-tab-off.png / skill-tab-silver.png / skill-tab-gold.png

生成指示は CHATGPT_PROMPT.md の「生成指示」にあります。各指示の頭に新しい「共通の画風指定」を付けてください。最初に1を作り、2・4・5は1を画風の参照にしてください（2は1と外周の直径・縁の太さをそろえる）。
寸法・位置は初回と同じにしてください（円盤：720×720・円の直径664・中心360,360／額縁：720×576・窓 x53〜667・y63〜527／神技の札：360×108・中央に外形約348×96）。

納品のルール
- 保存先：design_assets\battle-layout-v2-parts-v2\（新しいフォルダ。初回のv1は消さずに残す）
- 本当の透過PNG。市松模様の描き込み・不透明な背景・床や台は不可。文字・数字・ロゴは入れない（表示はゲーム側で重ねる）
- 生成した原寸は originals\ に保存し、上の寸法へ切り出し・中央配置・縮小したものをフォルダ直下に置く
- preview.png：暗い背景（#0b0d14）の上に、画面での大きさ（README.md の表）と2倍で並べた確認画像。円盤は「ターン終了」（濃い文字）・「相手のターン」（白い文字）を明朝体で仮に重ねた見え方、額縁は既存のカミの絵を入れた見え方も入れる。初回（v1）と並べた比較も入れる
- validation.json：各ファイルの寸法・透過の有無・余白、円盤の直径と中心、額縁の窓の位置、神技の札の外形の位置
- prompts.json：最終的な生成指示と原画のパス
- README.md：一覧、各素材の使い方、Claude Code への引き継ぎ
- ゲーム本体（index.html など）は変更しない。WebP化・組み込み・version.js の更新は Claude Code が行う。コミット・push・デプロイはしない
```

## バッチ2の依頼文（優先度2・5点）

作り直したバッチ1を試作に組み込んで確かめてから依頼する。

```text
design_assets\battle-layout-v2-parts-request\ の README.md と CHATGPT_PROMPT.md（「経緯」を含む）を読み、優先度2の5点を作ってください。
6. 天力の紋 tenryoku-plate.png
7. 封印の紋 seal-plate.png（6と同じ形）
8. ライフの台座（御守りの形） life-plate.png
9. 黒漆の札 lacquer-plaque.png（横に伸ばして使う3分割の札）
10. 神攻力の丸 attack-medallion.png

design_assets\battle-layout-v2-parts-v2\ の sun-disc.png と kami-frame.png を画風の参照にしてください。
保存先は design_assets\battle-layout-v2-parts-v2\（同じフォルダに追加し、README.md・preview.png・validation.json・prompts.json を更新）。納品のルールはバッチ1と同じ。
validation.json には、台座の数字を置く無地の部分の中心と大きさ、黒漆の札の左右の飾りの幅（px）も記録してください。
```

## バッチ2・追加の依頼文（形の変更・4点）

バッチ2を組み込んだ結果、ユーザーの判断で次の形に変えることになった（2026-10-08）。
- 天力：八稜鏡 → **勾玉**（封印も同じ形で色違い）
- ライフ：御守り → **命の灯**（灯明の炎の形）。御守りは大きく見えて手札に重なった
- 神攻力：丸 → **ひし形**。丸はマナの丸・ワード効果の丸と紛れるため（今はコードで仮に描いたひし形を表示中）

```text
design_assets\battle-layout-v2-parts-request\ の README.md と CHATGPT_PROMPT.md（「経緯」と「バッチ2・追加」を含む）を読み、形を変えた4点を作ってください。
6b. 天力の紋（勾玉） tenryoku-magatama.png
7b. 封印の紋（勾玉・紅） seal-magatama.png（6bと同じ形）
8b. ライフ（命の灯） life-flame.png
10b. 神攻力のひし形 attack-diamond.png

design_assets\battle-layout-v2-parts-v2\ の sun-disc.png・kami-frame.png・lacquer-plaque.png を画風の参照にしてください（黒漆・細い金線・平らな箔。光沢・浮き彫り・光は付けない）。
保存先は design_assets\battle-layout-v2-parts-v2\（同じフォルダに追加し、README・preview・validation・prompts を更新）。納品のルールはバッチ1と同じ。
validation.json には、本体の外形と、数字を置く無地の部分の中心と大きさ（px）を記録してください。
preview には、実際の表示サイズ（天力・ライフ：高さ約62px、神攻力：約42px）で白い明朝体の数字を重ね、カミの額縁・場の札と並べた見え方を入れてください。
```

### 6b. 天力の紋（勾玉） `tenryoku-magatama.png`

- 生成：1024×1024 → 納品：256×256（本体の高さ約210px）
- カミの窓の左の縁の中ほど。勾玉の丸い頭の部分に天力の数を白い明朝体で重ねる。

```text
Create ONE badge plate shaped like a magatama (curved comma-shaped jewel) for the "Tenryoku" (divine power) counter, displayed at about 62px tall on the left edge of the kami window. A large white number is overlaid by code on the round head.
Canvas 1024x1024, the magatama about 840px tall, centered, upright, with a LARGE round head (about 70% of the width) at the top and a short tail curling down to the lower left.
Surface: flat, calm deep blue lacquer (#1E3F6E) with a faint lacquer texture; one hairline gold line along the outline. The head is plain (no hole, no pattern), because the number sits there.
Flat maki-e style. No shine, no glow, no bevel, no ornaments.
```

### 7b. 封印の紋（勾玉・紅） `seal-magatama.png`

- 生成：1024×1024 → 納品：256×256（6bと同じ位置・同じ大きさ）。6bを参照として添付する。

```text
Create ONE badge plate identical in shape, size and style to the attached magatama tenryoku plate. It replaces it for the kami Yamata-no-Orochi, whose counter is "seals".
The only difference: the surface is flat deep crimson lacquer (#5E1520).
```

### 8b. ライフ（命の灯） `life-flame.png`

- 生成：1024×1024 → 納品：256×256（本体の高さ約220px）
- カミの窓の右の縁の中ほど。炎のふくらんだ下の部分に「10/10」のようなライフを白い明朝体で重ねる。天力の勾玉と同じくらいの大きさに見えること。

```text
Create ONE badge plate shaped like the flame of a Japanese oil lamp (tomoshibi), meaning "the light of life", for the LIFE counter, displayed at about 62px tall on the right edge of the kami window. A white number such as "10/10" is overlaid by code on the wide lower part.
Canvas 1024x1024, the flame about 860px tall, centered, upright: a calm teardrop silhouette with a softly pointed tip and a wide, round lower body (about 75% of the height is the round body).
Surface: flat, deep crimson lacquer (#7A1E26) with a slightly lighter warm center, one hairline gold line along the outline, and one thin inner gold line following the tip. The lower body is plain for the number.
Flat maki-e style. No real fire, no glow, no shine, no bevel.
```

### 10b. 神攻力のひし形 `attack-diamond.png`

- 生成：1024×1024 → 納品：160×160（本体136×136）
- 場のレガシーの右上。ひし形の中央に神攻力の数を白い明朝体で重ねる（左上には属性の色のマナの丸、上の中央にはワード効果の丸が付く）。

```text
Create ONE small diamond-shaped badge (a square rotated 45 degrees) placed behind the "divine attack" number at the top-right corner of field cards, displayed at about 42px.
Canvas 1024x1024, the diamond about 860px from tip to tip, centered.
Matte black lacquer with one hairline gold line along the outline and a second, fainter hairline gold line inset a little inside it; tiny flat gold accents only at the four tips. Plain black center for a white number. It must stay recognizable at 42px.
No shine, no glow, no bevel.
```

## カミの額縁・細くする作り直しの依頼文（1点）

v2の額縁（`kami-frame.png`）を組み込んだところ、ユーザーの判断で「枠が太すぎてしっくり来ない」となった（2026-10-08）。
帯が窓の外へ約2.6vh張り出し、相手・自分のレガシーの段に重なりかけていた（今はカミの窓を少し小さくして避けている）。

```text
design_assets\battle-layout-v2-parts-request\ の README.md と CHATGPT_PROMPT.md（「経緯」と「カミの額縁・細くする作り直し」を含む）を読み、カミの窓の額縁を細く作り直してください。
4b. カミの窓の額縁（細い版） kami-frame-slim.png

今のv2の design_assets\battle-layout-v2-parts-v2\kami-frame.png を土台にし、画風（黒漆・細い金線・霞の線画）は変えずに、帯を細くしてください。
- 窓（透明部分）の位置と形は今と同じ：720×576 の中の x53〜667・y63〜527、上側がアーチ。人物を切り抜くマスクもv2と同じ形でよい
- 帯（窓の縁から外側の縁まで）の太さを今の半分以下に。外側の輪郭は窓の輪郭に沿わせ、キャンバスの余白が増えてよい
- 上のアーチの頂点と下の角の霞の飾りは小さく残す。左右の中ほど（天力・ライフが重なる）と下の中央（神技の札が重なる）は無地
- 相手は上下反転して使う

保存先は design_assets\battle-layout-v2-parts-v2\（同じフォルダに追加）。納品のルールはバッチ1と同じ。
validation.json に、帯の外側の輪郭の位置（上下左右のpx）を記録してください。preview には今の kami-frame.png と並べた比較と、既存のカミの絵を入れた見え方を入れてください。
```

## バッチ3の依頼文（優先度3・3点）

```text
design_assets\battle-layout-v2-parts-request\ の README.md と CHATGPT_PROMPT.md（「経緯」を含む）を読み、優先度3の3点を作ってください。
11. タップの印 tap-mark.png
12. ワード効果の紋6種（SVG）：守護・死角・呪殺・奇襲・疾駆・拘束
13. 左上の丸ボタンの台座 round-button-base.png

design_assets\battle-layout-v2-parts-v2\ の素材を画風の参照にしてください。
保存先と納品のルールはバッチ2と同じ。12は画像生成ではなくSVGで作ります（下の「12」を参照）。
```

## バッチ4の依頼文（見直し・追加・6点）

バッチ1〜3を組み込んだ画面を見て、ユーザーの判断で次を作ることになった（2026-10-08）。

- 神攻力のひし形・戦闘力の札が黒漆で、ワード効果の黒い丸とかぶって見分けにくい。神攻力＝藍、戦闘力＝弁柄（赤茶）の漆に変え、金の縁を少し太くする。今は素材の黒い部分だけを塗り替えた仮の版を表示中。ターン数の札は黒漆のまま。
- ワード効果の紋は、守護など一部が何の紋かわかりにくい。
- 場の札・手札のマナ（コスト）の丸と、山札・墓地・崩壊のアイコンも同じ画風で作る。
- 任意の素材は星図だけ作る（霧・ひよこは作らない）。

```text
design_assets\battle-layout-v2-parts-request\ の README.md と CHATGPT_PROMPT.md（「経緯」と「バッチ4」を含む）を読み、バッチ4の6点を作ってください。
17. 神攻力のひし形・藍 attack-diamond-indigo.png（10bの色と縁の太さを変えた版）
18. 戦闘力の札・弁柄 power-plaque-bengara.png（9の色と縁の太さを変えた版。3分割で横に伸ばす決まりは同じ）
19. ワード効果の紋6種の作り直し（SVG）：守護・死角・呪殺・奇襲・疾駆・拘束
20. マナの丸の縁 mana-ring.png（属性の色の丸の上に重ねる金の輪。中は透明）
21. 山札・墓地・崩壊のアイコン3種（SVG）
14. 渾天儀の背面の星図 orrery-star-chart.png

design_assets\battle-layout-v2-parts-v2\ の素材を画風の参照にしてください（黒漆・細い金線・平らな箔。光沢・浮き彫り・光は付けない）。
保存先は design_assets\battle-layout-v2-parts-v2\（同じフォルダに追加）。納品のルールはバッチ1と同じ。17・18・20 は今の素材と同じキャンバス・本体の位置にそろえ、validation.json に記録してください。
preview には、実際の大きさで場の札（左上にマナの丸、上の中央にワード効果、右上に神攻力、下の中央に戦闘力）に並べた見え方と、今の版との比較を入れてください。
```

### 17. 神攻力のひし形・藍 `attack-diamond-indigo.png`

- 生成：1024×1024 → 納品：160×160（本体136×136、10bと同じ位置）
- 場の札の右上。中央に白い明朝体の数字。

```text
Create ONE small diamond-shaped badge (a square rotated 45 degrees), the same shape and size as the attached black diamond badge, displayed at about 42px at the top-right corner of field cards. A white number is overlaid by code.
Canvas 1024x1024, the diamond about 860px from tip to tip, centered.
Surface: flat, matte deep indigo lacquer (#22346A). Border: a clearly visible gold line along the outline, about TWICE as thick as the attached version, plus one fine inner gold line. Tiny flat gold accents only at the four tips. Plain center for the number.
No shine, no glow, no bevel.
```

### 18. 戦闘力の札・弁柄 `power-plaque-bengara.png`

- 生成：1536×1024 → 納品：480×160（左右72pxずつが飾り、その間は横に伸ばしても同じ見た目。9と同じ）
- 場の札の下の中央。白い明朝体の数字。ターン数の札は黒漆のまま使うので、この札は戦闘力専用。

```text
Create ONE slim horizontal name plate (fuda), the same shape as the attached black plaque, used behind the battle-power number at the bottom center of field cards, displayed at about 80x28px.
Canvas 1536x1024, plaque about 1350x450px, centered.
Surface: flat, matte bengara (deep red-brown iron-oxide) lacquer (#7A2A1C). Border: a clearly visible gold line along the outline, about TWICE as thick as the attached version; the left and right ends are simple, softly rounded notches outlined by the same line.
IMPORTANT: between the two ends the plaque must be perfectly uniform from left to right (no ornament, no left-to-right change), because it is stretched horizontally as a 3-slice image. Plain center for white numbers.
No shine, no glow, no bevel.
```

### 19. ワード効果の紋6種の作り直し（SVG）

画像生成ではなくSVGで作る。前回の版は、守護など一部が何を表すのかわかりにくかった。和風の雰囲気より、ひと目で意味がわかることを優先する。

```text
ワード効果6種の紋を、意味がひと目でわかる形にSVGで作り直してください：守護・死角・呪殺・奇襲・疾駆・拘束。
- 場のレガシーの上の中央に、黒い丸（32px・ゲーム側で描く）の中の約22pxで表示する。currentColor の単色SVG、viewBox 0 0 24 24、線は太め（2〜2.2）、20pxで見分けられる形。塗りを使ってもよい。
- 案（よりわかりやすい形があれば変えてよい。理由をREADMEに書く）
  - 守護（相手の戦闘・神攻の宣言時に、このレガシーをタップして攻撃先を自分に変えさせる＝かばう）：正面から見た盾（和風なら木の置き盾）。いちばんわかりやすい形にする
  - 死角（死角を持たないレガシーからは戦闘の攻撃対象に選ばれない＝見つからない）：閉じかけた目に斜線
  - 呪殺（戦闘した相手を破壊する）：藁人形に釘
  - 奇襲（出たターンから戦闘できる）：斜めに飛ぶ苦無（くない）と短い勢いの線
  - 疾駆（出たターンから戦闘と神攻ができる）：駆ける足または蹄と、風を切る流線
  - 拘束（タップされ、次の相手ターン終了時までアンタップできない＝縛られる）：縄で巻かれた輪、または錠
- 6種を並べたときに太さ・大きさ・余白がそろっていること。前回の版（guard.svg など）と並べた比較を preview に入れる。
- 納品：guard.svg / blindspot.svg / cursekill.svg / surprise.svg / dash.svg / bind.svg（前回の版は -v1 を付けて残す）と、各PNG（128×128・透過）
```

### 20. マナの丸の縁 `mana-ring.png`

- 生成：1024×1024 → 納品：128×128
- 場の札の左上（直径約36px）と手札の左上（直径約29px）に出る、カードの属性の色（赤・青・緑・黄・紫・無・創＝5色の虹）の丸に重ねる。色はゲーム側で塗るので、素材は縁だけ（中は透明）。中央に白い明朝体の数字。

```text
Create ONE thin circular ring frame to be placed over a colored circle (the circle's color is drawn by code and changes by card attribute: red, blue, green, yellow, purple, grey, or a five-color rainbow). Displayed at about 30-36px.
Canvas 1024x1024, ring outer diameter about 900px, centered. The ring is a gold line about 5% of the diameter thick, with a fine dark lacquer line just inside it and four tiny flat gold notches at the top, bottom, left and right. The inside of the ring is FULLY TRANSPARENT (the colored circle shows through). Outside the ring is fully transparent.
Flat maki-e style. No shine, no glow, no bevel.
```

### 21. 山札・墓地・崩壊のアイコン3種（SVG）

画像生成ではなくSVGで作る。左下（自分）と右上（相手）の枚数の欄で、数字の左に約22pxで出す。今は `design_assets/battle-ui-icons-semantic-v3/` のアイコンを、デッキ #b9d9f2・墓地 #d8c6e8・崩壊 #e7b6ae の色で使っている。

```text
山札・墓地・崩壊のアイコンを、今の画面の素材（黒漆と細い金線、ワード効果の紋）と同じ画風でSVGで作ってください。
- currentColor の単色SVG、viewBox 0 0 24 24、線の太さはワード効果の紋とそろえる。20pxで見分けられる形。
- 山札：伏せて重ねた札の束（裏面の円の模様を小さく）
- 墓地：和式の墓標（石塔）。西洋の墓石や十字は避ける
- 崩壊（ゲームから取り除かれる）：端から崩れて粒になって消えていく札
- 既存の design_assets\battle-ui-icons-semantic-v3\（deck・graveyard・crumble）の意味を引き継ぎ、今の画風に合わせて形を整える。並べた比較を preview に入れる。
- 納品：deck.svg / graveyard.svg / crumble.svg と、各PNG（128×128・透過）
```

### 14. 渾天儀の背面の星図

下の「生成指示」の14をそのまま使う（不透明度35%ほどで、右の列の円盤の後ろに敷く）。

## バッチ5の依頼文（山札・墓地・崩壊の作り直し、神攻力・戦闘力の焦茶・3点）

バッチ4を組み込んだ画面を見て、ユーザーの判断で次を作ることになった（2026-10-08）。

- 山札・墓地・崩壊のアイコン（バッチ4の21）は、細い線のピクトグラムで、黒漆と蒔絵の画面全体の雰囲気からずれている。雰囲気から作り直す。今の画面では、枚数の欄を黒漆の札に細い金の縁・金の区切り線にし、アイコンをくすんだ金（#d4b876）で表示している。
- 神攻力の藍・戦闘力の弁柄は、青・赤のマナの色と紛れる。両方を焦茶（#4E3422 前後）の漆にそろえる。今は素材の色の部分だけを塗り替えた仮の版を表示中。ライフ（命の灯）は紅のまま。天力の勾玉（青）も変えない。

```text
design_assets\battle-layout-v2-parts-request\ の README.md と CHATGPT_PROMPT.md（「経緯」と「バッチ5」を含む）を読み、バッチ5の3点を作ってください。
22. 山札・墓地・崩壊のアイコン3種の作り直し：deck-icon.png / graveyard-icon.png / crumble-icon.png
23. 神攻力のひし形・焦茶 attack-diamond-umber.png（17と同じ形・同じ縁の太さで色だけ焦茶）
24. 戦闘力の札・焦茶 power-plaque-umber.png（18と同じ形・同じ縁の太さで色だけ焦茶。3分割で横に伸ばす決まりも同じ）

design_assets\battle-layout-v2-parts-v2\ の素材を画風の参照にしてください（黒漆・細い金線・平らな箔。光沢・浮き彫り・光は付けない）。
保存先は design_assets\battle-layout-v2-parts-v2\（同じフォルダに追加し、前の版は -v1 などを付けて残す）。納品のルールはバッチ1と同じ。23・24 は今の素材と同じキャンバス・本体の位置にそろえ、validation.json に記録してください。
preview には、実際の大きさで、今の枚数の欄（黒漆の札に細い金の縁、数字は明朝体の生成り）に並べた見え方と、バッチ4の線画の版との比較、場の札に並べた神攻力・戦闘力（マナの各色の丸と並べて紛れないこと）を入れてください。
```

### 22. 山札・墓地・崩壊のアイコン3種の作り直し

- 生成：1536×1024（3つを横に並べた1枚、または1つずつ1024×1024）→ 納品：各128×128（透過PNG）
- 左下（自分）と右上（相手）の枚数の欄で、数字の左に約22pxで出す。欄は黒漆の札に細い金の縁。
- 細い線のピクトグラムではなく、日輪・額縁・神技の札と同じ「蒔絵の金」の小さな紋として描く。小さくても形がわかることを最優先。

```text
Create a set of THREE small emblem icons for a card game's zone counters, in the same flat maki-e gold style as the attached sun disc and kami frame. They are displayed at about 22px on a black lacquer plate, next to a number.
Each icon is drawn in muted gold leaf (#C9A862) with flat fills and a faint leaf texture (not thin outlines), compact silhouettes, no background (transparent), no text.
1. DECK: a neat stack of three face-down cards seen slightly from the front, the top card showing a small circle emblem (like the card back).
2. GRAVEYARD: a Japanese stone grave marker (a small stupa-like stone pillar on a two-step base). Avoid Western tombstones and crosses.
3. CRUMBLE (removed from the game): a single card whose right edge breaks apart into a few small square fragments drifting away.
All three share the same visual weight, size and gold tone, so they look like one set side by side.
Canvas 1536x1024, the three icons in a row, each about 360px tall, centered in thirds, with clear transparent space between them.
No shine, no glow, no bevel, no outline-only drawing.
```

### 23. 神攻力のひし形・焦茶 `attack-diamond-umber.png`

- 生成：1024×1024 → 納品：160×160（本体136×136、17と同じ位置）

```text
Create ONE small diamond-shaped badge identical in shape, size and gold border to the attached indigo diamond badge, displayed at about 42px at the top-right corner of field cards. A white number is overlaid by code.
Only the color changes: the surface is flat, matte dark umber (burnt brown) lacquer (#4E3422), clearly different from red, blue, green, yellow, purple and grey.
No shine, no glow, no bevel.
```

### 24. 戦闘力の札・焦茶 `power-plaque-umber.png`

- 生成：1536×1024 → 納品：480×160（左右72pxずつが飾り、その間は横に伸ばしても同じ見た目。18と同じ）

```text
Create ONE slim horizontal name plate identical in shape, size and gold border to the attached bengara plaque, used behind the battle-power number at the bottom center of field cards, displayed at about 80x28px.
Only the color changes: the surface is flat, matte dark umber (burnt brown) lacquer (#4E3422), clearly different from red, blue, green, yellow, purple and grey.
IMPORTANT: between the two ends the plaque must be perfectly uniform from left to right, because it is stretched horizontally as a 3-slice image. Plain center for white numbers.
No shine, no glow, no bevel.
```

## 任意の素材（全体を見てから判断）

```text
design_assets\battle-layout-v2-parts-request\ の README.md と CHATGPT_PROMPT.md（「経緯」を含む）を読み、任意の素材のうち次を作ってください：（14 渾天儀の背面の星図／15 境目の霧／16 召喚酔いのひよこ から選ぶ）
保存先と納品のルールはバッチ2と同じ。
```

## 共通の画風指定（各生成指示の頭に付ける）

```text
UI part for "Tsukuriyo", a Japanese dark-fantasy browser card game. World: a night-time Shinto shrine realm of kami (gods); a match is called a "star battle".
Style: refined Japanese lacquerware with restrained maki-e. Matte, deep black urushi lacquer (#0B0A08) as the main surface; decoration drawn with fine, even, thin gold lines and small flat areas of muted gold leaf (#B8975A, never bright yellow) with a subtle irregular leaf texture. Flat, quiet, elegant, generous negative space. Think of Heian-era lacquer boxes, the flat design of bronze mirror backs (wakyo) and Rinpa-school restraint.
The player's side uses muted gold and the sun; the opponent's side uses muted silver leaf (#AEB8C8) and the moon.
Straight-on front view, no perspective tilt. Genuine transparent alpha background: no checkerboard pattern, no backdrop, no floor or stand. No text, letters, kanji, numbers, logos or watermark (labels and numbers are overlaid later by code). No glow, no drop shadow (the game adds them only when needed).
Strictly avoid: glossy or chrome-like metal, shiny gradients, 3D bevels and embossing, heavy brass fittings, knobs, round jewels or gems, family crests (kamon), anything resembling an inro or a samurai-drama prop, sunburst clip-art spikes, Western heraldry, thick ornate borders, neon or sci-fi elements.
```

## 生成指示（素材ごと）

生成できる画像の大きさは 1024×1024・1536×1024・1024×1536 のいずれか。生成後に「納品」の寸法へ切り出して縮小する。

### 1. 日輪の円盤 `sun-disc.png`

- 生成：1024×1024 → 納品：720×720（円の直径664・中心360,360。初回と同じ）
- ゲームでは中央に「ターン終了」を濃い色の明朝体で重ねる。押せるときだけゲーム側で控えめに光らせる。押せないときはゲーム側で灰色にする。

```text
Create ONE round "nichirin" (sun) disc used as the END TURN control during the player's turn, displayed at about 200px.
Canvas 1024x1024. A perfect circle, centered, about 900px in diameter; everything outside the circle is fully transparent.
Design it like the flat back of an ancient Japanese bronze mirror rendered as maki-e lacquer:
- Center field (about 55% of the diameter): a calm, flat area of muted gold leaf with only a faint leaf texture, no pattern, because a dark two-word label is placed on it.
- Around it: one or two hairline gold rings, then a band of very fine, evenly spaced, short radial hairlines (like engraved sun lines on a mirror back) on black lacquer. Delicate lines, not spikes or triangles.
- Outer edge: a slim matte black-lacquer rim with a single hairline of gold.
Quiet, dignified, flat. No shine, no glow, no bevel.
```

### 2. 月輪の円盤 `moon-disc.png`

- 生成：1024×1024 → 納品：720×720（1と同じ位置・同じ直径）
- 1を画風と大きさの参照として添付する。ゲームでは中央に「相手のターン」を白い明朝体で重ねる。手番が変わると1と裏返って入れ替わる。

```text
Create ONE round "gachirin" (moon) disc that pairs with the attached sun disc (same outer diameter, same rim, same line weight and the same flat maki-e style). It is shown during the OPPONENT's turn, displayed at about 200px.
Canvas 1024x1024, circle about 900px in diameter, centered; everything outside the circle is fully transparent.
Inside the rim: a matte deep indigo-black lacquer field (#12182A). A slim crescent moon along the LEFT side made of flat, muted silver leaf (#AEB8C8) with a faint leaf texture, plus one hairline silver ring echoing the sun disc's ring, and a few tiny silver dots as stars near the edge.
Keep the center and the right half dark and plain, because a white label is placed in the center.
Rim: slim matte black lacquer with a single hairline of silver.
Quiet, cool, flat. No shine, no glow, no bevel.
```

### 3. マナの星（作らない）

コードで描くひし形の四芒星に決定。素材は作らない。

### 4. カミの窓の額縁 `kami-frame.png`

- 生成：1536×1024 → 納品：720×576（初回と同じく、窓の透明部分を x53〜667・y63〜527 に合わせる）
- 自分のカミの窓（上側がアーチ）に重ねる。相手は上下反転して使う。窓の左右の中ほどに天力の紋とライフ、下の中央に神技の札が重なる。

```text
Create ONE slim frame for a kami (god) portrait window, displayed at about 315x240px. The frame is drawn over the portrait, so the window must be fully transparent.
Canvas 1536x1024. The frame's outer outline is a landscape shape about 1250x1000px, centered.
Window (transparent) shape: the TOP edge is a gentle arch rising toward the center (arch height about 24% of the window height); the sides are straight; the bottom edge is straight with small rounded corners.
Frame band: SLIM, about 3% of the frame width - matte black lacquer with one hairline gold line along the inner edge and one along the outer edge.
Decoration: very little. Only small, flat maki-e motifs drawn in fine gold line - a short trailing mist band (kasumi) at the top of the arch and a small mist motif at each bottom corner. No metal fittings, no knobs, no round ornaments, no jewels, no crests.
Keep the middle of the LEFT and RIGHT sides plain (round badges overlap there) and keep the bottom center plain (a tab button overlaps there).
The opponent uses a vertically flipped copy, so the design must also look natural upside down.
Quiet, elegant, flat. No shine, no glow, no bevel.
```

### 5. 神技の札（3状態） `skill-tab-off.png` / `skill-tab-silver.png` / `skill-tab-gold.png`

- 生成：1536×1024（3段）→ 納品：各360×108（中央に外形約348×96。初回と同じ）
- 自分のカミの窓の下の縁の中央に付く。中央に「神技」の文字をゲーム側で明朝体で重ねる（使えない＝明るい灰の文字、銀・金＝濃い文字）。
- 使えない＝黒漆、神技が使える＝銀、創世神技が使える＝金（今のゲームの色分けと同じ）。使えるときの光はゲーム側で付ける。

```text
Create a sheet of THREE slim plaques for the "Shingi" (god skill) button tab, displayed at about 120x36px under the player's kami window.
Canvas 1536x1024, three rows; each plaque about 1200x340px, centered horizontally, with clear transparent space between the rows. All three have exactly the same simple shape: a slim rectangle with small, softly rounded-notch ends (no curly scrolls). The middle 70% is plain (a two-character label is added by code).
Row 1, cannot use: matte black lacquer with one hairline gold border.
Row 2, god skill usable: flat, matte silver leaf (#AEB8C8) with a faint leaf texture and a hairline darker border.
Row 3, genesis skill usable: flat, matte muted gold leaf (#B8975A) with a faint leaf texture and a hairline darker border.
No shine, no glow, no bevel.
```

### 6. 天力の紋 `tenryoku-plate.png`

- 生成：1024×1024 → 納品：256×256
- カミの窓の左の縁の中ほど。中央に天力の数を白い明朝体で重ねる。

```text
Create ONE round badge plate for the "Tenryoku" (divine power) counter, displayed at about 70px on the left edge of the kami window. A large white number is overlaid by code.
Canvas 1024x1024, plate about 820px across, centered.
Shape: an eight-lobed mirror outline (hachiryo-kyo) - a circle with eight gentle lobes - in matte black lacquer with one hairline gold line along the edge.
Inner circular field (about 64% of the diameter): flat, calm deep blue lacquer (#1E3F6E), no pattern.
Flat maki-e style. No shine, no glow, no bevel, no ornaments.
```

### 7. 封印の紋 `seal-plate.png`

- 生成：1024×1024 → 納品：256×256（6と同じ位置・同じ大きさ）
- ヤマタノオロチは天力の代わりに封印の数を出す。6を参照として添付する。

```text
Create ONE badge plate identical in shape, size and style to the attached tenryoku plate. It replaces it for the kami Yamata-no-Orochi, whose counter is "seals".
The only difference: the inner field is flat deep crimson lacquer (#5E1520).
```

### 8. ライフの台座（御守りの形） `life-plate.png`

- 生成：1024×1024 → 納品：256×256（縦長の形を中央に）
- カミの窓の右の縁の中ほど。中央に「10/10」のようなライフを白い明朝体で重ねる。
- 盾の形にしたい場合は、1行目と3行目を「a badge with rounded top corners and a softly pointed bottom」に差し替える。

```text
Create ONE badge plate for LIFE shaped like a Japanese omamori charm, displayed at about 70x80px on the right edge of the kami window. A large white number (for example "10/10") is overlaid by code.
Canvas 1024x1024; the charm is upright, about 790px wide and 900px tall, centered.
Silhouette: the classic omamori shape with a gently pointed top and a small knotted cord at the top.
Body: flat, matte deep crimson (#7A1E26) with only a hairline gold border and a faint woven texture near the edge.
The central area is plain and slightly darker so the number stays readable. No writing on the charm.
Flat maki-e style. No shine, no glow, no bevel.
```

### 9. 黒漆の札 `lacquer-plaque.png`

- 生成：1536×1024 → 納品：480×160（左右の端72pxずつが飾り、その間は横に伸ばしても同じ見た目）
- 戦闘力（場の札の下の中央）とターン数（円盤の上の縁）の両方に、横に伸ばして使う。

```text
Create ONE slim horizontal name plate (fuda) used behind numbers such as battle power and the turn number, displayed at about 80x28px to 100x30px.
Canvas 1536x1024, plaque about 1350x450px, centered.
Matte black lacquer with one hairline gold border; the left and right ends are simple, softly rounded notches outlined by the same hairline.
IMPORTANT: between the two ends the plaque must be perfectly uniform from left to right (no central ornament, no left-to-right change), because it will be stretched horizontally as a 3-slice image. Plain center for white numbers.
No shine, no glow, no bevel.
```

### 10. 神攻力の丸 `attack-medallion.png`

- 生成：1024×1024 → 納品：160×160
- 場のレガシーの右上。中央に神攻力の数を白い明朝体で重ねる（左上には属性の色のマナの丸が付く）。

```text
Create ONE small round medallion placed behind the "divine attack" number at the top-right corner of field cards, displayed at about 36px.
Canvas 1024x1024, medallion about 820px across, centered.
Matte black lacquer disc with one hairline gold ring near the edge and a tiny arrow-fletching (yabane) mark drawn in fine gold line at the top inside the ring. Plain black center for a white number. It must stay recognizable at 36px.
No shine, no glow, no bevel.
```

### 11. タップの印 `tap-mark.png`

- 生成：1024×1024 → 納品：192×192
- タップ状態の札（レガシー・レリック）の絵を暗くした上の中央に出す。

```text
Create ONE icon meaning "tapped / already used", shown at about 60px in the center of a darkened card illustration.
Canvas 1024x1024, icon about 760px, centered.
A single clockwise circular arrow (about a 300-degree arc ending in an arrowhead), drawn as a confident brush stroke in pale cream (#EDE3CC) with a thin dark outline. No glow, no background.
```

### 12. ワード効果の紋6種（SVG）

画像生成ではなく、SVGで作る（色をゲーム側で変えられ、小さくても線がつぶれないため）。

```text
ワード効果6種の紋をSVGで作ってください：守護・死角・呪殺・奇襲・疾駆・拘束。
- 場のレガシーの上の中央に、黒い丸（32px・ゲーム側で描く）の中の約22pxで表示する。currentColor の単色SVG、viewBox 0 0 24 24、線は太め、20pxで見分けられる形。
- 既存の試作 design_assets\battle-resource-keyword-icons-trial\（guard・blindspot・cursekill・bind）を土台に形をそろえ、足りない「奇襲」「疾駆」を同じ画風で追加する。
  - 奇襲（出たターンから戦闘できる）の案：斜めに振り下ろす刃と小さな閃き
  - 疾駆（出たターンから戦闘と神攻ができる）の案：風を切る流線と矢じり
- 色はゲーム側で付ける（今の色：守護 #cfe0ff、死角 #fff3cf、呪殺 #ffb0b0、奇襲 #ffe27a、疾駆 #b8ffcf、拘束 #c9a26a）。
- 納品：guard.svg / blindspot.svg / cursekill.svg / surprise.svg / dash.svg / bind.svg と、各PNG（128×128・透過）、preview.png（20・24・32pxと、黒い丸の中に置いた見え方）
```

### 13. 左上の丸ボタンの台座 `round-button-base.png`

- 生成：1024×1024 → 納品：192×192
- 設定（歯車）とバトルログの金色のアイコン（既存）を上に重ねる。

```text
Create ONE round base for small UI buttons (settings and battle log), displayed at about 48px; an existing gold line icon is placed on top by code.
Canvas 1024x1024, disc about 820px across, centered. Matte black lacquer disc with one hairline gold ring near the edge, plain center. No icon on it.
No shine, no glow, no bevel.
```

### 14. 渾天儀の背面の星図（任意） `orrery-star-chart.png`

- 生成：1024×1024 → 納品：720×720
- 右の列の円盤の後ろに、薄く（不透明度35%ほど）敷く。

```text
Create ONE faint circular star chart to sit behind the sun/moon disc of a star-observing instrument (armillary sphere). Style reference: the ancient Japanese Kitora tomb astronomical chart.
Canvas 1024x1024, chart about 960px across, centered. Thin muted-gold lines only, on a transparent background: three concentric circles (inner, equator, outer), a slightly offset ecliptic circle, and small dot-and-line constellations scattered inside. Very low contrast and delicate (it will be shown at about 35% opacity), no fill, no text.
```

### 15. 境目の霧（任意） `mist-band.png`

- 生成：1536×1024 → 納品：1600×400（取り込みは scene）
- 相手のレガシーの段と自分のレガシーの段の間に重ね、線を引かずに境目を感じさせる。

```text
Create ONE soft horizontal mist band, used between the two rows of field cards to suggest the border between the two sides without drawing a line.
Canvas 1536x1024. White with a faint blue tint, translucent, fading smoothly to fully transparent toward the top, the bottom and both the left and right ends; the band occupies roughly the middle third vertically. No hard edges, no shapes, no text.
```

### 16. 召喚酔いのひよこ（任意） `piyo.png`

- 生成：1024×1024 → 納品：128×128
- 召喚酔いのレガシーの頭の上を3羽で回る（今は絵文字🐥。端末によって絵が変わるため置き換え候補）。

```text
Create ONE tiny chick (hiyoko) icon used to show "summoning sickness"; three of them circle above a card, each displayed at about 16px.
Canvas 1024x1024, chick about 700px, centered. A round, simple yellow chick in side view, small orange beak, simple dark eye, thin dark outline, flat colors. Cute but simple enough to read at 16px.
```
