"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const specs = require('../effect_spec.json');
const named = Function('return ' + html.match(/const GS_CPU_NAMED_CARD_BONUS = (\{[\s\S]*?\n\});/)[1])();
function method(name) {
  const m = html.match(new RegExp('    (async )?' + name + '\\(([^\\n]*)\\) \\{([\\s\\S]*?)\\r?\\n    \\},'));
  assert.ok(m, name);
  return Function('GS_CPU_NAMED_CARD_BONUS', 'return ' + (m[1] || '') + 'function(' + m[2] + ') {' + m[3] + '\n}')(named);
}
function card(no = 'x', props = {}) {
  return { no, name: no, category: 'レガシー', type: '侍', color: '赤', cost: 2, power: 2000, attack: 1, text: '', ...props };
}
function app(kami = '1') {
  const a = { effectSpecs: specs, effectSpecsByName: {}, fullName: c => c.name,
    battleSample: { self: { kami: { no: kami, skill2cost: ({'1':5,'2':5,'3':8,'4':6,'5':7,'6':7,'7':8,'8':7,'9':6})[kami] || 1 },
      mana: 5, manaMax: 5, tenryoku: 5, life: 10, hand: [], deck: Array.from({ length: 10 }, () => card()),
      legacies: [], relics: [], graveyard: [] }, opp: { life: 10, legacies: [], relics: [] } },
    _battleKamiNo() { return 'K' + this.battleSample.self.kami.no; }, battleFieldLimit: () => 7,
    battleEffectiveCost: c => Number(c.cost), battleSublimCostOptions: c => c.costs || [Number(c.cost)],
    battleSkillOptions: [{ index: 1, cost: kami === '7' ? 3 : 2, enabled: true }, { index: 2, cost: kami === '7' ? 8 : 5, enabled: true }],
    battleCardHasKeyword: (c, keyword) => String(c.text || '').includes('【' + keyword + '】'),
    battleLegacyCanAct: c => ({ok: !c._tapped && !c._sick}), battleCanTargetLegacy: () => true,
    _dslCardEffPower: c => Number(c.power || 0),
  };
  for (const name of ['_battleCpuDefenseState', '_battleCpuRemovalValue', '_battleCpuKeepValue', '_battleCpuDiscardLoss', '_battleCpuPickSubset', '_battleCpuEffectValue', '_battleCpuImmediateEffectValue', '_battleCpuShouldUseOptional',
    '_dslGetSpec', '_dslEvolutionCriteria', '_dslEvolutionBaseCandidates',
    '_dslCardMatchesColor', 'battleCardMatchesInduceCriteria', '_gsCpuEvolutionFit', '_gsCpuPlanScore',
    'gsCpuCardTagScore', '_battleCpuPlannedSkillIndex', '_battleCpuCardValue', '_battleCpuChooseEvolutionBase',
    '_battleCpuUnitValue', '_battleCpuTakeBuffTargets', '_battleCpuBounceChoices', '_battleCpuSummonIndex', '_battleCpuCardPlanValue',
    '_battleCpuPlannedPlayOptions', '_battleCpuPlannedSummonPhase', '_battleCpuSummonAndUsePhase', '_battleCpuUseGenesisSkill']) a[name] = method(name);
  return a;
}

test('スサノオは同じ進化カードでも条件に合う土台を確保できている方を高く評価する', () => {
  const a = app(), evolution = card('15', { text: '【進化：赤レガシー/侍レガシー】' });
  const fit = Array.from({ length: 6 }, () => card());
  const unfit = fit.map(c => ({ ...c, color: '青', type: '龍' }));
  assert.equal(a._gsCpuEvolutionFit(evolution, fit), 6);
  assert.equal(a._gsCpuEvolutionFit(evolution, unfit), 0);
  assert.ok(a.gsCpuCardTagScore(evolution, ['evolveSublim'], fit) > a.gsCpuCardTagScore(evolution, ['evolveSublim'], unfit));
  assert.equal(a._gsCpuEvolutionFit(evolution, [evolution]), 0);
});

test('スサノオは進化札に合う軽量土台と、足りない決着用打点を評価する', () => {
  const a = app();
  const deck = [card('15', { text: '【進化】' }), ...Array.from({ length: 6 }, () => card('base', { color: '青', type: '龍' }))];
  const base = card('red', { cost: 1 }), mismatch = { ...base, color: '青', type: '龍' };
  assert.ok(a._gsCpuPlanScore(base, deck, ['evolveSublim']) > a._gsCpuPlanScore(mismatch, deck, ['evolveSublim']));
  assert.ok(a._gsCpuPlanScore(card('hit', { attack: 2 }), deck, ['evolveSublim']) >= 8);
  for (const tag of ['unique', 'tribeDiversity', 'highPower', 'oracleRelic', 'manaLife', 'guard', 'token', 'dragon']) {
    assert.equal(a._gsCpuPlanScore(base, deck, [tag]), 0);
  }
});

test('スサノオは高額な昇華と天力供給札の取り過ぎを抑える', () => {
  const a = app(), sublim = card('s', { text: '【昇華3】', cost: 4 });
  assert.ok(a.gsCpuCardTagScore(sublim, ['evolveSublim'], []) < a.gsCpuCardTagScore({ ...sublim, cost: 1 }, ['evolveSublim'], []));
  const supply = card('supply', { text: '天力を1得る' });
  assert.ok(a.gsCpuCardTagScore(supply, ['evolveSublim'], [supply, supply, supply]) < a.gsCpuCardTagScore(supply, ['evolveSublim'], []));
});

test('ヒノカグツチは補正のコロン・空白・各種マイナス表記を認識する', () => {
  const a = app('7'), plain = card('debuff');
  const base = a.gsCpuCardTagScore(plain, ['destroy'], []);
  for (const text of ['【補正：-2000】', '【補正:-2000】', '【補正 -2000】', '【補正：−2000】', '【補正－2000】']) {
    assert.equal(a.gsCpuCardTagScore({ ...plain, text }, ['destroy'], []) - base, 18, text);
  }
  assert.equal(a.gsCpuCardTagScore({ ...plain, text: '【補正：+2000】' }, ['destroy'], []), base);
});

test('ヒノカグツチは崩壊をレガシー破壊と同じ天力源として加点しない', () => {
  const a = app('7'), c = card();
  assert.ok(a.gsCpuCardTagScore({ ...c, text: '相手レガシーを破壊する' }, ['destroy'], [])
    > a.gsCpuCardTagScore({ ...c, text: '相手レガシーを崩壊する' }, ['destroy'], []));
});

test('ヒノカグツチは除去が揃うと非レガシーの追加を抑え、盤面と軽量札を補う', () => {
  const a = app('7'), removal = card('r', { category: 'オラクル', text: '相手レガシーを破壊する' });
  const crowded = Array.from({ length: 8 }, () => ({ ...removal }));
  assert.ok(a.gsCpuCardTagScore(removal, ['destroy'], crowded) < a.gsCpuCardTagScore(removal, ['destroy'], []));
  assert.ok(a._gsCpuPlanScore(card('body'), crowded, ['destroy']) > a._gsCpuPlanScore(removal, crowded, ['destroy']));
});

test('スサノオの創世神技は有効な墓地進化ができる時に使い、付与後は再使用しない', () => {
  const a = app(), me = a.battleSample.self;
  me.hand = [card('15')]; me.graveyard = [card('red')];
  assert.equal(a._battleCpuPlannedSkillIndex(), 2);
  me.graveyardEvolutionEnabled = true;
  assert.notEqual(a._battleCpuPlannedSkillIndex(), 2);
  me.graveyardEvolutionEnabled = false; me.mana = 1;
  assert.notEqual(a._battleCpuPlannedSkillIndex(), 2, '直ちに使えない高額進化のために天力を使わない');
});

test('スサノオは条件不一致の墓地や満員の場では墓地進化用の天力を使わない', () => {
  const a = app(), me = a.battleSample.self;
  me.hand = [card('15')]; me.graveyard = [card('blue', { color: '青', type: '龍' })];
  assert.equal(a._battleCpuPlannedSkillIndex(), 0);
  me.graveyard = [card('red')]; me.legacies = Array.from({ length: 7 }, () => card());
  assert.equal(a._battleCpuPlannedSkillIndex(), 0);
});

test('スサノオは天力5が近い間は神技1を温存し、付与後は手札を補充する', () => {
  const a = app(), me = a.battleSample.self;
  me.hand = [card('15')]; me.tenryoku = 4; a.battleSkillOptions[1].enabled = false;
  assert.equal(a._battleCpuPlannedSkillIndex(), 0);
  me.graveyardEvolutionEnabled = true;
  assert.equal(a._battleCpuPlannedSkillIndex(), 1);
});

test('ヒノカグツチは創世神技への天力を温存し、余剰分だけ神技1に使う', () => {
  const a = app('7'), me = a.battleSample.self;
  me.tenryoku = 7; me.hand = [card()]; a.battleSkillOptions[1].enabled = false;
  assert.equal(a._battleCpuPlannedSkillIndex(), 0);
  me.tenryoku = 11;
  assert.equal(a._battleCpuPlannedSkillIndex(), 1);
  me.deck = [card()]; assert.equal(a._battleCpuPlannedSkillIndex(), 0);
});

test('ヒノカグツチは小さな対象だけなら待ち、大物・危険な盤面・最後の3点では創世神技を使う', () => {
  const a = app('7'), foe = a.battleSample.opp;
  a.battleSample.self.hand = [card(), card(), card()];
  foe.legacies = [card('token', { isToken: true, cost: 0, attack: 1 })];
  assert.equal(a._battleCpuPlannedSkillIndex(), 0);
  foe.legacies[0].cost = 4; assert.equal(a._battleCpuPlannedSkillIndex(), 2);
  foe.legacies = []; foe.life = 3; assert.equal(a._battleCpuPlannedSkillIndex(), 2);
  a.battleSkillOptions[1].enabled = false; assert.equal(a._battleCpuPlannedSkillIndex(), 0);
});

test('墓地進化は盤面の未行動の主力を残し、満員なら弱い場のカードに重ねる', () => {
  const a = app(), me = a.battleSample.self, evolution = card('15');
  const strong = card('strong', { power: 7000, attack: 3 }), weak = card('weak', { power: 1000 });
  const grave = card('dead'); me.legacies = [strong, weak]; me.graveyard = [grave]; me.graveyardEvolutionEnabled = true;
  assert.equal(a._battleCpuChooseEvolutionBase(evolution), grave);
  me.legacies.push(...Array.from({ length: 5 }, () => strong));
  assert.equal(a._battleCpuChooseEvolutionBase(evolution), weak);
  me.legacies = [strong]; me.graveyard = [];
  assert.equal(a._battleCpuChooseEvolutionBase(evolution), null);
});

test('昇華を持つカードも候補に入り、最大昇華より2枚展開が良い時は通常コストを選ぶ', () => {
  const a = app(), me = a.battleSample.self;
  const sublim = card('sublim', { cost: 2, costs: [2, 5] }), follower = card('next', { cost: 2 });
  me.hand = [sublim, follower];
  const choices = a._battleCpuPlannedPlayOptions().filter(c => c.card === sublim);
  assert.equal(choices.length, 2);
  assert.equal(choices[0].cost, 2);
  me.hand = [sublim];
  assert.equal(a._battleCpuPlannedPlayOptions()[0].cost, 5);
});

test('満員時は墓地進化で8体目を出さず、場の進化元がなければ候補から外す', () => {
  const a = app(), me = a.battleSample.self;
  me.graveyardEvolutionEnabled = true; me.graveyard = [card('red')]; me.hand = [card('15')];
  me.legacies = Array.from({ length: 7 }, () => card('blue', { color: '青', type: '龍' }));
  assert.equal(a._battleCpuPlannedPlayOptions().length, 0);
});

test('神技を待つ間に手番が終わったら発動せず、他のカミは従来の創世神技を使う', async () => {
  const a = app('9'), calls = []; let active = true;
  a._battleCpuThinkPause = async () => { active = false; };
  a.battleUseKamiSkill = async n => calls.push(n); a._battleWaitPendingDeathEffects = async () => {};
  await a._battleCpuUseGenesisSkill(() => active);
  assert.deepEqual(calls, []);
  a._battleCpuThinkPause = async () => {}; active = true;
  await a._battleCpuUseGenesisSkill(() => active);
  assert.deepEqual(calls, [2]);
});

test('対象2柱の召喚は選んだ進化元・昇華コストを使い、拒否された操作でループしない', async () => {
  const a = app(), me = a.battleSample.self, calls = [];
  me.hand = [card('s', { cost: 2, costs: [2, 5] })];
  a._battleCpuUseGenesisSkill = async () => {};
  a._battleCpuThinkPause = async () => {};
  a._battleWaitPendingDeathEffects = async () => {};
  a._battlePlayLegacyOrRelic = async (...args) => calls.push(args);
  await a._battleCpuSummonAndUsePhase(() => true);
  assert.deepEqual(calls, [[0, 'legacies', 5, null]]);
});

for (const [kami, expected] of [['1', 'divine'], ['7', 'combat'], ['4', 'combat']]) {
  test(`カミ${kami}の攻撃は${expected}を優先し、他のカミの既存方針を変えない`, async () => {
    const a = app(kami), calls = [], attacker = card('attacker', { power: 3000 });
    a.battleSample.self.legacies = [attacker]; a.battleSample.opp.legacies = [card('enemy', { power: 1000 })];
    a.battleLegacyCanAct = c => ({ ok: !c._tapped });
    a.battleCanDeclareAttackTarget = () => true; a.battleCardHasKeyword = () => false;
    a._battleCpuThinkPause = async () => {}; a._battleWaitPendingDeathEffects = async () => {};
    a._battleCpuUseGenesisSkill = async () => {};
    a.battleResolveDivineAttack = async () => { calls.push('divine'); attacker._tapped = true; };
    a.battleResolveLegacyBattle = async () => { calls.push('combat'); attacker._tapped = true; };
    await method('_battleCpuAttackPhase').call(a, () => true);
    assert.deepEqual(calls, [expected]);
  });
}

test('スサノオは危険な盤面なら、無条件に神攻せず攻撃者を処理する', async () => {
  const a = app(), calls = [], attacker = card('attacker', { power: 5000 });
  a.battleSample.self.life = 2; a.battleSample.self.legacies = [attacker];
  a.battleSample.opp.legacies = [card('threat', { attack: 3 })];
  a.battleLegacyCanAct = c => ({ ok: !c._tapped }); a.battleCanDeclareAttackTarget = () => true;
  a.battleCardHasKeyword = () => false; a._battleCpuThinkPause = async () => {};
  a._battleWaitPendingDeathEffects = async () => {}; a._battleCpuUseGenesisSkill = async () => {};
  a.battleResolveDivineAttack = async () => { calls.push('divine'); attacker._tapped = true; };
  a.battleResolveLegacyBattle = async () => { calls.push('combat'); attacker._tapped = true; };
  await method('_battleCpuAttackPhase').call(a, () => true);
  assert.deepEqual(calls, ['combat']);
});

test('ヤマトタケルの同名ペナルティはレガシーと補助札を区別する', () => {
  const a = app('2');
  for (const n of ['gsCpuBaseScore','gsCpuCardTagScore','gsCpuTribeSynergy','gsCpuColorSynergy','gsCpuEffectSynergy','gsCpuCurveScore','gsCpuHumanStatScore','gsCpuUniqueRatioScore','_gsCpuPlanScore']) a[n] = () => 0;
  const score = method('gsCpuScoreBreakdown');
  for (const [category, expected] of [['レガシー',-20],['オラクル',-3],['レリック',-3]]) {
    const c = card('same', { category });
    assert.equal(score.call(a,c,{seat:1,pickedCards:[c],kamiTags:['unique']}).total,expected);
  }
});

test('タケミカヅチはコロン付きのプラス補正を拾い、マイナス補正とは区別する', () => {
  const a = app('4'), base = card('buff');
  const neutral = a.gsCpuCardTagScore(base,['highPower'],[]);
  for (const text of ['【補正：+1000】','【補正:+1000】','【補正 ＋1000】']) {
    assert.ok(Math.abs(a.gsCpuCardTagScore({...base,text},['highPower'],[]) - neutral - 18) < 1e-9);
  }
  assert.equal(a.gsCpuCardTagScore({...base,text:'【補正：-1000】'},['highPower'],[]),neutral);
});

test('多種族は同時展開できる軽量札、加速は後続の主力との配分を評価する', () => {
  const a = app('3'), deck = Array.from({length:6},()=>card('heavy',{cost:6,type:'龍'}));
  assert.ok(a._gsCpuPlanScore(card('new',{cost:2,type:'人獣'}),deck,['tribeDiversity']) > a._gsCpuPlanScore(card('new',{cost:7,type:'人獣'}),deck,['tribeDiversity']));
  const ramp = card('ramp',{text:'マナ最大値を1増やす'}), ramps = [ramp,ramp,ramp];
  assert.ok(a._gsCpuPlanScore(ramp,ramps,['manaLife']) < 0);
  assert.ok(a._gsCpuPlanScore(card('payoff',{cost:6}),ramps,['manaLife']) > 0);
});

test('オモイカネはレガシー不足を補い、公開された自分の勝利数だけで得点方針を調整する', () => {
  const a = app('5'), oracles = Array.from({length:8},()=>card('o',{category:'オラクル'}));
  const body=card('body');
  assert.ok(a._gsCpuPlanScore(body,oracles,['oracleRelic']) > a._gsCpuPlanScore(oracles[0],oracles,['oracleRelic']));
  a.gs={data:{round:3,seats:{1:{}}}};a.seatWinCount=()=>0;
  assert.equal(a._gsCpuPlanScore(body,oracles,['oracleRelic'],{seat:1}) - a._gsCpuPlanScore(body,oracles,['oracleRelic']),5);
});

test('ヤマトタケルは自分の盤面の損失まで比較して全体除去を温存する', () => {
  const a=app('2'), me=a.battleSample.self, foe=a.battleSample.opp;
  me.hand=[card(),card(),card()];me.legacies=[card('big',{power:6000}),card('costly',{power:5000})];foe.legacies=[card('only')];
  assert.equal(a._battleCpuPlannedSkillIndex(),0);
  me.legacies=[card('big',{power:6000})];foe.legacies=[card('a',{power:5000}),card('b',{power:5000}),card('c',{power:5000})];
  assert.equal(a._battleCpuPlannedSkillIndex(),2);
});

test('アマテラスは蘇生先・枠がない時に天力を使わず、危険時は守護トークンを選ぶ', () => {
  const a=app('8'),me=a.battleSample.self;
  me.hand=[card(),card(),card()];assert.equal(a._battleCpuPlannedSkillIndex(),0);
  me.graveyard=[card('revive',{power:5000})];assert.equal(a._battleCpuPlannedSkillIndex(),2);
  me.legacies=Array.from({length:7},()=>card());assert.equal(a._battleCpuPlannedSkillIndex(),0);
  me.life=2;
  const fast=card('fast',{power:4000,attack:2}),guard=card('guard',{power:1000,text:'【守護】'});
  assert.equal(a._battleCpuSummonIndex({cards:[fast,guard]}),1);
  assert.equal(a._battleCpuSummonIndex({cards:[fast,guard],distinct:true,summoned:[guard]}),0);
});

test('ツクヨミは高額な相手を優先し、再利用できる自分の出現時効果も候補にする', () => {
  const a=app('9'),me=a.battleSample.self,foe=a.battleSample.opp;
  a.dslHasSpecForTrigger=()=>true;
  const high=card('high',{cost:6}),low=card('low',{cost:1}),replay=card('replay',{cost:1,_tapped:true,text:'ドローする'});
  me.hand=[];me.legacies=[replay];foe.legacies=[low,high];
  assert.equal(a._battleCpuBounceChoices([low,replay,high])[0].card,high);
  foe.legacies=[low];assert.equal(a._battleCpuBounceChoices([low,replay])[0].card,replay);
  replay._tapped=false;assert.equal(a._battleCpuBounceChoices([low,replay])[0].card,low);
  assert.equal(a._battleCpuPlannedSkillIndex(),0);
});

test('神技判断は他プレイヤーの非公開手札・山札を参照しない', () => {
  for(const no of ['2','3','4','5','6','8','9','10']) {
    const a=app(no);a.dslHasSpecForTrigger=()=>true;
    for(const zone of ['hand','deck'])Object.defineProperty(a.battleSample.opp,zone,{get(){throw Error('private zone read');}});
    assert.doesNotThrow(()=>a._battleCpuPlannedSkillIndex());
  }
});

function targets(no='9') {
  const a=app(no);a._battleCpuAutoResolving=true;a._battleCpuIsStandard=()=>true;
  a.battleShowNotice=()=>{};a._dslRemarkTargetCards=()=>false;a._dslCardEffPower=c=>Number(c.power||0);
  a._battleFieldCardSide=c=>a.battleSample.opp.legacies.includes(c)?'opp':'self';
  a.dslChooseTargets=method('dslChooseTargets');a.dslAskCustomTargets=method('dslAskCustomTargets');
  return a;
}

test('標準CPUの対象選択も合計戦闘力と異なる名前の条件を守る', async () => {
  const a=targets('5');
  const cards=[card('big',{power:4000}),card('dup1',{name:'same',power:2000}),card('dup2',{name:'same',power:2000}),card('small',{power:1000})];
  a.battleSample.opp.legacies=cards;a._dslEligible=()=>cards;
  const picks=await a.dslChooseTargets({対象側:'opp',領域:'field',枚数:2,備考:'カード名が異なる、合計戦闘力3000以下'},'破壊する対象');
  assert.equal(picks.length,2);assert.ok(picks.reduce((n,c)=>n+c.power,0)<=3000);
  assert.equal(new Set(picks.map(c=>c.name)).size,2);
});

test('標準ツクヨミは合法候補の中から出現時を再利用できる自分のカードも戻せる', async () => {
  const a=targets(),own=card('replay',{cost:1,_tapped:true,text:'ドローする'}),enemy=card('enemy',{cost:0,isToken:true});
  a.dslHasSpecForTrigger=()=>true;a._dslCurrentSource={isKami:true,no:'9'};
  a.battleSample.self.legacies=[own];a.battleSample.opp.legacies=[enemy];a._dslEligible=()=>[own,enemy];
  const picked=await a.dslChooseTargets({対象側:'both',領域:'field',枚数:1},'手札に戻すカードを選択',{preferOpponent:true});
  assert.deepEqual(picked,[own]);
  a._dslEligible=()=>[enemy];assert.deepEqual(await a.dslChooseTargets({対象側:'both',枚数:1},'手札に戻すカードを選択'),[enemy]);
});

test('任意の自壊を選ばず、無料の回収は大きい札・強制の捨て札は小さい札を選ぶ', async () => {
  const a=targets('8'),small=card('small',{power:1000}),large=card('large',{power:5000});
  assert.deepEqual(await a.dslAskCustomTargets('墓地に送るカード',[small,large],1,null,true),[]);
  assert.deepEqual(await a.dslAskCustomTargets('墓地から回収するカード',[small,large],1,null,true),[large]);
  assert.deepEqual(await a.dslAskCustomTargets('墓地に送るカード',[large,small],1),[small]);
});

test('初心者向けと人間の対象選択は標準CPUの判断に置き換えない', async () => {
  const a=targets('8'),c=card();a._battleCpuIsStandard=()=>false;a._dslEligible=()=>[c];
  assert.deepEqual(await a.dslChooseTargets({対象側:'self',任意:true,枚数:1},'回収する対象'),[]);
  a._battleCpuAutoResolving=false;
  const pending=a.dslChooseTargets({対象側:'self',枚数:1},'人間が選ぶ対象');
  assert.equal(a.dslTargetModal.prompt,'人間が選ぶ対象');a._dslDeferred([c]);assert.deepEqual(await pending,[c]);
});

test('オオクニヌシは1枚の高コストだけでなく3種族をコスト上限内で展開する', () => {
  const a=app('3');a._battleCpuDistinctPlacement=method('_battleCpuDistinctPlacement');
  const cards=[card('huge',{cost:9,power:6000,type:'侍'}),card('a',{cost:3,power:3000,type:'侍'}),
    card('b',{cost:3,power:3000,type:'人獣'}),card('c',{cost:3,power:3000,type:'神使'})];
  const modal={cards,config:{category:'レガシー',maxCount:3,totalMaxCost:10}};
  const picked=a._battleCpuDistinctPlacement(modal).map(i=>cards[i]);
  assert.equal(picked.length,3);assert.equal(new Set(picked.map(c=>c.type)).size,3);
  assert.ok(picked.reduce((n,c)=>n+c.cost,0)<=10);
  a.battleSample.self.legacies=Array.from({length:6},()=>card());assert.equal(a._battleCpuDistinctPlacement(modal).length,1);
});

test('ヤマタノオロチは封印中の守護と解放後の龍でカード価値を変える', () => {
  const a=app('10'),guard=card('guard',{text:'【守護】'}),dragon=card('dragon',{type:'龍',attack:2});
  a.battleSample.self.seal=8;assert.ok(a._battleCpuCardPlanValue(guard)>a._battleCpuCardPlanValue(dragon));
  a.battleSample.self.seal=0;assert.ok(a._battleCpuCardPlanValue(dragon)>a._battleCpuCardPlanValue(guard));
});

test('タケミカヅチは天力を温存し、実際に倒せるカードと同じ強化先を選ぶ', async () => {
  const a=targets('4'), me=a.battleSample.self, foe=a.battleSample.opp;
  const big=card('big',{power:7000,attack:3}),small=card('small',{power:2000});
  me.legacies=[big,small];foe.legacies=[card('enemy',{power:2500})];
  a.battleSkillOptions=[{index:1,enabled:true,cost:2},{index:2,enabled:false,cost:6}];
  me.tenryoku=4;assert.equal(a._battleCpuPlannedSkillIndex(),0);
  me.tenryoku=8;assert.equal(a._battleCpuPlannedSkillIndex(),1);
  a._dslCurrentSource={isKami:true,no:'4'};a._battleDivineContext={index:1};a._dslEligible=()=>[big,small];
  assert.deepEqual(await a.dslChooseTargets({対象側:'self',枚数:1},'補正する対象'),[small]);
  small.power=3000;assert.equal(a._battleCpuPlannedSkillIndex(),0);
  small.power=2000;small._sick=true;assert.equal(a._battleCpuPlannedSkillIndex(),0);
});

test('タケミカヅチの創世神技は行動済みの大物より未行動の主力を強化する', async () => {
  const a=targets('4'),used=card('used',{power:9000,attack:3,_tapped:true}),ready=card('ready',{power:3000,attack:2});
  a.battleSample.self.legacies=[used,ready];a._dslCurrentSource={isKami:true,no:'4'};
  a._battleDivineContext={index:2};a._dslEligible=()=>[used,ready];
  assert.deepEqual(await a.dslChooseTargets({対象側:'self',枚数:1},'補正する対象'),[ready]);
});

test('オモイカネは補助札が過剰なら、追加のオラクルより盤面と神攻力を補う', () => {
  const a=app('5'),spell=card('spell',{category:'オラクル',cost:2}),deck=Array.from({length:8},()=>spell);
  const finisher=card('finisher',{cost:3,power:4000,attack:2}),support=card('support',{cost:2,power:1000,attack:0});
  assert.ok(a._gsCpuPlanScore(finisher,deck,['oracleRelic']) > a._gsCpuPlanScore(support,deck,['oracleRelic']));
  assert.ok(a._gsCpuPlanScore(finisher,deck,['oracleRelic']) > 0);
  assert.ok(a._gsCpuPlanScore(spell,deck,['oracleRelic']) < 0);
});

test('オモイカネは盤面札が揃ったら必要なオラクルの相性点を戻す', () => {
  const a=app('5'),spell=card('晴れ空の門出',{category:'オラクル',text:'【招来：社の施し×1】を行い、1枚ドローする'});
  const bodies=Array.from({length:8},()=>card());
  const overloaded=Array.from({length:8},()=>card('other',{category:'オラクル'}));
  assert.ok(a.gsCpuCardTagScore(spell,['oracleRelic'],bodies)>a.gsCpuCardTagScore(spell,['oracleRelic'],overloaded));
  assert.equal(a._gsCpuPlanScore(spell,bodies,['oracleRelic']),0);
});

test('オモイカネはヨリシロへの言及だけで生成加点せず、生成役の過剰も避ける', () => {
  const a=app('5'),mention=card('reference',{text:'自分の「ヨリシロちゃん」は戦闘力が1000上がる'});
  const producer=card('producer',{text:'【招来：ヨリシロちゃん×1】を行う'});
  assert.equal(a.gsCpuCardTagScore(mention,['oracleRelic'],[]),a.gsCpuCardTagScore(card(),['oracleRelic'],[]));
  assert.ok(a.gsCpuCardTagScore(producer,['oracleRelic'],[])>a.gsCpuCardTagScore(producer,['oracleRelic'],[producer,producer,producer,producer]));
});

test('オモイカネの隠者は実際の回収候補で評価し、回収役だけを重ねない', () => {
  const a=app('5'),hermit=card('水晶覗きの隠者',{cost:2,power:1000});
  const target=card('oracle',{category:'オラクル',cost:2}),unfit=card('heavy',{category:'オラクル',cost:5});
  assert.ok(a.gsCpuCardTagScore(hermit,['oracleRelic'],[target])>a.gsCpuCardTagScore(hermit,['oracleRelic'],[unfit]));
  assert.ok(a.gsCpuCardTagScore(hermit,['oracleRelic'],[target])>a.gsCpuCardTagScore(hermit,['oracleRelic'],[hermit,hermit,target]));
});

test('オモイカネは進化元の無い陰陽師を名指しだけで優先しない', () => {
  const a=app('5'),onmyoji=card('84',{name:'お節介な陰陽師',cost:5,text:'【進化：黄レガシー/神使レガシー】'});
  const noBase=Array.from({length:6},()=>card('wrong',{color:'赤',type:'侍'}));
  const withBase=noBase.map(c=>({...c,color:'黄',type:'神使'}));
  assert.ok(a.gsCpuCardTagScore(onmyoji,['oracleRelic'],withBase)>a.gsCpuCardTagScore(onmyoji,['oracleRelic'],noBase));
});

test('オモイカネは打点が揃ったら追加のユニーク打点札より返還点も評価する', () => {
  const a=app('5'),heavy=card('heavy',{attack:2,return:0});
  const deck=[heavy,heavy,...Array.from({length:8},()=>card())];
  const scarce=[...deck];scarce[0]=card();scarce[1]=card();
  assert.ok(a._gsCpuPlanScore(heavy,scarce,['oracleRelic'])>a._gsCpuPlanScore(heavy,deck,['oracleRelic']));
  const common={...heavy,return:2};
  assert.ok(a._gsCpuPlanScore(common,deck,['oracleRelic'])>a._gsCpuPlanScore(heavy,deck,['oracleRelic']));
});
