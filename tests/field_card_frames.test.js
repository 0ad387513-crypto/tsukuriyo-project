'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { fieldCardKind, fieldCardFrameForCard } = require('../field_card_frames.js');
const pool = [
  { no:'1', name:'同名', nickname:'基本', category:'レガシー' },
  { no:'2', name:'同名', nickname:'基本', category:'レガシー' },
  { no:'3', name:'同名', nickname:'別の二つ名', category:'レガシー' },
  { no:'4', name:'龍', type:'龍', color:'創', category:'レガシー' },
  { no:'5', name:'式神', type:'龍', color:'無', isToken:true, category:'レガシー' },
  { no:'6', name:'置物', category:'レリック' },
];

test('field kind uses the real card pool, token priority and full card identity', () => {
  assert.equal(fieldCardKind(pool[0],pool),'basic');
  assert.equal(fieldCardKind(pool[2],pool),'unique');
  assert.equal(fieldCardKind(pool[3],pool),'dragon');
  assert.equal(fieldCardKind(pool[4],pool),'token');
  assert.equal(fieldCardKind({no:'5',name:'式神',type:'龍'},pool),'token','printed token flag also identifies a battle copy');
  assert.equal(fieldCardKind({name:'創の置物',category:'レリック',color:'創'},pool),'genesis');
  assert.equal(fieldCardKind(null,pool),'');
  assert.equal(fieldCardKind(pool[5],pool),'unique');
});

test('field frames reuse stable SVG across stat updates, with distinct ids per displayed instance', () => {
  const card = {...pool[0],power:1000};
  const a = fieldCardFrameForCard(card,pool,'self-legacy-0');
  card.power = 3000;
  card._tapped = true;
  assert.equal(fieldCardFrameForCard(card,pool,'self-legacy-0'),a);
  const b = fieldCardFrameForCard(card,pool,'opp-legacy-0');
  const c = fieldCardFrameForCard({...card},pool,'self-legacy-0');
  assert.notEqual(a.match(/id="([^"]+)/)[1],b.match(/id="([^"]+)/)[1]);
  assert.notEqual(a.match(/id="([^"]+)/)[1],c.match(/id="([^"]+)/)[1]);
  card.type = '龍';
  assert.match(fieldCardFrameForCard(card,pool,'self-legacy-0'),/rarity-dragon/);
  assert.equal(fieldCardFrameForCard(null,pool),'');
});

test('late card data reclassifies a frame and relics use an octagonal shared renderer', () => {
  const card = {...pool[0]};
  assert.match(fieldCardFrameForCard(card,[]),/material-unique/);
  assert.match(fieldCardFrameForCard(card,pool),/material-basic/);
  assert.match(fieldCardFrameForCard(pool[5],pool),/field-relic-frame/);
  assert.match(fieldCardFrameForCard(pool[5],pool),/viewBox="0 0 240 227"/);
  assert.match(fieldCardFrameForCard({name:'創の置物',category:'レリック',color:'創'},pool),/material-unique/);
});

test('only four current-layout field zones receive H frames, including the opponent', () => {
  const root = path.join(__dirname,'..');
  const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.equal((html.match(/class="field-kind-frame"/g)||[]).length,4);
  assert.equal((html.match(/:data-field-kind="battleLayoutV2 \? battleFieldKind\(card\) : null"/g)||[]).length,5,'four field zones plus the hand (rarity of the mana ring)');
  for(const slot of ['opp-relic-','opp-legacy-','self-legacy-','self-relic-']) assert.ok(html.includes("battleFieldFrame(card, '"+slot+"' + i)"));
  assert.equal((html.match(/<script src="field_card_frames\.js\?/g)||[]).length,1);
  assert.ok(html.includes('field_card_frames.css?v='));
  const css=fs.readFileSync(path.join(root,'field_card_frames.css'),'utf8');
  assert.match(css,/pointer-events: none/);
  assert.match(css,/\.battle-layout-v2/);
  const preview=fs.readFileSync(path.join(root,'tools/field-card-kind-preview/index.html'),'utf8');
  assert.match(preview,/historical_field_frames\.js/);
  assert.match(preview,/live_battle_preview\.js/);
  const context={window:{}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'tools/hub/pages.js'),'utf8'),context);
  const page=context.window.DEV_PAGES.find(p=>p.id==='field-kinds');
  assert.equal(page.path,'/tools/field-card-kind-preview/');
  assert.equal(page.title,'フィールドカードの枠');
});
