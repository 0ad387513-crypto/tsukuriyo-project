"use strict";
/* 外部APIを呼ばない。作成・採用済みの直下MP3と台本だけからゲーム用一覧を作る。 */
const fs = require('node:fs');
const path = require('node:path');
const { writeAssetHashes } = require('./build_asset_hashes');
function readJson(file, fallback) { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback; }
function buildCardVoiceManifest(root) {
  const dir = path.join(root, 'tools', 'voice-script');
  const script = readJson(path.join(dir, 'card_voice_script.json'), { lines: {} });
  const lines = readJson(path.join(dir, 'card_voice_lines.json'), { items: [] }).items;
  const pairs = readJson(path.join(dir, 'card_voice_pairs.json'), { pairs: {} }).pairs;
  const manifest = { schemaVersion: 1, cards: {}, pairs: [] }, missing = [], registered = [];
  const numbers = id => String(script.lines[id] && script.lines[id].nos || Number(id.replace(/^n/, '')))
    .split(/[,、\s]+/).filter(n => /^\d+$/.test(n) && Number(n) > 0).map(n => String(Number(n)));
  const groups = new Map();
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
    return expected.length && clips.length === expected.length ? clips : [];
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
