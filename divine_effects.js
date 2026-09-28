/* 神技の見た目だけを定義する。カードの効果・勝敗判定は変更しない。 */
"use strict";
const DIVINE_SKILL_THEMES = Object.freeze({
  '1': { motif: 'storm', color: '#72e6de', accent: '#d5fff8', skills: ['風が記憶を運ぶ', '天叢雲が新たな姿を結ぶ'] },
  '2': { motif: 'blade', color: '#c6e4ff', accent: '#ffffff', skills: ['一閃が道を開く', '孤高の刃が戦場を断つ'] },
  '3': { motif: 'grove', color: '#7ce598', accent: '#ffe4a0', skills: ['獣霊の足音が響く', '大地から眷属が集う'] },
  '4': { motif: 'thunder', color: '#ffd83d', accent: '#fff5a8', skills: ['雷をその身に纏う', '布都御魂が轟く'] },
  '5': { motif: 'script', color: '#bba0ff', accent: '#79f5f2', skills: ['言霊が力をほどく', '八意の糸が運命を繋ぎ替える'] },
  '6': { motif: 'butterfly', color: '#ff9ddd', accent: '#ffe4ba', skills: ['舞に心が引き寄せられる', '胡蝶の舞が時を縛る'] },
  '7': { motif: 'flame', color: '#ff773b', accent: '#fff0a0', skills: ['灰の中に記憶が灯る', '紅蓮の焔が焼き尽くす'] },
  '8': { motif: 'sun', color: '#ffd97b', accent: '#fffbea', skills: ['光が命を護る', '鏡の光が命を呼び戻す'] },
  '9': { motif: 'moon', color: '#86d3ff', accent: '#e5d6ff', skills: ['月影へと還る', '凍てつく月が時を止める'] },
  '10': { motif: 'dragon', color: '#e66379', accent: '#ffbf69', skills: ['龍血が封印から溢れる', '八つの影が天を喰らう'] },
});
const DIVINE_SKILL_CUTINS = Object.freeze({
  "1": "kami_cutin/susanoo-resolve-9f4617c3bdb5.webp",
  "2": "kami_cutin/yamato-takeru-genesis-8973e1681dc1.webp",
  "3": "kami_cutin/okuninushi-genesis-720a374de6f8.webp",
  "4": "kami_cutin/takemikazuchi-genesis-14e2af2e60a2.webp",
  "5": "kami_cutin/omoikane-genesis-edcac629cf30.webp",
  "6": "kami_cutin/amenouzume-genesis-0ac8f9344349.webp",
  "7": "kami_cutin/hinokagutsuchi-genesis-ce4ccac1d073.webp",
  "8": "kami_cutin/amaterasu-genesis-e9f958b952f9.webp",
  "9": "kami_cutin/tsukuyomi-genesis-f7c1bebfd8e1.webp",
  "10": "kami_cutin/yamata-no-orochi-genesis-4759df52c6f3.webp"
});
function divineSkillTheme(kami, index) {
  const theme = DIVINE_SKILL_THEMES[String(kami && kami.no)] || DIVINE_SKILL_THEMES['8'];
  return { kamiNo: String(kami && kami.no), cutin: index === 2 ? DIVINE_SKILL_CUTINS[String(kami && kami.no)] : null, motif: theme.motif, color: index === 2 && String(kami && kami.no) === '1' ? '#dd354b' : theme.color, accent: theme.accent, label: theme.skills[index === 2 ? 1 : 0], index };
}

// Atlas cells are native painted sprites; movements and lighting stay code-driven.
const DIVINE_SPRITES = Object.freeze({
  kusanagi: [0, 0], spiritSword: [1, 0], beasts: [2, 0], rabbit: [3, 0],
  futsunomitama: [0, 1], scroll: [1, 1], silk: [2, 1], brokenChain: [3, 1],
  mirror: [0, 2], magatama: [1, 2], dragons: [2, 2], ofuda: [3, 2],
});
function divineSpriteStyle(name) {
  if (name === 'futsunomitama') return { backgroundImage: "url('divine_assets/futsunomitama-seven-453501cd77c5.webp')", backgroundPosition: 'center', backgroundSize: 'contain' };
  if (name === 'kusanagi' || name === 'spiritSword') return {
    backgroundImage: name === 'kusanagi' ? "url('divine_assets/totsuka-sword-d380260b8deb.webp')" : "url('divine_assets/spirit-sword-08a642135453.webp')",
    backgroundPosition: 'center', backgroundSize: 'contain',
  };
  const cell = DIVINE_SPRITES[name] || [0, 0];
  return { backgroundPosition: `${cell[0] * 100 / 3}% ${cell[1] * 50}%` };
}

// 実際に登場するカミの素材だけ先読みするための一覧。演出の内容・タイミングは変えない。
function divineSkillAssetUrls(kami) {
  const atlas = 'divine_assets/relic-atlas-0fd1e7d6f3dc.webp';
  const assets = {
    '1': ['kami_cutin/susanoo-resolve-9f4617c3bdb5.webp'],
    '2': ['divine_assets/spirit-sword-08a642135453.webp'],
    '3': [atlas, 'divine_assets/beast-light-forms-5bdddec3647d.webp'],
    '4': ['divine_assets/futsunomitama-seven-453501cd77c5.webp'],
    '5': ['divine_assets/mystic-purple-scroll-bd45e7325132.webp'],
    '6': [atlas],
    '7': ['divine_assets/inferno-wave-959a2a61584f.webp', 'divine_assets/flame-slash-frames-f34adc73079d.webp'],
    '8': [atlas],
    '9': ['divine_assets/lunar-relics-ac681e76d45f.webp'],
    '10': ['divine_assets/orochi-awakening-frames-f2d43817643d.webp', 'divine_assets/orochi-seal-paper-8e9e3864d744.webp', 'divine_assets/orochi-torn-seal-29d8da98451b.webp'],
  };
  return [...new Set([...(assets[String(kami && kami.no)] || []), DIVINE_SKILL_CUTINS[String(kami && kami.no)]].filter(Boolean))];
}
function divineTransferStyle(transfer, duration) {
  const from = transfer.from, to = transfer.to;
  const size = Math.max(210, from.height * 1.8);
  return { left: (from.left + from.width/2-size/2)+'px', top: (from.top+from.height/2-size/2)+'px',
    width:size+'px', height:size+'px', '--fx-duration':duration+'ms',
    '--transfer-x':(to.left+to.width/2-from.left-from.width/2)+'px', '--transfer-y':(to.top+to.height/2-from.top-from.height/2)+'px' };
}
// 時間差で上空へ放ち、両陣へ降らせる。残すカードの上空から着地点までを避ける。
function divineBladeVolley(layout, survivors = []) {
  if (!layout) return [];
  const { origin, enemy, friendly } = layout;
  const fields = [enemy, friendly].filter(Boolean), count = friendly ? 36 : 24;
  const blades = [];
  for (let i=0;i<count;i++) {
    const field = fields[i%fields.length];
    const clearance = Math.max(48,Math.min(72,field.width*.065));
    // 垂直の降下経路にも余白を確保する。下段への剣も上段の生存者を横切らない。
    const safeColumns = Array.from({length:97},(_,j)=>field.left+field.width*(.06+.88*j/96))
      .filter(x=>survivors.every(r=>x<r.left-clearance || x>r.left+r.width+clearance));
    if (!safeColumns.length) continue;
    const x = safeColumns[Math.floor(((i*7)%count)/count*safeColumns.length)];
    const y = field.top + field.height * (.2 + ((i*11)%23)/36);
    const skyX=origin.x+enemy.width*((i%8-3.5)*.105),skyY=-260-(i%4)*35;
    const dx=skyX-origin.x, dy=skyY-origin.y;
    blades.push({left:origin.x+'px',top:origin.y+'px','--sky-x':dx+'px','--sky-y':dy+'px',
      '--blade-angle':(Math.atan2(dx,-dy)*180/Math.PI)+'deg','--launch-start':((i*5)%count)/(count-1)*.22,
      '--rain-start':.56+((i*13)%count)/(count-1)*.22,'--impact-start':.68+((i*13)%count)/(count-1)*.22,
      '--impact-x':x+'px','--impact-y':y+'px','--rain-distance':(y+320)+'px','--blade-scale':(.65+(i%4)*.12)});
  }
  return blades;
}
function divineBeastManifestations() {
  return [
    {name:'wolf',color:'#8fcaff',x:17,y:43},
    {name:'stag',color:'#95ffd0',x:40,y:57},
    {name:'boar',color:'#ffd68e',x:62,y:43},
    {name:'fox',color:'#d1a5ff',x:82,y:57},
  ].map((beast,i)=>Object.assign({},beast,{style:{left:beast.x+'%',top:beast.y+'%','--summon-color':beast.color,'--summon-start':i*.11,'--summon-span':.4,'--animal-cell':(i*100/3)+'%'}}));
}
function divineOrochiSeals() {
    // バストアップを二重の菱形で封じる。内側は顔、外側は肩から胸までを囲む。
    return [
      {x:50,y:24,tilt:0,flyX:0,flyY:-350},
      {x:28,y:50,tilt:35,flyX:-370,flyY:0},
      {x:50,y:76,tilt:0,flyX:0,flyY:360},
      {x:72,y:50,tilt:-35,flyX:370,flyY:0},
      {x:50,y:35,tilt:90,flyX:0,flyY:-280},
      {x:40,y:50,tilt:-35,flyX:-260,flyY:30},
      {x:50,y:65,tilt:90,flyX:0,flyY:280},
      {x:60,y:50,tilt:35,flyX:260,flyY:30},
  ].map((seal,i)=>({left:seal.x+'%',top:seal.y+'%','--seal-tilt':seal.tilt+'deg','--seal-fly-x':seal.flyX+'px','--seal-fly-y':seal.flyY+'px','--seal-order':i}));
}
function divineThunderBranches() {
  return Array.from({length:14}, (_,i) => {
    let seed=(i+1)*7919;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
    const angle = i*Math.PI*2/14 + (random()-.5)*.32, points=['M500 530'], vertices=[];
    let radius=0,drift=0;
    const count=34+Math.floor(random()*16);
    for(let j=1;j<=count;j++) {
      radius+=10+random()*17;
      drift=drift*.86+(random()-.5)*19;
      const r=radius, jitter=drift+(random()-.5)*11;
      const x=500+Math.cos(angle)*r-Math.sin(angle)*jitter,y=530+Math.sin(angle)*r+Math.cos(angle)*jitter;
      vertices.push({x,y});points.push('L'+x.toFixed(1)+' '+y.toFixed(1));
    }
    for(const j of [7,15,25]) {
      const a=vertices[j], fork=angle+(random()>.5?1:-1)*(.3+random()*.6);
      points.push(`M${a.x.toFixed(1)} ${a.y.toFixed(1)}`);
      let r=0;
      for(let k=1;k<=12;k++) {r+=6+random()*14;const jitter=(random()-.5)*15;points.push('L'+(a.x+Math.cos(fork)*r-Math.sin(fork)*jitter).toFixed(1)+' '+(a.y+Math.sin(fork)*r+Math.cos(fork)*jitter).toFixed(1))}
    }
    return points.join(' ');
  });
}
function divineFieldScrolls(layout) {
  if (!layout || !layout.enemy || !layout.friendly) return [
    {left:'3%',top:'17%',width:'94%',height:'29%'},
    {left:'3%',top:'51%',width:'94%',height:'29%'},
  ];
  return [layout.enemy,layout.friendly].map(r=>({left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'}));
}
function divineThunderSwordStyle(rect) {
  if (!rect) return null;
  const x=rect.left+rect.width/2,y=rect.top-rect.width*.25,size=Math.min(230,Math.max(110,rect.width*1.6));
  return {left:x+'px',top:y+'px',width:size+'px',height:size*1.45+'px',
    '--sword-start-x':`calc(50vw - ${x}px)`,'--sword-start-y':`calc(45vh - ${y}px)`};
}
if (typeof Vue !== 'undefined') {
  Vue.component('divine-skill1-sigil', {
    props:{theme:Object,duration:{type:Number,default:1800}},
    template:`<div class="skill1-sigil divine-painted" :style="{'--divine-color':theme.color,'--fx-duration':duration+'ms'}" aria-hidden="true"><svg viewBox="0 0 600 600" fill="none"><circle cx="300" cy="300" r="274"/><circle cx="300" cy="300" r="259"/><circle cx="300" cy="300" r="195"/><circle cx="300" cy="300" r="100"/><path d="M300 40 L484 116 L560 300 L484 484 L300 560 L116 484 L40 300 L116 116 Z M300 105 L438 162 L495 300 L438 438 L300 495 L162 438 L105 300 L162 162 Z"/><g v-for="i in 8" :key="i" :transform="'rotate('+i*45+' 300 300)'"><path d="M300 26 L300 72 M287 33 L300 45 L313 33 M300 110 Q375 202 300 292 Q225 202 300 110 Z"/><circle cx="300" cy="67" r="6"/></g><g v-for="i in 32" :key="'tick'+i" :transform="'rotate('+i*11.25+' 300 300)'"><path d="M300 42 L300 53"/></g></svg></div>`,
  });
  // 同じ全体演出の後半で対象だけを照らす。別の演出を再生しない。
  Vue.component('divine-target-impact', {
    props: { rect:Object, effect:Object, duration:{type:Number,default:2400} },
    computed: { impactStyle(){return {left:this.rect.left+'px',top:this.rect.top+'px',width:this.rect.width+'px',height:this.rect.height+'px','--fx-duration':this.duration+'ms','--divine-color':this.effect.color}} },
    template: `<div class="divine-target-impact divine-painted" :class="'impact-'+effect.motif" :style="impactStyle" aria-hidden="true"><div v-if="rect.image" class="impact-card-memory" :style="{backgroundImage:'url('+rect.image+')'}"></div><div class="impact-aura"></div><i v-for="i in 7" :key="i" class="impact-mote" :style="{'--i':i}"></i></div>`,
  });
  Vue.component('divine-scroll-transfer', {
    props: { transfer:Object, duration:{type:Number,default:2400} },
    computed: { motionStyle(){return divineTransferStyle(this.transfer,this.duration)}, theme(){return divineSkillTheme({no:5},2)} },
    template: `<div class="divine-script-transfer" :style="motionStyle" aria-hidden="true"><div class="divine-transfer-card" :style="{backgroundImage:'url('+transfer.image+')',width:transfer.from.width+'px',height:transfer.from.height+'px'}"></div></div>`,
  });
  Vue.component('divine-sprite', {
    props: ['name'], computed: { spriteStyle() { return divineSpriteStyle(this.name); } },
    template: '<div class="divine-sprite" :class="\'sprite-\'+name" :style="spriteStyle" aria-hidden="true"></div>',
  });
  Vue.component('divine-skill-art', {
    methods: { artError(event) { if (!event.target.dataset.fallback) { event.target.dataset.fallback = '1'; event.target.src = 'kami_cutin/' + this.effect.kamiNo + '.webp'; } } },
    props: { effect: Object, layout:Object, targets:Array, survivors:Array, stage: { type: String, default: 'closeup' }, duration: { type: Number, default: 3000 } },
    computed: { volley(){return divineBladeVolley(this.layout,this.survivors || [])}, beastManifestations(){return divineBeastManifestations()},orochiSeals(){return divineOrochiSeals()},thunderBranches(){return divineThunderBranches()},fieldScrolls(){return divineFieldScrolls(this.layout)},thunderSwordStyle(){return divineThunderSwordStyle(this.targets && this.targets[0])} },
    template: `<div class="divine-art divine-painted" :class="['divine-'+effect.motif,'divine-level-'+effect.index,'divine-stage-'+stage]" :style="{'--divine-color':effect.color,'--divine-accent':effect.accent,'--fx-duration':duration+'ms'}" aria-hidden="true">
      <div class="divine-mist"></div><div class="divine-ground"></div>
      <div v-if="stage === 'closeup' && effect.index === 2 && effect.cutin" class="genesis-scene">
        <div class="genesis-horizon"></div>
        <img class="genesis-hero" :src="effect.cutin" alt="" @error="artError">
        <div class="genesis-aura-ring"></div>
        <i v-for="i in 18" :key="'genesis-mote'+i" class="genesis-mote" :style="{'--i':i,'--mote-x':((i*43)%100)+'%','--mote-y':((i*29)%100)+'%','--mote-turn':(i*37)+'deg'}"></i>
        <div v-if="effect.motif === 'blade' || effect.motif === 'thunder'" class="genesis-slash"></div>
        <div v-if="effect.motif === 'script'" class="genesis-fate-thread"></div>
        <div v-if="effect.motif === 'sun'" class="genesis-sunrays"></div>
        <div v-if="effect.motif === 'moon'" class="genesis-frozen-halo"></div>
        <template v-if="effect.motif === 'dragon'"><div class="genesis-eclipse"></div><i v-for="i in 8" :key="'seal'+i" class="genesis-broken-seal" :style="{'--i':i}"></i></template>
      </div>
      <div v-else class="divine-scene">
        <template v-if="effect.motif === 'storm'">
          <div class="susanoo-resolve-scene"></div><div class="resolve-blade-current"></div><div class="resolve-storm-burst"></div>
          <div v-for="i in 5" :key="'wind'+i" class="scarlet-vortex" :style="{'--i':i}"></div>
          <i v-for="i in 28" :key="'leaf'+i" class="resolve-storm-spark" :style="{'--i':i}"></i>
        </template>
        <template v-if="effect.motif === 'blade'">
          <div class="blade-release-halo" :style="layout?{left:layout.origin.x+'px',top:layout.origin.y+'px'}:{}"></div>
          <div v-for="(blade,i) in volley" :key="'blade'+i" class="spirit-volley-blade" :style="blade"><divine-sprite name="spiritSword"></divine-sprite></div>
          <div v-for="(blade,i) in volley" :key="'rain'+i" class="spirit-rain-blade" :style="{left:blade['--impact-x'],top:blade['--impact-y'],'--rain-distance':blade['--rain-distance'],'--blade-scale':blade['--blade-scale'],'--rain-start':blade['--rain-start']}"><divine-sprite name="spiritSword"></divine-sprite></div>
          <div v-for="(blade,i) in volley" :key="'land'+i" class="spirit-blade-impact" :style="{left:blade['--impact-x'],top:blade['--impact-y'],'--impact-start':blade['--impact-start']}"></div>
        </template>
        <template v-if="effect.motif === 'grove'">
          <div class="grove-halo"></div>
          <div v-for="beast in beastManifestations" :key="beast.name" class="beast-manifestation" :style="beast.style"><i v-for="j in 12" :key="j" class="summon-orb-mote" :style="{'--orb-x':Math.cos(j*Math.PI/6)*150+'px','--orb-y':Math.sin(j*Math.PI/6)*100+'px'}"></i><div class="summon-light-orb"></div><div class="summon-animal-form beast-light-form"></div><div class="summon-morph-halo"></div></div>
          <div class="beast-manifestation rabbit-manifestation"><i v-for="j in 16" :key="j" class="summon-orb-mote" :style="{'--orb-x':Math.cos(j*Math.PI/8)*220+'px','--orb-y':Math.sin(j*Math.PI/8)*150+'px'}"></i><div class="summon-light-orb"></div><divine-sprite name="rabbit" class="summon-animal-form white-rabbit-form"></divine-sprite><div class="summon-morph-halo"></div></div>
        </template>
        <template v-if="effect.motif === 'thunder'">
          <divine-sprite name="futsunomitama" class="hero-prop thunder-sword" :class="{'thunder-sword-travel':thunderSwordStyle}" :style="thunderSwordStyle"></divine-sprite>
          <svg class="futsu-lightning" viewBox="0 0 1000 1000" preserveAspectRatio="none" fill="none"><path class="thunder-descent" d="M510 -20 L503 12 L516 34 L496 55 L505 78 L485 111 L496 135 L482 159 L501 182 L489 211 L513 237 L498 266 L521 294 L507 320 L519 346 L500 371 L511 398 L497 427 L509 456 L496 487 L500 530"/><g v-for="(path,i) in thunderBranches" :key="i" :style="{'--branch-delay':(i%4)*17+'ms','--branch-width':(1.2+i%4*.45)}"><path class="thunder-branch-halo" :d="path" pathLength="1"/><path class="thunder-branch-core" :d="path" pathLength="1"/></g></svg>
          <div class="lightning-impact"></div><div class="lightning-cage"></div>
        </template>
        <template v-if="effect.motif === 'script'">
          <div v-for="(field,i) in fieldScrolls" :key="'field-scroll'+i" class="mystic-field-scroll" :style="field"><div class="field-scroll-mist"></div><div class="field-scroll-paper"></div><div class="field-scroll-release"></div><i v-for="j in 16" :key="j" class="field-scroll-mote" :style="{'--i':j}"></i></div>
        </template>
        <template v-if="effect.motif === 'butterfly'">
          <divine-sprite name="silk" class="hero-prop heavenly-silk"></divine-sprite>
          <divine-sprite name="silk" class="hero-prop heavenly-silk silk-echo"></divine-sprite>
          <svg class="dance-trails" viewBox="0 0 600 600" fill="none"><path d="M20 470 C120 60 500 50 535 250 C565 420 70 480 105 285 C140 80 505 180 575 430"/><path d="M10 380 C210 550 540 470 485 210 C445 55 195 110 140 405"/></svg>
          <div class="silk-wind"></div><div class="silk-wind second"></div>
          <i v-for="i in (stage==='closeup'?48:18)" :key="'petal'+i" class="silk-petal" :style="{'--i':i,'--petal-x':((i*37)%100)+'%','--petal-y':((i*23)%100)+'%','--petal-size':(7+(i%5)*3)+'px','--petal-turn':((i%2?1:-1)*(150+i*13))+'deg'}"></i>
        </template>
        <template v-if="effect.motif === 'flame'">
          <div class="inferno-sweep-frames"></div><div class="inferno-impact"></div>
          <div class="inferno-wave"></div><div class="inferno-heat"></div>
          <i v-for="i in 30" :key="'ember'+i" class="inferno-ember" :style="{'--i':i}"></i>
        </template>
        <template v-if="effect.motif === 'sun'">
          <div class="mirror-rays"></div><div class="warm-lightfall"></div><div class="solar-corona"></div>
          <i v-for="i in 8" :key="'beam'+i" class="solar-beam" :style="{'--i':i}"></i>
          <divine-sprite name="mirror" class="yata-mirror"></divine-sprite>
          <div class="rebirth-ripple"></div><div class="rebirth-ripple second"></div>
          <i v-for="i in 16" :key="'light'+i" class="sun-mote" :style="{'--i':i}"></i>
        </template>
        <template v-if="effect.motif === 'moon'">
          <div class="lunar-relic lunar-magatama"></div><div class="lunar-relic lunar-crescent"></div><div class="lunar-relic lunar-full"></div>
          <div class="lunar-current"></div><div class="lunar-current second"></div>
          <i v-for="i in 32" :key="'moment'+i" class="time-suspended-shard" :style="{'--i':i,'--shard-x':((i*37)%100)+'%','--shard-y':((i*23)%100)+'%','--shard-size':(7+i%5*2)+'px'}"></i>
          <div class="lunar-stillness"></div><div class="time-freeze-wave"></div>
        </template>
        <template v-if="effect.motif === 'dragon'">
          <div class="orochi-void"></div><div class="orochi-blood-mist"></div>
          <div class="orochi-awakening-face"></div>
          <svg class="orochi-seal-lattice" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M50 24 L72 50 L50 76 L28 50 Z M50 35 L60 50 L50 65 L40 50 Z M50 24 L60 50 L50 76 L40 50 Z M28 50 L50 35 L72 50 L50 65 Z"/></svg>
          <div v-for="(seal,i) in orochiSeals" :key="'seal'+i" class="orochi-peeling-seal" :style="seal"><div class="orochi-seal-paper"></div></div>
          <div class="orochi-roar-wave"></div>
        </template>
      </div>
      <i v-for="i in (effect.index===2 ? 18 : 8)" :key="'dust'+i" class="divine-dust" :style="{'--i':i}"></i>
      <div class="divine-soft-flash"></div>
    </div>`,
  });
}
if (typeof module !== 'undefined') module.exports = { DIVINE_SKILL_THEMES, DIVINE_SKILL_CUTINS, divineSkillTheme, divineSkillAssetUrls, DIVINE_SPRITES, divineSpriteStyle, divineTransferStyle, divineBladeVolley, divineThunderBranches, divineFieldScrolls, divineThunderSwordStyle, divineBeastManifestations };
