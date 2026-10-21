"use strict";

// 現行の本番レンダラーを優先する　ローカルのゲームが旧版の場合だけv539の同一関数へフォールバック
// 出典: main 141fc5de2ffd12073f57aea9cb08808787fae9f9 / field_card_frames.js
((liveKnot, liveRarity) => {
/* 場の札のレアリティ枠（2026-10 作り直し）。
   どの種類も同じ太さの縁で、飾りは付けない。違いは素材の色だけにして、ひと目で分かるようにする：
   返還値2＝銀、返還値1＝金、龍＝メタリックな黒、トークン＝クリスタル（透ける青緑） */
const RARITY_FRAME_COLORS = {
  // [縁のグラデーション（5段）, 外側と内側の輪郭, 縁の内側の細い光]
  // 明るすぎると樹脂のように見えるので、どれも少し沈んだ金属の色にする
  basic : [['#dde2e5', '#6c7781', '#c8cfd4', '#3f4850', '#aeb7be'], '#13171b', '#dde2e5'],
  unique: [['#ead08a', '#8a5d14', '#dab45e', '#553608', '#c69a3c'], '#1f1203', '#ead08a'],
  dragon: [['#c3c8d0', '#141518', '#7d828b', '#050506', '#3a3d44'], '#000000', '#c3c8d0'],
  token : [['#e8fffb', '#2a9086', '#b5ece2', '#0f5a55', '#7ed0c3'], '#062626', '#e8fffb'],
};
let rarityFrameSequence = 0;
function rarityFrame(kind, shape = 'portrait') {
  const [stops, outline, shine] = RARITY_FRAME_COLORS[kind] || RARITY_FRAME_COLORS.unique;
  const id = `rarity-${++rarityFrameSequence}`;
  const offsets = [0, .28, .5, .74, 1];
  const grad = `<linearGradient id="${id}-metal" x1="0" y1="0" x2=".85" y2="1">${stops.map((c, i) => `<stop offset="${offsets[i]}" stop-color="${c}"/>`).join('')}</linearGradient>`;
  const crystal = kind === 'token' ? ' opacity=".9"' : '';
  const shadow = `<filter id="${id}-shadow" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.2" flood-color="#000" flood-opacity=".75"/></filter>`;
  const line = (d, stroke, w, extra = '') => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round" ${extra}/>`;
  let outer, inner, mid, view, cls;
  if (shape === 'octagon') {
    outer = 'M54 -4H186L244 42V185L186 231H54L-4 185V42Z';
    inner = 'M58 5H182L235 47V180L182 222H58L5 180V47Z';
    mid = 'M56 0.5H184L239.5 44.5V182.5L184 226.5H56L0.5 182.5V44.5Z';
    view = '0 0 240 227'; cls = 'field-relic-frame';
  } else {
    const round = (x, y, w, h, r) => `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;
    outer = round(-5, -5, 250, 318, 16);
    inner = round(3, 3, 234, 302, 10);
    mid = round(-1, -1, 242, 310, 13);
    view = '0 0 240 308'; cls = '';
  }
  const rim = `<g filter="url(#${id}-shadow)"><path d="${outer} ${inner}" fill="url(#${id}-metal)" fill-rule="evenodd"${crystal}/>`
    + line(outer, outline, 1.6) + line(inner, outline, 1.4) + `</g>`
    + line(mid, shine, .7, 'opacity=".4"');
  return `<svg class="material-frame rarity-frame ${cls} rarity-${kind} material-${kind}" viewBox="${view}" preserveAspectRatio="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><defs>${grad}${shadow}</defs>${rim}</svg>`;
}

/* 場のレガシーの枠（結び・2026-10）：生成画像の「小さめの結び」を4色に塗り分けた透過画像。
   画像の縁の内側（KNOT_FRAME_INNER）を、カードの絵の端（縁の太さ --frame-w の内側）に合わせて置く。
   作り方は design_assets/field-knot-frame-v1/manifest.json（元画像・切り出し位置） */
const KNOT_FRAME_FILES = {
  basic: 'battle_ui/field-knot-frame-silver-4138cdf2b96d.webp',
  unique: 'battle_ui/field-knot-frame-gold-664fb2e6ccf5.webp',
  dragon: 'battle_ui/field-knot-frame-black-de2dc2d97501.webp',
  token: 'battle_ui/field-knot-frame-crystal-8b10f0fa13a5.webp',
};
const KNOT_FRAME_SIZE = { width: 387, height: 454 };
const KNOT_FRAME_INNER = { left: 16, right: 372, top: 14, bottom: 440 };
let knotFrameSequence = 0;
function knotFrame(kind) {
  const file = KNOT_FRAME_FILES[kind] || KNOT_FRAME_FILES.unique;
  const { width: W, height: H } = KNOT_FRAME_SIZE, { left, right, top, bottom } = KNOT_FRAME_INNER;
  const iw = right - left, ih = bottom - top;
  // 内側の幅・高さ＝カードの幅・高さ − 縁の太さ×2 になるように、画像全体の大きさと位置を決める
  const sx = `(100% - 2 * var(--frame-w)) / ${iw}`, sy = `(100% - 2 * var(--frame-w)) / ${ih}`;
  const css = `position:absolute;pointer-events:none;max-width:none;`
    + `left:calc(var(--frame-w) - ${left} * ${sx});top:calc(var(--frame-w) - ${top} * ${sy});`
    + `width:calc(${W} * ${sx});height:calc(${H} * ${sy});`;
  return `<img class="material-frame rarity-frame knot-frame rarity-${kind} material-${kind}" data-frame-id="knot-${++knotFrameSequence}" src="${file}" alt="" aria-hidden="true" draggable="false" style="${css}">`;
}


function currentFieldFramePreview(kind, shape = "portrait") {
  const markup = shape === "octagon" ? (liveRarity || rarityFrame)(kind, shape) : (liveKnot || knotFrame)(kind);
  return markup.replaceAll('src="battle_ui/', 'src="../../battle_ui/');
}
if(typeof module !== "undefined") module.exports = {currentFieldFramePreview};
else window.currentFieldFramePreview = currentFieldFramePreview;
})(typeof knotFrame === "function" ? knotFrame : null, typeof rarityFrame === "function" ? rarityFrame : null);
