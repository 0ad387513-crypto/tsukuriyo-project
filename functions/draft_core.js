"use strict";

const { pairingsForSession } = require("./pairings_core.js");

const DRAFT_ROUND_CONFIG = Object.freeze({
  1: { numSets: 3, bundleSize: 10, direction: "L" },
  2: { numSets: 1, bundleSize: 10, direction: "R" },
  3: { numSets: 1, bundleSize: 5, direction: "L" },
});

function mulberry32(seed) {
  return function random() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle(values, random) {
  const out = values.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function packCards(pack) {
  return pack && Array.isArray(pack.cards) ? pack.cards : [];
}

function rotatePacks(packs, direction) {
  const out = {};
  for (let seat = 1; seat <= 4; seat++) {
    const target = direction === "L" ? (seat === 1 ? 4 : seat - 1) : (seat === 4 ? 1 : seat + 1);
    out[target] = packs[seat];
  }
  return out;
}

function dealDraftSets(cardNos, seed, round) {
  const cfg = DRAFT_ROUND_CONFIG[round];
  if (!cfg) throw new Error(`不正なドラフトラウンドです: ${round}`);
  const required = cfg.numSets * 4 * cfg.bundleSize;
  const pool = (cardNos || []).map(String);
  if (pool.length < required) throw new Error(`カードプールが不足しています（必要${required}枚 / ${pool.length}枚）`);
  const shuffled = seededShuffle(pool, mulberry32(((seed | 0) + round * 777 + 31) | 0));
  const sets = [];
  let index = 0;
  for (let setIndex = 0; setIndex < cfg.numSets; setIndex++) {
    const packs = {};
    for (let seat = 1; seat <= 4; seat++) {
      packs[seat] = {
        round,
        origSeat: seat,
        setIdx: setIndex,
        cards: shuffled.slice(index, index + cfg.bundleSize),
      };
      index += cfg.bundleSize;
    }
    sets.push(packs);
  }
  return sets;
}

function createDraftState({ round, cardNos, seed, decks = {}, converted = {}, freeReturned = {}, orochiSeats = [] }) {
  const cfg = DRAFT_ROUND_CONFIG[round];
  if (!cfg) throw new Error(`不正なドラフトラウンドです: ${round}`);
  const sets = dealDraftSets(cardNos, seed, round);
  const directionRandom = mulberry32(((seed | 0) + round * 7919) | 0);
  const directions = sets.map(() => directionRandom() < 0.5 ? "L" : "R");
  return {
    seed: Number(seed) || 0,
    round,
    numSets: cfg.numSets,
    bundleSize: cfg.bundleSize,
    direction: directions[0] || cfg.direction,
    directions,
    setIndex: 0,
    step: 0,
    revision: 1,
    sets,
    packs: sets[0],
    picks: {},
    decks: { 1: [...(decks[1] || [])], 2: [...(decks[2] || [])], 3: [...(decks[3] || [])], 4: [...(decks[4] || [])] },
    converted: { 1: [...(converted[1] || [])], 2: [...(converted[2] || [])], 3: [...(converted[3] || [])], 4: [...(converted[4] || [])] },
    freeReturned: JSON.parse(JSON.stringify(freeReturned || {})),
    orochiSeats: [...new Set((orochiSeats || []).map(Number).filter(seat => [1, 2, 3, 4].includes(seat)))],
    diesIraeGrantedSeats: [],
    phase: "draft",
    done: false,
  };
}

function chooseCpuCard(state, seat) {
  const cards = packCards(state.packs && state.packs[seat]);
  if (!cards.length) return null;
  const salt = state.round * 100000 + state.setIndex * 1000 + state.step * 10 + Number(seat);
  const random = mulberry32(((state.seed || 0) + salt) | 0);
  return cards[Math.floor(random() * cards.length)];
}

function resolveStep(state) {
  if (![1, 2, 3, 4].every(seat => state.picks[seat] != null)) return state;
  const remaining = {};
  for (let seat = 1; seat <= 4; seat++) {
    const pack = state.packs[seat];
    const cards = packCards(pack).slice();
    const chosen = String(state.picks[seat]);
    const index = cards.findIndex(cardNo => String(cardNo) === chosen);
    if (index < 0) throw new Error(`席${seat}の選択カードがパックにありません`);
    cards.splice(index, 1);
    state.decks[seat].push(chosen);
    remaining[seat] = { ...pack, cards };
  }
  state.packs = rotatePacks(remaining, state.direction);
  state.picks = {};
  state.step += 1;
  if ([1, 2, 3, 4].every(seat => packCards(state.packs[seat]).length === 0)) {
    if (state.setIndex < state.numSets - 1) {
      state.setIndex += 1;
      state.packs = state.sets[state.setIndex];
      state.direction = state.directions[state.setIndex] || state.direction;
      state.step = 0;
    } else {
      if (Number(state.round) === 3) {
        state.diesIraeGrantedSeats = [];
        for (const seat of state.orochiSeats || []) {
          state.decks[seat] = state.decks[seat] || [];
          if (!state.decks[seat].some(no => String(no) === "198")) state.decks[seat].push("198");
          state.diesIraeGrantedSeats.push(Number(seat));
        }
      }
      state.done = true;
      state.completedRound = state.round;
      state.phase = "draft_done";
    }
  }
  return state;
}

function applyDraftPick(state, seat, cardNo, cpuSeats = []) {
  if (!state || state.done) throw new Error("ドラフトは進行中ではありません");
  const normalizedSeat = Number(seat);
  if (![1, 2, 3, 4].includes(normalizedSeat)) throw new Error("不正な席番号です");
  if (state.picks[normalizedSeat] != null) throw new Error("この手番では選択済みです");
  const normalizedCardNo = String(cardNo);
  if (!packCards(state.packs[normalizedSeat]).some(no => String(no) === normalizedCardNo)) {
    throw new Error("選択したカードは現在のパックにありません");
  }
  state.picks[normalizedSeat] = normalizedCardNo;
  for (const cpuSeat of cpuSeats.map(Number)) {
    if (state.picks[cpuSeat] == null) {
      const cpuCard = chooseCpuCard(state, cpuSeat);
      if (cpuCard != null) state.picks[cpuSeat] = String(cpuCard);
    }
  }
  state.revision = Number(state.revision || 0) + 1;
  return resolveStep(state);
}

function publicDraftState(state) {
  return {
    round: state.round,
    numSets: state.numSets,
    bundleSize: state.bundleSize,
    direction: state.direction,
    directions: state.directions,
    setIndex: state.setIndex,
    step: state.step,
    revision: Number(state.revision || 0),
    picks: Object.fromEntries(Object.keys(state.picks || {}).map(seat => [seat, true])),
    done: !!state.done,
    ...(state.completedRound ? { completedRound: state.completedRound } : {}),
    ...(state.diesIraeGrantedSeats && state.diesIraeGrantedSeats.length
      ? { diesIraeGrantedSeats: state.diesIraeGrantedSeats.map(Number) }
      : {}),
  };
}

function privateDraftState(state, seat) {
  const ownFreeReturned = {};
  for (const [round, seats] of Object.entries(state.freeReturned || {})) {
    ownFreeReturned[round] = seats && seats[seat] ? seats[seat] : [];
  }
  return {
    round: state.round,
    setIndex: state.setIndex,
    step: state.step,
    revision: Number(state.revision || 0),
    pack: state.packs && state.packs[seat] ? state.packs[seat] : null,
    deck: state.decks && state.decks[seat] ? state.decks[seat] : [],
    converted: state.converted && state.converted[seat] ? state.converted[seat] : [],
    freeReturned: ownFreeReturned,
    insight: Number(state.insight && state.insight[seat] || 0),
    bloomOffer: state.bloomOffers && state.bloomOffers[seat] || [],
    fusionUsed: !!(state.fusionUsed && state.fusionUsed[state.round] && state.fusionUsed[state.round][seat]),
    mulliganRight: !!(state.mulliganRights && state.mulliganRights[seat]),
    deepenDone: !!(state.deepenDone && state.deepenDone[seat]),
    picked: state.picks && state.picks[seat] != null,
    done: !!state.done,
  };
}

function freeReturnLimit(round) {
  return Number(round) === 1 ? 1 : ([2, 3].includes(Number(round)) ? 2 : 0);
}

function applyFreeReturn(state, seat, cardNo) {
  if (!state || !state.done) throw new Error("ドラフト完了後にのみ返還できます");
  const normalizedSeat = Number(seat);
  const round = Number(state.completedRound || state.round);
  const limit = freeReturnLimit(round);
  const roundKey = String(round);
  state.freeReturned = state.freeReturned || {};
  state.freeReturned[roundKey] = state.freeReturned[roundKey] || {};
  const returned = state.freeReturned[roundKey][normalizedSeat] || [];
  if (returned.length >= limit) throw new Error(`このラウンドでは${limit}枚まで返還できます`);
  const deck = state.decks[normalizedSeat] || [];
  const normalizedCardNo = String(cardNo);
  const index = deck.findIndex(no => String(no) === normalizedCardNo);
  if (index < 0) throw new Error("返還するカードがデッキにありません");
  deck.splice(index, 1);
  returned.push(normalizedCardNo);
  state.freeReturned[roundKey][normalizedSeat] = returned;
  state.converted = state.converted || {};
  state.converted[normalizedSeat] = state.converted[normalizedSeat] || [];
  state.converted[normalizedSeat].push(normalizedCardNo);
  state.revision = Number(state.revision || 0) + 1;
  return state;
}

function undoFreeReturn(state, seat, cardNo) {
  if (!state || !state.done) throw new Error("ドラフト完了後にのみ返還を取り消せます");
  const normalizedSeat = Number(seat);
  const roundKey = String(state.completedRound || state.round);
  const returned = state.freeReturned && state.freeReturned[roundKey] && state.freeReturned[roundKey][normalizedSeat] || [];
  const normalizedCardNo = String(cardNo);
  const returnedIndex = returned.findIndex(no => String(no) === normalizedCardNo);
  if (returnedIndex < 0) throw new Error("取り消す返還履歴がありません");
  const converted = state.converted && state.converted[normalizedSeat] || [];
  const convertedIndex = converted.findIndex(no => String(no) === normalizedCardNo);
  if (convertedIndex < 0) throw new Error("星魂との整合性を確認できません");
  returned.splice(returnedIndex, 1);
  converted.splice(convertedIndex, 1);
  state.decks[normalizedSeat].push(normalizedCardNo);
  state.revision = Number(state.revision || 0) + 1;
  return state;
}

function wonPreviousBattle(session, round, seat) {
  const battle = session.battles && session.battles[round];
  const pairs = pairingsForSession(session, round);
  if (!battle || !pairs) return false;
  if (pairs[0].includes(seat)) return Number(battle.t1Winner) === seat;
  if (pairs[1].includes(seat)) return Number(battle.t2Winner) === seat;
  return false;
}

function startDeepenState(state, session, cpuSeats = []) {
  if (!state || !state.done) throw new Error("ドラフトと無料返還が完了していません");
  if (state.phase === "deepen" || state.phase === "battle") return state;
  const round = Number(state.round || 1);
  state.insight = state.insight || {};
  state.insightAwarded = state.insightAwarded || {};
  if (!state.insightAwarded[round]) {
    for (let seat = 1; seat <= 4; seat++) {
      const award = round === 1 ? 1 : (wonPreviousBattle(session, round - 1, seat) ? 1 : 3);
      state.insight[seat] = Number(state.insight[seat] || 0) + award;
    }
    state.insightAwarded[round] = true;
  }
  state.deepenDone = {};
  for (const seat of cpuSeats.map(Number)) state.deepenDone[seat] = true;
  state.bloomOffers = {};
  state.phase = "deepen";
  state.revision = Number(state.revision || 0) + 1;
  return state;
}

function assertDeepenAction(state, seat, cost) {
  if (!state || state.phase !== "deepen") throw new Error("現在は深化を行えません");
  if (state.deepenDone && state.deepenDone[seat]) throw new Error("深化は完了済みです");
  if (Number(state.insight && state.insight[seat] || 0) < cost) throw new Error("見識が不足しています");
}

function applyDeepenReflect(state, seat, cardNo) {
  const normalizedSeat = Number(seat);
  assertDeepenAction(state, normalizedSeat, 1);
  const card = String(cardNo);
  const deck = state.decks[normalizedSeat] || [];
  const index = deck.findIndex(no => String(no) === card);
  if (index < 0) throw new Error("省察するカードがデッキにありません");
  deck.splice(index, 1);
  state.converted = state.converted || {};
  state.converted[normalizedSeat] = state.converted[normalizedSeat] || [];
  state.converted[normalizedSeat].push(card);
  state.insight[normalizedSeat] -= 1;
  state.revision = Number(state.revision || 0) + 1;
  return state;
}

function applyDeepenFusion(state, seat) {
  const normalizedSeat = Number(seat);
  assertDeepenAction(state, normalizedSeat, 2);
  const round = String(state.round);
  state.fusionUsed = state.fusionUsed || {};
  state.fusionUsed[round] = state.fusionUsed[round] || {};
  if (state.fusionUsed[round][normalizedSeat]) throw new Error("このラウンドでは習合を使用済みです");
  state.fusionUsed[round][normalizedSeat] = true;
  state.mulliganRights = state.mulliganRights || {};
  state.mulliganRights[normalizedSeat] = true;
  state.insight[normalizedSeat] -= 2;
  state.revision = Number(state.revision || 0) + 1;
  return state;
}

function drawDeepenBloom(state, seat, genesisNos) {
  const normalizedSeat = Number(seat);
  assertDeepenAction(state, normalizedSeat, 3);
  state.bloomOffers = state.bloomOffers || {};
  if (state.bloomOffers[normalizedSeat]) throw new Error("理の開花の選択が完了していません");
  const pool = [...new Set((genesisNos || []).map(String))];
  if (pool.length < 3 || pool.some(no => !/^\d{1,4}$/.test(no))) throw new Error("ジェネシスカードプールが不正です");
  const random = mulberry32((Number(state.seed || 0) + Number(state.revision || 0) * 97 + normalizedSeat) | 0);
  state.bloomOffers[normalizedSeat] = seededShuffle(pool, random).slice(0, 3);
  state.insight[normalizedSeat] -= 3;
  state.revision = Number(state.revision || 0) + 1;
  return state;
}

function pickDeepenBloom(state, seat, cardNo) {
  const normalizedSeat = Number(seat);
  assertDeepenAction(state, normalizedSeat, 0);
  const card = String(cardNo);
  const offer = state.bloomOffers && state.bloomOffers[normalizedSeat] || [];
  if (!offer.includes(card)) throw new Error("提示されたカードではありません");
  state.decks[normalizedSeat].push(card);
  delete state.bloomOffers[normalizedSeat];
  state.revision = Number(state.revision || 0) + 1;
  return state;
}

function setDeepenDone(state, seat, done) {
  const normalizedSeat = Number(seat);
  if (!state || state.phase !== "deepen") throw new Error("現在は深化完了を変更できません");
  if (done && state.bloomOffers && state.bloomOffers[normalizedSeat]) throw new Error("理の開花のカードを選択してください");
  state.deepenDone = state.deepenDone || {};
  state.deepenDone[normalizedSeat] = !!done;
  if ([1, 2, 3, 4].every(n => state.deepenDone[n])) state.phase = "battle";
  state.revision = Number(state.revision || 0) + 1;
  return state;
}

module.exports = {
  DRAFT_ROUND_CONFIG,
  dealDraftSets,
  createDraftState,
  applyDraftPick,
  publicDraftState,
  privateDraftState,
  applyFreeReturn,
  undoFreeReturn,
  freeReturnLimit,
  startDeepenState,
  applyDeepenReflect,
  applyDeepenFusion,
  drawDeepenBloom,
  pickDeepenBloom,
  setDeepenDone,
  rotatePacks,
};
