"use strict";
/*
  星戦のSE（効果音）を ElevenLabs の効果音生成で作る（ローカルで手動実行する開発用スクリプト）。
  作るSEの一覧と生成の指示は tools/sfx-lab/plan.json（new＝まだ無い場面のSE、existing＝今あるSEの作り直し候補）。

  使い方（PowerShell）：
    $env:ELEVENLABS_API_KEY = "取得したAPIキー"   # キーはファイルに書かず、環境変数で渡す（「効果音」の権限が必要）
    node scripts/generate_sfx_elevenlabs.js make --new                 # まだ無い場面のSEを、1つにつき3候補ずつ作る
    node scripts/generate_sfx_elevenlabs.js make --keys hit,draw       # 指定したSEだけ作る（今あるSEの作り直しも同じ）
    node scripts/generate_sfx_elevenlabs.js make --keys hit --count 5  # 候補の数を変える
    node scripts/generate_sfx_elevenlabs.js list                       # 作った候補の一覧
    node scripts/generate_sfx_elevenlabs.js use --key hit --file hit-20261009-0412-2.mp3   # 候補をゲームのSEにする

  確認：npm run preview を起動して http://localhost:8765/tools/sfx-lab/ を開くと、今のSEと候補を並べて聞き比べられる。

  出力：
    sfx/candidates/<key>/*.mp3      作った候補（配信しない・コミットしない）
    sfx/candidates/index.json       試聴ページが読む候補の一覧
    sfx/candidates/_originals/      use で差し替える前の元のSE（初回だけ保存）
  use の後は npm run assets:hash で素材の一覧（asset_hashes.js）を作り直すこと。
*/
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sfxDir = path.join(root, "sfx");
const candDir = path.join(sfxDir, "candidates");
const indexFile = path.join(candDir, "index.json");
const planFile = path.join(root, "tools", "sfx-lab", "plan.json");
const API = "https://api.elevenlabs.io/v1";

const args = process.argv.slice(2);
const command = args[0] || "help";
const argValue = name => { const i = args.indexOf(name); return i >= 0 ? String(args[i + 1]) : null; };
const hasFlag = name => args.includes(name);

const readJson = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; } };
const writeJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
const plan = readJson(planFile, null);
if (!plan) { console.error("tools/sfx-lab/plan.json を読めません。"); process.exit(1); }

function apiKey() {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) { console.error("環境変数 ELEVENLABS_API_KEY が設定されていません。"); process.exit(1); }
  return key;
}
function stamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}
function pickItems() {
  const keys = argValue("--keys");
  if (keys) {
    const wanted = keys.split(",").map(s => s.trim()).filter(Boolean);
    const missing = wanted.filter(k => !plan.items.some(it => it.key === k));
    if (missing.length) { console.error("plan.json に無いSE：" + missing.join(", ")); process.exit(1); }
    return plan.items.filter(it => wanted.includes(it.key));
  }
  if (hasFlag("--new")) return plan.items.filter(it => it.status === "new");
  console.error("make には --new か --keys キー1,キー2 が必要です。");
  process.exit(1);
}

async function generateOne(item) {
  const body = {
    text: `${plan.style} ${item.prompt}`,
    duration_seconds: item.duration,
    prompt_influence: item.influence,
  };
  const res = await fetch(`${API}/sound-generation?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "xi-api-key": apiKey() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

async function make() {
  const items = pickItems();
  const count = Math.max(1, Math.min(8, Number(argValue("--count")) || 3));
  const index = readJson(indexFile, { candidates: {} });
  const at = stamp();
  for (const item of items) {
    const dir = path.join(candDir, item.key);
    fs.mkdirSync(dir, { recursive: true });
    for (let i = 1; i <= count; i++) {
      const file = `${item.key}-${at}-${i}.mp3`;
      process.stdout.write(`${item.key} 候補${i}/${count} … `);
      try {
        const audio = await generateOne(item);
        fs.writeFileSync(path.join(dir, file), audio);
        (index.candidates[item.key] = index.candidates[item.key] || []).push({ file, prompt: item.prompt, duration: item.duration, created: new Date().toISOString() });
        writeJson(indexFile, index);
        console.log(`${file}（${Math.round(audio.length / 1024)}KB）`);
      } catch (e) {
        console.log("失敗：" + e.message);
      }
    }
  }
  console.log("\n試聴：npm run preview → http://localhost:8765/tools/sfx-lab/");
}

function list() {
  const index = readJson(indexFile, { candidates: {} });
  for (const item of plan.items) {
    const list = index.candidates[item.key] || [];
    if (!list.length) continue;
    console.log(`${item.key}（${item.use}）`);
    for (const c of list) console.log(`  ${c.file}`);
  }
}

function use() {
  const key = argValue("--key"), file = argValue("--file");
  const item = plan.items.find(it => it.key === key);
  if (!item) { console.error("use には plan.json にある --key が必要です。"); process.exit(1); }
  const src = path.join(candDir, key, file || "");
  if (!file || !fs.existsSync(src)) { console.error("use には --file 候補のファイル名 が必要です（list で確認）。"); process.exit(1); }
  const dest = path.join(sfxDir, item.file);
  if (fs.existsSync(dest)) {
    const backup = path.join(candDir, "_originals", item.file);
    if (!fs.existsSync(backup)) { fs.mkdirSync(path.dirname(backup), { recursive: true }); fs.copyFileSync(dest, backup); }
  }
  fs.copyFileSync(src, dest);
  const index = readJson(indexFile, { candidates: {} });
  index.used = index.used || {};
  index.used[key] = { file, at: new Date().toISOString() };
  writeJson(indexFile, index);
  console.log(`sfx/${item.file} を ${file} に差し替えました。npm run assets:hash で素材の一覧を作り直してください。`);
  if (item.status === "new") console.log("新しいSEなので、ゲームに配線する（index.html の SFX_FILES と鳴らす場所）作業が必要です。");
}

function help() {
  console.log(fs.readFileSync(__filename, "utf8").split("*/")[0].replace(/^"use strict";\s*\/\*/, ""));
}

(async () => {
  if (command === "make") await make();
  else if (command === "list") list();
  else if (command === "use") use();
  else help();
})();
