"use strict";

/* フィールド専用。番号は表示中のカードを使う（進化元ではない）。
   原画を差し替えたら tools/field-card-art-preview.html で顔と数値の重なりを確認する。
   レガシーの札は縦長なので、絵を縮めて全体を出すと上下に黒い帯が出る。レガシーは position で主役が入る位置に寄せて札いっぱいに出す。
   wide（名前帯・効果欄を除いた絵柄全体を表示）は、札が正方形に近いレリックだけに使う。 */
const FIELD_CARD_ART_CROPS = Object.freeze({
  "1": { position: "63.5% 9.5%", size: "auto 190%" }, // アカマツ
  "2": { position: "63.5% 9.5%", size: "auto 190%" }, // アカマツ
  "3": { position: "55.5% 8%" }, // 戦陣の旗手
  "4": { position: "55.5% 8%" }, // 戦陣の旗手
  "5": { position: "62% 10.5%", size: "auto 215%" }, // 夜風の始末屋
  "6": { position: "62% 10.5%", size: "auto 215%" }, // 夜風の始末屋
  "7": { position: "79% 10%", size: "auto 195%" }, // 鐘鳴らしの童
  "8": { position: "79% 10%", size: "auto 195%" }, // 鐘鳴らしの童
  "9": { position: "72.5% 11.5%" }, // 札遊びの座敷童
  "10": { position: "72.5% 11.5%" }, // 札遊びの座敷童
  "11": { position: "62.5% 12%", size: "auto 195%" }, // 音速の忍
  "12": { position: "57% 11.5%", size: "auto 215%" }, // 隠居の老忍
  "13": { position: "64.5% 12%" }, // イロハ：本人と左の2人を収める
  "14": { position: "61.5% 14.5%", size: "auto 225%" }, // 無双の影法師
  "15": { position: "63.5% 11%", size: "auto 210%" }, // ゲンザン
  "16": { position: "66% 11%", size: "auto 210%" }, // ツバキ
  "17": { position: "74.5% 12.5%", size: "auto 205%" }, // 猛き赤の眷属：右端の頭
  "18": { position: "59% 17%", size: "auto 210%" }, // 先駆けの修羅
  "19": { position: "63% 13.5%", size: "auto 210%" }, // カゲロウ
  "20": { position: "77.5% 14%", size: "auto 205%" }, // 傲慢なる翼の竜人
  "21": { position: "65.5% 11%" }, // ルベル
  "22": { position: "61% 10.5%" }, // 忍の王
  "23": { position: "66% 15%", size: "auto 210%" }, // 死を纏う器
  "24": { position: "60% 14%", size: "auto 205%" }, // シラトリ
  "25": { position: "60% 14%", size: "auto 205%" }, // シラトリ
  "26": { position: "59% 14%" }, // ソウリュウ
  "27": { position: "59% 14%" }, // ソウリュウ
  "28": { position: "60% 14%" }, // レンゲ
  "29": { position: "60% 14%" }, // レンゲ
  "30": { position: "67% 12.5%" }, // 平穏の祈り手
  "31": { position: "67% 12.5%" }, // 平穏の祈り手
  "32": { position: "52.5% 14.5%" }, // 静寂の雪少女
  "33": { position: "52.5% 14.5%" }, // 静寂の雪少女
  "34": { position: "68.5% 10.5%", size: "auto 210%" }, // 胡蝶の密偵
  "35": { position: "68% 14.5%" }, // 誇り高き名工
  "36": { position: "68% 19.5%", size: "auto 215%" }, // 名刀集めの豪族：本人と左の従者
  "37": { position: "72% 15%", size: "auto 205%" }, // 千刃の破戒僧
  "38": { position: "59% 14%" }, // 神出鬼没の小鼠
  "39": { position: "64.5% 16%" }, // シジマ
  "40": { position: "65.5% 13%" }, // 深き青の眷属
  "41": { position: "69% 16.5%", size: "auto 210%" }, // ハゼ
  "42": { position: "68.5% 14.5%" }, // サナエ
  "43": { position: "61% 16%" }, // 嫉妬深き鱗の竜人
  "44": { position: "59.5% 12.5%", size: "auto 205%" }, // サフィロス
  "45": { position: "62% 13%" }, // ソウリュウ
  "46": { position: "64.5% 14%" }, // シンゲツ
  "47": { position: "62% 12.5%" }, // 大得物の少女
  "48": { position: "62% 12.5%" }, // 大得物の少女
  "49": { position: "67% 18%", size: "auto 220%" }, // 冥土送りの侍女
  "50": { position: "67% 18%", size: "auto 220%" }, // 冥土送りの侍女
  "51": { position: "62.5% 11.5%", size: "auto 205%" }, // ライカ
  "52": { position: "62.5% 11.5%", size: "auto 205%" }, // ライカ
  "53": { position: "66.5% 12.5%" }, // 史を紡ぐ語り部
  "54": { position: "66.5% 12.5%" }, // 史を紡ぐ語り部
  "55": { position: "69% 18%", size: "auto 215%" }, // 二尾の猫女
  "56": { position: "69% 18%", size: "auto 215%" }, // 二尾の猫女
  "57": { position: "42.5% 9.5%", size: "auto 195%" }, // 無貌の忍
  "58": { position: "65.5% 12%", size: "auto 205%" }, // コマ
  "59": { position: "57% 18%", size: "auto 220%" }, // 葛ノ葉亭の若女将
  "60": { position: "63% 17.5%", size: "auto 205%" }, // ハクレン
  "61": { position: "69.5% 12.5%" }, // もふもふ探求者
  "62": { position: "64.5% 25.5%", size: "auto 235%" }, // 幽玄の面霊姫
  "63": { position: "54% 11%", size: "auto 195%" }, // 荒き緑の眷属
  "64": { position: "64.5% 17%", size: "auto 205%" }, // 算盤弾きの刀剣商
  "65": { position: "66.5% 13%", size: "auto 210%" }, // ライカ＆コマ：少女と獣の顔
  "66": { position: "64% 10%", size: "auto 210%" }, // 暴食たる牙の竜人
  "67": { position: "65.5% 13%" }, // ヴィリデ
  "68": { position: "82% 15.5%", size: "auto 210%" }, // 飛苦無の淑女
  "69": { position: "67% 10%" }, // 冷徹なる首領
  "70": { position: "65% 14.5%" }, // ユズリハ
  "71": { position: "65% 14.5%" }, // ユズリハ
  "72": { position: "65% 12%" }, // カシマ
  "73": { position: "65% 12%" }, // カシマ
  "74": { position: "67.5% 12%" }, // 飄々たる諜報員
  "75": { position: "67.5% 12%" }, // 飄々たる諜報員
  "76": { position: "66.5% 14%" }, // ミナト
  "77": { position: "66.5% 14%" }, // ミナト
  "78": { position: "43% 17.5%", size: "auto 220%" }, // 逢魔ヶ淵の渡し守：渡し守を中央に
  "79": { position: "43% 17.5%", size: "auto 220%" }, // 逢魔ヶ淵の渡し守：渡し守を中央に
  "80": { position: "67% 14%" }, // アヤト
  "81": { position: "58% 14%" }, // 麗しの狐姫
  "82": { position: "58.5% 17%", size: "auto 210%" }, // チフユ
  "83": { position: "60.5% 16.5%", size: "auto 210%" }, // ミズホ
  "84": { position: "67.5% 11.5%" }, // お節介な陰陽師
  "85": { position: "65% 14.5%", size: "auto 205%" }, // 陰陽かぶれの犬神
  "86": { position: "64.5% 11%", size: "auto 205%" }, // 眩き黄の眷属
  "87": { position: "60.5% 17%", size: "auto 225%" }, // ヤマブキ
  "88": { position: "65.5% 12%" }, // 厳格なる騎士
  "89": { position: "60.5% 21%", size: "auto 220%" }, // ミナト
  "90": { position: "64% 20.5%", size: "auto 225%" }, // 怠惰なる角の竜人
  "91": { position: "76% 20%", size: "auto 230%" }, // 千変万化の大妖狐
  "92": { position: "69% 15.5%" }, // フラウス
  "93": { position: "66.5% 10.5%", size: "auto 190%" }, // 二つ影の絡繰師：2人の顔
  "94": { position: "66.5% 10.5%", size: "auto 190%" }, // 二つ影の絡繰師：2人の顔
  "95": { position: "68.5% 13%" }, // 妖刀を抱く乙女
  "96": { position: "68.5% 13%" }, // 妖刀を抱く乙女
  "97": { position: "65% 12.5%" }, // 八百万の代弁者
  "99": { position: "60% 16.5%", size: "auto 205%" }, // 水晶覗きの隠者
  "100": { position: "60% 16.5%", size: "auto 205%" }, // 水晶覗きの隠者
  "101": { position: "66.5% 21.5%", size: "auto 220%" }, // ヨルヒメ
  "102": { position: "66.5% 21.5%", size: "auto 220%" }, // ヨルヒメ
  "103": { position: "68.5% 15.5%" }, // 不屈の武者
  "104": { position: "58.5% 16.5%", size: "auto 210%" }, // 厳粛なる修道女
  "105": { position: "63.5% 16.5%", size: "auto 210%" }, // 不器用な勧誘人
  "106": { position: "57% 10%", size: "auto 205%" }, // 貪食の童女：少女と髪の口
  "107": { position: "65% 16%", size: "auto 210%" }, // ヨルヒメ
  "108": { position: "56.5% 11%" }, // 紫焔の妖将
  "109": { position: "66.5% 13%" }, // 昏き紫の眷属
  "110": { position: "67.5% 14%" }, // イズモ
  "111": { position: "64.5% 14%" }, // アラシ
  "112": { position: "62.5% 16.5%", size: "auto 210%" }, // マガツヒ
  "113": { position: "62% 18%", size: "auto 215%" }, // 強欲なる爪の竜人
  "114": { position: "68% 15.5%", size: "auto 210%" }, // 怨嗟の狂骨：少女と髑髏
  "115": { position: "69.5% 14%" }, // プルプラ
  "141": { position: "71.5% 12%" }, // 恐怖の手記
  "142": { position: "71.5% 12%" }, // 恐怖の手記
  "143": { position: "82% 19%" }, // 月見草の修行場
  "144": { position: "82% 19%" }, // 月見草の修行場
  "145": { position: "71% 17%" }, // 木漏れ日の道場
  "147": { position: "68% 11%", size: "auto 215%" }, // 交差する想い
  "148": { position: "68% 11%", size: "auto 215%" }, // 交差する想い
  "149": { position: "61.5% 11.5%" }, // 禁忌の祭壇
  "150": { position: "61.5% 11.5%" }, // 禁忌の祭壇
  "166": { position: "66% 10%" }, // 命の香煙
  "167": { position: "66% 10%" }, // 命の香煙
  "168": { position: "69.5% 9.5%", size: "auto 185%" }, // 色彩の旅絵巻：各場面の人物
  "169": { position: "73% 11.5%", size: "auto 210%" }, // 暁の盟約
  "170": { position: "73% 11.5%", size: "auto 210%" }, // 暁の盟約
  "176": { position: "78% 12%", size: "auto 190%" }, // 鎮魂の花畑
  "177": { position: "66% 12%" }, // 呪縛の玉座
  "178": { position: "72% 11%", size: "auto 195%" }, // 歓喜の凱旋
  "179": { position: "69% 7%", size: "auto 185%" }, // 哀悼の影：左右の龍と人物
  "180": { position: "69% 8%" }, // 落日の子守唄：原画の口元と赤子を保持（原画に目は描かれていない）
  "181": { position: "67.5% 13.5%", size: "auto 225%" }, // ヨリシロちゃん
  "182": { position: "66.5% 13%" }, // 影分身
  "183": { position: "60% 11%" }, // 猛進する獣霊
  "184": { position: "61.5% 18.5%", size: "auto 215%" }, // 天駆ける獣霊
  "185": { position: "65% 15%" }, // 巨躯なる獣霊
  "186": { position: "75.5% 11.5%" }, // 社の施し
  "187": { position: "63.5% 12%" }, // 隷属の龍血
  "188": { position: "64% 18%" }, // 天喰らう咆哮
  "198": { position: "63.5% 10.5%", size: "auto 190%" }, // ディエスイレ：中央の頭
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
