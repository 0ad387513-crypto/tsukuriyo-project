"use strict";

function values(value) {
  if (Array.isArray(value)) return value.filter(v => v != null);
  if (!value || typeof value !== "object") return [];
  return Object.keys(value).sort((a, b) => Number(a) - Number(b)).map(key => value[key]).filter(v => v != null);
}

function cpuSeats(session) {
  return [1, 2, 3, 4].filter(seat => session?.seats?.[seat]?.isCpu);
}

function pairingsFor(session, round) {
  const standard = {
    1: [[1, 2], [3, 4]],
    2: [[1, 3], [2, 4]],
    3: [[1, 4], [2, 3]],
  };
  const cpus = cpuSeats(session);
  if (!cpus.length) return standard[round] || [];
  const humans = [1, 2, 3, 4].filter(seat => !cpus.includes(seat));
  if (humans.length >= 2) return [humans.slice(0, 2), cpus.slice(0, 2)];
  const human = humans[0];
  return human == null ? [cpus.slice(0, 2), cpus.slice(2)] : [[human, cpus[0]], cpus.slice(1)];
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
