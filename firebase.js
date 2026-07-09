/**
 * firebase.js
 * Firebase 設定・初期化・共通ヘルパー（シールド戦 / ゲームセッション 共用）
 *
 * 読み込み順:
 *   firebase-app-compat.js / firebase-database-compat.js（SDK）
 *     → firebase.js（このファイル）
 *       → pack_generator.js / shield_battle.js / session.js
 *
 * ★ APIキー直書きについて:
 *   本格運用前に Realtime Database のセキュリティルールを必ず設定すること
 *   （誰でも書ける状態は乱用される）。例:
 *   {
 *     "rules": {
 *       "rooms":    { "$id": { ".read": true, ".write": true } },
 *       "sessions": { "$id": { ".read": true, ".write": true } }
 *     }
 *   }
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
function getDb() {
  if (_fbDb) return _fbDb;
  if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }
  _fbDb = firebase.database();
  return _fbDb;
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

/* ================================================================== */
/* 公開ルーム一覧（マッチメイキングの摩擦解消）                          */
/* ホストが任意で自分のルーム/セッションを publicRooms/{code} に登録し、  */
/* 見知らぬ相手でも一覧やランダムマッチから合流できるようにする。          */
/* 個人情報は含めない（ホスト自身が入力した表示名のみ）。                  */
/* ================================================================== */

/** ルームを公開一覧に登録する（作成側のクライアントのみ呼ぶ）。
 *  そのクライアントが切断した場合は onDisconnect で自動的に一覧から消える。 */
function publicRoomRegister(kind, code, hostName) {
  const ref = getDb().ref(`publicRooms/${code}`);
  ref.set({ kind, code, hostName: hostName || "プレイヤー1", createdAt: Date.now() }).catch(() => {});
  ref.onDisconnect().remove();
  return ref;
}

/** 公開一覧から明示的に削除する（満員になった・対戦が始まった等） */
function publicRoomRemove(code) {
  try { getDb().ref(`publicRooms/${code}`).remove().catch(() => {}); } catch (e) { /* noop */ }
}

/** 公開一覧の一部フィールドだけ更新する（例：4人対戦の埋まった席数） */
function publicRoomUpdate(code, patch) {
  try { getDb().ref(`publicRooms/${code}`).update(patch).catch(() => {}); } catch (e) { /* noop */ }
}

/** kind（"game" | "shield"）の公開ルーム一覧を購読する。
 *  戻り値は購読解除関数。2時間以上前の記録はホスト異常終了等の取りこぼしと
 *  みなし一覧から除外する（実体のセッション/部屋自体のTTLとは別に、表示側でも保険をかける）。 */
function subscribePublicRooms(kind, callback) {
  const ref = getDb().ref("publicRooms");
  const handler = (snap) => {
    const val = snap.val() || {};
    const now = Date.now();
    const list = Object.keys(val)
      .map(code => val[code])
      .filter(r => r && r.kind === kind && now - (r.createdAt || 0) < 2 * 60 * 60 * 1000)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    callback(list);
  };
  ref.on("value", handler);
  return () => ref.off("value", handler);
}

/* Node.js テスト用 */
if (typeof module !== "undefined") {
  module.exports = {
    FIREBASE_CONFIG, getDb, fbArr, generateRoomCode,
    publicRoomRegister, publicRoomRemove, publicRoomUpdate, subscribePublicRooms,
  };
}
