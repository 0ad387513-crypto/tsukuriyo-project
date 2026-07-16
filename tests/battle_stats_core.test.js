"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { pairingsFor, buildBattleStatContribution } = require("../functions/battle_stats_core.js");

test("battle stat pairings are seeded, random-looking round-robin and preserve CPU layouts", () => {
  const session = { seed: 123, seats: {} };
  assert.deepEqual(pairingsFor(session, 1), [[1, 4], [2, 3]]);
  assert.deepEqual(pairingsFor(session, 1), pairingsFor(session, 1));
  const allPairs = [1, 2, 3]
    .flatMap(round => pairingsFor(session, round))
    .map(pair => pair.slice().sort().join("-"));
  assert.equal(new Set(allPairs).size, 6);
  assert.deepEqual(pairingsFor({ seats: { 3: { isCpu: true }, 4: { isCpu: true } } }, 2), [[1, 2], [3, 4]]);
});

test("four CPUs and solo verification meet three different opponents", () => {
  const layouts = [
    { seed: 77, seats: { 1: { isCpu: true }, 2: { isCpu: true }, 3: { isCpu: true }, 4: { isCpu: true } } },
    { seed: 77, seats: { 2: { isCpu: true }, 3: { isCpu: true }, 4: { isCpu: true } } },
  ];
  for (const session of layouts) {
    const opponents = new Map([1, 2, 3, 4].map(seat => [seat, new Set()]));
    for (let round = 1; round <= 3; round++) {
      for (const [a, b] of pairingsFor(session, round)) {
        opponents.get(a).add(b);
        opponents.get(b).add(a);
      }
    }
    for (const met of opponents.values()) assert.equal(met.size, 3);
  }
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
