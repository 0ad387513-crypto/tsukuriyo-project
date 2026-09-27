# オロチの封印解除・開眼（v1.15.140）

内蔵 image_gen で制作。CLI未使用。

## 保存先 `divine_assets/orochi-awakening-frames.png`

4列×2行、8コマ。2172×724、各セル543×362（3:2）。中央の一つの顔の目と口が閉じた状態からゆっくり開く。CSS `steps(1,end)` で各コマを切り替え、最終コマまで同じ座標で表示。背景は透過、牙なし、開いた口の中も赤い。

### 最終プロンプト

Use case: precise-object-edit. Input image is the FINAL OPEN appearance reference for a supernatural Japanese dark fantasy face made ONLY of red glowing eyes and a red glowing mouth. Create an ANIMATION SPRITE SHEET, EXACTLY EIGHT aligned frames in FOUR COLUMNS and TWO ROWS, ordered left-to-right top row then left-to-right bottom row. Overall canvas wide 3:1; each equal cell 3:2. No gutters, separators, borders, text, labels. Every cell has the SAME single STRAIGHT-ON FRONTAL apparition in the EXACT SAME position, scale and proportions, like a camera locked in place. Eyes at upper third and mouth at lower two thirds, safely inside each cell. Eight progressive drawings: FRAME1 both eyes fully CLOSED as thin red eyelid lines and mouth CLOSED as one thin red curve; FRAME2 still closed, dim light grows; FRAME3 eyes and mouth just barely part; FRAME4 narrow red slits start opening; FRAME5 halfway open, visible VERTICAL SLIT pupils; FRAME6 more open; FRAME7 nearly final; FRAME8 final matching reference eyes sharply UPSWEPT with VERTICAL pupils and slightly open narrow curved mouth with interior filled GLOWING RED. Draw genuinely different eyelid contours and mouth opening shapes in each frame, not simply copies or scaled versions. Preserve the final face's sinister simple elegant design and smooth crimson glow. NO TEETH or FANGS in ANY FRAME. NO tongue, NO nose, NO skin, NO face outline, NO jaw, NO body, NO dragon drawing, NO horns. ONLY the red eye-and-mouth light marks imply the hidden presence. TRUE TRANSPARENT background in every cell, all surrounding blank space transparent. Exact aligned eight-frame production game sprite atlas, no extra objects.

## 保存先 `divine_assets/orochi-seal-paper.png`

単独のお札。8枚を個別に配置して順に剥がし、中央の一つの顔から外へ飛ばす。

### 最終プロンプト

Use case: stylized-concept. One SINGLE Japanese sealing OFUDA talisman paper game sprite on TRUE TRANSPARENT background. Narrow upright rectangular aged ivory washi paper, softly irregular hand-cut edges, subtle visible fibers and creases, one vermilion circular occult seal and a few bold dark ink ritual brush marks down the middle. Premium painterly anime Japanese dark fantasy, understated warm gold edge light. Straight-on front view, paper slightly curled at upper corner so it feels ready to peel free. Fully isolated ONE sheet, no overlapping sheets, no extra scraps, no surroundings, no dragon, no people, no flames, no text labels or modern lettering. Entire paper within canvas with generous transparent margin. Portrait 2:3 canvas.

通常のカミのカットイン1.8秒の後、オロチだけ4.2秒の演出。札は約1.589秒までに消え、1.68秒に既存 `sfx/dragon_heavy.mp3` を再生。約1.85秒からコマを進め、3.61秒で最終コマへ。旧素材は保持。
