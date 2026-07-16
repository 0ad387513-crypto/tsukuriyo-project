"use strict";

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onValueCreated, onValueDeleted, onValueWritten } = require("firebase-functions/v2/database");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");
const { ROOM_TTL_MS, buildCleanupUpdates } = require("./cleanup_core.js");
const { buildBattleStatContribution } = require("./battle_stats_core.js");
const { pairingsForSession } = require("./pairings_core.js");
const { stateHash, adjudicateBattle } = require("./battle_watchdog_core.js");
const { validateBattleTransition } = require("./battle_transition_core.js");
const { nextRateLimit } = require("./security_core.js");
const { createDraftState, applyDraftPick, publicDraftState, privateDraftState, applyFreeReturn, undoFreeReturn,
  startDeepenState, applyDeepenReflect, applyDeepenFusion, drawDeepenBloom, pickDeepenBloom, setDeepenDone } = require("./draft_core.js");

initializeApp();
const BATTLE_TURN_LIMIT_MS = 180000;
const BATTLE_DISCONNECT_GRACE_MS = 90000;
const CALLABLE_OPTIONS = { region: "asia-northeast1", enforceAppCheck: process.env.ENFORCE_APP_CHECK === "true" };

async function enforceRateLimit(db, uid, action, maxCount = 60, windowMs = 60000) {
  let allowed = true;
  await db.ref(`rateLimits/${uid}/${action}`).transaction(current => {
    const decision = nextRateLimit(current, Date.now(), windowMs, maxCount);
    allowed = decision.allowed;
    return decision.value;
  });
  if (!allowed) throw new HttpsError("resource-exhausted", "操作回数が多すぎます。しばらく待ってから再度お試しください");
}

async function fetchExpiredRooms(db, collection, cutoff) {
  const snap = await db.ref(collection)
    .orderByChild("createdAt")
    .endAt(cutoff)
    .once("value");
  return snap.val() || {};
}

exports.cleanupExpiredRooms = onSchedule({
  schedule: "every 15 minutes",
  timeZone: "Asia/Tokyo",
  retryCount: 2,
  memory: "256MiB",
  timeoutSeconds: 60,
}, async () => {
  const db = getDatabase();
  const now = Date.now();
  const entries = await Promise.all(Object.entries(ROOM_TTL_MS).map(async ([collection, ttl]) => [
    collection,
    await fetchExpiredRooms(db, collection, now - ttl),
  ]));
  const updates = buildCleanupUpdates(Object.fromEntries(entries));
  if (!Object.keys(updates).length) return null;
  await db.ref().update(updates);
  return { deletedPaths: Object.keys(updates).length };
});

exports.fetchExpiredRooms = fetchExpiredRooms;

exports.indexActiveBattle = onValueWritten("/sessions/{code}/battle/{table}/state", async event => {
  const state = event.data.after.val();
  const key = `${event.params.code}__${encodeURIComponent(event.params.table)}`;
  const ref = getDatabase().ref(`battleWatchdogs/${key}`);
  if (!state || state.result) { await ref.remove(); return null; }
  await ref.set({ code: event.params.code, table: event.params.table, turnDeadlineAt: Number(state.turnDeadlineAt || 0), updatedAt: Date.now() });
  return null;
});

exports.adjudicateActiveBattles = onSchedule({
  schedule: "every 1 minutes", timeZone: "Asia/Tokyo", retryCount: 1, memory: "256MiB", timeoutSeconds: 60,
}, async () => {
  const db = getDatabase();
  const entries = (await db.ref("battleWatchdogs").limitToFirst(500).once("value")).val() || {};
  const now = Date.now();
  let changed = 0;
  for (const [key, entry] of Object.entries(entries)) {
    if (!entry || !entry.code || !entry.table) continue;
    const base = `sessions/${entry.code}/battle/${entry.table}`;
    const presence = (await db.ref(`${base}/presence`).once("value")).val() || {};
    let decision = null;
    const result = await db.ref(`${base}/state`).transaction(current => {
      decision = adjudicateBattle({ state: current, presence, now, disconnectGraceMs: BATTLE_DISCONNECT_GRACE_MS, turnLimitMs: BATTLE_TURN_LIMIT_MS });
      return decision ? decision.state : undefined;
    });
    if (result.committed && decision) changed += 1;
    const current = result.snapshot.val();
    const pendingUpdates = {};
    for (const name of ["pendingConfirm", "pendingPick", "pendingDelegate"]) {
      const pending = (await db.ref(`${base}/${name}`).once("value")).val();
      if (pending && now - Number(pending.ts || now) >= 90000) pendingUpdates[`${base}/${name}`] = null;
    }
    if (Object.keys(pendingUpdates).length) await db.ref().update(pendingUpdates);
    if (!current || current.result) await db.ref(`battleWatchdogs/${key}`).remove();
  }
  return { scanned: Object.keys(entries).length, changed };
});

// 手動解散やクライアント側TTLで公開ルームが先に消えた場合も、非公開デッキを残さない。
exports.cleanupPrivateConstructRoom = onValueDeleted("/constructRooms/{code}", async event => {
  await getDatabase().ref(`privateConstructRooms/${event.params.code}`).remove();
  return null;
});

exports.cleanupPrivateShieldRoom = onValueDeleted("/rooms/{code}", async event => {
  await getDatabase().ref(`privateShieldRooms/${event.params.code}`).remove();
  return null;
});

exports.cleanupPrivateGameSession = onValueDeleted("/sessions/{code}", async event => {
  const code = event.params.code;
  await getDatabase().ref().update({
    [`privateGameSessions/${code}`]: null,
    [`serverDraftSessions/${code}`]: null,
  });
  return null;
});

function normalizeCode(value) {
  const code = String(value || "").trim().toUpperCase();
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) throw new HttpsError("invalid-argument", "部屋コードが不正です");
  return code;
}

function ownedSeat(session, uid) {
  for (let seat = 1; seat <= 4; seat++) {
    if (session && session.seats && session.seats[seat] && session.seats[seat].ownerUid === uid) return seat;
  }
  return null;
}

function arrayValue(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(item => item != null).map(String);
  return Object.keys(value).sort((a, b) => Number(a) - Number(b)).map(key => String(value[key]));
}

function cpuSeats(session) {
  return [1, 2, 3, 4].filter(seat => session.seats && session.seats[seat] && session.seats[seat].isCpu === true);
}

function battlePairings(session, round) {
  return pairingsForSession(session, round);
}

async function publishDraftState(db, code, state) {
  const revision = Number(state.revision || 0);
  let currentSession = null;
  await db.ref(`sessions/${code}`).transaction(session => {
    if (!session) return session;
    const publishedRevision = Number(session.draft && session.draft.revision || 0);
    if (publishedRevision > revision) return session;
    const enteringDraftDone = state.done && session.phase === "draft";
    session.draft = publicDraftState(state);
    session.deckCounts = Object.fromEntries([1, 2, 3, 4].map(seat => [seat, (state.decks[seat] || []).length]));
    session.decks = null;
    session.converted = null;
    session.draftFreeReturned = null;
    session.round = state.round;
    session.phase = state.phase || (state.done ? "draft_done" : "draft");
    if (state.insight) session.insight = state.insight;
    if (state.fusionUsed) session.fusionUsed = state.fusionUsed;
    if (state.mulliganRights) session.mulliganRights = state.mulliganRights;
    if (state.deepenDone) session.deepenDone = state.deepenDone;
    session.bloomOffer = null;
    if (session.phase === "battle") {
      session.battles = session.battles || {};
      session.battles[state.round] = session.battles[state.round] || { t1Winner: null, t2Winner: null };
    }
    if (enteringDraftDone) session.draftReturnDone = null;
    currentSession = session;
    return session;
  });
  const cpuDecks = {};
  for (const seat of cpuSeats(currentSession || {})) cpuDecks[seat] = state.decks[seat] || [];
  const writes = [];
  for (let seat = 1; seat <= 4; seat++) {
    writes.push(db.ref(`privateGameSessions/${code}/${seat}`).transaction(privateData => {
      const publishedRevision = Number(privateData && privateData.draft && privateData.draft.revision || 0);
      if (publishedRevision > revision) return privateData;
      return { draft: privateDraftState(state, seat), cpuDecks, updatedAt: Date.now() };
    }));
  }
  await Promise.all(writes);
}

exports.startServerDraft = onCall(CALLABLE_OPTIONS, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "認証が必要です");
  const code = normalizeCode(request.data && request.data.code);
  const round = Number(request.data && request.data.round);
  const cardNos = Array.isArray(request.data && request.data.cardNos) ? request.data.cardNos.map(String) : [];
  const db = getDatabase();
  await enforceRateLimit(db, request.auth.uid, "startDraft", 10);
  const session = (await db.ref(`sessions/${code}`).once("value")).val();
  if (!session) throw new HttpsError("not-found", "セッションが見つかりません");
  if (ownedSeat(session, request.auth.uid) !== 1) throw new HttpsError("permission-denied", "ホストだけがドラフトを開始できます");
  if (!['kami_done', 'battle', 'draft_done', 'draft'].includes(session.phase)) throw new HttpsError("failed-precondition", "現在のフェーズではドラフトを開始できません");
  const seed = Number(session.seed) || Math.floor(Math.random() * 1e9);
  let domainError = null;
  const result = await db.ref(`serverDraftSessions/${code}`).transaction(current => {
    if (current && Number(current.round) === round && !current.done) return current;
    const decks = {}, converted = {};
    for (let seat = 1; seat <= 4; seat++) {
      decks[seat] = arrayValue(current && current.decks && current.decks[seat] || session.decks && session.decks[seat]);
      converted[seat] = arrayValue(current && current.converted && current.converted[seat] || session.converted && session.converted[seat]);
    }
    const freeReturned = current && current.freeReturned || session.draftFreeReturned || {};
    const orochiSeats = [1, 2, 3, 4].filter(seat =>
      session.seats && session.seats[seat] && String(session.seats[seat].kamiNo) === "10"
    );
    try {
      const next = createDraftState({ round, cardNos, seed, decks, converted, freeReturned, orochiSeats });
      if (current) {
        next.insight = current.insight || {};
        next.insightAwarded = current.insightAwarded || {};
        next.fusionUsed = current.fusionUsed || {};
        next.mulliganRights = {};
      }
      return next;
    }
    catch (error) { domainError = error; return; }
  });
  if (domainError) throw new HttpsError("invalid-argument", domainError.message);
  const state = result.snapshot.val();
  if (!state) throw new HttpsError("internal", "ドラフトを初期化できませんでした");
  await publishDraftState(db, code, state);
  return { ok: true, round: state.round };
});

exports.pickServerDraftCard = onCall(CALLABLE_OPTIONS, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "認証が必要です");
  const code = normalizeCode(request.data && request.data.code);
  const cardNo = String(request.data && request.data.cardNo || "");
  if (!cardNo || cardNo.length > 24) throw new HttpsError("invalid-argument", "カード番号が不正です");
  const db = getDatabase();
  await enforceRateLimit(db, request.auth.uid, "draftPick", 90);
  const session = (await db.ref(`sessions/${code}`).once("value")).val();
  if (!session || session.phase !== "draft") throw new HttpsError("failed-precondition", "ドラフトは進行中ではありません");
  const seat = ownedSeat(session, request.auth.uid);
  if (!seat) throw new HttpsError("permission-denied", "このセッションの参加者ではありません");
  let domainError = null;
  const result = await db.ref(`serverDraftSessions/${code}`).transaction(current => {
    if (!current) return;
    try { return applyDraftPick(current, seat, cardNo, cpuSeats(session)); }
    catch (error) { domainError = error; return; }
  });
  if (domainError) throw new HttpsError("failed-precondition", domainError.message);
  const state = result.snapshot.val();
  if (!result.committed || !state) throw new HttpsError("aborted", "選択が競合しました。画面を更新して再度お試しください");
  await publishDraftState(db, code, state);
  return { ok: true, seat, done: !!state.done };
});

async function changeFreeReturn(request, undo) {
  if (!request.auth) throw new HttpsError("unauthenticated", "認証が必要です");
  const code = normalizeCode(request.data && request.data.code);
  const cardNo = String(request.data && request.data.cardNo || "");
  if (!cardNo || cardNo.length > 24) throw new HttpsError("invalid-argument", "カード番号が不正です");
  const db = getDatabase();
  await enforceRateLimit(db, request.auth.uid, "freeReturn", 30);
  const session = (await db.ref(`sessions/${code}`).once("value")).val();
  if (!session || session.phase !== "draft_done") throw new HttpsError("failed-precondition", "現在は無料返還を変更できません");
  const seat = ownedSeat(session, request.auth.uid);
  if (!seat) throw new HttpsError("permission-denied", "このセッションの参加者ではありません");
  if (session.draftReturnDone && session.draftReturnDone[seat]) throw new HttpsError("failed-precondition", "返還選択は完了済みです");
  let domainError = null;
  const result = await db.ref(`serverDraftSessions/${code}`).transaction(current => {
    if (!current) return;
    try { return undo ? undoFreeReturn(current, seat, cardNo) : applyFreeReturn(current, seat, cardNo); }
    catch (error) { domainError = error; return; }
  });
  if (domainError) throw new HttpsError("failed-precondition", domainError.message);
  const state = result.snapshot.val();
  if (!result.committed || !state) throw new HttpsError("aborted", "返還操作が競合しました。再度お試しください");
  await publishDraftState(db, code, state);
  return { ok: true, seat, undone: !!undo };
}

exports.returnServerDraftCard = onCall(CALLABLE_OPTIONS, request => changeFreeReturn(request, false));
exports.undoServerDraftReturn = onCall(CALLABLE_OPTIONS, request => changeFreeReturn(request, true));

exports.startServerDeepen = onCall(CALLABLE_OPTIONS, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "認証が必要です");
  const code = normalizeCode(request.data && request.data.code);
  const db = getDatabase();
  await enforceRateLimit(db, request.auth.uid, "startDeepen", 10);
  const session = (await db.ref(`sessions/${code}`).once("value")).val();
  if (!session || !["draft_done", "deepen"].includes(session.phase)) throw new HttpsError("failed-precondition", "現在は深化を開始できません");
  if (!ownedSeat(session, request.auth.uid)) throw new HttpsError("permission-denied", "このセッションの参加者ではありません");
  if (session.phase === "draft_done" && ![1, 2, 3, 4].every(seat => session.draftReturnDone && session.draftReturnDone[seat])) {
    throw new HttpsError("failed-precondition", "全員の返還選択が完了していません");
  }
  let domainError = null;
  const result = await db.ref(`serverDraftSessions/${code}`).transaction(current => {
    if (!current) return;
    try { return startDeepenState(current, session, cpuSeats(session)); }
    catch (error) { domainError = error; return; }
  });
  if (domainError) throw new HttpsError("failed-precondition", domainError.message);
  const state = result.snapshot.val();
  if (!result.committed || !state) throw new HttpsError("aborted", "深化の開始が競合しました");
  await publishDraftState(db, code, state);
  return { ok: true, round: state.round };
});

async function runDeepenAction(request, action) {
  if (!request.auth) throw new HttpsError("unauthenticated", "認証が必要です");
  const code = normalizeCode(request.data && request.data.code);
  const db = getDatabase();
  await enforceRateLimit(db, request.auth.uid, "deepenAction", 30);
  const session = (await db.ref(`sessions/${code}`).once("value")).val();
  if (!session || session.phase !== "deepen") throw new HttpsError("failed-precondition", "現在は深化を行えません");
  const seat = ownedSeat(session, request.auth.uid);
  if (!seat) throw new HttpsError("permission-denied", "このセッションの参加者ではありません");
  let domainError = null;
  const result = await db.ref(`serverDraftSessions/${code}`).transaction(current => {
    if (!current) return;
    try {
      if (action === "reflect") return applyDeepenReflect(current, seat, request.data.cardNo);
      if (action === "fusion") return applyDeepenFusion(current, seat);
      if (action === "bloomDraw") return drawDeepenBloom(current, seat, request.data.genesisNos);
      if (action === "bloomPick") return pickDeepenBloom(current, seat, request.data.cardNo);
      if (action === "done") return setDeepenDone(current, seat, !!request.data.done);
      throw new Error("不正な深化操作です");
    } catch (error) { domainError = error; return; }
  });
  if (domainError) throw new HttpsError("failed-precondition", domainError.message);
  const state = result.snapshot.val();
  if (!result.committed || !state) throw new HttpsError("aborted", "深化操作が競合しました。再度お試しください");
  await publishDraftState(db, code, state);
  return { ok: true, seat, phase: state.phase };
}

exports.reflectServerDeck = onCall(CALLABLE_OPTIONS, request => runDeepenAction(request, "reflect"));
exports.fuseServerInsight = onCall(CALLABLE_OPTIONS, request => runDeepenAction(request, "fusion"));
exports.drawServerBloom = onCall(CALLABLE_OPTIONS, request => runDeepenAction(request, "bloomDraw"));
exports.pickServerBloom = onCall(CALLABLE_OPTIONS, request => runDeepenAction(request, "bloomPick"));
exports.setServerDeepenDone = onCall(CALLABLE_OPTIONS, request => runDeepenAction(request, "done"));

exports.revealServerScoring = onCall(CALLABLE_OPTIONS, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "認証が必要です");
  const code = normalizeCode(request.data && request.data.code);
  const db = getDatabase();
  await enforceRateLimit(db, request.auth.uid, "revealScoring", 5);
  const session = (await db.ref(`sessions/${code}`).once("value")).val();
  if (!session || session.phase !== "battle" || Number(session.round) !== 3) throw new HttpsError("failed-precondition", "まだ終戦集計へ進めません");
  if (ownedSeat(session, request.auth.uid) !== 1) throw new HttpsError("permission-denied", "ホストだけが終戦集計を確定できます");
  const battle = session.battles && session.battles[3];
  if (!battle || battle.t1Winner == null || battle.t2Winner == null) throw new HttpsError("failed-precondition", "両卓の勝者を記録してください");
  const state = (await db.ref(`serverDraftSessions/${code}`).once("value")).val();
  if (!state || !state.decks) throw new HttpsError("failed-precondition", "サーバーデッキを確認できません");
  await db.ref(`sessions/${code}`).update({
    phase: "scoring",
    decks: state.decks,
    converted: state.converted || {},
    deckCounts: Object.fromEntries([1, 2, 3, 4].map(seat => [seat, (state.decks[seat] || []).length])),
    scoringRevealedAt: Date.now(),
  });
  return { ok: true };
});

exports.recordServerBattleResult = onCall(CALLABLE_OPTIONS, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "認証が必要です");
  const code = normalizeCode(request.data && request.data.code);
  const table = Number(request.data && request.data.table);
  const winnerSeat = Number(request.data && request.data.winnerSeat);
  if (![1, 2].includes(table)) throw new HttpsError("invalid-argument", "卓番号が不正です");
  const db = getDatabase();
  await enforceRateLimit(db, request.auth.uid, "battleResult", 20);
  let domainError = null;
  const result = await db.ref(`sessions/${code}`).transaction(session => {
    if (!session || session.phase !== "battle") { domainError = new Error("現在は勝敗を記録できません"); return; }
    if (ownedSeat(session, request.auth.uid) !== 1) { domainError = new Error("ホストだけが勝敗を記録できます"); return; }
    const round = Number(session.round || 1);
    const pair = battlePairings(session, round)[table - 1];
    if (!pair || !pair.includes(winnerSeat)) { domainError = new Error("勝者がこの卓の参加者ではありません"); return; }
    session.battles = session.battles || {};
    session.battles[round] = session.battles[round] || { t1Winner: null, t2Winner: null };
    session.battles[round][table === 1 ? "t1Winner" : "t2Winner"] = winnerSeat;
    return session;
  });
  if (domainError) throw new HttpsError("failed-precondition", domainError.message);
  if (!result.committed) throw new HttpsError("aborted", "勝敗記録が競合しました");
  return { ok: true, table, winnerSeat };
});

exports.submitBattleReport = onCall(CALLABLE_OPTIONS, async request => {
  const uid = request.auth && request.auth.uid;
  if (!uid) throw new HttpsError("unauthenticated", "認証が必要です");
  const db = getDatabase();
  await enforceRateLimit(db, uid, "submitBattleReport", 5, 60 * 60 * 1000);
  const category = String(request.data && request.data.category || "problem");
  if (!["problem", "sync", "abuse"].includes(category)) throw new HttpsError("invalid-argument", "報告種別が不正です");
  const report = request.data && request.data.report;
  if (!report || typeof report !== "object" || Array.isArray(report)) throw new HttpsError("invalid-argument", "診断データが必要です");
  const encoded = JSON.stringify(report);
  if (encoded.length > 200000) throw new HttpsError("invalid-argument", "診断データが大きすぎます");
  if (report.schemaVersion !== 1 || typeof report.buildVersion !== "string") throw new HttpsError("invalid-argument", "診断データ形式が不正です");
  for (const privateKey of ["uid", "ownerUid", "idToken", "accessToken", "refreshToken", "roomCode"]) {
    if (Object.prototype.hasOwnProperty.call(report, privateKey)) throw new HttpsError("invalid-argument", "非公開情報を含む診断データは送信できません");
  }
  const ref = db.ref("battleReports").push();
  await ref.set({ uid, category, report, createdAt: Date.now(), status: "new" });
  return { ok: true, reportId: ref.key };
});

exports.publishBattleState = onCall(CALLABLE_OPTIONS, async request => {
  const uid = request.auth && request.auth.uid;
  if (!uid) throw new HttpsError("unauthenticated", "認証が必要です");
  const code = normalizeCode(request.data && request.data.code);
  const table = String(request.data && request.data.table || "");
  if (!/^[a-z0-9_-]{1,20}$/i.test(table)) throw new HttpsError("invalid-argument", "卓識別子が不正です");
  const payload = request.data && request.data.payload;
  const baseRevision = Number(request.data && request.data.baseRevision || 0);
  const db = getDatabase();
  await enforceRateLimit(db, uid, "publishBattleState", 180);
  const base = `sessions/${code}/battle/${table}`;
  const protocol = (await db.ref(`${base}/protocol`).once("value")).val() || {};
  const writer = Number(payload && payload.writer);
  const [claimSnap, sessionSeatSnap, roomSnap, constructSnap] = await Promise.all([
    db.ref(`${base}/seatClaims/${writer}/ownerUid`).once("value"),
    db.ref(`sessions/${code}/seats/${writer}/ownerUid`).once("value"),
    db.ref(`rooms/${code}/${writer === 1 ? "host" : "guest"}/ownerUid`).once("value"),
    db.ref(`constructRooms/${code}/${writer === 1 ? "host" : "guest"}/ownerUid`).once("value"),
  ]);
  const ownerUid = claimSnap.val() || sessionSeatSnap.val() || (table === "shield" ? roomSnap.val() : null) || (table === "construct" ? constructSnap.val() : null);
  if (ownerUid !== uid) throw new HttpsError("permission-denied", "この座席を操作できません");
  let domainError = null;
  let committedState = null;
  const result = await db.ref(`${base}/state`).transaction(current => {
    if (Number(current && current.revision || 0) !== baseRevision) { domainError = new Error("共有盤面が更新されています"); return; }
    try { validateBattleTransition(payload, current, writer, protocol.buildVersion); }
    catch (e) { domainError = e; return; }
    const next = { ...payload, revision: baseRevision + 1, prevHash: current && current.stateHash || null, ts: Date.now() };
    next.stateHash = stateHash(next);
    committedState = next;
    return next;
  });
  if (!result.committed) throw new HttpsError("aborted", domainError ? domainError.message : "共有盤面の更新が競合しました");
  committedState = result.snapshot.val();
  const key = `${String(committedState.revision).padStart(10, "0")}_${writer}`;
  await db.ref(`${base}/operationLog/${key}`).set({
    revision: committedState.revision, writer, turn: committedState.turn, activeSeat: committedState.activeSeat,
    ts: committedState.ts, stateHash: committedState.stateHash, prevHash: committedState.prevHash || null,
    buildVersion: committedState.buildVersion,
  });
  return { state: committedState };
});

async function recordBattleStats(event, table) {
  const { code, round } = event.params;
  const winnerSeat = event.data.val();
  const sessionSnap = await getDatabase().ref(`sessions/${code}`).once("value");
  const contribution = buildBattleStatContribution(sessionSnap.val(), round, table, winnerSeat);
  if (!contribution) return null;
  contribution.createdAt = Date.now();
  contribution.sessionCode = code;
  contribution.round = Number(round);
  contribution.table = table;
  contribution.winnerSeat = winnerSeat;
  await getDatabase().ref(`globalStatsContributions/${code}_${round}_t${table}`).set(contribution);
  return contribution;
}

exports.recordTable1Stats = onValueCreated("/sessions/{code}/battles/{round}/t1Winner", event => recordBattleStats(event, 1));
exports.recordTable2Stats = onValueCreated("/sessions/{code}/battles/{round}/t2Winner", event => recordBattleStats(event, 2));

exports.recordBattleStats = recordBattleStats;
