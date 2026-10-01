"use strict";
/*
  カミのボイスを ElevenLabs（v3）で生成する（ローカルで手動実行する開発用スクリプト）。
  台本は voices/voice_script.json を Gemini 版と共用する（voice.el_description・elevenlabs・台詞の el を使う）。

  使い方（PowerShell）：
    $env:ELEVENLABS_API_KEY = "取得したAPIキー"                 # キーはファイルに書かず、環境変数で渡す
    node scripts/generate_voices_elevenlabs.js design --kami 1   # 1) 声の候補を3つ作り、試聴用に保存
    node scripts/generate_voices_elevenlabs.js design --kami 4 --ref 1   # 候補1を手本に、近い声の候補を追加で作る（--strength 0〜1 で説明文の効き具合）
    node scripts/generate_voices_elevenlabs.js design --kami 8 --keep    # 既存の候補を残したまま、手本なしで候補を追加
    node scripts/generate_voices_elevenlabs.js pick --kami 1 --choice 2   # 2) 気に入った候補を声として登録
    node scripts/generate_voices_elevenlabs.js use --kami 1 --voice-id 声のID   # 1〜2の代わり：画面で作った声を登録（無料プラン向け）
    node scripts/generate_voices_elevenlabs.js ui-text --kami 2  # 画面のボイスデザインに貼るプロンプトと見本の文章を表示
    node scripts/generate_voices_elevenlabs.js lines --kami 1    # 3) そのカミの台詞をすべて生成（生成済みはスキップ）
    node scripts/generate_voices_elevenlabs.js lines --kami 1 --key skill2 --force   # 1台詞だけ作り直す
    node scripts/generate_voices_elevenlabs.js voices-list        # アカウントの自作の声と、ゲームで使用中かを表示
    node scripts/generate_voices_elevenlabs.js voice-delete --voice-id ID   # 未使用の声を削除（使用中の声は消さない）
    node scripts/generate_voices_elevenlabs.js manifest          # voices/manifest.json だけ作り直す
  --kami を省くと全カミが対象。

  新しいモデルの試し作り（ゲームのボイスは書き換えない）：
    --trial 名前   結果を voices/trials/名前/ に保存する（ゲーム用の voices/{No}/ と manifest.json は触らない）
    --model ID     台詞の読み上げに使うモデル（省略時は voice_script.json の elevenlabs.model）
    --design-model ID   声の候補づくりに使うモデル（省略時は elevenlabs.design_model）
    例）今の声のまま、v4 で読ませて聞き比べる：
      node scripts/generate_voices_elevenlabs.js lines --kami 3 --trial v4 --model eleven_v4
    例）v4 用に声も作り直す（候補づくり → 登録 → 読み上げ。登録は試し作り用の一覧にだけ入る）：
      node scripts/generate_voices_elevenlabs.js design --kami 3 --trial v4
      node scripts/generate_voices_elevenlabs.js pick --kami 3 --choice 2 --trial v4
      node scripts/generate_voices_elevenlabs.js lines --kami 3 --trial v4 --model eleven_v4 --force
    全カミをまとめて：--kami を省くと、候補づくりはまだ候補の無いカミだけ、読み上げは試し作り用の声を登録したカミだけが対象
      node scripts/generate_voices_elevenlabs.js lines --trial v4 --model eleven_v4 --current-voice   # 全カミを今の声のまま v4 で読ませる
      node scripts/generate_voices_elevenlabs.js design --trial v4
      node scripts/generate_voices_elevenlabs.js lines --trial v4 --model eleven_v4
    声の案を使い分ける：voice_script.json の voice.el_variants に説明文を並べ、--variant 名前 で選ぶ（候補は今ある候補の後ろに足す）
      node scripts/generate_voices_elevenlabs.js design --kami 4 --trial v4 --variant female
      node scripts/generate_voices_elevenlabs.js design --kami 4 --trial v4 --variant male
    聞き比べ：確認用サーバー起動中に http://localhost:8765/tools/voice-compare/
    採用：聞き比べて良かったカミの試し作りの音声を、ゲームのボイスにする（声の登録も切り替わり、一覧も作り直す）
      node scripts/generate_voices_elevenlabs.js adopt --kami 3 --trial v4
      → 前の声はゲームで使わなくなるので、声の枠が足りなければ voices-list で確認して voice-delete で消せる

  出力：
    voices/previews/el-{No}-{1..3}.mp3  声の候補（試聴用。配信しない）
    voices/previews/el_designs.json     候補のID（pick で使う）
    voices/elevenlabs_voice_ids.json    登録した声のID
    voices/{No}/{key}.mp3               ゲームで使う音声
    voices/manifest.json                ゲームが読む「どの台詞に音声があるか」の一覧
    voices/trials/{名前}/...            試し作り（--trial）の結果。git に入れず、本番にも出さない
*/
const fs = require("node:fs");
const path = require("node:path");

const args = process.argv.slice(2);
const command = args[0] || "help";
const argValue = name => { const i = args.indexOf(name); return i >= 0 ? String(args[i + 1]) : null; };

const root = path.resolve(__dirname, "..");
const voiceDir = path.join(root, "voices");
// 試し作り（--trial 名前）：結果を voices/trials/名前/ に分けて保存し、ゲームのボイスは書き換えない
const trial = argValue("--trial");
if (trial && !/^[a-z0-9_-]+$/i.test(trial)) { console.error("--trial の名前は半角英数字・-・_ で指定してください（例：v4）"); process.exit(1); }
const trialDir = trial ? path.join(voiceDir, "trials", trial) : null;
const previewDir = trial ? path.join(trialDir, "previews") : path.join(voiceDir, "previews");
const script = JSON.parse(fs.readFileSync(path.join(voiceDir, "voice_script.json"), "utf8"));
const el = script.elevenlabs;
const idsFile = path.join(voiceDir, "elevenlabs_voice_ids.json");
const trialIdsFile = trial ? path.join(trialDir, "voice_ids.json") : null;
const registerIdsFile = trialIdsFile || idsFile; // design・pick・use で声を登録する先（試し作りなら試し作り用の一覧）
const designsFile = path.join(previewDir, "el_designs.json");
const lineModel = argValue("--model") || el.model;
const variant = argValue("--variant"); // 声の案（voice.el_variants の名前）
// 声の説明文：--variant があればその案、なければ el_description
function voiceDescription(kami, name) {
  if (!name) return kami.voice.el_description;
  const text = kami.voice.el_variants && kami.voice.el_variants[name];
  if (!text) { console.error(`${kami.name} に声の案「${name}」がありません（voice.el_variants を確認してください）`); process.exit(1); }
  return text;
}
const designModel = argValue("--design-model") || el.design_model;
const API = "https://api.elevenlabs.io/v1";

const onlyKami = argValue("--kami");
const onlyKeys = argValue("--key") ? argValue("--key").split(",") : null; // 例：--key taunt,skill1
const choice = argValue("--choice");
const force = args.includes("--force");

const readJson = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; } };
const writeJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
function apiKey() {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) { console.error("環境変数 ELEVENLABS_API_KEY が設定されていません。"); process.exit(1); }
  return key;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// binary=true なら音声（Buffer）、それ以外は JSON を返す
async function call(pathname, body, binary = false) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    let res;
    try {
      res = await fetch(API + pathname, {
        method: "POST",
        headers: { "Content-Type": "application/json", "xi-api-key": apiKey() },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(90000), // 応答が返らず固まるのを防ぐ（90秒で打ち切って再試行）
      });
    } catch (e) {
      if (attempt < 5) { console.warn(`  通信が止まったため、やり直します（${attempt}回目）`); await sleep(2000); continue; }
      throw e;
    }
    if (res.ok) return binary ? Buffer.from(await res.arrayBuffer()) : res.json();
    const text = await res.text();
    // 混雑・一時エラーは待って再試行する
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      const wait = 3000 * attempt;
      console.warn(`  ${res.status}：${wait / 1000}秒待って再試行します`);
      await sleep(wait);
      continue;
    }
    throw new Error(`API ${res.status}: ${text.slice(0, 500)}`);
  }
}

// GET・DELETE 用（声の一覧と削除）
async function request(method, pathname) {
  const res = await fetch(API + pathname, { method, headers: { "xi-api-key": apiKey() }, signal: AbortSignal.timeout(60000) });
  const text = await res.text();
  if (!res.ok) throw new Error(`API ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
}

// アカウントに保存されている自作の声を一覧表示し、ゲームで使っているかを示す（声の上限に達したときの整理用）
async function listVoices() {
  const ids = readJson(idsFile, {});
  const used = new Map(Object.entries(ids).map(([no, v]) => [v.id, `${no} ${v.name}`]));
  const json = await request("GET", "/voices");
  const mine = (json.voices || []).filter(v => v.category !== "premade");
  console.log(`自作の声：${mine.length}個`);
  for (const v of mine) {
    const tag = used.has(v.voice_id) ? `使用中（${used.get(v.voice_id)}）` : "未使用";
    console.log(`  ${v.voice_id}  ${v.name}  … ${tag}`);
  }
}

// 使っていない声を削除する（ゲームで使用中の声は消せないようにしてある）
async function deleteVoice() {
  const voiceId = argValue("--voice-id");
  if (!voiceId) { console.error("voice-delete には --voice-id が必要です。"); process.exit(1); }
  // O と 0、l と 1 と I は見分けにくいので、同一視してアカウントの声から探す
  const norm = id => id.replace(/[O0]/g, "0").replace(/[lI1]/g, "1");
  const json = await request("GET", "/voices");
  const hits = (json.voices || []).filter(v => v.category !== "premade" && norm(v.voice_id) === norm(voiceId));
  if (hits.length !== 1) { console.error(`声 ${voiceId} が見つかりません（voices-list で確認してください）`); process.exit(1); }
  const target = hits[0].voice_id;
  const inUse = Object.entries(readJson(idsFile, {})).find(([, v]) => v.id === target);
  if (inUse) { console.error(`この声は ${inUse[0]} ${inUse[1].name} で使用中のため削除しません。`); process.exit(1); }
  await request("DELETE", `/voices/${target}`);
  console.log(`声 ${target}（${hits[0].name}）を削除しました`);
}

function kamiList() {
  return Object.keys(script.kami).filter(no => !onlyKami || no === onlyKami);
}

// 読み上げる文：台詞ごとの el があればそのまま、無ければ種類ごとのタグ＋読み（tts）か表示文
function lineText(key, line) {
  if (line.el) return line.el;
  const text = line.tts && !line.tts.startsWith("<") ? line.tts : line.text;
  const tag = key.startsWith("win_") ? el.tags.win : el.tags[key]; // 勝利セリフ（win_敗者No・win_gs）は共通のタグ
  // 全角「？」だと語尾が上がりにくいことがあるため、半角「?」にして疑問の抑揚を付けさせる
  return [tag, text.replace(/？/g, "?")].filter(Boolean).join(" ");
}

// 声の候補づくりには100〜1000字の見本文が要る。そのカミの台詞をつなげて、実際の演技で聞き比べられるようにする
function designText(kami) {
  const parts = Object.entries(kami.lines).filter(([key]) => !key.startsWith("win_")).map(([key, line]) => lineText(key, line));
  let text = parts.join("　");
  while (text.length < 100) text += "　" + parts.join("　");
  return text.slice(0, 1000);
}

async function design() {
  fs.mkdirSync(previewDir, { recursive: true });
  const designs = readJson(designsFile, {});
  const registered = readJson(registerIdsFile, {});
  const failed = [];
  for (const no of kamiList()) {
    const kami = script.kami[no];
    // --ref 候補番号：その候補の音声を手本にして、近い声の候補を追加で作る（既存の候補は残す）
    const ref = argValue("--ref");
    const refFile = ref && (designs[no] || []).find(c => String(c.choice) === ref);
    if (ref && !refFile) { console.error(`${no} ${kami.name}：候補${ref}が見つかりません`); continue; }
    const keepArg = args.includes("--keep");
    if (!ref && !keepArg && registered[no] && !force) { console.log(`${no} ${kami.name}：声を登録済み（作り直すなら --force）`); continue; }
    const keep = args.includes("--keep") || !!variant; // 既存の候補を残したまま、手本なしで候補を追加する（声の案を指定したときも足す）
    if (!ref && !keep && designs[no] && !force) { console.log(`${no} ${kami.name}：候補作成済み（作り直すなら --force）`); continue; }
    try {
      console.log(`${no} ${kami.name}：声の候補を作成中…${variant ? `（声の案：${variant}）` : ""}`);
      const body = {
        voice_description: voiceDescription(kami, variant || (refFile && refFile.variant)),
        model_id: designModel,
        text: designText(kami),
      };
      if (refFile) {
        body.reference_audio_base64 = fs.readFileSync(path.join(previewDir, refFile.file)).toString("base64");
        const strength = argValue("--strength"); // 0〜1。大きいほど説明文を、小さいほど手本の声を優先
        if (strength) body.prompt_strength = Number(strength);
        console.log(`  （候補${ref}を手本にします）`);
      }
      const json = await call("/text-to-voice/design", body);
      const previews = json.previews || [];
      const kept = (refFile || keep) ? (designs[no] || []) : [];
      const start = kept.reduce((m, c) => Math.max(m, c.choice), 0);
      const added = previews.map((p, i) => {
        const n = start + i + 1;
        const file = `el-${no}-${n}.mp3`;
        fs.writeFileSync(path.join(previewDir, file), Buffer.from(p.audio_base_64, "base64"));
        return { choice: n, generated_voice_id: p.generated_voice_id, file, ref: refFile ? refFile.choice : undefined, variant: variant || (refFile && refFile.variant) || undefined };
      });
      designs[no] = kept.concat(added);
      writeJson(designsFile, designs);
      console.log(`  → 候補${added.map(c => c.choice).join("・")}を作成しました`);
    } catch (e) {
      console.error(`  × 失敗：${String(e.message || e).slice(0, 300)}`);
      failed.push(`${no} ${kami.name}`);
    }
  }
  if (failed.length) console.error(`候補を作れなかったカミ：${failed.join("、")}`);
  console.log(trial
    ? `試聴：http://localhost:8765/tools/voice-compare/?trial=${trial}　気に入った候補は pick --kami 番号 --choice 候補番号 --trial ${trial} で登録します。`
    : "試聴：http://localhost:8765/voices/preview.html　気に入った候補は pick --kami 番号 --choice 候補番号 で登録します。");
}

async function pick() {
  if (!onlyKami || !choice) { console.error("pick には --kami と --choice が必要です。"); process.exit(1); }
  const kami = script.kami[onlyKami];
  const cand = (readJson(designsFile, {})[onlyKami] || []).find(c => String(c.choice) === choice);
  if (!kami || !cand) { console.error("その候補が見つかりません。先に design を実行してください。"); process.exit(1); }
  const json = await call("/text-to-voice", {
    voice_name: `tsukuriyo-${onlyKami}-${kami.name}${trial ? "-" + trial : ""}`,
    voice_description: voiceDescription(kami, cand.variant).slice(0, 500), // 保存時の説明は500字まで（候補を作った声の案の説明）
    generated_voice_id: cand.generated_voice_id,
  });
  const ids = readJson(registerIdsFile, {});
  ids[onlyKami] = { id: json.voice_id, name: kami.name, choice: cand.choice, created: new Date().toISOString() };
  writeJson(registerIdsFile, ids);
  console.log(`${onlyKami} ${kami.name}：候補${cand.choice}を登録しました（${json.voice_id}）`);
}

// ElevenLabs の画面（ボイスデザインなど）で作った声を、声のIDで登録する（無料プランは API で声を作れないため）
function useVoice() {
  const voiceId = argValue("--voice-id");
  const kami = onlyKami && script.kami[onlyKami];
  if (!kami || !voiceId) { console.error("use には --kami と --voice-id が必要です。"); process.exit(1); }
  const ids = readJson(registerIdsFile, {});
  ids[onlyKami] = { id: voiceId, name: kami.name, choice: null, created: new Date().toISOString() };
  writeJson(registerIdsFile, ids);
  console.log(`${onlyKami} ${kami.name}：声 ${voiceId} を登録しました`);
}

// 画面のボイスデザインに貼る文（プロンプトと見本の文章）を表示する（無料プラン向け）
function uiText() {
  for (const no of kamiList()) {
    const kami = script.kami[no];
    console.log(`===== ${no} ${kami.name} =====
[プロンプト]
${kami.voice.el_description}

[見本の文章]
${designText(kami)}
`);
  }
}

async function lines() {
  // 試し作りで声を登録していればその声、なければゲームで使っている声で読ませる
  const ids = Object.assign({}, readJson(idsFile, {}), trialIdsFile ? readJson(trialIdsFile, {}) : {});
  const outRoot = trialDir || voiceDir;
  if (trial) console.log(`試し作り「${trial}」：モデル ${lineModel}、保存先 voices/trials/${trial}/`);
  const failed = [];
  let chars = 0;
  for (const no of kamiList()) {
    const kami = script.kami[no];
    if (!ids[no]) { console.warn(`${no} ${kami.name}：声が未登録です。先に design と pick を実行してください。`); continue; }
    // 試し作りで全カミを指定したときは、試し作り用の声を登録したカミだけ読ませる（古い声で無駄に作らない）
    if (trial && !onlyKami && !args.includes("--current-voice") && !readJson(trialIdsFile, {})[no]) { console.log(`${no} ${kami.name}：試し作り用の声が未登録のため飛ばします（今の声で作るなら --current-voice）`); continue; }
    // 新しい声の候補を作ったのに登録（pick）が済んでいないときは、今の声で作ることになるので知らせる
    if (trial && !readJson(trialIdsFile, {})[no] && (readJson(designsFile, {})[no] || []).length) {
      console.warn(`  ！ ${no} ${kami.name}：試し作り用の新しい声が登録されていないため、ゲームの今の声で作ります。`);
      console.warn(`    新しい声で作るなら、先に pick --kami ${no} --choice 候補番号 --trial ${trial} を成功させてください（「登録しました」と出れば成功）。`);
    }
    fs.mkdirSync(path.join(outRoot, no), { recursive: true });
    for (const [key, line] of Object.entries(kami.lines)) {
      if (onlyKeys && !onlyKeys.includes(key)) continue;
      const out = path.join(outRoot, no, `${key}.mp3`);
      if (fs.existsSync(out) && !force) continue;
      const text = lineText(key, line);
      console.log(`${no} ${kami.name} ${key}：${text}`);
      try {
        const stability = line.el_stability ?? kami.voice.el_stability ?? el.stability; // カミごとは voice.el_stability // 台詞ごとに el_stability で上書きできる（0＝Creative、0.5＝Natural）
        // v4 では話す速さ（speed）の調整がなくなったため、stability だけを渡す
        const voiceSettings = /^eleven_v4/.test(lineModel)
          ? { stability }
          : { stability, speed: line.el_speed ?? kami.voice.el_speed ?? 1 }; // 話す速さ（0.7〜1.2）。カミごと voice.el_speed、台詞ごと el_speed
        const audio = await call(`/text-to-speech/${ids[no].id}?output_format=mp3_44100_64`, {
          text,
          model_id: lineModel,
          language_code: el.language_code,
          voice_settings: voiceSettings,
        }, true);
        fs.writeFileSync(out, audio);
        // Gemini 版の WAV が残っていると manifest が迷うので消す（ゲームのボイスを作るときだけ）
        const oldWav = path.join(voiceDir, no, `${key}.wav`);
        if (!trial && fs.existsSync(oldWav)) fs.unlinkSync(oldWav);
        chars += text.length;
      } catch (e) {
        console.error(`  × 失敗：${String(e.message || e).slice(0, 300)}`);
        failed.push(`${no} ${kami.name} ${key}`);
      }
      await sleep(300);
    }
  }
  if (failed.length) console.error(`生成できなかった台詞：${failed.join("、")}`);
  if (chars) console.log(`今回読み上げた文字数：${chars}字（クレジットの目安）`);
  writeManifest();
}

// ゲームは manifest.json に載っている台詞だけ再生する（未生成の台詞で404を出さないため）
function writeManifest(forTrial = !!trial) {
  const baseDir = forTrial ? trialDir : voiceDir;
  const base = forTrial ? `voices/trials/${trial}` : "voices";
  const manifest = { version: 1, generatedAt: new Date().toISOString(), kami: {} };
  if (forTrial) Object.assign(manifest, { trial, model: lineModel }); // 聞き比べページに、どのモデルで作ったかを出す
  for (const no of Object.keys(script.kami)) {
    const dir = path.join(baseDir, no);
    if (!fs.existsSync(dir)) continue;
    const files = {};
    for (const f of fs.readdirSync(dir)) {
      const m = f.match(/^(\w+)\.(mp3|wav)$/);
      if (m && !(m[2] === "wav" && files[m[1]])) files[m[1]] = `${base}/${no}/${f}`;
    }
    if (Object.keys(files).length) manifest.kami[no] = files;
  }
  fs.mkdirSync(baseDir, { recursive: true });
  writeJson(path.join(baseDir, "manifest.json"), manifest);
  console.log(`${base}/manifest.json を更新しました（${Object.keys(manifest.kami).length}柱分）`);
  if (forTrial) console.log(`聞き比べ：http://localhost:8765/tools/voice-compare/?trial=${trial}`);
}

/* 採用：試し作りの音声をゲームのボイスにする。
   voices/trials/名前/{No}/*.mp3 を voices/{No}/ へ上書きし、ゲームの声の登録も試し作りの声に切り替える。
   ゲーム用の一覧（voices/manifest.json）と、本番で使う音声の識別子の一覧（asset_hashes.js）も作り直す */
function adopt() {
  if (!trial) { console.error("adopt には --trial が必要です（例：adopt --kami 3 --trial v4）。"); process.exit(1); }
  const trialIds = readJson(trialIdsFile, {});
  const ids = readJson(idsFile, {});
  const targets = kamiList().filter(no => fs.existsSync(path.join(trialDir, no)));
  let switched = 0; // 新しい声に切り替えたカミの数
  if (!targets.length) { console.error("採用できる試し作りの音声がありません。"); process.exit(1); }
  for (const no of targets) {
    const kami = script.kami[no];
    const files = fs.readdirSync(path.join(trialDir, no)).filter(f => /\.mp3$/.test(f));
    // 試し作りに無い台詞がゲームに残っていると、声が混ざるので知らせる
    const missing = Object.keys(kami.lines).filter(key => !files.includes(`${key}.mp3`));
    if (missing.length) console.warn(`  ${no} ${kami.name}：試し作りに無い台詞は前の音声のままです（${missing.join("、")}）`);
    fs.mkdirSync(path.join(voiceDir, no), { recursive: true });
    for (const f of files) fs.copyFileSync(path.join(trialDir, no, f), path.join(voiceDir, no, f));
    if (trialIds[no]) {
      switched++;
      const previous = ids[no] && ids[no].id;
      ids[no] = Object.assign({}, trialIds[no], { model: lineModel, adoptedFrom: trial, previousId: previous || undefined });
    }
    console.log(`${no} ${kami.name}：試し作り「${trial}」の音声${files.length}本をゲームのボイスにしました`);
  }
  writeJson(idsFile, ids);
  writeManifest(false);
  const { writeAssetHashes, OUTPUT } = require("./build_asset_hashes");
  writeAssetHashes(root);
  console.log(`${OUTPUT} を更新しました。確認用サーバーで聞いて問題なければ、コミットして本番へ。`);
  if (switched) console.log("前の声は使わなくなりました。声の枠が足りなければ voices-list で確認し、voice-delete --voice-id 前の声のID で消せます。");
}

(async () => {
  if (command === "design") await design();
  else if (command === "adopt") adopt();
  else if (command === "pick") await pick();
  else if (command === "use") useVoice();
  else if (command === "voices-list") await listVoices();
  else if (command === "voice-delete") await deleteVoice();
  else if (command === "ui-text") uiText();
  else if (command === "lines") await lines();
  else if (command === "manifest") writeManifest();
  else console.log(fs.readFileSync(__filename, "utf8").split("*/")[0]);
})().catch(e => { console.error(e.message || e); process.exit(1); });
