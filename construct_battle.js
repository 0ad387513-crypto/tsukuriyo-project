/**
 * construct_battle.js
 * 理念構築戦（自由構築1v1）のルーム管理・進行ロジック + ストラクチャーデッキ管理
 *
 * シールド戦（shield_battle.js）と違い、パックのドラフトが無く、両プレイヤーは
 * 全カードプールから自由に35枚のデッキを組む。そのため状態マシンは単純：
 *
 *   lobby     → 部屋作成・入室待ち
 *   building  → 双方がデッキビルダー画面でデッキ＋カミを構築中
 *   complete  → 両者が「準備完了」を押した（対戦画面へ進める）
 *
 * デッキ内容そのもの（各Noの枚数マップ＋カミNo）は、準備完了を押した時点で
 * host/guest 配下にスナップショットとして書き込む（ドラフトと違い、対戦開始まで
 * 何度でも編集→再提出できる＝unsubmitで phase を building に戻せる）。
 *
 * 依存：firebase.js（getDb / generateRoomCode / publicRoomRegister / publicRoomRemove）
 * このファイルは firebase.js の後に読み込むこと。
 */

"use strict";

const CONSTRUCT_ROOM_TTL_MS     = 60 * 60 * 1000;

const CONSTRUCT_DECK_SIZE       = 35;  // 理念構築戦のデッキ枚数（ちょうど35枚）
const CONSTRUCT_MIN_RETURN_SUM  = 50;  // デッキの返還値合計の下限

/* ------------------------------------------------------------------ */
/* 部屋の作成・入室                                                      */
/* ------------------------------------------------------------------ */
/**
 * @param {string} playerName
 * @param {boolean} [isPublic]
 * @returns {Promise<{ roomCode, playerId, role: 'host' }>}
 */
async function createConstructRoom(playerName, isPublic) {
  const authUser = await ensureFirebaseAuth();
  if (typeof validatePlayerName === "function") {
    const valid = validatePlayerName(playerName);
    if (!valid.ok) throw new Error(valid.message);
    playerName = valid.value;
  }
  const db       = getDb();
  const roomCode = generateRoomCode();
  const playerId = generateRoomCode();

  const room = {
    phase: "lobby",
    buildVersion: getAppBuildVersion(),
    host:  { id: playerId, ownerUid: authUser.uid, name: playerName || "プレイヤー1", ready: false, deckCount: 0, kamiNo: null },
    guest: null,
    createdAt: Date.now(),
  };
  await db.ref(`constructRooms/${roomCode}`).set(room);

  // 1時間後に自動削除
  setTimeout(() => db.ref(`constructRooms/${roomCode}`).remove(), CONSTRUCT_ROOM_TTL_MS);

  if (isPublic && typeof publicRoomRegister === "function") {
    await publicRoomRegister("construct", roomCode, playerName);
  }
  return { roomCode, playerId, role: "host" };
}

/**
 * @param {string} roomCode
 * @param {string} playerName
 * @returns {Promise<{ playerId, role: 'guest' }>}
 */
async function joinConstructRoom(roomCode, playerName) {
  const authUser = await ensureFirebaseAuth();
  if (typeof validatePlayerName === "function") {
    const valid = validatePlayerName(playerName);
    if (!valid.ok) throw new Error(valid.message);
    playerName = valid.value;
  }
  const db  = getDb();
  const ref = db.ref(`constructRooms/${roomCode}`);
  const snap = await ref.once("value");

  if (!snap.exists()) throw new Error("部屋が見つかりません");
  const room = snap.val();
  assertCompatibleBuild(room.buildVersion);
  if (Date.now() - Number(room.createdAt || 0) >= CONSTRUCT_ROOM_TTL_MS) {
    throw new Error("この部屋は期限切れです。公開一覧から別の部屋を選んでください");
  }
  if (room.phase !== "lobby") throw new Error("この部屋はすでに対戦準備が始まっています");
  if (room.guest) throw new Error("この部屋はすでに満員です");

  const playerId = generateRoomCode();
  const res = await ref.transaction(cur => {
    if (!cur || cur.buildVersion !== getAppBuildVersion()) return;
    if (Date.now() - Number(cur.createdAt || 0) >= CONSTRUCT_ROOM_TTL_MS) return;
    if (cur.phase !== "lobby" || cur.guest) return;
    cur.guest = { id: playerId, ownerUid: authUser.uid, name: playerName || "プレイヤー2", ready: false, deckCount: 0, kamiNo: null };
    cur.phase = "building";
    return cur;
  });
  if (!res.committed) throw new Error("部屋への参加に失敗しました。満員・期限切れ・バージョン違いの可能性があります");

  if (typeof publicRoomRemove === "function") publicRoomRemove(roomCode);
  return { playerId, role: "guest" };
}

/* ------------------------------------------------------------------ */
/* デッキの提出／取り下げ                                                */
/* ------------------------------------------------------------------ */
/**
 * デッキ＋カミを確定として提出する。両者が提出済みになった時点で自動的に complete へ。
 * @param {string} roomCode
 * @param {string} role      "host" or "guest"
 * @param {Object} deckMap   { cardNo: count, ... }
 * @param {string} kamiNo
 */
async function submitConstructDeck(roomCode, role, deckMap, kamiNo) {
  const db  = getDb();
  const normalizedDeck = deckMap || {};
  const deckCount = Object.values(normalizedDeck).reduce((sum, count) => sum + Math.max(0, Number(count) || 0), 0);
  // phaseをcompleteにする判定・書き込みはここでは行わない（両者readyの検知は、既に
  // 繋ぎっぱなしのリアルタイム購読側（index.htmlの_cbSubscribe）が最新データを受け取った
  // 瞬間に行う方が、ここで追加の読み直しを挟むより速く・確実なため）。
  await db.ref().update({
    [`privateConstructRooms/${roomCode}/${role}/deck`]: normalizedDeck,
    [`privateConstructRooms/${roomCode}/${role}/updatedAt`]: firebase.database.ServerValue.TIMESTAMP,
    [`constructRooms/${roomCode}/${role}/deckCount`]: deckCount,
    [`constructRooms/${roomCode}/${role}/kamiNo`]: kamiNo || null,
    [`constructRooms/${roomCode}/${role}/ready`]: true,
  });
}

/** 本人の提出デッキだけを取得する。対戦相手のprivateパスはルールで読めない。 */
async function fetchPrivateConstructDeck(roomCode, role) {
  await ensureFirebaseAuth();
  const snap = await getDb().ref(`privateConstructRooms/${roomCode}/${role}`).once("value");
  return snap.val() || {};
}

/**
 * 両者のデッキが揃った（host/guestともready）ことを検知したクライアントが呼ぶ、
 * phaseをcompleteへ進めるだけの単純な書き込み。何度呼ばれても結果は同じなので安全。
 * @param {string} roomCode
 */
async function markConstructRoomComplete(roomCode) {
  await getDb().ref(`constructRooms/${roomCode}/phase`).set("complete");
}

/**
 * 提出を取り下げて編集に戻る（相手がまだ準備できていない間だけ意味がある）。
 * @param {string} roomCode
 * @param {string} role
 */
async function unsubmitConstructDeck(roomCode, role) {
  const db  = getDb();
  const ref = db.ref(`constructRooms/${roomCode}`);
  await ref.child(`${role}/ready`).set(false);
  // 対戦自体は別パス（openBattleLaunch）なので、ここでphaseをbuildingへ戻すのは無害。
  // room全体を読み書きするtransaction()は不要な往復・遅延の原因になるため、単純な書き込みにする。
  await ref.child("phase").set("building");
}

/* ------------------------------------------------------------------ */
/* ルームの購読                                                          */
/* ------------------------------------------------------------------ */
function subscribeConstructRoom(roomCode, callback) {
  const ref = getDb().ref(`constructRooms/${roomCode}`);
  ref.on("value", snap => callback(snap.val()));
  return () => ref.off("value");
}

/**
 * 部屋を解散する（ホストが呼ぶ想定）。Firebase上のルームデータを削除するため、
 * 相手クライアントの購読には null が届き、相手側でも解散を検知できる。
 * @param {string} roomCode
 */
async function dissolveConstructRoom(roomCode) {
  await getDb().ref(`constructRooms/${roomCode}`).remove();
}

/* ------------------------------------------------------------------ */
/* ストラクチャーデッキ（開発者が用意する構築済みデッキ）                    */
/* 誰でも参照でき、開発者用ツールから追加・編集・削除できる（本アプリの他の  */
/* データ同様、アクセス制御は行わずTOP画面の「動作確認用ツール」と同じ運用） */
/* ------------------------------------------------------------------ */
/**
 * @param {Function} callback ([{ id, name, kamiNo, deckCode, updatedAt }, ...]) => void
 * @returns {Function} unsubscribe
 */
function subscribeStructureDecks(callback) {
  let ref = null;
  let cancelled = false;
  const handler = (snap) => {
    const val = snap.val() || {};
    const list = Object.keys(val)
      .map(id => Object.assign({ id }, val[id]))
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ja"));
    callback(list);
  };
  ensureFirebaseAuth().then(() => {
    if (cancelled) return;
    ref = getDb().ref("structureDecks");
    ref.on("value", handler);
  }).catch(err => { console.error("[auth] ストラクチャーデッキ購読失敗:", err); callback([]); });
  return () => { cancelled = true; if (ref) ref.off("value", handler); };
}

/**
 * ストラクチャーデッキ一覧を一度だけ取得する（ソロプレイでCPUのデッキを選ぶ際に使用）。
 * @returns {Promise<Array<{ id, name, kamiNo, deckCode, updatedAt }>>}
 */
async function fetchStructureDecksOnce() {
  await ensureFirebaseAuth();
  const snap = await getDb().ref("structureDecks").once("value");
  const val = snap.val() || {};
  return Object.keys(val).map(id => Object.assign({ id }, val[id]));
}

/**
 * ストラクチャーデッキを新規作成 or 上書き保存する。
 * @param {string|null} id   既存IDを渡せば上書き、nullなら新規発行
 * @param {{ name: string, kamiNo: string, deckCode: string }} data
 * @returns {Promise<string>} id
 */
async function saveStructureDeck(id, data) {
  await requireFirebaseAdmin();
  const ref = getDb().ref("structureDecks");
  const key = id || ref.push().key;
  await ref.child(key).set({
    name:     data.name || "",
    kamiNo:   data.kamiNo || null,
    deckCode: data.deckCode || "",
    updatedAt: Date.now(),
  });
  return key;
}

async function removeStructureDeck(id) {
  await requireFirebaseAdmin();
  await getDb().ref(`structureDecks/${id}`).remove();
}

/**
 * structureDecksが空の場合のみ、デフォルト一覧を書き込む（初回起動シード用）。
 * @param {Array<{ name: string, kamiNo: string, deckCode: string }>} defaults
 */
async function seedStructureDecksIfEmpty(defaults) {
  await requireFirebaseAdmin();
  const ref  = getDb().ref("structureDecks");
  const snap = await ref.once("value");
  if (snap.exists()) return;
  const updates = {};
  for (const d of (defaults || [])) {
    const key = ref.push().key;
    updates[key] = { name: d.name || "", kamiNo: d.kamiNo || null, deckCode: d.deckCode || "", updatedAt: Date.now() };
  }
  if (Object.keys(updates).length) await ref.update(updates);
}

/* Node.js テスト用 */
if (typeof module !== "undefined") {
  module.exports = {
    CONSTRUCT_DECK_SIZE, CONSTRUCT_MIN_RETURN_SUM, CONSTRUCT_ROOM_TTL_MS,
    createConstructRoom, joinConstructRoom,
    submitConstructDeck, fetchPrivateConstructDeck, markConstructRoomComplete, unsubmitConstructDeck, subscribeConstructRoom, dissolveConstructRoom,
    subscribeStructureDecks, fetchStructureDecksOnce, saveStructureDeck, removeStructureDeck, seedStructureDecksIfEmpty,
  };
}
