"use strict";
/*
  カードの使用時ボイス（召喚時・攻撃時・死亡時・使用時、因縁・仲間の掛け合い）を ElevenLabs で作る（ローカルで手動実行する開発用スクリプト）。
  カミのボイス（scripts/generate_voices_elevenlabs.js）と同じ流れで、話す人（キャスト）ごとに声を作る。

  台本：tools/voice-script/card_voice_script.json（カードごと）と card_voice_pairs.json（掛け合い）。
        正本はメンバー共有ページ。Claude が取り込んだものを使う。
  キャスト：tools/voice-script/card_voice_cast.json（cast コマンドで台本から作る。声の説明 el_description は手で直してよい）

  ElevenLabs の声の枠：カミの10声は残し、カード用の声は「作る → 台詞を録る → 消す」を繰り返す。
  Starter（枠10）は空きが無いので、Creator（枠30＝空き20、声の追加・編集は月95回）以上で使う。

  使い方（PowerShell）：
    $env:ELEVENLABS_API_KEY = "取得したAPIキー"          # キーはファイルに書かず、環境変数で渡す
    node scripts/generate_card_voices_elevenlabs.js cast                 # 1) 台本からキャスト一覧を作る（台本を取り込み直したら毎回）
    node scripts/generate_card_voices_elevenlabs.js status               #    進み具合（声の登録・台詞の作成・声の削除）を表示
    node scripts/generate_card_voices_elevenlabs.js design --cast ライカ   # 2) 声の候補を3つ作り、試聴用に保存
    node scripts/generate_card_voices_elevenlabs.js design --next 5      #    まだ声の無いキャストを5人分まとめて候補づくり
    node scripts/generate_card_voices_elevenlabs.js pick --cast ライカ --choice 2   # 3) 気に入った候補を声として登録
    （2〜3の代わりに）Voice Library の公開されている声を使う（声の枠を使わない）：
    node scripts/generate_card_voices_elevenlabs.js library --cast ライカ --gender female --age young --search 元気
                                                                         #    検索して試聴用の音声を voices/cards/library/ に保存（--page 1 で次の結果）
    node scripts/generate_card_voices_elevenlabs.js use --cast ライカ --library L3   #    検索結果の L3 をキャストの声として登録
    node scripts/generate_card_voices_elevenlabs.js lines --cast ライカ    # 4) そのキャストの台詞をすべて作る（作成済みは飛ばす。--force で作り直し）
    node scripts/generate_card_voices_elevenlabs.js lines --ref n051-summon --force  #    1本だけ作り直す
    node scripts/generate_card_voices_elevenlabs.js release --cast ライカ  # 5) 台詞を確認できたら、声を ElevenLabs から消して枠を空ける
    node scripts/generate_card_voices_elevenlabs.js bundle               # 6) 台本サイトで聴けるよう、音声を tools/voice-script/audio/ にまとめる
  試聴：確認用サーバー起動中に http://localhost:8765/voices/cards/previews/ のファイル、または台本サイト

  出力：
    voices/cards/{ref}.mp3            台詞の音声（ref は n051-summon、p03-line、p03-reply、複数人の台詞は n065-summon-1 のように番号付き）
    voices/cards/previews/            声の候補（試聴用。配信しない）
    voices/cards/voices.json          キャストごとの声の記録（候補・登録した声のID・削除日・使った説明文）
    tools/voice-script/audio/*.json   台本サイト用にまとめた音声（bundle で作る）
*/
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const args = process.argv.slice(2);
const command = args[0] || "help";
const argValue = name => { const i = args.indexOf(name); return i >= 0 ? String(args[i + 1]) : null; };
const force = args.includes("--force");

const root = path.resolve(__dirname, "..");
const scriptDir = path.join(root, "tools", "voice-script");
const outDir = path.join(root, "voices", "cards");
const previewDir = path.join(outDir, "previews");
const recordFile = path.join(outDir, "voices.json");
const castFile = path.join(scriptDir, "card_voice_cast.json");
const audioDir = path.join(scriptDir, "audio");
// 台詞ごとの読み替え・演技指定（試聴室で保存。{ "n051-summon": { text: "読み上げる文", direction: "演技の方針（日本語）", tags: "[confident]", stability: 0.4 } }）
const directionFile = path.join(scriptDir, "card_voice_direction.json");
// 読み方の辞書（試聴室で登録。{ "父上": "ちちうえ" }）。読み上げる直前に置き換える。台本の表示は変えない
const readingsFile = path.join(scriptDir, "card_voice_readings.json");
const takesDir = path.join(outDir, "takes");
// 演技の方針（日本語）→ 英語の演技タグ。v4 は日本語の文脈（previous_text）をほとんど反映しないので、タグにして台詞の頭に付ける
let directionMap = null;
function directionTags(direction) {
  if (!directionMap) directionMap = JSON.parse(fs.readFileSync(path.join(scriptDir, "direction_tags.json"), "utf8")).map || [];
  const tags = [];
  for (const [word, tag] of directionMap) if (direction.includes(word) && !tags.includes(tag)) tags.push(tag);
  return tags.slice(0, 3);
}
// 「‿」は「区切って読ませるが、間は空けない」しるし（読み方の辞書で使う。例：あまねの‿やしろ）。
// 読点として読ませると区切りの前後で言い方（アクセント）が安定するので、作ったあとにその間だけを ffmpeg で詰める
const TIE = "‿";
function tightenPauses(file, text) {
  if (!text.includes(TIE)) return;
  const body = text.replace(/\[[^\]]*\]/g, "").trim().replace(/[、。!?！？…‿\s]+$/u, "");
  const marks = [...body.matchAll(/[、。!?！？…‿]+/gu)].map(m => m[0].includes(TIE));
  const probe = spawnSync("ffmpeg", ["-hide_banner", "-i", file, "-af", "silencedetect=noise=-32dB:d=0.1", "-f", "null", "-"], { encoding: "utf8", windowsHide: true });
  if (probe.error) { console.warn("  （ffmpeg が無いため、区切りの間は詰めていません）"); return; }
  const log = probe.stderr || "";
  const dur = (() => { const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(log); return m ? m[1] * 3600 + m[2] * 60 + Number(m[3]) : 0; })();
  const starts = [...log.matchAll(/silence_start: ([\d.]+)/g)].map(m => Number(m[1]));
  const ends = [...log.matchAll(/silence_end: ([\d.]+)/g)].map(m => Number(m[1]));
  const inner = starts.map((st, i) => [st, ends[i]]).filter(([st, en]) => st > 0.02 && en !== undefined && en < dur - 0.02);
  if (inner.length !== marks.length) { console.warn(`  （間の数が合わないため、区切りの間は詰めていません：記号${marks.length}か所・無音${inner.length}か所）`); return; }
  const cuts = inner.filter((_, i) => marks[i]).map(([st, en]) => [st + 0.015, en - 0.015]).filter(([a, b]) => b - a > 0.02);
  if (!cuts.length) return;
  // 残す区間をつなぐ
  const keep = []; let pos = 0;
  for (const [a, b] of cuts) { keep.push([pos, a]); pos = b; }
  keep.push([pos, null]);
  const parts = keep.map(([a, b], i) => "[0:a]atrim=start=" + a + (b === null ? "" : ":end=" + b) + ",asetpts=PTS-STARTPTS" + (i > 0 ? ",afade=t=in:st=0:d=0.012" : "") + "[p" + i + "]");
  const filter = parts.join(";") + ";" + keep.map((_, i) => "[p" + i + "]").join("") + "concat=n=" + keep.length + ":v=0:a=1[o]";
  const tmp = file + ".tight.mp3";
  const run = spawnSync("ffmpeg", ["-v", "error", "-y", "-i", file, "-filter_complex", filter, "-map", "[o]", "-ac", "1", "-ar", "44100", "-b:a", "64k", tmp], { encoding: "utf8", windowsHide: true });
  if (run.status !== 0 || !fs.existsSync(tmp)) { console.warn("  （区切りの間を詰められませんでした）"); return; }
  fs.renameSync(tmp, file);
  console.log(`  区切りの間を詰めました（${cuts.length}か所）`);
}
function applyReadings(text, readings) {
  const words = Object.keys(readings).filter(Boolean).sort((a, b) => b.length - a.length);
  // 「天根ノ社（あまねのやしろ）」「還（もど）れ」のようにふりがなを添えた書き方は、ふりがなだけを読ませる（両方読まれないように）
  let out = String(text);
  // 辞書にある言葉にふりがなが添えてあるときは、辞書の読み方を優先する（イントネーションを直した書き方を使うため）
  for (const w of words) out = out.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "（[ぁ-ゖァ-ヺー]+）", "g"), w);
  out = out.replace(/[一-龠々〆ヶ][一-龠々〆ヶノの]*（([ぁ-ゖァ-ヺー]+)）/g, "$1");
  for (const w of words) out = out.split(w).join(readings[w]);
  return out;
}

const readJson = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; } };
const writeJson = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n"); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ElevenLabs の設定はカミのボイスと共通（voices/voice_script.json の elevenlabs）
const kamiScript = readJson(path.join(root, "voices", "voice_script.json"), {});
const el = kamiScript.elevenlabs || { model: "eleven_v4", design_model: "eleven_ttv_v3", language_code: "ja", stability: 0.5 };
const CARD_STABILITY = 0.4;
const KAMI_NAMES = { "スサノオ": "1", "ヤマトタケル": "2", "オオクニヌシ": "3", "タケミカヅチ": "4", "オモイカネ": "5", "アメノウズメ": "6", "ヒノカグツチ": "7", "アマテラス": "8", "ツクヨミ": "9", "ヤマタノオロチ": "10" };

/* ===== 台本 → 台詞の一覧 ===== */
const baseName = label => String(label || "").replace(/（[^）]*）/g, "").trim();
// 話す人の表記からキャスト（声の単位）を決める。時代の違う同名キャラは別の声にする
function castKey(label, cardId) {
  const name = baseName(label);
  if (KAMI_NAMES[name]) return "カミ:" + name;
  if (name === "ミナト" || name === "器") return cardId === "n076" ? "ミナト（子ども）" : "ミナト（大人）";
  if (name === "ソウリュウ") return cardId === "n026" ? "ソウリュウ（少年期）" : "ソウリュウ（30代）";
  if (name === "ヨルヒメ") return cardId === "n101" ? "ヨルヒメ（少女）" : "ヨルヒメ（大人）";
  if (name === "コマ") return cardId === "n065" ? "コマ（成獣）" : "コマ";
  if (name === "竜人" || name === "傲慢なる翼の竜人") return cardId === "n187" ? "竜人:n020" : "竜人:" + cardId;
  if (name === "大妖狐") return "若女将:n059"; // 千変万化の大妖狐は葛ノ葉亭の若女将と同じ声（ユーザー指定）
  if (name === "語り手") return "語り部:n053"; // オラクル・レリックの語りは、史を紡ぐ語り部が自分の著書を読む形（ユーザー指定）
  if (/^(乙女|代弁者|侍女|修羅|修道女|冒険者|刀剣商|勧誘人|名工|大妖狐|大得物の少女|妖将|始末屋|密偵|小鼠|座敷童|影法師|忍の王|探求者|旗手|武者|淑女|渡し守|無貌の忍|犬神|狂骨|狐姫|猫女|破戒僧|祈り手|童女|童|絡繰師|老忍|若女将|語り部|諜報員|豪族|陰陽師|隠者|雪少女|面霊姫|音速の忍|首領|騎士)$/.test(name)) return name + ":" + cardId;
  return name;
}
// 複数人の台詞を、話す人ごとに分ける。書き方は3種類：
//   ライカ「…」コマ「…」（順番に話す）／ライカ＆コマ「…」・2人同時に「…」・3人で「…」（全員で同時に）／末尾の（2人同時に）
// 名前の無い同時発声は、話す人の表記（アカマツ＋シラトリ）の全員にする
function splitSpeech(text, defaultLabel) {
  const raw = String(text || "").trim();
  if (!raw) return [];
  const labelNames = baseName(defaultLabel).split(/[＋＆]/).map(x => x.trim()).filter(Boolean);
  const allTogether = /（[^）]*同時[^）]*）/.test(raw);
  const clean = raw.replace(/（[^）]*同時[^）]*）/g, "").replace(/[`｀]/g, "").trim();
  const parts = [...clean.matchAll(/([^「」]*?)「([^」]*)」/g)];
  const segs = [];
  const add = (names, body, together) => names.forEach(n => segs.push({ speaker: n, text: body.trim(), together: together || names.length > 1 }));
  if (parts.length) {
    for (const m of parts) {
      const who = m[1].trim();
      if (!who || /人で|同時|全員/.test(who)) add(labelNames, m[2], true);
      else add(who.split(/[＆＋]/).map(x => x.trim()).filter(Boolean), m[2], allTogether);
    }
  } else {
    add(labelNames.length ? labelNames : [defaultLabel], clean, allTogether);
  }
  return segs.map(x => Object.assign(x, { own: labelNames.includes(baseName(x.speaker)) }));
}
// 話す人の名前だけの表記（返す人「ハゼ」など）を、どのカードの声かに結びつける
function cardForName(name, lines, hint) {
  if (hint) return hint;
  const n = baseName(name);
  const cands = Object.entries(lines).filter(([, l]) => l.kind === "legacy" && baseName(l.speaker) === n);
  return cands.length ? cands[cands.length - 1][0] : null; // 同名が複数あれば No. の大きい方（成長後）
}
function collectLines() {
  const lines = readJson(path.join(scriptDir, "card_voice_script.json"), { lines: {} }).lines;
  const pairs = readJson(path.join(scriptDir, "card_voice_pairs.json"), { pairs: {} }).pairs;
  const items = [];
  // 試聴室で台詞を書き換えたもの（card_voice_direction.json の「台詞ID-欄」に script）。名前「…」で複数人に分けられる
  const directions = readJson(directionFile, {});
  const push = (ref, label, text, cardId, meta) => {
    const override = (directions[ref] || {}).script;
    const script = override || text;
    const segs = splitSpeech(script, label);
    segs.forEach((seg, i) => {
      // 話す人の表記に含まれる名前ならそのカードの声（ライカ＆コマのコマは成獣の声）、それ以外は名前からカードを探す
      const sCard = seg.own ? cardId : cardForName(seg.speaker, lines);
      // 1人で話す台詞は話す人の表記のまま（名前の無い脇役を見分けるため）。複数人の表記なら分けた名前を使う
      const name = segs.length === 1 && seg.own && !/[＋＆]/.test(label) ? label : seg.speaker;
      items.push({ ref: segs.length > 1 ? `${ref}-${i + 1}` : ref, group: ref, cast: castKey(name, sCard), cardId: sCard || cardId, text: seg.text, together: seg.together, speaker: seg.speaker, parts: segs.length, script, overridden: !!override, ...meta });
    });
  };
  for (const [id, l] of Object.entries(lines)) {
    if (l.kind === "sfx") continue;
    const meta = { card: l.card, section: l.section, note: l.note || "", reading: l.reading || "" };
    if (l.kind === "legacy") for (const f of ["summon", "attack", "death"]) { if (l[f]) push(`${id}-${f}`, l.speaker, l[f], id, meta); }
    else if (l.use) push(`${id}-use`, l.speaker, l.use, id, meta);
  }
  for (const [id, p] of Object.entries(pairs)) {
    const meta = { card: p.whoCard, section: p.kind === "rival" ? "因縁" : "仲間", note: p.note || "", reading: p.reading || "" };
    if (p.line) push(`${id}-line`, p.whoSpeaker, p.line, p.who, meta);
    if (p.reply && p.replyBy) {
      const hint = /誓いの戦姫/.test(p.replyBy) ? "n107" : null;
      const card = cardForName(p.replyBy, lines, hint);
      push(`${id}-reply`, p.replyBy, p.reply, card, meta);
    }
  }
  return { lines, items };
}

/* ===== キャスト ===== */
// 話す人の表記（性別・印象）から、ボイスデザイン用の英語の説明の下書きを作る。気になる人は card_voice_cast.json で直す
// ElevenLabs は未成年の年齢指定や幼さを強調した声づくりを安全上の理由で断るため、少女・少年・子どもの役も
// 「20代前半の大人の、明るく高めの声」として説明し、年齢・未成年を表す言葉は説明に入れない（回避はしない）
const MINOR_WORDS = /少女|少年|子ども|子供|幼|童|歳|ロリ|ショタ|キッズ|小学|中学|高校/g;
function draftDescription(cast, labels, notes) {
  const all = labels.join(' ') + ' ' + notes.join(' ');
  const has = re => re.test(all);
  const female = has(/女性|少女|女|姫|乙女|淑女|侍女|修道女|若女将|母/) && !has(/男性|少年|青年/);
  const male = !female && has(/男性|少年|青年|老人|壮年/);
  const youthful = has(/少女|少年|子ども|子供|童|幼/);
  let who;
  if (youthful) who = female ? 'a Japanese young woman in her early twenties with a bright, light, high-pitched voice' : male ? 'a Japanese young man in his early twenties with a clear, light, youthful-sounding voice' : 'a Japanese young adult in their early twenties with a bright, light voice';
  else if (has(/30代/)) who = female ? 'a Japanese woman in her thirties' : 'a Japanese man in his thirties';
  else if (has(/壮年/)) who = female ? 'a Japanese woman in her forties' : 'a Japanese man in his forties';
  else if (has(/老人/)) who = 'an elderly Japanese man';
  else if (has(/青年/)) who = 'a Japanese man in his twenties';
  else who = female ? 'a Japanese woman in her twenties' : male ? 'a Japanese man in his twenties' : 'a Japanese adult';
  // 説明に入れる特徴：未成年・年齢を表す言葉を含む部分はフレーズごと外す
  const MINOR = new RegExp(MINOR_WORDS.source + "|\d+\s*(くらい|代前半|代後半)?$");
  const phrases = labels.concat(notes).flatMap(x => String(x || "").split(/[／・、（）()s]+/)).map(x => x.trim()).filter(x => x && !MINOR.test(x));
  const traits = [...new Set(phrases)].join("・");
  return `Japanese voice. Native Japanese speaker who speaks only Japanese, with natural standard Japanese pronunciation. Adult voice. ${who}, a character from a Japanese mythological fantasy card game. Natural yet expressive acting, like a Japanese anime voice actor. Character notes (Japanese): ${traits}`.slice(0, 1000);
}
function buildCast() {
  const { items } = collectLines();
  const old = readJson(castFile, { cast: {} }).cast;
  const cast = {};
  for (const it of items) {
    if (!cast[it.cast]) cast[it.cast] = { labels: [], notes: [], refs: [] };
    cast[it.cast].refs.push(it.ref);
    if (it.group.startsWith("n")) cast[it.cast].notes.push(it.note);
  }
  // 話す人の表記を集める（説明の下書き用）
  const { lines } = collectLines();
  for (const [id, l] of Object.entries(lines)) { const k = castKey(l.speaker, id); if (cast[k]) cast[k].labels.push(l.speaker); }
  const out = {};
  for (const [key, c] of Object.entries(cast).sort()) {
    const kami = key.startsWith("カミ:");
    out[key] = {
      kami: kami ? KAMI_NAMES[key.slice(3)] : undefined,
      labels: [...new Set(c.labels)],
      lines: c.refs.length,
      // 手で直した説明は残す（下書きから作り直すときだけ --reset-descriptions）
      el_description: kami ? undefined : ((!args.includes('--reset-descriptions') && old[key] && old[key].el_description) || draftDescription(key, c.labels.length ? c.labels : [key], c.notes)),
      previous_descriptions: old[key] && old[key].previous_descriptions,
      tts: old[key] && old[key].tts,
      voice_spec: old[key] && old[key].voice_spec,
      design_text: old[key] && old[key].design_text,
    };
  }
  writeJson(castFile, { _readme: "カードボイスのキャスト（話す人ごとの声）。el_description は ElevenLabs のボイスデザインに渡す説明。直してよい（cast を実行し直しても残る）。カミはカミのボイスの声を使う。", cast: out });
  const voices = Object.values(out).filter(c => !c.kami).length;
  console.log(`キャスト ${Object.keys(out).length}人（新しく声を作る人 ${voices}人、カミの声を使う ${Object.keys(out).length - voices}人）、台詞 ${items.length}本`);
  console.log(`→ ${path.relative(root, castFile)}`);
  // 試聴室（tools/voice-preview）が台詞をキャストごとに並べるための一覧
  const linesFile = path.join(scriptDir, "card_voice_lines.json");
  writeJson(linesFile, { _readme: "cast を実行すると作り直される一覧（手で直さない）。台詞ID・話す人・読み上げる文。", items: items.map(({ ref, group, cast, cardId, text, together, card, section, speaker, parts, script, overridden }) => ({ ref, group, cast, cardId, text, together: together || undefined, card, section, speaker: parts > 1 ? speaker : undefined, parts: parts > 1 ? parts : undefined, script: parts > 1 || overridden ? script : undefined, overridden: overridden || undefined })) });
  console.log(`→ ${path.relative(root, linesFile)}`);
}

/* ===== ElevenLabs ===== */
const API = "https://api.elevenlabs.io/v1";
function apiKey() {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) { console.error("環境変数 ELEVENLABS_API_KEY が設定されていません。"); process.exit(1); }
  return key;
}
async function call(pathname, body, binary = false) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    let res;
    try {
      res = await fetch(API + pathname, { method: "POST", headers: { "Content-Type": "application/json", "xi-api-key": apiKey() }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) });
    } catch (e) {
      if (attempt < 5) { console.warn(`  通信が止まったため、やり直します（${attempt}回目）`); await sleep(2000); continue; }
      throw e;
    }
    if (res.ok) return binary ? Buffer.from(await res.arrayBuffer()) : res.json();
    const text = await res.text();
    if ((res.status === 429 || res.status >= 500) && attempt < 5) { await sleep(3000 * attempt); continue; }
    throw new Error(`API ${res.status}: ${text.slice(0, 500)}`);
  }
}
async function request(method, pathname) {
  const res = await fetch(API + pathname, { method, headers: { "xi-api-key": apiKey() }, signal: AbortSignal.timeout(60000) });
  const text = await res.text();
  if (!res.ok) throw new Error(`API ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
}

const castArg = () => argValue("--cast");
function loadCast() {
  const c = readJson(castFile, null);
  if (!c) { console.error("先に cast を実行してください。"); process.exit(1); }
  return c.cast;
}
// 読み上げる文：全角「？」は語尾が上がりにくいので半角にする。「……」はそのまま（間になる）
const speechText = text => String(text).replace(/？/g, "?").replace(/！/g, "!");
function designSample(key) {
  // 試聴室で見本の文（design_text）を決めていればそれを使う（明るく弾む文だと高い声になりやすい）
  const custom = (loadCast()[key] || {}).design_text;
  if (custom) { let t = custom; while (t.length < 100) t += "　" + custom; return t.slice(0, 1000); }
  const { items } = collectLines();
  // 声を作るときの見本の文。死亡時（弱々しい台詞）が混ざると声全体が弱く暗くなるので、元気な台詞を先に使い、死亡時しか無いキャラだけ死亡時を使う
  const mine = items.filter(i => i.cast === key);
  const isDeath = i => /-death$/.test(i.group);
  const lively = mine.filter(i => !isDeath(i)).map(i => speechText(i.text));
  const parts = lively.length ? lively : mine.map(i => speechText(i.text)); // 足りない分は下で元気な台詞をくり返して100字にする
  let text = parts.join("　");
  while (text.length < 100) text += "　" + (parts.join("　") || "よろしくお願いします。");
  return text.slice(0, 1000);
}

async function design() {
  const cast = loadCast();
  const record = readJson(recordFile, {});
  let targets = [];
  if (castArg()) targets = [castArg()];
  else if (argValue("--next")) targets = Object.keys(cast).filter(k => !cast[k].kami && !(record[k] && (record[k].voiceId || record[k].released))).slice(0, Number(argValue("--next")));
  else { console.error("design には --cast 名前 か --next 人数 が必要です。"); process.exit(1); }
  fs.mkdirSync(previewDir, { recursive: true });
  for (const key of targets) {
    const c = cast[key];
    if (!c) { console.error(`キャスト「${key}」がありません（status で一覧を確認してください）`); continue; }
    if (c.kami) { console.log(`${key}：カミの声を使うので、声は作りません`); continue; }
    const r = record[key] || {};
    if (r.candidates && r.candidates.length && !force && !args.includes("--keep")) { console.log(`${key}：候補作成済み（作り直すなら --force、追加するなら --keep）`); continue; }
    try {
      console.log(`${key}：声の候補を作成中…`);
      const json = await call("/text-to-voice/design", { voice_description: c.el_description, model_id: el.design_model, text: designSample(key) });
      const kept = args.includes("--keep") ? (r.candidates || []) : [];
      const start = kept.reduce((m, x) => Math.max(m, x.choice), 0);
      const safe = key.replace(/[\\/:*?"<>|]/g, "_");
      const added = (json.previews || []).map((p, i) => {
        const file = `${safe}-${start + i + 1}.mp3`;
        fs.writeFileSync(path.join(previewDir, file), Buffer.from(p.audio_base_64, "base64"));
        return { choice: start + i + 1, generated_voice_id: p.generated_voice_id, file, description: c.el_description, created: new Date().toISOString() };
      });
      record[key] = Object.assign(r, { candidates: kept.concat(added), description: c.el_description });
      writeJson(recordFile, record);
      console.log(`  → 候補${added.map(x => x.choice).join("・")}：voices/cards/previews/${safe}-番号.mp3`);
    } catch (e) { console.error(`  × 失敗：${String(e.message || e).slice(0, 300)}`); }
  }
  console.log("気に入った候補を pick --cast 名前 --choice 番号 で登録してください。");
}

async function pick() {
  const key = castArg(), choice = argValue("--choice");
  const record = readJson(recordFile, {});
  const r = record[key];
  const cand = r && (r.candidates || []).find(x => String(x.choice) === choice);
  if (!cand) { console.error("その候補が見つかりません。先に design を実行してください。"); process.exitCode = 1; return; }
  const previous = r.voiceId && !r.released ? r.voiceId : null;
  let voiceId;
  try {
    const json = await call("/text-to-voice", { voice_name: `tsukuriyo-card-${key}`.slice(0, 100), voice_description: (cand.description || r.description || "").slice(0, 500), generated_voice_id: cand.generated_voice_id });
    voiceId = json.voice_id;
  } catch (e) {
    // 同じ候補をもう一度登録しようとしたとき（ElevenLabs では候補のIDがそのまま声のIDになる）は、登録済みとして続ける
    if (!/already been created/.test(String(e.message))) throw e;
    // 一度登録して ElevenLabs から外した候補は、もう使えない
    if (r.released || (r.previousVoiceIds || []).includes(cand.generated_voice_id)) throw new Error(`${key}：候補${cand.choice}は一度登録して ElevenLabs から削除した声なので、もう使えません。候補を新しく作ってください`);
    voiceId = cand.generated_voice_id;
    console.log(`${key}：候補${cand.choice}はもう登録されています（${voiceId}）`);
  }
  Object.assign(r, { voiceId, choice: cand.choice, registered: new Date().toISOString(), released: undefined });
  writeJson(recordFile, record);
  console.log(`${key}：候補${cand.choice}を登録しました（${voiceId}）`);
  // 別の候補で登録し直したときは、前の声を ElevenLabs から消して枠を空ける
  if (previous && previous !== voiceId) {
    try { await request("DELETE", `/voices/${previous}`); console.log(`  前の声（${previous}）は ElevenLabs から削除しました`); }
    catch (e) { console.warn(`  前の声（${previous}）を削除できませんでした：${String(e.message || e).slice(0, 200)}`); }
    r.previousVoiceIds = [...(r.previousVoiceIds || []), previous];
    writeJson(recordFile, record);
  }
}

async function lines() {
  const cast = loadCast();
  const record = readJson(recordFile, {});
  const kamiIds = readJson(path.join(root, "voices", "elevenlabs_voice_ids.json"), {});
  const directions = readJson(directionFile, {});
  const readings = readJson(readingsFile, {});
  const { items } = collectLines();
  const onlyRef = argValue("--ref");
  // --word 父上：その言葉を含む台詞だけ（読み方の辞書を直したあと、まとめて作り直す）
  const word = argValue("--word");
  // --takes 3：同じ台詞を何通りか作り、voices/cards/takes/台詞ID-番号.mp3 に置く（試聴室で聴き比べて選ぶ）
  const takes = Math.min(5, Math.max(0, parseInt(argValue("--takes") || "0", 10) || 0));
  const spoken = it => (directions[it.ref] || {}).text || it.text;
  const targets = items.filter(i => word ? spoken(i).includes(word) : onlyRef ? (i.ref === onlyRef || i.group === onlyRef) : i.cast === castArg());
  if (!targets.length) { console.error(word ? `「${word}」を含む台詞はありません` : "lines には --cast 名前 か --ref 台詞ID が必要です。"); process.exitCode = 1; return; }
  if (takes && !onlyRef) { console.error("--takes は --ref と一緒に使ってください"); process.exitCode = 1; return; }
  fs.mkdirSync(outDir, { recursive: true });
  if (takes) fs.mkdirSync(takesDir, { recursive: true });
  let chars = 0; const failed = [];
  for (const it of targets) {
    const out = path.join(outDir, `${it.ref}.mp3`);
    if (!takes && fs.existsSync(out) && !force) continue;
    const c = cast[it.cast] || {};
    const voiceId = c.kami ? (kamiIds[c.kami] && kamiIds[c.kami].id) : (record[it.cast] && record[it.cast].voiceId);
    if (!voiceId) { console.warn(`${it.ref}：${it.cast} の声が未登録です（design → pick を先に）`); failed.push(it.ref); continue; }
    if (record[it.cast] && record[it.cast].released) { console.warn(`${it.ref}：${it.cast} の声は削除済みのため作れません`); failed.push(it.ref); continue; }
    // 台詞ごとの読み上げ文の上書き（card_voice_cast.json の tts に { "n051-summon": "…" } と書く）
    const dir = directions[it.ref] || {};
    // 英語の演技タグ（手で書いたもの＋方針から作ったもの、合わせて3つまで）
    const tagList = [...new Set([...((dir.tags || "").match(/\[[^\]]+\]/g) || []), ...directionTags(dir.direction || "").map(t => "[" + t + "]")])].slice(0, 3);
    const text = (tagList.length ? tagList.join(" ") + " " : "") + speechText(applyReadings(dir.text || (c.tts && c.tts[it.ref]) || it.text, readings));
    // カードボイスの標準の安定度は 0.4（0.5 以上は平板・棒読みになりやすいため。1 は使わない）
    const stability = Math.min(0.5, Number.isFinite(dir.stability) ? dir.stability : CARD_STABILITY);
    console.log(`${it.ref}（${it.cast}）：${text}${stability !== CARD_STABILITY ? `（安定度${stability}）` : ""}`);
    try {
      const body = { text: text.split(TIE).join("、"), model_id: el.model, language_code: el.language_code, voice_settings: { stability } };
      // 演技の方針（日本語の自由記述）は「台詞の直前の文脈」として渡す。読み上げられず、言い方だけに効く
      const direction = (dir.direction || "").trim();
      if (direction) { body.previous_text = direction.replace(/[。．.]?$/, "。"); console.log(`  演技の方針：${direction}`); }
      const speak = async () => {
        try { return await call(`/text-to-speech/${voiceId}?output_format=mp3_44100_64`, body, true); }
        catch (e) {
          // モデルが文脈の指定に対応していないときは、方針を演技タグとして台詞の頭に付けて作り直す
          if (!direction || !/previous_text|not supported|unsupported/i.test(String(e.message))) throw e;
          console.warn("  このモデルは文脈の指定に対応していないため、方針を [ ] の演技指定として付けて作ります。方針が読み上げられていないか聴いて確認してください");
          delete body.previous_text; body.text = `[${direction}] ` + text.split(TIE).join("、");
          return call(`/text-to-speech/${voiceId}?output_format=mp3_44100_64`, body, true);
        }
      };
      if (takes) {
        // 言い方の候補：毎回ちがう seed で作る
        for (const old of fs.readdirSync(takesDir)) if (old.startsWith(it.ref + "-") && /^\d+\.mp3$/.test(old.slice(it.ref.length + 1))) fs.unlinkSync(path.join(takesDir, old));
        for (let k = 1; k <= takes; k++) {
          body.seed = Math.floor(Math.random() * 4294967295);
          const takeFile = path.join(takesDir, `${it.ref}-${k}.mp3`);
          fs.writeFileSync(takeFile, await speak());
          tightenPauses(takeFile, text);
          chars += text.length;
          console.log(`  → 言い方の候補${k}`);
        }
      } else {
        fs.writeFileSync(out, await speak());
        tightenPauses(out, text);
        chars += text.length;
      }
    } catch (e) { console.error(`  × 失敗：${String(e.message || e).slice(0, 300)}`); failed.push(it.ref); }
    await sleep(300);
  }
  if (failed.length) console.error(`作れなかった台詞：${failed.join("、")}`);
  if (chars) console.log(`今回読み上げた文字数：${chars}字`);
}

/* ===== Voice Library（公開されている声）から選ぶ =====
   ElevenLabs の審査を通って公開されている声を使う。自分の声の枠は消費しない。
   声ごとに使用条件（notice_period＝公開終了の予告期間など）があるので、一覧の表示を確認して選ぶ */
const libraryDir = path.join(outDir, "library");
const libraryLast = path.join(libraryDir, "last.json");
async function library() {
  const params = new URLSearchParams({ page_size: argValue("--size") || "15", language: argValue("--language") || "ja", sort: argValue("--sort") || "cloned_by_count" });
  for (const k of ["gender", "age", "accent", "search", "page"]) { const v = argValue("--" + k); if (v) params.set(k, v); }
  const json = await request("GET", "/shared-voices?" + params.toString());
  const voices = json.voices || [];
  const label = (castArg() || "search").replace(/[\\/:*?"<>|]/g, "_");
  fs.mkdirSync(libraryDir, { recursive: true });
  const list = [];
  console.log(`検索：${params.toString()}　（${json.total_count ?? voices.length}件中 ${voices.length}件）`);
  for (const [i, v] of voices.entries()) {
    const n = i + 1;
    let file = "";
    if (v.preview_url) {
      try {
        const res = await fetch(v.preview_url, { signal: AbortSignal.timeout(60000) });
        if (res.ok) { file = `${label}-L${n}.mp3`; fs.writeFileSync(path.join(libraryDir, file), Buffer.from(await res.arrayBuffer())); }
      } catch { /* 試聴が取れなくても一覧は出す */ }
    }
    list.push({ n, name: v.name, public_owner_id: v.public_owner_id, voice_id: v.voice_id, gender: v.gender, age: v.age, accent: v.accent, descriptive: v.descriptive, use_case: v.use_case, notice_period: v.notice_period, free_users_allowed: v.free_users_allowed, cloned_by_count: v.cloned_by_count, description: v.description, file });
    console.log(`L${n}. ${v.name}（${[v.gender, v.age, v.accent, v.descriptive, v.use_case].filter(Boolean).join("・")}）利用${v.cloned_by_count}人${v.notice_period ? `・公開終了の予告${v.notice_period}日` : ""}`);
    if (v.description) console.log(`    ${String(v.description).replace(/\s+/g, " ").slice(0, 120)}`);
    if (file) console.log(`    試聴：voices/cards/library/${file}`);
  }
  writeJson(libraryLast, { cast: castArg() || null, searchedAt: new Date().toISOString(), voices: list });
  console.log(`\n気に入った声は use --cast 名前 --library L番号 で登録します（次の検索は --page 1 など）。`);
}

async function use() {
  const key = castArg();
  const cast = loadCast();
  if (!key || !cast[key] || cast[key].kami) { console.error("use には、カミ以外のキャスト名を --cast で指定してください。"); process.exit(1); }
  const pickNo = String(argValue("--library") || "").replace(/^L/i, "");
  const hit = (readJson(libraryLast, { voices: [] }).voices || []).find(v => String(v.n) === pickNo);
  if (!hit) { console.error("その番号の声が見つかりません。先に library で検索してください（--library L番号）。"); process.exit(1); }
  const json = await call(`/voices/add/${hit.public_owner_id}/${hit.voice_id}`, { new_name: `tsukuriyo-card-${key}`.slice(0, 100) });
  const record = readJson(recordFile, {});
  record[key] = Object.assign(record[key] || {}, { voiceId: json.voice_id, source: "library", library: { name: hit.name, public_owner_id: hit.public_owner_id, voice_id: hit.voice_id, notice_period: hit.notice_period }, registered: new Date().toISOString(), released: undefined });
  writeJson(recordFile, record);
  console.log(`${key}：Voice Library の「${hit.name}」を登録しました（${json.voice_id}）。声の枠は使いません。`);
}

async function release() {
  const key = castArg();
  const record = readJson(recordFile, {});
  const r = record[key];
  if (!r || !r.voiceId) { console.error(`${key}：登録された声がありません`); process.exit(1); }
  const { items } = collectLines();
  const missing = items.filter(i => i.cast === key && !fs.existsSync(path.join(outDir, `${i.ref}.mp3`)));
  if (missing.length && !force) { console.error(`${key}：まだ作っていない台詞があります（${missing.map(i => i.ref).join("、")}）。それでも消すなら --force`); process.exit(1); }
  await request("DELETE", `/voices/${r.voiceId}`);
  Object.assign(r, { released: new Date().toISOString() });
  writeJson(recordFile, record);
  console.log(`${key}：声を ElevenLabs から削除しました（作った音声はそのまま使えます。この声で作り直すことはできなくなります）`);
}

function status() {
  const cast = loadCast();
  const record = readJson(recordFile, {});
  const { items } = collectLines();
  let done = 0;
  for (const [key, c] of Object.entries(cast)) {
    const mine = items.filter(i => i.cast === key);
    const made = mine.filter(i => fs.existsSync(path.join(outDir, `${i.ref}.mp3`))).length;
    done += made;
    const r = record[key] || {};
    const state = c.kami ? "カミの声" : r.released ? "声削除済み" : r.voiceId ? (r.source === "library" ? "ライブラリの声" : "声登録済み") : (r.candidates && r.candidates.length) ? `候補${r.candidates.length}個` : "未着手";
    console.log(`${key.padEnd(20)} ${state.padEnd(8)} 台詞 ${made}/${mine.length}`);
  }
  const live = Object.values(record).filter(r => r.voiceId && !r.released).length;
  console.log(`\n台詞 ${done}/${items.length}本 作成済み。ElevenLabs に残っているカード用の声：${live}個（Creator の空き枠は20）`);
}

// 台本サイト（メンバー共有ページ）で聴けるよう、作った音声をまとめる。グループごとに1ファイル（base64）
function bundle() {
  const { items } = collectLines();
  const groups = {};
  for (const it of items) {
    const file = path.join(outDir, `${it.ref}.mp3`);
    if (!fs.existsSync(file)) continue;
    const g = it.group.startsWith("p") ? "pairs" : "lines-" + (it.section || "other");
    (groups[g] = groups[g] || {})[it.ref] = { together: it.together, data: fs.readFileSync(file).toString("base64") };
  }
  fs.mkdirSync(audioDir, { recursive: true });
  const index = {};
  let i = 0;
  for (const [g, refs] of Object.entries(groups)) {
    const file = `a${String(++i).padStart(2, "0")}.json`; // 公開時のファイル名は英数字にする
    writeJson(path.join(audioDir, file), refs);
    for (const ref of Object.keys(refs)) index[ref] = file;
    console.log(`${file}（${g}）：${Object.keys(refs).length}本、${Math.round(fs.statSync(path.join(audioDir, file)).size / 1024)}KB`);
  }
  writeJson(path.join(audioDir, "index.json"), { updated: new Date().toISOString(), refs: index });
  console.log(`index.json：${Object.keys(index).length}本。台本サイトに載せるには、Claude に「音声を台本サイトに反映して」と伝えてください。`);
}

const commands = { cast: buildCast, status, design, pick, library, use, lines, release, bundle };
if (!commands[command]) {
  console.log("使い方はファイル先頭のコメントを見てください（cast / status / design / pick / library / use / lines / release / bundle）。");
} else {
  Promise.resolve(commands[command]()).catch(e => { console.error(String(e.message || e)); process.exitCode = 1; });
}
