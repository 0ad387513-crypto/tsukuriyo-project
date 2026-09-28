"use strict";
/*
  創世決戦OPの曲を ElevenLabs Music で作り直す（ローカルで手動実行する開発用スクリプト）。
  構成は bgm/genesis-op-elevenlabs-plan.json（8場面の長さと同じセクション構成）を使う。

  使い方（PowerShell）：
    $env:ELEVENLABS_API_KEY = "取得したAPIキー"   # キーはファイルに書かず、環境変数で渡す（「音楽生成」の権限が必要）
    node scripts/generate_op_bgm_elevenlabs.js compose            # 構成プランで1曲作る（場面の切り替えと曲の展開がそろう）
    node scripts/generate_op_bgm_elevenlabs.js compose --prompt   # 文章のプロンプトだけで作る（構成は曲任せ）
    node scripts/generate_op_bgm_elevenlabs.js compose --seed 123 # 同じ種で作り直す（完全な再現は保証されない）
    node scripts/generate_op_bgm_elevenlabs.js list               # 作った候補の一覧
    node scripts/generate_op_bgm_elevenlabs.js use --file op-20260929-0412.mp3   # 候補をゲームのOP曲にする

  確認：npm run preview を起動して http://localhost:8765/bgm/op-preview.html を開くと、
        候補の曲に合わせて8枚の絵が切り替わる様子を確かめられる。

  出力：
    bgm/op-candidates/*.mp3        作った候補（配信しない）
    bgm/op-candidates/index.json   試聴ページが読む候補の一覧
    bgm/genesis-op.original.mp3    use で差し替える前の元の曲（初回だけ保存）
*/
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const bgmDir = path.join(root, "bgm");
const candDir = path.join(bgmDir, "op-candidates");
const indexFile = path.join(candDir, "index.json");
const plan = JSON.parse(fs.readFileSync(path.join(bgmDir, "genesis-op-elevenlabs-plan.json"), "utf8"));
const API = "https://api.elevenlabs.io/v1";

const args = process.argv.slice(2);
const command = args[0] || "help";
const argValue = name => { const i = args.indexOf(name); return i >= 0 ? String(args[i + 1]) : null; };

const readJson = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; } };
const writeJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
function apiKey() {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) { console.error("環境変数 ELEVENLABS_API_KEY が設定されていません。"); process.exit(1); }
  return key;
}
const stamp = () => {
  const d = new Date(), p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

async function compose() {
  const usePrompt = args.includes("--prompt");
  const seed = argValue("--seed");
  const body = usePrompt
    ? { prompt: plan.prompt, music_length_ms: plan.music_length_ms, force_instrumental: true, model_id: plan.model_id }
    : { composition_plan: plan.composition_plan, model_id: plan.model_id, respect_sections_durations: plan.respect_sections_durations };
  if (seed) body.seed = Number(seed);
  const totalSec = plan.composition_plan.sections.reduce((s, x) => s + x.duration_ms, 0) / 1000;
  console.log(`${usePrompt ? "プロンプト" : "構成プラン"}で作曲中…（約${totalSec}秒の曲。1〜2分かかることがあります）`);
  const res = await fetch(`${API}/music?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "xi-api-key": apiKey() },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(300000),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 500)}`);
  const audio = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(candDir, { recursive: true });
  const file = `op-${stamp()}.mp3`;
  fs.writeFileSync(path.join(candDir, file), audio);
  const list = readJson(indexFile, []);
  list.push({ file, mode: usePrompt ? "prompt" : "plan", seed: seed ? Number(seed) : null, songId: res.headers.get("song-id") || null, created: new Date().toISOString() });
  writeJson(indexFile, list);
  console.log(`→ bgm/op-candidates/${file}（${Math.round(audio.length / 1024)}KB）`);
  console.log("確認：http://localhost:8765/bgm/op-preview.html");
}

function list() {
  const items = readJson(indexFile, []);
  if (!items.length) { console.log("候補はまだありません。compose で作ってください。"); return; }
  for (const c of items) console.log(`  ${c.file}  ${c.mode === "prompt" ? "プロンプト" : "構成プラン"}${c.seed != null ? `  seed=${c.seed}` : ""}`);
}

// 候補をゲームのOP曲（bgm/genesis-op.mp3）にする。元の曲は初回だけ genesis-op.original.mp3 として残す
function use() {
  const name = argValue("--file");
  const src = name && path.join(candDir, path.basename(name));
  if (!src || !fs.existsSync(src)) { console.error("use には --file 候補のファイル名 が必要です（list で確認）。"); process.exit(1); }
  const target = path.join(bgmDir, "genesis-op.mp3");
  const backup = path.join(bgmDir, "genesis-op.original.mp3");
  if (!fs.existsSync(backup)) fs.copyFileSync(target, backup);
  fs.copyFileSync(src, target);
  console.log(`bgm/genesis-op.mp3 を ${path.basename(src)} に差し替えました（元の曲：bgm/genesis-op.original.mp3）`);
  console.log("曲の拍の位置が変わるので、index.html の GENESIS_STORY_BEAT_OFFSET_SEC を試聴ページの計測値に合わせてください。");
}

(async () => {
  if (command === "compose") await compose();
  else if (command === "list") list();
  else if (command === "use") use();
  else console.log(fs.readFileSync(__filename, "utf8").split("*/")[0]);
})().catch(e => { console.error(e.message || e); process.exitCode = 1; });
