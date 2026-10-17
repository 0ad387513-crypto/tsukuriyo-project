"use strict";
// 標準CPU（進化・昇華の選び方、攻撃の先読み）と、死亡時効果の待ち合わせのテスト
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function method(name) {
  const m = html.match(new RegExp('    (async )?' + name + '\\(([^\\n]*)\\) \\{([\\s\\S]*?)\\r?\\n    \\},'));
  assert.ok(m, name);
  return Function('return ' + (m[1] || '') + 'function(' + m[2] + ') {' + m[3] + '\n}')();
}
function card(no = 'x', props = {}) {
  return { no, name: no, category: 'レガシー', type: '侍', color: '赤', cost: 2, power: 2000, attack: 1, text: '', ...props };
}
const has = (c, kw) => String(c.text || '').includes('【' + kw + '】');
function app() {
  const a = {
    battleSample: { self: { mana: 5, life: 10, hand: [], legacies: [], relics: [], graveyard: [] }, opp: { life: 10, legacies: [], relics: [] } },
    battleFieldLimit: () => 7,
    battleCardHasKeyword: has,
    battleSublimCostOptions: c => c.costs || [Number(c.cost)],
    battleLegacyCanAct: c => ({ ok: !c._tapped && !c._sick }),
    battleCanTargetLegacy: () => true,
    battleCanDeclareAttackTarget: (a, d) => !!d._tapped,
    _battleCpuOracleUseless: () => false,
    _dslEvolutionBaseCandidates: c => c._bases || [],
    $nextTick: () => Promise.resolve(),
  };
  for (const name of ['_battleCpuWeights', '_battleCpuUnitValue', '_battleCpuPlayOptions', '_battleCpuLifeScore', '_battleCpuModelUnit',
    '_battleCpuModelFight', '_battleCpuModelPickGuard', '_battleCpuPlanAttacks', '_battleTrackDeathEffect', '_battleWaitNewDeathEffects',
    '_battleRunDeathEffectsInOrder']) a[name] = method(name);
  return a;
}

test('昇華できるカードは、払えるコストごとに候補を出す', () => {
  const a = app();
  const c = card('s', { cost: 3, costs: [3, 5] });
  const options = a._battleCpuPlayOptions(c);
  assert.deepEqual(options.map(o => o.cost), [3, 5]);
  assert.ok(options[1].value > options[0].value);
  a.battleSample.self.mana = 4;
  assert.deepEqual(a._battleCpuPlayOptions(c).map(o => o.cost), [3]);
});

test('進化は場の弱いカードに重ねる候補を出し、強いカードを弱いカードで上書きする候補は出さない', () => {
  const a = app();
  const weak = card('weak', { power: 1000, attack: 0 }), strong = card('strong', { power: 6000, attack: 3 });
  a.battleSample.self.legacies = [weak, strong];
  const evo = card('evo', { power: 4000, attack: 2, _bases: [weak, strong] });
  const options = a._battleCpuPlayOptions(evo);
  assert.ok(options.some(o => o.base === weak && o.baseOnField));
  assert.ok(!options.some(o => o.base === strong));
  assert.ok(options.some(o => o.base === null));
});

test('先読み：とどめを刺せるなら神攻を選ぶ', () => {
  const a = app();
  a.battleSample.opp.life = 2;
  a.battleSample.self.legacies = [card('a', { attack: 2, power: 1000 })];
  a.battleSample.opp.legacies = [card('big', { power: 9000, attack: 5 })];
  assert.equal(a._battleCpuPlanAttacks().kind, 'divine');
});

test('先読み：攻撃すると次の相手ターンに倒される主力は、ライフに余裕があれば攻撃に使わない', () => {
  const a = app();
  a.battleSample.opp.life = 20;
  a.battleSample.self.legacies = [card('ace', { power: 3000, attack: 1, cost: 6 })];
  a.battleSample.opp.legacies = [card('killer', { power: 5000, attack: 1 })];
  assert.equal(a._battleCpuPlanAttacks(), null);
});

test('先読み：横向きの相手を戦闘で倒せて自分が残るなら戦闘を選ぶ', () => {
  const a = app();
  a.battleSample.self.legacies = [card('a', { power: 5000, attack: 0 })];
  a.battleSample.opp.legacies = [card('t', { power: 2000, attack: 2, _tapped: true })];
  const plan = a._battleCpuPlanAttacks();
  assert.equal(plan.kind, 'battle');
  assert.equal(plan.target, 0);
});

test('死亡時効果は始める前に処理待ちへ登録し、中から新しい死亡時効果だけを待っても自分自身は待たない', async () => {
  const a = app();
  let innerSawSelf = null;
  const run = a._battleTrackDeathEffect(async () => {
    const before = new Set(a._battlePendingDeathEffects);
    innerSawSelf = before.size === 1;
    await a._battleWaitNewDeathEffects(before); // 自分自身を待つと終わらない
    return 'done';
  });
  const result = await Promise.race([run, new Promise(r => setTimeout(() => r('timeout'), 500))]);
  assert.equal(result, 'done');
  assert.equal(innerSawSelf, true);
  assert.equal(a._battlePendingDeathEffects.size, 0);
});

test('同時に倒れたカードの死亡時効果は1枚ずつ順に処理し、全体が終わるまで処理待ちに残る', async () => {
  const a = app();
  const order = [];
  a.battleRunDeathKeywordEffects = card => a._battleTrackDeathEffect(async () => { order.push('start:' + card.name); await new Promise(r => setTimeout(r, 5)); order.push('end:' + card.name); });
  const before = new Set();
  a._battleRunDeathEffectsInOrder([card('A'), card('B')]);
  assert.ok(a._battlePendingDeathEffects.size >= 1);
  await a._battleWaitNewDeathEffects(before);
  assert.deepEqual(order, ['start:A', 'end:A', 'start:B', 'end:B']);
  assert.equal(a._battlePendingDeathEffects.size, 0);
});
