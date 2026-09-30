# 椿の花吹雪と横長の炎（v1.15.274）

内蔵 ImageGen で制作。画像は `scripts/import_visual_asset.py` で透過 WebP に変換し、ゲームでの表示寸法に合わせて軽量化した。

## アメノウズメ：花びらアトラス

> Use case: stylized-concept. Asset type: 4 columns × 2 rows sprite atlas for a Japanese dark-fantasy card game's animated camellia petal storm. Create EIGHT separate, clearly DIFFERENT single camellia petals, exactly one petal centered in each equally sized cell, generous transparent padding around each cell. Top row: four vivid crimson/red camellia petals; bottom row: four ivory white camellia petals, some softly lit warm at edges. Each petal has a distinct natural silhouette and angle: broad cupped front face, sharply curled edge, sideways view, folded/twisting windblown view. Delicate real botanical veins and slight translucency, richly hand-painted semi-realistic game illustration, exquisite subtle highlights, no black outline, beautiful at small scale. CRITICAL: true transparent RGBA background everywhere around the petals, including between cells; no background color, no checkerboard, no shadow, no stems, no full flowers, no extra petals, no text. Atlas grid aligned precisely; no petal crossing cell boundaries.

出力: `camellia-petals-eight-6cabafaedf28.webp`（960×480、4列×2行）。

## ヒノカグツチ：全幅の炎

最初の場面は次の指示で生成した。

> Wide 16:9 transparent effect painting for a serious dark Japanese fantasy card game. One continuous enormous wall of realistic painterly crimson, vermilion and gold fire erupts across the entire horizontal width, with natural irregular tongues, sparks and deep smoke. This is the IGNITION frame: first violent flare rising from a continuous full-width base. No repeated columns, no tiled pattern, no earth or ground, no figures, no text. Transparent RGBA background, with flame extending naturally toward both side edges.

その絵を参照して連続性を保ちながら、炎の上昇・最大火勢・収束の3場面を追加編集した。各場面は横方向に一続きで、独立した炎柱の並びや地面の描写を含めない。

出力: `hinokagutsuchi-fire-wall-ignition-a35083ccbd3c.webp`、`hinokagutsuchi-fire-wall-rise-47b74843538a.webp`、`hinokagutsuchi-fire-wall-peak-79b373320830.webp`、`hinokagutsuchi-fire-wall-decay-f6399d6e3bd4.webp`（各1200×675）。
