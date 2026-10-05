"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const motion = require("../kami_motion.js");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("reaction poses follow their fallback chain and emotes prefer their own pose", () => {
  const set = { layers: [{ src: "body.webp", idle: "breathe" }], poses: {
    damage: "damage.webp", skill1: { frames: ["s1.webp", "s2.webp"], fps: 8 }, emote: "emote.webp", "emote:taunt": "taunt.webp",
  } };
  assert.deepEqual(motion.kamiMotionResolvePose(set, "damageHeavy").frames, ["damage.webp"]);
  assert.deepEqual(motion.kamiMotionResolvePose(set, "skill2"), { frames: ["s1.webp", "s2.webp"], fps: 8, loop: false });
  assert.deepEqual(motion.kamiMotionResolvePose(set, "lose").frames, ["damage.webp"], "lose → damageHeavy → damage");
  assert.deepEqual(motion.kamiMotionResolvePose(set, "emote", "taunt").frames, ["taunt.webp"]);
  assert.deepEqual(motion.kamiMotionResolvePose(set, "emote", "praise").frames, ["emote.webp"]);
  assert.equal(motion.kamiMotionResolvePose(set, "tenryoku"), null, "no pose → idle art with the effect only");
  assert.equal(motion.kamiMotionResolvePose({ layers: [], poses: {} }, "damage"), null);
});

test("stat changes map to reactions and mana changes do not move the Kami", () => {
  const map = motion.kamiMotionEventForStat;
  assert.equal(map("life", -1), "damage");
  assert.equal(map("life", -2), "damage");
  assert.equal(map("life", -3), "damageHeavy");
  assert.equal(map("life", 2), "heal");
  assert.equal(map("tenryoku", 1), "tenryoku");
  assert.equal(map("tenryoku", -1), null);
  assert.equal(map("seal", -1), "sealBreak");
  assert.equal(map("seal", 1), null);
  assert.equal(map("mana", -2), null);
  assert.equal(map("life", 0), null);
});

test("reaction time follows animation speed and reduced motion, and results are held", () => {
  assert.equal(motion.kamiMotionDuration("damage"), 900);
  assert.equal(motion.kamiMotionDuration("damage", "fast"), 540);
  assert.equal(motion.kamiMotionDuration("damage", "normal", true), 540);
  assert.equal(motion.kamiMotionDuration("damage", "minimal"), 0);
  assert.equal(motion.kamiMotionDuration("win"), 0);
  assert.equal(motion.kamiMotionDuration("unknown"), 0);
});

test("every event fallback points to an existing event", () => {
  for (const [type, ev] of Object.entries(motion.KAMI_MOTION_EVENTS)) {
    if (ev.fallback) assert.ok(motion.KAMI_MOTION_EVENTS[ev.fallback], type);
    assert.ok(ev.hold || ev.duration > 0, type);
  }
});

test("registered motion sets are well formed and every image exists", () => {
  const poseKeys = new Set([...Object.keys(motion.KAMI_MOTION_EVENTS), "pinch", ...motion.KAMI_MOTION_EMOTE_KEYS.map(k => "emote:" + k)]);
  for (const [no, set] of Object.entries(motion.KAMI_MOTION_SETS)) {
    assert.match(no, /^(?:[1-9]|10)$/, "key is a Kami No.");
    assert.ok(Array.isArray(set.layers) && set.layers.length, `${no}: layers`);
    for (const layer of set.layers) assert.ok(motion.KAMI_MOTION_IDLE_PRESETS.includes(layer.idle || "none"), `${no}: idle ${layer.idle}`);
    for (const key of Object.keys(set.poses || {})) assert.ok(poseKeys.has(key), `${no}: unknown pose ${key}`);
    for (const url of motion.kamiMotionUrls(no)) {
      assert.match(url, /^kami_motion\/[^?#]+-[0-9a-f]{12}\.webp$/, `${no}: ${url} is a hashed WebP in kami_motion/`);
      assert.ok(fs.existsSync(path.join(root, url)), `${no}: ${url} exists`);
    }
  }
});

test("unregistered Kami keep the static portrait and no images are requested", () => {
  assert.equal(motion.kamiMotionSet("99"), null);
  assert.deepEqual(motion.kamiMotionUrls("99"), []);
  const sets = { "3": { layers: [{ src: "kami_motion/a.webp", idle: "breathe" }], blink: "kami_motion/b.webp", poses: { damage: "kami_motion/a.webp" } } };
  assert.ok(motion.kamiMotionSet(3, sets));
  assert.deepEqual(motion.kamiMotionUrls(3, sets), ["kami_motion/a.webp", "kami_motion/b.webp"]);
});

test("battle portraits host the motion component and reactions are wired", () => {
  assert.ok(html.includes('<link rel="stylesheet" href="kami_motion.css">'));
  assert.ok(html.indexOf('<script src="kami_motion.js"></script>') > html.indexOf('<script src="https://cdn.jsdelivr.net/npm/vue@2.6.14"></script>'), "component registers after Vue loads");
  for (const side of ["opp", "self"]) {
    assert.ok(html.includes(`<kami-motion v-if="kamiMotionAvailable(battleView.${side}.kami)" :kami-no="battleView.${side}.kami.no" :event="kamiMotionEvents.${side}"`), side);
    assert.ok(html.includes(`'has-kami-motion': kamiMotionAvailable(battleView.${side}.kami)`), side);
  }
  assert.match(html, /this\._kamiMotionPlay\(side, kamiMotionEventForStat\(key,/);
  assert.match(html, /this\._kamiMotionPlay\(side, 'emote', speechOptions\.emote \? speechOptions\.emote\.key : null\)/);
  assert.match(html, /this\.\$watch\('battleSkillCloseup'/);
  assert.match(html, /kamiMotionEvents = \{ self: null, opp: null \}; \/\/ 前の対戦の反応を持ち越さない/);
});

test("motion is only sent to registered Kami on the battle screen", () => {
  const body = html.match(/    _kamiMotionPlay\(side, type, detail = null\) \{([\s\S]*?)\r?\n    \},/);
  assert.ok(body);
  const play = new Function("side,type,detail", body[1]);
  const registered = { no: "1" }, plain = { no: "2" };
  const vm = { appView: "battle", battleView: { self: { kami: registered }, opp: { kami: plain } }, kamiMotionEvents: { self: null, opp: null },
    kamiMotionAvailable: kami => kami === registered, $set(obj, key, value) { obj[key] = value; } };
  play.call(vm, "opp", "damage");
  assert.equal(vm.kamiMotionEvents.opp, null, "unregistered Kami stays still");
  play.call(vm, "self", "damage");
  assert.equal(vm.kamiMotionEvents.self.type, "damage");
  const first = vm.kamiMotionEvents.self.id;
  play.call(vm, "self", "damage");
  assert.notEqual(vm.kamiMotionEvents.self.id, first, "the same reaction can repeat");
  vm.appView = "top";
  play.call(vm, "self", "heal");
  assert.equal(vm.kamiMotionEvents.self.type, "damage", "ignored outside battle");
  play.call(vm, "self", null);
  assert.equal(vm.kamiMotionEvents.self.type, "damage");
});
