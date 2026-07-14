"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const { ref, get, set, update, remove } = require("firebase/database");

let env;

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-tsukuriyo",
    database: {
      rules: fs.readFileSync(path.join(__dirname, "..", "database.rules.json"), "utf8"),
    },
  });
});

test.beforeEach(async () => env.clearDatabase());
test.after(async () => env.cleanup());

function db(uid) {
  return uid ? env.authenticatedContext(uid).database() : env.unauthenticatedContext().database();
}

test("未認証ユーザーは公開一覧も読み取れない", async () => {
  await assertFails(get(ref(db(null), "publicRooms")));
});

test("セッション作成者は作成・更新でき、無関係なユーザーは開始後に更新できない", async () => {
  const owner = db("owner-a");
  await assertSucceeds(set(ref(owner, "sessions/ABC123"), {
    phase: "lobby",
    seats: { 1: { id: "p1", ownerUid: "owner-a", ready: false } },
  }));
  await assertSucceeds(update(ref(owner, "sessions/ABC123"), { phase: "kami_select" }));
  await assertFails(update(ref(db("outsider"), "sessions/ABC123"), { phase: "aborted" }));
});

test("ロビーの空席には本人UIDで参加できる", async () => {
  await set(ref(db("owner-a"), "sessions/JOIN01"), {
    phase: "lobby",
    seats: { 1: { id: "p1", ownerUid: "owner-a", ready: false } },
  });
  await assertSucceeds(set(ref(db("guest-b"), "sessions/JOIN01"), {
    phase: "lobby",
    seats: {
      1: { id: "p1", ownerUid: "owner-a", ready: false },
      2: { id: "p2", ownerUid: "guest-b", ready: false },
    },
  }));
});

test("不正な表示名と公開ルーム情報を拒否する", async () => {
  await assertFails(set(ref(db("owner-a"), "sessions/BAD001"), {
    phase: "lobby", buildVersion: "1.15.78", createdAt: 1,
    seats: { 1: { id: "p1", ownerUid: "owner-a", name: "<script>" } },
  }));
  await assertFails(set(ref(db("owner-a"), "publicRooms/BAD001"), {
    kind: "invalid", code: "BAD001", hostName: "host", ownerUid: "owner-a",
    buildVersion: "1.15.78", seatsFilled: 99, createdAt: 1,
  }));
  await assertFails(set(ref(db("owner-a"), "publicRooms/SHORT1"), {
    kind: "game", ownerUid: "owner-a",
  }));
});

test("参加者は他の席の所有UIDを書き換えたりセッション全体を削除できない", async () => {
  const owner = db("owner-a");
  await set(ref(owner, "sessions/SAFE01"), {
    phase: "lobby",
    seats: { 1: { id: "p1", ownerUid: "owner-a" } },
  });
  await update(ref(db("guest-b"), "sessions/SAFE01"), {
    "seats/2": { id: "p2", ownerUid: "guest-b" },
  });
  await assertFails(update(ref(db("guest-b"), "sessions/SAFE01"), {
    "seats/1/ownerUid": "guest-b",
  }));
  await assertFails(remove(ref(db("guest-b"), "sessions/SAFE01")));
  await assertSucceeds(remove(ref(owner, "sessions/SAFE01")));
});

test("4人戦の非公開ドラフト情報は本人だけが読め、クライアントからは書けない", async () => {
  await env.withSecurityRulesDisabled(async context => {
    const adminDb = context.database();
    await set(ref(adminDb, "sessions/DRAFT1"), {
      phase: "draft",
      seats: {
        1: { id: "p1", ownerUid: "draft-a" },
        2: { id: "p2", ownerUid: "draft-b" },
      },
    });
    await set(ref(adminDb, "privateGameSessions/DRAFT1/1"), {
      draft: { revision: 1, pack: { cards: ["101"] }, deck: [] }, updatedAt: Date.now(),
    });
    await set(ref(adminDb, "serverDraftSessions/DRAFT1"), { revision: 1, packs: { 1: ["101"] } });
  });
  await assertSucceeds(get(ref(db("draft-a"), "privateGameSessions/DRAFT1/1")));
  await assertFails(get(ref(db("draft-b"), "privateGameSessions/DRAFT1/1")));
  await assertFails(set(ref(db("draft-a"), "privateGameSessions/DRAFT1/1/draft/picked"), true));
  await assertFails(get(ref(db("draft-a"), "serverDraftSessions/DRAFT1")));
});

test("2人対戦のゲストはホスト情報の改ざんや部屋全体の削除ができない", async () => {
  const owner = db("room-owner");
  await set(ref(owner, "rooms/ROOM01"), {
    phase: "lobby",
    host: { id: "p1", ownerUid: "room-owner" },
  });
  await update(ref(db("room-guest"), "rooms/ROOM01"), {
    guest: { id: "p2", ownerUid: "room-guest" },
  });
  await assertFails(update(ref(db("room-guest"), "rooms/ROOM01"), {
    "host/ownerUid": "room-guest",
  }));
  await assertFails(remove(ref(db("room-guest"), "rooms/ROOM01")));
  await assertSucceeds(remove(ref(owner, "rooms/ROOM01")));
});

test("理念構築戦の提出デッキは本人だけが読み書きできる", async () => {
  const owner = db("builder-a");
  const guest = db("builder-b");
  await set(ref(owner, "constructRooms/DECK01"), {
    phase: "lobby", buildVersion: "1.15.83", createdAt: Date.now(),
    host: { id: "p1", ownerUid: "builder-a", name: "A", ready: false, deckCount: 0 },
  });
  await update(ref(guest, "constructRooms/DECK01"), {
    guest: { id: "p2", ownerUid: "builder-b", name: "B", ready: false, deckCount: 0 },
    phase: "building",
  });
  await assertSucceeds(set(ref(owner, "privateConstructRooms/DECK01/host"), {
    deck: { 101: 3, 102: 2 }, updatedAt: Date.now(),
  }));
  await assertSucceeds(get(ref(owner, "privateConstructRooms/DECK01/host")));
  await assertFails(get(ref(guest, "privateConstructRooms/DECK01/host")));
  await assertFails(set(ref(guest, "privateConstructRooms/DECK01/host"), {
    deck: { 999: 35 }, updatedAt: Date.now(),
  }));
  await assertFails(update(ref(owner, "constructRooms/DECK01/host"), {
    deck: { 101: 3 },
  }));
  await assertSucceeds(update(ref(owner, "constructRooms/DECK01/host"), {
    deckCount: 5, kamiNo: "1", ready: true,
  }));
  await assertFails(update(ref(guest, "constructRooms/DECK01/host"), { ready: false }));
});

test("シールド戦参加者は共通対戦パスを作成できる", async () => {
  await set(ref(db("shield-owner"), "rooms/SHLD01"), {
    phase: "lobby",
    host: { id: "p1", ownerUid: "shield-owner", ready: false },
  });
  await assertSucceeds(set(ref(db("shield-owner"), "sessions/SHLD01/battle/shield/protocol"), {
    buildVersion: "1.15.59", createdAt: Date.now(),
  }));
  await assertFails(set(ref(db("outsider"), "sessions/SHLD01/battle/shield/state"), { turn: 1 }));
});

test("シールド戦の最終デッキは本人だけが読み書きできる", async () => {
  const owner = db("shield-a");
  const guest = db("shield-b");
  await set(ref(owner, "rooms/PRIV01"), {
    phase: "lobby", buildVersion: "1.15.85", createdAt: Date.now(), seed: 1,
    host: { id: "p1", ownerUid: "shield-a", name: "A", ready: false },
  });
  await update(ref(guest, "rooms/PRIV01"), {
    guest: { id: "p2", ownerUid: "shield-b", name: "B", ready: false },
  });
  await assertSucceeds(set(ref(owner, "privateShieldRooms/PRIV01/host"), {
    deck: { 101: 3, 102: 2 }, updatedAt: Date.now(),
  }));
  await assertSucceeds(get(ref(owner, "privateShieldRooms/PRIV01/host")));
  await assertFails(get(ref(guest, "privateShieldRooms/PRIV01/host")));
  await assertFails(set(ref(guest, "privateShieldRooms/PRIV01/host"), {
    deck: { 999: 40 }, updatedAt: Date.now(),
  }));
  await assertSucceeds(update(ref(owner, "rooms/PRIV01/host"), { deckCount: 5 }));
  await assertFails(remove(ref(guest, "rooms/PRIV01/host/deckCount")));
  await assertFails(update(ref(guest, "rooms/PRIV01"), { hostPickedPacks: [1] }));
  await assertSucceeds(update(ref(owner, "rooms/PRIV01"), { hostPickedPacks: [1] }));
  await assertFails(update(ref(guest, "rooms/PRIV01"), { hostKami: "9" }));
  await assertSucceeds(update(ref(owner, "rooms/PRIV01"), { hostKami: "9" }));
});

test("共有盤面は座席所有者・連番・プロトコルを検証する", async () => {
  const owner = db("owner-a");
  await set(ref(owner, "sessions/SYNC01"), {
    phase: "lobby", buildVersion: "1.15.80", createdAt: Date.now(),
    seats: { 1: { id: "p1", ownerUid: "owner-a", name: "A" } },
  });
  await update(ref(db("guest-b"), "sessions/SYNC01"), { "seats/2": { id: "p2", ownerUid: "guest-b", name: "B" } });
  await update(ref(owner, "sessions/SYNC01"), { phase: "battle" });
  await set(ref(owner, "sessions/SYNC01/battle/1/protocol"), { buildVersion: "1.15.80", createdAt: Date.now() });
  const state1 = { writer: 1, activeSeat: 1, turn: 1, sides: { 1: { life: 10 }, 2: { life: 10 } }, buildVersion: "1.15.80", revision: 1, stateHash: "h1", ts: Date.now() };
  await assertSucceeds(set(ref(owner, "sessions/SYNC01/battle/1/state"), state1));
  await assertFails(set(ref(db("guest-b"), "sessions/SYNC01/battle/1/state"), { ...state1, writer: 1, revision: 2, prevHash: "h1", stateHash: "h2" }));
  await assertFails(set(ref(owner, "sessions/SYNC01/battle/1/state"), { ...state1, revision: 3, prevHash: "h1", stateHash: "h3" }));
  await assertSucceeds(set(ref(owner, "sessions/SYNC01/battle/1/state"), { ...state1, revision: 2, prevHash: "h1", stateHash: "h2", ts: Date.now() }));
  await assertFails(set(ref(db("guest-b"), "sessions/SYNC01/battle/1/notice"), {
    writer: 1, title: "fake", message: "fake", cardNos: [], ts: Date.now(),
  }));
});

test("対戦中の確認依頼・回答・在席情報は本人の座席だけ書き込める", async () => {
  const owner = db("owner-a");
  const guest = db("guest-b");
  await set(ref(owner, "sessions/INPUT1"), {
    phase: "lobby", buildVersion: "1.15.82", createdAt: Date.now(),
    seats: { 1: { id: "p1", ownerUid: "owner-a", name: "A" } },
  });
  await update(ref(guest, "sessions/INPUT1"), {
    "seats/2": { id: "p2", ownerUid: "guest-b", name: "B" },
  });
  await update(ref(owner, "sessions/INPUT1"), { phase: "battle" });
  await assertSucceeds(set(ref(owner, "sessions/INPUT1/battle/1/pendingConfirm"), {
    id: "q1", writer: 1, forSeat: 2, kind: "守護", prompt: "使用しますか？", ts: Date.now(),
  }));
  await assertSucceeds(set(ref(guest, "sessions/INPUT1/battle/1/pendingConfirmAnswer/q1"), {
    writer: 2, answer: true, ts: Date.now(),
  }));
  await assertFails(set(ref(owner, "sessions/INPUT1/battle/1/presence/2"), {
    online: false, ts: Date.now(),
  }));
  await assertSucceeds(set(ref(guest, "sessions/INPUT1/battle/1/presence/2"), {
    online: true, ts: Date.now(),
  }));
  await assertFails(set(ref(guest, "sessions/INPUT1/battle/1/mulligan/1"), true));
  await assertSucceeds(set(ref(owner, "sessions/INPUT1/battle/1/mulligan/1"), true));
});

test("観戦者は自分の在席情報だけ登録・削除できる", async () => {
  await set(ref(db("owner-a"), "sessions/WATCH1"), {
    phase: "battle",
    seats: { 1: { id: "p1", ownerUid: "owner-a" } },
  });
  const ownPresence = ref(db("viewer-a"), "sessions/WATCH1/battle/test/spectators/client-a");
  await assertFails(get(ref(db("viewer-a"), "sessions/WATCH1")));
  await assertSucceeds(set(ref(db("viewer-a"), "spectatorAccess/WATCH1/viewer-a"), true));
  await assertSucceeds(get(ref(db("viewer-a"), "sessions/WATCH1")));
  await assertSucceeds(set(ownPresence, { ownerUid: "viewer-a", joinedAt: 1 }));
  await assertFails(remove(ref(db("viewer-b"), "sessions/WATCH1/battle/test/spectators/client-a")));
  await assertSucceeds(remove(ownPresence));
});

test("2クライアントで作成・参加・対戦同期・再接続・再戦まで進行できる", async () => {
  const clientA = db("e2e-a");
  const clientB = db("e2e-b");
  await assertSucceeds(set(ref(clientA, "sessions/E2E001"), {
    phase: "lobby", buildVersion: "1.15.91", createdAt: Date.now(),
    seats: { 1: { id: "a", ownerUid: "e2e-a", name: "A" } },
  }));
  await assertSucceeds(update(ref(clientB, "sessions/E2E001"), {
    "seats/2": { id: "b", ownerUid: "e2e-b", name: "B" },
  }));
  await assertSucceeds(update(ref(clientA, "sessions/E2E001"), { phase: "battle" }));
  const base = "sessions/E2E001/battle/test";
  await assertSucceeds(set(ref(clientA, `${base}/protocol`), { buildVersion: "1.15.91", createdAt: Date.now() }));
  const state1 = { writer: 1, activeSeat: 1, turn: 1, sides: { 1: { life: 10 }, 2: { life: 10 } }, buildVersion: "1.15.91", revision: 1, stateHash: "s1", ts: Date.now() };
  await assertSucceeds(set(ref(clientA, `${base}/state`), state1));
  await assertSucceeds(set(ref(clientB, `${base}/state`), { ...state1, writer: 2, activeSeat: 2, revision: 2, prevHash: "s1", stateHash: "s2", ts: Date.now() }));
  await assertSucceeds(set(ref(clientB, `${base}/presence/2`), { online: false, ts: Date.now() }));
  await assertSucceeds(set(ref(clientB, `${base}/presence/2`), { online: true, ts: Date.now() }));
  await assertSucceeds(set(ref(clientA, `${base}/rematch/firstSeat`), 1));
  await assertSucceeds(set(ref(clientA, `${base}/rematch/1`), true));
  await assertSucceeds(set(ref(clientB, `${base}/rematch/2`), true));
  const finalState = (await get(ref(clientA, base))).val();
  assert.equal(finalState.state.revision, 2);
  assert.equal(finalState.presence[2].online, true);
  assert.equal(finalState.rematch[1], true);
  assert.equal(finalState.rematch[2], true);
});

test("ストラクチャーデッキは管理者だけ更新できる", async () => {
  await assertFails(set(ref(db(null), "structureDecks/sample"), { name: "sample" }));
  await assertFails(set(ref(db("editor"), "structureDecks/sample"), { name: "sample" }));
  const admin = env.authenticatedContext("admin", { admin: true }).database();
  await assertSucceeds(set(ref(admin, "structureDecks/sample"), { name: "sample" }));
});
