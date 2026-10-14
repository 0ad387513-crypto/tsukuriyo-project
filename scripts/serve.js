"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, spawn } = require("node:child_process");

// ===== カードボイスの生成を試聴室のボタンから実行する（PowerShell に貼らなくてよいように）=====
// 決まった操作（design / pick / lines）だけを、決まった形の引数で generate_card_voices_elevenlabs.js に渡す。同時に動かすのは1つだけ
let voiceJob = null;
let voiceJobSeq = 0;
// ElevenLabs のキー。サーバーを起動した環境に無ければ、Windows のユーザー環境変数から読む（ページやファイルには置かない）
function elevenLabsKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  if (process.platform !== "win32") return "";
  try { return execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "[Environment]::GetEnvironmentVariable('ELEVENLABS_API_KEY','User')"], { encoding: "utf8", timeout: 10000 }).trim(); }
  catch { return ""; }
}
const voicePitchCache = new Map();
function measurePitch(file) {
  const SR = 16000;
  const raw = execFileSync("ffmpeg", ["-v", "quiet", "-i", file, "-ac", "1", "-ar", String(SR), "-f", "s16le", "-"], { maxBuffer: 1 << 28, windowsHide: true });
  const x = new Float32Array(raw.length / 2);
  for (let i = 0; i < x.length; i++) x[i] = raw.readInt16LE(i * 2) / 32768;
  const frame = 800, hop = 800, minLag = Math.floor(SR / 600), maxLag = Math.floor(SR / 70);
  const rms = []; let maxRms = 0;
  for (let s = 0; s + frame < x.length; s += hop) { let e = 0; for (let i = 0; i < frame; i++) e += x[s + i] * x[s + i]; const r = Math.sqrt(e / frame); rms.push(r); if (r > maxRms) maxRms = r; }
  const out = [];
  for (let s = 0, k = 0; s + frame + maxLag < x.length; s += hop, k++) {
    if (rms[k] < maxRms * 0.15) continue;
    let e0 = 0; for (let i = 0; i < frame; i++) e0 += x[s + i] * x[s + i];
    let best = 0, bestLag = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let c = 0, e1 = 0;
      for (let i = 0; i < frame; i++) { c += x[s + i] * x[s + i + lag]; e1 += x[s + i + lag] * x[s + i + lag]; }
      const n = c / Math.sqrt(e0 * e1 + 1e-9);
      if (n > best) { best = n; bestLag = lag; }
    }
    if (best > 0.75) out.push(SR / bestLag);
  }
  out.sort((a, b) => a - b);
  return out.length ? Math.round(out[Math.floor(out.length / 2)]) : null;
}
function voiceRunArgs(step, castKeys) {
  const castOk = k => typeof k === "string" && castKeys.includes(k);
  const refOk = r => /^[np]\d{2,3}-[a-z]+(-\d+)?$/.test(r || "");
  if (step.command === "design" && castOk(step.cast)) {
    const a = ["design", "--cast", step.cast].concat(step.keep ? ["--keep"] : []);
    if (step.prefer === "high" || step.prefer === "low") a.push("--prefer", step.prefer, "--rounds", /^[1-4]$/.test(String(step.rounds)) ? String(step.rounds) : "3", "--top", /^[1-9]$/.test(String(step.top)) ? String(step.top) : "3");
    return a;
  }
  if (step.command === "pick" && castOk(step.cast) && /^\d{1,3}$/.test(String(step.choice))) return ["pick", "--cast", step.cast, "--choice", String(step.choice)];
  if (step.command === "cut" && refOk(step.ref)) return ["cut", "--ref", step.ref];
  if (step.command === "lines" && step.ref && refOk(step.ref) && step.takes) return /^[2-5]$/.test(String(step.takes)) ? ["lines", "--ref", step.ref, "--takes", String(step.takes)] : null;
  if (step.command === "lines" && step.word) {
    const readings = fs.existsSync(voiceReadingsFile) ? JSON.parse(fs.readFileSync(voiceReadingsFile, "utf8")) : {};
    return Object.prototype.hasOwnProperty.call(readings, step.word) ? ["lines", "--word", step.word, "--force"] : null;
  }
  if (step.command === "lines" && step.ref && refOk(step.ref)) return ["lines", "--ref", step.ref].concat(step.force ? ["--force"] : []);
  if (step.command === "lines" && !step.ref && castOk(step.cast)) return ["lines", "--cast", step.cast].concat(step.force ? ["--force"] : []);
  // カミのボイス（voices/voice_script.json）：1台詞ずつ、試し作り「studio」に今の声で作る（ゲームのボイスは「ゲームに反映」を押すまで変えない）
  if (step.command === "kami-lines" && kamiLineOk(step.kami, step.key)) return [KAMI_TOOL, "lines", "--kami", String(step.kami), "--key", step.key, "--trial", KAMI_STUDIO, "--current-voice", "--force"];
  return null;
}
// カミのボイスの台本と、試聴室で作り直した音声の置き場所
const KAMI_TOOL = "generate_voices_elevenlabs.js";
const KAMI_STUDIO = "studio";
const kamiScriptFile = () => path.join(root, "voices", "voice_script.json");
function kamiLineOk(kami, key) {
  if (!/^(10|[1-9])$/.test(String(kami || "")) || !/^[a-z0-9_]{1,40}$/.test(String(key || ""))) return false;
  try { const k = JSON.parse(fs.readFileSync(kamiScriptFile(), "utf8")).kami[String(kami)]; return !!(k && k.lines && k.lines[key]); } catch { return false; }
}
function runVoiceSteps(job, key) {
  const next = () => {
    if (!job.queue.length) { job.running = false; job.code = 0; job.finishedAt = new Date().toISOString(); return; }
    const queued = job.queue.shift();
    // カミのボイスのときだけ、カミ用のスクリプトで作る
    const tool = queued[0] === KAMI_TOOL ? KAMI_TOOL : "generate_card_voices_elevenlabs.js";
    const args = tool === KAMI_TOOL ? queued.slice(1) : queued;
    job.log += "\n> " + args.join(" ") + "\n";
    const child = spawn(process.execPath, [path.join(root, "scripts", tool), ...args], { cwd: root, env: Object.assign({}, process.env, { ELEVENLABS_API_KEY: key }), windowsHide: true });
    const add = d => { job.log = (job.log + d.toString("utf8")).slice(-20000); };
    child.stdout.on("data", add); child.stderr.on("data", add);
    child.on("error", e => { add("起動できませんでした：" + e.message + "\n"); job.running = false; job.code = 1; });
    child.on("close", code => {
      if (code) { job.running = false; job.code = code; job.finishedAt = new Date().toISOString(); add("\n（失敗しました。続きの処理は止めました）\n"); return; }
      next();
    });
  };
  next();
}
const root = path.resolve(__dirname, "..");
const types = { ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".css": "text/css; charset=utf-8", ".webp": "image/webp", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".mp3": "audio/mpeg", ".wav": "audio/wav" };

/* ===== カードジェネレーター（tools/card-editor）用の保存口 =====
   このサーバーは 127.0.0.1 でだけ待ち受けるので、保存できるのはこのPCからだけ。本番（Netlify）には存在しない。 */
const sendJson = (res, status, body) => { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(JSON.stringify(body)); };
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on("data", chunk => { size += chunk.length; if (size > limit) { reject(new Error("too large")); req.destroy(); } else chunks.push(chunk); });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
function localImageMaxNo(isKami) {
  try {
    const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
    const m = html.match(isKami ? /const LOCAL_KAMI_CARD_IMAGE_MAX_NO = (\d+);/ : /const LOCAL_CARD_IMAGE_MAX_NO = (\d+);/);
    return m ? Number(m[1]) : null;
  } catch { return null; }
}
// イラストの原本は「番号_カード名.webp」、切り抜き位置は「番号_カード名.json」（ドライブの元イラストと同じ命名）
const artDir = path.join(root, "tools", "card-editor", "art");
const artPattern = /^(\d{3})(?:_(.*))?\.(webp|json)$/;
function artFiles() {
  // 番号 → 拡張子を除いたファイル名（原本があるものだけ）
  const map = {};
  if (!fs.existsSync(artDir)) return map;
  for (const f of fs.readdirSync(artDir)) {
    const m = f.match(artPattern);
    if (m && m[3] === "webp") map[String(parseInt(m[1], 10))] = f.slice(0, -5);
  }
  return map;
}
function artBaseName(no, name) {
  const pad = String(no).padStart(3, "0");
  const safe = String(name || "").replace(/[​-‍﻿]/g, "").replace(/[\\/:*?"<>|]/g, "").trim();
  if (safe) return pad + "_" + safe;
  return artFiles()[String(no)] || pad; // 名前の指定がなければ今のファイル名を使う
}
function writeArtFile(no, base, ext, data) {
  fs.mkdirSync(artDir, { recursive: true });
  // 同じ番号の古いファイル（カード名が変わった場合など）を消してから書く
  for (const f of fs.readdirSync(artDir)) {
    const m = f.match(artPattern);
    if (m && parseInt(m[1], 10) === no && m[3] === ext && f !== base + "." + ext) fs.unlinkSync(path.join(artDir, f));
  }
  const file = path.join(artDir, base + "." + ext);
  fs.writeFileSync(file, data);
  if (ext === "webp") {
    // カード名が変わって原本の名前が変わったときは、切り抜き位置のファイル名も合わせる
    for (const f of fs.readdirSync(artDir)) {
      const m = f.match(artPattern);
      if (m && parseInt(m[1], 10) === no && m[3] === "json" && f !== base + ".json") fs.renameSync(path.join(artDir, f), path.join(artDir, base + ".json"));
    }
  }
  return file;
}
const voiceScriptFile = path.join(root, "tools", "voice-script", "card_voice_script.json");
const voiceCastFile = path.join(root, "tools", "voice-script", "card_voice_cast.json");
const voiceReadingsFile = path.join(root, "tools", "voice-script", "card_voice_readings.json");
const voiceDirectionFile = path.join(root, "tools", "voice-script", "card_voice_direction.json");
const VOICE_SCRIPT_FIELDS = ["summon", "attack", "death", "use", "reading", "note", "memo", "status"];
async function handleDev(req, res, url) {
  // 他のサイトから localhost へ送り込まれるのを防ぐため、同じ確認用サーバーのページからの要求だけ受け付ける
  const origin = req.headers.origin;
  if (origin && !/^http:\/\/(localhost|127\.0\.0\.1):8765$/.test(origin)) return sendJson(res, 403, { ok: false, message: "許可されていない送信元です" });
  if (url.pathname === "/__dev/ping") return sendJson(res, 200, { ok: true });
  // ===== 場のカードの切り取り調整（tools/field-card-crop）=====
  // field_card_art.js の FIELD_CARD_ART_CROPS を1枚ずつ書き換える。カードの一覧は制作ダッシュボード用に作ったデータ（tools/board/dist/data/cards.json）を使う
  if (url.pathname === "/__dev/field-art") {
    const artFile = path.join(root, "field_card_art.js");
    const read = () => {
      const text = fs.readFileSync(artFile, "utf8").replace(/\r\n/g, "\n");
      const start = text.indexOf("const FIELD_CARD_ART_CROPS = Object.freeze({\n"), end = text.indexOf("\n});", start);
      if (start < 0 || end < 0) throw new Error("field_card_art.js の形が想定と違います");
      const entries = {};
      for (const line of text.slice(start, end).split("\n").slice(1)) {
        const m = line.match(/^\s*"(\d+)":\s*(\{[^}]*\}),?(?:\s*\/\/\s*(.*))?$/);
        if (!m) continue;
        const body = Function("return " + m[2])();
        entries[m[1]] = Object.assign(body, m[3] ? { note: m[3].trim() } : {});
      }
      return { text, start, end, entries };
    };
    if (req.method === "GET") {
      try {
        const { entries } = read();
        const cardsFile = path.join(root, "tools", "board", "dist", "data", "cards.json");
        const cards = fs.existsSync(cardsFile) ? JSON.parse(fs.readFileSync(cardsFile, "utf8")).cards : [];
        return sendJson(res, 200, { ok: true, crops: entries, cards });
      } catch (e) { return sendJson(res, 500, { ok: false, message: e.message }); }
    }
    if (req.method === "POST") {
      let body;
      try { body = JSON.parse((await readBody(req, 4096)).toString("utf8")); } catch { return sendJson(res, 400, { ok: false, message: "形式が正しくありません" }); }
      const no = String(parseInt(body.no, 10));
      if (!(Number(no) >= 1 && Number(no) <= 999)) return sendJson(res, 400, { ok: false, message: "カード番号が正しくありません" });
      const pct = /^-?\d+(?:\.\d+)?% -?\d+(?:\.\d+)?%$/, size = /^auto \d+(?:\.\d+)?%$/;
      if (body.position !== undefined && !pct.test(body.position)) return sendJson(res, 400, { ok: false, message: "位置の形式が正しくありません" });
      if (body.size !== undefined && !size.test(body.size)) return sendJson(res, 400, { ok: false, message: "拡大率の形式が正しくありません" });
      const clean = v => String(v || "").replace(/[\r\n]/g, " ").replace(/\*\//g, "").slice(0, 60).trim();
      const { text, start, end, entries } = read();
      const entry = body.wide ? { wide: true } : Object.assign({}, body.position ? { position: body.position } : {}, body.size ? { size: body.size } : {});
      if (Object.keys(entry).length) entries[no] = Object.assign(entry, { note: clean(body.note) || clean(body.name) });
      else delete entries[no];
      // 番号順に並べ直して、一覧の部分だけを書き換える（ほかの部分はそのまま）
      const lines = Object.keys(entries).sort((a, b) => a - b).map(k => {
        const { note, ...v } = entries[k];
        const parts = Object.entries(v).map(([key, val]) => key + ": " + JSON.stringify(val));
        return "  " + JSON.stringify(k) + ": { " + parts.join(", ") + " }," + (note ? " // " + note : "");
      });
      const next = text.slice(0, start) + "const FIELD_CARD_ART_CROPS = Object.freeze({\n" + lines.join("\n") + text.slice(end);
      const tmp = artFile + ".tmp";
      fs.writeFileSync(tmp, crlfOf(artFile) ? next.replace(/\n/g, "\r\n") : next); fs.renameSync(tmp, artFile);
      console.log("[field-art] No." + no + " を" + (entries[no] ? "保存 " + JSON.stringify(entries[no]) : "既定に戻しました"));
      return sendJson(res, 200, { ok: true, crops: read().entries });
    }
  }
  // ===== 作業用ページのメモ・修正依頼（tools/hub/notes.json）=====
  // 各ページに差し込む tools/hub/notes-widget.js と、入口ページの一覧が使う。Claude と Codex は作業前にこのファイルを読む
  if (url.pathname === "/__dev/notes") {
    const readNotes = () => { try { const j = JSON.parse(fs.readFileSync(notesFile, "utf8")); return Array.isArray(j.notes) ? j.notes : []; } catch { return []; } };
    const writeNotes = notes => { const tmp = notesFile + ".tmp"; fs.writeFileSync(tmp, JSON.stringify({ notes }, null, 1) + "\n"); fs.renameSync(tmp, notesFile); };
    if (req.method === "GET") return sendJson(res, 200, { ok: true, notes: readNotes() });
    if (req.method === "DELETE") {
      const notes = readNotes(), id = url.searchParams.get("id");
      if (!notes.some(n => n.id === id)) return sendJson(res, 404, { ok: false, message: "そのメモは見つかりません" });
      const rest = notes.filter(n => n.id !== id); writeNotes(rest);
      return sendJson(res, 200, { ok: true, notes: rest });
    }
    if (req.method === "POST") {
      let body;
      try { body = JSON.parse((await readBody(req, 32 * 1024)).toString("utf8")); } catch { return sendJson(res, 400, { ok: false, message: "形式が正しくありません" }); }
      const str = (v, max) => typeof v === "string" ? v.trim().slice(0, max) : undefined;
      const notes = readNotes(), now = new Date().toISOString();
      const fields = { page: str(body.page, 200), pageTitle: str(body.pageTitle, 120), target: str(body.target, 80), memo: str(body.memo, 2000), prompt: str(body.prompt, 4000), result: str(body.result, 4000) };
      if (body.assignee !== undefined) { if (!["auto", "claude", "codex"].includes(body.assignee)) return sendJson(res, 400, { ok: false, message: "担当の値が正しくありません" }); fields.assignee = body.assignee; }
      if (body.status !== undefined) { if (!["memo", "todo", "doing", "review", "done"].includes(body.status)) return sendJson(res, 400, { ok: false, message: "状態の値が正しくありません" }); fields.status = body.status; }
      for (const k of Object.keys(fields)) if (fields[k] === undefined) delete fields[k];
      if (body.id) {
        const note = notes.find(n => n.id === body.id);
        if (!note) return sendJson(res, 404, { ok: false, message: "そのメモは見つかりません" });
        Object.assign(note, fields, { updatedAt: now });
        // 指示を足した・消したときは、状態もそれに合わせる（作業が始まったあとは変えない）
        if (fields.status === undefined && ["memo", "todo"].includes(note.status)) note.status = note.prompt ? "todo" : "memo";
      } else {
        if (!fields.page || (!fields.memo && !fields.prompt)) return sendJson(res, 400, { ok: false, message: "メモか修正の指示のどちらかを書いてください" });
        notes.push(Object.assign({ id: "m" + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36), target: "", memo: "", prompt: "", assignee: "auto", result: "" },
          fields, { status: fields.prompt ? "todo" : "memo", createdAt: now, updatedAt: now }));
      }
      writeNotes(notes);
      return sendJson(res, 200, { ok: true, notes });
    }
  }
  if (url.pathname === "/__dev/card-image" && req.method === "POST") {
    const kind = url.searchParams.get("kind");
    const no = parseInt(url.searchParams.get("no"), 10);
    const width = url.searchParams.get("w");
    if (!["card", "kami"].includes(kind) || !(no >= 1 && no <= 999) || !["320", "600"].includes(width)) return sendJson(res, 400, { ok: false, message: "No.・種類・サイズの指定が正しくありません" });
    let body;
    try { body = await readBody(req, 3 * 1024 * 1024); } catch { return sendJson(res, 413, { ok: false, message: "画像が大きすぎます" }); }
    if (body.length < 16 || body.toString("ascii", 0, 4) !== "RIFF" || body.toString("ascii", 8, 12) !== "WEBP") return sendJson(res, 400, { ok: false, message: "WebP画像ではありません" });
    const dir = path.join(root, kind === "kami" ? "kami_card_images" : "card_images", width);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, String(no).padStart(3, "0") + ".webp");
    fs.writeFileSync(file, body);
    const max = localImageMaxNo(kind === "kami");
    const warning = max != null && no > max
      ? `No.${no} は index.html の ${kind === "kami" ? "LOCAL_KAMI_CARD_IMAGE_MAX_NO" : "LOCAL_CARD_IMAGE_MAX_NO"}（${max}）より大きいので、ゲームはまだこの画像を使いません。値を ${no} 以上に上げてください。`
      : null;
    console.log(`[card-editor] ${path.relative(root, file)} を保存（${Math.round(body.length / 1024)}KB）`);
    // 本番でカード画像を長期キャッシュしているので、中身の識別子の一覧（asset_hashes.js）も合わせて更新する
    const relPath = path.relative(root, file).split(path.sep).join("/");
    try { require("./build_asset_hashes").updateAssetHashes(root, [relPath]); }
    catch (e) { console.warn("[card-editor] asset_hashes.js を更新できませんでした。node scripts/build_asset_hashes.js を実行してください:", e.message); }
    return sendJson(res, 200, { ok: true, path: relPath, bytes: body.length, warning });
  }
  // カードのイラストの原本を tools/card-editor/art/NNN.webp に保存する。作り直しのときに編集室が読み込む
  if (url.pathname === "/__dev/card-art" && req.method === "POST") {
    const no = parseInt(url.searchParams.get("no"), 10);
    if (!(no >= 1 && no <= 999)) return sendJson(res, 400, { ok: false, message: "No.の指定が正しくありません" });
    let body;
    try { body = await readBody(req, 15 * 1024 * 1024); } catch { return sendJson(res, 413, { ok: false, message: "イラストが大きすぎます" }); }
    if (body.length < 16 || body.toString("ascii", 0, 4) !== "RIFF" || body.toString("ascii", 8, 12) !== "WEBP") return sendJson(res, 400, { ok: false, message: "WebP画像ではありません" });
    const file = writeArtFile(no, artBaseName(no, url.searchParams.get("name")), "webp", body);
    console.log(`[card-editor] ${path.relative(root, file)} を保存（${Math.round(body.length / 1024)}KB）`);
    return sendJson(res, 200, { ok: true, path: path.relative(root, file).split(path.sep).join("/"), bytes: body.length });
  }
  // 原本のうちカードに載せる正方形の範囲（原本の画素で x, y, width, height）を art/NNN.json に保存する
  if (url.pathname === "/__dev/card-art-crop" && req.method === "POST") {
    const no = parseInt(url.searchParams.get("no"), 10);
    if (!(no >= 1 && no <= 999)) return sendJson(res, 400, { ok: false, message: "No.の指定が正しくありません" });
    let crop;
    try { crop = JSON.parse((await readBody(req, 4096)).toString("utf8")); } catch { return sendJson(res, 400, { ok: false, message: "切り抜き位置の形式が正しくありません" }); }
    const keys = ["x", "y", "width", "height"];
    if (!crop || !keys.every(k => Number.isFinite(crop[k])) || crop.width <= 0 || crop.height <= 0) return sendJson(res, 400, { ok: false, message: "切り抜き位置の値が正しくありません" });
    // 切り抜き位置は原本と同じファイル名にそろえる
    const file = writeArtFile(no, artFiles()[String(no)] || artBaseName(no, url.searchParams.get("name")), "json", JSON.stringify(Object.fromEntries(keys.map(k => [k, Math.round(crop[k])]))) + "\n");
    return sendJson(res, 200, { ok: true, path: path.relative(root, file).split(path.sep).join("/") });
  }
  if (url.pathname === "/__dev/card-art-list") {
    const files = artFiles();
    return sendJson(res, 200, { ok: true, nos: Object.keys(files), files });
  }
  // ===== カードボイス台本（tools/voice-script）=====
  // 台本は tools/voice-script/card_voice_script.json の1ファイル。読み込みは全体、保存は1件ずつ書き換える項目だけを送る
  if (url.pathname === "/__dev/voice-script" && req.method === "GET") {
    try { return sendJson(res, 200, { ok: true, script: JSON.parse(fs.readFileSync(voiceScriptFile, "utf8")) }); }
    catch (e) { return sendJson(res, 500, { ok: false, message: "台本ファイルを読めませんでした: " + e.message }); }
  }
  if (url.pathname === "/__dev/voice-script" && req.method === "POST") {
    const id = url.searchParams.get("id");
    if (!/^n\d{3}$/.test(id || "")) return sendJson(res, 400, { ok: false, message: "カードの指定が正しくありません" });
    let patch;
    try { patch = JSON.parse((await readBody(req, 16 * 1024)).toString("utf8")); } catch { return sendJson(res, 400, { ok: false, message: "保存する内容の形式が正しくありません" }); }
    const entries = Object.entries(patch || {}).filter(([k, v]) => VOICE_SCRIPT_FIELDS.includes(k) && typeof v === "string" && v.length <= 300);
    if (!entries.length) return sendJson(res, 400, { ok: false, message: "保存できる項目がありません" });
    if (patch.status !== undefined && !["draft", "ok", "fix"].includes(patch.status)) return sendJson(res, 400, { ok: false, message: "確認状態の値が正しくありません" });
    const script = JSON.parse(fs.readFileSync(voiceScriptFile, "utf8"));
    const line = script.lines && script.lines[id];
    if (!line) return sendJson(res, 404, { ok: false, message: "そのカードは台本にありません" });
    Object.assign(line, Object.fromEntries(entries), { updatedAt: new Date().toISOString() });
    // 書きかけのファイルが残らないよう、一時ファイルに書いてから置き換える
    const tmp = voiceScriptFile + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(script, null, 1) + "\n");
    fs.renameSync(tmp, voiceScriptFile);
    console.log(`[voice-script] ${id}（${line.card}）の ${entries.map(([k]) => k).join("・")} を保存`);
    return sendJson(res, 200, { ok: true, line });
  }
  if (url.pathname === "/__dev/voice-run" && req.method === "GET") {
    const job = voiceJob && { id: voiceJob.id, label: voiceJob.label, running: voiceJob.running, code: voiceJob.code, log: voiceJob.log, startedAt: voiceJob.startedAt, finishedAt: voiceJob.finishedAt };
    return sendJson(res, 200, { ok: true, job });
  }
  if (url.pathname === "/__dev/voice-run" && req.method === "POST") {
    // お金のかかる操作なので、このページ（localhost:8765）から送られたものだけ受け付ける
    if (!req.headers.origin) return sendJson(res, 403, { ok: false, message: "試聴室のページから実行してください" });
    if (voiceJob && voiceJob.running) return sendJson(res, 409, { ok: false, message: "前の処理がまだ動いています。終わってから押してください" });
    let body;
    try { body = JSON.parse((await readBody(req, 8192)).toString("utf8")); } catch { return sendJson(res, 400, { ok: false, message: "形式が正しくありません" }); }
    const castKeys = Object.keys((JSON.parse(fs.readFileSync(voiceCastFile, "utf8")).cast) || {});
    const steps = Array.isArray(body.steps) ? body.steps.slice(0, 4) : [];
    const queue = steps.map(st => voiceRunArgs(st || {}, castKeys));
    if (!queue.length || queue.some(q => !q)) return sendJson(res, 400, { ok: false, message: "実行できない操作です" });
    const key = elevenLabsKey();
    if (!key) return sendJson(res, 412, { ok: false, needKey: true, message: "ElevenLabs のキーがこのPCに保存されていません" });
    voiceJob = { id: ++voiceJobSeq, label: String(body.label || "").slice(0, 80), running: true, code: null, log: "", queue, startedAt: new Date().toISOString() };
    console.log(`[voice-run] ${voiceJob.label}：${queue.map(q => q.join(" ")).join(" → ")}`);
    runVoiceSteps(voiceJob, key);
    return sendJson(res, 200, { ok: true, id: voiceJob.id });
  }
  // ===== カミのボイスの台詞と演技（試聴室の「カミ」タブから）=====
  // voices/voice_script.json の text（表示の文）・el（演技タグ＋読み上げる文）・el_stability・el_direction（日本語の方針）を書き換える
  if (url.pathname === "/__dev/kami-line" && req.method === "POST") {
    if (!req.headers.origin) return sendJson(res, 403, { ok: false, message: "試聴室のページから操作してください" });
    const kami = url.searchParams.get("kami") || "", key = url.searchParams.get("key") || "";
    if (!kamiLineOk(kami, key)) return sendJson(res, 404, { ok: false, message: "その台詞は台本にありません" });
    let body;
    try { body = JSON.parse((await readBody(req, 8192)).toString("utf8")); } catch { return sendJson(res, 400, { ok: false, message: "保存する内容の形式が正しくありません" }); }
    const str = (v, max, name) => { const t = String(v || "").replace(/\s+/g, " ").trim(); if (t.length > max || /[<>{}]/.test(t)) throw new Error(name + "が長すぎるか、使えない文字があります"); return t; };
    let text, reading, direction, tags;
    try { text = str(body.text, 200, "台詞"); reading = str(body.reading, 300, "読み上げる文"); direction = str(body.direction, 200, "演技の方針"); tags = str(body.tags, 120, "演技タグ"); }
    catch (e) { return sendJson(res, 400, { ok: false, message: e.message }); }
    if (!text) return sendJson(res, 400, { ok: false, message: "台詞を入れてください" });
    const stability = body.stability === null || body.stability === undefined || body.stability === "" ? null : Number(body.stability);
    if (stability !== null && !(stability >= 0 && stability <= 1)) return sendJson(res, 400, { ok: false, message: "安定度は0〜1で指定してください" });
    // 方針（日本語）を英語の演技タグに直す（カードボイスと同じ対応表）。手で書いたタグを先に、合わせて最大3つ
    const map = JSON.parse(fs.readFileSync(path.join(root, "tools", "voice-script", "direction_tags.json"), "utf8")).map || [];
    const fromDirection = []; for (const [w, t] of map) if (direction.includes(w) && !fromDirection.includes(t)) fromDirection.push(t);
    const tagList = [...new Set([...(tags.match(/\[[^\]]+\]/g) || []).flatMap(t => t.slice(1, -1).split(",")).map(t => t.trim()), ...fromDirection])].filter(Boolean).slice(0, 3);
    const spoken = (reading || text).replace(/？/g, "?").replace(/！/g, "!");
    const raw = fs.readFileSync(kamiScriptFile(), "utf8"), crlfScript = raw.includes("\r\n");
    const script = JSON.parse(raw);
    const line = script.kami[kami].lines[key];
    const before = { text: line.text, el: line.el, el_stability: line.el_stability };
    line.text = text;
    line.el = (tagList.length ? "[" + tagList.join(", ") + "] " : "") + spoken;
    if (stability === null) delete line.el_stability; else line.el_stability = stability;
    if (direction) line.el_direction = direction; else delete line.el_direction;
    if (tags) line.el_tags = tags; else delete line.el_tags;
    // 1つ前の指定を残す（戻したいとき用）
    if (before.text !== line.text || before.el !== line.el || before.el_stability !== line.el_stability) line.previous = before;
    const out = JSON.stringify(script, null, 2) + "\n";
    const tmp = kamiScriptFile() + ".tmp";
    fs.writeFileSync(tmp, crlfScript ? out.replace(/\n/g, "\r\n") : out);
    fs.renameSync(tmp, kamiScriptFile());
    console.log(`[kami-line] ${kami} ${script.kami[kami].name} ${key}：${line.el}${line.el_stability !== undefined ? " 安定度" + line.el_stability : ""}`);
    return sendJson(res, 200, { ok: true, line });
  }
  // 試聴室で作り直したカミの台詞（voices/trials/studio/）を、ゲームのボイス（voices/{No}/）にする
  if (url.pathname === "/__dev/kami-adopt" && req.method === "POST") {
    if (!req.headers.origin) return sendJson(res, 403, { ok: false, message: "試聴室のページから操作してください" });
    let body;
    try { body = JSON.parse((await readBody(req, 4096)).toString("utf8")); } catch { return sendJson(res, 400, { ok: false, message: "形式が正しくありません" }); }
    const kami = String(body.kami || ""), key = String(body.key || "");
    if (!kamiLineOk(kami, key)) return sendJson(res, 404, { ok: false, message: "その台詞は台本にありません" });
    const src = path.join(root, "voices", "trials", KAMI_STUDIO, kami, key + ".mp3");
    if (!fs.existsSync(src)) return sendJson(res, 404, { ok: false, message: "試聴室で作った音声がありません" });
    const dest = path.join(root, "voices", kami, key + ".mp3");
    // 前のゲームの音声は試し作りの場所に残す（git にも本番にも入らない）
    if (fs.existsSync(dest)) { const old = path.join(root, "voices", "trials", KAMI_STUDIO, "_old"); fs.mkdirSync(old, { recursive: true }); fs.copyFileSync(dest, path.join(old, `${kami}-${key}-${Date.now()}.mp3`)); }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    try {
      execFileSync(process.execPath, [path.join(root, "scripts", KAMI_TOOL), "manifest"], { cwd: root, stdio: "pipe" });
      execFileSync(process.execPath, [path.join(root, "scripts", "build_asset_hashes.js")], { cwd: root, stdio: "pipe" });
    } catch (e) { return sendJson(res, 500, { ok: false, message: "音声は入れましたが、一覧を作り直せませんでした：" + String(e.stderr || e.message).slice(0, 200) }); }
    console.log(`[kami-adopt] ${kami} ${key} をゲームのボイスにした`);
    return sendJson(res, 200, { ok: true });
  }
  // ===== 声の高さを測る（試聴室の候補に「高さ ○○Hz」と出す）=====
  // ffmpeg で 16kHz モノラルにして、自己相関で基本周波数（F0）の中央値を求める。ffmpeg が無ければ測れない
  if (url.pathname === "/__dev/voice-pitch" && req.method === "GET") {
    const rel = url.searchParams.get("file") || "";
    const file = path.resolve(root, "voices", "cards", rel);
    if (!file.startsWith(path.join(root, "voices", "cards") + path.sep) || !/\.mp3$/.test(file) || !fs.existsSync(file)) return sendJson(res, 404, { ok: false, message: "音声がありません" });
    const stamp = file + ":" + fs.statSync(file).mtimeMs;
    if (!voicePitchCache.has(stamp)) {
      try { voicePitchCache.set(stamp, measurePitch(file)); }
      catch (e) { return sendJson(res, 200, { ok: false, message: "高さを測れませんでした（ffmpeg が必要です）" }); }
    }
    return sendJson(res, 200, { ok: true, hz: voicePitchCache.get(stamp) });
  }
  // ===== 言い方の候補（同じ台詞を何通りか作ったもの）：一覧と、選んだものを本番の音声にする =====
  if (url.pathname === "/__dev/voice-takes" && req.method === "GET") {
    const ref = url.searchParams.get("ref") || "";
    const dir = path.join(root, "voices", "cards", "takes");
    // ref なし：すべての台詞の候補番号を { 台詞ID: [1,2,3] } で返す
    if (!ref) {
      const all = {};
      if (fs.existsSync(dir)) for (const n of fs.readdirSync(dir)) { const m = /^([np]\d{2,3}-[a-z]+(?:-\d+)?)-(\d+)\.mp3$/.exec(n); if (m) (all[m[1]] = all[m[1]] || []).push(Number(m[2])); }
      for (const k of Object.keys(all)) all[k].sort((a, b) => a - b);
      return sendJson(res, 200, { ok: true, takes: all });
    }
    if (!/^[np]\d{2,3}-[a-z]+(-\d+)?$/.test(ref)) return sendJson(res, 400, { ok: false, message: "台詞IDが正しくありません" });
    const takes = fs.existsSync(dir) ? fs.readdirSync(dir).map(n => (new RegExp("^" + ref + "-(\\d+)\\.mp3$").exec(n) || [])[1]).filter(Boolean).map(Number).sort((a, b) => a - b) : [];
    return sendJson(res, 200, { ok: true, takes });
  }
  if (url.pathname === "/__dev/voice-take-adopt" && req.method === "POST") {
    if (!req.headers.origin) return sendJson(res, 403, { ok: false, message: "試聴室のページから操作してください" });
    let body;
    try { body = JSON.parse((await readBody(req, 4096)).toString("utf8")); } catch { return sendJson(res, 400, { ok: false, message: "形式が正しくありません" }); }
    const ref = String(body.ref || ""), take = Number(body.take);
    if (!/^[np]\d{2,3}-[a-z]+(-\d+)?$/.test(ref) || !(take >= 1 && take <= 5)) return sendJson(res, 400, { ok: false, message: "指定が正しくありません" });
    const cards = path.join(root, "voices", "cards");
    const src = path.join(cards, "takes", `${ref}-${take}.mp3`);
    if (!fs.existsSync(src)) return sendJson(res, 404, { ok: false, message: "その候補の音声がありません" });
    const dest = path.join(cards, `${ref}.mp3`);
    if (fs.existsSync(dest)) { fs.mkdirSync(path.join(cards, "_old"), { recursive: true }); fs.copyFileSync(dest, path.join(cards, "_old", `${ref}.before-take.mp3`)); }
    fs.copyFileSync(src, dest);
    try {
      const heardFile = path.join(cards, "heard.json");
      const heard = fs.existsSync(heardFile) ? JSON.parse(fs.readFileSync(heardFile, "utf8")) : {};
      if (heard[ref + "#" + take]) heard[ref] = heard[ref + "#" + take]; else delete heard[ref];
      fs.writeFileSync(heardFile, JSON.stringify(heard, null, 2) + "\n");
    } catch (e) {}
    // 音声を作ったときの台詞の記録も、選んだ候補のものにする
    try {
      const spokenFile = path.join(cards, "spoken.json");
      const spoken = fs.existsSync(spokenFile) ? JSON.parse(fs.readFileSync(spokenFile, "utf8")) : {};
      if (spoken[ref + "#" + take]) spoken[ref] = Object.assign({}, spoken[ref + "#" + take], { at: new Date().toISOString() }); else delete spoken[ref];
      fs.writeFileSync(spokenFile, JSON.stringify(spoken, null, 2) + "\n");
    } catch (e) {}
    console.log(`[voice-takes] ${ref} を言い方の候補${take}にした`);
    return sendJson(res, 200, { ok: true });
  }
  // ===== 読み方の辞書（{ 言葉: 読み方 }）。読み上げるときだけ置き換える =====
  if (url.pathname === "/__dev/voice-readings" && req.method === "GET") {
    return sendJson(res, 200, { ok: true, readings: fs.existsSync(voiceReadingsFile) ? JSON.parse(fs.readFileSync(voiceReadingsFile, "utf8")) : {} });
  }
  if (url.pathname === "/__dev/voice-readings" && req.method === "POST") {
    if (!req.headers.origin) return sendJson(res, 403, { ok: false, message: "試聴室のページから操作してください" });
    let body;
    try { body = JSON.parse((await readBody(req, 4096)).toString("utf8")); } catch { return sendJson(res, 400, { ok: false, message: "形式が正しくありません" }); }
    const word = String(body.word || "").trim(), reading = String(body.reading || "").trim();
    if (!word || word.length > 30 || reading.length > 60 || /[<>{}]/.test(word + reading)) return sendJson(res, 400, { ok: false, message: "言葉は30文字、読み方は60文字までで入れてください" });
    const all = fs.existsSync(voiceReadingsFile) ? JSON.parse(fs.readFileSync(voiceReadingsFile, "utf8")) : {};
    const ng = String(body.ng || "").split(/[、,\s]+/).map(x => x.trim()).filter(Boolean).slice(0, 5);
    if (ng.some(x => x.length > 20 || /[<>{}]/.test(x))) return sendJson(res, 400, { ok: false, message: "避けたい聞こえ方は、20文字までの言葉で入れてください" });
    if (reading) all[word] = ng.length ? { reading, ng } : reading; else delete all[word];
    const tmp = voiceReadingsFile + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(all, null, 1) + "\n");
    fs.renameSync(tmp, voiceReadingsFile);
    console.log(`[voice-readings] ${word} → ${reading || "（削除）"}`);
    return sendJson(res, 200, { ok: true, readings: all });
  }
  // ===== 演技の方針を複数の台詞にまとめて入れる（試聴室の「このキャラの全台詞に同じ方針を入れる」）=====
  // 方針（direction）だけを書き換え、台詞の言い換えや安定度などほかの指定は残す。空なら方針を消す
  if (url.pathname === "/__dev/voice-direction-batch" && req.method === "POST") {
    if (!req.headers.origin) return sendJson(res, 403, { ok: false, message: "試聴室のページから操作してください" });
    let body;
    try { body = JSON.parse((await readBody(req, 64 * 1024)).toString("utf8")); } catch { return sendJson(res, 400, { ok: false, message: "形式が正しくありません" }); }
    const refs = Array.isArray(body.refs) ? body.refs.filter(r => /^[np]\d{2,3}-[a-z]+(-\d+)?$/.test(r)).slice(0, 200) : [];
    const direction = String(body.direction || "").trim();
    if (!refs.length) return sendJson(res, 400, { ok: false, message: "台詞が選ばれていません" });
    if (direction.length > 200 || /[<>{}]/.test(direction)) return sendJson(res, 400, { ok: false, message: "演技の方針が長すぎるか、使えない文字があります" });
    const all = fs.existsSync(voiceDirectionFile) ? JSON.parse(fs.readFileSync(voiceDirectionFile, "utf8")) : {};
    const now = new Date().toISOString();
    for (const ref of refs) {
      const cur = Object.assign({}, all[ref] || {});
      if (direction) cur.direction = direction; else delete cur.direction;
      delete cur.updatedAt;
      if (Object.keys(cur).length) all[ref] = Object.assign(cur, { updatedAt: now }); else delete all[ref];
    }
    const tmp = voiceDirectionFile + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(all, null, 1) + "\n");
    fs.renameSync(tmp, voiceDirectionFile);
    console.log(`[voice-direction] ${refs.length}本に方針「${direction || "（消す）"}」`);
    return sendJson(res, 200, { ok: true, count: refs.length });
  }
  // ===== カードボイスの候補を消す（試聴室から。1つずつ・選んだもの・登録していないもの全部）=====
  // voices/cards/voices.json の candidates から外し、voices/cards/previews/ の音声ファイルを消す。登録中の候補は消さない
  if (url.pathname === "/__dev/voice-candidates-delete" && req.method === "POST") {
    if (!req.headers.origin) return sendJson(res, 403, { ok: false, message: "試聴室のページから操作してください" });
    if (voiceJob && voiceJob.running) return sendJson(res, 409, { ok: false, message: "声を作っている途中です。終わってから消してください" });
    let body;
    try { body = JSON.parse((await readBody(req, 8192)).toString("utf8")); } catch { return sendJson(res, 400, { ok: false, message: "形式が正しくありません" }); }
    const recordFile = path.join(root, "voices", "cards", "voices.json");
    const previewDir = path.join(root, "voices", "cards", "previews");
    const record = JSON.parse(fs.readFileSync(recordFile, "utf8"));
    const r = record[body.cast];
    if (!r) return sendJson(res, 404, { ok: false, message: "そのキャストの候補はありません" });
    const keep = r.voiceId && !r.released ? r.choice : null;
    const want = body.all ? (r.candidates || []).map(x => x.choice) : (Array.isArray(body.choices) ? body.choices.map(Number) : []);
    const del = (r.candidates || []).filter(x => want.includes(x.choice) && x.choice !== keep);
    if (!del.length) return sendJson(res, 400, { ok: false, message: "消せる候補がありません（登録中の候補は消せません）" });
    for (const x of del) {
      const file = path.resolve(previewDir, String(x.file || ""));
      if (path.dirname(file) === previewDir && fs.existsSync(file)) fs.unlinkSync(file);
    }
    r.candidates = (r.candidates || []).filter(x => !del.includes(x));
    // 候補を全部消しても記録は残す（試聴室の「作業中」タブから消えないように）
    const tmp = recordFile + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(record, null, 2) + "\n");
    fs.renameSync(tmp, recordFile);
    console.log(`[voice-candidates] ${body.cast} の候補 ${del.map(x => x.choice).join("・")} を削除`);
    return sendJson(res, 200, { ok: true, deleted: del.map(x => x.choice) });
  }
  // ===== カードボイスの声の説明（試聴室の「声のイメージを変える」から保存）=====
  // tools/voice-script/card_voice_cast.json の el_description を書き換え、前の説明は previous_descriptions に残す
  if (url.pathname === "/__dev/voice-description" && req.method === "POST") {
    const key = url.searchParams.get("cast") || "";
    let body;
    try { body = JSON.parse((await readBody(req, 16 * 1024)).toString("utf8")); } catch { return sendJson(res, 400, { ok: false, message: "保存する内容の形式が正しくありません" }); }
    const description = String(body.description || "").replace(/\s+/g, " ").trim();
    if (description.length < 20 || description.length > 1000) return sendJson(res, 400, { ok: false, message: "声の説明は20〜1000文字にしてください（今は" + description.length + "文字）" });
    if (/[<>{}]/.test(description)) return sendJson(res, 400, { ok: false, message: "声の説明に使えない文字があります" });
    const all = JSON.parse(fs.readFileSync(voiceCastFile, "utf8"));
    const c = all.cast && all.cast[key];
    if (!c || c.kami) return sendJson(res, 404, { ok: false, message: "そのキャストは見つかりません" });
    // 試聴室で選んだ性別・年代などの設定（説明を作り直すため）。小さなオブジェクトだけ受け付ける
    if (body.spec && typeof body.spec === "object" && JSON.stringify(body.spec).length < 2000) c.voice_spec = body.spec;
    // 候補を作るときの見本の文（空なら台詞から自動で作る）
    if (body.pitch_shift !== undefined) { const ps = Number(body.pitch_shift) || 0; if (!(ps >= -4 && ps <= 6)) return sendJson(res, 400, { ok: false, message: "高さの上げ下げは -4〜+6 で指定してください" }); if (ps) c.pitch_shift = ps; else delete c.pitch_shift; }
    if (typeof body.design_text === "string") { const dt = body.design_text.trim(); if (dt.length > 500 || /[<>{}]/.test(dt)) return sendJson(res, 400, { ok: false, message: "見本の文は500文字までにしてください" }); if (dt) c.design_text = dt; else delete c.design_text; }
    if (c.el_description === description) {
      const tmp0 = voiceCastFile + ".tmp";
      fs.writeFileSync(tmp0, JSON.stringify(all, null, 2) + "\n");
      fs.renameSync(tmp0, voiceCastFile);
      return sendJson(res, 200, { ok: true, cast: c, unchanged: true });
    }
    const prev = (c.previous_descriptions || []).filter(d => d !== description);
    if (c.el_description) prev.push(c.el_description);
    c.previous_descriptions = prev;
    c.el_description = description;
    const tmp = voiceCastFile + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(all, null, 2) + "\n");
    fs.renameSync(tmp, voiceCastFile);
    console.log(`[voice-description] ${key} の声の説明を更新（${description.length}文字）`);
    return sendJson(res, 200, { ok: true, cast: c });
  }
  // ===== カードボイスの演技指定（tools/voice-preview の試聴室から保存）=====
  // tools/voice-script/card_voice_direction.json に { 台詞ID: { text: "読み上げる文（台本と変えるときだけ）", direction: "演技の方針（日本語で自由に）", tags: "[confident]", stability: 0.4 } } で保存。
  // generate_card_voices_elevenlabs.js lines がこれを読んで、演技タグと安定度を付けて作る
  if (url.pathname === "/__dev/voice-direction" && req.method === "GET") {
    return sendJson(res, 200, { ok: true, directions: fs.existsSync(voiceDirectionFile) ? JSON.parse(fs.readFileSync(voiceDirectionFile, "utf8")) : {} });
  }
  if (url.pathname === "/__dev/voice-direction" && req.method === "POST") {
    const ref = url.searchParams.get("ref");
    if (!/^[np]\d{2,3}-[a-z]+(-\d+)?$/.test(ref || "")) return sendJson(res, 400, { ok: false, message: "台詞IDが正しくありません" });
    let body;
    try { body = JSON.parse((await readBody(req, 4096)).toString("utf8")); } catch { return sendJson(res, 400, { ok: false, message: "保存する内容の形式が正しくありません" }); }
    const tags = String(body.tags || "").trim();
    const text = String(body.text || "").trim();
    const script = String(body.script || "").trim();
    if (script.length > 300 || /[<>{}]/.test(script)) return sendJson(res, 400, { ok: false, message: "台詞が長すぎるか、使えない文字があります" });
    const direction = String(body.direction || "").trim();
    if (direction.length > 200 || /[<>{}]/.test(direction)) return sendJson(res, 400, { ok: false, message: "演技の方針が長すぎるか、使えない文字があります" });
    if (text.length > 300 || /[<>{}]/.test(text)) return sendJson(res, 400, { ok: false, message: "読み上げる文が長すぎるか、使えない文字があります" });
    const stability = body.stability === null || body.stability === undefined || body.stability === "" ? null : Number(body.stability);
    const tempo = body.tempo === null || body.tempo === undefined || body.tempo === "" ? null : Number(body.tempo);
    if (tempo !== null && !(tempo >= 0.7 && tempo <= 1.3)) return sendJson(res, 400, { ok: false, message: "速さは0.7〜1.3で指定してください" });
    if (tags.length > 120 || /[<>{}]/.test(tags)) return sendJson(res, 400, { ok: false, message: "演技タグが長すぎるか、使えない文字があります" });
    if (stability !== null && !(stability >= 0 && stability <= 1)) return sendJson(res, 400, { ok: false, message: "安定度は0〜1で指定してください" });
    const all = fs.existsSync(voiceDirectionFile) ? JSON.parse(fs.readFileSync(voiceDirectionFile, "utf8")) : {};
    const prevScript = (all[ref] || {}).script || "";
    // 台詞を変えたときは、手元の台本（card_voice_script.json・card_voice_pairs.json）も同じ台詞にする（台本と試聴室の台詞が食い違わないように）。
    // 読み方だけの違い（「漢字（よみ）」・見えない区切りなど）は台本に入れず、読み上げる文として試聴室の指定に残す。共有ページの台本は Claude が合わせる（shared_sync_pending.json）
    let scriptText = script, spokenText = text, scriptChanged = false;
    const m = /^([np]\d+)-([a-z]+)$/.exec(ref);
    if (m && (script || text)) {
      const [, id, field] = m, isPair = id[0] === "p";
      const file = path.join(root, "tools", "voice-script", isPair ? "card_voice_pairs.json" : "card_voice_script.json");
      const raw = fs.readFileSync(file, "utf8"), doc = JSON.parse(raw);
      const entry = (isPair ? doc.pairs : doc.lines)[id];
      if (entry && typeof entry[field] === "string") {
        const { displayText } = require("./build_card_voice_manifest.js");
        const next = script || (/^[（(].*[）)]$/.test(text) ? text : displayText(entry[field], text));
        if (next && next !== entry[field]) {
          entry[field] = next; entry.updatedAt = new Date().toISOString();
          const out = JSON.stringify(doc, null, (/\n( +)"/.exec(raw) || [, " "])[1].length) + "\n";
          const tmpScript = file + ".tmp";
          fs.writeFileSync(tmpScript, raw.includes("\r\n") ? out.replace(/\n/g, "\r\n") : out);
          fs.renameSync(tmpScript, file);
          scriptChanged = true;
          const pendingFile = path.join(root, "tools", "voice-script", "shared_sync_pending.json");
          const pending = fs.existsSync(pendingFile) ? JSON.parse(fs.readFileSync(pendingFile, "utf8")) : {};
          pending[ref] = { collection: isPair ? "pairs" : "lines", id, field, text: next, at: entry.updatedAt };
          fs.writeFileSync(pendingFile, JSON.stringify(pending, null, 1) + "\n");
          console.log(`[voice-direction] 台本も「${next}」に変えた（${ref}）`);
        }
        // 台本に入れたので、試聴室の指定には残さない（読み方だけ違うときは、読み上げる文として残す）
        if (script) scriptText = "";
        if (text && text === next) spokenText = "";
      }
    }
    if (!scriptText && !spokenText && !direction && !tags && stability === null && tempo === null) delete all[ref];
    else all[ref] = Object.assign({}, scriptText ? { script: scriptText } : {}, spokenText ? { text: spokenText } : {}, direction ? { direction } : {}, tags ? { tags } : {}, stability !== null ? { stability } : {}, tempo !== null ? { tempo } : {}, { updatedAt: new Date().toISOString() });
    const tmp = voiceDirectionFile + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(all, null, 1) + "\n");
    fs.renameSync(tmp, voiceDirectionFile);
    // 台詞を書き換えたら（話す人が増える・変わることがある）キャストと台詞の一覧を作り直す
    let rebuilt = false;
    if (script !== prevScript || scriptChanged) {
      try { execFileSync(process.execPath, [path.join(root, "scripts", "generate_card_voices_elevenlabs.js"), "cast"], { cwd: root, stdio: "pipe" }); rebuilt = true; }
      catch (e) { return sendJson(res, 500, { ok: false, message: "台詞の一覧を作り直せませんでした：" + String(e.stderr || e.message).slice(0, 200) }); }
      // ゲームのカード詳細に出す台詞の文字（voices/cards/manifest.json）も新しい台本で作り直す
      try { execFileSync(process.execPath, [path.join(root, "scripts", "build_card_voice_manifest.js")], { cwd: root, stdio: "pipe" }); } catch (e) { console.log("[voice-direction] 音声一覧を作り直せませんでした：" + String(e.stderr || e.message).slice(0, 200)); }
      // 分け方が変わって使われなくなった音声（例：2人の台詞を1人にしたときの -1・-2）は _old に移す
      const current = new Set(JSON.parse(fs.readFileSync(path.join(root, "tools", "voice-script", "card_voice_lines.json"), "utf8")).items.map(i => i.ref));
      const cards = path.join(root, "voices", "cards");
      for (const n of fs.readdirSync(cards)) {
        const m = new RegExp("^(" + ref + "(?:-\\d+)?)\\.mp3$").exec(n);
        if (m && !current.has(m[1])) { fs.mkdirSync(path.join(cards, "_old"), { recursive: true }); fs.renameSync(path.join(cards, n), path.join(cards, "_old", m[1] + ".unused.mp3")); console.log(`[voice-direction] 使われなくなった ${n} を _old に移動`); }
      }
    }
    console.log(`[voice-direction] ${ref}：${text ? "読み替え「" + text + "」 " : ""}${direction ? "方針「" + direction + "」 " : ""}${tags || "（タグなし）"}${stability !== null ? ` 安定度${stability}` : ""}`);
    return sendJson(res, 200, { ok: true, direction: all[ref] || null, rebuilt });
  }
  return sendJson(res, 404, { ok: false, message: "not found" });
}

const notesFile = path.join(root, "tools", "hub", "notes.json");
const crlfOf = file => { try { return fs.readFileSync(file, "utf8").includes("\r\n"); } catch { return false; } };
http.createServer((req, res) => {
  let pathname;
  let url;
  try { url = new URL(req.url, "http://localhost"); pathname = decodeURIComponent(url.pathname); }
  catch { res.writeHead(400).end(); return; }
  if (pathname.startsWith("/__dev/")) { handleDev(req, res, url).catch(err => sendJson(res, 500, { ok: false, message: String(err && err.message || err) })); return; }
  // 「/tools/card-editor/」のようにフォルダで終わるURLは、その中の index.html を返す
  const file = path.resolve(root, "." + (pathname.endsWith("/") ? pathname + "index.html" : pathname));
  const relative = path.relative(root, file);
  if (relative.startsWith("..") || path.isAbsolute(relative) || relative.split(path.sep).some(part => part.startsWith("."))) {
    res.writeHead(403).end(); return;
  }
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404).end(); return; }
    const type = types[path.extname(file).toLowerCase()] || "application/octet-stream";
    // 音声の途中に飛べる（シークできる）ように、ファイルの一部だけを返す要求（Range）に応える
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
    if (range && (range[1] || range[2])) {
      let start = range[1] ? Number(range[1]) : stat.size - Number(range[2]);
      let end = range[1] && range[2] ? Number(range[2]) : stat.size - 1;
      start = Math.max(0, start); end = Math.min(end, stat.size - 1);
      if (start > end || start >= stat.size) { res.writeHead(416, { "Content-Range": `bytes */${stat.size}` }).end(); return; }
      res.writeHead(206, { "Content-Type": type, "Content-Length": end - start + 1, "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Accept-Ranges": "bytes", "Cache-Control": "no-store" });
      if (req.method === "HEAD") { res.end(); return; }
      const part = fs.createReadStream(file, { start, end });
      part.on("error", () => res.destroy());
      part.pipe(res);
      return;
    }
    res.writeHead(200, { "Content-Type": type, "Content-Length": stat.size, "Accept-Ranges": "bytes", "Cache-Control": "no-store" });
    if (req.method === "HEAD") { res.end(); return; }
    const stream = fs.createReadStream(file);
    stream.on("error", () => res.destroy());
    stream.pipe(res);
  });
}).listen(8765, "127.0.0.1", () => console.log("Preview: http://localhost:8765/index.html"));
