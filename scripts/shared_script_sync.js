"use strict";
/*
  試聴室で変えたカードボイスの台詞を、メンバー共有ページの台本（claude.ai の artifact の db：lines / pairs）に入れる前の確認。
  tools/voice-script/shared_sync_pending.json（試聴室で台詞を変えたときにたまる）のうち、
  音声を作ったときの台詞（voices/cards/spoken.json）と同じものだけを「入れてよい」とする。音声がまだ前の台詞のものは、作り直すまで入れない。

  使い方：node scripts/shared_script_sync.js            … 入れてよい台詞と、待つ台詞を表示（JSON は --json）
          node scripts/shared_script_sync.js --done n001-attack,n003-summon … 共有ページに入れた台詞を pending から消す
  共有ページへの書き込みは Claude が ArtifactData（if_version 付きの batch update）で行う。
*/
const fs = require("node:fs");
const path = require("node:path");
const { displayText } = require("./build_card_voice_manifest.js");

const root = path.resolve(__dirname, "..");
const pendingFile = path.join(root, "tools", "voice-script", "shared_sync_pending.json");
const spokenFile = path.join(root, "voices", "cards", "spoken.json");
const readJson = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; } };
const args = process.argv.slice(2);

const pending = readJson(pendingFile, {});
if (args[0] === "--done") {
  const refs = String(args[1] || "").split(",").filter(Boolean);
  for (const ref of refs) delete pending[ref];
  fs.writeFileSync(pendingFile, JSON.stringify(pending, null, 1) + "\n");
  console.log(`共有ページに入れた ${refs.length} 本を一覧から消しました（残り ${Object.keys(pending).length} 本）`);
  return;
}
const spoken = readJson(spokenFile, {});
const ready = [], waiting = [];
for (const [ref, p] of Object.entries(pending)) {
  const made = spoken[ref];
  // 音声の台詞は読み方の指定（漢字（よみ）など）を含むことがあるので、画面に出す文に直して比べる
  const same = made && (made.line === p.text || displayText(p.text, made.line) === p.text);
  (same ? ready : waiting).push(Object.assign({ ref }, p, { audioLine: made ? made.line : null }));
}
if (args.includes("--json")) { console.log(JSON.stringify({ ready, waiting }, null, 1)); return; }
console.log(`入れてよい台詞：${ready.length}本`);
for (const x of ready) console.log(`  ${x.ref}（${x.collection}/${x.id} の ${x.field}）：${x.text}`);
console.log(`音声を作り直すまで待つ台詞：${waiting.length}本`);
for (const x of waiting) console.log(`  ${x.ref}：台本「${x.text}」／音声「${x.audioLine || "（記録なし）"}」`);
