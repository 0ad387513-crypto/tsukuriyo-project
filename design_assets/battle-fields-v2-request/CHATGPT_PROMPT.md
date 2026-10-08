# ChatGPT への依頼文（貼り付け用）

現状の説明・問題点・新しい方向・制約は同じフォルダの `README.md` にあります。

## 使い方

- **Codex（このリポジトリを読める環境）で作る場合**：下の依頼文をそのまま貼る。
- **ChatGPTの画面で作る場合**：`README.md`・`reference/layout-guide.png`・`reference/current-fields.jpg` を添付し、依頼文と、その舞台の生成指示（英語）を貼る。
- まず試作の2枚（忍者の隠れ里・侍の城）で画風を確かめ、良ければ残りの4枚へ進む。

## 最新：つるつるになりすぎた版の作り直し（2026-10-08）

色分け・滑らかな面の版（`design_assets/battle-fields-v2/` の現行6枚）を見たユーザーの判断：**「つるつる過ぎてシュール。暗めの美麗イラストではなくなった」**。

原因：依頼文の「滑らかな面」を、中央を「質感ゼロの完全に平らなグラデーション」で塗り直す指示として強く実行した（`surface-final-updates.json` の “SINGLE PERFECTLY SMOOTH matte color gradient … ZERO visible texture”）。さらに色を明るく鮮やかにしすぎた（侍の床がオレンジ一色、神使が白く発光、龍が真っ赤）。

この版で良かった点：舞台ごとに色が分かれた。集合体の反復が減った。
直すべき点：**最優先は「暗めの美麗イラスト」であること**。滑らかさと色分けは、それを壊さない範囲で。

色の強さの目安：`reference/color-target-graded-v3.jpg`（1つ前の版 v3-before-palette に、Claude Code が舞台ごとの色を薄く重ねた試し）。暗さ・色の濃さはこれくらいが目標。ただしこの試しは1つ前の版の荒い地面と集合体がそのまま残っているので、描き方は参考にしない。

### 作り直しの依頼文（6枚）

```text
星戦背景の6枚を作り直してください。前回の版は「つるつる過ぎてシュール、暗めの美麗イラストではなくなった」と判断されました。

作業前に design_assets\battle-fields-v2-request\CHATGPT_PROMPT.md の「最新：つるつるになりすぎた版の作り直し」と、更新した「共通の画風指定」を読み、reference\color-target-graded-v3.jpg を見てください。

最優先：暗く、描き込みの美しいイラストであること（1つ前の版 v3-before-palette の、絵としての密度と雰囲気の良さ）。
そのうえで次の3点を、絵を壊さない範囲で入れる。
1. 色分け：舞台ごとの主になる色は前回の表のとおり。ただし「暗い絵に色を染み込ませる」程度に抑える。明るく鮮やかな色面にしない（目安は color-target-graded-v3.jpg）。神使もほかより少し明るい程度で、白く光らせない。
2. 地面・床・水面：まだら・ムラ・汚れのような塗りは避けるが、平らなグラデーションにもしない。絵の具の筆致がうっすら残る、整った手描きの質感（上質なアニメ背景美術の地面のように、明暗の流れが整っていて、ところどころに意図して置いた石・草・板目・ひび・水の映りがある）。
3. 集合体の禁止：葉・瓦礫・小石・苔を、小さな同じ形の大量の繰り返しで埋めない。形は少なく大きく、置く場所は意図して選ぶ。

ほかは前回の指定どおり（見せ場・構図・縁取り・静かな中央・上端から12%以上離す・視点）。

納品のルール
- 前回の版は design_assets\battle-fields-v2\v4-too-smooth\ へ移して残す。新しい6枚を <キー>.png（16:9）で置く
- 画像は生成で描くこと。生成後にプログラムで中央を塗りつぶす・ぼかす・平らにする加工はしない
- preview\ の all-fields.png・<キー>-in-game.png・<キー>-ground-crop.png（800×450の中央等倍）を、前回と同じ条件で作り直す。preview\before-after.png には v3-before-palette・v4-too-smooth・今回の3つを並べる
- prompts.json と README.md を更新する
- 文字・漢字・家紋・落款・署名・人物・彼岸花は入れない。ゲーム本体と battle_fields\ は変更しない。コミット・push・デプロイはしない
```

## 6枚の作り直し（色分け・滑らかな面・集合体の禁止）（2026-10-08・前回）

全6枚（金雲なし・襖修正版）を対戦画面に組み込んだところ、ユーザーから次の指摘があった。

1. **同じ色合いを避けたい**：6枚とも暗い灰〜茶色が主体で、どの舞台も同じに見える。
2. **地面などが荒い塗りだと画質が悪く見える**：中央の地面がムラのある、まだらな塗り。1664pxの絵を画面いっぱいに引き伸ばすため、粗さがさらに目立つ。
3. **木々や瓦礫など、集合体っぽい描き方はAIっぽすぎるので避けたい**：葉・苔・瓦礫・シダ・小石を、小さな同じ形の繰り返しで埋めている。

方針（「共通の画風指定」に追加ルールとして入れた）：

- **舞台ごとに主になる色を変える**（下の表）。暗さはそろえるが、色相ははっきり違える。
- **広い面は滑らかに**：地面・床・水面・霧は、大きく滑らかな色の面と柔らかいグラデーションで描く。質感は、ごく細かく均一な紙の目だけ。まだら・筆の点々・散らばった細かい斑点は描かない。
- **形は少なく大きく**：木・岩・瓦礫・草は、少数の大きな、形のはっきりした塊として描き、間に広い余白を取る。小さな同じ形を大量に並べない（葉の房の集まり、瓦礫の山、散らばった小石、細かい苔の粒など）。

| キー | 主になる色（ほかの舞台と重ならないように） |
| --- | --- |
| ninja | 青藍（冷たい青〜青紫の夜霧） |
| samurai | 琥珀（漆黒に金箔と朱の温かい色） |
| beast | 深緑（苔と杉の緑、青みのある緑） |
| shinshi | 白銀（明け方の白い霧と淡い石、朱をひとさし。6枚の中でいちばん明るい） |
| yokai | 紫（青紫〜赤紫の闇と冷たい青白い光） |
| dragon | 朱赤（燃えさしの赤と炭の黒） |

### 6枚の作り直しの依頼文

```text
星戦背景の6枚（design_assets\battle-fields-v2\ の ninja・samurai・beast・shinshi・yokai・dragon）を作り直してください。

作業前に design_assets\battle-fields-v2-request\CHATGPT_PROMPT.md の「最新：6枚の作り直し」（指摘・方針・色の表）と、更新した「共通の画風指定」「生成指示」を読んでください。

- 舞台ごとの見せ場・構図・縁取り・静かな中央・視点は、今の版の良さを残す（今の版を構図の参照にしてよい）。
- 変えるのは3点：(1) 舞台ごとに主になる色を表のとおりはっきり変える (2) 地面・床・水面・霧を、大きく滑らかな面と柔らかいグラデーションにする（まだら・点々・ムラは不可） (3) 木・岩・瓦礫・草は少数の大きな形にまとめ、小さな形の繰り返し（集合体）にしない。
- 6枚を並べて、色が互いに重ならないこと、どの絵にも集合体のような細かい繰り返しがないことを確かめてから納品する。

納品のルール
- 今の版は design_assets\battle-fields-v2\v3-before-palette\ へ移して残す。新しい6枚を <キー>.png（16:9）で置く
- preview\<キー>-in-game.png と preview\all-fields.png を、前回と同じ条件（1920×993に切り出し・明るさ105%・彩度90%・外周の暗幕・配置ガイド）で作り直す。preview\before-after.png に今の版との比較を入れる
- 地面の質感が分かるよう、各舞台の中央を等倍で切り出した preview\<キー>-ground-crop.png（800×450）も付ける
- prompts.json と README.md を更新する
- 文字・漢字・家紋・落款・署名・人物・彼岸花は入れない。ゲーム本体と battle_fields\ は変更しない。コミット・push・デプロイはしない
```

## 経緯：金雲をやめる（2026-10-08）

試作の2枚（`design_assets/battle-fields-v2/` の ninja・samurai、初版）を見たユーザーの判断で、金雲（すやり霞）をやめることになった。

- 2枚で金雲の形と置き方がほぼ同じで、上から貼り付けた「使い回し」に見える。
- 金雲の色が、画面の飾りのくすんだ金より黄色く明るく、絵から浮いている。

金雲以外（舞台ごとの見せ場、静かな中央、墨の質感）は良いので、そのまま活かす。外周の縁取りは、金雲の代わりに **その舞台に元からあるもの**（竹の葉・梁・枝・洞窟の天井・煙など）を暗く沈めて使う。金は、建物の金箔や細い輪郭線など、絵の中にあって自然な所だけに残す。

## 試作の作り直しの依頼文（2枚）

```text
星戦背景の試作2枚（design_assets\battle-fields-v2\ の ninja.png・samurai.png）を、金雲をやめて作り直してください。

作業前に、design_assets\battle-fields-v2-request\CHATGPT_PROMPT.md の「経緯：金雲をやめる」と、更新した「共通の画風指定」「生成指示」の1・2を読んでください。

- 金雲（すやり霞）は描かない。外周は、各舞台の生成指示にある「縁取り」で囲む。
- 金雲以外（舞台の見せ場・静かな中央・墨の質感・高い視点）は初版の良さを残す。初版を構図の参照にしてよい。
- 2枚で縁取りの形・位置が同じにならないこと（使い回しに見えないこと）。

納品のルール
- 初版は design_assets\battle-fields-v2\v1-gold-clouds\ へ移して残す。新しい2枚を ninja.png / samurai.png として置く
- preview\ の確認画像（<キー>-in-game.png と prototypes.png）を作り直す。prototypes.png には初版との比較も入れる
- prompts.json と README.md を更新する
- 文字・漢字・家紋・落款・署名・人物・彼岸花は入れない。ゲーム本体と battle_fields\ は変更しない。コミット・push・デプロイはしない
```

## 試作の依頼文（2枚・初版）

```text
ツクリヨの星戦画面の背景を作り直します。まず画風を確かめるため、2枚だけ作ってください。

作業前に次を読んでください。
- C:\Users\maekawa\dev\tsukuriyo-project\AGENTS.md
- C:\Users\maekawa\dev\tsukuriyo-project\design_assets\battle-fields-v2-request\README.md（今の問題点・新しい方向・画面の制約）
- 同じフォルダの reference\layout-guide.png（カードや窓が重なる位置）と reference\current-fields.jpg（今の背景。これに似せないこと）

作るのは次の2枚です。生成指示は CHATGPT_PROMPT.md の「生成指示」にあります。各指示の頭に「共通の画風指定」を付けてください。
1. ninja（忍者の隠れ里）
2. samurai（侍の城）。1を画風の参照にして、色の数・金の量・筆致をそろえる

納品のルール
- 保存先：design_assets\battle-fields-v2\（新しいフォルダ）
- 16:9の原寸PNGを ninja.png / samurai.png で置く（2560×1440以上が望ましい）
- preview\<キー>-in-game.png：reference\layout-guide.png の枠を薄く重ね、さらに明るさ72%・彩度80%に落とした、ゲーム内に近い見え方の確認画像
- prompts.json：最終的な生成指示と原画のパス
- README.md：一覧と、Claude Code への引き継ぎ（気になった点・やり直した点も書く）
- 文字・漢字・家紋・落款・署名・人物は入れない。彼岸花は描かない
- ゲーム本体（index.html など）と battle_fields\ は変更しない。WebP化・組み込みは Claude Code が行う。コミット・push・デプロイはしない
```

## 残り4枚の依頼文（侍の城の作り直しを含む）

試作の作り直し（金雲なし）を対戦画面に組み込んで確かめた結果、画風はこれで確定。あわせて分かったこと：

- 新しい絵は暗めに描かれているので、ゲーム側では明るさを落とさない（明るさ105%・彩度90%）。プレビューもこの条件で作る。
- 画面は16:9より少し横長（1920×993など）で表示するため、絵の上下が約4%ずつ切れる。さらにゲーム側で外周（特に上下の帯）を暗くする。
- そのため、侍の城の見せ場（松の金の襖）が上端の帯に入ってしまい、画面ではほとんど見えなかった。見せ場は上端から少し離す。

```text
design_assets\battle-fields-v2-request\ の README.md と CHATGPT_PROMPT.md（「残り4枚の依頼文」の前書きと、更新した「共通の画風指定」）を読み、次の5枚を作ってください。
design_assets\battle-fields-v2\ の ninja.png（確定）と samurai.png（金雲なしの版）を画風の参照にして、色の数・金の量・筆致・視点の高さ・縁取りの暗さをそろえてください。

2. samurai（侍の城）の作り直し：今の版の構図と画風はそのままに、松の金の襖の帯を上端から下げる（襖の上辺が画面の高さの12%前後、下辺が30%前後に来るように。今は上端に張り付いている）。天井の梁と軒の縁取りは襖の上に残す。今の版は design_assets\battle-fields-v2\v2-before-fusuma-fix\ へ移して残す
3. beast（人獣の森の郷）
4. shinshi（神使の神殿）
5. yokai（妖怪の洞と沼）
6. dragon（龍の荒れ果てた台地）

各舞台の見せ場は、画面の上端から12%以上離す（上下が約4%ずつ切れ、外周も暗くなるため）。

納品のルール
- 保存先 design_assets\battle-fields-v2\、<キー>.png（16:9）
- preview\<キー>-in-game.png：16:9の絵を 1920×993 に切り出し（上下を切る）、明るさ105%・彩度90%にして外周を暗くし（上下の端で約50%、左右の端で約55%の黒を重ね、内側へ向けて薄くする）、reference\layout-guide.png の枠を薄く重ねた確認画像
- preview\all-fields.png：6枚（ninja も含める）を同じ条件で並べた一覧
- prompts.json と README.md に追記
- 文字・漢字・家紋・落款・署名・人物・彼岸花は入れない。ゲーム本体と battle_fields\ は変更しない。コミット・push・デプロイはしない
```

## 共通の画風指定（各生成指示の頭に付ける）

```text
Background art for the battle board of a Japanese dark-fantasy card game. One wide 16:9 landscape image, no UI.

STYLE — a night-time Japanese folding-screen painting (byobu-e), reinterpreted with restraint:
- Ground of deep black to dark indigo, like black lacquer. Sumi ink washes and soft bleeding edges.
- Muted mineral pigments used sparingly: malachite green, azurite blue, dull vermilion, ochre. Low saturation overall.
- NO gold clouds (no suyari-gasumi, no kumo-gata cloud bands). Gold appears only where it naturally belongs inside the scene (gold-leaf panels, a few very thin contour lines on key architecture), matte and slightly dull, never shiny metallic.
- Frame the outer edges with dark elements that naturally belong to THIS stage (given as FRAMING in each scene), sinking softly into near-black at the very edges. The framing must be specific to the scene, irregular and organic, never a repeated decorative pattern.
- High bird's-eye viewpoint. Weak, flattened perspective built from stacked horizontal planes; interiors use the fukinuki-yatai convention (roofless, seen from above).
- Calm, elegant, quiet, a little mysterious.

SURFACES AND SHAPES (very important — these make the image look high quality instead of AI-generated):
- FIRST PRIORITY: a dark, richly rendered, beautiful illustration. Never flatten it into a plain airbrushed gradient — that looks surreal and cheap.
- Large surfaces (ground, floor, water, mist) are painted with clean, well-organized hand-painted texture: gentle brushwork that stays faintly visible, orderly flows of light and shadow, and a few intentionally placed details (some stones, grass tufts, floorboard grain, cracks, faint reflections), like a high-quality anime background painting. NO blotchy patches, NO mottled stains, NO noisy dabs, NO scattered speckles — but also NO perfectly flat, textureless gradients.
- Trees, foliage, rocks, rubble and grass are drawn as a FEW LARGE, clearly designed shapes with strong, simple silhouettes and generous empty space between them. NEVER fill an area with many small repeated elements (dense clumps of leaves, piles of rubble, scattered pebbles, carpets of moss dots, swarms of tiny ferns). Think of how a master painter simplifies a pine into a few bold masses.
- Fewer, bigger, cleaner forms everywhere. Detail is concentrated only on the one or two signature motifs.
- Each stage has its OWN dominant hue (given as Palette in each scene), but only as a tint soaked into a dark, low-saturation picture — never a bright, saturated color field. Keep the overall value dark.
- NOT anime cel style, NOT photorealistic, NOT 3D render, NOT glossy, NO wet mirror reflections, NO HDR, NO bloom, NO strong backlight or lens effects, NO dramatic god rays.

COMPOSITION (cards and UI will be overlaid; follow strictly):
- The central area — about the middle 62% of the width and from 29% to 70% of the height — must be calm: a broad, low-contrast surface (open ground, still water, mist, or floor) with almost no detail. Cards are placed there in two rows.
- Do NOT draw any line, path, river edge or wall edge that crosses the centre horizontally and splits it into an upper and lower half.
- Top centre and bottom centre are covered by portrait windows; the right 15% is covered by a circular dial; the four corners hold buttons and card stacks. Keep those areas simple and dark.
- Put the scene's distinctive features at the far left edge and in the upper background band, but keep them at least 12% of the height away from the very top edge (the top and bottom ~4% are cropped on wider screens and the outer band is darkened by the game).
- Overall mid-dark value (the game shows it at about this brightness and only darkens the outer band).
- Limit the scene to ONE or TWO signature motifs of this stage. Do not add generic Japanese props unless the scene below asks for them: no torii, no stone lanterns, no shimenawa ropes, no banners, no full moon, unless explicitly listed.

STRICTLY EXCLUDE: people, characters, faces, silhouettes of people; text, kanji, letters, family crests (kamon), seals, signatures; red spider lilies (higanbana); UI elements, card frames.
```

## 生成指示（舞台ごと）

### 1. ninja（忍者の隠れ里）
```text
SCENE: A hidden ninja village tucked into a steep, misty mountain ravine at night.
Signature motifs: (1) houses on stilts clinging to the cliff faces at the far left and in the upper background, linked by thin rope bridges; (2) a dense bamboo grove at the left edge.
The calm centre is a wide, flat clearing of packed earth, veiled by low drifting mist, seen from above.
Palette — dominant hue COLD INDIGO BLUE: deep blue-violet night, cool blue mist, ink black; a few tiny warm amber window lights as the only warm accent. Avoid brown and grey-brown.
FRAMING: overhanging bamboo leaves and stems along the top-left and left edge, and drifting dark mist rising from the ravine along the bottom and right edges.
```

### 2. samurai（侍の城）
```text
SCENE: The great hall of a castle keep at night, seen from above with the roof removed (fukinuki-yatai).
Signature motifs: (1) a row of gold-leaf fusuma sliding panels painted with pine trees along the upper background, its top edge at about 12% and bottom edge at about 30% of the image height — NOT touching the top edge (the pine painting itself is quiet and simplified); (2) one empty suit of armor on a stand and a sword rack at the far left edge.
The calm centre is a wide expanse of dark, matte tatami mats and dark wood floor — matte, no reflections.
Palette — dominant hue WARM AMBER: lacquer black, warm amber light, antique gold leaf on the fusuma, dull vermilion accents. The floor is dark, warm wood and tatami painted with clean, orderly brushwork, not mottled and not a flat orange field.
FRAMING: dark ceiling beams and the edge of the eaves crossing the top corners, and deep shadow pooling along the bottom and right edges.
```

### 3. beast（人獣の森の郷）
```text
SCENE: A village of beast-folk inside an ancient forest at night.
Signature motifs: (1) colossal old cedar trunks with small dwellings built into their roots and branches at the far left and in the upper background; (2) a few deer and foxes resting among the roots at the left edge, drawn small and calm (animals only, no people).
The calm centre is a broad, mossy forest floor with soft mist, very little detail.
Palette — dominant hue DEEP GREEN: blue-green and moss green shadows, ink black, a little muted ochre, tiny warm lights. The forest floor is dark ground with a few intentional patches of moss and grass, not a carpet of moss dots and not a flat green field.
FRAMING: heavy cedar branches and hanging moss along the top edge and the right side, and dark ferns along the bottom edge.
```

### 4. shinshi（神使の神殿）
```text
SCENE: The sanctuary of the divine messengers — a single coherent sacred architecture that blends a Shinto shrine with a western stone cathedral (e.g. a shrine hall whose upper walls carry tall pointed stained-glass-like windows rendered in flat mineral colors, under a cypress-bark roof). It must read as ONE designed building, not a collage.
Signature motifs: (1) that hall in the upper background; (2) a pair of guardian beast statues (komainu) at the far left edge.
The calm centre is a wide, pale stone courtyard covered by thin mist, matte, no reflections.
Palette — dominant hue PALE SILVER-WHITE: dawn mist, pale stone and silvery white, soft grey-blue shadows, one accent of vermilion on the hall, a little azurite in the windows. Slightly lighter than the other stages, but still a dark picture — never glowing white. A torii is NOT required.
FRAMING: the dark silhouettes of sacred camphor trees at the top corners and a low drifting mist along the bottom and right edges.
```

### 5. yokai（妖怪の洞と沼）
```text
SCENE: The mouth of a vast cave opening onto a still black swamp at night, home of the yokai.
Signature motifs: (1) the dark jagged cave ceiling and hanging roots framing the top edge; (2) a few small blue-white will-o'-the-wisps (hitodama) floating low over the water at the left side, plus a few bats far away.
The calm centre is the still, dark swamp surface with a thin mist — matte, no mirror reflections.
Palette — dominant hue PURPLE: deep blue-violet to red-violet darkness, small cold blue-white lights, ink black. The swamp surface is dark still water with faint reflections and a thin mist, not a flat violet field. NO torii, NO lanterns, NO red spider lilies.
FRAMING: the cave ceiling, stalactites and hanging roots along the whole top edge and the right side; black reeds along the bottom edge.
```

### 6. dragon（龍の荒れ果てた台地）
```text
SCENE: A scorched, ruined plateau after a great dragon has passed.
Signature motifs: (1) in the upper background, the smoldering ruins of an old town under a dull red sky with smoke drawn as flowing ink washes; (2) at the left edge, a broken stone wall torn by three huge parallel claw marks.
Across the ground, a trail of enormous three-toed dragon footprints, alternating left and right like a walking animal, cracked into the earth with a faint ember glow — the footprints must read clearly as claws, not leaves. Keep them subtle and low-contrast where they cross the calm centre.
The calm centre is broad, dark, cracked earth with drifting ash.
Palette — dominant hue EMBER RED: deep crimson and ember red glow, charcoal black, a little ash grey, almost no gold. The cracked earth is a few large plates with clean crack lines and painterly texture, not a pile of rubble and not a flat red field.
FRAMING: billowing ink-wash smoke along the top edge and the right side, and charred debris and ash along the bottom edge.
```
