"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const nodeVm = require("node:vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("Uzume's fan, legible petals and four fading silk poses move in a widening breeze", () => {
  const {DIVINE_UZUME_FAN_FRAMES,DIVINE_UZUME_HAGOROMO_POSES,divineUzumeSpiralPetalStyle,divineUzumeHagoromoPoseStyle,divineSkillAssetUrls}=require('../divine_effects.js');
  assert.equal(DIVINE_UZUME_FAN_FRAMES.length,1);
  for(const file of DIVINE_UZUME_FAN_FRAMES){
    assert.ok(divineSkillAssetUrls({no:6}).includes(file));
    assert.ok(fs.statSync(path.join(root,file)).size<=120000,file);
  }
  const red=divineUzumeSpiralPetalStyle(1),white=divineUzumeSpiralPetalStyle(2);
  assert.notEqual(red['--petal-cell-y'],white['--petal-cell-y']);
  assert.equal(new Set(Array.from({length:8},(_,n)=>{const p=divineUzumeSpiralPetalStyle(n+1);return p['--petal-cell-x']+','+p['--petal-cell-y']})).size,8);
  const petalUrl=red['--petal-image'].match(/url\('([^']+)'\)/)[1];
  assert.ok(divineSkillAssetUrls({no:6}).includes(petalUrl));
  assert.ok(fs.statSync(path.join(root,petalUrl)).size<=160000);
  assert.match(red['--petal-entry-y'],/-\d+vh/);
  assert.notEqual(red['--petal-orbit-0'],red['--petal-orbit-1']);
  assert.notEqual(red['--petal-delay'],white['--petal-delay']);
  assert.notEqual(red['--petal-height-shift'],white['--petal-height-shift']);
  assert.ok(Array.from({length:11},(_,step)=>red[`--petal-orbit-${step}`]).every(Boolean));
  assert.ok(parseFloat(red['--petal-radius-end'])>parseFloat(red['--petal-radius-start'])*3,'the petal vortex widens above its narrow base');
  assert.ok(parseFloat(red['--petal-size'])>=38);
  assert.ok(divineSkillAssetUrls({no:6}).includes(DIVINE_UZUME_HAGOROMO_POSES));
  assert.ok(fs.statSync(path.join(root,DIVINE_UZUME_HAGOROMO_POSES)).size<=160000);
  assert.equal(new Set(Array.from({length:4},(_,n)=>divineUzumeHagoromoPoseStyle(n+1).backgroundPosition)).size,4);
  const css=fs.readFileSync(path.join(root,'divine_effects.css'),'utf8');
  assert.match(css,/@keyframes fx-uzume-fan-sway/);
  assert.match(css,/@keyframes fx-uzume-fan-flight[\s\S]*?48%\s*\{[^}]*26vh/);
  assert.match(css,/@keyframes fx-uzume-petal-spiral[\s\S]*?100%\s*\{[^}]*-122vh/);
  assert.match(css,/@keyframes fx-uzume-petal-flutter/);
  assert.match(css,/@keyframes fx-uzume-hagoromo-pose/);
  assert.match(css,/\.uzume-soft-gust \{/);
  assert.doesNotMatch(css,/uzume-wind-threads/);
  assert.match(fs.readFileSync(path.join(root,'divine_effects.js'),'utf8'),/v-for="i in 56"[^>]*spiral-petal/);
});

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
    assert.equal(theme.awakeningFrames.length,no===1?3:0);
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
  const source = html.match(new RegExp("    (async )?" + name + "\\([^\\n]*\\) \\{([\\s\\S]*?)\\r?\\n    \\},"));
  assert.ok(source, name);
  // async のメソッドは await を含むため、async 関数として組み立てる
  const Ctor = source[1] ? (async () => {}).constructor : Function;
  return Ctor(params, source[2]);
}

test("startup image preloads stay below 2 MB and never request divine art", () => {
  const refs = localReferences(/<link[^>]+rel="preload"[^>]+as="image"[^>]+href="([^"]+)"/g);
  assert.ok(refs.includes("ui_decorations/title-key-visual.webp"));
  assert.ok(refs.every(ref => !ref.startsWith("divine_assets/")));
  const bytes = refs.reduce((total, ref) => total + fs.statSync(path.join(root, ref)).size, 0);
  assert.ok(bytes < 2 * 1024 * 1024, `startup preload budget exceeded: ${bytes}`);
  const deferred = [], calls = [];
  const vm = { allCards: [], allKamiCards: [], _deferStartupWork: fn => deferred.push(fn) };
  for (const name of ["loadKamiIllustrations", "loadCardBack", "gsLoadGlobalCardStats", "_sfxPreloadAll", "_bgmPreloadAll", "_preloadKamiCutinImages", "_idlePrefetchStartup"]) vm[name] = () => calls.push(name);
  appMethod("_scheduleStartupAssetWork").call(vm);
  deferred.forEach(fn => fn());
  assert.ok(!calls.includes("_bgmPreloadAll"));
  assert.ok(!calls.includes("_preloadKamiCutinImages"));
});

test("loading screens show nine lightweight Kami stickers and rule hints without Orochi", () => {
  const sceneBlock = html.match(/const scenes = Object\.freeze\(\[([\s\S]*?)\]\);/);
  assert.ok(sceneBlock, "loading scene list exists before Vue mounts");
  const entries = Array.from(sceneBlock[1].matchAll(/\{ name: '([^']+)', image: '([^']+)', hint: '([^']+)' \}/g));
  assert.equal(entries.length, 9);
  assert.equal(new Set(entries.map(([, name]) => name)).size, 9);
  assert.equal(new Set(entries.map(([, , image]) => image)).size, 9);
  for (const [, name, image, hint] of entries) {
    assert.notEqual(name, "ヤマタノオロチ");
    assert.ok(hint.length >= 15, `${name} has a useful hint`);
    assert.match(image, /^loading_chibi\/.+-[a-f0-9]{12}\.webp$/);
    assert.ok(fs.statSync(path.join(root, image)).size <= 120000, image);
  }
  assert.match(html, /<div id="app-loading"[\s\S]*?class="loading-kami-art"/);
  assert.match(html, /<div v-if="assetLoading"[\s\S]*?:src="assetLoading\.scene\.image"/);
  assert.match(html, /const state = \{ title, done: 0, total: list\.length, scene: window\.tsukuriyoPickLoadingScene\(\) \}/);
  const startup = html.match(/<div id="app-loading"[\s\S]*?<script>([\s\S]*?)<\/script>\s*<div id="app"/);
  assert.ok(startup, "startup loading script runs before Vue");
  const fields = { '.loading-kami-art': { style: {}, src: '' }, '.loading-kami-name': {}, '.loading-kami-hint': {} };
  const loading = { querySelector: selector => fields[selector] };
  const scope = { window: {}, document: { getElementById: () => loading } };
  nodeVm.runInNewContext(startup[1], scope);
  assert.ok(fields['.loading-kami-art'].src.startsWith('loading_chibi/'));
  assert.ok(fields['.loading-kami-hint'].textContent.startsWith('ヒント：'));
  let last = fields['.loading-kami-art'].src;
  for (let i = 0; i < 30; i++) {
    const next = scope.window.tsukuriyoPickLoadingScene();
    assert.notEqual(next.image, last, "successive screens avoid the same Kami");
    last = next.image;
  }
});

test("image loader serves screen images first and pauses background images in battle", async () => {
  const images = [];
  class ImageStub { constructor() { images.push(this); } }
  const timers = [];
  const env = { document: { hidden: false }, navigator: {}, window: { setTimeout: fn => { timers.push(fn); return timers.length; } } };
  const vm = { appView: "game" };
  vm._backgroundLoadAllowed = () => appMethod("_backgroundLoadAllowed", "document, navigator").call(vm, env.document, env.navigator);
  vm._assetImagePump = () => appMethod("_assetImagePump", "Image, window").call(vm, ImageStub, env.window);
  vm._assetImage = (url, bg) => appMethod("_assetImage", "url, background").call(vm, url, bg);
  const tick = () => new Promise(resolve => setImmediate(resolve));
  const finished = new Set();
  const finish = async image => { finished.add(image); image.onload(); await tick(); };
  const drain = async () => { let image; while ((image = images.find(i => !finished.has(i)))) await finish(image); };
  // 裏の画像は1本ずつ
  vm._assetImage("bg1.webp", true);
  vm._assetImage("bg2.webp", true);
  assert.deepEqual(images.map(i => i.src), ["bg1.webp"]);
  // 画面に必要な画像は裏の画像を待たずに4本まで並行して読む
  const shown = ["a.webp", "b.webp", "c.webp", "d.webp", "e.webp"].map(url => vm._assetImage(url));
  assert.deepEqual(images.map(i => i.src), ["bg1.webp", "a.webp", "b.webp", "c.webp"]);
  await finish(images[0]);
  assert.equal(images[4].src, "d.webp", "screen images go before the remaining background image");
  // 裏で待っていた画像が画面に必要になったら、裏の順番を待たずに読む
  const promoted = vm._assetImage("bg2.webp");
  await finish(images[1]);
  await finish(images[2]);
  assert.deepEqual(images.slice(5).map(i => i.src), ["e.webp", "bg2.webp"]);
  await drain();
  await Promise.all([...shown, promoted]);
  assert.ok(images.every(i => i.decoding === "async"));
  // 読み終えた画像は二度読まない
  const count = images.length;
  await vm._assetImage("a.webp");
  assert.equal(images.length, count);
  // 対戦中・遅い回線・裏のタブでは裏の画像を止める
  vm.appView = "battle";
  vm._assetImage("bg3.webp", true);
  assert.equal(images.length, count, "battle pauses background loading");
  assert.equal(timers.length, 1, "paused loader checks again later");
  vm.appView = "game";
  timers.shift()();
  assert.equal(images[images.length - 1].src, "bg3.webp");
  env.navigator.connection = { effectiveType: "3g" };
  assert.equal(vm._backgroundLoadAllowed(), false);
  env.navigator.connection = { saveData: true, effectiveType: "4g" };
  assert.equal(vm._backgroundLoadAllowed(), false);
  env.navigator.connection = { effectiveType: "4g" };
  env.document.hidden = true;
  assert.equal(vm._backgroundLoadAllowed(), false);
});

test("battle waits behind a loading screen before the coin flip", async () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /if \(this\.battleLoading\) \{ this\._battleOpeningAfterLoad = true; return; \}/);
  assert.match(html, /if \(config\.source !== 'tutorial'\) this\._battleRunLoadingScreen\(\);/);
  assert.match(html, /<div v-if="assetLoading" class="asset-loading-screen"/);
  const loaded = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const vm = {
    appView: "battle", bgmAuto: true, battleFieldTheme: { file: "battle_fields/ninja.webp" },
    battleSample: { self: { kami: { no: 2 }, hand: [{ no: 5 }] }, opp: { kami: { no: 4 }, hand: [{ no: 9 }] } },
    cardImageUrl: card => `card/${card.no}.webp`,
    _kamiVisualUrls: kami => (kami ? [`kami_cutin/${kami.no}.webp`] : []),
    _assetImage: url => { loaded.push(url); return gate; },
    _bgmWaitUntilPlaying: () => Promise.resolve(),
    _withLoadingScreen: (title, jobs) => Promise.all(jobs),
    _battleOpeningAfterLoad: false,
  };
  let opened = 0;
  vm._battleBeginOpeningSequence = () => { if (vm.battleLoading) { vm._battleOpeningAfterLoad = true; return; } opened++; };
  const running = appMethod("_battleRunLoadingScreen", "BGM_FILES").call(vm, {});
  assert.equal(vm.battleLoading, true);
  vm._battleBeginOpeningSequence();
  assert.equal(opened, 0, "coin flip waits for the assets");
  assert.deepEqual(new Set(loaded), new Set(["kami_cutin/2.webp", "card/2.webp", "kami_cutin/4.webp", "card/4.webp", "card/5.webp", "battle_fields/ninja.webp"]));
  assert.ok(!loaded.includes("card/9.webp"), "the opponent's hidden hand is not loaded");
  release();
  await running;
  assert.equal(vm.battleLoading, false);
  assert.equal(opened, 1);
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
  assert.ok(bytes <= 820000, `Uzume's battle textures exceed their budget: ${bytes}`);
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

test("pick guide card list sorts by Kami fit and lists poor fits separately", () => {
  const cards = [];
  for (let i = 1; i <= 40; i++) cards.push({ no: String(i), name: "c" + i, round: 1 + (i % 3), fit: 41 - i, base: 10 });
  cards.push({ no: "41", name: "bad", round: 1, fit: -18, base: 10 });
  cards.push({ no: "42", name: "c1", round: 1, fit: 99, base: 10 }); // 同名の再録は1枚にまとめる
  cards.push({ no: "43", name: "token", round: 1, fit: 99, base: 10, isToken: true });
  const vm = {
    pickCardListKami: "1", allCards: cards,
    gsCpuKamiAffinityTags: () => ["evolveSublim"],
    gsCpuCardTagScore: card => card.fit, gsCpuBaseScore: card => card.base, fullName: card => card.name,
  };
  const isEligible = card => !card.isToken;
  const tiers = appMethod("pickCardListTiers", "isEligible").call(vm, isEligible);
  assert.deepEqual(tiers.map(t => t.key), ["top", "good", "avoid"]);
  assert.equal(tiers[0].cards.length, 5);
  assert.equal(tiers[0].cards[0].no, "1");
  assert.equal(tiers[1].cards.length, 10);
  assert.equal(tiers[2].cards[0].no, "41", "negative fits come first in the avoid tier");
  assert.ok(!tiers.some(t => t.cards.some(c => c.no === "42" || c.no === "43")));
});

test("every chibi listed in the Kami encyclopedia exists", () => {
  const block = html.match(/const KAMI_DEX_CHIBIS = Object\.freeze\(\{([\s\S]*?)\r?\n\}\);/);
  assert.ok(block, "KAMI_DEX_CHIBIS");
  const files = [...block[1].matchAll(/file: '([^']+)'/g)].map(m => m[1]);
  assert.ok(files.length >= 10);
  for (const file of files) assert.ok(fs.existsSync(path.join(root, file)), `ちびキャラの画像がありません: ${file}`);
  for (let no = 1; no <= 10; no++) assert.ok(block[1].includes(`"${no}": [`), `カミ${no}のちびキャラ一覧`);
  const restBlock = html.match(/const KAMI_DEX_REST_CHIBIS = Object\.freeze\(\{([\s\S]*?)\r?\n\}\);/);
  assert.ok(restBlock, "ロード画面の差分も図鑑に掲載する");
  const restEntries = Array.from(restBlock[1].matchAll(/"(\d+)": \{ file: '([^']+)', label: '([^']+)' \}/g));
  assert.deepEqual(restEntries.map(([ , no]) => no), ["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
  const loadingBlock = html.match(/const scenes = Object\.freeze\(\[([\s\S]*?)\]\);/);
  const loadingFiles = Array.from(loadingBlock[1].matchAll(/image: '([^']+)'/g), match => match[1]);
  assert.deepEqual(restEntries.map(([, , file]) => file), loadingFiles, "図鑑には採用したロード画面の画像をそのまま掲載する");
  assert.match(html, /return rest \? \[\.\.\.base, rest\] : base;/);
});

test("the chibi viewer steps through chibis then emotes and wraps around", () => {
  const vm = { kamiDexGallery: [{ label: "通常" }, { label: "喜び" }, { label: "エモート（あいさつ）" }], kamiDexZoomIndex: 0, _sfxPlay() {} };
  const step = appMethod("kamiDexZoomStep", "delta");
  step.call(vm, 1); assert.equal(vm.kamiDexZoomIndex, 1);
  step.call(vm, 1); assert.equal(vm.kamiDexZoomIndex, 2, "emotes follow the chibis");
  step.call(vm, 1); assert.equal(vm.kamiDexZoomIndex, 0, "wraps to the first picture");
  step.call(vm, -1); assert.equal(vm.kamiDexZoomIndex, 2, "and backwards to the last");
  vm.kamiDexZoomIndex = -1; step.call(vm, 1); assert.equal(vm.kamiDexZoomIndex, -1, "closed viewer ignores the arrows");
});
