"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { pairingsFor, buildBattleStatContribution } = require("../functions/battle_stats_core.js");

test("battle stat pairings follow standard and CPU layouts", () => {
  assert.deepEqual(pairingsFor({ seats: {} }, 2), [[1, 3], [2, 4]]);
  assert.deepEqual(pairingsFor({ seats: { 3: { isCpu: true }, 4: { isCpu: true } } }, 2), [[1, 2], [3, 4]]);
});

test("battle stat contribution counts human deck copies and wins", () => {
  const session = {
    seats: { 1: {}, 2: {}, 3: { isCpu: true }, 4: { isCpu: true } },
    decks: { 1: ["A", "A", "B"], 2: ["B", "C"], 3: ["CPU"] },
  };
  assert.deepEqual(buildBattleStatContribution(session, 1, 1, 2), {
    cards: {
      A: { picked: 2, won: 0 },
      B: { picked: 2, won: 1 },
      C: { picked: 1, won: 1 },
    },
  });
  assert.equal(buildBattleStatContribution(session, 1, 2, 1), null);
});
