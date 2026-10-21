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
    battleSample: { turn: 4, self: { mana: 5, manaMax: 5, life: 10, lifeMax: 10, hand: [], legacies: [], relics: [], graveyard: [] }, opp: { life: 10, handCount: 4, legacies: [], relics: [] } },
    battleContext: { firstSide: 'self', cpuStrength: 'standard' },
    battleFieldLimit: () => 7,
    battleCardHasKeyword: has,
    battleSublimCostOptions: c => c.costs || [Number(c.cost)],
    battleLegacyCanAct: c => ({ ok: !c._tapped && !c._sick }),
    battleCanTargetLegacy: () => true,
    battleCanDeclareAttackTarget: (a, d) => !!d._tapped,
    _battleCpuOracleUseless: () => false,
    _battleKamiNo: () => 'K2', battleEffectiveCost: c => Number(c.cost),
    _dslEvolutionBaseCandidates: c => c._bases || [],
    _dslGetSpec: c => c.spec || null,
    fullName: c => c.name,
    _battleIsEffectDisabled: c => !!c._effectsDisabled,
    _battleIsBindingActive: c => !!c._bound,
    battleCardMatchesInduceCriteria: (c, cs) => !cs.length || cs.includes(c.category),
    $nextTick: () => Promise.resolve(),
  };
  for (const name of ['_battleCpuDefenseState', '_battleCpuRemovalValue', '_battleCpuEffectValue', '_battleCpuImmediateEffectValue', '_battleCpuShrines', '_battleCpuChooseMainPlan', '_battleCpuIsStandard',
    '_battleCpuKeepValue', '_battleCpuDiscardLoss', '_battleCpuRerollCard', '_battleCpuPickSubset', '_battleCpuShouldUseOptional', '_battleCpuPredictBattle', '_battleCpuGuardScore', '_battleCpuDecideGuard',
    '_battleCpuWeights', '_battleCpuUnitValue', '_battleCpuCardPlanValue', '_battleCpuPlayOptions', '_battleCpuLifeScore', '_battleCpuModelUnit',
    '_battleCpuModelFight', '_battleCpuModelPickGuard', '_battleCpuPlanAttacks', '_battleTrackDeathEffect', '_battleWaitNewDeathEffects',
    '_battleRunDeathEffectsInOrder']) a[name] = method(name);
  return a;
}

const destroy = (props = {}) => ({ 操作: '破壊', 対象: { 対象側: 'opp', 領域: 'field', 絞込: ['レガシー'], 枚数: 1, ...props } });
function spell(no, actions, cost = 2) {
  return card(no, { category: 'オラクル', power: 0, attack: 0, cost, spec: { 能力: [{ 契機: '使用時', 処理: actions }] } });
}
test('社で2コストの展開を候補化し、タップ・拘束・無効な社は使わない', () => {
  const a=app(),me=a.battleSample.self;a.battleContext.firstSide='opp';me.mana=1;me.relics=[card('186')];
  const c=card('two');assert.equal(a._battleCpuPlayOptions(c).length,1);
  assert.equal(a._battleCpuChooseMainPlan([a._battleCpuPlayOptions(c)])[0].card,c);
  for(const prop of ['_tapped','_bound','_effectsDisabled']) {
    me.relics[0][prop]=true;assert.equal(a._battleCpuPlayOptions(c).length,0,prop);me.relics[0][prop]=false;
  }
});
test('小さい価値差やマナ消費だけのために社を使わず、危機には社を使う', () => {
  const a=app(),me=a.battleSample.self;me.mana=1;me.relics=[card('186')];
  const cheap={card:card('cheap'),cost:1,value:4,zone:'legacies'},expensive={...cheap,card:card('extra'),cost:2,value:4.3};
  assert.equal(a._battleCpuChooseMainPlan([[cheap,expensive]])[0],cheap);
  me.life=2;a.battleContext.firstSide='opp';a.battleSample.opp.legacies=[card('threat',{attack:2})];expensive.value=6;
  assert.equal(a._battleCpuChooseMainPlan([[cheap,expensive]])[0],expensive);
});
test('後攻は高コストの消費より、致死打点を除去できる安いオラクルを優先する', () => {
  const a=app(),me=a.battleSample.self;a.battleContext.firstSide='opp';me.mana=5;me.life=3;
  a.battleSample.opp.legacies=[card('finisher',{power:5000,attack:4})];
  const removal=spell('remove',[destroy()],2),big=card('big',{cost:5,power:5000,attack:1});
  assert.equal(a._battleCpuChooseMainPlan([a._battleCpuPlayOptions(removal),a._battleCpuPlayOptions(big)])[0].card,removal);
});
test('全体除去は味方の損失と戦闘力上限を評価する', () => {
  const a=app();a.battleSample.opp.legacies=[card('foe',{power:2000})];a.battleSample.self.legacies=[card('own',{power:3000,attack:3})];
  const wipe={操作:'破壊',対象:{領域:'field',絞込:['レガシー'],比較:'powerLE:4000',枚数:'all'}};
  assert.ok(a._battleCpuEffectValue([wipe],card())<0);
  a.battleSample.self.legacies=[];a.battleSample.opp.legacies=[card('big',{power:5000})];assert.equal(a._battleCpuEffectValue([wipe],card()),0);
});
test('昇華による相手限定の全体除去と、死亡時効果を区別する', () => {
  const a=app();a.battleSample.self.legacies=[card('own',{attack:3})];a.battleSample.opp.legacies=[card('foe')];
  const action={操作:'破壊',対象:{領域:'field',枚数:'all'},昇華代替:[{昇華:3,効果:'相手レガシーのみに限定'}]},c=spell('wipe',[action],2);
  assert.ok(a._battleCpuImmediateEffectValue(c,5)>a._battleCpuImmediateEffectValue(c,2));
  c.spec.能力[0].契機='死亡時';assert.equal(a._battleCpuImmediateEffectValue(c,5),0);
});
test('選定は危機を止める除去を選び、初心者は従来順を保つ', () => {
  const a=app();a.battleSample.self.life=2;a.battleContext.firstSide='opp';a.battleSample.opp.legacies=[card('danger',{attack:3,power:5000})];
  a.battleHasSenteiBoostLegacy=()=>false;a.battleSenteiOptionDisabled=i=>i===2;let picks;
  a.battleResolveSentei=()=>{picks=a.battleSenteiModal.selected.slice()};
  const s={count:1,options:['draw','remove','disabled'],optionData:[{処理:[{操作:'ドロー',数:2}]},{処理:[destroy()]},{処理:[{操作:'ライフ',側:'opp',数:-10}]}],paidCost:2,baseCost:2};
  a._battleCpuAutoResolving=true;method('battleOpenSentei').call(a,card(),s);assert.deepEqual(picks,[1]);
  a.battleContext.cpuStrength='beginner';method('battleOpenSentei').call(a,card(),s);assert.deepEqual(picks,[0]);
});
test('後攻は危険な盤面で守護を追加評価する', () => {
  const a=app();a.battleContext.firstSide='opp';a.battleSample.opp.legacies=[card('foe',{attack:3})];
  assert.ok(a._battleCpuPlayOptions(card('guard',{text:'【守護】'}))[0].value>a._battleCpuPlayOptions(card())[0].value+1);
});
test('後攻が手番を返せば先攻が疲労死する時、守護を攻撃に使わない', () => {
  const a=app();a.battleContext.firstSide='opp';a.battleSample.turn=11;a.battleSample.self.life=4;a.battleSample.opp.life=2;
  a.battleSample.self.legacies=[card('guard',{power:5000,text:'【守護】'})];a.battleSample.opp.legacies=[card('foe',{power:1000,attack:3})];
  assert.equal(a._battleCpuDefenseState().fatigueWin,true);assert.equal(a._battleCpuPlanAttacks(),null);
});
test('CPU視点でも先後が正しく、相手の非公開手札・山札を読まない', () => {
  const a=app();a.battleContext.firstSide='self';a._dslSwapped=true;
  Object.defineProperty(a.battleSample.opp,'hand',{get(){throw Error('private hand')}});
  Object.defineProperty(a.battleSample.opp,'deck',{get(){throw Error('private deck')}});
  a.battleSample.opp.legacies=[card('foe')];assert.equal(a._battleCpuDefenseState().second,true);
  assert.ok(a._battleCpuEffectValue([destroy()],card())>0);assert.doesNotThrow(()=>a._battleCpuChooseMainPlan([a._battleCpuPlayOptions(card())]));
});
test('同じ対象を連続で破壊する価値を重複計上しない', () => {
  const a=app();a.battleSample.opp.legacies=[card('foe')];
  assert.equal(a._battleCpuEffectValue([destroy(),destroy()],card()),a._battleCpuEffectValue([destroy()],card()));
});
test('社が必要な時は正規支払いを経由する',async()=>{
  const a=app(),me=a.battleSample.self;me.mana=1;me.hand=[card('two')];me.relics=[card('186')];
  a._battleCpuUseGenesisSkill=async()=>{};a._battleCpuThinkPause=async()=>{};a._battleWaitPendingDeathEffects=async()=>{};a.fullName=c=>c.name;
  let paid;a.battleUseShrineManaForCost=async p=>{paid=p;me.hand=[];me.mana=0};
  await method('_battleCpuSmartMainPhase').call(a,()=>true);assert.equal(paid.cost,2);assert.equal(paid.cardNo,'two');assert.equal(paid.cpuActiveShrines,true);
});

test('合計戦闘力制約では先頭の大物だけでなく合法な複数枚の組み合わせを比較する',()=>{
  const a=app();a.fullName=c=>c.name;
  const big=card('big',{power:4000}),x=card('x',{power:2000}),y=card('y',{power:2000});
  const picks=a._battleCpuPickSubset([big,x,y],2,c=>c===big?10:7,4000,true);
  assert.deepEqual(new Set(picks),new Set([x,y]));
});
test('数字宣言は0固定でなく、味方の損失より大きな相手の損失を作るコストを選ぶ',async()=>{
  const a=app();a._battleCpuAutoResolving=true;
  a.battleSample.self.legacies=[card('own',{cost:2,power:7000})];
  a.battleSample.opp.legacies=[card('a',{cost:3,power:3000}),card('b',{cost:3,power:4000})];
  const i=await method('dslAskChoice').call(a,card(),'宣言する数字（コスト）を選択してください',Array.from({length:11},(_,i)=>`コスト${i}`));
  assert.equal(i,3);
});
test('一般選択も条件を満たす候補の効果を比較し、候補がなければ-1を返す',async()=>{
  const a=app();a._battleCpuAutoResolving=true;a._dslChoiceOptionConditionMet=o=>!o.disabled;
  a.battleSample.opp.legacies=[card('danger',{power:5000,attack:3})];
  const meta={optionData:[{処理:[{操作:'ドロー',数:1}]},{処理:[destroy()]},{disabled:true,処理:[{操作:'ライフ',側:'opp',数:-10}]}]};
  assert.equal(await method('dslAskChoice').call(a,card(),'効果を選んでください',['draw','remove','disabled'],meta),1);
  a._dslChoiceOptionConditionMet=()=>false;assert.equal(await method('dslAskChoice').call(a,card(),'choice',[],meta),-1);
});
test('誘は最初の候補より、今使えて危機を解決する札を取る',()=>{
  const a=app();a._battleCpuAutoResolving=true;a.fullName=c=>c.name;
  a.battleSample.self.life=2;a.battleSample.self.manaMax=2;a.battleSample.self.deck=[card('too-late',{cost:9}),spell('answer',[destroy()])];
  a.battleSample.opp.legacies=[card('threat',{attack:3,power:5000})];
  a.battleCardMatchesInduceCriteria=()=>true;let pick;a.battleResolveAutoInduce=i=>{pick=i};
  method('battleOpenAutoInduce').call(a,card(),{count:2,criteria:[]});assert.equal(pick,1);
});
test('霊視は固定で全残しせず墓地起動札を送り、必要な除去を上に残す',()=>{
  const a=app();a._battleCpuAutoResolving=true;
  const grave=card('grave',{spec:{能力:[{契機:'墓地起動',処理:[]}]}}),answer=spell('answer',[destroy()]);
  a.battleSample.self.deck=[grave,answer];let selected;a.battleResolveAutoReishi=()=>{selected=a.battleDeckModal.selectedIndexes};
  method('battleOpenAutoReishi').call(a,card(),{count:2});assert.deepEqual(selected,[0]);
});
test('任意効果は低価値のレリックを失って大きな脅威を除去する取引を評価する',()=>{
  const a=app();a.battleSample.self.relics=[card('sac',{category:'レリック',power:0,attack:0,cost:0})];
  a.battleSample.opp.legacies=[card('danger',{power:5000,attack:4})];
  const c=card('trade',{spec:{能力:[{契機:'戦闘時',任意:true,処理:[{操作:'破壊',対象:{対象側:'self',領域:'field',絞込:['レリック'],枚数:1},後続:[destroy()]}]}]}});
  assert.equal(a._battleCpuShouldUseOptional('自分のレリックを破壊することで',c,'戦闘時'),true);
  a.battleSample.opp.legacies=[];assert.equal(a._battleCpuShouldUseOptional('自分のレリックを破壊することで',c,'戦闘時'),false);
});
test('小さい神攻には主力守護を温存し、とどめになる神攻は受ける',()=>{
  const a=app(),guard=card('ace',{cost:6,power:4000,attack:3,text:'【守護】'}),attacker=card('killer',{power:7000,attack:1});
  a.battleSample.self.legacies=[guard];a.battleSample.opp.legacies=[attacker];
  assert.equal(a._battleCpuDecideGuard(guard,attacker,true),false);
  a.battleSample.self.life=1;assert.equal(a._battleCpuDecideGuard(guard,attacker,true),true);
});
test('強い守護が先に並んでいても、小さい守護で十分に受けられるならそちらを使う',()=>{
  const a=app(),big=card('big',{power:7000,cost:7,text:'【守護】'}),small=card('small',{power:3000,cost:2,text:'【守護】'}),attacker=card('a',{power:2000});
  a.battleSample.self.legacies=[big,small];a.battleSample.opp.legacies=[attacker];
  assert.equal(a._battleCpuDecideGuard(big,attacker,true),false);assert.equal(a._battleCpuDecideGuard(small,attacker,true),true);
});

test('リロールは今使える除去を残し、当面使えない札を入れ替える。山札が空なら行わない',()=>{
  const a=app(),me=a.battleSample.self;me.mana=2;me.manaMax=2;me.deck=[card()];
  const answer=spell('answer',[destroy()]),late=card('late',{cost:9});me.hand=[answer,late];a.battleSample.opp.legacies=[card('danger',{power:5000,attack:4})];
  assert.equal(a._battleCpuRerollCard([answer,late]),late);
  assert.equal(a._battleCpuRerollCard([answer]),null);me.deck=[];assert.equal(a._battleCpuRerollCard([late]),null);
});
test('進化元は強い主力を機械的に重ねず、小さい土台を選ぶ',async()=>{
  const a=app();a._battleCpuAutoResolving=true;
  const strong=card('strong',{power:7000}),weak=card('weak',{power:1000});
  assert.deepEqual(await method('dslAskCustomTargets').call(a,'進化元となるレガシーを選択',[strong,weak],1,card()),[weak]);
});
test('オンライン部屋のCPUの捨て札判断は存在しないクライアントへ委譲せず、本人の視点で実行する',async()=>{
  const a=app(),low=card('low',{power:1000,cost:1}),high=card('high',{power:5000,cost:3});
  a.battleContext.oppIsCpu=true;a.battleNet={on:true};a.battleSample.opp.hand=[low,high];a.battleSample.opp.manaMax=3;a.battleSample.opp.graveyard=[];
  a._battleDelegateOpponentDiscard=()=>{throw Error('no CPU client')};
  a._dslSwapSelfOpp=()=>{[a.battleSample.self,a.battleSample.opp]=[a.battleSample.opp,a.battleSample.self];a._dslSwapped=!a._dslSwapped};
  a.battleSaveUndo=()=>{};a._battleSyncSideCounts=()=>{};a.dslRefreshStaticAbilities=()=>{};a.battleShowNotice=()=>{};a._battleRunDeathEffectsInOrder=async()=>{};
  await method('_dslOpOpponentChooseDiscard').call(a,{数:1,領域:'hand'},card());
  assert.deepEqual(a.battleSample.opp.hand,[high]);assert.deepEqual(a.battleSample.opp.graveyard,[low]);assert.equal(a._dslSwapped,false);
});

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
