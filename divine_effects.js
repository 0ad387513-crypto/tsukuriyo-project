/* 神技の見た目だけを定義する。カードの効果・勝敗判定は変更しない。 */
"use strict";
const DIVINE_SKILL_THEMES = Object.freeze({
  '1': { motif: 'storm', color: '#f3ae77', accent: '#fff0dd', skills: ['風が記憶を運ぶ', '天叢雲が新たな姿を結ぶ'] },
  '2': { motif: 'blade', color: '#c6e4ff', accent: '#ffffff', skills: ['一閃が道を開く', '孤高の刃が戦場を断つ'] },
  '3': { motif: 'grove', color: '#7ce598', accent: '#ffe4a0', skills: ['獣霊の足音が響く', '大地から眷属が集う'] },
  '4': { motif: 'thunder', color: '#ffd83d', accent: '#fff5a8', skills: ['雷をその身に纏う', '布都御魂が轟く'] },
  '5': { motif: 'script', color: '#bba0ff', accent: '#79f5f2', skills: ['言霊が力をほどく', '八意の糸が運命を繋ぎ替える'] },
  '6': { motif: 'camellia', color: '#e9a7b6', accent: '#fff0d8', skills: ['舞に心が引き寄せられる', '羽衣と椿の舞が時を縛る'] },
  '7': { motif: 'flame', color: '#ff773b', accent: '#fff0a0', skills: ['灰の中に記憶が灯る', '紅蓮の焔が焼き尽くす'] },
  '8': { motif: 'sun', color: '#ffd97b', accent: '#fffbea', skills: ['光が命を護る', '鏡の光が命を呼び戻す'] },
  '9': { motif: 'moon', color: '#86d3ff', accent: '#e5d6ff', skills: ['月影へと還る', '凍てつく月が時を止める'] },
  '10': { motif: 'dragon', color: '#e66379', accent: '#ffbf69', skills: ['龍血が封印から溢れる', '八つの影が天を喰らう'] },
});
const DIVINE_SKILL_CUTINS = Object.freeze({
  "1": "kami_cutin/susanoo-cutin-ad6e2e8270ec.webp",
  "2": "kami_cutin/yamato-takeru-cutin-107d9d71a240.webp",
  "3": "kami_cutin/okuninushi-cutin-e6494f8fcb65.webp",
  "4": "kami_cutin/takemikazuchi-cutin-fa6f656e6b96.webp",
  "5": "kami_cutin/omoikane-cutin-114849a0db96.webp",
  "6": "kami_cutin/amenouzume-cutin-2614c1923e1f.webp",
  "7": "kami_cutin/hinokagutsuchi-cutin-6c509856aba2.webp",
  "8": "kami_cutin/amaterasu-cutin-8ec22a9e9639.webp",
  "9": "kami_cutin/tsukuyomi-hand-B-5451adc68469.webp",
  "10": "kami_cutin/yamata-no-orochi-cutin-770a16e40338.webp"
});
const DIVINE_SKILL_AWAKENINGS = Object.freeze({
  '1': 'kami_cutin/susanoo-cutin-ad6e2e8270ec.webp',
});
const DIVINE_SKILL_AWAKENING_FRAMES = Object.freeze({
  '1': Object.freeze(['kami_cutin/susanoo-cutin-ad6e2e8270ec.webp','kami_cutin/susanoo-cutin-ad6e2e8270ec.webp','kami_cutin/susanoo-cutin-ad6e2e8270ec.webp']),
});
const DIVINE_CAMELLIA_ATLAS = 'divine_assets/camellia-atlas-e11e33d1fe46.webp';
const DIVINE_UZUME_PETAL_ATLAS = 'divine_assets/camellia-petals-eight-6cabafaedf28.webp';
const DIVINE_UZUME_FAN = 'divine_assets/amenouzume-golden-fan-2cc76299100e.webp';
const DIVINE_UZUME_FAN_FRAMES = Object.freeze([
  DIVINE_UZUME_FAN,
]);
const DIVINE_UZUME_SILK = 'divine_assets/amenouzume-hagoromo-2ef2602b4401.webp';
const DIVINE_UZUME_HAGOROMO_POSES = 'divine_assets/amenouzume-hagoromo-wind-poses-c0da1212d44f.webp';
const DIVINE_HINO_RED_SLASH = 'divine_assets/hinokagutsuchi-red-slash-8dbac9d0078c.webp';
const DIVINE_HINO_FIRE_WALL_FRAMES = Object.freeze([
  'divine_assets/hinokagutsuchi-fire-wall-ignition-a35083ccbd3c.webp',
  'divine_assets/hinokagutsuchi-fire-wall-rise-47b74843538a.webp',
  'divine_assets/hinokagutsuchi-fire-wall-peak-79b373320830.webp',
  'divine_assets/hinokagutsuchi-fire-wall-decay-f6399d6e3bd4.webp',
]);
const DIVINE_YATA_MIRROR = 'divine_assets/yata-golden-mirror-back-2d2896c377be.webp';
// 封印解除の前後とも、仮面の破片と八頭の龍を描いた現行の確定画像を使用する。
const DIVINE_OROCHI_UNIFIED_SCENE = 'kami_cutin/yamata-no-orochi-cutin-770a16e40338.webp';
// 赤と白の椿と花びらを交互に切り出す。花は周辺へ置き、中央を塞がない。
function divineCamelliaStyle(i, blossom = false) {
  const anchors = [[5,22],[88,16],[14,70],[85,68],[42,85],[91,43]];
  const position = blossom ? anchors[(i-1)%anchors.length] : [(i*37)%100,(i*23)%100];
  const variant=((i-1)*5)%8;
  return {backgroundImage:`url('${blossom?DIVINE_CAMELLIA_ATLAS:DIVINE_UZUME_PETAL_ATLAS}')`,
    backgroundPosition:blossom?`${((i-1)%2)*50}% 0%`:`${(variant%4)*100/3}% ${variant<4?0:100}%`,
    '--i':i,'--camellia-x':position[0]+'%','--camellia-y':position[1]+'%',
    '--camellia-size':(blossom?40+(i%3)*12:14+(i%5)*4)+'px','--camellia-turn':((i%2?1:-1)*(35+i*7))+'deg'};
}
function divineSkillTheme(kami, index) {
  const theme = DIVINE_SKILL_THEMES[String(kami && kami.no)] || DIVINE_SKILL_THEMES['8'];
  return { kamiNo: String(kami && kami.no), cutin: index === 2 ? DIVINE_SKILL_CUTINS[String(kami && kami.no)] : null, awakening: index === 2 ? DIVINE_SKILL_AWAKENINGS[String(kami && kami.no)] || null : null, awakeningFrames: index === 2 ? DIVINE_SKILL_AWAKENING_FRAMES[String(kami && kami.no)] || [] : [], motif: theme.motif, color: theme.color, accent: theme.accent, label: theme.skills[index === 2 ? 1 : 0], index };
}

// Atlas cells are native painted sprites; movements and lighting stay code-driven.
const DIVINE_SPRITES = Object.freeze({
  kusanagi: [0, 0], spiritSword: [1, 0], beasts: [2, 0], rabbit: [3, 0],
  futsunomitama: [0, 1], scroll: [1, 1], silk: [2, 1], brokenChain: [3, 1],
  mirror: [0, 2], magatama: [1, 2], dragons: [2, 2], ofuda: [3, 2],
});
function divineSpriteStyle(name) {
  if (name === 'mirror') return { backgroundImage: `url('${DIVINE_YATA_MIRROR}')`, backgroundPosition: 'center', backgroundSize: 'contain' };
  if (name === 'fan') return { backgroundImage: `url('${DIVINE_UZUME_FAN}')`, backgroundPosition: 'center', backgroundSize: 'contain' };
  if (name === 'silk') return { backgroundImage: `url('${DIVINE_UZUME_SILK}')`, backgroundPosition: 'center', backgroundSize: 'contain' };
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
    '1': ['divine_assets/totsuka-sword-d380260b8deb.webp'],
    '2': ['divine_assets/spirit-sword-08a642135453.webp'],
    '3': [atlas, 'divine_assets/beast-light-forms-5bdddec3647d.webp'],
    '4': ['divine_assets/futsunomitama-seven-453501cd77c5.webp'],
    '5': ['divine_assets/mystic-purple-scroll-bd45e7325132.webp'],
    '6': [DIVINE_UZUME_SILK, DIVINE_UZUME_HAGOROMO_POSES, DIVINE_CAMELLIA_ATLAS, DIVINE_UZUME_PETAL_ATLAS, ...DIVINE_UZUME_FAN_FRAMES],
    '7': [DIVINE_HINO_RED_SLASH, ...DIVINE_HINO_FIRE_WALL_FRAMES],
    '8': [DIVINE_YATA_MIRROR],
    '9': ['divine_assets/lunar-relics-ac681e76d45f.webp'],
    '10': [DIVINE_OROCHI_UNIFIED_SCENE, 'divine_assets/orochi-seal-paper-8e9e3864d744.webp', 'divine_assets/orochi-torn-seal-29d8da98451b.webp'],
  };
  return [...new Set([...(assets[String(kami && kami.no)] || []), DIVINE_SKILL_CUTINS[String(kami && kami.no)], DIVINE_SKILL_AWAKENINGS[String(kami && kami.no)], ...(DIVINE_SKILL_AWAKENING_FRAMES[String(kami && kami.no)] || [])].filter(Boolean))];
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
// 赤白の花びらに位相・高さ・半径の差を付け、扇の周囲を連続したらせんとして巻き上げる。
function divineUzumeSpiralPetalStyle(i) {
  const variant=((i-1)*5)%8;
  const phase = ((i * 23) % 56) * Math.PI / 28;
  // 根元を細く、上に行くほど外へ広がる花びらの渦にする。
  const radius = 7 + (i % 7) * 1.1;
  const orbit = step => `${(Math.cos(phase + step * .94) * radius * (.7 + step * .22)).toFixed(2)}vw`;
  const depth = step => (.78 + (Math.sin(phase + step * .94) + 1) * .16).toFixed(2);
  const flight = Object.fromEntries(Array.from({length:11},(_,step)=>[
    [`--petal-orbit-${step}`,orbit(step)],
    [`--petal-depth-${step}`,depth(step)],
  ]).flat());
  return {
    '--petal-image': `url('${DIVINE_UZUME_PETAL_ATLAS}')`,
    '--petal-cell-x': `${(variant%4)*100/3}%`,
    '--petal-cell-y': `${variant<4?0:100}%`,
    '--petal-size': `${38 + (i % 5) * 7}px`,
    '--petal-flutter-ms': `${440+(i%6)*95}ms`,
    '--petal-flutter-delay': `${-(i%9)*91}ms`,
    '--petal-radius-start': `${(radius*.7).toFixed(2)}vw`,
    '--petal-radius-end': `${(radius*2.9).toFixed(2)}vw`,
    '--petal-delay': `${-((i * 13) % 17) * 31}ms`,
    '--petal-entry-x': `${(i * 37) % 114 - 57}vw`,
    '--petal-entry-y': `${-78 - (i % 8) * 7}vh`,
    '--petal-gather-x': `${((i * 37) % 114 - 57) * .25}vw`,
    '--petal-height-shift': `${(i % 9) * 2 - 8}vh`,
    '--petal-turn': `${230 + (i % 7) * 37}deg`,
    ...flight,
  };
}
function divineUzumeHagoromoPoseStyle(i) {
  const cell=i-1;
  return {backgroundImage:`url('${DIVINE_UZUME_HAGOROMO_POSES}')`,backgroundPosition:`${(cell%2)*100}% ${Math.floor(cell/2)*100}%`,'--pose-delay':`${cell*650}ms`};
}
// はがれた八枚を画面外の退避先から集め、実際の能力アイコンへ導く。
function divineOrochiSealArrivalStyles(viewport = typeof window !== 'undefined' ? window : {innerWidth:1200,innerHeight:800}) {
  return divineOrochiSeals().map((seal,i)=>({
    '--seal-from-x':(viewport.innerWidth*(parseFloat(seal.left)/100-.5)+parseFloat(seal['--seal-fly-x']))+'px',
    '--seal-from-y':(viewport.innerHeight*(parseFloat(seal.top)/100-.5)+parseFloat(seal['--seal-fly-y']))+'px',
    '--seal-turn':seal['--seal-tilt'], '--seal-order':i,
  }));
}
function divineOrochiSealMarkStyle(rect, viewport = typeof window !== 'undefined' ? window : {innerWidth:1200,innerHeight:800}) {
  if (!rect) return null;
  const x=rect.left+rect.width/2,y=rect.top+rect.height/2;
  return {left:x+'px',top:y+'px',width:rect.width+'px',height:rect.height+'px',
    '--arrival-x':`calc(50vw - ${x}px)`,'--arrival-y':`calc(50vh - ${y}px)`,
    '--arrival-scale':Math.min(viewport.innerHeight*.38/rect.height,viewport.innerWidth*.32/rect.width)};
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
// 中央の大きな天叢雲を、実際の能力アイコンと同じ位置・大きさへ収める。
function divineSusanooSwordStyle(rect, viewport = typeof window !== 'undefined' ? window : {innerWidth:1200,innerHeight:800}) {
  if (!rect) return null;
  const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
  return {left:x+'px',top:y+'px',width:rect.width+'px',height:rect.height+'px',
    '--arrival-x':`calc(50vw - ${x}px)`,'--arrival-y':`calc(50vh - ${y}px)`,
    '--arrival-scale':Math.min(viewport.innerHeight*.68/rect.height,viewport.innerWidth*.64/rect.width)};
}

// 爪は選んだカードの位置へ、爆発は相手カミの位置へそれぞれ合わせる。
function divineFlameClawLayout(targets = []) {
  const rects = targets.filter(r => r && ['left','top','width','height'].every(k => Number.isFinite(r[k])) && r.width > 0 && r.height > 0);
  if (!rects.length) return {sweep:null,dissolve:null,eruptionLayers:[],burst:null};
  const kami = rects.find(r => r.kind === 'kami') || rects[rects.length-1];
  const card = rects.find(r => r.kind !== 'kami') || null;
  const ky=kami.top+kami.height/2;
  const strike=card ? {left:card.left+card.width/2+'px',top:card.top+card.height/2+18+'px',
    width:Math.max(560,card.width*6)+'px',height:Math.max(360,card.height*3)+'px',
    '--claw-angle':'-12deg',backgroundImage:"url('"+DIVINE_HINO_RED_SLASH+"')"} : null;
  const dissolve=card ? {style:{left:card.left+'px',top:card.top+'px',width:card.width+'px',height:card.height+'px'},
    image:card.image?"url('"+card.image+"')":'none'} : null;
  const viewportWidth=typeof window !== 'undefined' ? window.innerWidth : 1200;
  const viewportHeight=typeof window !== 'undefined' ? window.innerHeight : 800;
  // 16:9の一枚絵を画面幅いっぱいに置く。縦長画面では中央を切り出して高さを確保する。
  const flameWidth=Math.max(viewportWidth,viewportHeight*.55*16/9);
  const flameHeight=flameWidth*9/16;
  const flameBottom=ky+Math.max(95,kami.height*1.1);
  const eruptionLayers=DIVINE_HINO_FIRE_WALL_FRAMES.map((url,phase)=>({phase,style:{
    left:((viewportWidth-flameWidth)/2)+'px',top:(flameBottom-flameHeight)+'px',
    width:flameWidth+'px',height:flameHeight+'px',backgroundImage:"url('"+url+"')"}}));
  const burst={left:'0px',top:(ky-Math.max(220,kami.height*2))+'px',width:viewportWidth+'px',height:Math.max(450,kami.height*4)+'px'};
  return {sweep:strike,dissolve,eruptionLayers,burst};
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
  Vue.component('divine-orochi-seal-arrival', {
    props:{landing:Object,duration:{type:Number,default:1200}},
    computed:{seals(){return divineOrochiSealArrivalStyles()},crestStyle(){return divineOrochiSealMarkStyle(this.landing)}},
    template:`<div class="orochi-seal-arrival divine-painted" :style="{'--fx-duration':duration+'ms'}" aria-hidden="true">
      <i v-for="(seal,i) in seals" :key="i" class="orochi-seal-return" :style="seal"></i>
      <div v-if="crestStyle" class="orochi-seal-crest" :style="crestStyle"><img src="divine_assets/orochi-torn-seal-29d8da98451b.webp" alt=""></div>
    </div>`,
  });
  Vue.component('divine-sprite', {
    props: ['name'], computed: { spriteStyle() { return divineSpriteStyle(this.name); } },
    template: '<div class="divine-sprite" :class="\'sprite-\'+name" :style="spriteStyle" aria-hidden="true"></div>',
  });
  Vue.component('divine-skill-art', {
    data() { return {awakeningFailed:false}; },
    methods: { artError(event) { if (!event.target.dataset.fallback) { event.target.dataset.fallback = '1'; event.target.src = 'kami_cutin/' + this.effect.kamiNo + '.webp'; } }, awakeningError() { this.awakeningFailed = true; }, camelliaStyle(i, blossom) { return divineCamelliaStyle(i, blossom); }, spiralPetalStyle(i) { return divineUzumeSpiralPetalStyle(i); }, hagoromoPoseStyle(i) { return divineUzumeHagoromoPoseStyle(i); } },
    props: { effect: Object, layout:Object, targets:Array, survivors:Array, swordLanding:Object, stage: { type: String, default: 'closeup' }, duration: { type: Number, default: 3000 } },
    computed: { volley(){return divineBladeVolley(this.layout,this.survivors || [])}, beastManifestations(){return divineBeastManifestations()},orochiSeals(){return divineOrochiSeals()},thunderBranches(){return divineThunderBranches()},fieldScrolls(){return divineFieldScrolls(this.layout)},thunderSwordStyle(){return divineThunderSwordStyle(this.targets && this.targets[0])},susanooSwordStyle(){return divineSusanooSwordStyle(this.swordLanding)},flameClaw(){return divineFlameClawLayout(this.targets || [])},uzumeFanFrames(){return DIVINE_UZUME_FAN_FRAMES} },
    template: `<div class="divine-art divine-painted" :class="['divine-'+effect.motif,'divine-level-'+effect.index,'divine-stage-'+stage]" :style="{'--divine-color':effect.color,'--divine-accent':effect.accent,'--fx-duration':duration+'ms'}" aria-hidden="true">
      <div class="divine-mist"></div><div class="divine-ground"></div>
      <div v-if="stage === 'cutin' && effect.index === 2 && effect.cutin" class="genesis-scene">
        <div class="genesis-horizon"></div>
        <img class="genesis-hero" :src="effect.cutin" alt="" @error="artError">
        <div class="genesis-aura-ring"></div>
        <template v-if="effect.motif !== 'camellia'"><i v-for="i in 18" :key="'genesis-mote'+i" class="genesis-mote" :style="{'--i':i,'--mote-x':((i*43)%100)+'%','--mote-y':((i*29)%100)+'%','--mote-turn':(i*37)+'deg'}"></i></template>
        <template v-else>
          <div class="sweet-wind"></div>
          <svg class="hagoromo-stream" viewBox="0 0 1000 600" preserveAspectRatio="none" fill="none"><path d="M-100 430 C130 90 330 570 580 280 S870 70 1100 230"/><path d="M-100 170 C180 490 410 20 620 310 S850 510 1100 350"/></svg>
          <i v-for="i in 4" :key="'bloom'+i" class="camellia-particle camellia-blossom" :style="camelliaStyle(i, true)"></i>
          <i v-for="i in 18" :key="'petal'+i" class="camellia-particle camellia-petal" :style="camelliaStyle(i, false)"></i>
        </template>
        <div v-if="effect.motif === 'blade' || effect.motif === 'thunder'" class="genesis-slash"></div>
        <div v-if="effect.motif === 'script'" class="genesis-fate-thread"></div>
        <div v-if="effect.motif === 'sun'" class="genesis-sunrays"></div>
        <div v-if="effect.motif === 'moon'" class="genesis-frozen-halo"></div>
        <div v-if="effect.motif === 'dragon'" class="genesis-eclipse"></div>
      </div>
      <div v-else-if="stage === 'awakening' && effect.awakening" class="susanoo-awakening-scene">
        <div class="susanoo-awakening-frame"><div class="susanoo-awakening-camera">
          <img class="susanoo-awakening-base" :src="effect.cutin" alt="" @error="artError">
          <template v-if="!awakeningFailed"><img v-for="(frame,i) in effect.awakeningFrames" :key="frame" class="susanoo-awakening-eyes" :class="{'eyes-narrow':i===0,'eyes-half':i===1,'eyes-threequarter':i===2}" :src="frame" alt="" @error="awakeningError"></template>
          <img v-if="!awakeningFailed" class="susanoo-awakening-eyes" :src="effect.awakening" alt="" @error="awakeningError">
          <template v-if="!awakeningFailed"><i class="susanoo-eye-light eye-left"></i><i class="susanoo-eye-light eye-right"></i></template>
        </div></div>
        <div v-if="!awakeningFailed" class="susanoo-awakening-flare"></div>
      </div>
      <div v-else class="divine-scene" :class="{'flame-target-scene':effect.motif==='flame' && effect.index===2}">
        <template v-if="effect.motif === 'storm'">
          <div class="susanoo-sword-arrival" :class="{'susanoo-sword-travel':susanooSwordStyle}" :style="susanooSwordStyle"><divine-sprite name="kusanagi"></divine-sprite></div>
          <div class="resolve-blade-current"></div><div class="resolve-storm-burst"></div>
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
        <template v-if="effect.motif === 'camellia'">
          <template v-if="effect.index === 2">
            <i v-for="i in 2" :key="'uzume-gust-'+i" class="uzume-soft-gust" :class="'uzume-soft-gust-'+i"></i>
            <div class="uzume-hagoromo-flight"><i v-for="i in 4" :key="'hagoromo-pose-'+i" class="uzume-hagoromo-pose" :style="hagoromoPoseStyle(i)"></i></div>
            <div class="uzume-fan-flight"><img class="uzume-fan-frame" :src="uzumeFanFrames[0]" alt=""></div>
            <i v-for="i in 56" :key="'spiral-petal-'+i" class="uzume-spiral-petal" :style="spiralPetalStyle(i)"><span class="uzume-spiral-petal-art"></span></i>
          </template>
          <template v-else>
            <div class="sweet-wind"></div>
            <divine-sprite name="silk" class="hero-prop heavenly-silk"></divine-sprite>
            <divine-sprite name="silk" class="hero-prop heavenly-silk silk-echo"></divine-sprite>
            <svg class="hagoromo-stream" viewBox="0 0 1000 600" preserveAspectRatio="none" fill="none"><path d="M-100 430 C130 90 330 570 580 280 S870 70 1100 230"/><path d="M-100 170 C180 490 410 20 620 310 S850 510 1100 350"/></svg>
            <i v-for="i in 4" :key="'bloom'+i" class="camellia-particle camellia-blossom" :style="camelliaStyle(i, true)"></i>
            <i v-for="i in (stage==='closeup'?36:12)" :key="'petal'+i" class="camellia-particle camellia-petal" :style="camelliaStyle(i, false)"></i>
          </template>
        </template>
        <template v-if="effect.motif === 'flame' && effect.index === 2">
          <div v-if="flameClaw.sweep" class="hino-strike" :style="flameClaw.sweep"></div>
          <div v-if="flameClaw.dissolve" class="hino-card-dissolve" :style="flameClaw.dissolve.style"><div class="hino-card-dissolve-art" :style="{backgroundImage:flameClaw.dissolve.image}"><span v-if="flameClaw.dissolve.image==='none'">選んだレガシー</span></div></div>
          <div v-for="(layer,i) in flameClaw.eruptionLayers" :key="'hino-eruption-'+i" class="hino-eruption" :class="'hino-eruption-'+layer.phase" :style="layer.style"></div>
          <div v-if="flameClaw.burst" class="hino-eruption-glare" :style="flameClaw.burst"></div>
        </template>
        <template v-if="effect.motif === 'flame' && effect.index !== 2">
          <div class="inferno-sweep-frames"></div><div class="inferno-impact"></div>
          <div class="inferno-wave"></div><div class="inferno-heat"></div>
          <i v-for="i in 30" :key="'ember'+i" class="inferno-ember" :style="{'--i':i}"></i>
        </template>
        <template v-if="effect.motif === 'sun'">
          <div class="yata-descent">
            <div class="yata-descending-light">
              <div class="mirror-rays"></div><div class="warm-lightfall"></div><div class="solar-corona"></div>
              <i v-for="i in 8" :key="'beam'+i" class="solar-beam" :style="{'--i':i}"></i>
            </div>
            <div class="yata-underside-glow"></div>
            <divine-sprite name="mirror" class="yata-mirror"></divine-sprite>
          </div>
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
          <div class="orochi-void"></div><div class="orochi-blood-mist"></div><div class="orochi-forbidden-flash"></div>
          <div class="orochi-unified-art">
            <div class="orochi-unified-dragons"></div><div class="orochi-unified-girl"></div>
            <svg class="orochi-seal-lattice" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M50 24 L72 50 L50 76 L28 50 Z M50 35 L60 50 L50 65 L40 50 Z M50 24 L60 50 L50 76 L40 50 Z M28 50 L50 35 L72 50 L50 65 Z"/></svg>
            <div v-for="(seal,i) in orochiSeals" :key="'seal'+i" class="orochi-peeling-seal" :style="seal"><div class="orochi-seal-paper"></div></div>
          </div>
          <div class="orochi-roar-wave"></div>
        </template>
      </div>
      <i v-for="i in (effect.index===2 ? 18 : 8)" :key="'dust'+i" class="divine-dust" :style="{'--i':i}"></i>
      <div class="divine-soft-flash"></div>
    </div>`,
  });
}
if (typeof module !== 'undefined') module.exports = { divineFlameClawLayout, DIVINE_HINO_RED_SLASH, DIVINE_HINO_FIRE_WALL_FRAMES, DIVINE_OROCHI_UNIFIED_SCENE, DIVINE_UZUME_FAN_FRAMES, DIVINE_UZUME_HAGOROMO_POSES, divineUzumeSpiralPetalStyle, divineUzumeHagoromoPoseStyle, DIVINE_SKILL_THEMES, DIVINE_SKILL_CUTINS, DIVINE_SKILL_AWAKENINGS, DIVINE_SKILL_AWAKENING_FRAMES, divineSkillTheme, divineSkillAssetUrls, DIVINE_SPRITES, divineSpriteStyle, divineTransferStyle, divineBladeVolley, divineThunderBranches, divineFieldScrolls, divineThunderSwordStyle, divineSusanooSwordStyle, divineOrochiSealArrivalStyles, divineOrochiSealMarkStyle, divineBeastManifestations };
