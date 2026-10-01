"use strict";
/*
  画像・音声の「中身の識別子（ハッシュ）」の一覧 asset_hashes.js を作る。

  ゲームはこの一覧を使って、URLに `?h=識別子` を付けて読み込む（assetUrl()）。
  中身が変わったときだけURLが変わるので、本番ではこれらのファイルを長期間キャッシュでき、
  更新のたびに全部を取り直さずに済む（_headers で1年キャッシュを指定している）。

  使い方：画像・音声を追加・差し替えたら
    node scripts/build_asset_hashes.js          # 一覧を作り直す（npm run assets:hash でも同じ）
  一覧が古いままだと npm test（tests/asset_contract.test.js）が失敗する。
  カード編集室（scripts/serve.js）でカード画像を保存したときは自動で更新される。
*/
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

// 対象：URLに識別子を付けて読み込む素材（manifest.json などの一覧ファイルは対象外）
const ASSET_DIRS = [
  { dir: "card_images", ext: /\.webp$/i },
  { dir: "kami_card_images", ext: /\.webp$/i },
  { dir: "kami_illustrations", ext: /\.(webp|png|jpe?g)$/i },
  // previews・trials（試し作り）・_raw はローカル専用で本番に出さないため、一覧に入れない
  { dir: "voices", ext: /\.(mp3|wav)$/i, skip: /^(previews|trials|_raw)\// },
  { dir: "bgm", ext: /\.(mp3|ogg|wav|m4a)$/i, skip: /^op-candidates\// },
  { dir: "sfx", ext: /\.(mp3|ogg|wav|m4a)$/i },
];
const OUTPUT = "asset_hashes.js";

function hashFile(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").slice(0, 10);
}

function walk(base, rel, out) {
  const abs = path.join(base, rel);
  if (!fs.existsSync(abs)) return;
  for (const name of fs.readdirSync(abs)) {
    const childRel = rel ? rel + "/" + name : name;
    const childAbs = path.join(base, childRel);
    if (fs.statSync(childAbs).isDirectory()) walk(base, childRel, out);
    else out.push(childRel);
  }
}

function buildAssetHashes(root) {
  const hashes = {};
  for (const { dir, ext, skip } of ASSET_DIRS) {
    const files = [];
    walk(path.join(root, dir), "", files);
    for (const rel of files.sort()) {
      if (!ext.test(rel) || (skip && skip.test(rel))) continue;
      hashes[dir + "/" + rel] = hashFile(path.join(root, dir, rel));
    }
  }
  return hashes;
}

function renderAssetHashes(hashes) {
  const keys = Object.keys(hashes).sort();
  const lines = keys.map(k => `  ${JSON.stringify(k)}: ${JSON.stringify(hashes[k])},`);
  return [
    '"use strict";',
    "/* 自動生成ファイル（node scripts/build_asset_hashes.js）。画像・音声の中身の識別子の一覧。手で編集しない。 */",
    "const ASSET_HASHES = Object.freeze({",
    ...lines,
    "});",
    'if (typeof module !== "undefined") module.exports = { ASSET_HASHES };',
    "",
  ].join("\n");
}

function writeAssetHashes(root) {
  const hashes = buildAssetHashes(root);
  fs.writeFileSync(path.join(root, OUTPUT), renderAssetHashes(hashes));
  return hashes;
}

// 指定したファイルだけ識別子を更新する（カード編集室で1枚ずつ保存するとき用。全体を読み直すより速い）
function updateAssetHashes(root, relPaths) {
  const file = path.join(root, OUTPUT);
  let hashes = {};
  try {
    delete require.cache[require.resolve(file)];
    hashes = Object.assign({}, require(file).ASSET_HASHES);
  } catch (e) {
    hashes = buildAssetHashes(root);
  }
  for (const rel of relPaths) {
    const abs = path.join(root, rel);
    if (fs.existsSync(abs)) hashes[rel] = hashFile(abs);
    else delete hashes[rel];
  }
  fs.writeFileSync(file, renderAssetHashes(hashes));
  return hashes;
}

module.exports = { ASSET_DIRS, OUTPUT, buildAssetHashes, renderAssetHashes, writeAssetHashes, updateAssetHashes };

if (require.main === module) {
  const root = path.resolve(__dirname, "..");
  const hashes = writeAssetHashes(root);
  console.log(`${OUTPUT} を更新しました（${Object.keys(hashes).length}件）`);
}
