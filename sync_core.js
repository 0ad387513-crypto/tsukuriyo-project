"use strict";

function syncCanonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(syncCanonicalJson).join(",") + "]";
  return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + syncCanonicalJson(value[key])).join(",") + "}";
}

// Realtime Database は null・空配列・空オブジェクトを保存せず、読み戻し時には
// プロパティ自体が消える。書き込み前と読み戻し後で同じハッシュになるよう正規化する。
function syncFirebaseValue(value) {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    const out = value.map(syncFirebaseValue);
    while (out.length && out[out.length - 1] === null) out.pop();
    return out.length ? out : null;
  }
  if (typeof value === "object") {
    const out = {};
    Object.keys(value).forEach(key => {
      const normalized = syncFirebaseValue(value[key]);
      if (normalized !== null) out[key] = normalized;
    });
    return Object.keys(out).length ? out : null;
  }
  return value;
}

function syncStateHash(state) {
  const target = {};
  Object.keys(state || {}).filter(key => key !== "stateHash").forEach(key => { target[key] = state[key]; });
  const input = syncCanonicalJson(syncFirebaseValue(target) || {});
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ("00000000" + (hash >>> 0).toString(16)).slice(-8);
}

function syncVersionsMatch(expected, actual) {
  return typeof expected === "string" && expected.length > 0 && expected === actual;
}

function syncDisconnectRemainingMs(now, disconnectedAt, graceSeconds) {
  const elapsed = Math.max(0, Number(now) - Number(disconnectedAt));
  return Math.max(0, Number(graceSeconds) * 1000 - elapsed);
}

if (typeof module !== "undefined") {
  module.exports = { syncCanonicalJson, syncFirebaseValue, syncStateHash, syncVersionsMatch, syncDisconnectRemainingMs };
}
