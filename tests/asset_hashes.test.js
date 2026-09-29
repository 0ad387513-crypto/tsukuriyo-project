"use strict";
/* 本番ではカード画像・カミの画像・ボイス・BGM・効果音を長期キャッシュし、URLの ?h= に付けた中身の識別子で
   更新を知らせている。一覧（asset_hashes.js）が古いと、差し替えた素材がプレイヤーに届かないため、
   実際のファイルと一致しているかを確かめる。失敗したら node scripts/build_asset_hashes.js を実行する。 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { buildAssetHashes, OUTPUT } = require("../scripts/build_asset_hashes");

const root = path.resolve(__dirname, "..");

test("asset_hashes.js matches the current images and sounds", () => {
  const expected = buildAssetHashes(root);
  const { ASSET_HASHES } = require(path.join(root, OUTPUT));
  const stale = Object.keys(expected).filter(k => ASSET_HASHES[k] !== expected[k]);
  const removed = Object.keys(ASSET_HASHES).filter(k => !(k in expected));
  assert.deepEqual({ stale: stale.slice(0, 10), removed: removed.slice(0, 10) }, { stale: [], removed: [] },
    "asset_hashes.js が古いままです。node scripts/build_asset_hashes.js を実行してください");
});

test("hashed asset folders are loaded only through assetUrl()", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /<script src="asset_hashes\.js"><\/script>/);
  assert.match(html, /function assetUrl\(rawPath\)/);
  // 長期キャッシュのフォルダを、識別子なしの固定URLで直接読み込んでいないこと
  const direct = html.match(/(?:src|href)="(?:card_images|kami_card_images|kami_illustrations|voices|bgm|sfx)\//g) || [];
  assert.deepEqual(direct, []);
  const headers = fs.readFileSync(path.join(root, "_headers"), "utf8");
  for (const dir of ["card_images", "kami_card_images", "kami_illustrations", "voices", "bgm", "sfx"]) {
    assert.match(headers, new RegExp(`/${dir}/\\*\\r?\\n  Cache-Control: public, max-age=31536000, immutable`));
  }
});
