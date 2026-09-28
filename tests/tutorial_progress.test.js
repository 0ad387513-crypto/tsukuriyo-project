"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const specs = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "effect_spec.json"), "utf8"));
const lessons = Function("TUTORIAL_TASK_CLOSE_NOTE", "return " + html.match(/const TUTORIAL_LESSONS = Object.freeze\(([\s\S]*?)\);\r?\n\/\*/)[1])("");
function method(name, params = "", async = false) {
  const body = html.match(new RegExp("    " + (async ? "async " : "") + name + "\\([^\\n]*\\) \\{([\\s\\S]*?)\\r?\\n    \\},"));
  assert.ok(body, name);
  return new (async ? Object.getPrototypeOf(async function(){}).constructor : Function)(params, body[1]);
}

test("tutorial inspection targets identify the current ability and never retain a previous focus", () => {
  const focus = method('_tutorialPreviewFocusFor', 'card');
  for (const lesson of lessons) for (const step of lesson.steps) {
    for (const ref of step.inspect || []) {
      assert.ok(step.inspectFocus[ref], `${lesson.id}: ${ref}`);
      assert.ok(['effect', 'trigger', 'skill1', 'skill2'].includes(step.inspectFocus[ref].section));
    }
  }
  const kami={no:8,isKami:true},legacy={no:67,name:'紅翼龍・ルベル'};
  const step=lessons.find(l=>l.id==='skill2').steps[10];
  const vm={appView:'battle',tutorialMode:'say',tutorial:{index:10,inspectOpening:{index:10,key:'kami:8'}},
    tutorialStep:step,battleView:{self:{kami}},tutorialInspectionKey:method('tutorialInspectionKey','card'),fullName:c=>c.name||'アマテラス'};
  assert.equal(focus.call(vm,kami).section,'skill2');
  assert.equal(focus.call(vm,legacy),null,'unrelated previews have no tutorial focus');
  vm.tutorial.index=11;assert.equal(focus.call(vm,kami),null,'a previous explanation cannot persist');
  vm.tutorial.index=10;vm.tutorialMode='task';assert.equal(focus.call(vm,kami),null);
  vm.tutorialMode='say';vm.appView='cards';assert.equal(focus.call(vm,kami),null);
  assert.equal(html.includes('第二の神技'),false);
  assert.equal(html.includes('神技1'),false);
  assert.match(html,/創世神技（そうせいじんぎ）/);
  assert.match(html,/class="kami-section-label kami-skill-kind">神技<\/div>/);
});

test("tutorial keyword highlights wrap the exact ability while preserving keyword and token links", () => {
  const source=html.slice(html.indexOf('function _richLinkifyTokens'),html.indexOf('// 練習終了時はアマテラス'));
  const split=Function(source+'; return buildTutorialFocusSegments;')();
  const text='①【疾駆】\n②【守護】\n③【誘3：黄カード】→社の施しを招来する';
  const glossary={疾駆:'haste',守護:'guard',誘:'induce',招来:'token'};
  const tokens={'社の施し':{no:201}};
  for (const term of ['疾駆','守護','誘']) {
    const parts=split(text,glossary,tokens,[term]);
    assert.equal(parts.map(p=>p.s).join(''),text);
    assert.equal(parts.filter(p=>p.focus).map(p=>p.s).join(''),term==='誘'?'【誘3：黄カード】':`【${term}】`);
    assert.ok(parts.some(p=>p.t==='kw'&&p.kw===term&&p.focus));
    assert.ok(parts.some(p=>p.t==='token'&&p.name==='社の施し'&&!p.focus));
  }
  assert.ok(split(text,glossary,tokens,[]).every(p=>!p.focus));
  assert.ok(split(text,glossary,tokens,['存在しない能力']).every(p=>!p.focus));
});

test("Orochi's four-seal cut-in uses the voice script line and waits for speech completion", async () => {
  const script = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'voices/voice_script.json'), 'utf8'));
  const line = script.kami['10'].lines.skill1.text;
  const kami = { no: '10', name: 'ヤマタノオロチ' }, voice = {};
  let held, canceled = false, complete = false;
  const vm = {
    _battleEmoteLineFor(card, key) { assert.equal(card, kami); assert.equal(key, 'skill1'); return line; },
    playKamiVoice(card, key) { assert.equal(card, kami); assert.equal(key, 'skill1'); return voice; },
    _battleHoldSpeech(text, audio) { held = { text, audio }; return { timer: null, cancel() { canceled = true; } }; }
  };
  const running = method('_battleShowOrochiSealFourCutin', 'kami,divineSkillTheme', true).call(vm, kami, () => ({}));
  running.then(() => { complete = true; });
  await Promise.resolve();
  assert.equal(vm.battleSkillCloseup.line, line);
  assert.equal(held.text, line); assert.equal(held.audio, voice);
  assert.equal(complete, false, 'the cinematic remains while the voice is playing');
  vm._battleSkillCloseupResolve(); await running;
  assert.equal(canceled, true); assert.equal(vm.battleSkillCloseup, null);
  assert.equal(vm._battleSkillCloseupResolve, null);
});

function speechClock(vm) {
  let now=100;const timers=[];
  const clock={now:()=>now};
  const set=(callback,delay)=>{const t={callback,at:now+delay,cancelled:false};timers.push(t);return t};
  const clear=t=>{if(t)t.cancelled=true};
  vm._battleSpeechReadMs=method('_battleSpeechReadMs','text');
  const hold=method('_battleHoldSpeech','text,voice,onDone,setTimeout,clearTimeout,Date,options={}');
  vm._battleHoldSpeech=function(text,voice,onDone,options={}){return hold.call(this,text,voice,onDone,set,clear,clock,options)};
  return {advance(ms){now+=ms;for(const t of timers)if(!t.cancelled&&t.at<=now){t.cancelled=true;t.callback()}},timers,clear};
}

test("speech stays readable without audio, waits for voice completion, and cancels stale timers", async () => {
  const vm={},clock=speechClock(vm),finished=[];
  const short='こんにちは',long='長い台詞でも最後まで読めるように表示時間を確保します。'.repeat(3);
  assert.ok(vm._battleSpeechReadMs(long)>vm._battleSpeechReadMs(short));
  vm._battleHoldSpeech(short,null,()=>finished.push('silent'));
  clock.advance(4499);assert.deepEqual(finished,[]);clock.advance(1);assert.deepEqual(finished,['silent']);
  let finishVoice;const voice={done:new Promise(r=>{finishVoice=r})};
  vm._battleHoldSpeech(short,voice,()=>finished.push('voiced'));
  clock.advance(12000);assert.deepEqual(finished,['silent'],'long playback cannot hide text before it finishes');
  finishVoice();await Promise.resolve();clock.advance(799);assert.deepEqual(finished,['silent']);
  clock.advance(1);assert.deepEqual(finished,['silent','voiced']);
  let finishOld;const old=vm._battleHoldSpeech(short,{done:new Promise(r=>{finishOld=r})},()=>finished.push('old'));
  old.cancel();finishOld();await Promise.resolve();clock.advance(20000);
  assert.deepEqual(finished,['silent','voiced'],'an interrupted old voice does not hide a later message');
});

test("both emote sides keep their own speech timer when another emote replaces one", async () => {
  const vm={emoteBubbles:{self:null,opp:null},$set:(object,key,value)=>{object[key]=value}};
  const clock=speechClock(vm),show=method('_battleShowEmoteBubble','side,text,voice=null,onDone=null,speechOptions={}');
  let finishVoice;const voice={done:new Promise(r=>{finishVoice=r})};
  show.call(vm,'self','最初の台詞',voice);show.call(vm,'opp','相手の台詞');
  clock.advance(1000);show.call(vm,'self','次の台詞');
  finishVoice();await Promise.resolve();clock.advance(3500);
  assert.equal(vm.emoteBubbles.opp,null);assert.equal(vm.emoteBubbles.self.text,'次の台詞');
  clock.advance(1000);assert.equal(vm.emoteBubbles.self,null);
});

test("skill 1 and skill 2 hold their dialogue until reading and audio finish at every speed", async () => {
  for(const index of [1,2])for(const speed of ['normal','fast','minimal']) {
    let finishVoice;const voice={done:new Promise(r=>{finishVoice=r})};
    const vm={battleAnimationSpeed:speed,_battleEmoteLineFor:()=> 'この台詞を読み終えるまで、カットインを残します。',
      playKamiVoice:()=>voice,_sfxPlay(){},_battleMotionMs:method('_battleMotionMs','ms')};
    const clock=speechClock(vm),theme=require('../divine_effects.js').divineSkillTheme;
    const using=method('_battleShowSkill'+index+'Closeup','kami,skillName,divineSkillTheme,remoteTransfers=null,writerSide="self",remoteTargets=null',true).call(vm,{no:8},'神技',theme);
    clock.advance(20000);await Promise.resolve();
    assert.ok(vm.battleSkillCloseup,'fast and minimal motion must not shorten the spoken dialogue');
    if(index===2)assert.equal(vm.battleSkillCloseup.phase,'portrait');
    finishVoice();await Promise.resolve();clock.advance(800);await Promise.resolve();
    if(index===2){
      assert.equal(vm.battleSkillCloseup.phase,'animation','the animation starts only after dialogue finishes');
      clearTimeout(vm._battleSkillCloseupT);vm._battleSkillCloseupResolve();
    }
    await using;assert.equal(vm.battleSkillCloseup,null);
  }
  for(const name of ['skillCloseupCardKf','skill1CloseupCardKf','orochiCutinKf']) {
    const keyframes=html.match(new RegExp('@keyframes '+name+' \\{([\\s\\S]*?)100%\\s*\\{([^}]+)\\}'));
    assert.ok(keyframes);assert.match(keyframes[2],/opacity:\s*1/,'the final animation frame must keep dialogue visible');
  }
});

test("Kami voice completes its hold on playback failure or interruption", async () => {
  class Voice {
    constructor(){this.listeners={};this.duration=9;}
    addEventListener(key,fn){this.listeners[key]=fn}
    removeEventListener(key){delete this.listeners[key]}
    pause(){this.listeners.pause?.({type:'pause'})}
    play(){return this.reject?Promise.reject(Error('autoplay blocked')):Promise.resolve()}
  }
  const play=method('playKamiVoice','kami,key,Audio');
  const vm={kamiVoiceManifest:{kami:{'1':{greeting:'voice.mp3'}}},voiceVolume:1,BUILD_VERSION:'test'};
  const first=play.call(vm,{no:1},'greeting',Voice);
  const second=play.call(vm,{no:1},'greeting',Voice);
  assert.equal(await first.done,false);assert.deepEqual(first.audio.listeners,{});
  second.audio.listeners.ended({type:'ended'});assert.equal(await second.done,true);assert.deepEqual(second.audio.listeners,{});
  class Rejected extends Voice {play(){return Promise.reject(Error('autoplay blocked'))}}
  const failed=play.call(vm,{no:1},'greeting',Rejected);assert.equal(await failed.done,false);
  assert.deepEqual(failed.audio.listeners,{});vm.voiceVolume=0;
  assert.equal(play.call(vm,{no:1},'greeting',Voice),undefined,'muted speech falls back to reading time');
});

test("evolution target selection can go back repeatedly and cancel without spending cards or mana", async () => {
  for (const fromGraveyard of [false, true]) {
    const card={no:84,category:'レガシー'},base={no:21};
    const player={mana:8,hand:[card],legacies:fromGraveyard?[]:[base],graveyard:fromGraveyard?[base]:[]};
    const vm={battleSample:{self:player},battleEnsureSelfTurn:()=>true,_dslEvolutionBaseCandidates:()=>[base],
      _sfxPlay(){},dslChoiceOptionDisabled:()=>false,battleSaveUndo(){assert.fail('cancel must happen before committing');},
      dslAskChoice:method('dslAskChoice','card,prompt,options,meta = {}'),
      dslAnswerChoice:method('dslAnswerChoice','index'),dslCancelChoice:method('dslCancelChoice'),
      dslAskCustomTargets:method('dslAskCustomTargets','promptLabel,candidates,need=1,sourceCard=null,canSkip=false,exactCount=false,options={}'),
      dslCancelTargets:method('dslCancelTargets'),dslResolveTargets:method('dslResolveTargets'),
    };
    const playing=method('_battlePlayLegacyOrRelic','index,zone,cost,evolveBaseOverride=undefined',true).call(vm,0,'legacies',3);
    for(let attempt=0;attempt<2;attempt++) {
      assert.ok(vm.dslChoiceModal,'placement choice is available again');
      vm.dslAnswerChoice(1);await new Promise(r=>setImmediate(r));
      assert.ok(vm.dslTargetModal.canCancel);
      assert.equal(vm.dslTargetModal.cancelLabel,'戻る');
      assert.equal(vm.dslTargetModal.canSkip,false,'back must not allow evolution without a base');
      vm.dslResolveTargets();assert.ok(vm.dslTargetModal,'confirming with no evolution base does not proceed');
      vm.dslTargetModal.selected=[base];vm.dslCancelTargets();
      await new Promise(r=>setImmediate(r));
      assert.equal(vm.dslTargetModal,null);
      assert.equal(player.mana,8);assert.deepEqual(player.hand,[card]);
      assert.deepEqual(player.legacies,fromGraveyard?[]:[base]);
      assert.deepEqual(player.graveyard,fromGraveyard?[base]:[]);
    }
    vm.dslCancelChoice();await playing;
    assert.equal(vm._dslDeferred,null);assert.equal(vm.dslChoiceModal,null);
  }
});

test("evolution at field capacity can be canceled while mandatory effect targets remain mandatory", async () => {
  const card={no:84,category:'レガシー'},base={no:21};
  const player={mana:8,hand:[card],legacies:Array.from({length:7},()=>({...base}))};
  const vm={battleSample:{self:player},battleEnsureSelfTurn:()=>true,_dslEvolutionBaseCandidates:()=>player.legacies,
    _sfxPlay(){},battleSaveUndo(){assert.fail('canceled evolution must not commit');},
    dslAskCustomTargets:method('dslAskCustomTargets','promptLabel,candidates,need=1,sourceCard=null,canSkip=false,exactCount=false,options={}'),
    dslCancelTargets:method('dslCancelTargets'),
  };
  const playing=method('_battlePlayLegacyOrRelic','index,zone,cost,evolveBaseOverride=undefined',true).call(vm,0,'legacies',3);
  assert.ok(vm.dslTargetModal.canCancel);vm.dslCancelTargets();await playing;
  assert.equal(player.mana,8);assert.deepEqual(player.hand,[card]);assert.equal(player.legacies.length,7);
  const forced=vm.dslAskCustomTargets('必須効果の対象',[base],1,card);
  vm.dslCancelTargets();assert.ok(vm.dslTargetModal,'a committed mandatory effect cannot be canceled');
  assert.equal(typeof vm._dslDeferred,'function');
  vm.dslTargetModal.selected=[base];method('dslResolveTargets').call(vm);
  assert.deepEqual(await forced,[base]);
});

test("tutorial card inspection gates explanations and returns safely to the same step", () => {
 const legacy={no:21,name:'鐘鳴らしの童'},grave={no:63,name:'音速の忍'},secret={no:99,name:'秘密の手札'};
 const vm={appView:'battle',tutorial:{index:4,typed:100,inspectedCards:[]},tutorialStep:{say:'「鐘鳴らしの童」の効果を確認します。',cards:['self-field:鐘鳴らしの童'],inspect:['鐘鳴らしの童']},tutorialFullText:'説明',
 battleView:{self:{hand:[],legacies:[legacy],graveyard:[grave]},opp:{hand:[secret],legacies:[],graveyard:[]}},
 fullName:c=>c.name,_sfxPlay(){},hideCardHover(){this.hoverCard=null},$set:(o,k,v)=>{o[k]=v},
 _tutorialNudge(){this.nudged=true},_tutorialGo(){this.advanced=true},
 tutorialInspectionKey:method('tutorialInspectionKey','card'),tutorialInspectionChecked:method('tutorialInspectionChecked','card'),
 openPreview:method('openPreview','card'),closePreview:method('closePreview','confirmed'),tutorialInspectCard:method('tutorialInspectCard','card')};
 const cards=method('_tutorialInspectionCards','step');
 vm.tutorialInspectionCards=cards.call(vm,vm.tutorialStep);
 assert.deepEqual(vm.tutorialInspectionCards,[legacy]);
 method('tutorialAdvance').call(vm);assert.equal(vm.advanced,undefined);assert.equal(vm.previewCard,legacy,'clicking the explanation opens the unchecked card');
 vm.tutorialInspectCard(legacy);assert.equal(vm.previewCard,legacy);
 method('tutorialAdvance').call(vm);assert.equal(vm.advanced,undefined,'an open detail must not advance the explanation behind it');
 vm.closePreview(true);assert.equal(vm.previewCard,null);assert.equal(vm.tutorialInspectionChecked(legacy),true);
 method('tutorialAdvance').call(vm);assert.equal(vm.advanced,true);
 assert.deepEqual(cards.call(vm,{say:'墓地のカードの【疾駆】を確認します。',focus:'selfGraveyard',inspect:['音速の忍']}),[grave]);
 assert.deepEqual(cards.call(vm,{say:'「秘密の手札」を確認します。',inspect:['秘密の手札']}),[],'an opponent hand is never exposed');
 assert.deepEqual(cards.call(vm,{say:'オラクルは墓地に置かれました。',focus:'selfGraveyard'}),[],'graveyard location alone never reopens the last card');
 assert.deepEqual(cards.call(vm,{say:'「鐘鳴らしの童」を出せましたね。',cards:['self-field:鐘鳴らしの童']}),[],'name mentions and highlights do not request inspection');
 assert.deepEqual(cards.call(vm,{say:'次の練習へ進みましょう。',focus:'selfKami'}),[],'focusing a Kami alone does not request inspection');
 assert.deepEqual(cards.call(vm,{task:'カードを使用してください',cards:['self-field:鐘鳴らしの童']}),[],'target tasks cannot be blocked by a new inspection');
});

test("completion waits for an explicit choice and shields the menu stamp from repeated clicks", async () => {
 let now=100,returned=0,pickReturned=0,saved=0;const timers=[];
 const clock={now:()=>now};
 const set=(cb,delay)=>{const timer={cb,at:now+delay,cancelled:false};timers.push(timer);return timer};
 const clear=timer=>{if(timer)timer.cancelled=true};
 const advance=ms=>{now+=ms;for(const timer of timers)if(!timer.cancelled&&timer.at<=now){timer.cancelled=true;timer.cb()}};
 const queue=method('_tutorialQueueCompletion','setTimeout,clearTimeout,Date');
 const vm={tutorialLesson:{id:'cards',title:'カードの種類'},tutorial:{},tutorialProgress:{basic:true},tutorialMenuOpen:false,tutorialCompletion:null,
 _tutorialStop(){this.tutorial=null},hideCardHover(){},_sfxPlay(){},_bgmPlay(key){assert.equal(key,'victory')},_tutorialScrollCompletedLesson(){},$refs:{},$nextTick:fn=>fn(),
 _bgmRestoreAfterBattle(){},battleReturnNow(){returned++},_tutorialLeavePick(){pickReturned++},startTutorial(id){assert.ok(this.tutorialCompletion,'victory music stays protected while the next lesson loads');this.started=id;return true},
 _tutorialQueueCompletion(){queue.call(this,set,clear,clock)}};
 const finishMethod=method('_tutorialFinish','localStorage,TUTORIAL_PROGRESS_STORAGE_KEY,Date,TUTORIAL_LESSONS');
 const finish=(...args)=>finishMethod.call(vm,...args,lessons);
 const chooseMethod=method('tutorialChooseCompletion','action,Date',true);
 const choose=function(action){return chooseMethod.call(this,action,clock)};
 const storage={setItem(k,v){saved++;assert.equal(k,'progress');assert.deepEqual(JSON.parse(v),{basic:true,cards:true})}};
 finish(storage,'progress',clock);
 assert.equal(saved,1);assert.equal(vm.tutorialCompletion.stage,'ending');assert.equal(returned,0);assert.equal(vm.tutorialMenuOpen,false);
 finish(storage,'progress',clock);assert.equal(saved,1,'repeated finishing cannot start a second animation');
 await choose.call(vm,'next');assert.equal(vm.started,undefined,'early clicks cannot launch the next tutorial');
 const input=method('tutorialCompletionInput','event,Date');let stopped=0;
 const event={preventDefault(){},stopPropagation(){stopped++}};
 advance(1800);input.call(vm,event,clock);advance(100);assert.equal(returned,0,'a late click keeps the ending screen above the board');
 advance(399);assert.equal(returned,0);advance(1);assert.equal(returned,0);assert.equal(vm.tutorialCompletion.ready,true);
 advance(10000);assert.equal(vm.tutorialCompletion.stage,'ending','the ending does not dismiss itself');
 await choose.call(vm,'menu');assert.equal(returned,1);assert.equal(vm.tutorialMenuOpen,true);assert.equal(vm.tutorialCompletion.stage,'menuStamp');
 advance(1400);assert.equal(vm.tutorialCompletion.stage,'menuShield');
 advance(500);input.call(vm,event,clock);advance(100);assert.ok(vm.tutorialCompletion,'menu input stays shielded after a carried click');
 advance(400);assert.equal(vm.tutorialCompletion,null);assert.equal(returned,1);assert.equal(stopped,2);
 vm.tutorialLesson={id:'draft',title:'選別の練習',kind:'pick'};finish({setItem(){}},'progress',clock);advance(1900);
 assert.equal(vm.tutorialCompletion.nextLessonId,null);await choose.call(vm,'menu');
 assert.equal(pickReturned,1);assert.equal(returned,1,'pick practice uses its own return route');advance(1400);assert.equal(vm.tutorialCompletion.stage,'menuShield');advance(600);assert.equal(vm.tutorialCompletion,null);
 assert.match(html,/this.tutorialCompletion && this.tutorialCompletion !== completion/);
 assert.match(html,/@pointerdown.capture="tutorialCompletionInput\(\$event\)"/);
 assert.match(html,/tutorial-lesson-seal[\s\S]*?済<\/span>/);
 assert.match(html,/battleContext.source !== 'tutorial' && !battleLogModal/);
 assert.match(html,/class="tutorial-result-overlay"/);
 vm.tutorialLesson=lessons[0];finish({setItem(){}},'progress',clock);advance(1900);await choose.call(vm,'next');
 assert.equal(vm.started,'preparation');assert.equal(vm.tutorialCompletion,null);assert.equal(vm.tutorialMenuOpen,false);
 vm.tutorialLesson=lessons.at(-1);finish({setItem(){}},'progress',clock);advance(1900);await choose.call(vm,'next');
 assert.equal(vm.tutorialCompletion.stage,'ending','the final lesson has no nonexistent next lesson');
 assert.match(html,/data-tutorial-completion-action[^>]*:disabled="!tutorialCompletion.ready"/);
});

test("the completion overlay captures clicks and keys before tutorial or battle actions", () => {
 const completion={};let absorbed=0;
 const vm={tutorialCompletion:completion,tutorialCompletionInput(){absorbed++},tutorialAdvance(){assert.fail('no advancement during the stamp')}};
 method('tutorialSurfaceClick','event').call(vm,{});
 method('onKeyDown','e').call(vm,{});
 assert.equal(absorbed,2);
});

test("confirming an ability immediately enables its following play task on the first drop", async () => {
 const lesson=lessons.find(l=>l.id==='cards'),card={no:128,name:'救済の手',category:'オラクル'},index=lesson.steps.findIndex(s=>s.inspect&&s.inspect.includes('救済の手')),step=lesson.steps[index];
 const vm={tutorial:{index,typed:0,inspectedCards:[],inspectOpening:{index,key:'card:128'}},tutorialLesson:lesson,
 tutorialStep:step,tutorialFullText:step.say,tutorialInspectionCards:[card],previewCard:card,
 battleContext:{source:'tutorial'},battleSample:{self:{hand:[card]},activeSide:'self'},
 $set:(o,k,v)=>{o[k]=v},_sfxPlay(){},hideCardHover(){},fullName:c=>c.name,
 tutorialInspectionKey:method('tutorialInspectionKey','card'),tutorialInspectionChecked:method('tutorialInspectionChecked','card'),
 tutorialAdvance:method('tutorialAdvance'),_tutorialAllows:method('_tutorialAllows','kind,name'),
 _tutorialGo(i){this.tutorial.index=i;this.tutorialStep=lesson.steps[i]},
 _tutorialNudge(){assert.fail('the first valid play must not be treated as an explanation mistake')},
 battleEnsureSelfTurn:()=>true,battleResolveOptionalTapCost:async()=>0,battleSublimCostOptions:()=>[2],
 _battlePlayOracle(i,cost){this.played={i,cost}}};
 method('closePreview','confirmed').call(vm,true);
 assert.equal(vm.tutorial.index,index+1);assert.equal(vm.tutorialStep,lesson.steps[index+1]);assert.equal(vm.previewCard,null);
 await method('battlePlayFromHand','index,expectedZone,evolveBaseHint',true).call(vm,0,'legacies');
 assert.deepEqual(vm.played,{i:0,cost:2});
 vm.tutorial.index=index;vm.tutorialStep=step;vm.previewCard=card;vm.tutorial.inspectedCards=[];
 vm.tutorial.inspectOpening={index,key:'card:128'};vm.tutorialInspectionCards=[card,{no:21}];
 method('closePreview','confirmed').call(vm,true);assert.equal(vm.tutorial.index,index,'all required cards must be confirmed before the task');
 vm.tutorialLesson={steps:[step,{say:'another explanation'}]};vm.tutorial.index=0;vm.tutorial.inspectOpening={index:0,key:'card:128'};
 vm.tutorialInspectionCards=[card];vm.previewCard=card;
 method('closePreview','confirmed').call(vm,true);assert.equal(vm.tutorial.index,0,'confirmation does not skip another explanation');
});

test("tutorial inspection targets belong only to the current ability explanation", () => {
 const cardLesson=lessons.find(l=>l.id==='cards');
 assert.deepEqual(cardLesson.steps.filter(s=>s.inspect).map(s=>s.inspect),[['幼き守護者・ミナト'],['救済の手']]);
 const reroll=lessons.find(l=>l.id==='reroll');
 assert.deepEqual(reroll.steps[7].inspect,['音速の忍']);
 assert.equal(reroll.steps[9].inspect,undefined,'playing the previously explained legacy does not reopen its detail');
 for(const l of lessons)for(const s of l.steps)if(s.inspect){assert.ok(s.say&&!s.task);assert.ok(Array.isArray(s.inspect)&&s.inspect.length);}
});

test("clicking anywhere in explanation mode advances once without firing battle controls", () => {
 const click=method('tutorialSurfaceClick','event');let advanced=0,stopped=0,prevented=0;
 const vm={tutorial:{},tutorialMode:'say',previewCard:null,battleSkillCloseup:null,_battleHasBlockingModal:()=>false,tutorialAdvance(){advanced++}};
 const event={target:{closest:()=>null},stopPropagation(){stopped++},preventDefault(){prevented++}};
 click.call(vm,event);assert.equal(advanced,1);assert.equal(stopped,1);assert.equal(prevented,1);
 event.target.closest=()=>({});click.call(vm,event);assert.equal(advanced,1,'panel and quit controls keep their own handlers');
 event.target.closest=()=>null;
 vm.tutorialMode='task';click.call(vm,event);assert.equal(advanced,1,'actual exercises cannot be skipped');
 vm.tutorialMode='say';vm.previewCard={};click.call(vm,event);assert.equal(advanced,1,'detail clicks close the preview instead');
 vm.previewCard=null;vm._battleHasBlockingModal=()=>true;click.call(vm,event);assert.equal(advanced,1,'required dialogs remain usable');
 vm._battleHasBlockingModal=()=>false;vm.tutorial=null;click.call(vm,event);assert.equal(advanced,1,'ordinary battles are unaffected');
 assert.match(html,/<div id="app"[^>]*@click.capture="tutorialSurfaceClick\(\$event\)"/);
 assert.match(html,/<div v-if="[^"]*!_battleHasBlockingModal\(\)[^"]*" class="tutorial-catcher"/,'explanation clicks cannot cover return confirmations or other battle dialogs');
});

test("the first lesson waits for greeting and the opponent reply, without overlapping speech or stale replies", () => {
 const lesson=lessons[0],step=lesson.steps.find(s=>s.id==='greeting');
 assert.ok(lesson.steps.indexOf(step)<lesson.steps.findIndex(s=>s.action==='startTurn'));
 const bubbles=[],published=[];let ticks=0;
 const vm={tutorial:{flags:{}},tutorialStep:step,battleSample:{self:{kami:{no:8}},opp:{kami:{no:3}}},
 $set:(o,k,v)=>o[k]=v,_sfxPlay(){},_tutorialNudge(){},playKamiVoice:(kami,key)=>({kami,key}),
 _battleEmoteLineFor:(kami,key)=>kami.no+':'+key,_battlePublishEmote:key=>published.push(key),
 _tutorialTick(){ticks++},_battleShowEmoteBubble(side,text,voice,onDone,options){bubbles.push({side,text,voice,onDone,options})}};
 const send=method('battleSendEmote','key');
 send.call(vm,'praise');assert.equal(bubbles.length,0);assert.equal(step.done(vm),false);
 send.call(vm,'greeting');assert.equal(bubbles.length,1);assert.equal(bubbles[0].side,'self');assert.equal(bubbles[0].options.endWithVoice,true);
 send.call(vm,'greeting');assert.equal(bubbles.length,1,'repeated greetings cannot cancel the pending response');
 bubbles[0].onDone();assert.equal(bubbles.length,2);assert.equal(bubbles[1].side,'opp');assert.equal(bubbles[1].voice.kami.no,3);
 assert.equal(step.done(vm),false,'the reply is read before the card explanation');
 bubbles[1].onDone();assert.equal(step.done(vm),true);assert.equal(ticks,1,'the next explanation is updated immediately');assert.deepEqual(published,['greeting']);
 vm.tutorial={flags:{}};send.call(vm,'greeting');vm.tutorial=null;bubbles[2].onDone();assert.equal(bubbles.length,3,'leaving the lesson cancels its reply');
 send.call(vm,'praise');assert.equal(bubbles[3].side,'self');assert.equal(bubbles[3].onDone,null,'ordinary emotes have no scripted reply');
});

test("greeting playback starts the reply and releases the lesson immediately when each voice ends", async () => {
 const step=lessons[0].steps.find(s=>s.id==='greeting'),voices=[];let ticks=0;
 const vm={tutorial:{flags:{}},tutorialStep:step,emoteBubbles:{self:null,opp:null},
 battleSample:{self:{kami:{no:8}},opp:{kami:{no:3}}},$set:(o,k,v)=>o[k]=v,
 _sfxPlay(){},_tutorialNudge(){},_battlePublishEmote(){},_tutorialTick(){ticks++},
 _battleEmoteLineFor:kami=>kami.no===8?'よろしくお願いしますね':'よろしく頼みます',
 playKamiVoice(kami){let finish;const done=new Promise(r=>{finish=r});voices.push({kami,finish});return{done}}};
 const clock=speechClock(vm),show=method('_battleShowEmoteBubble','side,text,voice=null,onDone=null,speechOptions={}');
 vm._battleShowEmoteBubble=function(...args){return show.apply(this,args)};
 method('battleSendEmote','key').call(vm,'greeting');
 clock.advance(100);assert.equal(voices.length,1);
 voices[0].finish(true);await Promise.resolve();
 assert.equal(voices.length,2,'no 4.5-second reading timer delays the reply');
 assert.equal(vm.emoteBubbles.self,null);assert.equal(vm.emoteBubbles.opp.text,'よろしく頼みます');
 clock.advance(10000);assert.equal(ticks,0,'a long voice still plays in full');
 voices[1].finish(true);await Promise.resolve();
 assert.equal(vm.emoteBubbles.opp,null);assert.equal(step.done(vm),true);
 assert.equal(ticks,1,'no timer or polling interval blocks progress after the reply');
});

test("muted or failed greeting voices use a short readable fallback and canceled speech stays canceled", async () => {
 const vm={},clock=speechClock(vm),finished=[];
 vm._battleHoldSpeech('よろしく',null,()=>finished.push('muted'),{endWithVoice:true});
 clock.advance(1199);assert.deepEqual(finished,[]);clock.advance(1);assert.deepEqual(finished,['muted']);
 vm._battleHoldSpeech('よろしく',{done:Promise.resolve(false)},()=>finished.push('failed'),{endWithVoice:true});
 await Promise.resolve();clock.advance(1199);assert.deepEqual(finished,['muted']);clock.advance(1);assert.deepEqual(finished,['muted','failed']);
 let finish;const canceled=vm._battleHoldSpeech('よろしく',{done:new Promise(r=>{finish=r})},()=>finished.push('canceled'),{endWithVoice:true});
 canceled.cancel();finish(true);await Promise.resolve();clock.advance(5000);
 assert.deepEqual(finished,['muted','failed']);
});

test("completion buttons become usable only after the input shield, and victory music stays through the stamp", () => {
 let blocked=0,picked=0;
 const vm={tutorialCompletion:{stage:'ending',ready:true},_tutorialQueueCompletion(){assert.fail('ready endings need no timer')}};
 const input=method('tutorialCompletionInput','event');
 const event={target:{closest:()=>({})},preventDefault(){blocked++},stopPropagation(){blocked++}};
 input.call(vm,event);assert.equal(blocked,0);
 event.target.closest=()=>null;input.call(vm,event);assert.equal(blocked,2);
 vm._bgmAutoPickForView=()=>picked++;
 method('_bgmRestoreAfterBattle','view,BGM_FILES').call(vm,'top',{victory:{category:'result'}});assert.equal(picked,0);
 method('_bgmAutoPickForView','view').call(vm,'top');
 vm.tutorialCompletion=null;vm.bgmCurrentKey='victory';
 method('_bgmRestoreAfterBattle','view,BGM_FILES').call(vm,'top',{victory:{category:'result'}});assert.equal(picked,1);
});

test("leaving victory music fades the old track while the new track rises without muting master volume", async () => {
 const ramps=[],sources=[],timers=[];let oldStopped=0,oldDisconnected=0;
 const makeGain=()=>({gain:{value:1,cancelScheduledValues(){},setValueAtTime(v,t){ramps.push(['set',v,t])},linearRampToValueAtTime(v,t){ramps.push(['ramp',v,t])}},connect(){},disconnect(){}});
 const ctx={state:'running',currentTime:10,createGain:makeGain,createBufferSource(){const n={connect(){},start(){},stop(){},disconnect(){}};sources.push(n);return n}};
 const vm={_bgmCtx:ctx,_bgmPlayingKey:'victory',_bgmTrackGain:makeGain(),_bgmGain:{gain:{value:.3}},
 _bgmSourceNodes:[{stop(){oldStopped++},disconnect(){oldDisconnected++}}],
 _bgmLoadBuffer:async()=>({buffer:{duration:20}}),_bgmAudioCtx:()=>ctx,_bgmAnnounce(){}};
 const stop=method('_bgmStopCurrentSource','fadeSec=0,setTimeout,clearTimeout');
 vm._bgmStopCurrentSource=fade=>stop.call(vm,fade,(cb)=>{timers.push(cb);return cb},()=>{});
 await method('_bgmPlay','key,options={},BGM_FILES',true).call(vm,'lesson',{}, {lesson:{}});
 assert.equal(oldStopped,0);assert.equal(oldDisconnected,0);assert.equal(sources.length,1);
 assert.ok(ramps.some(r=>r[0]==='ramp'&&r[1]===0&&r[2]===10.65));
 assert.ok(ramps.some(r=>r[0]==='ramp'&&r[1]===1&&r[2]===10.65));
 assert.equal(vm._bgmGain.gain.value,.3);
 timers[0]();assert.equal(oldStopped,1);assert.equal(oldDisconnected,1);assert.equal(vm._bgmRetiringTracks.size,0);
});

test("explanation clicks open targets but only the confirm button can close them", () => {
 const a={no:1},b={no:2};
 const vm={tutorial:{typed:0,index:1,inspectedCards:[]},tutorialStep:{say:'説明'},tutorialFullText:'説明',previewCard:null,
 tutorialInspectionCards:[a,b],_sfxPlay(){},hideCardHover(){},$set:(o,k,v)=>{o[k]=v},_tutorialGo(){this.advanced=true},
 tutorialInspectionKey:method('tutorialInspectionKey','card'),tutorialInspectionChecked:method('tutorialInspectionChecked','card'),
 openPreview:method('openPreview','card'),closePreview:method('closePreview','confirmed'),tutorialInspectCard:method('tutorialInspectCard','card')};
 const advance=method('tutorialAdvance');
 advance.call(vm);assert.equal(vm.tutorial.typed,2);assert.equal(vm.previewCard,null);
 advance.call(vm);assert.equal(vm.previewCard,a);
 vm.closePreview();assert.equal(vm.previewCard,a,'background clicks and Escape cannot dismiss an inspection');
 vm.closePreview({type:'click'});assert.equal(vm.previewCard,a,'an event object cannot serve as confirmation');
 assert.equal(vm.tutorialInspectionChecked(a),false);
 advance.call(vm);assert.equal(vm.previewCard,a);assert.equal(vm.advanced,undefined);
 vm.closePreview(true);assert.equal(vm.previewCard,null);assert.equal(vm.tutorialInspectionChecked(a),true);
 advance.call(vm);assert.equal(vm.previewCard,b);assert.equal(vm.advanced,undefined);
 vm.closePreview(true);advance.call(vm);assert.equal(vm.advanced,true);
 vm.tutorial=null;vm.previewCard=a;vm.closePreview();assert.equal(vm.previewCard,null,'ordinary details keep their dismissal behavior');
 assert.match(html,/@click="closePreview\(true\)"[^>]*>.*効果を確認して閉じる/);
 assert.doesNotMatch(html,/tutorialPreviewClick/);
});

test("tutorial target cards open once on hover and direct taps count as inspection", () => {
 const card={no:21,name:'鐘鳴らしの童'},other={no:63,name:'音速の忍'};
 const vm={appView:'battle',tutorial:{index:2,inspectedCards:[]},tutorialInspectionCards:[card],previewCard:null,
 battleCardHoverBlocked:()=>false,_sfxPlay(){},hideCardHover(){this.hoverCard=null},$set:(o,k,v)=>{o[k]=v},
 tutorialInspectionKey:method('tutorialInspectionKey','card'),tutorialInspectionChecked:method('tutorialInspectionChecked','card'),
 openPreview:method('openPreview','card'),closePreview:method('closePreview','confirmed'),tutorialInspectCard:method('tutorialInspectCard','card'),
 isSpoilerHidden:()=>false,cardImageUrl:()=>null};
 const hover=method('showCardHover','card,event,allowKamiSpoiler=false');
 hover.call(vm,card,{});assert.equal(vm.previewCard,card);
 vm.closePreview(true);assert.equal(vm.tutorialInspectionChecked(card),true);
 hover.call(vm,card,{});assert.equal(vm.previewCard,null,'confirmed targets must not repeatedly open');
 vm.tutorial.inspectedCards=[];
 vm.openPreview(card);vm.closePreview(true);assert.equal(vm.tutorialInspectionChecked(card),true,'direct card taps count');
 vm.tutorial.inspectedCards=[];
 vm.openPreview(other);vm.closePreview(true);assert.equal(vm.tutorialInspectionChecked(card),false,'unrelated details do not satisfy inspection');
 vm.tutorialInspectionCards=[];hover.call(vm,card,{});assert.equal(vm.previewCard,null,'task steps do not auto-open details');
 assert.match(html,/tutorialMode === 'say' && !tutorialInspectionCards.length[\s\S]*?class="tutorial-catcher"/);
});

test("card detail closes before the required tutorial answer, and blocked hover stays hidden", () => {
 const card={no:21},pending={sourceCard:card},vm={appView:'battle',previewCard:card,dslOptionalModal:pending,hoverCard:card,
 _battleTrapModalFocus:()=>false,battleToggleHoveredFieldCard:()=>false,_battleHasBlockingModal:()=>true,
 closePreview:method('closePreview','confirmed'),_sfxPlay(){},hideCardHover:method('hideCardHover'),
 battleCardHoverBlocked:method('battleCardHoverBlocked'),dslAnswerOptional(){assert.fail('Escape must not answer the covered question')}};
 method('onKeyDown','e').call(vm,{key:'Escape',preventDefault(){}});
 assert.equal(vm.previewCard,null);assert.equal(vm.dslOptionalModal,pending);assert.equal(vm.hoverCard,null);
 method('showCardHover','card,event,allowKamiSpoiler=false').call(vm,card,{});assert.equal(vm.hoverCard,null);
 vm.battleModalPeek=true;assert.equal(vm.battleCardHoverBlocked(),false,'intentional field peek permits card inspection');
 const watch=html.match(/this\.\$watch\(\(\) => this\._battleHasBlockingModal\(\), \(opened\) => \{([\s\S]*?)\n    \}\);/g).find(s=>s.includes('_battleDialogPreviousFocus'));
 assert.ok(watch);assert.doesNotMatch(watch,/key ===|e\.preventDefault/,'dialog close cannot reference an undefined key event');
});

test("Susanoo ability icons open the correct Kami detail even in a mirror match", () => {
 const kami={no:1,isKami:true},vm={appView:'battle',battleSample:{self:{kami,graveyardEvolutionEnabled:true},opp:{kami,graveyardEvolutionEnabled:false}},
 _sfxPlay(){},hideCardHover(){},openPreview:method('openPreview','card')};vm.battleView=vm.battleSample;
 const open=method('battleOpenKamiAbility','side'),active=method('battlePreviewGraveyardEvolutionActive');
 open.call(vm,'self');assert.equal(vm.previewCard,kami);assert.equal(active.call(vm),true);
 open.call(vm,'opp');assert.equal(active.call(vm),false,'a shared card object cannot show the other side’s ability');
 assert.match(html,/@click.stop="battleOpenKamiAbility\('self'\)"/);
 assert.match(html,/@click.stop="battleOpenKamiAbility\('opp'\)"/);
 assert.equal(html.includes('神技2'),false);assert.match(lessons.find(l=>l.id==='skill2').steps[0].say,/必殺技のようなもの/);
});

test("generated hand tokens enlarge during battle without revealing spoilers in the card list", () => {
  const rect={left:400,right:470,top:500,height:100};
  const el={closest:()=>null,getBoundingClientRect:()=>rect},event={currentTarget:el};
  const screen={innerWidth:1280,innerHeight:900};
  const hover=method('showCardHover','card,event,window,allowKamiSpoiler=false');
  for (const no of ['187','188']) {
    const card={no,isToken:true,spoiler:true};
    const vm={appView:'battle',hoverCard:null,battleCardHoverBlocked:()=>false,isSpoilerHidden:c=>!!c.spoiler,cardImageUrl:()=>`cards/${no}.webp`};
    hover.call(vm,card,event,screen);
    assert.equal(vm.hoverCard,card,'a generated, visible battle token can be enlarged');
    assert.ok(vm.hoverLeft>=0 && vm.hoverLeft+360<=screen.innerWidth);
    vm.appView='cards';vm.hoverCard=null;
    hover.call(vm,card,event,screen);
    assert.equal(vm.hoverCard,null,'the card-list spoiler gate stays active');
    card.spoiler=false;hover.call(vm,card,event,screen);
    assert.equal(vm.hoverCard,card,'ordinary cards still enlarge outside battle');
  }
});

test("pick practice uses current picks for recommendations and shares the real draft reason labels", () => {
  const guard={no:'1'},synergy={no:'2'},other={no:'3'};
  const p={kamiNo:'8',pack:[guard,synergy,other],picks:[]};
  const vm={tutorialPick:p,pickAssistEnabled:false,gsCpuKamiAffinityTags:no=>{assert.equal(no,'8');return ['guard']},
    draftRecommendedNos:method('draftRecommendedNos','scored'),draftRecommendationReasons:method('draftRecommendationReasons','scored,recommendedNos'),
    gsCpuScoreBreakdown(card,ctx){
      assert.equal(ctx.pickedCards,p.picks);assert.deepEqual(ctx.kamiTags,['guard']);
      const kami=card===guard?24:0,tribe=card===synergy&&ctx.pickedCards.length?18:0,color=tribe?14:0;
      return {total:10+kami+tribe+color,kami,tribe,color,curve:0,other:10};
    }};
  const recommendations=method('tutorialPickRecommendations');
  let result=recommendations.call(vm);assert.deepEqual(result.nos,['1']);assert.deepEqual(result.reasons['1'],['カミ']);
  p.picks.push({no:'4',type:'神使',color:'黄'});result=recommendations.call(vm);
  assert.deepEqual(result.nos,['2']);assert.deepEqual(result.reasons['2'],['種族','属性'],'reasons adapt to cards already picked');
  p.pack=[];assert.deepEqual(recommendations.call(vm),{nos:[],reasons:{}});
  assert.deepEqual(vm.draftRecommendedNos([{c:guard,s:100,parts:{}}]),[],'the last card is not recommended by default');
  vm.gsDraftPackScored={scored:[]};assert.deepEqual(method('gsDraftRecommendedCardNos').call(vm),[],'normal draft still respects disabled assistance');
  const practice=Function('return '+html.match(/const TUTORIAL_PRACTICE = Object.freeze\(([\s\S]*?)\);\r?\nconst TUTORIAL_LESSONS/)[1])();
  const explanations=practice.steps.filter(s=>s.id&&s.id.startsWith('pick-recommend-'));
  assert.equal(explanations.length,3);assert.ok(explanations.every(s=>s.focus==='pickRecommend'));
  for(const label of ['カミ','属性','種族','コスト','その他'])assert.ok(explanations.some(s=>s.say.includes('「'+label+'」')),label);
});

test("chibi hover resolves Kami cards and guide approval cannot unlock card-list spoilers", () => {
  const kami={no:'10',isKami:true,spoiler:true},ordinary={no:'10',spoiler:true};
  const screen={innerWidth:390,innerHeight:844};
  const event={currentTarget:{closest:()=>null,getBoundingClientRect:()=>({left:250,right:350,top:300,height:180})}};
  const hover=method('showCardHover','card,event,window,allowKamiSpoiler=false');
  const vm={appView:'cards',allKamiCards:[kami],allCards:[ordinary],hoverCard:null,
    manualModalOpen:true,manualOrochiRevealed:false,battleCardHoverBlocked:()=>false,
    isSpoilerHidden:c=>!!c.spoiler,cardImageUrl:c=>c.isKami?'kami/10.webp':'cards/10.webp',
    showCardHover(card,e,allow){hover.call(this,card,e,screen,allow)}};
  const show=method('showGuideKami','no,event');
  show.call(vm,10,event);assert.equal(vm.hoverCard,null,'hidden guide portraits cannot reveal a Kami');
  vm.manualOrochiRevealed=true;show.call(vm,10,event);
  assert.equal(vm.hoverCard,kami,'overlapping card numbers resolve to the Kami');
  assert.ok(vm.hoverLeft>=10 && vm.hoverLeft+360<=screen.innerWidth-10,'enlarged card stays on a narrow screen');
  vm.hoverCard=null;hover.call(vm,kami,event,screen);assert.equal(vm.hoverCard,null,'guide consent is scoped, not a global spoiler unlock');
  hover.call(vm,ordinary,event,screen,true);assert.equal(vm.hoverCard,null,'Kami permission cannot expose a hidden Legacy');
  vm.manualModalOpen=false;show.call(vm,10,event);assert.equal(vm.hoverCard,null,'closed guide consent cannot be reused');
});

test("Kagutsuchi skill 2 waits for enemy death effects to restore perspective before damaging the enemy", async () => {
  for (const cpu of [false,true]) {
    const kami={no:7},legacy={no:21},caster={kami,life:10,lifeMax:10},enemy={life:10,lifeMax:10};
    let releaseDeath,deathStarted;
    const pendingDeath=new Promise(r=>{releaseDeath=r}),started=new Promise(r=>{deathStarted=r});
    const vm={battleSample:{self:caster,opp:enemy},_dslCurrentSource:kami,_dslSwapped:cpu,
      dslApplySublimAlternative:a=>a,dslChooseTargets:async()=>[legacy],
      _dslDefaultBothCategoriesIfUnrestricted:s=>s,_dslCardEffPower:()=>1000,
      _dslMoveFromField:()=>true,battleSaveUndo(){},battleShowNotice(){},fullName:()=>'',battleFireKamiEvent(){},
      _dslCurrentSourceSide:method('_dslCurrentSourceSide'),
      async battleRunDeathKeywordEffects(){
        [this.battleSample.self,this.battleSample.opp]=[this.battleSample.opp,this.battleSample.self];
        deathStarted();await pendingDeath;
        [this.battleSample.self,this.battleSample.opp]=[this.battleSample.opp,this.battleSample.self];
      },
      _dslOpDestroy:method('_dslOpDestroy','act,sourceCard',true),_dslOpLife:method('_dslOpLife','act,sourceCard'),
      async dslRunAction(a,source){if(a.操作==='破壊')await this._dslOpDestroy(a,source);else this._dslOpLife(a,source)},
    };
    const actions=specs.K7.能力.filter(a=>a.契機==='神技')[1].処理;
    const using=method('dslRunActions','actions,sourceCard',true).call(vm,actions,kami);
    await started;await new Promise(r=>setImmediate(r));
    const beforeDeathFinished={caster:caster.life,enemy:enemy.life};
    releaseDeath();await using;await Promise.resolve();
    assert.deepEqual(beforeDeathFinished,{caster:10,enemy:10},'the damage must not run while death effects have swapped the players');
    assert.equal(caster.life,10,'the caster never receives its own three damage');
    assert.equal(enemy.life,7);
    assert.equal(vm.battleSample.self,caster);
  }
});

test("second divine skill lesson starts without enemy shinobi and revives the seven-cost dragon for victory", () => {
  const lesson = lessons.find(l => l.id === "skill2");
  assert.ok(lesson.setup.self.graveyard.includes("紅翼龍・ルベル"));
  assert.equal(lesson.setup.opp.life, 3);
  const enemyTurn = lesson.steps.find(s => s.script);
  assert.deepEqual(enemyTurn.script, [{ skill: 2, destroy: "音速の忍", damage: 3 }, { play: "翠牙龍・ヴィリデ" }]);
  assert.ok(lesson.setup.opp.manaMax + 1 >= 7, "Viride can actually be paid for");
  const remainingLife = lesson.setup.self.life - 3 + 1; // prayer heals one
  assert.equal(remainingLife, 2);
  assert.deepEqual(lesson.setup.opp.legacies, [], "no initial enemy attacks can defeat the player before resurrection");
  assert.ok(lesson.setup.self.legacies.includes("音速の忍"), "keep the player's target for Kagutsuchi's destruction");
  assert.ok(3 >= remainingLife, "Viride remains lethal if its attack is not guarded");
  assert.ok(!lesson.steps.some(s => s.say && /2体の忍|残る神攻/.test(s.say)), "dialogue must match the single enemy dragon");
  assert.ok(lesson.setup.self.manaMax + 1 < 7, "Rubel's ordinary cost is out of reach");
  assert.ok(specs["21"].能力.some(a => a.処理.some(p => (p.付与 || []).includes("疾駆"))));
  assert.deepEqual(lesson.steps.find(s => s.targets).targets, ["紅翼龍・ルベル"]);
  assert.deepEqual(lesson.steps.find(s => s.allow && s.allow.divine).allow.divine, ["紅翼龍・ルベル"]);
});

test("fatigue explains turn damage and records defeat for either player, including CPU swaps", () => {
  const fatigue = method("_battleApplyFatigue", "side,turn");
  for (const swapped of [false, true]) for (const side of ["self", "opp"]) {
    const notices = [], cues = [];
    const vm = { _dslSwapped: swapped, battleSample: { self: {life: 10}, opp: {life: 10}, result: null },
      battleShowNotice: (...args) => notices.push(args), _battleShowFatigueEffect: (...args) => cues.push(args),
      battleApplyLifeReplacement() {}, _battleCheckResult: method("_battleCheckResult", "cause = null") };
    fatigue.call(vm, side, 11);
    assert.equal(vm.battleSample[side].life, 9);
    assert.equal(vm.battleSample.result, null);
    assert.match(notices[0][1], /11ターン目.*疲労ダメージ1/);
    vm.battleSample[side].life = 2;
    fatigue.call(vm, side, 12);
    const result = vm.battleSample.result;
    assert.equal(result.reason, "fatigue:12:2");
    assert.equal(result.outcome, (side === "self") !== swapped ? "loss" : "win");
    assert.match(method("battleResultReasonText").call(vm), /12ターン目.*疲労ダメージ2.*敗北/);
    assert.deepEqual(cues[1], [side, 12, 2]);
  }
});

test("fatigue respects life-zero replacement and an already decided deck-out result", () => {
  const apply = method("_battleApplyFatigue", "side,turn");
  const vm = { battleSample: { self: {life: 1}, opp: {life: 10}, result: null },
    battleShowNotice() {}, _battleShowFatigueEffect() {},
    battleApplyLifeReplacement(side) { if (this.battleSample[side].life === 0) this.battleSample[side].life = 1; },
    _battleCheckResult: method("_battleCheckResult", "cause = null") };
  apply.call(vm, "self", 11);
  assert.equal(vm.battleSample.result, null);
  vm.battleSample.result = { outcome: "loss", reason: "山札切れ" };
  apply.call(vm, "self", 12);
  assert.equal(vm.battleSample.self.life, 1);
  assert.equal(vm.battleSample.result.reason, "山札切れ");
});

test("each Kami has both themed skill variants, and minimal motion suppresses field effects", () => {
  const { divineSkillTheme } = require("../divine_effects.js");
  const motifs = new Set();
  for (let no = 1; no <= 10; no++) {
    const first = divineSkillTheme({no}, 1), second = divineSkillTheme({no}, 2);
    motifs.add(first.motif);
    assert.equal(first.motif, second.motif);
    assert.notEqual(first.label, second.label);
    assert.equal(second.index, 2);
  }
  assert.equal(motifs.size, 10);
  assert.equal(divineSkillTheme({no: 7}, 2).motif, "flame");
  assert.equal(divineSkillTheme({no: 8}, 2).motif, "sun");
  assert.doesNotThrow(() => method("_battleShowDivineResolution", "kami,index,rect").call({ appView: "battle", battleAnimationSpeed: "minimal" }, {no:8}, 2));
});

test("normal battle presents both skills only after target selection and effect resolution", async () => {
  for (const index of [1, 2]) {
    const events = [];
    let finishSelection;
    const selected = new Promise(resolve => { finishSelection = resolve; });
    const kami = { no: "8", name: "アマテラス" };
    const vm = { battleSkillOptions: [{ index, enabled: true, cost: 3, name: "神技" }],
      battleSample: { self: { kami, tenryoku: 7 }, result: null }, battleContext: {selfName: "あなた"},
      battleSkillModal: {}, effectSpecsReady: true, _tutorialAllows: () => true,
      battleSaveUndo() {}, battleShowNotice() {}, _dslGetSpec: () => ({能力: [{契機: "神技", 処理: []}, {契機: "神技", 処理: []}]}),
      async dslRunActions() {
        assert.equal(this.battleSample.self.tenryoku, 4);
        assert.equal(this.battleSkillModal, null);
        events.push("selecting"); await selected; events.push("resolved");
      },
      _battlePublishSkill2() { events.push("publish"); },
      async _battleShowSkill1Closeup() { events.push("cutin1"); },
      async _battleShowSkill2Closeup() { events.push("cutin2"); },
      _sfxPlay() {}, _battleShowDivineResolution() { events.push("field"); },
      _battleFinishDivinePresentation: method("_battleFinishDivinePresentation"),
    };
    const using = method("battleUseKamiSkill", "index", true).call(vm, index);
    assert.deepEqual(events, ["selecting"], "no pre-use cinematic while choosing targets");
    finishSelection(); await using;
    assert.deepEqual(events, ["selecting", "resolved", "publish", "cutin" + index]);
    assert.equal(vm._battleDivineContext, null);
  }
});

test("target effects wait for the cinematic, deduplicate a card and keep its resolved position", () => {
  const kami = {no:4}, rect = {left:120,top:260,width:90,height:130};
  const context = {kami,index:2,targets:[],transfers:[],presented:false};
  const vm = {appView:'battle',battleAnimationSpeed:'normal',_battleDivineContext:context};
  const queue = method('_battleShowDivineResolution','kami,index,rect');
  queue.call(vm,kami,2,rect);
  queue.call(vm,kami,2,{...rect,left:122});
  rect.top = 999; // The original DOMRect may cease to describe the destroyed card.
  assert.deepEqual(context.targets,[{left:120,top:260,width:90,height:130}]);
  assert.equal(context.presented,false);
  const events=[];
  vm._battleShowDivineResolution = (k,i,r) => {assert.equal(context.presented,true);events.push(r);};
  vm._battleShowCardFlight = (...args) => events.push(args);
  const transfer={card:{no:11},from:context.targets[0],to:{left:300,top:450}};
  context.transfers.push(transfer);
  method('_battleFinishDivinePresentation').call(vm);
  assert.deepEqual(events,[], 'targets and transfer are already included in the single cinematic');
  events.length=0;vm.battleAnimationSpeed='minimal';
  method('_battleFinishDivinePresentation').call(vm);
  assert.equal(events.length,0);
});

test("skill 2 completes a prominent portrait before starting its independent animation", async () => {
  const durations=[];
  const vm={_battleEmoteLineFor:()=>'',playKamiVoice(){},_sfxPlay(){},_battleMotionMs(ms){durations.push(ms);return 60000;}};
  const using=method('_battleShowSkill2Closeup','kami,skillName,divineSkillTheme,remoteTransfers=null,writerSide="self",remoteTargets=null',true).call(vm,{no:1,name:'スサノオ'},'神技2',require('../divine_effects.js').divineSkillTheme);
  assert.equal(vm.battleSkillCloseup.phase,'portrait');
  assert.equal(vm.battleSkillCloseup.imgUrl,'kami_cutin/1.webp','the initial Kami cut-in remains the original portrait');
  clearTimeout(vm._battleSkillCloseupT);vm._battleSkillCloseupResolve();await Promise.resolve();
  assert.equal(vm.battleSkillCloseup.phase,'animation');
  assert.deepEqual(durations,[1800,2400]);
  clearTimeout(vm._battleSkillCloseupT);vm._battleSkillCloseupResolve();await using;
  assert.equal(vm.battleSkillCloseup,null);
  assert.match(html,/divine-skill-art v-if="battleSkillCloseup.effect && battleSkillCloseup.phase === 'animation'/);
});

test("leaving during a cut-in does not restart the following animation", async () => {
  const durations=[];
  const vm={_battleEmoteLineFor:()=>'',playKamiVoice(){},_sfxPlay(){},_battleMotionMs(ms){durations.push(ms);return 60000;}};
  const using=method('_battleShowSkill2Closeup','kami,skillName,divineSkillTheme,remoteTransfers=null,writerSide="self",remoteTargets=null',true).call(vm,{no:2},'神技2',require('../divine_effects.js').divineSkillTheme);
  clearTimeout(vm._battleSkillCloseupT);const resolve=vm._battleSkillCloseupResolve;vm.battleSkillCloseup=null;vm._battleSkillCloseupResolve=null;resolve();await using;
  assert.deepEqual(durations,[1800]);
  assert.equal(vm.battleSkillCloseup,null);
});

test("Orochi roars after its seals release, and dismissing cancels a pending roar", async () => {
  for (const speed of [1,.55]) for (const dismiss of [false,true]) {
    const timers=[],sounds=[];
    const timer=(callback,delay)=>{const t={callback,delay,cancelled:false};timers.push(t);return t};
    const cancel=t=>{t.cancelled=true};
    const vm={_battleEmoteLineFor:()=>'',playKamiVoice(){},_sfxPlay:s=>sounds.push(s),_battleMotionMs:ms=>ms*speed};
    const using=method('_battleShowSkill2Closeup','kami,skillName,divineSkillTheme,remoteTransfers,writerSide,remoteTargets,setTimeout,clearTimeout',true).call(vm,{no:10},'神技2',require('../divine_effects.js').divineSkillTheme,null,'self',null,timer,cancel);
    assert.deepEqual(sounds,['skill2']);
    assert.equal(timers[0].delay,1800*speed);
    timers[0].callback();await Promise.resolve();
    assert.equal(vm.battleSkillCloseup.phase,'animation');
    assert.equal(timers[1].delay,4200*speed*.4);
    assert.ok(timers[1].delay>1589*speed,'the roar follows the last seal at normal and fast speed');
    assert.equal(timers[2].delay,4200*speed);
    if (!dismiss) timers[1].callback();
    else vm.battleSkillCloseup=null;
    timers[2].callback();await using;
    assert.equal(timers[1].cancelled,true);
    if (dismiss) timers[1].callback(); // A callback already queued still cannot play after leaving.
    assert.deepEqual(sounds,dismiss?['skill2']:['skill2','dragonHeavy']);
    assert.equal(vm.battleSkillCloseup,null);
  }
});

test("all ten Kami present both skills without field replays", () => {
  for (const no of [1,2,3,4,5,6,7,8,9,10]) for (const index of [1,2]) {
    let repeats=0;
    const vm={_battleDivineContext:{kami:{no},index,targets:[{left:100}],transfers:[{card:{no:11}}]},
      _battleShowDivineResolution(){repeats++},_battleShowCardFlight(){repeats++}};
    method('_battleFinishDivinePresentation').call(vm);
    assert.equal(repeats,0);
  }
});

test("the stolen legacy stays hidden only during its scroll-bound transfer", () => {
  const card={no:11},other={no:12};
  const vm={battleSkillCloseup:{phase:'portrait',transfers:[{card}]}};
  const hidden=method('battleDivineTransferHidden','card');
  assert.equal(hidden.call(vm,card),false);
  vm.battleSkillCloseup.phase='animation';
  assert.equal(hidden.call(vm,card),true);
  assert.equal(hidden.call(vm,other),false);
  vm.battleSkillCloseup=null;
  assert.equal(hidden.call(vm,card),false);
  const style=require('../divine_effects.js').divineTransferStyle({from:{left:100,top:200,width:90,height:130},to:{left:300,top:450,width:90,height:130}},2400);
  assert.equal(style['--transfer-x'],'200px');
  assert.equal(style['--transfer-y'],'250px');
});

test("Susanoo's original cut-in falls back through existing portraits without affecting skill 1", () => {
  const fallback=method('battleSkillCloseupImgError');
  const vm={battleSkillCloseup:{kami:{no:1},mode:'skill2',fallbackStage:0,imgUrl:'kami_cutin/1.webp'},kamiIllustrationUrl:()=> 'original.png'};
  fallback.call(vm);
  assert.equal(vm.battleSkillCloseup.imgUrl,'kami_cutin/1.png');
  fallback.call(vm);assert.equal(vm.battleSkillCloseup.imgUrl,'original.png');
  vm.battleSkillCloseup={kami:{no:1},mode:'skill1',fallbackStage:0};
  fallback.call(vm);assert.equal(vm.battleSkillCloseup.imgUrl,'kami_cutin/1.webp');
});

test("skill 1 preserves the eye cut-in and adds only the background sigil for every Kami", async () => {
  for (let no=1; no<=10; no++) {
    const vm={_battleEmoteLineFor:()=>'',playKamiVoice(){},_battleMotionMs:()=>60000};
    const using=method('_battleShowSkill1Closeup','kami,skillName,divineSkillTheme',true).call(vm,{no},'神技1',require('../divine_effects.js').divineSkillTheme);
    assert.equal(vm.battleSkillCloseup.mode,'skill1');
    assert.equal(vm.battleSkillCloseup.effect,undefined);
    assert.equal(vm.battleSkillCloseup.sigil.index,1);
    assert.equal(vm.battleSkillCloseup.imgUrl,`kami_cutin_eyes/${no}.png`);
    clearTimeout(vm._battleSkillCloseupT);vm._battleSkillCloseupResolve();await using;
  }
});

test("remote skills also finish after one presentation, without a field replay", async () => {
  for (let no=1;no<=10;no++) for (const index of [1,2]) {
    const events=[];
    const vm={battleNet:{on:true,mySeat:1},allKamiCards:[{no}],
      _battleShowSkill1Closeup:async()=>events.push('cutin1'),
      _battleShowSkill2Closeup:async()=>events.push('cutin2'),
      _battleShowDivineResolution:()=>events.push('replay')};
    method('_battleApplyRemoteSkill2','payload').call(vm,{writer:2,kamiNo:no,index,ts:100});
    await Promise.resolve();
    assert.deepEqual(events,['cutin'+index]);
    method('_battleApplyRemoteSkill2','payload').call(vm,{writer:2,kamiNo:no,index,ts:100});
    assert.equal(events.length,1,'the same network event cannot present twice');
  }
});

test("flame damage targets are captured for the same animation after the portrait", async () => {
  const targets=[{left:100,top:220,width:90,height:130,image:'card.png'},{left:550,top:50,width:120,height:120}];
  const vm={_battleDivineContext:{targets},_battleEmoteLineFor:()=>'',playKamiVoice(){},_sfxPlay(){},_battleMotionMs:()=>60000};
  const using=method('_battleShowSkill2Closeup','kami,skillName,divineSkillTheme,remoteTransfers=null,writerSide="self",remoteTargets=null',true).call(vm,{no:7},'神技2',require('../divine_effects.js').divineSkillTheme);
  assert.deepEqual(vm.battleSkillCloseup.targets,targets);
  assert.notEqual(vm.battleSkillCloseup.targets[0],targets[0]);
  assert.equal(vm.battleSkillCloseup.phase,'portrait');
  assert.equal(vm.battleSkillCloseup.imgUrl,'kami_cutin/7.webp');
  clearTimeout(vm._battleSkillCloseupT);vm._battleSkillCloseupResolve();await Promise.resolve();
  assert.equal(vm.battleSkillCloseup.phase,'animation');
  clearTimeout(vm._battleSkillCloseupT);vm._battleSkillCloseupResolve();await using;
});

test("spirit swords rise offscreen from the Kami and return vertically to the opposing field", () => {
  const {divineBladeVolley}=require('../divine_effects.js');
  for (const opposite of [false,true]) {
    const layout={origin:{x:550,y:opposite?100:650},enemy:{left:40,top:opposite?400:150,width:980,height:180}};
    const volley=divineBladeVolley(layout),positions=new Set();
    assert.equal(volley.length,24);
    for(const blade of volley){
      assert.equal(parseFloat(blade.left),layout.origin.x);
      assert.equal(parseFloat(blade.top),layout.origin.y);
      const x=parseFloat(blade['--impact-x']),y=parseFloat(blade['--impact-y']);
      assert.ok(x>=layout.enemy.left && x<=layout.enemy.left+layout.enemy.width);
      assert.ok(y>=layout.enemy.top && y<=layout.enemy.top+layout.enemy.height);
      assert.ok(layout.origin.y+parseFloat(blade['--sky-y'])<-250,'the release actually leaves the top of the screen');
      assert.ok(y-parseFloat(blade['--rain-distance'])<0,'the return begins above the screen');
      positions.add(`${x},${y}`);
    }
    assert.equal(positions.size,24,'every sword has a separate landing position');
  }
});

test("sword rain reaches both fields at distinct times and leaves survivor flight corridors clear", () => {
  const {divineBladeVolley}=require('../divine_effects.js');
  for (const width of [320,980]) for (const flipped of [false,true]) {
    const upper={left:10,top:130,width,height:180},lower={left:10,top:400,width,height:180};
    const layout={origin:{x:width/2,y:flipped?70:650},enemy:flipped?lower:upper,friendly:flipped?upper:lower};
    const survivors=[upper,lower].map(r=>({left:r.left+width*.5-35,top:r.top+20,width:70,height:100}));
    const blades=divineBladeVolley(layout,survivors);
    assert.equal(blades.length,36);
    assert.equal(new Set(blades.map(b=>b['--launch-start'])).size,36);
    assert.equal(new Set(blades.map(b=>b['--rain-start'])).size,36);
    assert.notDeepEqual(blades.map(b=>b['--launch-start']),blades.map(b=>b['--rain-start']-.56));
    assert.ok(Math.max(...blades.map(b=>b['--launch-start']+.3))<Math.min(...blades.map(b=>b['--rain-start'])));
    assert.ok(Math.max(...blades.map(b=>b['--rain-start']+.2))<=1);
    for (const field of [upper,lower]) {
      assert.ok(blades.some(b=>parseFloat(b['--impact-y'])>=field.top && parseFloat(b['--impact-y'])<=field.top+field.height));
    }
    for (const b of blades) for (const r of survivors) {
      const x=parseFloat(b['--impact-x']),padding=Math.max(48,Math.min(72,width*.065));
      assert.ok(x<r.left-padding || x>r.left+r.width+padding,'the entire vertical flight path clears both survivors');
    }
  }
  const layout={origin:{x:100,y:600},enemy:{left:0,top:100,width:200,height:100}};
  assert.deepEqual(divineBladeVolley(layout,[{left:0,top:100,width:200,height:100}]),[],'never force a sword onto a survivor when no corridor remains');
});

test("Yamato Takeru records the chosen survivors after removal shifts field indexes", async () => {
  const kami={no:2},a={no:31},b={no:32},c={no:33},d={no:34};
  const vm={battleSample:{self:{legacies:[a,b]},opp:{legacies:[c,d]}},_battleDivineContext:{kami,index:2},
    dslAskCustomTargets:async()=>[b],_battleAskCustomTargetsRemote:async()=>[c],battleSaveUndo(){},
    _battlePublishSkill2(){},async _battleShowSkill2Closeup(){},_battleFinishDivinePresentation:method('_battleFinishDivinePresentation'),
    _dslMoveFromField(card,zone,side){this.battleSample[side].legacies=this.battleSample[side].legacies.filter(x=>x!==card);return true},
    _dslCardEffPower:()=>1000,dslRefreshStaticAbilities(){},fullName:x=>String(x.no),battleShowNotice(){},battleRunDeathKeywordEffects(){}};
  await method('_dslOpDestroyExceptOnePerSide','sourceCard',true).call(vm,kami);
  assert.deepEqual(vm.battleSample.self.legacies,[b]);assert.deepEqual(vm.battleSample.opp.legacies,[c]);
  assert.deepEqual(vm._battleDivineContext.survivors,[b,c]);
  assert.deepEqual(method('_battleDivineSurvivorCues').call(vm),[
    {side:'self',zone:'legacies',index:0,cardNo:'32'}, {side:'opp',zone:'legacies',index:0,cardNo:'33'}
  ]);
});

test("Yamato skill 2 preserves all legacies through the portrait and sword rain, then destroys once", async () => {
  for (const speed of ['normal','fast','minimal']) {
    const kami={no:2,name:'ヤマトタケル'},a={no:31},b={no:32},c={no:33},d={no:34};
    const events=[];let finishSelection,finishDeath;
    const selection=new Promise(r=>{finishSelection=r}),death=new Promise(r=>{finishDeath=r});
    const vm={battleAnimationSpeed:speed,
      battleSample:{self:{kami,tenryoku:12,legacies:[a,b]},opp:{legacies:[c,d]}},
      battleContext:{selfName:'あなた'},battleSkillOptions:[{index:2,enabled:true,cost:8,name:'孤影刃・天翔'}],
      effectSpecsReady:true,_tutorialAllows:()=>true,battleSaveUndo(){},battleShowNotice(){},
      _dslGetSpec:()=>({能力:[{契機:'神技'},{契機:'神技',処理:[]}]}),
      dslAskCustomTargets:async()=>[b],async _battleAskCustomTargetsRemote(){await selection;return [c]},
      async dslRunActions(){await method('_dslOpDestroyExceptOnePerSide','sourceCard',true).call(this,kami)},
      _battlePublishSkill2(){events.push('publish');assert.deepEqual(this._battleDivineSurvivorCues(),[
        {side:'self',zone:'legacies',index:1,cardNo:'32'},{side:'opp',zone:'legacies',index:0,cardNo:'33'}
      ],'remote protection positions are sent before removal changes the field');},
      _battleDivineSurvivorCues:method('_battleDivineSurvivorCues'),
      _battleRemoteDivineTargets:()=>[],_battleDivineStageLayout:()=>null,
      _battleEmoteLineFor:()=>'',playKamiVoice(){},_sfxPlay(){},
      _battleMotionMs:method('_battleMotionMs','ms'),
      _battleFinishDivinePresentation:method('_battleFinishDivinePresentation'),
      _dslMoveFromField(card,zone,side){events.push('destroy:'+card.no);this.battleSample[side].legacies=this.battleSample[side].legacies.filter(x=>x!==card);return true},
      _dslCardEffPower:()=>1000,dslRefreshStaticAbilities(){},fullName:x=>String(x.no),
      async battleRunDeathKeywordEffects(card){events.push('death:'+card.no);if(card===a)await death;},
    };
    vm._battleShowSkill2Closeup=function(k,name){events.push('cutin');return method('_battleShowSkill2Closeup','kami,skillName,divineSkillTheme,remoteTransfers=null,writerSide="self",remoteTargets=null',true).call(this,k,name,require('../divine_effects.js').divineSkillTheme)};
    const using=method('battleUseKamiSkill','index',true).call(vm,2);
    await new Promise(r=>setImmediate(r));assert.deepEqual(events,[],'nothing plays before both survivors are chosen');
    finishSelection();await new Promise(r=>setImmediate(r));
    assert.equal(vm.battleSkillCloseup.phase,'portrait');
    assert.deepEqual(vm.battleSample.self.legacies,[a,b]);assert.deepEqual(vm.battleSample.opp.legacies,[c,d]);
    clearTimeout(vm._battleSkillCloseupT);vm._battleSkillCloseupResolve();await Promise.resolve();
    assert.equal(vm.battleSkillCloseup.phase,'animation');
    assert.deepEqual(vm.battleSample.self.legacies,[a,b]);assert.deepEqual(vm.battleSample.opp.legacies,[c,d]);
    assert.deepEqual(events,['publish','cutin'],'the sword rain begins before any destruction');
    clearTimeout(vm._battleSkillCloseupT);vm._battleSkillCloseupResolve();await new Promise(r=>setImmediate(r));
    assert.deepEqual(vm.battleSample.self.legacies,[b]);assert.deepEqual(vm.battleSample.opp.legacies,[c]);
    assert.equal(vm._battleDivineContext.presented,true);
    assert.deepEqual(events,['publish','cutin','destroy:31','destroy:34','death:31']);
    finishDeath();await using;
    assert.deepEqual(events,['publish','cutin','destroy:31','destroy:34','death:31','death:34'],'no second cinematic, and death effects finish before the skill finishes');
    assert.equal(vm._battleDivineContext,null);
  }
});

test("remote Yamato survivor cues map to safe areas rather than damage effects", async () => {
  const a={no:31},b={no:32},cues=[{side:'self',zone:'legacies',index:0,cardNo:'31'},{side:'opp',zone:'legacies',index:0,cardNo:'32'}];
  const vm={battleSample:{self:{legacies:[b]},opp:{legacies:[a]}},
    _battleDivineSurvivorCues:()=>[],_battleRemoteDivineTargets:method('_battleRemoteDivineTargets','cues,writerSide'),
    _battleFieldCardRect:side=>({left:300,top:side==='self'?400:150,width:70,height:100}),
    _battleDivineStageLayout:()=>({origin:{x:300,y:60}}),_battleEmoteLineFor:()=>'',playKamiVoice(){},_sfxPlay(){},_battleMotionMs:()=>60000};
  const using=method('_battleShowSkill2Closeup','kami,skillName,divineSkillTheme,remoteTransfers=null,writerSide="self",remoteTargets=null',true)
    .call(vm,{no:2},'孤影刃・天翔',require('../divine_effects.js').divineSkillTheme,null,'opp',cues);
  clearTimeout(vm._battleSkillCloseupT);vm._battleSkillCloseupResolve();await Promise.resolve();
  assert.deepEqual(vm.battleSkillCloseup.survivors,[{left:300,top:150,width:70,height:100},{left:300,top:400,width:70,height:100}]);
  assert.deepEqual(vm.battleSkillCloseup.targets,[],'survivors do not receive a target damage effect');
  clearTimeout(vm._battleSkillCloseupT);vm._battleSkillCloseupResolve();await using;
});

test("cinematic layout uses the actual Kami and the opposing public field with CPU mapping", () => {
  const selections=[];
  const portrait={left:450,top:600,width:100,height:100},field={left:10,top:200,width:1000,height:180};
  const vm={battleViewSide:side=>side==='self'?'opp':'self',$el:{querySelector(sel){selections.push(sel);return {getBoundingClientRect:()=>sel.includes('kami-portrait')?portrait:field}}}};
  const layout=method('_battleDivineStageLayout','writerSide').call(vm,'self');
  assert.match(selections[0],/battle-row-opp-top/);
  assert.equal(selections[1],'.self-legacy-drop');
  assert.deepEqual(layout.origin,{x:500,y:650});
  assert.deepEqual(layout.enemy,field);
  assert.deepEqual(layout.friendly,field);
  assert.equal(selections[2],'.battle-row-legacy .legacy-field:not(.self-legacy-drop)');
});

test("Okuninushi's colored orbs manifest successively before the final white rabbit", () => {
  const beasts=require('../divine_effects.js').divineBeastManifestations();
  assert.deepEqual(beasts.map(b=>b.name),['wolf','stag','boar','fox']);
  assert.equal(new Set(beasts.map(b=>b.color)).size,4);
  for(let i=0;i<beasts.length;i++) {
    if(i) assert.ok(beasts[i].style['--summon-start']>beasts[i-1].style['--summon-start']);
    const formed=beasts[i].style['--summon-start']+beasts[i].style['--summon-span']*.54;
    assert.ok(formed<.61,'every beast has formed before the final white orb begins gathering');
  }
});

test("mystical scroll covers stay within the two field rectangles in either orientation", () => {
  const {divineFieldScrolls}=require('../divine_effects.js');
  const a={left:8,top:170,width:1420,height:190},b={left:8,top:370,width:1420,height:195};
  for (const layout of [{enemy:a,friendly:b},{enemy:b,friendly:a}]) {
    const covers=divineFieldScrolls(layout);
    assert.equal(covers.length,2);
    for (const [i,rect] of [layout.enemy,layout.friendly].entries()) {
      for(const key of ['left','top','width','height']) assert.equal(parseFloat(covers[i][key]),rect[key]);
    }
  }
});

test("the seven-branched sword settles above the selected legacy after lightning", () => {
  const {divineThunderSwordStyle}=require('../divine_effects.js');
  for(const rect of [{left:20,top:440,width:90,height:130},{left:900,top:170,width:140,height:190}]) {
    const style=divineThunderSwordStyle(rect);
    assert.equal(parseFloat(style.left),rect.left+rect.width/2);
    assert.ok(parseFloat(style.top)<rect.top,'blade center is above the target');
    assert.ok(parseFloat(style.top)+parseFloat(style.height)/2>rect.top,'blade connects visually to the target');
    assert.equal(style['--sword-start-x'],`calc(50vw - ${rect.left+rect.width/2}px)`);
  }
  assert.equal(divineThunderSwordStyle(null),null);
});

test("remote sword landing accepts only matching public field cards and maps the caster's side", () => {
  const card={no:11},privateCard={no:99},calls=[];
  const vm={battleSample:{self:{legacies:[],relics:[],hand:[privateCard]},opp:{legacies:[card],relics:[]}},
    _battleFieldCardRect:(side,zone,index)=>{calls.push({side,zone,index});return {left:700,top:180,width:90,height:130}}};
  const cues=[{side:'self',zone:'legacies',index:0,cardNo:'11'},{side:'self',zone:'hand',index:0,cardNo:'99'},{side:'opp',zone:'legacies',index:0,cardNo:'99'},{side:'self',zone:'legacies',index:-1,cardNo:'11'},null];
  const targets=method('_battleRemoteDivineTargets','cues,writerSide').call(vm,cues,'opp');
  assert.equal(targets.length,1);
  assert.deepEqual(calls,[{side:'opp',zone:'legacies',index:0}]);
});

test("control theft records one public card moving from the enemy to the friendly field", async () => {
  const card={no:11},context={kami:{no:5},index:2,targets:[],transfers:[]};
  const vm={_battleDivineContext:context,battleSample:{self:{legacies:[]},opp:{legacies:[card]}},
    dslChooseTargets:async()=>[card],battleSaveUndo(){},dslClearStaticFromCard(){},dslRefreshStaticAbilities(){},
    $set:(c,k,v)=>{c[k]=v},$nextTick:fn=>fn(),fullName:c=>String(c.no),battleShowNotice(){},_battleIlluminateSkillTargets(){},
    _battleFieldCardRect:(side,zone,index)=>({left:100,top:side==='opp'?100:400,width:90,height:130}),
    _battleShowDivineResolution:(k,i,r)=>context.targets.push(r)};
  await method('_dslOpPuppet','act,sourceCard',true).call(vm,{},{});
  assert.deepEqual(vm.battleSample.opp.legacies,[]);
  assert.deepEqual(vm.battleSample.self.legacies,[card]);
  assert.equal(context.transfers.length,1);
  assert.equal(context.transfers[0].from.top,100);
  assert.equal(context.transfers[0].to.top,400);
  assert.equal(context.targets.length,1,'only the enemy source receives a wrap cue');
});

test("remote scroll transfer uses only the named public field card", () => {
  const card={no:11},hidden={no:99};
  const vm={battleSample:{self:{legacies:[],hand:[hidden]},opp:{legacies:[card]}},
    _battleFieldCardRect:(side)=>({left:100,top:side==='self'?400:100,width:90,height:130}),cardImageUrl:c=>'card-'+c.no};
  const restored=method('_battleRemoteDivineTransfers','cues,writerSide').call(vm,[{cardNo:'11',fromIndex:0,toIndex:0},{cardNo:'99',fromIndex:0,toIndex:0}],'opp');
  assert.equal(restored.length,1);
  assert.equal(restored[0].card,card);
  assert.equal(restored[0].from.top,400);
  assert.equal(restored[0].to.top,100);
});

test("target illumination keeps private cards private and delegates CPU layout mapping", () => {
  const card={no:21}, hidden={no:99}, calls=[], tick=[];
  const vm={_dslSwapped:true,_battleDivineContext:{kami:{no:8},index:2},
    battleSample:{self:{legacies:[card],relics:[],hand:[hidden]},opp:{legacies:[],relics:[]}},
    $nextTick:fn=>tick.push(fn),_battleFieldCardRect:(...args)=>{calls.push(args);return {left:1};},
    _battleShowDivineResolution:(...args)=>calls.push(args)};
  method('_battleIlluminateSkillTargets','cards').call(vm,[card,hidden]);tick.shift()();
  assert.deepEqual(calls[0],['self','legacies',0],'the rectangle helper applies its own view-side mapping');
  assert.equal(calls.length,2,'hand cards never receive a public field effect');
  method('_battleIlluminateSkillTargets','cards').call(vm,[card]);vm._battleDivineContext=null;tick.shift()();
  assert.equal(calls.length,2,'a stale callback cannot start a new effect');
});

test("evolution lesson can select sublimation with four mana and two shrine tokens", async () => {
  const card = { no: "20", name: "夜風の始末屋" };
  const shrines = [{ no: "186" }, { no: "186" }];
  const state = { mana: 4, relics: shrines.slice(), hand: [card] };
  const notices = [], paid = [];
  const vm = {
    battleSample: { self: state }, fullName: c => c.name || "社の施し",
    battleSaveUndo() {}, battleShowNotice: (...args) => notices.push(args),
    battleAskConfirm(modal) { this.confirm = modal; },
    _dslMoveFromField(c) { state.relics.splice(state.relics.indexOf(c), 1); return true; },
    async battleRunDeathKeywordEffects(c) {
      assert.equal(c.no, "186");
      for (const action of specs["186"].能力.find(a => a.契機 === "死亡時").処理) {
        assert.equal(action.操作, "マナ回復"); state.mana += action.数;
      }
    },
    async _battlePlayLegacyOrRelic(index, zone, cost) { assert.ok(state.mana >= cost); state.mana -= cost; paid.push({ index, zone, cost }); },
  };
  const canPay = method("battleCanPayWithShrines", "cost");
  assert.equal(canPay.call(vm, 6), true);
  assert.equal(canPay.call(vm, 7), false);
  assert.match(html, /:disabled="!battleCanPayWithShrines\(c\)"/);
  method("battleOfferShrineManaForCost", "card,cost,play").call(vm, card, 6, { index: 0, zone: "legacies" });
  assert.equal(vm.confirm.payload.shrineCount, 2);
  await method("battleUseShrineManaForCost", "payload", true).call(vm, vm.confirm.payload);
  assert.equal(state.relics.length, 0);
  assert.equal(state.mana, 0);
  assert.deepEqual(paid, [{ index: 0, zone: "legacies", cost: 6 }]);
});

test("card types lesson obtains its oracle through induce and leaves relic activation to its own lesson", () => {
  assert.deepEqual(lessons.slice(0, 2).map(l => [l.id, l.numeral]), [["cards", "壱"], ["preparation", "弐"]]);
  const lesson = lessons[0];
  assert.ok(lesson.setup.self.hand.includes("幼き守護者・ミナト"));
  assert.ok(!lesson.setup.self.hand.includes("救済の手"));
  assert.ok(lesson.setup.self.deck.slice(1, 4).includes("救済の手"));
  const induce = lesson.steps.find(s => s.induce);
  assert.deepEqual(induce.induce, ["救済の手"]);
  assert.ok(!lesson.steps.some(s => s.allow && (s.allow.activate || s.allow.battle || s.allow.skill)));
  assert.equal(lesson.setup.self.manaMax + 1 - 1, 2, "one-cost Minato leaves exactly the oracle cost");
  assert.ok(lessons.find(l=>l.id==='relics').steps.some(s=>s.allow?.activate?.includes("木漏れ日の道場")));
  assert.equal(specs["76"].能力[0].処理[0].操作, "誘");
  const text = lesson.steps.map(s => s.say || "").join("\n");
  for (const lore of ["星の記憶から生み出された生命の残照", "星の記憶に残る情景や出来事", "象徴的なモノや場所"]) assert.ok(text.includes(lore));
});

test("keyword lesson needs guard first and then removes the attacker to survive", () => {
  const lesson = lessons.find(l=>l.id==='keywords');
  assert.equal(lesson.setup.self.life, 1);
  assert.equal(lesson.setup.opp.life, 2);
  const guard=lesson.steps.find(s=>s.action==='oppTurn');
  assert.deepEqual(guard.answers.map(a=>[a.trigger,a.answer]),[['守護',true]]);
  assert.ok(lesson.setup.self.legacies.includes('鐘鳴らしの童'));
  const combat=lesson.steps.findIndex(s=>s.allow?.battle);
  const next=lesson.steps.find((s,i)=>i>combat&&s.action==='oppTurn');
  assert.deepEqual(next.script,[{divine:'飄々たる諜報員'}]);
  assert.equal(lesson.setup.self.life-1,0,'without removal the following attack is lethal');
  assert.equal(lesson.setup.opp.life-1,1,'our first attack cannot win before that turn');
});

test("required tutorial induce cannot be skipped, while normal induce can", () => {
  const choose = method("_tutorialChoiceAllowed", "kind,name");
  const vm = { tutorial: {}, tutorialStep: { induce: ["救済の手"] }, _tutorialNudge() {} };
  assert.equal(choose.call(vm, "induce", ""), false);
  assert.equal(choose.call(vm, "induce", "救済の手"), true);
  vm.tutorialStep = {};
  assert.equal(choose.call(vm, "induce", ""), true);
  assert.match(html, /_tutorialChoiceAllowed\('induce', selectedCard/);
});

test("tutorial field highlights yield to dialogs and return on field peek or close", () => {
  const visible = method("tutorialFieldHighlightsVisible");
  const vm = { appView: "battle", _battleHasBlockingModal: method("_battleHasBlockingModal") };
  assert.equal(visible.call(vm), true);
  for (const modal of ["battleSkillModal", "dslTargetModal", "battleDeckModal", "battleConfirmModal"]) {
    vm[modal] = {};
    assert.equal(visible.call(vm), false, modal);
    vm.battleModalPeek = true;
    assert.equal(visible.call(vm), true, "field peek restores the guide");
    vm.battleModalPeek = false;
    assert.equal(visible.call(vm), false, "returning to selection hides it again");
    vm[modal] = null;
    assert.equal(visible.call(vm), true, "closing the dialog restores the guide");
  }
  vm.previewCard = {};
  assert.equal(visible.call(vm), false);
  vm.previewCard = null;
  vm.battleSkillCloseup = {};
  assert.equal(visible.call(vm), false);
  vm.battleSkillCloseup = null;
  vm.appView = "tutorialPick";
  assert.equal(visible.call(vm), true);
  assert.match(html, /<template v-if="tutorialFieldHighlightsVisible">\s*<div v-for="\(r, i\) in tutorial.rects"[\s\S]*?tutorial.marks[\s\S]*?<\/template>/);
});

test("reroll lesson rerolls a red card into the haste legacy that delivers the final attack", async () => {
  const lesson = lessons.find(l => l.id === "reroll");
  const rerollStep = lesson.steps.find(s => s.reroll);
  const returned = { name: "熾烈なる戦役", color: "赤" };
  const key = { name: "音速の忍", color: "赤" };
  const otherColor = { name: "救済の手", color: "黄" };
  const player = { hand: [returned, otherColor], deck: lesson.setup.self.deck.map(name => name === key.name ? key : { name, color: "赤" }) };
  // One turn-start draw precedes the reroll in the independent lesson.
  assert.deepEqual(player.deck.splice(0, 1).map(c => c.name), lesson.setup.self.deck.slice(0, 1));
  assert.equal(player.deck[0], key);
  let offered;
  const vm = {
    tutorial: {}, tutorialStep: rerollStep, battleSample: { self: player, opp: { life: 2 } },
    _dslColorsMatchForReroll: method("_dslColorsMatchForReroll", "colorA,colorB"),
    async dslAskOptional(card, trigger, text, kind, options) { offered = options.cards; return true; },
    async dslAskCustomTargets(title, candidates) { assert.deepEqual(candidates, [returned]); return [returned]; },
    battleSaveUndo() {}, _battleShuffle: cards => cards, fullName: c => c.name, battleShowNotice() {},
    _tutorialHas: method("_tutorialHas", "side,zone,name"), _tutorialIdle: () => true,
  };
  await method("battleOfferReroll", "playedCard", true).call(vm, { name: "瞬速の死闘", color: "赤" });
  assert.deepEqual(offered, [returned], "only the matching color is eligible");
  assert.ok(player.hand.includes(key));
  assert.ok(!player.hand.includes(returned));
  assert.ok(player.deck.includes(returned));
  assert.equal(rerollStep.done(vm), true);
  assert.equal(lesson.setup.self.manaMax + 1 - 3, 2, "three mana for the oracle leaves two for the key legacy");
  assert.equal(lesson.setup.opp.life - 1 - 1, 1, "the oracle and existing legacy still leave one life");
  const finalAttack = lesson.steps.filter(s => s.allow && s.allow.divine).at(-1);
  assert.deepEqual(finalAttack.allow.divine, [key.name]);
  assert.equal(finalAttack.free, undefined, "the finale cannot use an unrelated attacker");
  assert.equal(specs["11"].能力[0].契機, "常在");
  assert.match(JSON.stringify(specs["11"]), /疾駆/);
});


test("six basic lessons and four advanced lessons keep focused exercises", () => {
  assert.equal(lessons.length,10);
  assert.equal(new Set(lessons.map(l=>l.id)).size,10);
  assert.deepEqual(lessons.map(l=>l.category),[...Array(6).fill('basic'),...Array(4).fill('advanced')]);
  assert.ok(lessons.every(l=>l.steps.length<=23),'no lesson retains the former 40-plus-step sequence');
  for(const l of lessons){assert.ok(l.steps.at(-1).last,l.id);assert.ok(l.steps.every(s=>!s.task||typeof s.done==='function'),l.id);}
  const opening=lessons.find(l=>l.id==='preparation');
  assert.equal(opening.setup.self.hand.length,4);
  assert.ok(opening.steps.some(s=>s.action==='mulligan'));
  assert.ok(!opening.steps.some(s=>s.allow?.battle||s.allow?.divine||s.allow?.skill));
  const attack=lessons.find(l=>l.id==='attack');
  assert.deepEqual(attack.setup.opp.legacies,[{name:'鐘鳴らしの童',tapped:true}]);
  assert.ok(attack.steps.some(s=>s.allow?.battle),'the 2000-power legacy can defeat the tapped 1000-power legacy');
  const power=lessons.find(l=>l.id==='guard');
  assert.ok(!power.steps.some(s=>s.action==='startTurn'),'keep the already tapped practice target tapped');
  assert.equal(power.setup.self.tenryoku,1);
  assert.ok(power.steps.some(s=>s.allow?.skillUse?.includes('1')));
  assert.ok(!power.steps.some(s=>s.reroll||s.sentei));
  const second=lessons.find(l=>l.id==='skill2');
  assert.equal(second.category,'basic');
  assert.deepEqual(lessons.slice(3,6).map(l=>l.id),['guard','skill2','endgame']);
  assert.match(power.steps.at(-1).say,/創世神技/);
  assert.match(second.steps.at(-1).say,/手札と終盤のルール/);
  assert.ok(!power.steps.some(s=>s.say?.includes('応用編')));
  const evolution=lessons.find(l=>l.id==='advanced');
  assert.ok(evolution.steps.some(s=>s.forceEvolve));assert.ok(evolution.steps.some(s=>s.requireSublim));
  assert.ok(!evolution.steps.some(s=>s.allow?.endTurn),'fatigue and hand cleanup have their own lesson');
  assert.deepEqual(opening.setup.self.relics,['社の施し']);
  assert.equal(opening.setup.self.manaMax,0);
  assert.ok(opening.steps.some(s=>s.action==='oppTurn'),'the already started first-player turn ends once, starting the follower turn');
  assert.ok(!opening.steps.some(s=>s.action==='startTurn'),'do not start the follower turn twice');
  assert.ok(opening.steps.some(s=>s.allow?.play?.includes('飄々たる諜報員')));
  const limits=lessons.find(l=>l.id==='endgame');
  assert.equal(limits.setup.self.hand.length,9);assert.equal(limits.setup.turn,10);
  assert.equal(limits.setup.firstSide,'opp');assert.equal(limits.setup.activeSide,'self');
  assert.equal(limits.setup.opp.life,1);
  assert.ok(limits.setup.opp.deck.length>0,'fatigue demonstration must not be pre-empted by an empty draw');
  assert.ok(limits.steps.some(s=>s.say?.includes('引こうとして引けなければ')),'deck exhaustion remains explained');
  assert.ok(limits.steps.some(s=>s.targets?.includes('救済の手')&&s.allow?.endTurn),'one turn end teaches hand cleanup and fatigue');
  assert.ok(!lessons.some(l=>['basic','mana','hand-limit','deck-out','fatigue'].includes(l.id)));
  assert.equal(lessons.find(l=>l.id==='skill2').fieldTheme,'shinshi');
  assert.match(html,/基本編 · 6つのレッスン/);assert.match(html,/応用編 · 4つのレッスン/);
  assert.match(html,/const TUTORIAL_PRACTICE = Object.freeze/);
  const music=Function('return '+html.match(/const BGM_FILES = (\{[\s\S]*?\r?\n\});/)[1])();
  assert.ok(lessons.every(l=>music[l.bgm]),'each lesson retains an available BGM');
});


test("notice stacks stop above the end-turn button at desktop and short-screen sizes", () => {
 const update=method('_battleUpdateNoticeBounds','window,ResizeObserver');
 for(const geometry of [{header:46,button:400,viewport:720},{header:70,button:210,viewport:400},{header:90,button:85,viewport:320}]){
  const stack={style:{}},button={getBoundingClientRect:()=>({top:geometry.button})},header={getBoundingClientRect:()=>({bottom:geometry.header})};
  const vm={$el:{querySelector:s=>s==='.notice-toast-stack'?stack:s==='.battle-end-turn-btn'?button:header}};
  update.call(vm,{innerHeight:geometry.viewport},undefined);
  const top=parseFloat(stack.style.top),height=parseFloat(stack.style.maxHeight);
  assert.ok(height>=0);
  if(height)assert.ok(top+height<=geometry.button-10,'the final log cannot cover the end-turn button');
 }
 assert.match(html,/max-height: 0; overflow-y: auto; overflow-x: hidden/);
});

test("merged tutorials preserve completion only when all former sections were cleared", () => {
 const body=html.match(/function loadTutorialProgress\(\) \{([\s\S]*?)\r?\n\}/)[1];
 const load=Function('localStorage','TUTORIAL_PROGRESS_STORAGE_KEY',body);
 const saved=p=>load({getItem:()=>JSON.stringify(p)},'progress');
 assert.equal(saved({basic:true}).preparation,undefined);
 assert.equal(saved({basic:true,mana:true}).preparation,true);
 assert.equal(saved({'hand-limit':true,'deck-out':true}).endgame,undefined);
 const complete=saved({'hand-limit':true,'deck-out':true,fatigue:true,cards:true,draft:true});
 assert.equal(complete.endgame,true);assert.equal(complete.cards,true);assert.equal(complete.draft,true);
 assert.equal(saved({preparation:true,endgame:true}).endgame,true);
});

test("required turn and effect draws lose only when an additional card cannot be drawn", () => {
  for(const side of ['self','opp'])for(const swapped of [false,true]) {
    const card={name:'最後の1枚'};
    const vm={battleSample:{self:{deck:[],hand:[],life:10},opp:{deck:[],hand:[],life:10}},_dslSwapped:swapped,
      _battleLoseOnEmptyDraw:method('_battleLoseOnEmptyDraw','side'),_sfxPlay(){},_battleSyncSideCounts(){},_battleMarkJustDrawn(){},battleSaveUndo(){},battleShowNotice(){}};
    const p=vm.battleSample[side];p.deck=[card];
    const draw=method('_battleDrawForTurn','side');
    draw.call(vm,side);assert.equal(vm.battleSample.result,undefined,'drawing the last card is legal');
    assert.equal(p.hand.length,1);draw.call(vm,side);
    assert.equal(vm.battleSample.result.outcome,(side==='self')!==swapped?'loss':'win');
    assert.equal(vm.battleSample.result.reason,'deck-out');assert.equal(p.life,10,'deck-out does not set life to zero');
    assert.match(method('battleResultReasonText').call(vm),/カードを引けず/);
    vm.battleSample.result=null;p.deck=[card];p.hand=[];
    method('_dslOpDraw','act').call(vm,{側:side,数:2});
    assert.equal(vm.battleSample.result.reason,'deck-out','a partially fulfilled draw still loses on the missing card');
  }
  const vm={battleSample:{opp:{deck:[],deckCount:20},self:{deck:[],deckCount:20}},battleNet:{on:true}};
  const lose=method('_battleLoseOnEmptyDraw','side');
  assert.equal(lose.call(vm,'opp'),false,'a hidden opponent deck is not empty');
  vm.battleNet.spectating=true;assert.equal(lose.call(vm,'self'),false,'a spectator does not decide private draws');
  assert.equal(vm.battleSample.result,undefined);
});
