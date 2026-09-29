"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("each genesis skill selects its own optimized art while skill 1 keeps the eye cut-in", () => {
  const {DIVINE_SKILL_CUTINS,DIVINE_SKILL_AWAKENINGS,divineSkillTheme,divineSkillAssetUrls}=require('../divine_effects.js');
  assert.equal(Object.keys(DIVINE_SKILL_CUTINS).length,10);
  assert.equal(new Set(Object.values(DIVINE_SKILL_CUTINS)).size,10);
  for(let no=1;no<=10;no++){
    const theme=divineSkillTheme({no},2),file=theme.cutin;
    assert.equal(file,DIVINE_SKILL_CUTINS[no]);assert.equal(theme.kamiNo,String(no));
    assert.ok(divineSkillAssetUrls({no}).includes(file));
    assert.ok(fs.statSync(path.join(root,file)).size<=300000,file);
    const data=fs.readFileSync(path.join(root,file)),format=data.toString('ascii',12,16);
    const size=format==='VP8X'?[data.readUIntLE(24,3)+1,data.readUIntLE(27,3)+1]:[data.readUInt16LE(26)&0x3fff,data.readUInt16LE(28)&0x3fff];
    assert.deepEqual(size,[1600,900],`${file}: all ten full-screen cut-ins share the landscape dimensions`);
    assert.equal(divineSkillTheme({no},1).cutin,null);
    assert.equal(divineSkillTheme({no},1).awakening,null);
    assert.equal(theme.awakening,no===1?DIVINE_SKILL_AWAKENINGS['1']:null);
    assert.equal(theme.awakeningFrames.length,no===1?2:0);
    for(const frame of [theme.awakening,...theme.awakeningFrames].filter(Boolean)) {
      const data=fs.readFileSync(path.join(root,frame)),format=data.toString('ascii',12,16);
      const size=format==='VP8X'?[data.readUIntLE(24,3)+1,data.readUIntLE(27,3)+1]:[data.readUInt16LE(26)&0x3fff,data.readUInt16LE(28)&0x3fff];
      assert.deepEqual(size,[1600,900]);assert.ok(data.length<=300000);
      assert.ok(divineSkillAssetUrls({no}).includes(frame));
      assert.ok(frame.endsWith('-'+crypto.createHash('sha256').update(data).digest('hex').slice(0,12)+'.webp'));
    }
  }
});

function localReferences(pattern) {
  return Array.from(html.matchAll(pattern), match => match[1])
    .filter(value => value && !/^(?:https?:|data:|#)/i.test(value))
    .map(value => value.split(/[?#]/)[0]);
}

function appMethod(name, params = "") {
  const source = html.match(new RegExp("    " + name + "\\([^\\n]*\\) \\{([\\s\\S]*?)\\r?\\n    \\},"));
  assert.ok(source, name);
  return Function(params, source[1]);
}

test("startup image preloads stay below 2 MB and never request divine art", () => {
  const refs = localReferences(/<link[^>]+rel="preload"[^>]+as="image"[^>]+href="([^"]+)"/g);
  assert.ok(refs.includes("ui_decorations/title-key-visual.webp"));
  assert.ok(refs.every(ref => !ref.startsWith("divine_assets/")));
  const bytes = refs.reduce((total, ref) => total + fs.statSync(path.join(root, ref)).size, 0);
  assert.ok(bytes < 2 * 1024 * 1024, `startup preload budget exceeded: ${bytes}`);
  const deferred = [], calls = [];
  const vm = { allCards: [], allKamiCards: [], _deferStartupWork: fn => deferred.push(fn) };
  for (const name of ["loadKamiIllustrations", "loadCardBack", "gsLoadGlobalCardStats", "_sfxPreloadAll", "_bgmPreloadAll", "_preloadKamiCutinImages"]) vm[name] = () => calls.push(name);
  appMethod("_scheduleStartupAssetWork").call(vm);
  deferred.forEach(fn => fn());
  assert.ok(!calls.includes("_bgmPreloadAll"));
  assert.ok(!calls.includes("_preloadKamiCutinImages"));
});

test("battle preloads only its two Kami with bounded concurrency and cancels after leaving", () => {
  const { divineSkillAssetUrls } = require("../divine_effects.js");
  const images = [];
  class ImageStub { constructor() { images.push(this); } }
  const vm = { appView: "battle", battleView: { self: { kami: { no: 2 } }, opp: { kami: { no: 4 } } } };
  const load = appMethod("_preloadBattleVisuals", "Image, divineSkillAssetUrls");
  load.call(vm, ImageStub, divineSkillAssetUrls);
  assert.equal(images.length, 2);
  for (let i = 0; i < images.length; i++) images[i].onload();
  const urls = images.map(image => image.src);
  assert.deepEqual(new Set(urls), new Set(["kami_cutin/2.webp", "kami_cutin_eyes/2.png", "kami_cutin/4.webp", "kami_cutin_eyes/4.png", ...divineSkillAssetUrls({ no: 2 }), ...divineSkillAssetUrls({ no: 4 })]));
  assert.ok(images.every(image => image.decoding === "async"));
  images.length = 0;
  load.call(vm, ImageStub, divineSkillAssetUrls);
  vm.appView = "top";
  images[0].onload();
  assert.equal(images.length, 2, "pending callbacks cannot start more requests after exit");
  load.call(vm, ImageStub, divineSkillAssetUrls);
  assert.equal(images.length, 2, "opening TOP never warms battle textures");
});

test("decoded BGM cache retains at most three tracks and protects current playback", () => {
  const cache = { old1: {}, current: {}, old2: {}, fading: {}, next: {} };
  const vm = { _bgmBufferCache: cache, bgmCurrentKey: "next", _bgmPlayingKey: "fading" };
  appMethod("_bgmTrimBufferCache").call(vm);
  assert.deepEqual(Object.keys(cache), ["old2", "fading", "next"]);
  appMethod("_bgmTrimBufferCache").call(vm);
  assert.equal(Object.keys(cache).length, 3);
});

test("optimized visual URLs are content-addressed and every Kami texture exists", () => {
  const assets = JSON.parse(fs.readFileSync(path.join(root, "optimized_assets.json"), "utf8"));
  for (const asset of Object.values(assets)) {
    const bytes = fs.readFileSync(path.join(root, asset.file));
    const hash = crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 12);
    assert.ok(asset.file.endsWith(`-${hash}.webp`), asset.file);
    assert.equal(bytes.length, asset.bytes);
    assert.ok(asset.bytes < asset.sourceBytes, asset.file);
  }
  const { divineSkillAssetUrls, divineSpriteStyle } = require("../divine_effects.js");
  for (let no = 1; no <= 10; no++) for (const url of divineSkillAssetUrls({ no })) {
    assert.ok(fs.existsSync(path.join(root, url)), url);
    assert.match(url, /-[a-f0-9]{12}\.webp$/);
  }
  for (const name of ["kusanagi", "spiritSword", "futsunomitama"]) {
    const url = divineSpriteStyle(name).backgroundImage.match(/url\('([^']+)'\)/)[1];
    assert.ok(fs.existsSync(path.join(root, url)), url);
  }
  for (const file of ["index.html", "divine_effects.css", "divine_effects.js"]) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    for (const match of source.matchAll(/(?:divine_assets|ui_cinematics|kami_cutin)\/[\w-]+-[a-f0-9]{12}\.webp/g)) assert.ok(fs.existsSync(path.join(root, match[0])), match[0]);
  }
});

test("new image imports enforce budgets and standalone Kami props avoid unused atlases", () => {
  const assets = JSON.parse(fs.readFileSync(path.join(root, 'optimized_assets.json'), 'utf8'));
  const limits = {cutin:300000, sprite:120000, atlas:160000, scene:300000};
  const imported = Object.values(assets).filter(asset => asset.profile);
  assert.ok(imported.length >= 16);
  for (const asset of imported) {
    assert.equal(asset.maxBytes, limits[asset.profile]);
    assert.ok(asset.bytes <= limits[asset.profile], asset.file);
    if (asset.profile === 'sprite') assert.ok(asset.width <= 720 && asset.height <= 720);
    assert.equal(asset.width % asset.grid[0], 0, asset.file);
    assert.equal(asset.height % asset.grid[1], 0, asset.file);
  }
  const {divineSkillAssetUrls, divineSpriteStyle} = require('../divine_effects.js');
  const urls = divineSkillAssetUrls({no:6});
  assert.ok(!urls.some(url => url.includes('relic-atlas')));
  for (const name of ['fan', 'silk']) {
    const url = divineSpriteStyle(name).backgroundImage.match(/url\('([^']+)'\)/)[1];
    assert.ok(urls.includes(url));
    assert.ok(fs.statSync(path.join(root,url)).size <= 120000);
  }
  const bytes = urls.reduce((sum,url) => sum + fs.statSync(path.join(root,url)).size, 0);
  assert.ok(bytes <= 700000, `Uzume's battle textures exceed their budget: ${bytes}`);
  const amaterasuUrls = divineSkillAssetUrls({no:8});
  const mirrorUrl = divineSpriteStyle('mirror').backgroundImage.match(/url\('([^']+)'\)/)[1];
  assert.ok(amaterasuUrls.includes(mirrorUrl), 'the new mirror is ready before the animation');
  assert.ok(!amaterasuUrls.some(url => url.includes('relic-atlas')));
  const mirror = fs.readFileSync(path.join(root, mirrorUrl));
  assert.ok(mirror.length <= 120000);
  assert.equal(mirror.toString('ascii', 12, 16), 'VP8X');
  assert.ok(mirror[20] & 0x10, 'the isolated golden mirror keeps its alpha channel');
  assert.ok(amaterasuUrls.reduce((sum,url) => sum + fs.statSync(path.join(root,url)).size, 0) <= 420000);
});

test("every static script and preload reference exists", () => {
  const refs = [
    ...localReferences(/<script[^>]+src=["']([^"']+)["']/gi),
    ...localReferences(/<link[^>]+href=["']([^"']+)["']/gi),
    "effect_spec.json",
    "card_back.png",
    "coin_front.png",
    "coin_back.png",
    "ui_decorations/higanbana-left.png",
    "ui_decorations/higanbana-right.png",
    "ui_cinematics/kami-summoning-shrine-d842e6e43a24.webp",
    "ui_cinematics/bloom-lotus-closed-3379d5c7ca0c.webp",
    "ui_cinematics/bloom-lotus-open-0335f0a29407.webp",
    "ui_cinematics/dies-irae-ritual-706184ae25c0.webp",
    "battle_fields/cosmic-pick.webp",
  ];
  assert.ok(refs.length > 10);
  for (const ref of refs) assert.equal(fs.existsSync(path.join(root, ref)), true, `missing asset: ${ref}`);
});

test("battle fields load raster art and preserve tutorial, Orochi and online selection", () => {
  const themesSource = html.match(/const BATTLE_FIELD_THEMES = Object\.freeze\((\[[\s\S]*?\])\);/);
  assert.ok(themesSource);
  const themes = Function(`return ${themesSource[1]}`)();
  assert.equal(themes.length, 6);
  for (const theme of themes) {
    assert.match(theme.file, /\.webp$/);
    assert.ok(fs.existsSync(path.join(root, theme.file)), `missing field: ${theme.file}`);
  }
  const source = html.match(/_battlePickFieldTheme\(config, self, opp\) \{([\s\S]*?)\r?\n    \},/);
  assert.ok(source);
  const choose = Function('BATTLE_FIELD_THEMES', 'config', 'self', 'opp', source[1]).bind({
    _battleIsOrochiCard: kami => kami && kami.no === '10',
  }, themes);
  for (const theme of themes) {
    assert.equal(choose({ source: 'tutorial', fieldTheme: theme.key }), theme.key);
  }
  assert.equal(choose({ source: 'tutorial', fieldTheme: 'ninja' }, { kami: { no: '10' } }), 'dragon');
  assert.equal(choose({}, null, { kami: { no: '10' } }), 'dragon');
  const online = { syncGame: true, code: 'ROOM123', table: 1, round: 2 };
  assert.equal(choose(online), choose(online));
  for (let i = 0; i < 20; i++) {
    const selected = choose({});
    assert.ok(themes.some(t => t.key === selected));
  }
});

test("shared battle serialization cannot include private hand or deck arrays", () => {
  const body = html.match(/_battleSerializeSide\(side\) \{([\s\S]*?)\r?\n    \},\r?\n    \/\/ 受信サイドを適用/);
  assert.ok(body, "battle serializer was not found");
  assert.match(body[1], /k === 'hand' \|\| k === 'deck'/);
  const hiddenBlock = body[1].match(/if \(k === 'hand' \|\| k === 'deck'\) \{([\s\S]*?)\r?\n        \}/);
  assert.ok(hiddenBlock, "private-zone branch was not found");
  assert.doesNotMatch(hiddenBlock[1], /clone\[k\]\s*=/);
  assert.match(body[1], /clone\.handCount/);
  assert.match(body[1], /clone\.deckCount/);
});
