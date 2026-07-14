"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { filterPublicRoomList, publicRoomSortKey } = require("../firebase.js");
const { validateBattleTransition } = require("../functions/battle_transition_core.js");

test("1万ルームの一覧処理と1万回の盤面検証が実用時間内に完了する", () => {
  const now = Date.now();
  const rooms = {};
  for (let i = 0; i < 10000; i++) {
    const code = String(i).padStart(6, "0");
    rooms[code] = { code, kind: "game", buildVersion: "1", seatsFilled: 1, createdAt: now - i, sortKey: publicRoomSortKey("game", now - i, code) };
  }
  const side = { life: 10, mana: 0, handCount: 4, deckCount: 30, legacies: [], relics: [], graveyard: [], crumbled: [] };
  const payload = { writer: 1, activeSeat: 1, turn: 1, sides: { 1: side, 2: side }, buildVersion: "1" };
  const started = Date.now();
  assert.equal(filterPublicRoomList(rooms, "game", now, "1").length, 10000);
  for (let i = 0; i < 10000; i++) assert.equal(validateBattleTransition(payload, null, 1, "1"), true);
  assert.ok(Date.now() - started < 5000);
});
