"use strict";

const { pairingsForSession } = require("./pairings_core.js");

function values(value) {
  if (Array.isArray(value)) return value.filter(v => v != null);
  if (!value || typeof value !== "object") return [];
  return Object.keys(value).sort((a, b) => Number(a) - Number(b)).map(key => value[key]).filter(v => v != null);
}

function pairingsFor(session, round) {
  return pairingsForSession(session, round);
}

function buildBattleStatContribution(session, round, table, winnerSeat) {
  const pair = (pairingsFor(session, Number(round)) || [])[Number(table) - 1];
  if (!pair || !pair.map(String).includes(String(winnerSeat))) return null;
  const cards = {};
  for (const seat of pair) {
    if (session?.seats?.[seat]?.isCpu) continue;
    const won = String(seat) === String(winnerSeat);
    for (const no of values(session?.decks?.[seat]).map(String)) {
      cards[no] = cards[no] || { picked: 0, won: 0 };
      cards[no].picked += 1;
      if (won) cards[no].won += 1;
    }
  }
  return Object.keys(cards).length ? { cards } : null;
}

module.exports = { values, pairingsFor, buildBattleStatContribution };
