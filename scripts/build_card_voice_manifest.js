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
const togetherSrc = group => 'voices/cards/' + group + '-together.mp3';
function mixTogether(root) {
  const lines = readJson(path.join(root, 'tools', 'voice-script', 'card_voice_lines.json'), { items: [] }).items;
  for (const group of togetherGroups(root)) {
    const parts = lines.filter(i => (i.group || i.ref.replace(/-\d+$/, '')) === group).map(i => path.join(root, 'voices', 'cards', i.ref + '.mp3'));
    const out = path.join(root, togetherSrc(group));
    if (parts.length < 2 || !parts.every(p => fs.existsSync(p))) continue;
    if (fs.existsSync(out) && parts.every(p => fs.statSync(p).mtimeMs <= fs.statSync(out).mtimeMs)) continue;
    const args = ['-v', 'error', '-y'];
    for (const p of parts) args.push('-i', p);
    // 重ねても音が割れないよう、人数に合わせて少し下げてから足し、最後に上限をかける
    args.push('-filter_complex', parts.map((_, i) => `[${i}:a]volume=${(1 / Math.sqrt(parts.length)).toFixed(3)}[a${i}]`).join(';') + ';'
      + parts.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${parts.length}:duration=longest:normalize=0,alimiter=limit=0.9[o]`,
      '-map', '[o]', '-ac', '1', '-ar', '44100', '-b:a', '128k', out);
    const run = require('node:child_process').spawnSync('ffmpeg', args, { encoding: 'utf8', windowsHide: true });
    if (run.error || run.status !== 0) console.warn(`${group}：同時再生用の音声を作れませんでした（ffmpeg が必要です）`);
    else console.log(`${group}：${parts.length}人の音声を重ねました`);
  }
}
function buildCardVoiceManifest(root) {
  const dir = path.join(root, 'tools', 'voice-script');
  const script = readJson(path.join(dir, 'card_voice_script.json'), { lines: {} });
  const lines = readJson(path.join(dir, 'card_voice_lines.json'), { items: [] }).items;
  const pairs = readJson(path.join(dir, 'card_voice_pairs.json'), { pairs: {} }).pairs;
  const manifest = { schemaVersion: 1, cards: {}, pairs: [] }, missing = [], registered = [];
  const numbers = id => String(script.lines[id] && script.lines[id].nos || Number(id.replace(/^n/, '')))
    .split(/[,、\s]+/).filter(n => /^\d+$/.test(n) && Number(n) > 0).map(n => String(Number(n)));
  const groups = new Map(), together = togetherGroups(root);
  for (const item of lines) {
    if (!/^(?:n\d{3}-(?:summon|attack|death|use)|p\d+-(?:line|reply))(?:-\d+)?$/.test(item.ref)) throw new Error('不正な台詞ID: ' + item.ref);
    const src = 'voices/cards/' + item.ref + '.mp3';
    if (!fs.existsSync(path.join(root, src)) || fs.statSync(path.join(root, src)).size === 0) { missing.push(item.ref); continue; }
    const group = item.group || item.ref.replace(/-\d+$/, '');
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push({ src, text: item.text || '' }); registered.push(item.ref);
  }
  // 複数話者は一連の台詞。途中の音声がまだ無い場合は部分再生しない。
  const complete = group => {
    const expected = lines.filter(i => (i.group || i.ref.replace(/-\d+$/, '')) === group);
    const clips = groups.get(group) || [];
    if (!expected.length || clips.length !== expected.length) return [];
    // 同時に言う台詞は、重ねた1本があればそれだけを鳴らす
    if (clips.length > 1 && together.has(group) && fs.existsSync(path.join(root, togetherSrc(group)))) return [{ src: togetherSrc(group), text: clips[0].text }];
    return clips;
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
module.exports = { buildCardVoiceManifest, prepare };
if (require.main === module) {
  const args = process.argv.slice(2), at = args.indexOf('--root');
  const root = at >= 0 ? path.resolve(args[at + 1]) : path.resolve(__dirname, '..');
  const report = prepare(root);
  console.log(`音声一覧を更新: ${report.registered}台詞 / ${report.cardNumbers}カード / 掛け合い${report.pairs}組。未作成${report.missing.length}台詞は無音で進行します。`);
}
