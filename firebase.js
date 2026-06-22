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

/* Node.js テスト用 */
if (typeof module !== "undefined") {
  module.exports = { FIREBASE_CONFIG, getDb, fbArr, generateRoomCode };
}
