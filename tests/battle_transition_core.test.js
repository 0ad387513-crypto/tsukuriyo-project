"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { validatePublicSide, validateBattleTransition } = require("../functions/battle_transition_core.js");

const side = { life: 10, mana: 1, manaMax: 2, tenryoku: 0, handCount: 4, deckCount: 30, legacies: [], relics: [], graveyard: [], crumbled: [] };
const payload = { writer: 1, activeSeat: 1, turn: 1, sides: { 1: side, 2: side }, buildVersion: "1.0.0", turnDeadlineAt: Date.now() + 10000 };

test("公開盤面の正常な遷移を受理する", () => assert.equal(validateBattleTransition(payload, null, 1, "1.0.0"), true));
test("他席・異なるビルド・秘密領域を拒否する", () => {
  assert.throws(() => validateBattleTransition(payload, null, 2, "1.0.0"), /他の座席/);
  assert.throws(() => validateBattleTransition(payload, null, 1, "2.0.0"), /バージョン/);
  assert.equal(validatePublicSide({ ...side, hand: [] }), false);
  assert.throws(() => validateBattleTransition({ ...payload, sides: { 1: { ...side, deck: [] }, 2: side } }, null, 1, "1.0.0"), /公開領域/);
});
test("巻き戻しと過大な値を拒否する", () => {
  assert.throws(() => validateBattleTransition({ ...payload, turn: 1 }, { turn: 2 }, 1, "1.0.0"), /ターン順序/);
  assert.throws(() => validateBattleTransition({ ...payload, sides: { 1: { ...side, mana: 999 }, 2: side } }, null, 1, "1.0.0"), /公開領域/);
});
