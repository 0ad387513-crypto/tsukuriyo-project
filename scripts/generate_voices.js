"use strict";
/*
  カミのボイスを Gemini 3.8 Flash TTS で生成する（ローカルで手動実行する開発用スクリプト）。

  使い方（PowerShell）：
    $env:GEMINI_API_KEY = "取得したAPIキー"      # キーはファイルに書かず、環境変数で渡す
    node scripts/generate_voices.js voices       # 1) カミごとの声を作り、試聴用の見本を保存
    node scripts/generate_voices.js lines        # 2) 台詞をすべて生成（生成済みはスキップ）
    node scripts/generate_voices.js lines --kami 8 --force   # 特定のカミだけ作り直す
    node scripts/generate_voices.js voices --kami 10 --force  # 声の作り直し（説明文を変えたとき）
    node scripts/generate_voices.js manifest     # voices/manifest.json だけ作り直す

  出力：
    voices/_raw/…            生成そのままの WAV（.gitignore 対象。配信しない）
    voices/previews/{No}.wav 声を作ったときの見本（試聴用。配信しない）
    voices/{No}/{key}.mp3    ゲームで使う圧縮済み音声（ffmpeg が必要。無ければ WAV を置く）
    voices/voice_ids.json    作った声のID（1年で失効。失効したら voices --force で作り直す）
    voices/manifest.json     ゲームが読む「どの台詞に音声があるか」の一覧
*/
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const voiceDir = path.join(root, "voices");
const script = JSON.parse(fs.readFileSync(path.join(voiceDir, "voice_script.json"), "utf8"));
const idsFile = path.join(voiceDir, "voice_ids.json");
const API = "https://generativelanguage.googleapis.com/v1beta";

const args = process.argv.slice(2);
const command = args[0] || "help";
const onlyKami = (() => { const i = args.indexOf("--kami"); return i >= 0 ? String(args[i + 1]) : null; })();
const force = args.includes("--force");

function loadIds() { try { return JSON.parse(fs.readFileSync(idsFile, "utf8")); } catch { return {}; } }
function saveIds(ids) { fs.writeFileSync(idsFile, JSON.stringify(ids, null, 2) + "\n"); }
function apiKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) { console.error("環境変数 GEMINI_API_KEY が設定されていません。"); process.exit(1); }
  return key;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function call(pathname, body) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(API + pathname, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey() },
      body: JSON.stringify(body),
    });
    if (res.ok) return res.json();
    const text = await res.text();
    // 混雑・一時エラーは待って再試行する
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      const wait = 2000 * attempt;
      console.warn(`  ${res.status}：${wait / 1000}秒待って再試行します`);
      await sleep(wait);
      continue;
    }
    throw new Error(`API ${res.status}: ${text.slice(0, 500)}`);
  }
}

function kamiList() {
  return Object.keys(script.kami).filter(no => !onlyKami || no === onlyKami);
}

async function createVoices() {
  const ids = loadIds();
  fs.mkdirSync(path.join(voiceDir, "previews"), { recursive: true });
  const failed = [];
  for (const no of kamiList()) {
    const kami = script.kami[no];
    if (ids[no] && !force) { console.log(`${no} ${kami.name}：作成済み（${ids[no].id}）`); continue; }
    try {
    console.log(`${no} ${kami.name}：声を作成中…`);
    const voice = await call("/voices", {
      store: true,
      voice: {
        model: script.model,
        type: "prompted",
        display_name: `tsukuriyo-${no}-${kami.name}`,
        gender: kami.voice.gender,
        language_code: script.language_code,
        prompted: { input: kami.voice.description },
      },
    });
    ids[no] = { id: voice.id, name: kami.name, created: new Date().toISOString(), expire: voice.expire_time || null };
    saveIds(ids);
    if (voice.sample_audio && voice.sample_audio.data) {
      fs.writeFileSync(path.join(voiceDir, "previews", `${no}.wav`), Buffer.from(voice.sample_audio.data, "base64"));
    }
    console.log(`  → ${voice.id}（見本：voices/previews/${no}.wav）`);
    } catch (e) {
      // 1柱が失敗しても残りは作り続け、最後にまとめて知らせる（説明文が安全ポリシーで止められた場合など）
      console.error(`  × 失敗：${String(e.message || e).slice(0, 300)}`);
      failed.push(`${no} ${kami.name}`);
    }
  }
  if (failed.length) console.error(`作成できなかったカミ：${failed.join('、')}（voice_script.json の説明文を見直して再実行してください）`);
}

function audioFromInteraction(json) {
  const steps = Array.isArray(json.steps) ? json.steps : [];
  const blocks = steps.filter(s => s.type === "model_output").flatMap(s => s.content || []).filter(c => c.type === "audio" && c.data);
  const last = blocks[blocks.length - 1];
  if (!last) throw new Error("音声データが返ってきませんでした：" + JSON.stringify(json).slice(0, 300));
  return Buffer.from(last.data, "base64");
}

function hasFfmpeg() {
  try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); return true; } catch { return false; }
}

async function generateLines() {
  const ids = loadIds();
  const ffmpeg = hasFfmpeg();
  if (!ffmpeg) console.warn("ffmpeg が見つからないため、WAV のまま配置します（容量が大きくなります）。winget install Gyan.FFmpeg で導入できます。");
  let seconds = 0;
  const failedLines = [];
  for (const no of kamiList()) {
    const kami = script.kami[no];
    if (!ids[no]) { console.warn(`${no} ${kami.name}：声が未作成です。先に voices を実行してください。`); continue; }
    fs.mkdirSync(path.join(voiceDir, "_raw", no), { recursive: true });
    fs.mkdirSync(path.join(voiceDir, no), { recursive: true });
    for (const [key, line] of Object.entries(kami.lines)) {
      const out = path.join(voiceDir, no, `${key}.${ffmpeg ? "mp3" : "wav"}`);
      if (fs.existsSync(out) && !force) continue;
      const style = [script.styles[key.startsWith("win_") ? "win" : key], line.style].filter(Boolean).join("。");
      console.log(`${no} ${kami.name} ${key}：${line.text}`);
      try {
      const json = await call("/interactions", {
        model: script.model,
        input: [{
          type: "user_input",
          content: [{ type: "text", text: line.tts || line.text, annotations: [{ type: "speech_metadata", style }] }],
        }],
        response_format: { type: "audio", mime_type: "audio/wav", sample_rate: 24000 },
        generation_config: { speech_config: [{ voice: ids[no].id }] },
      });
      const wav = audioFromInteraction(json);
      const raw = path.join(voiceDir, "_raw", no, `${key}.wav`);
      fs.writeFileSync(raw, wav);
      seconds += Math.max(0, wav.length - 44) / 48000; // 24kHz・16bit・モノラル
      if (ffmpeg) {
        // 前後の無音を詰め、音量をそろえて、モノラル64kbpsのmp3にする
        execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", raw,
          "-af", "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,loudnorm=I=-16:TP=-1.5:LRA=11",
          "-ac", "1", "-ar", "44100", "-b:a", "64k", out]);
      } else {
        fs.copyFileSync(raw, out);
      }
      } catch (e) {
        // 1台詞が失敗しても残りは作り続ける（台詞が安全ポリシーで止められた場合など）
        console.error(`  × 失敗：${String(e.message || e).slice(0, 300)}`);
        failedLines.push(`${no} ${kami.name} ${key}`);
      }
      await sleep(400);
    }
  }
  if (failedLines.length) console.error(`生成できなかった台詞：${failedLines.join('、')}（読み（tts）や言い回しを見直して再実行してください）`);
  if (seconds) console.log(`今回生成した音声：約${Math.round(seconds)}秒`);
  writeManifest();
}

// ゲームは manifest.json に載っている台詞だけ再生する（未生成の台詞で404を出さないため）
function writeManifest() {
  const manifest = { version: 1, generatedAt: new Date().toISOString(), kami: {} };
  for (const no of Object.keys(script.kami)) {
    const dir = path.join(voiceDir, no);
    if (!fs.existsSync(dir)) continue;
    const files = {};
    for (const f of fs.readdirSync(dir)) {
      const m = f.match(/^(\w+)\.(mp3|wav)$/);
      if (m) files[m[1]] = `voices/${no}/${f}`;
    }
    if (Object.keys(files).length) manifest.kami[no] = files;
  }
  fs.writeFileSync(path.join(voiceDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`voices/manifest.json を更新しました（${Object.keys(manifest.kami).length}柱分）`);
}

(async () => {
  if (command === "voices") await createVoices();
  else if (command === "lines") await generateLines();
  else if (command === "manifest") writeManifest();
  else console.log(fs.readFileSync(__filename, "utf8").split("*/")[0]);
})().catch(e => { console.error(e.message || e); process.exit(1); });
