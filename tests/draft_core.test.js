"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  createDraftState,
  applyDraftPick,
  publicDraftState,
  privateDraftState,
  applyFreeReturn,
  undoFreeReturn,
  startDeepenState,
  applyDeepenReflect,
  applyDeepenFusion,
  drawDeepenBloom,
  pickDeepenBloom,
  setDeepenDone,
} = require("../functions/draft_core.js");

function pool(size) { return Array.from({ length: size }, (_, i) => String(i + 1)); }

function completedRound3(seed = 1) {
  const state = createDraftState({ round: 3, cardNos: pool(20), seed });
  for (let step = 0; step < 5; step++) {
    for (let seat = 1; seat <= 4; seat++) applyDraftPick(state, seat, privateDraftState(state, seat).pack.cards[0]);
  }
  return state;
}

test("公開ドラフト状態にパックとデッキを含めない", () => {
  const state = createDraftState({ round: 1, cardNos: pool(120), seed: 42 });
  const publicState = publicDraftState(state);
  assert.equal(publicState.round, 1);
  assert.equal("packs" in publicState, false);
  assert.equal("sets" in publicState, false);
  assert.equal("decks" in publicState, false);
  assert.equal(privateDraftState(state, 1).pack.cards.length, 10);
});

test("パック外カードと同一手番の二重選択を拒否する", () => {
  const state = createDraftState({ round: 3, cardNos: pool(20), seed: 10 });
  assert.throws(() => applyDraftPick(state, 1, "not-in-pack"), /パックにありません/);
  const chosen = privateDraftState(state, 1).pack.cards[0];
  applyDraftPick(state, 1, chosen);
  assert.throws(() => applyDraftPick(state, 1, chosen), /選択済み/);
});

test("CPU席をサーバーで選択し、全員選択後にパックを回す", () => {
  const state = createDraftState({ round: 3, cardNos: pool(20), seed: 99 });
  const seat1Card = privateDraftState(state, 1).pack.cards[0];
  applyDraftPick(state, 1, seat1Card, [2, 3, 4]);
  assert.equal(state.step, 1);
  assert.equal(state.decks[1][0], seat1Card);
  assert.equal(state.decks[2].length, 1);
  assert.equal(Object.keys(state.picks).length, 0);
  assert.equal(privateDraftState(state, 1).pack.cards.length, 4);
});

test("5枚束のラウンドを最後まで完了できる", () => {
  const state = createDraftState({ round: 3, cardNos: pool(20), seed: 123 });
  for (let step = 0; step < 5; step++) {
    for (let seat = 1; seat <= 4; seat++) {
      const card = privateDraftState(state, seat).pack.cards[0];
      applyDraftPick(state, seat, card);
    }
  }
  assert.equal(state.done, true);
  assert.equal(state.completedRound, 3);
  assert.deepEqual(Object.values(state.decks).map(deck => deck.length), [5, 5, 5, 5]);
});

test("無料返還は上限とデッキ在籍を検証し、取消で元に戻す", () => {
  const state = createDraftState({ round: 3, cardNos: pool(20), seed: 321 });
  for (let step = 0; step < 5; step++) {
    for (let seat = 1; seat <= 4; seat++) applyDraftPick(state, seat, privateDraftState(state, seat).pack.cards[0]);
  }
  const original = state.decks[1].slice();
  applyFreeReturn(state, 1, original[0]);
  applyFreeReturn(state, 1, original[1]);
  assert.equal(state.decks[1].length, 3);
  assert.equal(state.converted[1].length, 2);
  assert.throws(() => applyFreeReturn(state, 1, original[2]), /2枚まで/);
  undoFreeReturn(state, 1, original[0]);
  assert.equal(state.decks[1].length, 4);
  assert.equal(state.converted[1].length, 1);
});

test("本人用スナップショットに他席の返還内容を含めない", () => {
  const state = createDraftState({ round: 3, cardNos: pool(20), seed: 11, freeReturned: { 2: { 1: ["a"], 2: ["secret"] } } });
  const mine = privateDraftState(state, 1);
  assert.deepEqual(mine.freeReturned, { 2: ["a"] });
  assert.equal(JSON.stringify(mine).includes("secret"), false);
});

test("深化開始は勝敗に応じた見識を一度だけ付与する", () => {
  const state = completedRound3();
  state.round = 2;
  state.phase = "draft_done";
  const session = { seats: { 1: {}, 2: {}, 3: {}, 4: {} }, battles: { 1: { t1Winner: 1, t2Winner: 3 } } };
  startDeepenState(state, session);
  assert.deepEqual(state.insight, { 1: 1, 2: 3, 3: 1, 4: 3 });
  startDeepenState(state, session);
  assert.deepEqual(state.insight, { 1: 1, 2: 3, 3: 1, 4: 3 });
});

test("省察と習合はサーバー正本のデッキ・見識・使用回数を検証する", () => {
  const state = completedRound3();
  state.insight = { 1: 4, 2: 0, 3: 0, 4: 0 };
  state.phase = "deepen";
  const card = state.decks[1][0];
  applyDeepenReflect(state, 1, card);
  assert.equal(state.decks[1].includes(card), false);
  assert.equal(state.converted[1].includes(card), true);
  applyDeepenFusion(state, 1);
  assert.equal(state.mulliganRights[1], true);
  assert.equal(state.insight[1], 1);
  assert.throws(() => applyDeepenFusion(state, 1), /見識が不足|使用済み/);
});

test("理の開花は本人専用候補からだけ選択できる", () => {
  const state = completedRound3();
  state.insight = { 1: 3 };
  state.phase = "deepen";
  drawDeepenBloom(state, 1, ["201", "202", "203", "204"]);
  const offer = privateDraftState(state, 1).bloomOffer;
  assert.equal(offer.length, 3);
  assert.throws(() => pickDeepenBloom(state, 1, "999"), /提示されたカード/);
  pickDeepenBloom(state, 1, offer[0]);
  assert.equal(state.decks[1].includes(offer[0]), true);
  assert.deepEqual(privateDraftState(state, 1).bloomOffer, []);
});

test("CPU席を完了済みにして、人間全員の完了後に星戦へ進む", () => {
  const state = completedRound3();
  startDeepenState(state, { seats: { 1: {}, 2: {}, 3: { isCpu: true }, 4: { isCpu: true } } }, [3, 4]);
  assert.equal(state.deepenDone[3], true);
  setDeepenDone(state, 1, true);
  assert.equal(state.phase, "deepen");
  setDeepenDone(state, 2, true);
  assert.equal(state.phase, "battle");
});

test("公開セッションは対戦前のデッキを消し、終戦時だけサーバーから公開する", () => {
  const root = path.join(__dirname, "..");
  const functionsSource = fs.readFileSync(path.join(root, "functions", "index.js"), "utf8");
  const pageSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(functionsSource, /session\.decks = null/);
  assert.match(functionsSource, /exports\.revealServerScoring/);
  assert.match(functionsSource, /exports\.recordServerBattleResult/);
  assert.match(functionsSource, /ホストだけが勝敗を記録できます/);
  assert.match(pageSource, /_battleHiddenDeckCards\(deckCounts\[oppSeat\]/);
  assert.doesNotMatch(pageSource, /oppDeck: this\.gsNorm\(decks\[oppSeat\]\)/);
});
