"use strict";
function canonicalJson(value) { if (value === null || typeof value !== "object") return JSON.stringify(value); if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]"; return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + canonicalJson(value[key])).join(",") + "}"; }
function firebaseValue(value) { if (value == null) return null; if (Array.isArray(value)) { const out = value.map(firebaseValue); while (out.length && out[out.length - 1] === null) out.pop(); return out.length ? out : null; } if (typeof value === "object") { const out = {}; for (const key of Object.keys(value)) { const normalized = firebaseValue(value[key]); if (normalized !== null) out[key] = normalized; } return Object.keys(out).length ? out : null; } return value; }
function stateHash(state) { const target = {}; for (const key of Object.keys(state || {})) if (key !== "stateHash") target[key] = state[key]; const input = canonicalJson(firebaseValue(target) || {}); let hash = 2166136261; for (let i = 0; i < input.length; i++) { hash ^= input.charCodeAt(i); hash = Math.imul(hash, 16777619); } return ("00000000" + (hash >>> 0).toString(16)).slice(-8); }
function nextServerState(state, patch, now) { const next = { ...state, ...patch, revision: Number(state.revision || 0) + 1, prevHash: state.stateHash || null, ts: now, serverAdjudicated: true }; next.stateHash = stateHash(next); return next; }
function adjudicateBattle({ state, presence, now, disconnectGraceMs, turnLimitMs }) {
  if (!state || state.result) return null;
  const seats = Object.keys(state.sides || {}).map(Number).filter(Number.isFinite);
  if (seats.length !== 2) return null;
  for (const seat of seats) {
    const status = presence && presence[seat];
    if (status && status.online === false && now - Number(status.ts || now) >= disconnectGraceMs) {
      const winner = seats.find(value => value !== seat);
      return { kind: "disconnect", loserSeat: seat, winnerSeat: winner, state: nextServerState(state, { writer: winner, result: { outcome: "win", title: "星戦勝利！", reason: `相手が${Math.round(disconnectGraceMs / 1000)}秒以内に再接続しなかったため` }, turnDeadlineAt: null }, now) };
    }
  }
  if (state.turnDeadlineAt && now >= Number(state.turnDeadlineAt)) {
    const timedOutSeat = Number(state.activeSeat);
    const nextSeat = seats.find(value => value !== timedOutSeat);
    if (!nextSeat) return null;
    return { kind: "turn-timeout", timedOutSeat, nextSeat, state: nextServerState(state, { writer: timedOutSeat, activeSeat: nextSeat, turn: Number(state.turn || 0) + 1, turnDeadlineAt: now + turnLimitMs }, now) };
  }
  return null;
}
module.exports = { stateHash, adjudicateBattle };
