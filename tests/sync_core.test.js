"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { syncCanonicalJson, syncFirebaseValue, syncStateHash, syncVersionsMatch, syncDisconnectRemainingMs } = require("../sync_core.js");
const { fbArr, generateRoomCode, validatePlayerName, publicRoomSortKey, filterPublicRoomList } = require("../firebase.js");
const { TSUKURIYO_BUILD_VERSION } = require("../version.js");

test("canonical JSON and state hash do not depend on object key order", () => {
  const a = { writer: 1, sides: { 2: { life: 8 }, 1: { life: 10 } }, turn: 3 };
  const b = { turn: 3, sides: { 1: { life: 10 }, 2: { life: 8 } }, writer: 1 };
  assert.equal(syncCanonicalJson(a), syncCanonicalJson(b));
  assert.equal(syncStateHash(a), syncStateHash(b));
});

test("stateHash itself is excluded when verifying a state", () => {
  const state = { revision: 4, turn: 2 };
  const hash = syncStateHash(state);
  assert.equal(syncStateHash({ ...state, stateHash: hash }), hash);
});

test("Firebase-empty values hash the same before and after persistence", () => {
  const before = { revision: 1, emptyArray: [], emptyObject: {}, deleted: null, nested: { life: 10, cards: [] } };
  const after = { revision: 1, nested: { life: 10 } };
  assert.deepEqual(syncFirebaseValue(before), after);
  assert.equal(syncStateHash(before), syncStateHash(after));
});

// RTDB は配列と整数キーのオブジェクトを同じ形で保存し、読み戻し時は
// maxKey < 2 * numKeys のときだけ配列へ変換して返す（ChildrenNode.val）。
// 席番号をキーにした sides は席の組み合わせによって配列にもオブジェクトにもなるため、
// 両者が同じハッシュにならないと受信側の整合性チェックが必ず失敗する。
test("seat-keyed maps hash the same whether Firebase returns an array or an object", () => {
  const side = seat => ({ life: 10, legacies: [{ no: "51" }] });
  // Firebaseが配列化して返す組み合わせ（席1と席2 → [ , 席1, 席2 ]）
  const asObject = { revision: 1, sides: { 1: side(1), 2: side(2) } };
  const asArray = { revision: 1, sides: [] };
  asArray.sides[1] = side(1);
  asArray.sides[2] = side(2);
  assert.equal(syncStateHash(asObject), syncStateHash(asArray));
  // 配列化されない組み合わせ（席3と席4）も同じ規則で一致すること
  const highObject = { revision: 1, sides: { 3: side(3), 4: side(4) } };
  const highArray = { revision: 1, sides: [] };
  highArray.sides[3] = side(3);
  highArray.sides[4] = side(4);
  assert.equal(syncStateHash(highObject), syncStateHash(highArray));
});

test("version matching rejects missing and different builds", () => {
  assert.equal(syncVersionsMatch(TSUKURIYO_BUILD_VERSION, TSUKURIYO_BUILD_VERSION), true);
  assert.equal(syncVersionsMatch(TSUKURIYO_BUILD_VERSION, "1.15.55"), false);
  assert.equal(syncVersionsMatch("", ""), false);
});

test("disconnect grace period is bounded at zero", () => {
  assert.equal(syncDisconnectRemainingMs(10_000, 5_000, 10), 5_000);
  assert.equal(syncDisconnectRemainingMs(20_000, 5_000, 10), 0);
});

test("Firebase utility input validation remains deterministic", () => {
  assert.deepEqual(fbArr({ 0: "a", 1: "b" }), ["a", "b"]);
  assert.match(generateRoomCode(), /^[A-Z0-9]{6}$/);
  assert.equal(validatePlayerName(" Player ").value, "Player");
  assert.equal(validatePlayerName("x".repeat(25)).ok, false);
});

test("public room list excludes stale, full, mismatched and unrelated rooms", () => {
  const now = 10_000_000;
  const rooms = {
    A: { code: "A", kind: "shield", buildVersion: TSUKURIYO_BUILD_VERSION, seatsFilled: 1, createdAt: now - 1_000 },
    B: { code: "B", kind: "shield", buildVersion: TSUKURIYO_BUILD_VERSION, seatsFilled: 2, createdAt: now - 500 },
    C: { code: "C", kind: "game", buildVersion: TSUKURIYO_BUILD_VERSION, seatsFilled: 1, createdAt: now - 200 },
    D: { code: "D", kind: "shield", buildVersion: "old", seatsFilled: 1, createdAt: now - 100 },
    E: { code: "E", kind: "shield", buildVersion: TSUKURIYO_BUILD_VERSION, seatsFilled: 1, createdAt: now - 2 * 60 * 60 * 1000 - 1 },
    F: { code: "F", kind: "shield", buildVersion: TSUKURIYO_BUILD_VERSION, seatsFilled: 1, createdAt: now - 100 },
  };
  assert.deepEqual(filterPublicRoomList(rooms, "shield", now, TSUKURIYO_BUILD_VERSION).map(r => r.code), ["F", "A"]);
});

test("public room cursor keys sort chronologically within each mode", () => {
  assert.ok(publicRoomSortKey("game", 200, "BBBBBB") > publicRoomSortKey("game", 100, "AAAAAA"));
  assert.ok(publicRoomSortKey("shield", 1, "AAAAAA").startsWith("shield|0000000000001|"));
});

test("database rules deny root access and require authentication", () => {
  const rules = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "database.rules.json"), "utf8")).rules;
  assert.equal(rules[".read"], false);
  assert.equal(rules[".write"], false);
  assert.match(rules.sessions.$code[".write"], /auth != null/);
  assert.match(rules.rooms.$code[".write"], /ownerUid/);
  assert.match(rules.constructRooms.$code[".write"], /ownerUid/);
  assert.deepEqual(rules.publicRooms[".indexOn"], ["kind", "sortKey"]);
  // 対戦同期データは sessions の外（battleTables）に置く。セッション本体の更新は
  // sessions/{code} 全体の書き戻しで行うため、同じ配下に「revisionは+1」「ログは追記のみ」
  // という同期用の検証があると、星戦後のセッション更新が全て弾かれてしまう。
  assert.equal(rules.sessions.$code.battle, undefined);
  assert.equal(rules.battleTables.$code.$table.state[".write"], undefined);
  assert.match(rules.battleTables.$code[".write"], /auth != null/);
  assert.match(rules.battleTables.$code[".read"], /spectatorAccess/);
  assert.equal(rules.globalStats[".write"], false);
  assert.equal(rules.battleReports[".read"], false);
  assert.equal(rules.battleReports[".write"], false);
  assert.equal(rules.globalStatsContributions[".write"], false);
  assert.deepEqual(rules.globalStatsContributions[".indexOn"], ["createdAt"]);
  assert.match(rules.structureDecks[".write"], /auth\.token\.admin/);
  assert.match(rules.sessions.$code[".read"], /spectatorAccess/);
  assert.match(rules.sessions.$code[".read"], /seats\/1\/ownerUid/);
  assert.match(rules.rooms.$code[".read"], /host\/ownerUid/);
  assert.match(rules.rooms.$code[".validate"], /hostPickedPacks/);
  assert.match(rules.rooms.$code[".validate"], /guestKami/);
  assert.match(rules.rooms.$code.host.deckCount[".validate"], /newData\.isNumber/);
  assert.match(rules.privateShieldRooms.$code.$role[".read"], /rooms.*ownerUid/);
  assert.match(rules.privateShieldRooms.$code.$role[".write"], /auth\.uid/);
  assert.match(rules.constructRooms.$code[".read"], /guest\/ownerUid/);
  assert.match(rules.constructRooms.$code.host.deck[".validate"], /!newData\.exists/);
  assert.match(rules.constructRooms.$code.guest.deckCount[".validate"], /newData\.isNumber/);
  assert.match(rules.privateConstructRooms.$code.$role[".read"], /constructRooms.*ownerUid/);
  assert.match(rules.privateConstructRooms.$code.$role[".write"], /auth\.uid/);
  assert.match(rules.spectatorAccess.$code.$uid[".write"], /auth\.uid == \$uid/);
  assert.match(rules.publicRooms.$code.hostName[".validate"], /length <= 20/);
  assert.match(rules.publicRooms.$code.seatsFilled[".validate"], /kind.*game/);
  assert.match(rules.publicRooms.$code.code[".validate"], /length == 6/);
  assert.match(rules.publicRooms.$code[".validate"], /createdAt.*isNumber/);
  assert.match(rules.sessions.$code.seats.$seat.name[".validate"], /matches/);
  const battleRules = rules.battleTables.$code.$table;
  assert.match(battleRules.state[".validate"], /revision.*\+ 1/);
  assert.match(battleRules.state[".validate"], /prevHash/);
  assert.match(battleRules.state[".validate"], /seatClaims/);
  assert.match(battleRules.state[".validate"], /protocol\/buildVersion/);
  assert.match(battleRules.operationLog.$entry[".validate"], /!data\.exists/);
  assert.match(battleRules.operationLog.$entry[".validate"], /seatClaims/);
  assert.match(battleRules.actionLog.$actionId[".validate"], /title.*length <= 80/);
  assert.doesNotMatch(battleRules.actionLog.$actionId[".validate"], /numChildren/);
  assert.match(battleRules.notice[".validate"], /message.*length <= 1000/);
  assert.match(battleRules.notice[".validate"], /seatClaims/);
  assert.match(battleRules.mulligan.$seat[".validate"], /isBoolean/);
  assert.match(battleRules.mulligan.$seat[".validate"], /ownerUid/);
  assert.match(battleRules.pendingConfirm[".validate"], /writer.*forSeat/);
  assert.match(battleRules.pendingConfirmAnswer.$requestId[".validate"], /pendingConfirm\/forSeat/);
  assert.match(battleRules.pendingPick[".validate"], /cardNos.*exists/);
  assert.doesNotMatch(battleRules.pendingPick[".validate"], /numChildren/);
  assert.match(battleRules.pendingPickAnswer.$requestId[".validate"], /pendingPick\/forSeat/);
  assert.match(battleRules.pendingDelegate[".validate"], /deathTrigger/);
  assert.match(battleRules.pendingDelegateAnswer.$requestId[".validate"], /pendingDelegate\/forSeat/);
  assert.match(battleRules.emote[".validate"], /greeting/);
  assert.match(battleRules.presence.$seat[".validate"], /online.*isBoolean/);
  assert.match(battleRules.rematch.$seat[".validate"], /ownerUid/);
  assert.match(battleRules.spectators.$clientId[".validate"], /joinedAt/);
});
