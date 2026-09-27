# オロチの笑みと破れた札（v1.15.146）

内蔵 image_gen の画像編集を使用。CLI未使用。

## 顔の8コマ

保存先: `divine_assets/orochi-awakening-frames.png`（2172×724、4列×2行）。元画像: `exec-484f2fd0-82c3-4d02-aec1-f9e011d2ddc5.png`。生成画像ディレクトリ: `C:/Users/0ad38/.codex/generated_images/01a0dc78-928d-7602-ba93-54d16f98c518/`。

上下4本の犬歯を残して口角を上げ、妖しい笑みに変更。顔の外側の赤い化粧状の光は追加しない。

最終プロンプト:

Edit this exact 4-column by 2-row transparent sprite atlas. Preserve all eight frame positions, progression, scale, black void and the restrained thin red eyes with vertical pupils. Change only the mouth expression in the opening and open frames: visibly raised mouth corners and a sinister, alluring sly smile, while the lips remain slightly parted and four canine fangs (upper and lower, no other teeth) remain visible. The final expression must read as an ominous smiling sealed Japanese dragon goddess facing straight forward. Keep the first closed frames closed; gradually develop the smile as the mouth opens. Red light ONLY inside the mouth and eyes; absolutely no red makeup, lipstick, broad red eyelid glow, or glow surrounding the face. Preserve true transparent background and the exact atlas layout. No text.

## 破れたお札アイコン

保存先: `divine_assets/orochi-torn-seal.png`。元画像: `exec-58d8eae5-b02a-4155-8549-69ba3c6e3480.png`。既存の単独の札を参照して生成し、背景を抑えるため追加編集。封印0のカミにのみ表示。カーソル・キーボードフォーカスで能力説明、タップでカミ詳細。

初回プロンプト:

Create a premium small game status icon by editing the attached Japanese paper sealing talisman. A single ivory ofuda torn diagonally across its middle into two jagged pieces, the pieces slightly separated, with a recognizable vermilion seal and abstract black ink strokes. Upright narrow rectangular paper, worn fibers at the tear, no readable words. Japanese dark fantasy anime painted style. Fill most of the canvas with the talisman, safe small margin, transparent background. No surrounding aura, no badge frame, no large glow. Readable as a torn sealing paper even when displayed at 38 pixels wide.

最終編集プロンプト:

Edit this torn ofuda icon. Preserve the two torn paper pieces, central red seal and black ink design exactly. Remove ALL the gold haze, gold glow and black background outside the paper. Background fully transparent alpha, only the paper and tiny paper fibers at the tear remain. No shadow or aura outside the paper. The talisman fills most of the transparent canvas with narrow margins, suitable for a tiny game status icon.

## 配置

剥離の8枚は二重の菱形。外側4枚と内側4枚を接続する細い格子で封印を表す。カットイン→札剥離→既存の龍の咆哮→8コマの開眼の順序は維持。
