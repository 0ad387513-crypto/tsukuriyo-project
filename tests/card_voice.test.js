"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildCardVoiceManifest } = require('../scripts/build_card_voice_manifest');
const { buildAssetHashes } = require('../scripts/build_asset_hashes');
const core = require('../card_voice_core');
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tsukuriyo-voice-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('tsukuriyo-voice-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const write = (rel, value) => { const file = path.join(root, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, typeof value === 'object' ? JSON.stringify(value) : value); };
  write('tools/voice-script/card_voice_script.json', { lines: { n001: { nos: '1,2' }, n003: { nos: '3,4' } } });
  write('tools/voice-script/card_voice_lines.json', { items: [
    { ref: 'n001-summon', group: 'n001-summon', text: '召喚' },
    { ref: 'n001-attack', group: 'n001-attack', text: '攻撃' },
    { ref: 'n003-summon-1', group: 'n003-summon', text: '一人目' },
    { ref: 'n003-summon-2', group: 'n003-summon', text: '二人目' },
    { ref: 'p01-line', group: 'p01-line', cardId: 'n001' },
    { ref: 'p01-reply', group: 'p01-reply', cardId: 'n003' },
  ] });
  write('tools/voice-script/card_voice_pairs.json', { pairs: { p01: { who: 'n001', kind: 'rival' } } });
  for (const ref of ['n001-summon', 'n003-summon-1', 'p01-line', 'p01-reply']) write('voices/cards/' + ref + '.mp3', 'audio');
  return { root, write };
}
test('通常版/進化版を共有し、不完全な複数話者・未作成台詞は再生しない', t => {
  const { root, write } = fixture(t);
  let { manifest, report } = buildCardVoiceManifest(root);
  assert.deepEqual(manifest.cards['1'], manifest.cards['2']);
  assert.equal(core.clipsFor(manifest, { no: '002' }, 'summon')[0].text, '召喚');
  assert.deepEqual(core.clipsFor(manifest, { no: '3' }, 'summon'), []);
  assert.deepEqual(core.clipsFor(manifest, { no: '1' }, 'attack'), []);
  assert.ok(report.missing.includes('n001-attack'));
  write('voices/cards/n003-summon-2.mp3', 'audio');
  manifest = buildCardVoiceManifest(root).manifest;
  assert.equal(manifest.cards['4'].summon.length, 2);
});
test('同時に言う印の付いた部分は、重ねた1本があればそれを鳴らし、印の無い部分は順に鳴らす', t => {
  const { root, write } = fixture(t);
  write('tools/voice-script/card_voice_script.json', { lines: { n001: { nos: '1' }, n003: { nos: '3' }, n005: { nos: '5' } } });
  write('tools/voice-script/card_voice_lines.json', { items: [
    // 一部だけ同時：1人目 → 2人目 → 2人同時に
    { ref: 'n001-summon-1', group: 'n001-summon', text: '恐怖は' },
    { ref: 'n001-summon-2', group: 'n001-summon', text: '二人で' },
    { ref: 'n001-summon-3', group: 'n001-summon', text: '乗り越える！', together: true },
    { ref: 'n001-summon-4', group: 'n001-summon', text: '乗り越える！', together: true },
    // 全員が同時
    { ref: 'n003-use-1', group: 'n003-use', text: 'はぁっ！', together: true },
    { ref: 'n003-use-2', group: 'n003-use', text: 'はぁっ！', together: true },
    // 重ねた音声がまだ無い：1人ずつ順に鳴らす
    { ref: 'n005-use-1', group: 'n005-use', text: 'いざ', together: true },
    { ref: 'n005-use-2', group: 'n005-use', text: 'いざ', together: true },
  ] });
  for (const ref of ['n001-summon-1', 'n001-summon-2', 'n001-summon-3', 'n001-summon-4', 'n003-use-1', 'n003-use-2', 'n005-use-1', 'n005-use-2']) write('voices/cards/' + ref + '.mp3', 'audio');
  write('voices/cards/n001-summon-together-3.mp3', 'audio');
  write('voices/cards/n003-use-together.mp3', 'audio');
  const { manifest } = buildCardVoiceManifest(root);
  assert.deepEqual(manifest.cards['1'].summon.map(c => c.src), ['voices/cards/n001-summon-1.mp3', 'voices/cards/n001-summon-2.mp3', 'voices/cards/n001-summon-together-3.mp3']);
  assert.equal(manifest.cards['1'].summon[2].text, '乗り越える！');
  assert.deepEqual(manifest.cards['3'].use.map(c => c.src), ['voices/cards/n003-use-together.mp3']);
  assert.deepEqual(manifest.cards['5'].use.map(c => c.src), ['voices/cards/n005-use-1.mp3', 'voices/cards/n005-use-2.mp3']);
});
test('掛け合いは正しい陣営・相手・通常版/進化版に限定し、一対戦一度', t => {
  const { root } = fixture(t), manifest = buildCardVoiceManifest(root).manifest;
  const self = { legacies: [{ no: '2' }] }, opp = { legacies: [{ no: '4' }] };
  assert.equal(core.pairFor(manifest, self.legacies[0], 'self', { self, opp }, new Set()).id, 'p01');
  assert.equal(core.pairFor(manifest, self.legacies[0], 'self', { self, opp }, new Set(['p01'])), undefined);
  assert.equal(core.pairFor(manifest, self.legacies[0], 'self', { self: { legacies: [{ no: '4' }] }, opp: { legacies: [] } }, new Set()), undefined);
});
test('候補・取り直し・旧音声を配信用ハッシュへ混ぜない', t => {
  const { root, write } = fixture(t);
  for (const sub of ['previews', 'takes', 'library', '_old']) write('voices/cards/' + sub + '/candidate.mp3', 'audio');
  const hashes = buildAssetHashes(root);
  assert.ok(hashes['voices/cards/n001-summon.mp3']);
  assert.ok(Object.keys(hashes).every(k => !/candidate/.test(k)));
});
test('受信盤面のバウンス・進化を死亡と誤認せず、重複受信も再発火しない', () => {
  const old = { self: { legacies: [{ no: '1' }], graveyard: [] }, opp: { legacies: [] } };
  const before = core.fieldSnapshot(old);
  const bounced = { self: { legacies: [], graveyard: [], hand: [{ no: '1' }] }, opp: {} };
  assert.equal(core.remoteDeaths(before, bounced).length, 0);
  assert.equal(core.remoteDeaths(before, { self: { legacies: [{ no: '2' }] }, opp: {} }).length, 0);
  const after = { self: { legacies: [], graveyard: [{ no: '1' }] }, opp: {} };
  assert.equal(core.remoteDeaths(before, after).length, 1);
  assert.equal(core.remoteDeaths(core.fieldSnapshot(after), after).length, 0);
});
function audioHarness(options = {}) {
  const audios = [], activity = [];
  let level = 0.6, clock = 0, busy = false, can = true, timeouts = new Set();
  const player = core.createPlayer({
    makeAudio(src) {
      const listeners = new Map();
      const audio = { src, paused: false, volume: 0, addEventListener: (e, fn) => listeners.set(e, fn), removeEventListener: e => listeners.delete(e),
        play: () => options.reject ? Promise.reject(new Error('blocked')) : Promise.resolve(),
        pause() { this.paused = true; const fn = listeners.get('pause'); if (fn) fn(); },
        emit(e) { const fn = listeners.get(e); if (fn) fn(); } };
      audios.push(audio); return audio;
    }, url: src => src + '?h=test', volume: () => level, canPlay: () => can, busy: () => busy,
    onActive: active => { activity.push(active); if (options.reentrant) player.setVolume(); }, now: () => clock,
    timer: fn => { timeouts.add(fn); return fn; }, untimer: fn => timeouts.delete(fn),
  });
  return { player, audios, activity, setLevel: v => { level = v; player.setVolume(); }, setBusy: v => { busy = v; }, setCan: v => { can = v; }, setClock: v => { clock = v; }, expire: () => [...timeouts].forEach(fn => fn()) };
}
test('台詞/複数話者を重ねず順に再生し、中身のハッシュと音量を反映', async () => {
  const h = audioHarness();
  h.player.enqueue([{ src: 'first.mp3' }, { src: 'reply.mp3' }]);
  h.player.enqueue([{ src: 'next.mp3' }]);
  assert.equal(h.audios.length, 1); assert.equal(h.audios[0].src, 'first.mp3?h=test');
  h.setLevel(0.3); assert.equal(h.audios[0].volume, 0.3);
  h.audios[0].emit('ended'); await tick(); assert.equal(h.audios[1].src, 'reply.mp3?h=test');
  h.audios[1].emit('ended'); await tick(); assert.equal(h.audios[2].src, 'next.mp3?h=test');
  h.audios[2].emit('ended'); await tick(); assert.equal(h.activity.at(-1), false);
});
test('ミュート・画面離脱・カミ台詞優先で停止し、古い台詞を後から読まない', async () => {
  const h = audioHarness({ reentrant: true });
  h.player.enqueue([{ src: 'first' }]); h.player.enqueue([{ src: 'stale' }]);
  h.setLevel(0); await tick(); assert.equal(h.audios[0].paused, true); assert.equal(h.audios.length, 1);
  h.setLevel(0.6); h.setBusy(true); assert.equal(h.player.enqueue([{ src: 'kami-busy' }]), false);
  h.setBusy(false); h.setCan(false); assert.equal(h.player.enqueue([{ src: 'outside-battle' }]), false);
  h.setCan(true); h.player.enqueue([{ src: 'first' }]); h.player.enqueue([{ src: 'late' }]);
  h.setClock(5000); h.audios[1].emit('ended'); await tick(); assert.equal(h.audios.length, 2);
});
test('再生拒否・読み込み失敗・stalledでBGMとキューを解放', async () => {
  const blocked = audioHarness({ reject: true }); blocked.player.enqueue([{ src: 'blocked' }]);
  await tick(); assert.equal(blocked.activity.at(-1), false);
  const h = audioHarness(); h.player.enqueue([{ src: 'missing' }]); h.audios[0].emit('error');
  await tick(); assert.equal(h.activity.at(-1), false);
  h.player.enqueue([{ src: 'stalled' }]); h.expire(); await tick(); assert.equal(h.activity.at(-1), false);
});
function appMethod(name, dependencies = {}) {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const match = html.match(new RegExp('    ' + name + '\\(([^\\n]*)\\) \\{([\\s\\S]*?)\\r?\\n    \\},'));
  assert.ok(match, name);
  return Function(...Object.keys(dependencies), 'return function(' + match[1] + ') {' + match[2] + '}')(...Object.values(dependencies));
}
test('ゲームの出現イベントがトークンを含めて音声へつながり、同じ通知は一度だけ', () => {
  const calls = [], card = { no: '2', category: 'レガシー' };
  const context = { appView: 'battle', cardVoiceManifest: { cards: { '2': { summon: [{ src: 'summon' }] } }, pairs: [] },
    battleSample: { turn: 1, self: { legacies: [card] }, opp: { legacies: [] } }, battlePlayLog: {}, battleLog: [],
    fullName: c => 'Card ' + c.no, _dslToTrueSide: side => side, _battlePublishSemanticOperation() {}, _battlePublishNotice() {},
    _cardVoicePlayerGet: () => ({ enqueue: clips => { if (!clips.length) return false; calls.push(clips); return true; } }) };
  context._battleCardVoice = appMethod('_battleCardVoice', { CardVoiceCore: core });
  const track = appMethod('_battleTrackPlayedCard');
  track.call(context, 'self', 'legacyEntered', { card });
  track.call(context, 'self', 'legacyEntered', { card });
  assert.equal(calls.length, 1);
  card.no = '3'; card.isToken = true; context.cardVoiceManifest.cards['3'] = { summon: [{ src: 'token' }] };
  track.call(context, 'self', 'legacyEntered', { card }); assert.equal(calls[1][0].src, 'token');
  track.call(context, 'self', 'guardLegacyPlayed', { card }); assert.equal(calls.length, 2);
});
test('ゲームの受信発動演出は新しい相手通知だけ再生し、再接続の過去通知やエコーを読まない', () => {
  const calls = [], card = { no: '1', category: 'レガシー' }, at = Date.now();
  const context = { battleNet: { on: true, mySeat: 1 }, cardByNo: { '1': card }, _battleCardVoice: (...args) => calls.push(args), _battleMotionMs: n => n };
  const apply = appMethod('_battleApplyRemoteOracleEffect', { setTimeout: () => 0, clearTimeout() {} });
  apply.call(context, { writer: 2, cardNo: 1, ts: at - 6000 }); assert.equal(calls.length, 0);
  apply.call(context, { writer: 1, cardNo: 1, ts: at }); assert.equal(calls.length, 0);
  apply.call(context, { writer: 2, cardNo: 1, ts: at }); assert.equal(calls.length, 1);
  apply.call(context, { writer: 2, cardNo: 1, ts: at }); assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], [card, 'summon', 'opp']);
});
test('カード詳細の掛け合い相手は正式名称にし、通常版/進化版の重複を除く', () => {
  const akamatsu = { no: '2', name: 'アカマツ', nickname: '見習い忍者' };
  const shiratori = { no: '24', name: 'シラトリ', nickname: '白き閃刃' };
  const context = {
    previewCard: akamatsu,
    allCards: [akamatsu, { ...shiratori, no: '23' }, shiratori],
    fullName: c => c.nickname ? c.nickname + '・' + c.name : c.name,
    cardVoiceManifest: { cards: {}, pairs: [{ id: 'p17', kind: 'ally', who: ['1', '2'], target: ['23', '24'], clips: [{ text: '台詞' }] }] },
  };
  const rows = appMethod('previewVoiceRows').call(context);
  assert.equal(rows[0].label, '掛け合い（味方：白き閃刃・シラトリ）');
  context.previewCard = shiratori;
  assert.equal(appMethod('previewVoiceRows').call(context)[0].label, '掛け合い（味方：見習い忍者・アカマツ）');
});
