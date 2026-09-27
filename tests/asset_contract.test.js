"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function localReferences(pattern) {
  return Array.from(html.matchAll(pattern), match => match[1])
    .filter(value => value && !/^(?:https?:|data:|#)/i.test(value))
    .map(value => value.split(/[?#]/)[0]);
}

test("every static script and preload reference exists", () => {
  const refs = [
    ...localReferences(/<script[^>]+src=["']([^"']+)["']/gi),
    ...localReferences(/<link[^>]+href=["']([^"']+)["']/gi),
    "effect_spec.json",
    "card_back.png",
    "coin_front.png",
    "coin_back.png",
    "ui_decorations/higanbana-left.png",
    "ui_decorations/higanbana-right.png",
    "ui_cinematics/kami-summoning-shrine.png",
    "ui_cinematics/bloom-lotus-closed.png",
    "ui_cinematics/bloom-lotus-open.png",
    "ui_cinematics/dies-irae-ritual.png",
    "battle_fields/cosmic-pick.webp",
  ];
  assert.ok(refs.length > 10);
  for (const ref of refs) assert.equal(fs.existsSync(path.join(root, ref)), true, `missing asset: ${ref}`);
});

test("battle fields load raster art and preserve tutorial, Orochi and online selection", () => {
  const themesSource = html.match(/const BATTLE_FIELD_THEMES = Object\.freeze\((\[[\s\S]*?\])\);/);
  assert.ok(themesSource);
  const themes = Function(`return ${themesSource[1]}`)();
  assert.equal(themes.length, 6);
  for (const theme of themes) {
    assert.match(theme.file, /\.webp$/);
    assert.ok(fs.existsSync(path.join(root, theme.file)), `missing field: ${theme.file}`);
  }
  const source = html.match(/_battlePickFieldTheme\(config, self, opp\) \{([\s\S]*?)\r?\n    \},/);
  assert.ok(source);
  const choose = Function('BATTLE_FIELD_THEMES', 'config', 'self', 'opp', source[1]).bind({
    _battleIsOrochiCard: kami => kami && kami.no === '10',
  }, themes);
  for (const theme of themes) {
    assert.equal(choose({ source: 'tutorial', fieldTheme: theme.key }), theme.key);
  }
  assert.equal(choose({ source: 'tutorial', fieldTheme: 'ninja' }, { kami: { no: '10' } }), 'dragon');
  assert.equal(choose({}, null, { kami: { no: '10' } }), 'dragon');
  const online = { syncGame: true, code: 'ROOM123', table: 1, round: 2 };
  assert.equal(choose(online), choose(online));
  for (let i = 0; i < 20; i++) {
    const selected = choose({});
    assert.ok(themes.some(t => t.key === selected));
  }
});

test("shared battle serialization cannot include private hand or deck arrays", () => {
  const body = html.match(/_battleSerializeSide\(side\) \{([\s\S]*?)\r?\n    \},\r?\n    \/\/ 受信サイドを適用/);
  assert.ok(body, "battle serializer was not found");
  assert.match(body[1], /k === 'hand' \|\| k === 'deck'/);
  const hiddenBlock = body[1].match(/if \(k === 'hand' \|\| k === 'deck'\) \{([\s\S]*?)\r?\n        \}/);
  assert.ok(hiddenBlock, "private-zone branch was not found");
  assert.doesNotMatch(hiddenBlock[1], /clone\[k\]\s*=/);
  assert.match(body[1], /clone\.handCount/);
  assert.match(body[1], /clone\.deckCount/);
});
