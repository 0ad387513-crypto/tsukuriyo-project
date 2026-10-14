"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function method(name, dependencies = {}) {
  const m = html.match(new RegExp('    (async )?' + name + '\\(([^\\n]*)\\) \\{([\\s\\S]*?)\\r?\\n    \\},'));
  assert.ok(m, name);
  return Function(...Object.keys(dependencies), 'return ' + (m[1] || '') + 'function(' + m[2] + ') {' + m[3] + '\n}')(...Object.values(dependencies));
}
test('オロチの盤面画像は自分と相手の封印状態から独立して切り替わり、巻き戻しにも追従する', () => {
  const { divineBattlePortrait, DIVINE_SKILL_CUTINS } = require('../divine_effects.js');
  const crops = [];
  const portrait = method('battleKamiPortraitStyle', { divineBattlePortrait,
    kamiFaceCrop: (...args) => { crops.push(args); return { size: '220% auto', pos: '67% 52%' }; },
  });
  const kami = { no: '10' };
  const vm = { battleView: { self: { kami, seal: 8 }, opp: { kami, seal: 0 } },
    kamiIllustrationUrl: () => 'current-masked.webp', kamiPortraitFocusStyle: () => ({ '--kami-pos': 'center' }),
  };
  assert.equal(portrait.call(vm,'self').backgroundImage, 'url(current-masked.webp)');
  assert.equal(portrait.call(vm,'opp').backgroundImage, 'url('+DIVINE_SKILL_CUTINS['10']+')');
  assert.equal(crops[0][2], 900/1600, '横長の素顔画像に合う切り抜き');
  vm.battleView.self.seal = 0;
  assert.equal(portrait.call(vm,'self').backgroundImage, 'url('+DIVINE_SKILL_CUTINS['10']+')');
  vm.battleView.self.seal = 4;
  assert.equal(portrait.call(vm,'self').backgroundImage, 'url(current-masked.webp)');
  vm.battleView.self.kami = { no: '9' }; vm.battleView.self.seal = 0;
  assert.equal(portrait.call(vm,'self').backgroundImage, 'url(current-masked.webp)');
  for (const seal of [null, undefined, '', 4, 8, -1, NaN]) assert.equal(divineBattlePortrait(kami, seal), null);
  assert.deepEqual(portrait.call(vm,'absent'), {});
});
test('神技目元の読み込み失敗も旧デザインに戻らず、二度目の失敗は画像を消す', () => {
  const onError = method('battleSkillCloseupImgError');
  for (const mode of ['skill1', 'orochi-seal-four']) {
    const vm = { battleSkillCloseup: { mode, kami: { no: '10' }, fallbackStage: 0 }, kamiIllustrationUrl: () => 'current.webp' };
    onError.call(vm); assert.equal(vm.battleSkillCloseup.imgUrl, 'current.webp');
    onError.call(vm); assert.equal(vm.battleSkillCloseup.imgUrl, null);
  }
});
function attackHarness() {
  const card = { no: '2', category: 'レガシー' }, calls = [];
  const vm = {
    battleSample: { activeSide: 'self', self: { legacies: [card] }, opp: { legacies: [{ no: '3' }] } },
    battleLegacyCanAct: c => ({ ok: !c._tapped }),
    _battleCardVoice: (...args) => calls.push(args), hideCardHover() {}, _sfxPlay() {}, _battleBuildAttackTargetCache() {},
    battleEnsureSelfTurn: () => true, _tutorialAllows: () => true, fullName: c => c.no,
    battleSaveUndo() {}, $set: (obj, key, value) => { obj[key] = value; }, dslRefreshStaticAbilities() {},
    async battleRunActionTrigger() { vm.battleSample.result = { outcome: 'win' }; },
    async battleFireKamiEventAwaited() {},
  };
  for (const name of ['_battleFieldDragAttackVoice', '_battleFieldActivateDrag', 'battleResolveLegacyBattle', 'battleResolveDivineAttack']) vm[name] = method(name);
  vm._fieldPointer = { side: 'self', zone: 'legacies', index: 0, startX: 0, startY: 0, sourceX: 0, sourceY: 0 };
  return { vm, card, calls };
}
test('クリック/微小移動では鳴らず、矢印を伸ばすドラッグで攻撃ボイスは一度だけ', () => {
  const { vm, card, calls } = attackHarness();
  const move = method('_battleFieldPointerMove', { requestAnimationFrame: () => 1 });
  move.call(vm, { clientX: 3, clientY: 0 });
  assert.equal(calls.length, 0);
  move.call(vm, { clientX: 5, clientY: 0 });
  assert.deepEqual(calls, [[card, 'attack', 'self', false]]);
  move.call(vm, { clientX: 80, clientY: 60 });
  vm._battleFieldDragAttackVoice();
  assert.equal(calls.length, 1);
});
test('タップ済み/レリック/相手ターンのドラッグでは攻撃ボイスを鳴らさない', () => {
  const { vm, card, calls } = attackHarness();
  card._tapped = true;
  vm._battleFieldActivateDrag();
  card._tapped = false; vm.battleFieldDrag.zone = 'relics'; vm._battleFieldDragAttackVoice();
  vm.battleFieldDrag.zone = 'legacies'; vm.battleSample.activeSide = 'opp'; vm._battleFieldDragAttackVoice();
  assert.equal(calls.length, 0);
});
for (const target of ['legacy', 'kami']) test(`ドラッグ後の${target === 'legacy' ? '戦闘' : '神攻'}確定で二重に鳴らず、CPU等の直接攻撃は鳴る`, async () => {
  const { vm, calls } = attackHarness();
  vm._battleFieldActivateDrag();
  let pending;
  const resolver = target === 'kami' ? vm.battleResolveDivineAttack : vm.battleResolveLegacyBattle;
  vm[target === 'kami' ? 'battleResolveDivineAttack' : 'battleResolveLegacyBattle'] = function(...args) { pending = resolver.apply(this, args); };
  vm._attackTargetCache = {};
  vm._battleAttackTargetFromCache = () => ({ type: target, index: 0 });
  vm._battleTargetRectFromCache = () => null;
  vm.battleSuppressPostDragPreview = () => {};
  const up = method('_battleFieldPointerUp', { window: { removeEventListener() {} }, cancelAnimationFrame() {} });
  up.call(vm, { clientX: 100, clientY: 50 });
  await pending;
  assert.equal(calls.length, 1, 'same gesture is not replayed at confirmation');
  const direct = attackHarness();
  if (target === 'kami') await direct.vm.battleResolveDivineAttack('self', 0);
  else await direct.vm.battleResolveLegacyBattle('self', 0, 'opp', 0);
  assert.equal(direct.calls.length, 1, 'CPU/programmatic attacks still have a voice');
});
function effectHarness() {
  const watchers = [];
  const card = { no: '2', category: 'レガシー', color: '赤' };
  const vm = {
    appView: 'battle', battleSample: { self: { hand: [card] }, result: null }, battleOracleEffect: { card },
    $watch(get, callback) {
      const watcher = { get, callback, value: get(), active: true }; watchers.push(watcher);
      return () => { watcher.active = false; };
    },
    _dslEligible: () => [card], _dslRemarkTargetCards: () => null, _dslCurrentSource: card,
    battleHasSenteiBoostLegacy: () => false,
  };
  for (const name of ['_battleWaitForOracleEffect', 'dslChooseTargets', 'dslAskCustomTargets', 'dslAskOptional', 'dslAskChoice', 'battleOpenSentei', 'battleRunEnterKeywordEffects', 'battleOfferReroll']) vm[name] = method(name);
  const flush = () => watchers.filter(w => w.active).forEach(w => {
    const value = w.get(); if (value !== w.value) { w.value = value; w.callback(value); }
  });
  return { vm, card, flush, watchers };
}
for (const name of ['dslChooseTargets', 'dslAskCustomTargets', 'dslAskOptional', 'dslAskChoice', 'battleOpenSentei']) test(`${name}: 発動画面を閉じた後にだけ選択画面を開く`, async () => {
  const { vm, card, flush, watchers } = effectHarness();
  const args = {
    dslChooseTargets: [{ 枚数: 1, 選択者: 'player' }, '対象'],
    dslAskCustomTargets: ['対象', [card]], dslAskOptional: [card, '確認', '効果'],
    dslAskChoice: [card, '効果', ['A', 'B']], battleOpenSentei: [card, { count: 1, options: ['A'] }],
  };
  const modal = { dslChooseTargets: 'dslTargetModal', dslAskCustomTargets: 'dslTargetModal', dslAskOptional: 'dslOptionalModal', dslAskChoice: 'dslChoiceModal', battleOpenSentei: 'battleSenteiModal' }[name];
  const pending = vm[name](...args[name]);
  await tick(); assert.equal(vm[modal], undefined);
  vm.battleOracleEffect = null; flush(); await tick();
  assert.ok(vm[modal]); assert.ok(watchers.every(w => !w.active));
  if (vm._dslDeferred) vm._dslDeferred([card]);
  else if (vm[modal].resolver) vm[modal].resolver(name === 'dslAskChoice' ? 0 : true);
  await pending;
});
test('召喚/オラクルの効果処理とリロールは発動画面が閉じるまで待つ', async () => {
  const h = effectHarness(), ran = [];
  Object.assign(h.vm, { _battleIsEffectDisabled: () => false, effectSpecsReady: true,
    dslHasSpecForTrigger: (c, trigger) => trigger === '出現時', dslRunSpec: async () => ran.push('effect'),
    battleRunDoubledEnterEffect() {}, battleGlowCardEffect() {}, _dslColorsMatchForReroll: () => true,
  });
  const enter = h.vm.battleRunEnterKeywordEffects(h.card);
  await tick(); assert.equal(ran.length, 0);
  h.vm.battleOracleEffect = null; h.flush(); await enter; assert.deepEqual(ran, ['effect']);
  h.vm.battleOracleEffect = { card: h.card };
  const reroll = h.vm.battleOfferReroll(h.card);
  await tick(); assert.equal(h.vm.dslOptionalModal, undefined);
  h.vm.battleOracleEffect = null; h.flush(); await tick();
  assert.equal(h.vm.dslOptionalModal.kind, 'reroll');
  h.vm.dslOptionalModal.resolver(false); await reroll;
});
test('待機中の離脱/対戦差し替え/決着では古い選択を出さず、CPUは待機しない', async () => {
  for (const change of [vm => { vm.appView = 'top'; }, vm => { vm.battleSample = { self: {} }; }, vm => { vm.battleSample.result = { outcome: 'win' }; }]) {
    const { vm, card, flush, watchers } = effectHarness();
    const pending = vm.dslAskOptional(card, '確認', '効果');
    change(vm); flush(); assert.equal(await pending, false);
    assert.equal(vm.dslOptionalModal, undefined); assert.ok(watchers.every(w => !w.active));
  }
  const { vm, card, watchers } = effectHarness(); vm._battleCpuAutoResolving = true;
  assert.equal(await vm.dslAskOptional(card, '確認', '効果'), false);
  assert.equal(await vm.dslAskChoice(card, '選択', ['A', 'B']), 0);
  assert.equal(watchers.length, 0);
});
