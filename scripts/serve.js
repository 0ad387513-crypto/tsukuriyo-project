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
    return sendJson(res, 200, { ok: true, path: path.relative(root, file).split(path.sep).join("/"), bytes: body.length, warning });
  }
  // カードのイラスト（正方形に切り抜いたもの）を tools/card-editor/art/NNN.webp に保存する。作り直しのときに編集室が読み込む
  if (url.pathname === "/__dev/card-art" && req.method === "POST") {
    const no = parseInt(url.searchParams.get("no"), 10);
    if (!(no >= 1 && no <= 999)) return sendJson(res, 400, { ok: false, message: "No.の指定が正しくありません" });
    let body;
    try { body = await readBody(req, 5 * 1024 * 1024); } catch { return sendJson(res, 413, { ok: false, message: "イラストが大きすぎます" }); }
    if (body.length < 16 || body.toString("ascii", 0, 4) !== "RIFF" || body.toString("ascii", 8, 12) !== "WEBP") return sendJson(res, 400, { ok: false, message: "WebP画像ではありません" });
    const dir = path.join(root, "tools", "card-editor", "art");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, String(no).padStart(3, "0") + ".webp");
    fs.writeFileSync(file, body);
    console.log(`[card-editor] ${path.relative(root, file)} を保存（${Math.round(body.length / 1024)}KB）`);
    return sendJson(res, 200, { ok: true, path: path.relative(root, file).split(path.sep).join("/"), bytes: body.length });
  }
  if (url.pathname === "/__dev/card-art-list") {
    const dir = path.join(root, "tools", "card-editor", "art");
    const nos = fs.existsSync(dir) ? fs.readdirSync(dir).map(f => f.match(/^(\d{3})\.webp$/)).filter(Boolean).map(m => String(parseInt(m[1], 10))) : [];
    return sendJson(res, 200, { ok: true, nos });
  }
  return sendJson(res, 404, { ok: false, message: "not found" });
}

http.createServer((req, res) => {
  let pathname;
  let url;
  try { url = new URL(req.url, "http://localhost"); pathname = decodeURIComponent(url.pathname); }
  catch { res.writeHead(400).end(); return; }
  if (pathname.startsWith("/__dev/")) { handleDev(req, res, url).catch(err => sendJson(res, 500, { ok: false, message: String(err && err.message || err) })); return; }
  const file = path.resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
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
