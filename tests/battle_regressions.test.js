"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
function method(name, dependencies = {}) {
  const match = html.match(new RegExp('    (async )?' + name + '\\(([^\\n]*)\\) \\{([\\s\\S]*?)\\r?\\n    \\},'));
  assert.ok(match, name);
  return Function(...Object.keys(dependencies), 'return ' + (match[1] || '') + 'function(' + match[2] + ') {' + match[3] + '\n}')(...Object.values(dependencies));
}
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'pack_generator.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'session.js'), 'utf8'), context);
const sessionRules = vm.runInContext('({pairingsFor, battleWonBySeat})', context);

test('ヒノカグツチの破壊中の死亡時破壊は同じ演出と死亡処理を待ち直さない', async () => {
  const outer={no:'56'},inner={no:'103'},source={no:'7'},events=[];
  const divine={kami:source,index:2,presented:false},field=[outer,inner];let presentations=0;
  const a={_battleDivineContext:divine,_dslDefaultBothCategoriesIfUnrestricted:s=>s,_dslCardEffPower:()=>1000,
    dslChooseTargets:async(sel,label)=>[sel.testTarget],battleSaveUndo(){},battleShowNotice(){},fullName:c=>c.no,
    _dslMoveFromField(c){const i=field.indexOf(c);if(i<0)return false;field.splice(i,1);events.push('destroy:'+c.no);return true},
    async _battlePresentFlameClaw(){presentations++;assert.equal(presentations,1,'死亡時の破壊は創世神技の演出を再起動しない');
      divine.flameCaptured=true;divine.flameCapture();await divine.flameDeathPromise;divine.presented=true;return true},
    async battleRunDeathKeywordEffects(c){events.push('death:'+c.no);if(c===outer)await this._dslOpDestroy({対象:{testTarget:inner}},outer)},
    _dslOpDestroy:method('_dslOpDestroy')};
  await a._dslOpDestroy({対象:{testTarget:outer}},source);
  assert.deepEqual(field,[]);assert.equal(presentations,1);
  assert.deepEqual(events,['destroy:56','death:56','destroy:103','death:103']);
});

test('勝利数は固定PAIRINGSなしで実際の組み合わせと記録済み全ラウンドから集計する', () => {
  const countWins = method('seatWinCount', sessionRules);
  for (const seed of [1, 77, 121, 20261016]) {
    for (const cpus of [[], [3, 4], [2, 3, 4], [1, 2, 3, 4]]) {
      const data = { seed, seats: Object.fromEntries(cpus.map(n => [n, { isCpu: true }])), battles: {} };
      const app = { gs: { data } };
      const expected = [0, 0, 0, 0, 0];
      for (let round = 1; round <= 3; round++) {
        const pairs = sessionRules.pairingsFor(data, round);
        const a = pairs[0][round % 2], b = pairs[1][(round + 1) % 2];
        data.battles[round] = { t1Winner: String(a), t2Winner: b };
        expected[a]++; expected[b]++;
        for (let seat = 1; seat <= 4; seat++) assert.equal(countWins.call(app, String(seat)), expected[seat]);
      }
    }
  }
  assert.equal(countWins.call({ gs: { data: null } }, 1), 0);
  assert.equal(countWins.call({ gs: { data: { seed: 1, battles: { 1: { t1Winner: null } } } } }, 1), 0);
});

test('終戦順位は1勝10点を返還値に加算して勝者を決める', () => {
  const data = { seed: 121, seats: { 1: {}, 2: {}, 3: {}, 4: {} }, battles: {} };
  for (let round = 1; round <= 3; round++) {
    const pairs = sessionRules.pairingsFor(data, round);
    data.battles[round] = Object.fromEntries(pairs.map((pair, i) => [`t${i + 1}Winner`, pair.includes(1) ? 1 : pair[0]]));
  }
  const app = { gs: { data, seat: 1 }, seatWinCount: method('seatWinCount', sessionRules),
    seatReturn: seat => ({ deck: seat === 1 ? 10 : 20, converted: 0 }),
    seatKamiCard: () => null, fullName: () => '' };
  const rows = method('gsScoreRows').call(app);
  assert.equal(rows[0].seat, 1);
  assert.equal(rows[0].wins, 3);
  assert.equal(rows[0].winPoints, 30);
  assert.equal(rows[0].total, 40);
  data.seats[4].isCpu = true;
  assert.equal(method('gsScoreRows').call(app).some(row => row.seat === 4), false);
});

test('セッションのNode用エクスポートにも廃止済みの定数が残らない', () => {
  const session = require('../session.js');
  assert.equal(typeof session.pairingsFor, 'function');
  assert.equal(typeof session.battleWonBySeat, 'function');
});

const specs = JSON.parse(fs.readFileSync(path.join(root, 'effect_spec.json'), 'utf8'));
function copyHarness() {
  const app = { battleSample: { self: { legacies: [], graveyard: [] } }, effectSpecsReady: true,
    notices: [], offers: [], calls: [], fullName: card => card.name || card.no,
    dslHasSpecForTrigger: (card, trigger) => (specs[card.no]?.能力 || []).some(ab => ab.契機 === trigger),
    battleShowNotice(...args) { this.notices.push(args); },
    async dslAskCustomTargets(prompt, candidates) { this.offers.push(candidates.slice()); return [candidates[0]]; },
    async dslRunSpec(card, trigger) { this.calls.push([card, trigger]); },
    _dslOpTriggerOtherEffect: method('_dslOpTriggerOtherEffect'),
  };
  return app;
}
const fox = () => ({ no: '91', category: 'レガシー' });
const deathAct = { 対象: '自分墓地のレガシーの死亡時効果' };

test('大妖狐しか墓地にいない場合は自身の死亡時効果を選ばず正常に終了する', async () => {
  const app = copyHarness(), source = fox();
  app.battleSample.self.graveyard = [source];
  app._dslCurrentTriggerLabel = '死亡時';
  await app._dslOpTriggerOtherEffect(deathAct, source);
  assert.equal(app.offers.length, 0);
  assert.equal(app.calls.length, 0);
  assert.equal(app.notices.length, 1);
});

test('大妖狐は他の死亡時効果を発動でき、同名の別個体も区別する', async () => {
  const app = copyHarness(), source = fox(), other = fox();
  app.battleSample.self.graveyard = [source, other];
  await app._dslOpTriggerOtherEffect(deathAct, source);
  assert.deepEqual(app.offers[0], [other]);
  assert.deepEqual(app.calls, [[other, '死亡時']]);
});

test('複数の大妖狐の死亡時効果を経由して元の効果へ戻る循環を防ぐ', async () => {
  const app = copyHarness(), a = fox(), b = fox();
  app.battleSample.self.graveyard = [a, b];
  app._dslCurrentTriggerLabel = '死亡時';
  app.dslRunSpec = async function(card, trigger) {
    this.calls.push([card, trigger]);
    assert.ok(this.calls.length < 4, '循環してはならない');
    await this._dslOpTriggerOtherEffect(deathAct, card);
  };
  await app._dslOpTriggerOtherEffect(deathAct, a);
  assert.deepEqual(app.calls, [[b, '死亡時']]);
  assert.equal(app.offers.length, 1);
  // 別の解決では再び同じ個体を選べる（永久に使用不能にしない）。
  app.dslRunSpec = async function(card, trigger) { this.calls.push([card, trigger]); };
  await app._dslOpTriggerOtherEffect(deathAct, a);
  assert.equal(app.calls.length, 2);
});

test('コピー途中のエラーでも循環防止の状態を解放する', async () => {
  const app = copyHarness(), source = fox(), other = fox();
  app.battleSample.self.graveyard = [source, other];
  app.dslRunSpec = async () => { throw new Error('test failure'); };
  await assert.rejects(app._dslOpTriggerOtherEffect(deathAct, source), /test failure/);
  app.dslRunSpec = async function(card) { this.calls.push(card); };
  await app._dslOpTriggerOtherEffect(deathAct, source);
  assert.deepEqual(app.calls, [other]);
});

test('面霊姫の場にいる自身の死亡時効果を発動する合法な使い方は維持する', async () => {
  const app = copyHarness(), source = { no: '62', category: 'レガシー' };
  app.battleSample.self.legacies = [source];
  app._dslCurrentTriggerLabel = '進化中・出現時';
  await app._dslOpTriggerOtherEffect({ 対象: '自分レガシーの死亡時効果' }, source);
  assert.deepEqual(app.calls, [[source, '死亡時']]);
});

function summonHarness({ size = 7, count = 2, callback = true, distinct = false } = {}) {
  const tokens = [1, 2].map(no => ({ no: String(no), category: 'レガシー', isToken: true }));
  const app = { battleSample: { self: { legacies: Array.from({ length: size }, () => ({})), crumbled: [] } },
    battleDeckModal: null, completed: [], next: 0,
    battleSummonCandidates: () => tokens, fullName: card => card.no,
    battleShowNotice() {}, battleSaveUndo() {}, hideCardHover() {}, _sfxPlay() {},
    battleFieldZoneForSummon: () => 'legacies', battleCanPlaceFromSource: () => true,
    battleFieldLimit: () => 7, _battlePrepareFieldCard: card => ({ ...card }),
    _battlePlayPlacementSfx() {}, dslRefreshStaticAbilities() {}, battleFireKamiEvent() {},
    _battleCardHasGuard: () => false, $set: (obj, key, value) => { obj[key] = value; },
    _battleProcessNextEffect() { this.next++; },
  };
  for (const name of ['battleOpenAutoSummon', 'battleResolveAutoSummon', 'battleSummonAllRemaining', 'battleFinishAutoSummon']) app[name] = method(name);
  // New shared completion helper is bound when present; pre-fix tests still exercise the old paths.
  if (/    _battleCompleteAutoSummon\(/.test(html)) app._battleCompleteAutoSummon = method('_battleCompleteAutoSummon');
  app.battleOpenAutoSummon({ no: 'source' }, { targetText: 'token', count, distinct }, '昇華', callback ? list => app.completed.push(list) : null);
  return app;
}

test('満員で複数トークンが崩壊した後も一度だけ完了して後続効果に進む', async () => {
  const app = summonHarness();
  const modal = app.battleDeckModal;
  let resolveDone;
  const done = new Promise(resolve => { resolveDone = resolve; });
  modal.onComplete = cards => { app.completed.push(cards); resolveDone('resumed'); };
  app.battleResolveAutoSummon(0);
  assert.equal(app.completed.length, 0, 'まだ1体残っている');
  app.battleResolveAutoSummon(1);
  assert.equal(app.battleSample.self.crumbled.length, 2);
  assert.equal(app.battleDeckModal, null);
  assert.deepEqual(app.completed, [[]]);
  assert.equal(await done, 'resumed');
  app.battleResolveAutoSummon(0); app.battleFinishAutoSummon();
  assert.equal(app.completed.length, 1);
  assert.equal(app.next, 0, 'コールバックと旧キューを二重に進めない');
});

test('満員招来でコールバックがなければ旧効果キューを一度だけ進める', () => {
  const app = summonHarness({ callback: false });
  app.battleSummonAllRemaining();
  assert.equal(app.battleSample.self.crumbled.length, 2);
  assert.equal(app.next, 1);
  app.battleFinishAutoSummon();
  assert.equal(app.next, 1);
});

for (const mode of ['normal', 'partial', 'skip', 'zero-remaining']) test(`招来の${mode}経路も実際に出たカードだけを返して一度完了する`, () => {
  const app = summonHarness({ size: 0 });
  if (mode === 'normal') app.battleSummonAllRemaining();
  if (mode === 'partial') { app.battleResolveAutoSummon(0); app.battleFinishAutoSummon(); }
  if (mode === 'skip') app.battleFinishAutoSummon();
  if (mode === 'zero-remaining') { app.battleDeckModal.remaining = 0; app.battleResolveAutoSummon(0); }
  assert.equal(app.battleDeckModal, null);
  assert.equal(app.completed.length, 1);
  assert.equal(app.completed[0].length, mode === 'normal' ? 2 : mode === 'partial' ? 1 : 0);
  app.battleFinishAutoSummon();
  assert.equal(app.completed.length, 1);
});

test('残り1枠に招来するとその1体で完了し、以後の操作で二重配置しない', () => {
  const app = summonHarness({ size: 6 });
  app.battleResolveAutoSummon(0);
  app.battleResolveAutoSummon(1);
  assert.equal(app.battleSample.self.legacies.length, 7);
  assert.equal(app.completed.length, 1);
  assert.equal(app.completed[0].length, 1);
});

test('完了コールバックが次の招来を開いても新しいモーダルを消さない', () => {
  const app = summonHarness();
  let completed = 0;
  app.battleDeckModal.onComplete = () => {
    completed++;
    app.battleOpenAutoSummon({ no: 'next' }, { targetText: 'token', count: 2 }, '死亡時', list => app.completed.push(list));
  };
  app.battleResolveAutoSummon(0); app.battleResolveAutoSummon(1);
  assert.equal(completed, 1);
  assert.equal(app.battleDeckModal.sourceCard.no, 'next');
  app.battleFinishAutoSummon();
  assert.deepEqual(app.completed, [[]]);
});
