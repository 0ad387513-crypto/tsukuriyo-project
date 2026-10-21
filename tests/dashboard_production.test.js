"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const {productionProxy,TARGETS}=require("../scripts/production_proxy.js");
const {releaseAuthorCounts,filterReleaseEntries}=require("../tools/hub/releases.js");
const root=path.resolve(__dirname,"..");
function liveHelpers(){const context={URL,window:{DashboardProduction:{base:"https://tsukuriyo-online.netlify.app/"}},module:{exports:{}}};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,"tools/field-card-kind-preview/live_battle_preview.js"),"utf8"),context);return context.module.exports;}
function response(){return {code:0,headers:{},writeHead(code,headers){this.code=code;this.headers=headers;return this;},end(data){this.body=data;return this;}};}
test("公開情報の代理取得は固定サイトのGET/HEADだけ。パストラバーサルや書き込みを転送しない",async()=>{
  const calls=[];const fetcher=async(url,options)=>{calls.push({url,options});return {status:200,headers:new Map([["content-type","application/javascript"]]),arrayBuffer:async()=>Buffer.from("public")};};
  const res=response();assert.equal(await productionProxy({method:"GET"},res,"/__production/field_card_frames.js",fetcher),true);
  assert.equal(res.code,200);assert.match(calls[0].url,/^https:\/\/tsukuriyo-online\.netlify\.app\/field_card_frames.js\?dashboard=/);
  assert.equal(calls[0].options.redirect,"error");assert.equal(calls[0].options.headers,undefined,"ブラウザのCookieや認証を送信しない");
  for(const file of ["../firebase.js","styles/../firebase.css","https://evil.example/style.css","firebase.js"]){const r=response();await productionProxy({method:"GET"},r,"/__production/"+file,fetcher);assert.equal(r.code,404);}
  const denied=response();await productionProxy({method:"POST"},denied,"/__production/index.html",fetcher);assert.equal(denied.code,405);assert.equal(calls.length,1);
  const css=response();await productionProxy({method:"GET"},css,"/__production/styles/new-field.css",fetcher);assert.equal(css.code,200);
});
test("全ての担当者を数え、別メンバーの版数なし修正も検索と絞り込みで残す",()=>{
  const entries=[{author:"キジマ",title:"修正A"},{author:"maekawa",title:"カード枠",version:"1.15.539"},{author:"maekawa",title:"数字のフォント"},{author:"別メンバー",title:"修正B"}];
  const counts=releaseAuthorCounts(entries);assert.equal(counts.length,3);assert.equal(counts.find(row=>row.author==="maekawa").count,2);
  assert.equal(filterReleaseEntries(entries,"","maekawa").length,2);assert.equal(filterReleaseEntries(entries,"","" ).length,4);
});
test("CSSは寸法・フォント・縁の数式を変更せず、素材URLとrootスコープだけ変える",()=>{
  const {rebaseCss,layoutCss}=liveHelpers();
  const css=":root{--x:2.5px}.battle-card-cost{font-family:'Yu Mincho',serif;width:3.6vh;height:3.6vh;background:url('battle_ui/ring.webp')}svg{mask:url(#a)}.x{background:url(\"data:image/svg+xml,%3Csvg/%3E\")}";
  assert.equal(rebaseCss(css),css.replace(":root",":host").replace("url('battle_ui/ring.webp')",'url("https://tsukuriyo-online.netlify.app/battle_ui/ring.webp")'));
  assert.ok(!/battle-card-(?:cost|attack|power)\s*\{/.test(layoutCss),"確認ページから数値枠の寸法やフォントを上書きしない");
  assert.match(rebaseCss('.x{background:url(../battle_ui/a.webp)}',"https://tsukuriyo-online.netlify.app/css/theme.css"),/netlify.app\/battle_ui\/a.webp/);
});
test("サンプルの基本・ユニーク・龍・トークンは、本番の分類処理に必要な情報を渡す",()=>{
  const {makePool}=liveHelpers();
  const {fieldCardKind}=require("../field_card_frames.js");
  for(const kind of ["basic","unique","dragon","token"]){const {value,pool}=makePool({no:"1",name:"sample",nickname:"sample",category:"レガシー",color:"赤",kind});assert.equal(fieldCardKind(value,pool),kind);}
});
test("本番の代理取得ルートとローカルのルートは同じ公開ファイルへ対応する",()=>{
  const routes=fs.readFileSync(path.join(root,"_redirects"),"utf8");
  for(const [file,target] of Object.entries(TARGETS))assert.ok(routes.includes("/__production/"+file+"  https://tsukuriyo-online.netlify.app/"+target+"  200!"));
  const html=fs.readFileSync(path.join(root,"tools/field-card-kind-preview/index.html"),"utf8");
  assert.ok(html.includes("historical_field_frames.js"));assert.ok(!html.includes('src="current_frame_preview.js'));
  const live=fs.readFileSync(path.join(root,"tools/field-card-kind-preview/live_battle_preview.js"),"utf8");
  assert.ok(live.includes('attachShadow({mode:"open"})'));assert.ok(live.includes('doc.querySelectorAll("style")'));
  assert.ok(!live.includes("eval("));assert.ok(!live.includes("new Function"));
  assert.ok(live.includes(".cloneNode(true)"));
});
