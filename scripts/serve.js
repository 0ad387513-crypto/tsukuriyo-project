"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const types = { ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".css": "text/css; charset=utf-8", ".webp": "image/webp", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".mp3": "audio/mpeg", ".wav": "audio/wav" };

/* ===== カード編集室（tools/card-editor）用の保存口 =====
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
const voiceDirectionFile = path.join(root, "tools", "voice-script", "card_voice_direction.json");
const VOICE_SCRIPT_FIELDS = ["summon", "attack", "death", "use", "reading", "note", "memo", "status"];
async function handleDev(req, res, url) {
  // 他のサイトから localhost へ送り込まれるのを防ぐため、同じ確認用サーバーのページからの要求だけ受け付ける
  const origin = req.headers.origin;
  if (origin && !/^http:\/\/(localhost|127\.0\.0\.1):8765$/.test(origin)) return sendJson(res, 403, { ok: false, message: "許可されていない送信元です" });
  if (url.pathname === "/__dev/ping") return sendJson(res, 200, { ok: true });
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
    if (c.el_description === description) return sendJson(res, 200, { ok: true, cast: c, unchanged: true });
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
    const direction = String(body.direction || "").trim();
    if (direction.length > 200 || /[<>{}]/.test(direction)) return sendJson(res, 400, { ok: false, message: "演技の方針が長すぎるか、使えない文字があります" });
    if (text.length > 300 || /[<>{}]/.test(text)) return sendJson(res, 400, { ok: false, message: "読み上げる文が長すぎるか、使えない文字があります" });
    const stability = body.stability === null || body.stability === undefined || body.stability === "" ? null : Number(body.stability);
    if (tags.length > 120 || /[<>{}]/.test(tags)) return sendJson(res, 400, { ok: false, message: "演技タグが長すぎるか、使えない文字があります" });
    if (stability !== null && !(stability >= 0 && stability <= 1)) return sendJson(res, 400, { ok: false, message: "安定度は0〜1で指定してください" });
    const all = fs.existsSync(voiceDirectionFile) ? JSON.parse(fs.readFileSync(voiceDirectionFile, "utf8")) : {};
    if (!text && !direction && !tags && stability === null) delete all[ref];
    else all[ref] = Object.assign({}, text ? { text } : {}, direction ? { direction } : {}, tags ? { tags } : {}, stability !== null ? { stability } : {}, { updatedAt: new Date().toISOString() });
    const tmp = voiceDirectionFile + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(all, null, 1) + "\n");
    fs.renameSync(tmp, voiceDirectionFile);
    console.log(`[voice-direction] ${ref}：${text ? "読み替え「" + text + "」 " : ""}${direction ? "方針「" + direction + "」 " : ""}${tags || "（タグなし）"}${stability !== null ? ` 安定度${stability}` : ""}`);
    return sendJson(res, 200, { ok: true, direction: all[ref] || null });
  }
  return sendJson(res, 404, { ok: false, message: "not found" });
}

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
    res.writeHead(200, { "Content-Type": types[path.extname(file).toLowerCase()] || "application/octet-stream", "Content-Length": stat.size, "Cache-Control": "no-store" });
    if (req.method === "HEAD") { res.end(); return; }
    const stream = fs.createReadStream(file);
    stream.on("error", () => res.destroy());
    stream.pipe(res);
  });
}).listen(8765, "127.0.0.1", () => console.log("Preview: http://localhost:8765/index.html"));
