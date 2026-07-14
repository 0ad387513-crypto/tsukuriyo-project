"use strict";

function boundedNumber(value, min, max) {
  return Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max;
}

function validatePublicSide(side) {
  if (!side || typeof side !== "object" || Array.isArray(side)) return false;
  for (const key of ["life", "mana", "manaMax", "tenryoku", "handCount", "deckCount"]) {
    if (side[key] != null && !boundedNumber(side[key], key === "life" ? -100 : 0, 200)) return false;
  }
  for (const key of ["legacies", "relics", "graveyard", "crumbled"]) {
    if (side[key] != null && (!Array.isArray(side[key]) || side[key].length > 100)) return false;
  }
  if (Object.prototype.hasOwnProperty.call(side, "hand") || Object.prototype.hasOwnProperty.call(side, "deck")) return false;
  return true;
}

function validateBattleTransition(payload, current, ownedSeat, protocolBuild) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("共有盤面が不正です");
  if (JSON.stringify(payload).length > 180000) throw new Error("共有盤面が大きすぎます");
  const writer = Number(payload.writer);
  if (writer !== Number(ownedSeat)) throw new Error("他の座席として操作できません");
  if (String(payload.buildVersion || "") !== String(protocolBuild || "")) throw new Error("対戦バージョンが一致しません");
  const sides = payload.sides || {};
  const seats = Object.keys(sides).map(Number).filter(Number.isFinite);
  if (seats.length !== 2 || !seats.includes(writer) || !seats.includes(Number(payload.activeSeat))) throw new Error("参加座席が不正です");
  if (!seats.every(seat => validatePublicSide(sides[seat]))) throw new Error("公開領域の値が不正です");
  const turn = Number(payload.turn);
  const previousTurn = Number(current && current.turn || turn);
  if (!Number.isInteger(turn) || turn < 1 || turn > previousTurn + 1 || (current && turn < previousTurn)) throw new Error("ターン順序が不正です");
  if (payload.turnDeadlineAt != null && !boundedNumber(payload.turnDeadlineAt, Date.now() - 60000, Date.now() + 10 * 60 * 1000)) throw new Error("制限時刻が不正です");
  return true;
}

module.exports = { validatePublicSide, validateBattleTransition };
