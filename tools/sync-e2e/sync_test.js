// オンライン対戦の同期テスト：2つの独立したブラウザ（別の匿名ログイン）で「対戦テスト」の部屋を作って対戦し、
// 実際に報告された場面（オラクルを使う・自分を横にして招来するレガシーを出す・相手がログを開いている・ターンをまたぐ）で
// 両方の画面の盤面がそろっているか、操作が消えていないかを確かめる
// puppeteer-core はリポジトリに入れないので、実行したフォルダ（作業用フォルダ）から読み込む
const puppeteer = require(require('module').createRequire(process.cwd() + '/').resolve('puppeteer-core'));
const URL = process.argv[2] || 'http://localhost:8765/index.html';
const wait = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log((ok ? 'OK  ' : 'NG  ') + name + (detail ? '  ' + detail : '')); };

(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'], defaultViewport: { width: 1600, height: 900 } });
  const ctxA = await browser.createBrowserContext();
  const ctxB = await browser.createBrowserContext();
  const A = await ctxA.newPage(), B = await ctxB.newPage();
  for (const p of [A, B]) {
    p.on('pageerror', e => console.log('[pageerror]', e.message));
    p.on('dialog', d => d.accept());
    await p.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await p.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue__ && a.__vue__.allCards.length > 100 && a.__vue__.allKamiCards.length >= 10; }, { timeout: 60000 });
    await p.evaluate(() => { const vm = document.querySelector('#app').__vue__; vm.titleScreenOpen = false; });
  }
  const ev = (p, fn, ...args) => p.evaluate(fn, ...args);
  const vmCall = (p, code) => p.evaluate(new Function('return (async () => { const vm = document.querySelector("#app").__vue__; ' + code + ' })()'));

  // 部屋を作って入る
  await vmCall(A, 'await vm.startBattleTest(true);');
  await wait(1500);
  const code = await vmCall(A, 'return vm.battleNet && vm.battleNet.code;');
  check('部屋の作成', !!code, code);
  await vmCall(B, `await vm.startBattleTest(false, '${code}');`);
  // 読み込み・コイントス・マリガンを抜ける
  for (let i = 0; i < 40; i++) {
    for (const p of [A, B]) await vmCall(p, `
      if (vm.battleLoading) { vm._battleLoadingToken = {}; vm.battleLoading = false; try { vm._battleBeginOpeningSequence(); } catch (e) {} }
      if (vm.battleCoinFlip) { try { vm.battleSkipCoinFlip(); } catch (e) {} }
      if (vm.battleMulligan && !vm.battleMulligan.done) { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'この手札で開始'); if (b) b.click(); }`);
    const ready = await Promise.all([A, B].map(p => vmCall(p, 'return vm.appView === "battle" && !vm.battleCoinFlip && !vm.battleMulligan && !vm.battleLoading;')));
    if (ready.every(Boolean)) break;
    await wait(700);
  }
  await wait(2000);
  const sideOf = async p => vmCall(p, 'return vm.battleSample.activeSide;');
  let active = (await sideOf(A)) === 'self' ? A : B, other = active === A ? B : A;
  check('対戦開始（手番が片方だけ）', (await sideOf(active)) === 'self' && (await sideOf(other)) === 'opp');

  // 盤面の要点（自分視点）を取り出す
  const snap = p => vmCall(p, `
    const s = vm.battleSample; const nos = a => (a || []).map(c => String(c.no));
    const side = x => ({ life: x.life, mana: x.mana, manaMax: x.manaMax, tenryoku: x.tenryoku, legacies: nos(x.legacies), relics: nos(x.relics), graveyard: nos(x.graveyard), tapped: (x.legacies || []).map(c => !!c._tapped), hand: x.handCount != null ? x.handCount : (x.hand || []).length });
    return { self: side(s.self), opp: side(s.opp), turn: s.turn, active: s.activeSide, selecting: vm.battleOpponentSelecting, err: vm.battleNet.lastError };`);
  const agree = async (label) => {
    await wait(2500);
    const a = await snap(active), o = await snap(other);
    const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
    const pick = v => ({ life: v.life, mana: v.mana, manaMax: v.manaMax, tenryoku: v.tenryoku, legacies: v.legacies, relics: v.relics, graveyard: v.graveyard });
    check(label + '：手番側の盤面が両方の画面で同じ', same(pick(a.self), pick(o.opp)), same(pick(a.self), pick(o.opp)) ? '' : JSON.stringify({ 手番側: pick(a.self), 相手の画面: pick(o.opp) }));
    check(label + '：相手側の盤面が両方の画面で同じ', same(pick(a.opp), pick(o.self)), same(pick(a.opp), pick(o.self)) ? '' : JSON.stringify({ 手番側の画面: pick(a.opp), 本人: pick(o.self) }));
    if (a.err || o.err) check(label + '：同期エラーなし', false, a.err || o.err);
    return { a, o };
  };

  // カードを手札に入れて、マナを用意する（テスト用）
  const give = (p, name) => vmCall(p, `
    const c = vm.allCards.find(x => x.name === '${name}' || vm.fullName(x) === '${name}');
    if (!c) return false;
    vm.battleSample.self.hand.push(JSON.parse(JSON.stringify(c)));
    vm.battleSample.self.handCount = vm.battleSample.self.hand.length;
    vm.battleSample.self.mana = 10; vm.battleSample.self.manaMax = 10;
    return true;`);
  const play = (p, name) => vmCall(p, `
    const i = vm.battleSample.self.hand.findIndex(x => x.name === '${name}' || vm.fullName(x) === '${name}');
    if (i < 0) return 'nohand';
    vm.battlePlayFromHand(i);
    for (let k = 0; k < 20; k++) {
      await new Promise(r => setTimeout(r, 250));
      if (vm.battleSublimModal) vm.battleSublimChoose(Math.min(...vm.battleSublimModal.options));
      if (vm.battleConfirmModal) vm.battleConfirmApply && vm.battleConfirmApply();
      if (vm.dslOptionalModal && vm.dslOptionalResolve) vm.dslOptionalResolve(true);
    }
    return 'ok';`);

  // 1) 相手がログを開いている間に、手番側がオラクル（晴れ空の門出）を使う
  // 手番側のカミをオモイカネに（オラクル・レリックを使うと天力が増える）
  await vmCall(active, "const k = vm.allKamiCards.find(x => String(parseInt(x.no, 10)) === '5'); vm.$set(vm.battleSample.self, 'kami', JSON.parse(JSON.stringify(k)));");
  await give(active, '晴れ空の門出');
  await agree('準備');
  const before = await snap(active);
  await vmCall(other, 'vm.battleOpenLogModal && vm.battleOpenLogModal("log");');
  const r1 = await play(active, '晴れ空の門出');
  const after1 = await agree('オラクルを使ったあと');
  const usedNo = await vmCall(active, `const c = vm.allCards.find(x => x.name === '晴れ空の門出'); return c && String(c.no);`);
  check('オラクルが墓地にある', after1.a.self.graveyard.includes(usedNo), r1);
  check('マナが減っている', after1.a.self.mana < before.self.mana, `${before.self.mana} → ${after1.a.self.mana}`);
  check('天力が増えている（オラクル/レリックの使用）', after1.a.self.tenryoku > before.self.tenryoku, `${before.self.tenryoku} → ${after1.a.self.tenryoku}`);
  await vmCall(other, 'vm.battleLogModal = null;');

  // 2) 自分を横にして招来するレガシー（麗しの狐姫）を出す
  await give(active, '麗しの狐姫');
  const r2 = await play(active, '麗しの狐姫');
  const after2 = await agree('麗しの狐姫を出したあと');
  const kitsuneNo = await vmCall(active, `const c = vm.allCards.find(x => x.name === '麗しの狐姫'); return c && String(c.no);`);
  check('麗しの狐姫が場に残っている', after2.a.self.legacies.includes(kitsuneNo), r2 + ' ' + JSON.stringify(after2.a.self.legacies));
  check('相手の「選択中」が残っていない', !after2.a.selecting && !after2.o.selecting);

  // 3) ターンを2回またいで、前のターンに出したレガシーが攻撃できるか
  const endTurn = p => vmCall(p, 'vm.battleEndTurn && await vm.battleEndTurn();');
  await endTurn(active); await wait(3000);
  await agree('相手の手番');
  // 相手の手番のうちに、相手の場に【守護】のレガシーと【死亡時】のレガシー（二尾の猫女、横向き）を置いておく
  await vmCall(other, `
    const t = vm.battleSample.turn;
    const guard = vm.allCards.find(c => c.category === 'レガシー' && !c.isToken && vm.battleCardHasKeyword(c, '守護'));
    const cat = vm.allCards.find(c => c.name === '二尾の猫女');
    const mk = (c, tapped) => Object.assign(vm._battlePrepareFieldCard(JSON.parse(JSON.stringify(c))), { _summonedTurn: t - 1, _tapped: tapped });
    vm.battleSample.self.legacies.push(mk(guard, false), mk(cat, true));
    vm.$set(vm.battleSample.self, 'legacies', vm.battleSample.self.legacies.slice());`);
  await agree('相手の場に守護と死亡時のレガシーを置いたあと');
  await endTurn(other); await wait(3500);
  const back = await agree('自分の手番に戻ったあと');
  check('手番が戻っている', back.a.active === 'self', back.a.active);
  const canAttack = await vmCall(active, `
    const ls = vm.battleSample.self.legacies || [];
    return ls.filter(c => !c.isToken).map(c => { const r = vm.battleLegacyCanAct(c, 'divine'); return { name: c.name, ok: !!(r && r.ok), why: r && r.reason, tapped: !!c._tapped, sick: vm.battleLegacyIsSummonedThisTurn(c) }; });`);
  check('前のターンのレガシーが縦向き（アンタップ）', canAttack.every(c => !c.tapped), JSON.stringify(canAttack));
  check('前のターンのレガシーが攻撃できる', canAttack.every(c => c.ok), JSON.stringify(canAttack));
  check('相手の「選択中」が残っていない（手番が戻ったあと）', !back.a.selecting);

  // 4) 守護：手番側が神攻すると、相手に「守護で引き受けるか」の確認が出る。答えるまで手番側は動けない
  await vmCall(active, `
    const t = vm.battleSample.turn;
    const strong = vm.allCards.filter(c => c.category === 'レガシー' && !c.isToken && Number(c.power) >= 3000 && !vm.battleCardHasKeyword(c, '守護')).slice(0, 2);
    strong.forEach(c => vm.battleSample.self.legacies.push(Object.assign(vm._battlePrepareFieldCard(JSON.parse(JSON.stringify(c))), { _summonedTurn: t - 1 })));
    vm.$set(vm.battleSample.self, 'legacies', vm.battleSample.self.legacies.slice());`);
  await agree('手番側に攻撃役を置いたあと');
  const atkIdx = await vmCall(active, 'return vm.battleSample.self.legacies.length - 2;');
  vmCall(active, `vm.battleResolveDivineAttack('self', ${atkIdx}, null);`).catch(() => {});
  let askedGuard = false;
  for (let i = 0; i < 20 && !askedGuard; i++) { await wait(400); askedGuard = await vmCall(other, 'return !!vm.battleRemoteConfirm;'); }
  check('守護：相手に引き受けるかの確認が出る', askedGuard);
  check('守護：確認の間、手番側は操作できない', await vmCall(active, 'return vm.battleActionLocked;'));
  await vmCall(active, 'await vm.battleEndTurn();'); await wait(800);
  check('守護：確認の間はターンを終えられない', await vmCall(active, 'return vm.battleSample.activeSide === "self";'));
  await vmCall(other, 'await vm.battleAnswerRemoteConfirm(true);');
  await wait(2500);
  check('守護：答えたあとは手番側が動ける', !(await vmCall(active, 'return vm.battleActionLocked;')));
  await agree('守護で引き受けたあと');
  check('守護：引き受けたレガシーが横向き', await vmCall(other, `return vm.battleSample.self.legacies.some(c => vm.battleCardHasKeyword(c, '守護') && c._tapped);`));

  // 5) 死亡時：相手の二尾の猫女を戦闘で倒すと、相手の画面で死亡時効果（相手レガシーを1枚破壊してもよい）を選ぶ。選び終わるまで手番側は動けない
  const catIdx = await vmCall(active, `return vm.battleSample.opp.legacies.findIndex(c => c.name === '二尾の猫女');`);
  const atk2 = await vmCall(active, 'return vm.battleSample.self.legacies.length - 1;');
  const beforeDeath = await snap(active);
  vmCall(active, `vm.battleResolveLegacyBattle('self', ${atk2}, 'opp', ${catIdx});`).catch(() => {});
  let askedDeath = false;
  for (let i = 0; i < 25 && !askedDeath; i++) { await wait(400); askedDeath = await vmCall(other, 'return !!(vm.dslOptionalModal || vm.dslTargetModal);'); }
  check('死亡時：相手の画面で選ぶ窓が出る', askedDeath);
  check('死亡時：選んでいる間、手番側は操作できない', await vmCall(active, 'return vm.battleActionLocked;'));
  await vmCall(other, `
    for (let k = 0; k < 10; k++) {
      if (vm.dslOptionalModal) vm.dslAnswerOptional(true);
      else if (vm.dslTargetModal) { const c = (vm.dslTargetModal.candidates || [])[0]; if (c) vm.dslToggleTarget(c); vm.dslResolveTargets(); }
      await new Promise(r => setTimeout(r, 400));
    }`);
  await wait(3000);
  check('死亡時：選び終えたあとは手番側が動ける', !(await vmCall(active, 'return vm.battleActionLocked;')));
  const d = await agree('死亡時効果のあと');
  const catNo = await vmCall(active, `return String(vm.allCards.find(c => c.name === '二尾の猫女').no);`);
  check('死亡時：二尾の猫女が相手の墓地にある', d.o.self.graveyard.includes(catNo));
  check('死亡時：効果で手番側のレガシーが1枚減っている', d.a.self.legacies.length < beforeDeath.self.legacies.length, `${beforeDeath.self.legacies.length} → ${d.a.self.legacies.length}`);

  await browser.close();
  const ng = results.filter(r => !r.ok);
  console.log(`\n結果：${results.length - ng.length}/${results.length} 件OK`);
  process.exit(ng.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
