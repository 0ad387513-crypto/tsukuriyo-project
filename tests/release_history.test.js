"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createSnapshot } = require("../scripts/build_release_history.js");
const { filterReleaseEntries } = require("../tools/hub/releases.js");
const head = "a".repeat(40), older = "b".repeat(40), archived = "c".repeat(40);
const row = (id,author,subject) => [id,"2026-10-19T21:00:00+09:00",author,subject].join("\x1f")+"\x1e\n";
function fakeGit(calls) {
  return args => {
    calls.push(args);
    if(args[0]==="rev-parse") return head+"\n";
    if(args[0]==="show") return 'const TSUKURIYO_BUILD_VERSION = "1.15.537";';
    if(args[0]==="log") return row(head,"キジマ","feat: 履歴を公開 v1.15.537")+row(older,"別メンバー","fix: 選択の不具合を修正");
    throw Error("Unexpected Git command");
  };
}
test("公開コミットから全担当者とバージョン未記載の変更も記録し、作業中ファイルを読まない",()=>{
  const calls=[];
  const data=createSnapshot({ref:"origin/main",git:fakeGit(calls),now:"2026-10-19T12:00:00Z",
    notes:[{version:"1.15.537",title:"本番の修正履歴",changes:["自動記録"]}]});
  assert.equal(data.commit,head); assert.equal(data.version,"1.15.537");
  assert.deepEqual(data.entries.map(e=>e.author),["キジマ","別メンバー"]);
  assert.equal(data.entries[0].title,"本番の修正履歴"); assert.equal(data.entries[1].version,null);
  assert.equal(data.entries[1].title,"選択の不具合を修正");
  assert.deepEqual(calls[1],["show",head+":version.js"]);
  assert.ok(!calls[2].some(a=>a.includes("author")||a.includes("first-parent")));
});
test("履歴の浅いチェックアウトでも過去の公開分を保持し、同じコミットを重複させない",()=>{
  const previous={repository:"https://github.com/0ad387513-crypto/tsukuriyo-project",entries:[{id:older,author:"別メンバー"},{id:archived,author:"過去のメンバー"}]};
  const data=createSnapshot({ref:head,git:fakeGit([]),previous});
  assert.deepEqual(data.entries.map(e=>e.id),[head,older,archived]);
  assert.throws(()=>createSnapshot({ref:"feature/unpublished",git:fakeGit([])}),/参照先/);
  assert.throws(()=>createSnapshot({ref:head,git:args=>args[0]==="show"?"broken":head}),/バージョン/);
  assert.throws(()=>createSnapshot({ref:head,git:args=>args[0]==="log"?"":fakeGit([])(args)}),/履歴/);
});
test("履歴をキーワードと担当者で絞り込める",()=>{
  const entries=[{title:"創世神技の文字を削除",author:"A",version:"1.15.537",changes:["CPUを確認"]},{title:"同期の修正",author:"B",version:"1.15.512",changes:[]}];
  assert.equal(filterReleaseEntries(entries," cpu ","A").length,1);
  assert.equal(filterReleaseEntries(entries,"1.15.512","")[0].author,"B");
  assert.equal(filterReleaseEntries(entries,"創世神技","B").length,0);
  assert.equal(filterReleaseEntries(entries,"","").length,2);
});
test("ダッシュボード導線と公開時の自動生成設定がある",()=>{
  const read=f=>fs.readFileSync(path.join(__dirname,"..",f),"utf8");
  assert.match(read("tools/hub/index.html"),/href="\/tools\/hub\/releases.html"/);
  assert.match(read("netlify.toml"),/command = "node scripts\/build_release_history.js"/);
  const js=read("tools/hub/releases.js");
  assert.match(js,/cache:\s*"no-store"/); assert.match(js,/timeZone:\s*"Asia\/Tokyo"/);
  assert.doesNotMatch(js,/innerHTML|insertAdjacentHTML/);
  const ids=new Set([...read("tools/hub/releases.html").matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
  for(const match of js.matchAll(/\$\("([a-z-]+)"\)/g)) assert.ok(ids.has(match[1]),match[1]);
});

test("公開設定の誤検出例外は既存のブラウザ設定2値だけで、秘密検査は維持する",()=>{
  const read=f=>fs.readFileSync(path.join(__dirname,"..",f),"utf8");
  const config=read("netlify.toml");
  const actual=config.match(/SECRETS_SCAN_SMART_DETECTION_OMIT_VALUES\s*=\s*"([^"]+)"/)[1].split(",");
  const firebase=read("firebase.js").match(/apiKey:\s*"(AIza[\w-]+)"/)[1];
  const sheets=[...new Set(read("tools/card-editor/tsukuriyo.js").match(/AIza[\w-]+/g))];
  assert.deepEqual(actual,[firebase,...sheets]); assert.equal(actual.length,2);
  assert.doesNotMatch(config,/SECRETS_SCAN_(?:SMART_DETECTION_)?ENABLED\s*=\s*"?false/);
  assert.doesNotMatch(config,/OMIT_(?:PATHS|KEYS)/);
});
