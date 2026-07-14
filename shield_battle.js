/**
 * shield_battle.js
 * シールド戦（ドラフト）のルーム管理・進行ロジック
 *
 * 依存：
 *   - Firebase Realtime Database SDK (compat版)
 *   - pack_generator.js
 *   - udonarium_export.js
 *
 * Firebase プロジェクトのセットアップ：
 *   1. https://console.firebase.google.com でプロジェクト作成
 *   2. Realtime Database を作成（「テストモード」で開始→後でルール設定）
 *   3. 下記 FIREBASE_CONFIG を自分のプロジェクトの値に差し替える
 *
 * Realtime Database セキュリティルール（推奨）：
 * {
 *   "rules": {
 *     "rooms": {
 *       "$roomId": {
 *         ".read": true,
 *         ".write": true,
 *         // 自動削除はCloud Functionsで実装、またはクライアント側タイムアウトで対応
 *       }
 *     }
 *   }
 * }
 */

"use strict";

const SHIELD_ROOM_TTL_MS = 60 * 60 * 1000;

/* ================================================================== */
/* Firebase 設定 / getDb / fbArr / generateRoomCode は firebase.js に  */
/* 移動しました（シールド戦とゲームセッションで共用）。                  */
/* このファイルは firebase.js の後に読み込むこと。                      */
/* ================================================================== */

/* ================================================================== */
/* 定数                                                                */
/* ================================================================== */
const TOTAL_PACKS     = 15;
const PACKS_PER_SIDE  = 4;   // 各プレイヤーが取るパック数（合計8パック）
const DECK_SIZE       = 40;  // 最終デッキ枚数（48枚取得後8枚除外）
const CARDS_PER_PACK  = 12;
const KAMI_CANDIDATES = 10;  // カミ候補数

/* fbArr / generateRoomCode は firebase.js へ移動（共用ユーティリティ） */

/* ================================================================== */
/* ルーム状態マシン                                                     */
/*                                                                      */
/* phases:                                                              */
/*   lobby        → 部屋作成・入室待ち                                  */
/*   coin_toss    → 先攻/後攻決め（両者がREADY後に自動コイントス）      */
/*   picking      → パックピック（交互に8パック取得）                   */
/*   excluding    → 自分の48枚から8枚除外してデッキ40枚確定             */
/*   kami_select  → カミ選択（後攻→先攻の順）                           */
/*   complete     → 完了（ユドナリウム出力可能）                        */
/* ================================================================== */

/* getDb() は firebase.js へ移動 */

/* ------------------------------------------------------------------ */
/* 部屋の作成                                                           */
/* ------------------------------------------------------------------ */
/**
 * @param {string} playerName  自分の名前（任意）
 * @param {boolean} [isPublic] trueならpublicRoomsに登録し、見知らぬ相手にも一覧・ランダムマッチから見つけてもらえるようにする
 * @returns {Promise<{ roomCode, playerId, role: 'host' }>}
 */
async function createRoom(playerName, isPublic) {
  const authUser = await ensureFirebaseAuth();
  if (typeof validatePlayerName === "function") {
    const valid = validatePlayerName(playerName);
    if (!valid.ok) throw new Error(valid.message);
    playerName = valid.value;
  }
  const db       = getDb();
  const roomCode = generateRoomCode();
  const playerId = generateRoomCode(); // セッションID（簡易）
  const seed     = roomCodeToSeed(roomCode);

  const room = {
    phase:     "lobby",
    buildVersion: getAppBuildVersion(),
    seed,
    host: {
      id:     playerId,
      ownerUid: authUser.uid,
      name:   playerName || "プレイヤー1",
      ready:  false,
    },
    guest:           null,
    firstPicker:     null,     // "host" or "guest"（コイントスで決定）
    pickOrder:       [],       // 取得済みパックIDの順序記録 [{role, packId}]
    hostPickedPacks: [],       // host が取ったパックID
    guestPickedPacks: [],      // guest が取ったパックID
    hostExcluded:    [],       // host が除外した cardNo リスト
    guestExcluded:   [],       // guest が除外した cardNo リスト
    hostKami:        null,     // host が選んだカミの no
    guestKami:       null,     // guest が選んだカミの no
    kamiSelectTurn:  null,     // "guest" or "host"（後攻から先に選ぶ）
    createdAt:       Date.now(),
    unusedPacks:     [],       // 選ばれなかった7パックのIDリスト（後から確認用）
  };

  await db.ref(`rooms/${roomCode}`).set(room);

  // 1時間後に自動削除（Firebase側のTTLルールがなければクライアント側で設定）
  setTimeout(() => db.ref(`rooms/${roomCode}`).remove(), SHIELD_ROOM_TTL_MS);

  if (isPublic && typeof publicRoomRegister === "function") {
    await publicRoomRegister("shield", roomCode, playerName);
  }

  return { roomCode, playerId, role: "host" };
}

/* ------------------------------------------------------------------ */
/* 部屋への入室                                                         */
/* ------------------------------------------------------------------ */
/**
 * @param {string} roomCode
 * @param {string} playerName
 * @returns {Promise<{ playerId, role: 'guest' }>}
 */
async function joinRoom(roomCode, playerName) {
  const authUser = await ensureFirebaseAuth();
  if (typeof validatePlayerName === "function") {
    const valid = validatePlayerName(playerName);
    if (!valid.ok) throw new Error(valid.message);
    playerName = valid.value;
  }
  const db  = getDb();
  const ref = db.ref(`rooms/${roomCode}`);
  const snap = await ref.once("value");

  if (!snap.exists()) throw new Error("部屋が見つかりません");
  const room = snap.val();
  assertCompatibleBuild(room.buildVersion);
  if (Date.now() - Number(room.createdAt || 0) >= SHIELD_ROOM_TTL_MS) {
    throw new Error("この部屋は期限切れです。公開一覧から別の部屋を選んでください");
  }
  if (room.phase !== "lobby") throw new Error("この部屋はすでに対戦が始まっています");
  if (room.guest) throw new Error("この部屋はすでに満員です");

  const playerId = generateRoomCode();

  const res = await ref.transaction(cur => {
    if (!cur || cur.buildVersion !== getAppBuildVersion()) return;
    if (Date.now() - Number(cur.createdAt || 0) >= SHIELD_ROOM_TTL_MS) return;
    if (cur.phase !== "lobby" || cur.guest) return;
    cur.guest = {
      id:    playerId,
      ownerUid: authUser.uid,
      name:  playerName || "プレイヤー2",
      ready: false,
    };
    return cur;
  });
  if (!res.committed) throw new Error("部屋への参加に失敗しました。満員・期限切れ・バージョン違いの可能性があります");

  // guestが入って満員になったので公開一覧からは外す
  if (typeof publicRoomRemove === "function") publicRoomRemove(roomCode);

  return { playerId, role: "guest" };
}

/* ------------------------------------------------------------------ */
/* 準備完了（両者がtrueになったらコイントスへ自動遷移）                 */
/* ------------------------------------------------------------------ */
async function setReady(roomCode, role, playerId) {
  const db  = getDb();
  const ref = db.ref(`rooms/${roomCode}`);

  await ref.child(`${role}/ready`).set(true);

  // 両者が揃っているかチェック（トランザクションで競合防止）
  await ref.transaction(room => {
    if (!room) return room;
    if (room.host?.ready && room.guest?.ready && room.phase === "lobby") {
      // コイントスで先攻決定
      const firstPicker = Math.random() < 0.5 ? "host" : "guest";
      room.phase       = "coin_toss";
      room.firstPicker = firstPicker;
    }
    return room;
  });
}

/* ------------------------------------------------------------------ */
/* コイントス結果の確認後 → ピックフェーズへ                            */
/* ------------------------------------------------------------------ */
async function startPicking(roomCode) {
  const db = getDb();
  await db.ref(`rooms/${roomCode}/phase`).set("picking");
}

/* ------------------------------------------------------------------ */
/* パックのピック                                                        */
/* ------------------------------------------------------------------ */
/**
 * 自分のターンにパックを選ぶ
 * @param {string} roomCode
 * @param {string} role       "host" or "guest"
 * @param {number} packId     選んだパックのindex (0〜14)
 */
async function pickPack(roomCode, role, packId) {
  const db  = getDb();
  const ref = db.ref(`rooms/${roomCode}`);

  await ref.transaction(room => {
    if (!room) return room;
    if (room.phase !== "picking") return; // 無効

    // Firebase は空配列を null、配列を {0:v,...} として返すため fbArr で正規化
    const hostPacks  = fbArr(room.hostPickedPacks);
    const guestPacks = fbArr(room.guestPickedPacks);
    const total = hostPacks.length + guestPacks.length;

    // 自分のターン判定（先攻/後攻交互）
    const turnRole = total % 2 === 0 ? room.firstPicker
                                     : (room.firstPicker === "host" ? "guest" : "host");
    if (turnRole !== role) return; // 自分のターンではない

    // すでに取られたパックでないか確認
    const taken = [...hostPacks, ...guestPacks];
    if (taken.includes(packId)) return;

    // パックを追加
    const newHostPacks  = role === "host"  ? [...hostPacks,  packId] : hostPacks;
    const newGuestPacks = role === "guest" ? [...guestPacks, packId] : guestPacks;
    room.hostPickedPacks  = newHostPacks;
    room.guestPickedPacks = newGuestPacks;
    room.pickOrder = [...fbArr(room.pickOrder), { role, packId }];

    const newTotal = newHostPacks.length + newGuestPacks.length;

    // 8パック（双方4枚ずつ）取り終えたらカミ選択フェーズへ（除外フェーズはスキップ）
    if (newTotal >= PACKS_PER_SIDE * 2) {
      room.phase = "kami_select";
      // 後攻から先にカミを選ぶ
      room.kamiSelectTurn = room.firstPicker === "host" ? "guest" : "host";
      // 残り7パックを unusedPacks に記録
      const allPackIds = Array.from({ length: TOTAL_PACKS }, (_, i) => i);
      const newTaken   = [...newHostPacks, ...newGuestPacks];
      room.unusedPacks = allPackIds.filter(id => !newTaken.includes(id));
    }

    return room;
  });
}

/* ------------------------------------------------------------------ */
/* 除外カードの確定（48枚→40枚）                                        */
/* ------------------------------------------------------------------ */
/**
 * @param {string}   roomCode
 * @param {string}   role          "host" or "guest"
 * @param {string[]} excludedNos   除外するカードのno配列（8枚）
 */
async function finalizeExclusion(roomCode, role, excludedNos) {
  const db  = getDb();
  const ref = db.ref(`rooms/${roomCode}`);

  const key = role === "host" ? "hostExcluded" : "guestExcluded";
  await ref.child(key).set(excludedNos);

  // 両者が除外完了したらカミ選択フェーズへ
  await ref.transaction(room => {
    if (!room) return room;
    if (fbArr(room.hostExcluded).length >= 8 && fbArr(room.guestExcluded).length >= 8 &&
        room.phase === "excluding") {
      room.phase = "kami_select";
      // 後攻から先に選ぶ
      room.kamiSelectTurn = room.firstPicker === "host" ? "guest" : "host";
    }
    return room;
  });
}

/** 返還後の最終デッキを本人専用パスへ保存し、公開ルームには枚数だけを残す。 */
async function submitPrivateShieldDeck(roomCode, role, cards) {
  await ensureFirebaseAuth();
  const deck = {};
  for (const card of (cards || [])) {
    if (!card || card.no == null) continue;
    const no = String(card.no);
    deck[no] = (deck[no] || 0) + 1;
  }
  const count = Object.values(deck).reduce((sum, n) => sum + Number(n || 0), 0);
  await getDb().ref().update({
    [`privateShieldRooms/${roomCode}/${role}/deck`]: deck,
    [`privateShieldRooms/${roomCode}/${role}/updatedAt`]: firebase.database.ServerValue.TIMESTAMP,
    [`rooms/${roomCode}/${role}/deckCount`]: count,
  });
  return deck;
}

async function fetchPrivateShieldDeck(roomCode, role) {
  await ensureFirebaseAuth();
  const snap = await getDb().ref(`privateShieldRooms/${roomCode}/${role}`).once("value");
  return snap.val() || {};
}

/* ------------------------------------------------------------------ */
/* カミの選択（後攻→先攻）                                              */
/* ------------------------------------------------------------------ */
/**
 * @param {string} roomCode
 * @param {string} role      "host" or "guest"
 * @param {string} kamiNo    選んだカミの no
 */
async function selectKami(roomCode, role, kamiNo) {
  const db  = getDb();
  const ref = db.ref(`rooms/${roomCode}`);

  await ref.transaction(room => {
    if (!room) return room;
    if (room.phase !== "kami_select") return;
    if (room.kamiSelectTurn !== role) return; // 自分のターンではない

    if (role === "host") room.hostKami = kamiNo;
    else                 room.guestKami = kamiNo;

    // 次のターンへ or 完了
    const otherRole = role === "host" ? "guest" : "host";
    const otherKami = role === "host" ? room.guestKami : room.hostKami;
    if (otherKami) {
      room.phase = "complete";
    } else {
      room.kamiSelectTurn = otherRole;
    }
    return room;
  });
}

/* ------------------------------------------------------------------ */
/* ルームの購読（Vue のwatch等で使用）                                  */
/* ------------------------------------------------------------------ */
/**
 * @param {string}   roomCode
 * @param {Function} callback  (roomData) => void
 * @returns {Function} unsubscribe
 */
function subscribeRoom(roomCode, callback) {
  const ref = getDb().ref(`rooms/${roomCode}`);
  ref.on("value", snap => callback(snap.val()));
  return () => ref.off("value");
}

/* ------------------------------------------------------------------ */
/* ユーティリティ：自分のデッキを計算                                   */
/* ------------------------------------------------------------------ */
/**
 * pickedPacks + excludedNos からデッキ40枚を導出
 * @param {Object[]} packs          generatePacks() の戻り値
 * @param {number[]} pickedPackIds  取ったパックのIDリスト
 * @param {string[]} excludedNos   除外したカードのnoリスト
 * @returns {Object[]} 40枚のカード配列
 */
function computeDeck(packs, pickedPackIds, excludedNos) {
  const all48 = pickedPackIds.flatMap(id => packs[id].all);
  return all48.filter(c => !excludedNos.includes(String(c.no)));
}

/* ------------------------------------------------------------------ */
/* カミ候補リスト（全カミからランダム10体）                             */
/* ------------------------------------------------------------------ */
/**
 * @param {Object[]} allKamiCards  全カミカード
 * @param {number}   seed         シード（generatePacksと同じseedを使用）
 * @returns {Object[]} 10体のカミカード
 */
function selectKamiCandidates(allKamiCards, seed) {
  const rng = mulberry32(seed + 1); // パック生成と別のシードを使う
  const shuffled = seededShuffle(allKamiCards, rng);
  return shuffled.slice(0, Math.min(KAMI_CANDIDATES, shuffled.length));
}

/* export */
if (typeof module !== "undefined") {
  module.exports = {
    createRoom, joinRoom, setReady, startPicking, SHIELD_ROOM_TTL_MS,
    pickPack, finalizeExclusion, submitPrivateShieldDeck, fetchPrivateShieldDeck, selectKami,
    subscribeRoom, computeDeck, selectKamiCandidates,
  };
}
