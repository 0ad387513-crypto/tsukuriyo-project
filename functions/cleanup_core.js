"use strict";

const ROOM_TTL_MS = Object.freeze({
  sessions: 2 * 60 * 60 * 1000,
  rooms: 60 * 60 * 1000,
  constructRooms: 60 * 60 * 1000,
});

const PUBLIC_KIND_BY_COLLECTION = Object.freeze({
  sessions: "game",
  rooms: "shield",
  constructRooms: "construct",
});

function normalizeCodes(value) {
  if (!value || typeof value !== "object") return [];
  return Object.keys(value).filter(Boolean);
}

function buildCleanupUpdates(expiredByCollection) {
  const updates = {};
  for (const collection of Object.keys(ROOM_TTL_MS)) {
    for (const code of normalizeCodes(expiredByCollection && expiredByCollection[collection])) {
      updates[`${collection}/${code}`] = null;
      updates[`publicRooms/${code}`] = null;
      updates[`spectatorAccess/${code}`] = null;
      if (collection === "sessions") {
        updates[`privateGameSessions/${code}`] = null;
        updates[`serverDraftSessions/${code}`] = null;
      }
      if (collection === "rooms") updates[`privateShieldRooms/${code}`] = null;
      if (collection === "constructRooms") updates[`privateConstructRooms/${code}`] = null;
    }
  }
  return updates;
}

module.exports = {
  ROOM_TTL_MS,
  PUBLIC_KIND_BY_COLLECTION,
  normalizeCodes,
  buildCleanupUpdates,
};
