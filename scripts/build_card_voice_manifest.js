"use strict";
/* 外部APIを呼ばない。作成・採用済みの直下MP3と台本だけからゲーム用一覧を作る。 */
const fs = require('node:fs');
const path = require('node:path');
const { writeAssetHashes } = require('./build_asset_hashes');
function readJson(file, fallback) { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback; }
/* 2人が同時に同じ台詞を言うグループ（tools/voice-script/card_voice_together.json に台詞グループIDを並べる）。
   話者ごとの音声を重ねた1本（グループID-together.mp3）を作り、ゲームではその1本だけを鳴らす。
   元の音声のほうが新しければ作り直す。ffmpeg が無いときは、すでにある重ねた音声をそのまま使う */
function togetherGroups(root) {
  const list = readJson(path.join(root, 'tools', 'voice-script', 'card_voice_together.json'), []);
  return new Set(Array.isArray(list) ? list.filter(g => /^(?:n\d{3}-(?:summon|attack|death|use)|p\d+-(?:line|reply))$/.test(g)) : []);
}
const partNo = item => Number((/-(\d+)$/.exec(item.ref) || [0, 0])[1]);
const groupOf = item => item.group || item.ref.replace(/-\d+$/, '');
/* 台詞のまとまり（グループ）を話す順に並べ、「同時に言う」部分をひとまとめにする。
   台詞の一覧（card_voice_lines.json）で together の印が付いた部分が2つ以上続くところを、同時に言う1つのまとまりにする
   （例：ライカ「恐怖は」→ コマ「二人で」→ 2人同時に「乗り越える！」）。card_voice_together.json に書いたグループは全体を同時にする */
function togetherRuns(parts, wholeGroup) {
  const runs = [];
  for (const it of parts) {
    const t = wholeGroup || !!it.together;
    const last = runs[runs.length - 1];
    if (t && last && last.together) last.items.push(it); else runs.push({ items: [it], together: t });
  }
  for (const run of runs) if (run.items.length < 2) run.together = false;
  return runs;
}
// 重ねた音声のファイル名：グループ全体を重ねたら グループID-together.mp3、一部だけなら グループID-together-最初の番号.mp3
const togetherSrc = (group, run, runs) => 'voices/cards/' + group + '-together' + (runs.length === 1 ? '' : '-' + partNo(run.items[0])) + '.mp3';
function groupedParts(lines) {
  const map = new Map();
  for (const item of lines) { const g = groupOf(item); if (!map.has(g)) map.set(g, []); map.get(g).push(item); }
  for (const list of map.values()) list.sort((a, b) => partNo(a) - partNo(b));
  return map;
}
function mixTogether(root) {
  const lines = readJson(path.join(root, 'tools', 'voice-script', 'card_voice_lines.json'), { items: [] }).items;
  const listed = togetherGroups(root);
  for (const [group, items] of groupedParts(lines)) {
    if (items.length < 2) continue;
    const runs = togetherRuns(items, listed.has(group));
    for (const run of runs) {
      if (!run.together) continue;
      const parts = run.items.map(i => path.join(root, 'voices', 'cards', i.ref + '.mp3'));
      const out = path.join(root, togetherSrc(group, run, runs));
      if (!parts.every(p => fs.existsSync(p))) continue;
      if (fs.existsSync(out) && parts.every(p => fs.statSync(p).mtimeMs <= fs.statSync(out).mtimeMs)) continue;
      const args = ['-v', 'error', '-y'];
      for (const p of parts) args.push('-i', p);
      // 重ねても音が割れないよう、人数に合わせて少し下げてから足し、最後に上限をかける
      args.push('-filter_complex', parts.map((_, i) => `[${i}:a]volume=${(1 / Math.sqrt(parts.length)).toFixed(3)}[a${i}]`).join(';') + ';'
        + parts.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${parts.length}:duration=longest:normalize=0,alimiter=limit=0.9[o]`,
        '-map', '[o]', '-ac', '1', '-ar', '44100', '-b:a', '128k', out);
      const result = require('node:child_process').spawnSync('ffmpeg', args, { encoding: 'utf8', windowsHide: true });
      if (result.error || result.status !== 0) console.warn(`${group}：同時再生用の音声を作れませんでした（ffmpeg が必要です）`);
      else console.log(`${path.basename(out)}：${parts.length}人の音声を重ねました`);
    }
  }
}
/* 画面に出す台詞の文字。試聴室の「台詞を変える」で言い換えた台詞は、実際に読ませた文（card_voice_direction.json の text）に合わせる。
   読み方の指定「漢字（よみ）」のよみ、つなげて読む印、見えない区切り文字は表示から除く。全体がカッコ書き（効果音など）の台詞は台本のまま */
// 読み方を合わせるために言い換えた書き方（左）は、台本がもとの書き方（右）なら表示では戻す
const SPOKEN_SPELLINGS = [['チチウエ', '父上'], ['アニウエ', '兄上'], ['里', '郷']];
function displayText(scriptText, spoken) {
  const base = String(scriptText || '');
  if (!spoken || /^[（(].*[）)]$/.test(String(spoken).trim())) return base;
  let text = String(spoken).replace(/[\u200B-\u200D\uFEFF\u203F]/g, '')
    .replace(/([\u3005\u4E00-\u9FFF])[（(][\u3041-\u3096\u30A1-\u30FA\u30FC]+[）)]/g, '$1').trim();
  for (const [said, written] of SPOKEN_SPELLINGS) if (base.includes(written)) text = text.split(said).join(written);
  return text || base;
}
function buildCardVoiceManifest(root) {
  const dir = path.join(root, 'tools', 'voice-script');
  const script = readJson(path.join(dir, 'card_voice_script.json'), { lines: {} });
  const lines = readJson(path.join(dir, 'card_voice_lines.json'), { items: [] }).items;
  const pairs = readJson(path.join(dir, 'card_voice_pairs.json'), { pairs: {} }).pairs;
  const manifest = { schemaVersion: 1, cards: {}, pairs: [] }, missing = [], registered = [];
  const numbers = id => String(script.lines[id] && script.lines[id].nos || Number(id.replace(/^n/, '')))
    .split(/[,、\s]+/).filter(n => /^\d+$/.test(n) && Number(n) > 0).map(n => String(Number(n)));
  const clipOf = new Map(), together = togetherGroups(root), partsOf = groupedParts(lines);
  const direction = readJson(path.join(dir, 'card_voice_direction.json'), {});
  for (const item of lines) {
    if (!/^(?:n\d{3}-(?:summon|attack|death|use)|p\d+-(?:line|reply))(?:-\d+)?$/.test(item.ref)) throw new Error('不正な台詞ID: ' + item.ref);
    const src = 'voices/cards/' + item.ref + '.mp3';
    if (!fs.existsSync(path.join(root, src)) || fs.statSync(path.join(root, src)).size === 0) { missing.push(item.ref); continue; }
    clipOf.set(item.ref, { src, text: displayText(item.text, (direction[item.ref] || {}).text) }); registered.push(item.ref);
  }
  // 複数話者は一連の台詞。途中の音声がまだ無い場合は部分再生しない。
  const complete = group => {
    const expected = partsOf.get(group) || [];
    if (!expected.length || !expected.every(i => clipOf.has(i.ref))) return [];
    // 同時に言うまとまりは、重ねた1本があればそれを鳴らす（無ければ1人ずつ順に鳴らす）
    const runs = togetherRuns(expected, together.has(group));
    const out = [];
    for (const run of runs) {
      const src = run.together ? togetherSrc(group, run, runs) : null;
      if (src && fs.existsSync(path.join(root, src))) out.push({ src, text: clipOf.get(run.items[0].ref).text });
      else for (const i of run.items) out.push(clipOf.get(i.ref));
    }
    return out;
  };
  for (const id of Object.keys(script.lines)) {
    if (!/^n\d{3}$/.test(id)) continue;
    for (const event of ['summon', 'attack', 'death', 'use']) {
      const clips = complete(id + '-' + event);
      if (!clips.length) continue;
      for (const no of numbers(id)) (manifest.cards[no] || (manifest.cards[no] = {}))[event] = clips;
    }
  }
  for (const [id, pair] of Object.entries(pairs)) {
    const first = complete(id + '-line'), reply = complete(id + '-reply');
    const target = lines.find(i => i.group === id + '-reply' || i.ref === id + '-reply');
    if (!first.length || !reply.length || !target || !script.lines[pair.who] || !script.lines[target.cardId]) continue;
    if (!['rival', 'ally'].includes(pair.kind)) continue;
    manifest.pairs.push({ id, kind: pair.kind, who: numbers(pair.who), target: numbers(target.cardId), clips: [...first, ...reply] });
  }
  return { manifest, report: { registered: registered.length, cardNumbers: Object.keys(manifest.cards).length, pairs: manifest.pairs.length, missing } };
}
function prepare(root) {
  mixTogether(root);
  const result = buildCardVoiceManifest(root);
  const dir = path.join(root, 'voices', 'cards'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(result.manifest, null, 2) + '\n');
  writeAssetHashes(root);
  return result.report;
}
module.exports = { buildCardVoiceManifest, prepare, displayText };
if (require.main === module) {
  const args = process.argv.slice(2), at = args.indexOf('--root');
  const root = at >= 0 ? path.resolve(args[at + 1]) : path.resolve(__dirname, '..');
  const report = prepare(root);
  console.log(`音声一覧を更新: ${report.registered}台詞 / ${report.cardNumbers}カード / 掛け合い${report.pairs}組。未作成${report.missing.length}台詞は無音で進行します。`);
}
