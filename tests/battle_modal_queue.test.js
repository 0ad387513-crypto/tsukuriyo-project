"use strict";
// 確認・選択の画面が重なったとき、前の画面の答えが失われずに順番に出ることのテスト
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
const tick = () => new Promise(r => setTimeout(r, 0));
function app() {
  const watchers = [];
  const a = {
    appView: 'battle', battleSample: { result: null }, battleOracleEffect: null, _battleCpuAutoResolving: false,
    dslOptionalModal: null, dslChoiceModal: null,
    // Vue の $watch の代わり：値が変わったら呼ぶ
    $watch(getter, cb) { const w = { getter, cb, last: getter(), on: true }; watchers.push(w); return () => { w.on = false; }; },
    _flush() { for (const w of watchers.slice()) { if (!w.on) continue; const v = w.getter(); if (v !== w.last) { w.last = v; w.cb(v); } } },
    _sfxPlay() {}, _tutorialAnswerAllowed: () => true, _dslChoiceOptionConditionMet: () => true, dslChoiceOptionDisabled: () => false,
  };
  for (const name of ['_dslWaitModalFree', 'dslAskOptional', 'dslAnswerOptional', 'dslAskChoice', 'dslAnswerChoice']) a[name] = method(name);
  return a;
}

test('任意の確認が重なっても、2つ目は1つ目が閉じてから出て、両方の答えが届く', async () => {
  const a = app();
  const first = a.dslAskOptional({ name: 'A' }, '墓地起動', 'A');
  const second = a.dslAskOptional({ name: 'B' }, '墓地起動', 'B');
  assert.equal(a.dslOptionalModal.sourceCard.name, 'A');
  a.dslAnswerOptional(true);
  a._flush(); await tick();
  assert.equal(a.dslOptionalModal && a.dslOptionalModal.sourceCard.name, 'B');
  a.dslAnswerOptional(false);
  assert.equal(await first, true);
  assert.equal(await second, false);
  assert.equal(a.dslOptionalModal, null);
});

test('選択肢の画面が重なっても順番に出る', async () => {
  const a = app();
  const first = a.dslAskChoice({ name: 'A' }, '選んで', ['x', 'y']);
  const second = a.dslAskChoice({ name: 'B' }, '選んで', ['x', 'y']);
  a.dslAnswerChoice(1);
  a._flush(); await tick();
  assert.equal(a.dslChoiceModal.sourceCard.name, 'B');
  a.dslAnswerChoice(0);
  assert.equal(await first, 1);
  assert.equal(await second, 0);
});

test('待っている間に対戦が終わったら、待っていた確認は「使わない」で終わる', async () => {
  const a = app();
  a.dslAskOptional({ name: 'A' }, '墓地起動', 'A');
  const second = a.dslAskOptional({ name: 'B' }, '墓地起動', 'B');
  a.battleSample = { result: 'win' };
  a._flush(); await tick();
  assert.equal(await second, false);
});

test('対象選択・選択肢・任意の確認・墓地起動・効果の2回目は、重ならないよう待つ作りになっている', () => {
  assert.match(html, /if \(this\.dslTargetModal\) return this\._dslWaitModalFree\('dslTargetModal'\)\.then\(ok => ok \? this\.dslChooseTargets\(/);
  assert.match(html, /if \(this\.dslTargetModal\) return this\._dslWaitModalFree\('dslTargetModal'\)\.then\(ok => ok \? this\.dslAskCustomTargets\(/);
  assert.match(html, /async _battleCheckGraveyardActivationPromptInner\(side\)/);
  assert.match(html, /await this\.battleRunDoubledDeathEffect\(card\);/);
  assert.match(html, /if \(hasEnter\) await this\.battleRunDoubledEnterEffect\(card, paidCost\);/);
});
