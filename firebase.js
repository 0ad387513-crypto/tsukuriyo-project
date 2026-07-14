/**
 * firebase.js
 * Firebase 設定・初期化・共通ヘルパー（シールド戦 / ゲームセッション 共用）
 *
 * 読み込み順:
 *   firebase-app-compat.js / firebase-database-compat.js（SDK）
 *     → firebase.js（このファイル）
 *       → pack_generator.js / shield_battle.js / session.js
 *
 * ★ APIキーとアクセス制御:
 *   Web用APIキーはクライアントから参照される前提。実際のアクセス制御は
 *   Firebase匿名認証と database.rules.json の参加者UID検証で行う。
 */

"use strict";

/* ================================================================== */
/* Firebase 設定                                                       */
/* ================================================================== */
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyAbF1tv7aAUFvb1Gs8NrOgpqimJqDh3LoQ",
  authDomain:        "tsukuriyo-7afe3.firebaseapp.com",
  databaseURL:       "https://tsukuriyo-7afe3-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "tsukuriyo-7afe3",
  storageBucket:     "tsukuriyo-7afe3.firebasestorage.app",
  messagingSenderId: "241222545499",
  appId:             "1:241222545499:web:cbccb694efa38924350f7e",
  measurementId:     "G-FW33T6YHQP",
};

/* ================================================================== */
/* Firebase 初期化（グローバルに一度だけ）                              */
/* ================================================================== */
let _fbDb = null;
let _fbAuthPromise = null;
let _fbFunctions = null;
let _fbAppCheckReady = false;
function getDb() {
  if (_fbDb) return _fbDb;
  if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }
  _fbDb = firebase.database();
  ensureFirebaseAppCheck();
  return _fbDb;
}

function ensureFirebaseAppCheck() {
  if (_fbAppCheckReady) return true;
  const key = typeof TSUKURIYO_APPCHECK_SITE_KEY === "string" ? TSUKURIYO_APPCHECK_SITE_KEY.trim() : "";
  if (!key || typeof firebase.appCheck !== "function") return false;
  firebase.appCheck().activate(key, true);
  _fbAppCheckReady = true;
  return true;
}

/* 匿名認証：部屋コード方式を保ったまま、端末ごとのUIDを席所有者として利用する。 */
function ensureFirebaseAuth() {
  if (_fbAuthPromise) return _fbAuthPromise;
  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  if (typeof firebase.auth !== "function") {
    return Promise.reject(new Error("Firebase Auth SDKを読み込めませんでした"));
  }
  const auth = firebase.auth();
  _fbAuthPromise = auth.currentUser
    ? Promise.resolve(auth.currentUser)
    : auth.signInAnonymously().then(credential => credential.user).catch(err => {
        _fbAuthPromise = null;
        throw err;
      });
  return _fbAuthPromise;
}

function currentFirebaseUid() {
  try { return firebase.auth().currentUser ? firebase.auth().currentUser.uid : null; }
  catch (e) { return null; }
}

function getFirebaseFunctions() {
  if (_fbFunctions) return _fbFunctions;
  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  if (typeof firebase.app().functions !== "function") throw new Error("Firebase Functions SDKを読み込めませんでした");
  _fbFunctions = firebase.app().functions("asia-northeast1");
  return _fbFunctions;
}

async function callFirebaseFunction(name, data) {
  await ensureFirebaseAuth();
  const result = await getFirebaseFunctions().httpsCallable(name)(data || {});
  return result && result.data;
}

async function firebaseCurrentUserIsAdmin(forceRefresh = false) {
  const user = await ensureFirebaseAuth();
  if (!user || typeof user.getIdTokenResult !== "function") return false;
  const token = await user.getIdTokenResult(!!forceRefresh);
  return !!(token && token.claims && token.claims.admin === true);
}

async function requireFirebaseAdmin() {
  if (!await firebaseCurrentUserIsAdmin()) {
    throw new Error("この操作にはFirebase管理者権限が必要です");
  }
  return firebase.auth().currentUser;
}

function getAppBuildVersion() {
  return typeof TSUKURIYO_BUILD_VERSION === "string" ? TSUKURIYO_BUILD_VERSION : "unknown";
}

function assertCompatibleBuild(remoteVersion) {
  const localVersion = getAppBuildVersion();
  if (!remoteVersion || remoteVersion !== localVersion) {
    throw new Error(`バージョンが一致しません（部屋: ${remoteVersion || "旧版"} / あなた: ${localVersion}）。ページを再読み込みしてください。`);
  }
}

/* ================================================================== */
/* Firebase 配列ユーティリティ                                          */
/* Firebase は空配列を null、通常配列を {0:v,1:v,...} に変換するため     */
/* .length や spread が正しく動かない。この関数で正規化する。            */
/* ================================================================== */
function fbArr(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  return Object.keys(v)
    .sort((a, b) => Number(a) - Number(b))
    .map(k => v[k]);
}

/* ================================================================== */
/* 6文字コード生成（部屋コード / セッションコード / 簡易ID 共用）         */
/* 紛らわしい文字（0,O,1,I 等）を除外                                    */
/* ================================================================== */
function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/* Shared validation for every multiplayer entry point. Empty names use each
 * mode's default name; submitted names must be safe display text. */
function validatePlayerName(name) {
  const value = String(name == null ? "" : name).trim();
  if (!value) return { ok: true, value: "" };
  if (value.length > 20) return { ok: false, message: "プレイヤー名は20文字以内にしてください。" };
  if (/[\u0000-\u001f\u007f]/.test(value) || /[<>]/.test(value)) return { ok: false, message: "使用できない文字が含まれています。" };
  const normalized = value.toLowerCase().replace(/[\s\-_.・]/g, "");
  const banned = ["死ね", "しね", "殺す", "ころす", "ころし", "ばか", "バカ", "あほ", "アホ", "ちんこ", "ちんぽ", "まんこ", "セックス", "ふぁっく", "fuck", "shit", "asshole", "nigger", "retard", "rape"];
  if (banned.some(word => normalized.includes(word.toLowerCase()))) return { ok: false, message: "そのプレイヤー名は使用できません。別の名前にしてください。" };
  return { ok: true, value };
}

/* ================================================================== */
/* 公開ルーム一覧（マッチメイキングの摩擦解消）                          */
/* ホストが任意で自分のルーム/セッションを publicRooms/{code} に登録し、  */
/* 見知らぬ相手でも一覧やランダムマッチから合流できるようにする。          */
/* 個人情報は含めない（ホスト自身が入力した表示名のみ）。                  */
/* ================================================================== */

/** ルームを公開一覧に登録する（作成側のクライアントのみ呼ぶ）。
 *  そのクライアントが切断した場合は onDisconnect で自動的に一覧から消える。 */
async function publicRoomRegister(kind, code, hostName) {
  const user = await ensureFirebaseAuth();
  const ref = getDb().ref(`publicRooms/${code}`);
  const valid = validatePlayerName(hostName);
  if (!valid.ok) return Promise.reject(new Error(valid.message));
  // Wait for the index write before the creator proceeds to its lobby.
  const createdAt = Date.now();
  return ref.set({ kind, code, hostName: valid.value || "Player 1", ownerUid: user.uid, buildVersion: getAppBuildVersion(), seatsFilled: 1, createdAt, sortKey: publicRoomSortKey(kind, createdAt, code) })
    .then(() => { ref.onDisconnect().remove(); return ref; });
}

/** 公開一覧から明示的に削除する（満員になった・対戦が始まった等） */
function publicRoomRemove(code) {
  try { getDb().ref(`publicRooms/${code}`).remove().catch(() => {}); } catch (e) { /* noop */ }
}

/** 公開一覧の一部フィールドだけ更新する（例：4人対戦の埋まった席数） */
function publicRoomUpdate(code, patch) {
  try { getDb().ref(`publicRooms/${code}`).update(patch).catch(() => {}); } catch (e) { /* noop */ }
}

/** kind（"game" | "shield" | "construct"）の公開ルーム一覧を購読する。
 *  戻り値は購読解除関数。2時間以上前の記録はホスト異常終了等の取りこぼしと
 *  みなし一覧から除外する（実体のセッション/部屋自体のTTLとは別に、表示側でも保険をかける）。 */
function filterPublicRoomList(val, kind, now = Date.now(), buildVersion = getAppBuildVersion()) {
    const capacity = kind === "game" ? 4 : 2;
    return Object.keys(val || {})
      .map(code => val[code])
      .filter(r => r && r.kind === kind && r.buildVersion === buildVersion
        && Number(r.seatsFilled || 1) < capacity
        && now - (r.createdAt || 0) < 2 * 60 * 60 * 1000)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

function publicRoomSortKey(kind, createdAt, code) {
  return `${String(kind)}|${String(Math.max(0, Number(createdAt) || 0)).padStart(13, "0")}|${String(code || "")}`;
}

async function fetchPublicRoomsPage(kind, cursor = null, limit = 10) {
  await ensureFirebaseAuth();
  const pageSize = Math.max(1, Math.min(50, Number(limit) || 10));
  const prefix = `${kind}|`;
  const upper = cursor || `${prefix}9999999999999|~~~~~~`;
  const snap = await getDb().ref("publicRooms").orderByChild("sortKey")
    .startAt(prefix).endAt(upper).limitToLast(pageSize + (cursor ? 1 : 0)).once("value");
  let list = filterPublicRoomList(snap.val() || {}, kind);
  if (cursor) list = list.filter(room => room.sortKey !== cursor);
  list = list.slice(0, pageSize);
  return { rooms: list, cursor: list.length ? list[list.length - 1].sortKey : cursor, hasMore: list.length === pageSize };
}

async function beginMatchmaking(kind) {
  const user = await ensureFirebaseAuth();
  const ref = getDb().ref(`matchmaking/${user.uid}`);
  const token = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  await ref.set({ ownerUid: user.uid, kind, token, status: "searching", buildVersion: getAppBuildVersion(), updatedAt: Date.now() });
  ref.onDisconnect().remove();
  return token;
}

async function cancelMatchmaking(token) {
  const user = await ensureFirebaseAuth();
  const ref = getDb().ref(`matchmaking/${user.uid}`);
  await ref.transaction(current => current && current.token === token ? { ...current, status: "cancelled", updatedAt: Date.now() } : current);
}

async function matchmakingIsCancelled(token) {
  const user = await ensureFirebaseAuth();
  const value = (await getDb().ref(`matchmaking/${user.uid}`).once("value")).val();
  return !value || value.token !== token || value.status === "cancelled";
}

async function finishMatchmaking(token) {
  const user = await ensureFirebaseAuth();
  const ref = getDb().ref(`matchmaking/${user.uid}`);
  await ref.transaction(current => current && current.token === token ? null : current);
}

function subscribePublicRooms(kind, callback, limit = 50) {
  let ref = null;
  let cancelled = false;
  const handler = (snap) => {
    callback(filterPublicRoomList(snap.val() || {}, kind));
  };
  ensureFirebaseAuth().then(() => {
    if (cancelled) return;
    const prefix = `${kind}|`;
    ref = getDb().ref("publicRooms").orderByChild("sortKey").startAt(prefix).endAt(`${prefix}9999999999999|~~~~~~`).limitToLast(Math.max(1, Math.min(50, Number(limit) || 10)));
    ref.on("value", handler);
  }).catch(err => {
    console.error("[auth] 公開ルーム一覧を購読できません:", err);
    callback([]);
  });
  return () => {
    cancelled = true;
    if (ref) ref.off("value", handler);
  };
}

/* Node.js テスト用 */
if (typeof module !== "undefined") {
  module.exports = {
    FIREBASE_CONFIG, getDb, ensureFirebaseAuth, currentFirebaseUid, getFirebaseFunctions, callFirebaseFunction, firebaseCurrentUserIsAdmin, requireFirebaseAdmin, getAppBuildVersion, assertCompatibleBuild, fbArr, generateRoomCode,
    publicRoomRegister, publicRoomRemove, publicRoomUpdate, subscribePublicRooms, fetchPublicRoomsPage, publicRoomSortKey, filterPublicRoomList, validatePlayerName,
    beginMatchmaking, cancelMatchmaking, matchmakingIsCancelled, finishMatchmaking,
  };
}
