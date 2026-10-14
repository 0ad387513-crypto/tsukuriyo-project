"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const motion = require("../kami_motion.js");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("reaction poses follow their fallback chain and emotes prefer their own pose", () => {
  const set = { layers: [{ src: "body.webp", idle: "breathe" }], poses: {
    damage: "damage.webp", skill1: { frames: ["s1.webp", "s2.webp"], fps: 8 }, emote: "emote.webp", "emote:taunt": "taunt.webp",
  } };
  assert.deepEqual(motion.kamiMotionResolvePose(set, "damageHeavy").frames, ["damage.webp"]);
  assert.deepEqual(motion.kamiMotionResolvePose(set, "skill2"), { frames: ["s1.webp", "s2.webp"], fps: 8, loop: false });
  assert.deepEqual(motion.kamiMotionResolvePose(set, "lose").frames, ["damage.webp"], "lose → damageHeavy → damage");
  assert.deepEqual(motion.kamiMotionResolvePose(set, "emote", "taunt").frames, ["taunt.webp"]);
  assert.deepEqual(motion.kamiMotionResolvePose(set, "emote", "praise").frames, ["emote.webp"]);
  assert.equal(motion.kamiMotionResolvePose(set, "tenryoku"), null, "no pose → idle art with the effect only");
  assert.equal(motion.kamiMotionResolvePose({ layers: [], poses: {} }, "damage"), null);
});

test("stat changes map to reactions and mana changes do not move the Kami", () => {
  const map = motion.kamiMotionEventForStat;
  assert.equal(map("life", -1), "damage");
  assert.equal(map("life", -2), "damage");
  assert.equal(map("life", -3), "damageHeavy");
  assert.equal(map("life", 2), "heal");
  assert.equal(map("tenryoku", 1), "tenryoku");
  assert.equal(map("tenryoku", -1), null);
  assert.equal(map("seal", -1), "sealBreak");
  assert.equal(map("seal", 1), null);
  assert.equal(map("mana", -2), null);
  assert.equal(map("life", 0), null);
});

test("reaction time follows animation speed and reduced motion, and results are held", () => {
  assert.equal(motion.kamiMotionDuration("damage"), 900);
  assert.equal(motion.kamiMotionDuration("damage", "fast"), 540);
  assert.equal(motion.kamiMotionDuration("damage", "normal", true), 540);
  assert.equal(motion.kamiMotionDuration("damage", "minimal"), 0);
  assert.equal(motion.kamiMotionDuration("win"), 0);
  assert.equal(motion.kamiMotionDuration("unknown"), 0);
});

test("every event fallback points to an existing event", () => {
  for (const [type, ev] of Object.entries(motion.KAMI_MOTION_EVENTS)) {
    if (ev.fallback) assert.ok(motion.KAMI_MOTION_EVENTS[ev.fallback], type);
    assert.ok(ev.hold || ev.duration > 0, type);
  }
});

test("registered motion sets are well formed and every image exists", () => {
  const poseKeys = new Set([...Object.keys(motion.KAMI_MOTION_EVENTS), "pinch", ...motion.KAMI_MOTION_EMOTE_KEYS.map(k => "emote:" + k)]);
  for (const [no, set] of Object.entries(motion.KAMI_MOTION_SETS)) {
    assert.match(no, /^(?:[1-9]|10)$/, "key is a Kami No.");
    assert.ok(Array.isArray(set.layers) && set.layers.length, `${no}: layers`);
    for (const layer of set.layers) assert.ok(motion.KAMI_MOTION_IDLE_PRESETS.includes(layer.idle || "none"), `${no}: idle ${layer.idle}`);
    for (const key of Object.keys(set.poses || {})) assert.ok(poseKeys.has(key), `${no}: unknown pose ${key}`);
    for (const url of motion.kamiMotionUrls(no)) {
      assert.match(url, /^kami_motion\/[^?#]+-[0-9a-f]{12}\.webp$/, `${no}: ${url} is a hashed WebP in kami_motion/`);
      assert.ok(fs.existsSync(path.join(root, url)), `${no}: ${url} exists`);
    }
  }
});

test("unregistered Kami keep the static portrait and no images are requested", () => {
  assert.equal(motion.kamiMotionSet("99"), null);
  assert.deepEqual(motion.kamiMotionUrls("99"), []);
  const sets = { "3": { layers: [{ src: "kami_motion/a.webp", idle: "breathe" }], blink: "kami_motion/b.webp", poses: { damage: "kami_motion/a.webp" } } };
  assert.ok(motion.kamiMotionSet(3, sets));
  assert.deepEqual(motion.kamiMotionUrls(3, sets), ["kami_motion/a.webp", "kami_motion/b.webp"]);
});

function appMethod(name, deps = {}) {
  const m = html.match(new RegExp('    '+name+'\\(([^\\n]*)\\) \\{([\\s\\S]*?)\\r?\\n    \\},'));
  assert.ok(m,name);
  return Function(...Object.keys(deps),'return function('+m[1]+'){'+m[2]+'\n}')(...Object.values(deps));
}
test('現行肖像の切り出しを両側に渡し、10カミに登録した部品だけが動く', () => {
  assert.deepEqual(Object.keys(motion.KAMI_MOTION_SETS), ['1','2','3','4','5','6','7','8','9','10']);
  const available=appMethod('kamiMotionAvailable',{kamiMotionSet:motion.kamiMotionSet});
  for(let no=1;no<=10;no++) assert.equal(available({no}),true);
  assert.equal(available({no:8,isKami:false}),false);
  assert.equal(available(null),false);
  for(const side of ['self','opp']) {
    assert.ok(html.includes('<kami-motion v-if="kamiMotionAvailable(battleView.'+side+'.kami,\''+side+'\')"'));
    assert.ok(html.includes(':crop="kamiMotionCrop(battleView.'+side+'.kami)"'));
  }
  assert.ok(html.indexOf('src="kami_motion.js?')>html.indexOf('src="https://cdn.jsdelivr.net/npm/vue@2.6.14"'));
  const crop=appMethod('kamiMotionCrop');
  const vm={battleLayoutV2:true,kamiPortraitFocusStyle:()=>({'--kami-size':'112.0% auto','--kami-pos':'12.7% 8.9%'})};
  assert.deepEqual(crop.call(vm,{no:8}),{backgroundSize:'112.0% auto',backgroundPosition:'12.7% 8.9%'});
  vm.battleLayoutV2=false;
  assert.deepEqual(crop.call(vm,{no:8}),{backgroundSize:'cover',backgroundPosition:'center'});
});

function harness(props={}, extras={}) {
  let def, now=0, id=0;
  const timers=new Map(), media={matches:false,addEventListener(){},removeEventListener(){}},doc={hidden:false,addEventListener(){},removeEventListener(){}};
  const schedule=(fn,ms)=>{timers.set(++id,{fn,at:now+ms});return id};
  const context={Date:class extends Date {static now(){return now}},Vue:{component(n,c){def=c}},setTimeout:schedule,clearTimeout:i=>timers.delete(i),setInterval:schedule,clearInterval:i=>timers.delete(i),window:{matchMedia:()=>media},document:doc,...extras};
  require('node:vm').runInNewContext(fs.readFileSync(path.join(root,'kami_motion.js'),'utf8'),context);
  const obj=Object.assign({kamiNo:8,crop:{},idleOnly:true,event:null,pinch:false,speed:'normal',reduced:false,sets:null,$emit(){}},def.data(),props);
  Object.assign(obj,def.methods);
  for(const [key,get] of Object.entries(def.computed))Object.defineProperty(obj,key,{get:()=>get.call(obj)});
  def.mounted.call(obj);
  const advance=ms=>{const until=now+ms;while(true){const entry=[...timers.entries()].sort((a,b)=>a[1].at-b[1].at)[0];if(!entry||entry[1].at>until)break;now=entry[1].at;timers.delete(entry[0]);entry[1].fn()}now=until};
  return {obj,def,timers,advance,media,doc};
}
test('まばたきは半閉じ→閉じ→半閉じを通り、元の目へ戻る', () => {
  const h=harness();h.obj.rigReady=true;h.obj._playBlink();
  assert.equal(h.obj.blinkIndex,0);assert.ok(h.obj.blinkSrc.includes('half'));
  h.advance(55);assert.equal(h.obj.blinkIndex,1);assert.ok(h.obj.blinkSrc.includes('closed'));
  h.advance(90);assert.equal(h.obj.blinkIndex,2);
  h.advance(65);assert.equal(h.obj.blinking,false);assert.equal(h.timers.size,1,'next blink scheduled');
  h.def.beforeDestroy.call(h.obj);assert.equal(h.timers.size,0);
});
test('最小・動きを減らす・OS軽減では目の途中差分も消え、タイマーが残らない', () => {
  for(const props of [{speed:'minimal'},{reduced:true}]) {
    const h=harness(props);h.obj._playBlink();assert.equal(h.obj.blinking,false);assert.equal(h.timers.size,0);
    h.def.beforeDestroy.call(h.obj);
  }
  const h=harness();h.obj.rigReady=true;h.obj._playBlink();h.advance(55);
  h.media.matches=true;h.obj._motionMediaChange();h.def.watch.motionStopped.call(h.obj,true);
  assert.equal(h.obj.motionStopped,true);assert.equal(h.obj.blinking,false);assert.equal(h.timers.size,0);
  h.media.matches=false;h.obj._motionMediaChange();h.def.watch.motionStopped.call(h.obj,false);
  assert.equal(h.timers.size,1);h.def.beforeDestroy.call(h.obj);h.advance(20000);assert.equal(h.obj.blinking,false);
});
test('当該カミの素材を再利用し、既定では待機だけを再生する', () => {
  assert.ok(motion.kamiMotionUrls(8).length>=9&&motion.kamiMotionUrls(8).length<=16);
  assert.ok(motion.kamiMotionUrls(8).includes(motion.KAMI_MOTION_SETS['8'].rig.background));
  assert.deepEqual(motion.kamiMotionUrls(99),[]);
  const h=harness();h.obj.play('damage');assert.equal(h.obj.active,null);h.def.beforeDestroy.call(h.obj);
  const urls=appMethod('_kamiVisualUrls',{divineSkill1EyeUrl:()=>null,divineSkillAssetUrls:()=>[],KAMI_EMOTE_ICONS:{},kamiMotionUrls:motion.kamiMotionUrls});
  assert.ok(urls({no:8}).includes(motion.kamiMotionUrls(8)[0]));
  assert.ok(!urls({no:1}).includes(motion.KAMI_MOTION_SETS['8'].layers[0].src));
});

test('パーツの読み込み完了までは元絵を残し、破棄した肖像を復活させない', async () => {
  const requests=[];
  class FakeImage {set src(value){this.url=value;requests.push(this)}}
  const h=harness({}, {Image:FakeImage});
  assert.equal(h.obj.rigReady,false);
  assert.equal(requests.length,1,'one texture at a time');
  for(let i=0;i<motion.kamiMotionUrls(8).length;i++) {assert.equal(requests.length,i+1);requests[i].onload();await new Promise(setImmediate);}
  assert.equal(h.obj.hasLayeredRig,true);
  h.def.beforeDestroy.call(h.obj);
  const late=[];
  class LateImage {set src(value){late.push(this)}}
  const removed=harness({}, {Image:LateImage});removed.def.beforeDestroy.call(removed.obj);
  late.forEach(r=>r.onload());await new Promise(setImmediate);
  assert.equal(removed.obj.rigReady,false);
  const failed=harness({}, {Image:LateImage});late.at(-1).onerror();await new Promise(setImmediate);
  assert.equal(failed.obj.rigReady,false);
  failed.def.beforeDestroy.call(failed.obj);
});

test('対戦では既存の読み込み係が完了するまで画像を出さず、追加リクエストを並列に増やさない', async () => {
  const requested=[];const queued=[];let release;
  class FakeImage {set src(value){requested.push(value);this.onload()}}
  const h=harness({loadImage(src){queued.push(src);return new Promise(resolve=>{release=resolve})}}, {Image:FakeImage});
  assert.equal(queued.length,1);assert.equal(requested.length,0);assert.equal(h.obj.hasLayeredRig,false);
  for(let i=0;i<motion.kamiMotionUrls(8).length;i++) {release();await new Promise(setImmediate);assert.equal(requested.length,i+1);}
  assert.equal(h.obj.hasLayeredRig,true);assert.deepEqual(queued,motion.kamiMotionUrls(8));
  assert.equal((html.match(/:load-image="_assetImage"/g)||[]).length,2);
  h.def.beforeDestroy.call(h.obj);
});

test('ライフ減少の既存ポップだけが被弾を起こし、回復・マナ・開始時は反応しない', () => {
  const event=appMethod('kamiMotionDamageEvent');
  const vm={battleViewPops:{selfLife:{id:1,text:'-2'},oppLife:{id:2,text:'-3'},selfMana:{id:3,text:'-4'}}};
  assert.deepEqual(event.call(vm,'self'),{id:1,type:'damage'});
  assert.deepEqual(event.call(vm,'opp'),{id:2,type:'damageHeavy'});
  vm.battleViewPops.selfLife={id:4,text:'+2'};assert.equal(event.call(vm,'self'),null);
  vm.battleViewPops.selfLife=null;assert.equal(event.call(vm,'self'),null);
  vm.battleViewPops={};assert.equal(event.call(vm,'self'),null);
  for(const side of ['self','opp']) assert.ok(html.includes(':event="kamiMotionDamageEvent(\''+side+'\')"'));
});

test('被弾表情は元の人物に重なり、連続被弾を再生し直し、時間内に待機へ戻る', () => {
  const h=harness({idleOnly:false});h.obj.rigReady=true;
  h.obj._playBlink();h.advance(55);h.obj.play('damage');
  assert.equal(h.obj.blinking,false);assert.equal(h.obj.expressionOverlay,true);
  assert.equal(h.obj.rootClass['is-posing'],false);assert.equal(h.obj.rootClass['kami-motion-fx-recoil'],true);
  const first=h.obj.active.id;h.advance(100);h.obj.play('damage');assert.ok(h.obj.active.id>first);
  h.advance(899);assert.ok(h.obj.active);h.advance(1);assert.equal(h.obj.active,null);
  assert.equal(h.timers.size,1,'one resumed blink timer');
  h.obj.play('damageHeavy');h.advance(1199);assert.ok(h.obj.active);h.advance(1);assert.equal(h.obj.active,null);
  h.obj.play('damageHeavy');const heavyId=h.obj.active.id;h.obj.play('damage');
  assert.ok(h.obj.active.id>heavyId);assert.equal(h.obj.active.type,'damage');h.advance(900);
  h.def.beforeDestroy.call(h.obj);assert.equal(h.timers.size,0);
});

test('被弾の途中で軽減・最小・非表示にすると全差分を止め、復帰後に再演しない', () => {
  for(const prop of ['reduced','speed','pageHidden','systemReduced']) {
    const h=harness({idleOnly:false});h.obj.rigReady=true;h.obj.play('damage');assert.ok(h.obj.active);
    h.obj[prop]=prop==='speed'?'minimal':true;h.def.watch.motionStopped.call(h.obj,true);
    assert.equal(h.obj.active,null);assert.equal(h.obj.blinking,false);assert.equal(h.timers.size,0);
    h.obj.play('damageHeavy');assert.equal(h.obj.active,null);
    h.obj[prop]=prop==='speed'?'normal':false;h.def.watch.motionStopped.call(h.obj,false);
    assert.equal(h.obj.active,null);assert.equal(h.timers.size,1);h.def.beforeDestroy.call(h.obj);
  }
  const fast=harness({idleOnly:false,speed:'fast'});fast.obj.rigReady=true;fast.obj.play('damage');
  fast.advance(540);assert.equal(fast.obj.active,null);fast.def.beforeDestroy.call(fast.obj);
});

test('大ダメージだけ花びらが舞い上がり、待機の花びらは反応終了後も漂う', () => {
  const h=harness({idleOnly:false});h.obj.rigReady=true;
  assert.equal(h.obj.petals.length,8);assert.equal(h.obj.burstPetals.length,0);
  h.obj.play('damage');assert.equal(h.obj.burstPetals.length,0);
  h.obj.play('damageHeavy');assert.equal(h.obj.burstPetals.length,18);assert.equal(h.obj.rootClass['is-heavy'],true);
  h.advance(1200);assert.equal(h.obj.burstPetals.length,0);assert.equal(h.obj.petals.length,8);
  h.def.beforeDestroy.call(h.obj);
  const masked=harness({kamiNo:10,idleOnly:false});masked.obj.rigReady=true;
  masked.obj.play('damageHeavy');assert.equal(masked.obj.burstPetals.length,0);assert.equal(masked.obj.expressionOverlay,false);
  masked.def.beforeDestroy.call(masked.obj);
});

test('仮面解除後のオロチは素顔用の部品へ切り替わり、巻き戻しにも追従する', () => {
  const available=appMethod('kamiMotionAvailable',{kamiMotionSet:motion.kamiMotionSet});
  const vm={battleView:{self:{seal:0},opp:{seal:2}}};
  assert.equal(available.call(vm,{no:10},'self'),true);
  assert.ok(!motion.kamiMotionUrls(10,undefined,'awakened').includes(motion.kamiMotionSet(10).layers[0].src));
  assert.equal(available.call(vm,{no:10},'opp'),true);
  assert.equal(available.call(vm,{no:8},'self'),true);
  vm.battleView.self.seal=null;assert.equal(available.call(vm,{no:10},'self'),true);
});

test('被弾は軽い目の反射と大ダメージの苦痛を使い分け、途中で中止できる', () => {
  for (const [type,speed,times] of [['damageHeavy','normal',[800,240,160]]]) {
    const h=harness({idleOnly:false,speed});h.obj.rigReady=true;h.obj.play(type);
    assert.equal(h.obj.active.pose.fullFace,true);assert.ok(h.obj.poseSrc.includes('damage'));
    h.advance(times[0]-1);assert.equal(h.obj.frame,0);h.advance(1);assert.ok(h.obj.poseSrc.includes('closed'));
    h.advance(times[1]);assert.ok(h.obj.poseSrc.includes('half'));
    h.advance(times[2]);assert.equal(h.obj.active,null);
    h.obj.play(type);h.advance(100);h.obj.stop();h.advance(1300);
    assert.equal(h.obj.active,null);assert.equal(h.obj.frame,0);h.def.beforeDestroy.call(h.obj);assert.equal(h.timers.size,0);
  }
});

test('仮面以外の9柱は顔全体を置換し、静止確認でも古い顔とのクロスフェードをしない', () => {
  const css=fs.readFileSync(path.join(root,'kami_motion.css'),'utf8');
  assert.match(css,/\.kami-motion-full-face\s*\{animation:none;opacity:1;transition:none\}/);
  for(let no=1;no<=9;no++) {
    const s=motion.kamiMotionSet(no);assert.equal(s.blink.fullFace,true);assert.equal(s.poses.damage.fullFace,true);
    assert.match(s.blink.frames[0],/full-face-half-/);assert.match(s.poses.damage.frames[0],/full-face-damage-/);
    const h=harness({kamiNo:no,idleOnly:false,inspection:'damage'});h.obj.rigReady=true;
    assert.equal(h.obj.inspectionSrc,s.poses.damage.frames[0]);h.obj._playBlink();h.obj.play('damage');
    assert.equal(h.obj.blinking,false);assert.equal(h.obj.active,null);assert.equal(h.timers.size,0);
    h.obj.reduced=true;assert.equal(h.obj.inspectionSrc,'');h.def.beforeDestroy.call(h.obj);
  }
  assert.equal(motion.kamiMotionSet(10).blink,undefined);
});

test('風素材はスサノオの選択時だけ読み込み、背景と風の動きは軽減設定で止まる', () => {
  const url=motion.kamiMotionSet(1).rig.wind;
  assert.ok(url);assert.ok(motion.kamiMotionUrls(1).includes(url));
  for(let no=2;no<=10;no++) assert.ok(!motion.kamiMotionUrls(no).includes(url));
  const css=fs.readFileSync(path.join(root,'kami_motion.css'),'utf8');
  assert.match(css,/kamiMotionBackgroundDrift 21s/);assert.match(css,/kamiMotionWindFlow 6s/);
  assert.match(css,/\.kami-motion.reduced, \.kami-motion.reduced \* \{ animation: none !important/);
  assert.equal(motion.kamiMotionNormalizePose({frames:['a','b'],durations:[1,2],fullFace:true}).fullFace,true);
  assert.equal(motion.kamiMotionNormalizePose({frames:['a','b'],durations:[1,-2]}).durations,undefined);
});

test('小物の原画キャンバスは拡大率と横/縦位置が背景のcropに一致する', () => {
  const canvas=motion.kamiMotionCanvasStyle({backgroundSize:'112% auto',backgroundPosition:'12.7% 9%'},[1061,1482]);
  const viewport={width:614,height:464};
  const canvasW=parseFloat(canvas.width)/100*viewport.width,canvasH=canvasW*1482/1061;
  const left=parseFloat(canvas.left)/100*viewport.width;
  const top=parseFloat(canvas.top)/100*viewport.height-parseFloat(canvas.transform.match(/-([\d.]+)%/)[1])/100*canvasH;
  assert.ok(Math.abs(left-(viewport.width-canvasW)*.127)<1e-8);
  assert.ok(Math.abs(top-(viewport.height-canvasH)*.09)<1e-8);
  assert.equal(canvas.aspectRatio,'1061 / 1482');
  const oldCircle=motion.kamiMotionCanvasStyle({backgroundSize:'cover',backgroundPosition:'center'});
  assert.equal(oldCircle.width,'100%');assert.equal(oldCircle.top,'50%');assert.equal(oldCircle.left,'0%');
});

test('当該カミの小物/効果だけを既存キューで読み、重複した効果とアトラスを再利用する', () => {
  const sets={'2':{layers:[{src:'body.webp'}],rig:{background:'bg.webp',actors:[{src:'sword.webp'},{src:'sword.webp'}],effects:[{src:'blue.webp'},{src:'blue.webp'}]}}};
  assert.deepEqual(motion.kamiMotionUrls(2,sets),['body.webp','bg.webp','sword.webp','blue.webp']);
  assert.deepEqual(motion.kamiMotionUrls(1,sets),[]);
  const box=motion.kamiMotionActorBox({box:[.25,.5,.1,.2],cycle:7,origin:'50% 100%'});
  assert.equal(box.left,'25%');assert.equal(box.top,'50%');assert.equal(box.width,'10%');assert.equal(box.height,'20%');
  assert.equal(box['--actor-cycle'],'7s');assert.equal(box.transformOrigin,'50% 100%');
});

test('人物のみの点検も元画像に戻さず、背景/動物/色の層を隠す', () => {
  const h=harness({characterOnly:true});h.obj.rigReady=true;
  assert.equal(h.obj.rootClass['inspect-character'],true);assert.equal(h.obj.rootClass.reduced,false);
  h.obj.reduced=true;assert.equal(h.obj.rootClass.reduced,true);h.def.beforeDestroy.call(h.obj);
});


test('まばたきは呼吸の終端まで待ち、終端を過ぎた要求は次の周期に送る', () => {
  assert.equal(motion.kamiMotionBlinkDelay(0,5),4500);
  assert.equal(motion.kamiMotionBlinkDelay(4600,5),0);
  assert.equal(motion.kamiMotionBlinkDelay(4900,5),4600);
  const h=harness();h.obj.rigReady=true;h.obj._rigStartedAt=0;h.obj._requestBlink();
  const until=motion.kamiMotionBlinkDelay(0,h.obj.set.rig.breath);
  h.advance(until-1);assert.equal(h.obj.blinking,false);
  h.advance(1);assert.equal(h.obj.blinking,true);assert.equal(h.obj.rootClass['is-blinking'],true);
  h.advance(210);assert.equal(h.obj.blinking,false);h.def.beforeDestroy.call(h.obj);assert.equal(h.timers.size,0);
});

test('待ち合わせ中のまばたきは被弾・軽減・カミの変更・破棄で中止する', () => {
  for(const action of ['hurt','reduced','change','destroy']) {
    const h=harness({idleOnly:false});h.obj.rigReady=true;h.obj._rigStartedAt=0;h.obj._requestBlink();
    assert.equal(h.obj.blinking,false);
    if(action==='hurt'){h.obj.play('damage');h.advance(500);assert.equal(h.obj.blinking,false);}
    if(action==='reduced'){h.obj.reduced=true;h.def.watch.motionStopped.call(h.obj,true);h.advance(10000);assert.equal(h.obj.blinking,false);assert.equal(h.timers.size,0);}
    if(action==='change'){h.obj.kamiNo=10;h.def.watch.kamiNo.call(h.obj);h.advance(10000);assert.equal(h.obj.blinking,false);assert.equal(h.timers.size,0);}
    h.def.beforeDestroy.call(h.obj);h.advance(10000);assert.equal(h.obj.blinking,false);assert.equal(h.timers.size,0);
  }
});


test('オロチの素顔用素材だけを追加読み込みし、状態変更中の古い読み込みを採用しない', async () => {
  const requests=[];class FakeImage {set src(url){this.url=url;requests.push(this)}}
  const h=harness({kamiNo:10,variant:'sealed'},{Image:FakeImage});
  h.obj.variant='awakened';h.def.watch.variant.call(h.obj);
  assert.equal(requests.length,2);requests[0].onload();await new Promise(setImmediate);assert.equal(h.obj.rigReady,false);
  const expected=motion.kamiMotionUrls(10,undefined,'awakened');
  for(let i=0;i<expected.length;i++){assert.equal(requests[i+1].url,expected[i]);requests[i+1].onload();await new Promise(setImmediate);}
  assert.equal(h.obj.hasLayeredRig,true);assert.equal(h.obj.set.layers[0].src,motion.kamiMotionSet(10).awakened.layers[0].src);
  h.obj.variant='sealed';h.def.watch.variant.call(h.obj);assert.equal(h.obj.rigReady,false);
  h.def.beforeDestroy.call(h.obj);requests.at(-1).onload();await new Promise(setImmediate);assert.equal(h.obj.rigReady,false);
});

test('花吹雪は椿の赤白を使い、日光と月光は帯の画像を先読みしない', () => {
  const h=harness({kamiNo:6});h.obj.rigReady=true;
  assert.equal(h.obj.petals.length,0);assert.equal(h.obj.gustPetals.length,22);
  assert.ok(h.obj.gustPetals[0].style.backgroundImage.includes('camellia-red'));
  assert.ok(h.obj.gustPetals[1].style.backgroundImage.includes('camellia-white'));h.def.beforeDestroy.call(h.obj);
  assert.equal(motion.kamiMotionSet(8).rig.lighting,'sunlight');assert.equal(motion.kamiMotionSet(9).rig.lighting,'moonlight');
  assert.equal(motion.kamiMotionSet(8).rig.effects.length,0);assert.equal(motion.kamiMotionSet(9).rig.effects.length,0);
  const butterflies=motion.kamiMotionSet(9).rig.actors;
  assert.notEqual(butterflies[0].src,butterflies[1].src);
  assert.ok(butterflies.every(a=>a.grid[0]*a.grid[1]===12));
  const animals=motion.kamiMotionSet(3).rig.actors;assert.ok(animals.every(a=>!a.blend&&a.breathSrc&&a.grid[0]*a.grid[1]===3));
});


test('軽い被弾は320msで表情が戻り、大ダメージの苦痛は800ms続く', () => {
  for(let no=1;no<=9;no++) {
    const normal=motion.kamiMotionResolvePose(motion.kamiMotionSet(no),'damage');
    const heavy=motion.kamiMotionResolvePose(motion.kamiMotionSet(no),'damageHeavy');
    assert.notEqual(normal.frames[0],heavy.frames[0]);
    for(const speed of ['normal','fast']) {
      const factor=speed==='fast'?.6:1,h=harness({kamiNo:no,idleOnly:false,speed});h.obj.rigReady=true;
      h.obj.play('damage');const first=h.obj.poseSrc;h.advance(Math.round(320*factor)-1);assert.equal(h.obj.poseSrc,first);
      h.advance(1);assert.match(h.obj.poseSrc,/recovery-full-face-open/);
      h.obj.play('damageHeavy');h.advance(Math.round(800*factor)-1);assert.equal(h.obj.poseSrc,heavy.frames[0]);
      h.advance(1);assert.equal(h.obj.poseSrc,heavy.frames[1]);
      h.obj.reduced=true;h.def.watch.motionStopped.call(h.obj,true);assert.equal(h.timers.size,0);h.def.beforeDestroy.call(h.obj);
    }
  }
});

test('椿の花びらは前後で別の位置・速さ・位相を持ち、横一列に揃わない', () => {
  const h=harness({kamiNo:6});h.obj.rigReady=true;const petals=[...h.obj.gustPetals,...h.obj.gustFrontPetals];
  assert.equal(petals.length,30);
  for(const key of ['left','--gust-cycle','--gust-delay','--gust-sway'])assert.equal(new Set(petals.map(p=>p.style[key])).size,30);
  const phases=petals.map(p=>-parseFloat(p.style['--gust-delay'])/parseFloat(p.style['--gust-cycle']));
  assert.ok(Math.max(...phases)-Math.min(...phases)>.85);
  assert.ok(phases.some(p=>p>.8)&&phases.some(p=>p<.2));
  h.def.beforeDestroy.call(h.obj);
});

test('左右2体の龍は元の原画での大きさを保ち、封印前後で小さくならない', () => {
  const source=JSON.parse(fs.readFileSync(path.join(root,'output/kami-motion-separated-20261014/registry.json'),'utf8'));
  for(const variant of ['sealed','awakened']) {
    const dragons=motion.kamiMotionSet(10,undefined,variant).rig.actors.filter(a=>a.idle==='dragon');
    assert.equal(dragons.length,2);assert.deepEqual(dragons[0].box,source['10'].rig.actors[3].box);assert.deepEqual(dragons[1].box,source['10'].rig.actors[4].box);
  }
  const urls=motion.kamiMotionUrls(3);assert.ok(motion.kamiMotionSet(3).rig.actors.every(a=>urls.includes(a.breathSrc)));
  for(let no=1;no<=10;no++)if(no!==3)assert.ok(!motion.kamiMotionUrls(no).includes(motion.kamiMotionSet(3).rig.actors[0].breathSrc));
});


test('素顔オロチの通常/大ダメージは別の顔へ、仮面の状態では顔を出さない', () => {
  const awake=motion.kamiMotionSet(10,undefined,'awakened');
  assert.notEqual(awake.poses.damage.frames[0],awake.poses.damageHeavy.frames[0]);
  for(const type of ['damage','damageHeavy']) {
    const h=harness({kamiNo:10,variant:'awakened',idleOnly:false});h.obj.rigReady=true;h.obj.play(type);
    assert.equal(h.obj.expressionOverlay,true);assert.equal(h.obj.poseSrc,awake.poses[type].frames[0]);
    h.obj.variant='sealed';h.def.watch.variant.call(h.obj);assert.equal(h.obj.active,null);assert.equal(h.obj.expressionOverlay,false);h.def.beforeDestroy.call(h.obj);
  }
});

test('封印解放後のオロチも半閉じ/閉じ/半閉じでまばたきし、状態変更で消える', () => {
  const h=harness({kamiNo:10,variant:'awakened',idleOnly:false});h.obj.rigReady=true;
  h.obj._playBlink();assert.equal(h.obj.blinking,true);assert.match(h.obj.blinkSrc,/half-/);
  h.advance(55);assert.match(h.obj.blinkSrc,/closed-/);h.advance(90);assert.match(h.obj.blinkSrc,/half-/);
  h.advance(65);assert.equal(h.obj.blinking,false);assert.equal(h.timers.size,1);
  h.obj._playBlink();h.advance(55);h.obj.variant='sealed';h.def.watch.variant.call(h.obj);
  assert.equal(h.obj.blinking,false);assert.equal(h.obj.blinkSrc,'');assert.equal(h.timers.size,0);
  h.def.beforeDestroy.call(h.obj);
});

test('オロチの玉と霊気は、まばたき・被弾の全コマでも同じ手元に残る', () => {
  for(const variant of ['sealed','awakened']) {
    const h=harness({kamiNo:10,variant,idleOnly:false});h.obj.rigReady=true;
    const orb=h.obj.actorsFor('character-front')[0];assert.ok(orb.idle.startsWith('orb'));
    assert.equal(h.obj.actorsFor('character').filter(a=>a.idle.startsWith('orb')).length,0);
    const placement=JSON.stringify(h.obj.actorBox(orb)),url=orb.src;
    h.obj._playBlink();h.advance(55);
    assert.equal(h.obj.actorsFor('character-front')[0].src,url);
    for(const type of ['damage','damageHeavy']) {
      h.obj.play(type);
      for(const ms of [100,250,450,200]) {
        h.advance(ms);assert.equal(JSON.stringify(h.obj.actorBox(h.obj.actorsFor('character-front')[0])),placement);
        assert.equal(h.obj.actorsFor('character-front')[0].src,url);
      }
    }
    h.def.beforeDestroy.call(h.obj);
  }
});

test('巻物の異なる文字30箇所から別々の位相・周期で浮き上がる', () => {
  const h=harness({kamiNo:5});h.obj.rigReady=true;
  const glyphs=h.obj.set.rig.actors.flatMap(a=>a.glyphs);
  assert.equal(glyphs.length,30);
  assert.ok(new Set(glyphs.map(g=>g.cycle)).size>6);
  assert.ok(new Set(glyphs.map(g=>g.delay)).size>20);
  const phases=glyphs.map(g=>-g.delay/g.cycle);assert.ok(Math.max(...phases)-Math.min(...phases)>.85);
  for(const g of glyphs) {
    const [x,y,w,h]=g.region;assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=1&&y+h<=1);
  }
  h.def.beforeDestroy.call(h.obj);
});

test('陽炎はヒノカグツチの背景だけ。軽減・最小・非表示ではSVGの動きも無効', () => {
  for(const prop of ['reduced','systemReduced','pageHidden','speed','characterOnly']) {
    const h=harness({kamiNo:7,_uid:71});h.obj.rigReady=true;assert.equal(h.obj.heatEnabled,true);
    h.obj[prop]=prop==='speed'?'minimal':true;assert.equal(h.obj.heatEnabled,false);
    h.def.beforeDestroy.call(h.obj);
  }
  const left=harness({kamiNo:7,_uid:72}),right=harness({kamiNo:7,_uid:73});
  assert.notEqual(left.obj.heatFilterId,right.obj.heatFilterId);
  for(let no=1;no<=10;no++)if(no!==7){const h=harness({kamiNo:no});h.obj.rigReady=true;assert.equal(h.obj.heatEnabled,false);h.def.beforeDestroy.call(h.obj);}
  left.def.beforeDestroy.call(left.obj);right.def.beforeDestroy.call(right.obj);
});

test('剣の電撃はタケミカヅチだけ、背景演出や先読み画像を増やさず人物と同じ座標', () => {
  const set=motion.kamiMotionSet(4),old=JSON.parse(fs.readFileSync(path.join(root,'output/omoikane-heavy-repair-20261014/before/registry.json'),'utf8'));
  assert.deepEqual(motion.kamiMotionUrls(4),motion.kamiMotionUrls(4,old));
  assert.equal(set.rig.weaponLightning.length,4);
  for(const arc of set.rig.weaponLightning)for(const point of arc.points.split(' ')) {
    const [x,y]=point.split(',').map(Number);assert.ok(x>=0&&y>=0&&x<=set.rig.canvas[0]&&y<=set.rig.canvas[1]);
  }
  for(let no=1;no<=10;no++)if(no!==4)assert.equal(motion.kamiMotionSet(no).rig.weaponLightning,undefined);
});
