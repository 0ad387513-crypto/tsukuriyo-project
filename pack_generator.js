/**
 * pack_generator.js  v2
 * シールド戦用パック生成ロジック
 *
 * 確定済みカードプール仕様:
 *   - 対象180枚（トークン・ジェネシス・カミ除外）
 *   - 返還値合計 = 255（= 17 × 15パック）
 *   - 返還値0のカード = 15枚
 *   - 返還値1のカード = 75枚  → 低返還値(0/1) 計90枚
 *   - 返還値2のカード = 90枚（255 - 0×15 - 1×75 = 180 → 180/2 = 90枚）
 *
 * パック仕様:
 *   - 15パック × 12枚 = 180枚
 *   - 各パック：返還値合計 = 17
 *   - 各パック：可視スロット3枚 = 返還値0か1のカード（後攻/先攻が見て選ぶ）
 *   - 各パック：残り9枚 = 非公開
 */

"use strict";

const PACK_COUNT    = 15;
const PACK_SIZE     = 12;
const VISIBLE_COUNT = 3;
const TARGET_SUM    = 17;

/* ------------------------------------------------------------------ */
/* Mulberry32 シード付き乱数                                            */
/* ------------------------------------------------------------------ */
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ------------------------------------------------------------------ */
/* カード適格チェック                                                   */
/* ------------------------------------------------------------------ */
function isEligible(card) {
  if (card.isToken)          return false;
  if (card.isKami)           return false;
  if (card.color === "創")   return false;
  if (card.category === "ジェネシス") return false;
  return true;
}

function returnVal(card) {
  const v = parseInt(card.return, 10);
  return isNaN(v) ? 0 : v;
}

/* ------------------------------------------------------------------ */
/* 前提条件の検証                                                        */
/* ------------------------------------------------------------------ */
function validatePool(cards) {
  const total    = cards.reduce((s, c) => s + returnVal(c), 0);
  const r0Count  = cards.filter(c => returnVal(c) === 0).length;
  const r1Count  = cards.filter(c => returnVal(c) === 1).length;
  const r2Count  = cards.filter(c => returnVal(c) === 2).length;
  const lowCount = r0Count + r1Count;
  const warnings = [];

  if (cards.length !== 180) {
    warnings.push(`カード枚数が180枚ではありません（${cards.length}枚）`);
  }
  if (total !== 255) {
    warnings.push(`全カード返還値合計が255ではありません（実際: ${total}）。パック生成に影響が出る場合があります。`);
  }
  if (lowCount < PACK_COUNT * VISIBLE_COUNT) {
    warnings.push(`返還値0/1のカードが${PACK_COUNT * VISIBLE_COUNT}枚未満です（実際: ${lowCount}枚）`);
  }

  return { total, r0Count, r1Count, r2Count, lowCount, warnings };
}

/* ------------------------------------------------------------------ */
/* メイン：パック生成                                                   */
/*                                                                      */
/* アルゴリズム（確定データに最適化）:                                   */
/*                                                                      */
/*  返還値分布: r0=15枚, r1=75枚, r2=90枚                               */
/*                                                                      */
/*  各パックで必要な構成（可視3枚 + 非公開9枚 = 合計17）:               */
/*  ┌─────────────────────────────────────────────────────────────┐   */
/*  │ 可視3枚の返還値合計 V = 0〜3                                   │   */
/*  │ 非公開9枚の必要合計 H = 17 - V = 14〜17                        │   */
/*  │                                                               │   */
/*  │ H=14: r2×7 + r0×2  (7×2 + 2×0 = 14)                         │   */
/*  │ H=15: r2×7 + r1×1 + r0×1  (14+1+0=15)                       │   */
/*  │ H=16: r2×8 + r0×1  (16+0=16)                                 │   */
/*  │ H=17: r2×8 + r1×1  (16+1=17)                                 │   */
/*  └─────────────────────────────────────────────────────────────┘   */
/*                                                                      */
/*  合計チェック:                                                        */
/*  - 可視に使うr0/r1: 3×15 = 45枚  (低返還値90枚から)                 */
/*  - 非公開に使うr2: 90枚全部 + 調整分のr0/r1                          */
/*  - 残りのr0/r1 45枚を非公開スロットの調整に使用 → 数学的に一致       */
/* ------------------------------------------------------------------ */
/**
 * @param {Array}  allCards  全カードデータ（isEligible フィルタ前でも可）
 * @param {number} seed      乱数シード（roomCodeToSeed() の戻り値）
 * @returns {{ packs, warnings, diagnostics }}
 */
function generatePacks(allCards, seed) {
  const rng = mulberry32(seed);

  /* 1. 対象カード抽出 */
  const eligible = allCards.filter(isEligible);
  const { total, r0Count, r1Count, r2Count, lowCount, warnings } = validatePool(eligible);

  /* 2. シャッフル */
  const shuffled = seededShuffle(eligible, rng);

  /* 3. 返還値ごとに分類 */
  const pool0 = shuffled.filter(c => returnVal(c) === 0);  // 15枚
  const pool1 = shuffled.filter(c => returnVal(c) === 1);  // 75枚
  const pool2 = shuffled.filter(c => returnVal(c) === 2);  // 90枚

  /* pool から先頭 n 枚を取り出す（破壊的） */
  const take = (pool, n) => pool.splice(0, Math.min(n, pool.length));

  /* 4. 可視スロット割り当て（各パック3枚ずつ、返還値0/1のみ）
   *    15パック × 3枚 = 45枚消費。残り45枚（r0/r1）が非公開調整用に残る。
   *
   *    最適配分:
   *    - r0 15枚 → 5パックで1枚ずつ（残り10パックはr1のみ）
   *    - r1 75枚 → 各パック2〜3枚
   *
   *    シンプル配分: 各パックにr0を1枚、r1を2枚（計3枚）
   *    15パック × r0(1) = 15枚ちょうど ✓
   *    15パック × r1(2) = 30枚消費、残り45枚がプールに残る ✓
   */
  const visiblePerPack = [];

  // r0を1枚ずつ各パックに割り振り
  const vis0 = take(pool0, PACK_COUNT);   // 15枚全部

  // r1を2枚ずつ各パックに割り振り
  const vis1pairs = [];
  for (let p = 0; p < PACK_COUNT; p++) {
    vis1pairs.push(take(pool1, 2));        // 30枚消費 → 45枚残る
  }

  for (let p = 0; p < PACK_COUNT; p++) {
    // 可視カードをシャッフルして順序をランダムに
    const vis = [vis0[p], ...vis1pairs[p]].filter(Boolean);
    visiblePerPack.push(seededShuffle(vis, rng));
  }

  /* 5. 非公開スロット割り当て
   *
   *    可視返還値合計 V = 0×1 + 1×2 = 2（各パック固定）
   *    非公開必要合計 H = 17 - 2 = 15（各パック固定）
   *
   *    H=15 の構成: r2×7 + r1×1 + r0×1 = 14 + 1 + 0 = 15 ✓
   *
   *    消費:
   *    - r2: 7枚 × 15パック = 105枚 → pool2(90枚)が不足
   *      → 不足分はpool1で補完: 15枚 × 1 = 15枚追加消費
   *    - 実際にはパックごとにV/Hが変わるため、以下の汎用アルゴリズムで処理
   */
  const packs      = [];
  let targetMisses = 0;

  // 非公開用プールを用意（r2 90枚 + 余ったr1 45枚 + 余ったr0 0枚）
  // pool1にはvis1pairs消費後の45枚が残っている
  const hiddenPool = [...pool2, ...pool1]; // pool0はvis0で全消費済み

  for (let p = 0; p < PACK_COUNT; p++) {
    const visible   = visiblePerPack[p];
    const visSum    = visible.reduce((s, c) => s + returnVal(c), 0);
    const hiddenTgt = TARGET_SUM - visSum;

    const hidden    = pickHiddenCards(hiddenPool, PACK_SIZE - VISIBLE_COUNT, hiddenTgt);
    const actualSum = visible.reduce((s, c) => s + returnVal(c), 0)
                    + hidden.reduce((s, c)  => s + returnVal(c), 0);

    const targetMet = (actualSum === TARGET_SUM);
    if (!targetMet) targetMisses++;

    packs.push({ id: p, visible, hidden, all: [...visible, ...hidden], targetMet, actualSum });
  }

  if (targetMisses > 0) {
    warnings.push(`${targetMisses}パックで返還値合計が${TARGET_SUM}になりませんでした。`);
  }

  const diagnostics = {
    eligibleCount: eligible.length,
    totalReturn:   total,
    r0Count, r1Count, r2Count,
    lowCount,
    targetMisses,
  };

  return { packs, warnings, diagnostics };
}

/* ------------------------------------------------------------------ */
/* 非公開カード選択：hiddenPool から count 枚を選び合計 target にする   */
/*                                                                      */
/* hiddenPool は r2(90枚) + r1(45枚) のみ（r0は全て可視スロットに使用） */
/* r1とr2だけで合計Tを作る: r2×k + r1×(C-k) = T → k = T - C          */
/* 例: T=15, C=9 → r2×6 + r1×3 = 12+3 = 15 ✓                          */
/* ------------------------------------------------------------------ */
function pickHiddenCards(pool, count, target) {
  // 必要枚数がpoolより多い場合は先頭から取るだけ
  if (pool.length <= count) {
    return pool.splice(0, count);
  }

  // r2とr1だけで合計targetを達成する枚数計算
  // r2 の枚数 = target - count（各r1をr2に置き換えるたびに合計+1）
  const r2need = Math.max(0, Math.min(count, target - count));
  const r1need = count - r2need;

  const result = [];

  // r2 を集める
  for (let i = 0; i < r2need; i++) {
    const idx = pool.findIndex(c => returnVal(c) === 2);
    if (idx >= 0) result.push(pool.splice(idx, 1)[0]);
    else          result.push(pool.splice(0, 1)[0]); // なければ先頭
  }

  // r1 を集める
  for (let i = 0; i < r1need; i++) {
    const idx = pool.findIndex(c => returnVal(c) === 1);
    if (idx >= 0) result.push(pool.splice(idx, 1)[0]);
    else          result.push(pool.splice(0, 1)[0]);
  }

  // それでも足りない場合は先頭から補完
  while (result.length < count && pool.length > 0) {
    result.push(pool.splice(0, 1)[0]);
  }

  return result;
}

/* ------------------------------------------------------------------ */
/* 部屋コード → シード                                                   */
/* ------------------------------------------------------------------ */
function roomCodeToSeed(roomCode) {
  let hash = 0;
  for (let i = 0; i < roomCode.length; i++) {
    hash = (Math.imul(31, hash) + roomCode.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/* ------------------------------------------------------------------ */
/* カミ候補リスト（全カミからシード順にランダムで選定）                  */
/* ------------------------------------------------------------------ */
function selectKamiCandidates(allKamiCards, seed, count) {
  count = count || 10;
  const rng      = mulberry32(seed + 9999);
  const shuffled = seededShuffle(allKamiCards, rng);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/* Node.js テスト用 */
if (typeof module !== "undefined") {
  module.exports = {
    generatePacks, validatePool, roomCodeToSeed,
    selectKamiCandidates, isEligible, mulberry32, seededShuffle,
  };
}
