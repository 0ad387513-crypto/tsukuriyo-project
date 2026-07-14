"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ROOM_TTL_MS, buildCleanupUpdates } = require("../functions/cleanup_core.js");

test("server cleanup uses the same room lifetimes as the clients", () => {
  assert.equal(ROOM_TTL_MS.sessions, 2 * 60 * 60 * 1000);
  assert.equal(ROOM_TTL_MS.rooms, 60 * 60 * 1000);
  assert.equal(ROOM_TTL_MS.constructRooms, 60 * 60 * 1000);
});

test("expired rooms and their public listings are deleted atomically", () => {
  assert.deepEqual(buildCleanupUpdates({
    sessions: { GAME01: { createdAt: 1 } },
    rooms: { SHIELD: { createdAt: 2 } },
    constructRooms: { BUILD1: { createdAt: 3 } },
  }), {
    "sessions/GAME01": null,
    "privateGameSessions/GAME01": null,
    "serverDraftSessions/GAME01": null,
    "publicRooms/GAME01": null,
    "spectatorAccess/GAME01": null,
    "rooms/SHIELD": null,
    "privateShieldRooms/SHIELD": null,
    "publicRooms/SHIELD": null,
    "spectatorAccess/SHIELD": null,
    "constructRooms/BUILD1": null,
    "privateConstructRooms/BUILD1": null,
    "publicRooms/BUILD1": null,
    "spectatorAccess/BUILD1": null,
  });
});

test("Firebase configuration and indexes include scheduled cleanup", () => {
  const root = path.join(__dirname, "..");
  const config = JSON.parse(fs.readFileSync(path.join(root, "firebase.json"), "utf8"));
  const rules = JSON.parse(fs.readFileSync(path.join(root, "database.rules.json"), "utf8")).rules;
  assert.equal(config.functions.source, "functions");
  assert.equal(config.functions.runtime, "nodejs22");
  assert.deepEqual(rules.sessions[".indexOn"], ["createdAt"]);
  assert.deepEqual(rules.rooms[".indexOn"], ["createdAt"]);
  assert.deepEqual(rules.constructRooms[".indexOn"], ["createdAt"]);
  const functionSource = fs.readFileSync(path.join(root, "functions", "index.js"), "utf8");
  assert.match(functionSource, /onSchedule/);
  assert.match(functionSource, /every 15 minutes/);
  assert.match(functionSource, /db\.ref\(\)\.update\(updates\)/);
  assert.match(functionSource, /onValueDeleted\("\/constructRooms\/\{code\}"/);
  assert.match(functionSource, /privateConstructRooms/);
  assert.match(functionSource, /onValueDeleted\("\/rooms\/\{code\}"/);
  assert.match(functionSource, /privateShieldRooms/);
  const adminScript = fs.readFileSync(path.join(root, "functions", "set_admin.js"), "utf8");
  assert.match(adminScript, /setCustomUserClaims/);
  assert.match(adminScript, /applicationDefault/);
});
