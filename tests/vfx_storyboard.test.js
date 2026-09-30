"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../tools/vfx-storyboard/storyboard_core.js");

test("演出設計の見本は安全な画像と時間軸を持ち、共有用に書き出せる", () => {
  const project = C.validate(C.example());
  assert.equal(project.duration, 7000);
  assert.ok(project.objects.some(o => o.asset === "fan"));
  assert.ok(project.objects.some(o => o.asset === "silk1"));
  assert.ok(project.objects.some(o => o.type === "petals" && o.color === "red"));
  assert.match(C.instructions(project), /アメノウズメ/);
  assert.match(C.instructions(project), /扇/);
  for (const asset of Object.values(C.ASSETS)) assert.ok(fs.existsSync(path.resolve(__dirname, "..", asset.path)), asset.path);
});

test("同じオブジェクトの◆を時刻に沿って補間し、その時刻で動かしても他の◆を変えない", () => {
  const object = { easing: "linear", frames: [C.frame(0, 0, 100, 1, 0, 0), C.frame(2000, 200, 300, 2, 90, 1)] };
  assert.deepEqual(C.sample(object, 1000), C.frame(1000, 100, 200, 1.5, 45, .5));
  C.upsertFrame(object, 1000, { x: 150, opacity: .8 });
  assert.equal(object.frames.length, 3);
  assert.equal(object.frames[0].x, 0);
  assert.equal(object.frames[1].x, 150);
  assert.equal(object.frames[2].x, 200);
  object.easing = "hold";
  assert.equal(C.sample(object, 1500).x, 150);
  assert.equal(C.sample(object, 1000).x, 150);
  assert.equal(C.sample(object, 2000).x, 200);
});

test("読み込み時は未許可の外部画像と重複した時刻を拒否する", () => {
  const external = C.example();
  external.objects[0].asset = "https://example.com/tracker.png";
  assert.throws(() => C.validate(external), /画像/);
  const duplicate = C.example();
  duplicate.objects[0].frames[1].t = duplicate.objects[0].frames[0].t;
  assert.throws(() => C.validate(duplicate), /重複/);
});

test("編集ページの操作先と読み込むファイルがそろっている", () => {
  const directory = path.resolve(__dirname, "../tools/vfx-storyboard");
  const html = fs.readFileSync(path.join(directory, "index.html"), "utf8");
  const js = fs.readFileSync(path.join(directory, "storyboard.js"), "utf8");
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
  for (const m of js.matchAll(/\$\("([A-Za-z][A-Za-z0-9]+)"\)/g)) assert.ok(ids.has(m[1]), `Missing ${m[1]}`);
  assert.match(html, /storyboard_core\.js/);
  assert.match(html, /storyboard\.js/);
  assert.match(fs.readFileSync(path.join(__dirname, "../kami_cutin/preview.html"), "utf8"), /tools\/vfx-storyboard\//);
});
