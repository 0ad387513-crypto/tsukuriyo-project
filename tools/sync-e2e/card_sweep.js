// 全カードの対人テスト：2つのブラウザ（別々の匿名ログイン）で「対戦テスト」の部屋を作り、
// 手番側が全カードを1枚ずつ使う。毎回同じ盤面を用意し、出てくる選択は決まった答え方で自動で選ぶ。
// 確かめること：両方の画面の盤面が同じか／使ったカードが消えていないか／同期エラー・画面のエラーがないか／
// 選ぶ窓が出たまま止まらないか／相手が選んでいる間に手番側が動けないか
// 使い方は README.md を参照（作業用フォルダで npm i puppeteer-core してから実行）
const puppeteer = require(require('module').createRequire(process.cwd() + '/').resolve('puppeteer-core'));
const fs = require('fs');
const URL = process.argv[2] || 'http://localhost:8765/index.html';
const OUT = process.argv[3] || 'card_sweep_result.json';
const ONLY = process.argv[4] ? process.argv[4].split(',') : null; // カードNo を絞るとき（例：12,55）
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'], defaultViewport: { width: 1600, height: 900 } });
  const pages = [await (await browser.createBrowserContext()).newPage(), await (await browser.createBrowserContext()).newPage()];
  const pageErrors = [[], []];
  for (const [i, p] of pages.entries()) {
    p.on('pageerror', e => pageErrors[i].push(e.message));
    p.on('console', m => { if (m.type() === 'error') pageErrors[i].push('console: ' + m.text().slice(0, 200)); });
    p.on('dialog', d => d.accept());
    await p.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await p.waitForFunction(() => { const a = document.querySelector('#app'); return a && a.__vue__ && a.__vue__.allCards.length > 100 && a.__vue__.allKamiCards.length >= 10; }, { timeout: 60000 });
    await p.evaluate(() => { document.querySelector('#app').__vue__.titleScreenOpen = false; });
  }
  const vmCall = (p, code, arg) => p.evaluate(new Function('arg', 'return (async () => { const vm = document.querySelector("#app").__vue__; ' + code + ' })()'), arg);
  let [A, B] = pages;
  await vmCall(A, 'await vm.startBattleTest(true);');
  await wait(1500);
  const code = await vmCall(A, 'return vm.battleNet && vm.battleNet.code;');
  await vmCall(B, 'await vm.startBattleTest(false, arg);', code);
  for (let i = 0; i < 40; i++) {
    for (const p of pages) await vmCall(p, `
      if (vm.battleLoading) { vm._battleLoadingToken = {}; vm.battleLoading = false; try { vm._battleBeginOpeningSequence(); } catch (e) {} }
      if (vm.battleCoinFlip) { try { vm.battleSkipCoinFlip(); } catch (e) {} }
      if (vm.battleMulligan) { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'この手札で開始'); if (b) b.click(); }`);
    const ready = await Promise.all(pages.map(p => vmCall(p, 'return vm.appView === "battle" && !vm.battleCoinFlip && !vm.battleMulligan && !vm.battleLoading;')));
    if (ready.every(Boolean)) break;
    await wait(700);
  }
  await wait(2000);
  // 手番の制限時間は止める（全カードを試す間に自動でターンが終わらないように）
  for (const p of pages) await vmCall(p, 'vm.$set(vm.battleContext, "turnLimitSec", null);');
  if ((await vmCall(A, 'return vm.battleSample.activeSide;')) !== 'self') [A, B] = [B, A];
  console.log('部屋', code);

  // 自動で答える：決まった答え方（任意＝使う・選択＝最初の候補・昇華＝払わない…）
  const RESOLVE = `
    let acted = false;
    const tap = fn => { try { fn(); acted = true; } catch (e) { window.__sweepErr = (window.__sweepErr || []).concat(String(e && e.message)); } };
    if (vm.battleSublimModal) tap(() => vm.battleSublimChoose(Math.min(...vm.battleSublimModal.options)));
    else if (vm.battleRemoteConfirm) tap(() => vm.battleAnswerRemoteConfirm(true));
    else if (vm.dslOptionalModal) tap(() => vm.dslAnswerOptional(true));
    else if (vm.dslChoiceModal) tap(() => { const i = vm.dslChoiceModal.options.findIndex((_, k) => !vm.dslChoiceOptionDisabled(k)); if (i >= 0) vm.dslAnswerChoice(i); else { window.__sweepErr = (window.__sweepErr || []).concat('選べる選択肢がない'); vm.dslCancelChoice(); } });
    else if (vm.dslTargetModal) tap(() => {
      const m = vm.dslTargetModal; const need = Math.max(1, Number(m.need || m.count || 1));
      const sel = (m.selected || []).length;
      const cand = (m.candidates || []).filter(c => !(m.selected || []).includes(c));
      if (!m.candidates || !m.candidates.length) { vm.dslCancelTargets(); return; }
      if (sel < need && cand.length) { vm.dslToggleTarget(cand[0]); }
      if (vm.dslTargetSelectionReady || sel + 1 >= need || !cand.length) vm.dslResolveTargets();
    });
    else if (vm.battleSenteiModal) tap(() => {
      const m = vm.battleSenteiModal;
      for (let i = 0; i < (m.options || []).length && m.selected.length < m.count; i++) if (!m.selected.includes(i) && !vm.battleSenteiOptionDisabled(i)) vm.battleToggleSenteiOption(i);
      vm.battleResolveSentei();
    });
    else if (vm.battleTokenPickModal) tap(() => { const c = (vm.battleTokenPickModal.candidates || vm.battleTokenPickModal.cards || [])[0]; if (c) vm.battleTokenPickPlace(c); else vm.battleTokenPickModal = null; });
    else if (vm.battleConfirmModal) tap(() => vm.battleConfirmApply());
    else if (vm.battleDeckModal) tap(() => {
      // 山札の窓（誘・霊視・招来・公開）：最初に選べるカードを選び、終わったら閉じる
      const m = vm.battleDeckModal;
      if (m.action === 'autoInduce' && (m.eligibleIndexes || []).length) vm.battleDeckPick(m.eligibleIndexes[0]);
      else if (m.action === 'autoSummon' && (m.remaining || 0) > 0 && (m.cards || []).length) vm.battleResolveAutoSummon(0);
      else if (m.action === 'gokugoPick' && !window.__sweepGokugo) {
        window.__sweepGokugo = true;
        const i = (m.cards || []).findIndex(c => c.category === 'レガシー' || c.category === 'レリック');
        if (i >= 0) vm.battleGokugoPick(i, m.cards[i].category); else vm.battleCloseDeckModal();
      }
      else if (m.action === 'gokugoPlaceDistinct' && !window.__sweepGokugo) {
        window.__sweepGokugo = true;
        const i = (m.cards || []).findIndex(c => vm.battleGokugoPlaceDistinctEligible(m, c));
        if (i >= 0) vm.battleGokugoPlaceDistinct(i); else vm.battleCloseDeckModal();
      }
      else vm.battleCloseDeckModal();
    });
    else if (vm.battleOracleEffect) tap(() => { vm.battleOracleEffect = null; });
    else if (vm.battleNotice) tap(() => { vm.battleNotice = null; });
    else {
      // そのほかの窓（選定・山札を見る・誘・霊視など）：窓の中の最初の押せるボタン、なければ「閉じる」系
      const modals = [...document.querySelectorAll('.battle-overlay .battle-zone-modal, .battle-zone-modal')].filter(el => el.offsetParent !== null && !el.closest('[class*="log"]'));
      const top = modals[modals.length - 1];
      if (top && !vm.battleLogModal) {
        const btns = [...top.querySelectorAll('button')].filter(b => !b.disabled && b.offsetParent !== null);
        const skip = /キャンセル|やめる|フィールドを確認|拡大|詳細/;
        const opt = top.querySelector('.sentei-option:not(.selected):not(.disabled)');
        const primary = btns.find(b => !skip.test(b.textContent) && !/閉じる|決定|確定|完了|発動|OK/.test(b.textContent));
        const confirm = btns.find(b => /決定|確定|完了|発動|OK|この内容/.test(b.textContent));
        const close = btns.find(b => /閉じる|戻る|終える|スキップ/.test(b.textContent));
        if (opt && !window.__sweepOptDone) { opt.click(); window.__sweepOptDone = true; acted = true; }
        else if (confirm) { confirm.click(); acted = true; }
        else if (primary) { primary.click(); acted = true; }
        else if (close) { close.click(); acted = true; }
      }
    }
    return acted;`;
  const busy = p => vmCall(p, `return !!(vm._battleIsChoosing() || vm.battleWaitingLabel || vm.battleDeckModal || vm.battleNotice || vm.battleOracleEffect || [...document.querySelectorAll('.battle-zone-modal')].some(el => el.offsetParent !== null));`);

  const snap = p => vmCall(p, `
    const s = vm.battleSample; const nos = a => (a || []).map(c => String(c.no)).sort();
    const side = x => ({ life: x.life, mana: x.mana, manaMax: x.manaMax, tenryoku: x.tenryoku, legacies: nos(x.legacies), relics: nos(x.relics), graveyard: nos(x.graveyard), crumbled: nos(x.crumbled) });
    return { self: side(s.self), opp: side(s.opp), selfHand: nos(s.self.hand), selfDeckN: (s.self.deck || []).length, active: s.activeSide, err: vm.battleNet.lastError, result: s.result };`);

  const cards = await vmCall(A, `
    const seen = new Set();
    return vm.allCards.filter(c => !c.isToken && ['レガシー','オラクル','レリック'].includes(c.category) && !seen.has(String(c.no)) && seen.add(String(c.no)))
      .map(c => ({ no: String(c.no), name: vm.fullName(c), category: c.category, cost: c.cost }));`);
  const list = ONLY ? cards.filter(c => ONLY.includes(c.no)) : cards;
  console.log('カード', list.length, '枚');
  const results = [];
  const startedAt = Date.now();

  for (const [idx, card] of list.entries()) {
    const r = { no: card.no, name: card.name, category: card.category, problems: [] };
    try {
      // 盤面をそろえる（手番側が両方の場・墓地を作り、各自の手札・山札はそれぞれの画面で用意する）
      await vmCall(A, `
        const pick = (pred, n) => vm.allCards.filter(c => !c.isToken && pred(c) && !(c.text || '').trim()).slice(0, n);
        const plain = (pred, n) => { const a = pick(pred, n); return a.length >= n ? a : vm.allCards.filter(c => !c.isToken && pred(c)).slice(0, n); };
        const L = plain(c => c.category === 'レガシー', 4), R = plain(c => c.category === 'レリック', 2), O = plain(c => c.category === 'オラクル', 2);
        const t = vm.battleSample.turn;
        const field = (c, extra) => Object.assign(vm._battlePrepareFieldCard(JSON.parse(JSON.stringify(c))), { _summonedTurn: t - 1 }, extra || {});
        const copy = c => JSON.parse(JSON.stringify(c));
        const self = vm.battleSample.self, opp = vm.battleSample.opp;
        const target = vm.allCards.find(c => String(c.no) === arg);
        Object.assign(self, { life: 10, mana: 10, manaMax: 10, tenryoku: 5, legacies: [field(L[0]), field(L[1])], relics: [field(R[0])], graveyard: [copy(L[2]), copy(O[0])], crumbled: [], hand: [copy(target), copy(L[3]), copy(O[1])], deck: vm.allCards.filter(c => !c.isToken && c.category !== 'カミ').slice(20, 40).map(copy) });
        self.handCount = self.hand.length; self.deckCount = self.deck.length;
        Object.assign(opp, { life: 10, tenryoku: 3, legacies: [field(L[2]), field(L[3], { _tapped: true })], relics: [field(R[1])], graveyard: [copy(L[0]), copy(O[1])], crumbled: [], handCount: 4, deckCount: 20 });
        vm.$set(vm.battleSample, 'result', null);
        vm.$set(vm.battleSample, 'self', Object.assign({}, self)); vm.$set(vm.battleSample, 'opp', Object.assign({}, opp));`, card.no);
      await vmCall(B, `
        const copy = c => JSON.parse(JSON.stringify(c));
        const src = vm.allCards.filter(c => !c.isToken && c.category !== 'カミ');
        vm.battleSample.self.hand = src.slice(60, 64).map(copy); vm.battleSample.self.deck = src.slice(70, 90).map(copy);
        vm.battleSample.self.handCount = 4; vm.battleSample.self.deckCount = 20;`);
      await wait(1800);
      pageErrors[0].length = 0; pageErrors[1].length = 0;
      const before = await snap(A);
      // 使う
      await vmCall(A, `window.__sweepOptDone = false; window.__sweepGokugo = false; const i = vm.battleSample.self.hand.findIndex(c => String(c.no) === arg); if (i >= 0) vm.battlePlayFromHand(i);`, card.no);
      // 選択に答えながら、落ち着くまで待つ（最大30秒）
      let quiet = 0, lockedOk = null, stuckOn = null, prevBChoosing = false;
      const t0 = Date.now();
      while (Date.now() - t0 < 30000) {
        await wait(450);
        const [ba, bb] = [await busy(A), await busy(B)];
        // 相手が選ぶ窓を出している間は手番側が動けないこと（印が届くまでの短い遅れを見込み、2回続けて選んでいるときだけ確かめる）
        const bChoosing = await vmCall(B, 'return !!(vm._battleIsChoosing());');
        if (bChoosing && prevBChoosing) {
          const lk = await vmCall(A, 'return vm.battleActionLocked;');
          if (lockedOk === null) lockedOk = lk; else lockedOk = lockedOk && lk;
        }
        prevBChoosing = bChoosing;
        const actedA = await vmCall(A, RESOLVE);
        const actedB = await vmCall(B, RESOLVE);
        if (!ba && !bb && !actedA && !actedB) { quiet++; if (quiet >= 4) break; } else quiet = 0;
      }
      if (quiet < 4) {
        stuckOn = await vmCall(A, `return [vm.battleWaitingLabel, vm.dslTargetModal && 'target', vm.dslChoiceModal && 'choice', vm.dslOptionalModal && 'optional', vm.battleDeckModal && ('deck:' + vm.battleDeckModal.action), vm.battleSenteiModal && 'sentei', vm.battleConfirmModal && 'confirm'].filter(Boolean).join(',');`)
          + ' / 相手：' + await vmCall(B, `return [vm.battleRemoteConfirm && 'remoteConfirm', vm.dslTargetModal && 'target', vm.dslChoiceModal && 'choice', vm.dslOptionalModal && 'optional', vm.battleDeckModal && ('deck:' + vm.battleDeckModal.action)].filter(Boolean).join(',');`);
        r.problems.push('止まった：' + stuckOn);
        // 片づけ
        for (const p of [A, B]) await vmCall(p, 'vm.dslTargetModal && vm.dslCancelTargets(); vm.dslChoiceModal && vm.dslCancelChoice && vm.dslCancelChoice(); vm.dslOptionalModal && vm.dslAnswerOptional(false); vm.battleDeckModal = null; vm.battleSenteiModal = null; vm.battleConfirmModal = null; vm.battleNotice = null; vm.battleRemoteConfirm && vm.battleAnswerRemoteConfirm(false);');
      }
      if (lockedOk === false) r.problems.push('相手が選んでいる間に手番側が動けた');
      await wait(2200);
      const a = await snap(A), o = await snap(B);
      const pick = v => ({ life: v.life, mana: v.mana, manaMax: v.manaMax, tenryoku: v.tenryoku, legacies: v.legacies, relics: v.relics, graveyard: v.graveyard, crumbled: v.crumbled });
      if (JSON.stringify(pick(a.self)) !== JSON.stringify(pick(o.opp))) r.problems.push('手番側の盤面が食い違う：' + JSON.stringify({ 手番側: pick(a.self), 相手の画面: pick(o.opp) }));
      if (JSON.stringify(pick(a.opp)) !== JSON.stringify(pick(o.self))) r.problems.push('相手側の盤面が食い違う：' + JSON.stringify({ 手番側の画面: pick(a.opp), 相手本人: pick(o.self) }));
      const everywhere = [].concat(a.self.legacies, a.self.relics, a.self.graveyard, a.self.crumbled, a.selfHand, a.opp.legacies, a.opp.relics, a.opp.graveyard, a.opp.crumbled);
      const inDeck = await vmCall(A, 'return (vm.battleSample.self.deck || []).some(c => String(c.no) === arg);', card.no);
      if (!everywhere.includes(card.no) && !inDeck) r.problems.push('使ったカードがどこにもない（消えた）');
      if (a.selfHand.includes(card.no) && JSON.stringify(a.self) === JSON.stringify(before.self)) r.problems.push('使えなかった（手札に残ったまま）');
      if (a.err || o.err) r.problems.push('同期エラー：' + (a.err || o.err));
      const errs = [...new Set([].concat(pageErrors[0], pageErrors[1]).filter(e => !/favicon|404|net::ERR|Failed to load resource/.test(e)))];
      if (errs.length) r.problems.push('画面のエラー：' + errs.slice(0, 3).join(' | '));
      if (a.active !== 'self') { r.problems.push('手番が移った'); if ((await vmCall(B, 'return vm.battleSample.activeSide;')) === 'self') [A, B] = [B, A]; }
    } catch (e) {
      r.problems.push('テスト中の例外：' + (e && e.message));
    }
    results.push(r);
    const mark = r.problems.length ? 'NG' : 'OK';
    console.log(`${String(idx + 1).padStart(3)}/${list.length} ${mark} No.${card.no} ${card.name}${r.problems.length ? '  ' + r.problems.join(' / ').slice(0, 300) : ''}`);
    fs.writeFileSync(OUT, JSON.stringify({ code, startedAt, results }, null, 1));
  }
  await browser.close();
  const ng = results.filter(r => r.problems.length);
  console.log(`\n結果：${results.length - ng.length}/${results.length} 枚OK（${Math.round((Date.now() - startedAt) / 60000)}分）`);
})().catch(e => { console.error(e); process.exit(2); });
