"use strict";
/* 制作ボード（メンバー共有ページ）に載せるデータをまとめる。
   node tools/board/build.js → tools/board/dist/ に、カード情報・カミ情報・ボイス一覧・画像のまとめ・音声を書き出す。
   共有ページ本体は tools/board/board.html。公開は Claude が Artifact として行う（dist/ の中身を添付ファイルとして載せる）。
   カード・カミの文は、ゲーム本体と同じスプレッドシートから読む（index.html の定数を使う。キーは表示しない）。
   画像は320px版を20枚ずつ1枚にまとめる（共有ページは載せられるファイル数に上限があるため）。ffmpeg が必要。 */
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..", "..");
const dist = path.join(__dirname, "dist");
const clean = s => String(s || "").replace(/[​-‍﻿­‎‏]/g, "");
const pad3 = n => String(parseInt(n, 10)).padStart(3, "0");
const COLS = 5, ROWS = 4, PER = COLS * ROWS, W = 320, H = 447;

function sheetConstants() {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const pick = name => { const m = html.match(new RegExp("const " + name + ' = "([^"]+)"')); if (!m) throw new Error(name + " が index.html に見つかりません"); return m[1]; };
  return { key: pick("API_KEY"), id: pick("SHEET_ID"), cards: pick("SHEET_RANGE"), kami: pick("KAMI_SHEET_RANGE") };
}
async function sheet(c, range) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${c.id}/values/${encodeURIComponent(range)}?key=${c.key}`);
  if (!res.ok) throw new Error("スプレッドシートを読めませんでした（" + res.status + "）");
  return (await res.json()).values || [];
}
function ffmpeg(args) {
  const run = spawnSync("ffmpeg", ["-v", "error", "-y", ...args], { encoding: "utf8", windowsHide: true });
  if (run.error || run.status !== 0) throw new Error("ffmpeg に失敗しました：" + String(run.stderr || run.error).slice(0, 300));
}
/* 同じ大きさの画像を COLS×ROWS で1枚にまとめる。足りないマスは黒 */
function atlas(files, out) {
  const args = [];
  for (const f of files) args.push("-i", f);
  const n = files.length;
  const scaled = files.map((_, i) => `[${i}:v]scale=${W}:${H},setsar=1[s${i}]`).join(";");
  const layout = files.map((_, i) => `${(i % COLS) * W}_${Math.floor(i / COLS) * H}`).join("|");
  const stack = n === 1 ? `[s0]pad=${COLS * W}:${ROWS * H}:0:0:black[o]`
    : `${files.map((_, i) => `[s${i}]`).join("")}xstack=inputs=${n}:layout=${layout}:fill=black,pad=${COLS * W}:${ROWS * H}:0:0:black[o]`;
  ffmpeg([...args, "-filter_complex", scaled + ";" + stack, "-map", "[o]", "-frames:v", "1", "-c:v", "libwebp", "-quality", "80", out]);
}

(async () => {
  fs.rmSync(dist, { recursive: true, force: true });
  for (const d of ["data", "img", "audio"]) fs.mkdirSync(path.join(dist, d), { recursive: true });
  const c = sheetConstants();

  // ---- カード ----
  const cards = [];
  for (const r of await sheet(c, c.cards)) {
    if (!r || r.length < 3 || !r[0] || !r[2]) continue;
    const category = r[6] || "", subType = r[16] || "", color = r[7] || "";
    cards.push({ no: String(r[0]), nickname: clean(r[1]), name: clean(r[2]), cost: Number(r[4]) || 0, category, color, type: r[8] || "",
      round: r[5] || "", ret: r[9] || "", attack: r[10] || "", power: r[11] || "", text: clean(r[12]), flavor: clean(r[13]),
      token: category === "トークン" || /^銀/.test(subType) || color === "無" });
  }
  cards.sort((a, b) => parseInt(a.no, 10) - parseInt(b.no, 10));
  // 同じカードの別版（名前・能力値・効果が同じで、フレーバーだけ違う）をまとめる。same に同じ組の番号を入れる
  const sameKey = c => [c.nickname, c.name, c.category, c.color, c.type, c.cost, c.power, c.attack, c.round, c.ret, c.text].join("|");
  const sameGroups = {};
  for (const card of cards) (sameGroups[sameKey(card)] = sameGroups[sameKey(card)] || []).push(String(parseInt(card.no, 10)));
  for (const card of cards) { const g = sameGroups[sameKey(card)]; if (g.length > 1) card.same = g; }
  const withImage = cards.filter(card => fs.existsSync(path.join(root, "card_images", "320", pad3(card.no) + ".webp")));
  withImage.forEach((card, i) => { card.sheet = Math.floor(i / PER); card.cell = i % PER; });
  for (let s = 0; s * PER < withImage.length; s++) {
    atlas(withImage.slice(s * PER, s * PER + PER).map(card => path.join(root, "card_images", "320", pad3(card.no) + ".webp")), path.join(dist, "img", `cards-${s}.webp`));
  }

  // ---- カミ ----
  const illust = JSON.parse(fs.readFileSync(path.join(root, "kami_illustrations", "manifest.json"), "utf8"));
  const kami = [];
  for (const r of await sheet(c, c.kami)) {
    if (!r || !r[0] || !r[2]) continue;
    const no = String(parseInt(r[0], 10));
    const k = { no, nickname: clean(r[1]), name: clean(r[2]), trigger: clean(r[4]), skill1name: r[5] || "", skill1cost: r[6] || "", skill1effect: clean(r[7]),
      skill2name: r[8] || "", skill2cost: r[9] || "", skill2effect: clean(r[10]) };
    const cardImg = path.join(root, "kami_card_images", "320", pad3(no) + ".webp");
    if (fs.existsSync(cardImg)) { fs.copyFileSync(cardImg, path.join(dist, "img", `kami-card-${no}.webp`)); k.card = `img/kami-card-${no}.webp`; }
    const art = illust[no] && path.join(root, "kami_illustrations", illust[no]);
    if (art && fs.existsSync(art)) { fs.copyFileSync(art, path.join(dist, "img", `kami-art-${no}.webp`)); k.art = `img/kami-art-${no}.webp`; }
    kami.push(k);
  }

  // ---- ボイス ----
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "voices", "cards", "manifest.json"), "utf8"));
  const audio = new Set();
  const clip = x => { const name = path.basename(x.src); audio.add(name); return { name, text: x.text }; };
  const voices = { cards: {}, pairs: [] };
  for (const [no, events] of Object.entries(manifest.cards)) { voices.cards[no] = {}; for (const [ev, clips] of Object.entries(events)) voices.cards[no][ev] = clips.map(clip); }
  for (const p of manifest.pairs) voices.pairs.push({ id: p.id, kind: p.kind, who: p.who, target: p.target, clips: p.clips.map(clip) });
  // 音声は約1MBごとに1個のファイルへ束ねる（共有ページのファイル数を抑える）。ページ側は位置（start〜end）で切り出して再生する
  const where = {}; let pack = 0, buf = [], size = 0;
  const flush = () => { if (buf.length) { fs.writeFileSync(path.join(dist, "audio", `pack-${pack}.mp3`), Buffer.concat(buf)); pack++; buf = []; size = 0; } };
  for (const name of [...audio].sort()) {
    const data = fs.readFileSync(path.join(root, "voices", "cards", name));
    where[name] = { src: `audio/pack-${pack}.mp3`, start: size, end: size + data.length };
    buf.push(data); size += data.length;
    if (size > 1000000) flush();
  }
  flush();
  const place = list => { for (const x of list) { Object.assign(x, where[x.name]); delete x.name; } };
  for (const events of Object.values(voices.cards)) for (const clips of Object.values(events)) place(clips);
  for (const p of voices.pairs) place(p.clips);

  // ---- カミの対戦中のモーション（Codex が作成中）----
  // 確認ページ kami_motion_preview.html と、その動きの仕組み・画像をそのまま写して motion/ に置く（Codex のファイルは変えない）。
  // 共有ページの中から motion/index.html#k番号 で開く。日本語のファイル名は使えないので、カミの絵は番号の名前に写す
  const motionDir = path.join(dist, "motion");
  if (fs.existsSync(path.join(root, "kami_motion_preview.html")) && fs.existsSync(path.join(root, "kami_motion.js"))) {
    const copy = rel => { const from = path.join(root, rel), to = path.join(motionDir, rel); if (!fs.existsSync(from)) return false; fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); return true; };
    const js = fs.readFileSync(path.join(root, "kami_motion.js"), "utf8"), css = fs.readFileSync(path.join(root, "kami_motion.css"), "utf8");
    let html = fs.readFileSync(path.join(root, "kami_motion_preview.html"), "utf8");
    const refs = new Set();
    for (const text of [js, css, html]) for (const m of text.matchAll(/(?:kami_motion|battle_ui|ui_decorations|divine_assets)\/[A-Za-z0-9_.\-\/]+\.(?:webp|png|jpg)/g)) refs.add(m[0]);
    for (const rel of ["kami_motion.js", "kami_motion.css", "vendor/vue-2.6.14.min.js", ...refs]) copy(rel);
    for (const [no, name] of Object.entries(illust)) { const from = path.join(root, "kami_illustrations", name); if (fs.existsSync(from)) { fs.mkdirSync(path.join(motionDir, "kami_illustrations"), { recursive: true }); fs.copyFileSync(from, path.join(motionDir, "kami_illustrations", "k" + no + ".webp")); } }
    html = html.replace(/\?v=[A-Za-z0-9_\-]+/g, "")
      .replace("backgroundImage:'url(kami_illustrations/'+FILES[this.kamiNo]+'.webp)'", "backgroundImage:'url(kami_illustrations/k'+this.kamiNo+'.webp)'")
      .replace("kamiNo:'8'", "kamiNo:((location.hash.match(/k(\\d+)/)||[])[1]||'8')");
    fs.writeFileSync(path.join(motionDir, "index.html"), html);
  }

  const version = (fs.readFileSync(path.join(root, "version.js"), "utf8").match(/"(\d+\.\d+\.\d+)"/) || [])[1] || "";
  fs.writeFileSync(path.join(dist, "data", "cards.json"), JSON.stringify({ built: new Date().toISOString(), version, atlas: { cols: COLS, rows: ROWS }, cards }));
  fs.writeFileSync(path.join(dist, "data", "kami.json"), JSON.stringify({ kami }));
  // カード効果の一覧（tools/card-effects）が使うカードの一覧（効果文つき）
  fs.writeFileSync(path.join(root, "tools", "card-effects", "cards.json"), JSON.stringify({ built: new Date().toISOString(), cards: cards.map(({ sheet, cell, ...c }) => c) }) + "\n");
  // 場のカードの絵のページ（tools/field-card-crop）が本番で使うカードの一覧
  fs.writeFileSync(path.join(root, "tools", "field-card-crop", "cards.json"), JSON.stringify({ built: new Date().toISOString(), cards: cards.map(({ no, nickname, name, category, color, token, same }) => ({ no, nickname, name, category, color, token, same })) }) + "\n");
  fs.writeFileSync(path.join(dist, "data", "voices.json"), JSON.stringify(voices));

  // 演出確認ページの創世神技のカットインに出す技名・読み・台詞
  try { require(path.join(root, "tools", "divine-assets", "build-genesis-copy.js")).buildGenesisCopy(); } catch (e) { console.warn("創世神技の文字を書き出せませんでした：" + e.message); }
  const files = [];
  const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else files.push(path.relative(dist, p).split(path.sep).join("/")); } };
  walk(dist);
  fs.writeFileSync(path.join(__dirname, "dist-files.json"), JSON.stringify(files, null, 1));
  const bytes = files.reduce((n, f) => n + fs.statSync(path.join(dist, f)).size, 0);
  console.log(`カード${cards.length}枚（画像あり${withImage.length}枚）／カミ${kami.length}柱／音声${audio.size}本／ファイル${files.length}個・${(bytes / 1048576).toFixed(1)}MB（v${version}）`);
})().catch(e => { console.error(e.message); process.exitCode = 1; });
