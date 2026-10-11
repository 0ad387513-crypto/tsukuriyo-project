"use strict";

/* フィールド専用。番号は表示中のカードを使う（進化元ではない）。
   原画を差し替えたら tools/field-card-art-preview.html で顔と数値の重なりを確認する。
   レガシーの札は縦長なので、絵を縮めて全体を出すと上下に黒い帯が出る。レガシーは position で主役が入る位置に寄せて札いっぱいに出す。
   wide（名前帯・効果欄を除いた絵柄全体を表示）は、札が正方形に近いレリックだけに使う。 */
const FIELD_CARD_ART_CROPS = Object.freeze({
  "13": { position: "66% 8%" }, // イロハ：本人と左の2人を収める
  "17": { position: "89% 8%" }, // 猛き赤の眷属：右端の頭
  "36": { position: "65% 8%" }, // 名刀集めの豪族：本人と左の従者
  "57": { position: "42% 8%", size: "auto 190%" }, // 無貌の忍
  "63": { position: "42% 8%", size: "auto 190%" }, // 荒き緑の眷属
  "65": { position: "80% 8%" }, // ライカ＆コマ：少女と獣の顔
  "78": { position: "35% 8%" }, // 逢魔ヶ淵の渡し守：渡し守を中央に
  "79": { position: "35% 8%" }, // 同上（進化後）
  "86": { position: "42% 8%", size: "auto 190%" }, // 眩き黄の眷属
  "93": { position: "54% 8%" }, // 二つ影の絡繰師：2人の顔
  "94": { position: "54% 8%" }, // 同上（進化後）
  "106": { position: "61% 8%" }, // 貪食の童女：少女と髪の口
  "114": { position: "79% 8%" }, // 怨嗟の狂骨：少女と髑髏
  "143": { wide: true }, // 月見草の修行場
  "144": { wide: true },
  "147": { wide: true }, // 交差する想い
  "148": { wide: true },
  "149": { wide: true }, // 禁忌の祭壇
  "150": { wide: true },
  "166": { wide: true }, // 命の香煙
  "167": { wide: true },
  "168": { wide: true }, // 色彩の旅絵巻：各場面の人物
  "169": { wide: true }, // 暁の盟約
  "170": { wide: true },
  "176": { wide: true }, // 鎮魂の花畑
  "178": { wide: true }, // 歓喜の凱旋
  "179": { wide: true }, // 哀悼の影：左右の龍と人物
  "180": { wide: true }, // 落日の子守唄：原画の口元と赤子を保持（原画に目は描かれていない）
  "183": { position: "42% 8%", size: "auto 190%" }, // 猛進する獣霊
  "185": { position: "89% 8%" }, // 巨躯なる獣霊
  "198": { position: "57% 8%" }, // ディエスイレ：中央の頭
});

function fieldCardArtCrop(card) {
  const no = String(parseInt(card && card.no, 10));
  return FIELD_CARD_ART_CROPS[no] || null;
}

function fieldCardArtStyle(card, url) {
  if (!url) return {};
  const crop = fieldCardArtCrop(card);
  const style = { backgroundImage: `url("${url}")` };
  if (crop && crop.wide) {
    // 背景の二重表示を避け、子要素で絵柄だけを中央へ。既存と同じ画像URLを再利用する。
    style.backgroundImage = "none";
  } else if (crop) {
    if (crop.position) style.backgroundPosition = crop.position;
    if (crop.size) style.backgroundSize = crop.size;
  }
  return style;
}

if (typeof module !== "undefined") {
  module.exports = { FIELD_CARD_ART_CROPS, fieldCardArtCrop, fieldCardArtStyle };
}
