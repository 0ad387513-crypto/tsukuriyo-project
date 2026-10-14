"use strict";
/* 演出確認ページ（effects_preview.html）の創世神技のカットインに出す文字（技名・読み・台詞）を書き出す。
   技名はカミ設定シートの写し（tools/board/dist/data/kami.json）、台詞は index.html の KAMI_EMOTE_LINES の skill2。
   node tools/divine-assets/build-genesis-copy.js（tools/board/build.js からも呼ぶ） */
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..", "..");
function buildGenesisCopy() {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const start = html.indexOf("const KAMI_EMOTE_LINES = {");
  const block = start >= 0 ? html.slice(start, html.indexOf("\n};", start)) : "";
  const lines = {};
  for (const m of block.matchAll(/"(\d+)":\s*\{[^}]*?skill2:\s*"([^"]*)"/g)) lines[m[1]] = m[2];
  const kamiFile = path.join(root, "tools", "board", "dist", "data", "kami.json");
  const kami = fs.existsSync(kamiFile) ? JSON.parse(fs.readFileSync(kamiFile, "utf8")).kami : [];
  const out = {};
  for (let no = 1; no <= 10; no++) {
    const k = kami.find(x => String(x.no) === String(no)) || {};
    const raw = String(k.skill2name || "").replace(/[\u200b-\u200d\ufeff]/g, "").replace(/\s+/g, " ").trim();
    const m = raw.match(/^(.*?)[（(]([^）)]*)[）)]\s*$/);
    out[no] = { name: m ? m[1].trim() : raw, reading: m ? m[2].trim() : "", line: lines[String(no)] || "" };
  }
  fs.writeFileSync(path.join(__dirname, "genesis-copy.json"), JSON.stringify(out, null, 1) + "\n");
  return out;
}
module.exports = { buildGenesisCopy };
if (require.main === module) console.log(JSON.stringify(buildGenesisCopy()).slice(0, 300));
