/* カミの立ち絵モーション（待機中の呼吸・まばたき、ダメージや天力獲得などの反応）。
   見た目だけを定義する。カードの効果・勝敗判定・オンライン同期には関与しない。

   ■ 仕組み
   - 対戦画面のカミの丸い肖像（.kami-portrait）の中に <kami-motion> を重ね、パーツ画像を動かす。
   - KAMI_MOTION_SETS に登録したカミだけが動く。未登録のカミは従来どおり1枚絵のまま（何も変わらない）。
   - 反応のきっかけは対戦画面の表示の変化（ライフ・天力・封印の増減、神技、エモート、手番、勝敗）。
     オンライン対戦では同期された盤面から各端末が同じきっかけを検知するので、通信は増えない。

   ■ 画像の作り方（詳細は kami_motion/README.md）
   - すべての画像は同じ大きさの正方形（推奨 1024×1024）の透過WebPで、肖像の丸枠に収まる同じ構図・同じ位置で描く。
   - layers：待機中に重ねるパーツ。下から順に描画する。idle で動き方を指定する（KAMI_MOTION_IDLE_PRESETS）。
   - blink：目を閉じた差分（顔の部分だけ描いた透過画像）。数秒おきに一瞬だけ重ねる。
   - poses：反応ごとの差分（全身1枚、または frames で連番）。無い反応は、近い反応の差分→待機の絵の順に代わりに使う。

   登録例：
     '1': {
       layers: [
         { src: 'kami_motion/susanoo-back-0123456789ab.webp', idle: 'sway' },      // 後ろ髪・衣のなびき
         { src: 'kami_motion/susanoo-body-0123456789ab.webp', idle: 'breathe' },   // 体（呼吸）
       ],
       blink: 'kami_motion/susanoo-blink-0123456789ab.webp',
       poses: {
         damage: 'kami_motion/susanoo-damage-0123456789ab.webp',
         tenryoku: { frames: ['kami_motion/susanoo-tenryoku-1-….webp', 'kami_motion/susanoo-tenryoku-2-….webp'], fps: 10 },
         pinch: 'kami_motion/susanoo-pinch-0123456789ab.webp',   // ライフが少ないときの待機（任意）
       },
     },
*/
"use strict";

// 待機中のパーツの動き方。値は kami_motion.css の .kami-motion-idle-○○ に対応する
const KAMI_MOTION_IDLE_PRESETS = Object.freeze(['none', 'breathe', 'sway', 'sway-slow', 'float']);

/* 反応の種類。
   duration：差分を見せる時間（ミリ秒、標準速度）。hold：決着まで出し続ける。
   effect：差分に重ねる画面効果（kami_motion.css の .kami-motion-fx-○○）。
   priority：表示中の反応より低いものは割り込まない。fallback：差分が無いときに代わりに使う反応 */
const KAMI_MOTION_EVENTS = Object.freeze({
  damage:      Object.freeze({ label: 'ダメージを受けた', duration: 900, effect: 'shake', priority: 3 }),
  damageHeavy: Object.freeze({ label: '大ダメージ（3以上）', duration: 1200, effect: 'shake-heavy', priority: 4, fallback: 'damage' }),
  heal:        Object.freeze({ label: 'ライフ回復', duration: 1000, effect: 'heal', priority: 2 }),
  tenryoku:    Object.freeze({ label: '天力を獲得', duration: 1000, effect: 'tenryoku', priority: 2 }),
  sealBreak:   Object.freeze({ label: '封印が解ける（ヤマタノオロチ）', duration: 1200, effect: 'seal', priority: 3, fallback: 'tenryoku' }),
  skill1:      Object.freeze({ label: '神技', duration: 1400, effect: 'skill', priority: 4 }),
  skill2:      Object.freeze({ label: '創世神技', duration: 1600, effect: 'skill', priority: 5, fallback: 'skill1' }),
  turnStart:   Object.freeze({ label: '自分のターン開始', duration: 900, effect: 'nod', priority: 1 }),
  emote:       Object.freeze({ label: 'エモート', duration: 1600, effect: 'nod', priority: 1 }),
  win:         Object.freeze({ label: '勝利', hold: true, effect: 'skill', priority: 6 }),
  lose:        Object.freeze({ label: '敗北', hold: true, effect: 'none', priority: 6, fallback: 'damageHeavy' }),
});
// エモートは種類ごとの差分（poses['emote:greeting'] など）を優先し、無ければ poses.emote を使う
const KAMI_MOTION_EMOTE_KEYS = Object.freeze(['greeting', 'confusion', 'praise', 'surprise', 'taunt', 'boast']);

// カミごとの画像の登録。Codex が画像を作ったらここへ追加する（キーはカミの No.）
const KAMI_MOTION_SETS = Object.freeze({
});

function kamiMotionSet(kamiNo, sets = KAMI_MOTION_SETS) {
  const set = sets && sets[String(parseInt(kamiNo, 10))];
  return set && Array.isArray(set.layers) && set.layers.length ? set : null;
}

// 差分の指定を { frames, fps, loop } にそろえる（1枚の文字列も1コマとして扱う）
function kamiMotionNormalizePose(pose) {
  if (!pose) return null;
  if (typeof pose === 'string') return { frames: [pose], fps: 0, loop: false };
  const frames = Array.isArray(pose.frames) ? pose.frames.filter(Boolean) : (pose.src ? [pose.src] : []);
  if (!frames.length) return null;
  return { frames, fps: Math.max(0, Number(pose.fps) || 12), loop: !!pose.loop };
}

/* 反応に使う差分を探す。emote は種類別→共通、それ以外は fallback をたどる。
   見つからなければ null（待機の絵のまま画面効果だけを出す） */
function kamiMotionResolvePose(set, type, detail = null) {
  const poses = (set && set.poses) || {};
  const tried = new Set();
  let current = type;
  if (type === 'emote' && detail && poses['emote:' + detail]) return kamiMotionNormalizePose(poses['emote:' + detail]);
  while (current && !tried.has(current)) {
    tried.add(current);
    const pose = kamiMotionNormalizePose(poses[current]);
    if (pose) return pose;
    current = KAMI_MOTION_EVENTS[current] && KAMI_MOTION_EVENTS[current].fallback;
  }
  return null;
}

// ライフ・天力・封印の増減から反応の種類を決める（マナの増減では動かない）
function kamiMotionEventForStat(key, delta) {
  const d = Number(delta) || 0;
  if (!d) return null;
  if (key === 'life') return d < 0 ? (d <= -3 ? 'damageHeavy' : 'damage') : 'heal';
  if (key === 'tenryoku') return d > 0 ? 'tenryoku' : null;
  if (key === 'seal') return d < 0 ? 'sealBreak' : null;
  return null;
}

// 演出速度・動きを減らす設定に合わせた表示時間（hold の反応は 0＝出し続ける）
function kamiMotionDuration(type, speed = 'normal', reduced = false) {
  const ev = KAMI_MOTION_EVENTS[type];
  if (!ev || ev.hold) return 0;
  if (speed === 'minimal') return 0;
  const scale = speed === 'fast' || reduced ? 0.6 : 1;
  return Math.max(250, Math.round(ev.duration * scale));
}

// 先読み用：そのカミの全画像
function kamiMotionUrls(kamiNo, sets = KAMI_MOTION_SETS) {
  const set = kamiMotionSet(kamiNo, sets);
  if (!set) return [];
  const urls = set.layers.map(layer => layer && layer.src);
  if (set.blink) urls.push(set.blink);
  for (const pose of Object.values(set.poses || {})) {
    const normalized = kamiMotionNormalizePose(pose);
    if (normalized) urls.push(...normalized.frames);
  }
  return Array.from(new Set(urls.filter(Boolean)));
}

/* 表示部品。親（.kami-portrait）の大きさいっぱいに重ねる。
   event：{ id, type, detail }。id が変わるたびに1回反応する */
if (typeof Vue !== 'undefined') {
  Vue.component('kami-motion', {
    props: {
      kamiNo: { type: [String, Number], required: true },
      event: { type: Object, default: null },
      pinch: { type: Boolean, default: false },
      speed: { type: String, default: 'normal' },
      reduced: { type: Boolean, default: false },
      sets: { type: Object, default: null }, // 演出確認ページ用。通常は KAMI_MOTION_SETS
    },
    data() {
      return { blinking: false, active: null, frame: 0 };
    },
    computed: {
      set() { return kamiMotionSet(this.kamiNo, this.sets || KAMI_MOTION_SETS); },
      layers() {
        return (this.set ? this.set.layers : []).map(layer => ({
          src: layer.src,
          idle: KAMI_MOTION_IDLE_PRESETS.includes(layer.idle) ? layer.idle : 'none',
        }));
      },
      pinchPose() {
        return this.pinch && this.set ? kamiMotionNormalizePose(this.set.poses && this.set.poses.pinch) : null;
      },
      // 反応中の差分（無ければ待機の絵に画面効果だけ）
      poseSrc() {
        const pose = this.active && this.active.pose;
        return pose ? pose.frames[Math.min(this.frame, pose.frames.length - 1)] : '';
      },
      rootClass() {
        const ev = this.active && KAMI_MOTION_EVENTS[this.active.type];
        return {
          'is-pinch': this.pinch,
          'is-posing': !!this.poseSrc,
          reduced: this.reduced || this.speed === 'minimal',
          ['kami-motion-fx-' + (ev && !this.reduced ? ev.effect : 'none')]: !!this.active,
        };
      },
    },
    watch: {
      event(next, previous) {
        if (!next) { this.stop(); return; } // 対戦のやり直し・決着の取り消し
        if (next.id && (!previous || next.id !== previous.id)) this.play(next.type, next.detail);
      },
      kamiNo() { this.stop(); },
      reduced(v) { if (v) this.blinking = false; },
    },
    mounted() {
      this._scheduleBlink(); // 表示した時点の event は過去の反応なので再生しない
    },
    beforeDestroy() {
      this.stop();
      clearTimeout(this._blinkTimer);
    },
    methods: {
      play(type, detail = null) {
        const ev = KAMI_MOTION_EVENTS[type];
        if (!ev || !this.set) return;
        if (this.speed === 'minimal' && !ev.hold) return;
        const current = this.active && KAMI_MOTION_EVENTS[this.active.type];
        if (current && current.priority > ev.priority) return; // 大事な反応の途中には割り込まない
        this.stop();
        const pose = kamiMotionResolvePose(this.set, type, detail);
        this.active = { type, detail, pose };
        this.frame = 0;
        if (pose && pose.frames.length > 1 && pose.fps > 0 && !this.reduced) {
          this._frameTimer = setInterval(() => {
            if (this.frame + 1 < pose.frames.length) this.frame++;
            else if (pose.loop) this.frame = 0;
            else clearInterval(this._frameTimer);
          }, Math.round(1000 / pose.fps));
        }
        const duration = kamiMotionDuration(type, this.speed, this.reduced);
        if (duration > 0) this._endTimer = setTimeout(() => this.stop(), duration);
        this.$emit('motion', type);
      },
      stop() {
        clearTimeout(this._endTimer);
        clearInterval(this._frameTimer);
        this.active = null;
        this.frame = 0;
      },
      // まばたき：2.5〜6秒おきに0.14秒だけ目を閉じた差分を重ねる。たまに2回続ける
      _scheduleBlink() {
        clearTimeout(this._blinkTimer);
        this._blinkTimer = setTimeout(() => {
          if (this.set && this.set.blink && !this.reduced && !this.active) {
            this.blinking = true;
            setTimeout(() => {
              this.blinking = false;
              if (Math.random() < 0.2) setTimeout(() => { this.blinking = true; setTimeout(() => { this.blinking = false; }, 120); }, 180);
            }, 140);
          }
          this._scheduleBlink();
        }, 2500 + Math.random() * 3500);
      },
    },
    template: `
      <div class="kami-motion" :class="rootClass" aria-hidden="true">
        <div class="kami-motion-base">
          <template v-if="pinchPose">
            <img class="kami-motion-layer kami-motion-idle-breathe" :src="pinchPose.frames[0]" alt="" draggable="false">
          </template>
          <template v-else>
            <img v-for="(layer, i) in layers" :key="i" class="kami-motion-layer" :class="'kami-motion-idle-' + layer.idle" :src="layer.src" alt="" draggable="false">
          </template>
          <img v-if="set && set.blink && !pinchPose" v-show="blinking" class="kami-motion-layer kami-motion-blink" :src="set.blink" alt="" draggable="false">
        </div>
        <img v-if="poseSrc" class="kami-motion-layer kami-motion-pose" :src="poseSrc" alt="" draggable="false">
        <span class="kami-motion-fx" aria-hidden="true"></span>
      </div>`,
  });
}

if (typeof module !== 'undefined') {
  module.exports = {
    KAMI_MOTION_IDLE_PRESETS, KAMI_MOTION_EVENTS, KAMI_MOTION_EMOTE_KEYS, KAMI_MOTION_SETS,
    kamiMotionSet, kamiMotionNormalizePose, kamiMotionResolvePose, kamiMotionEventForStat, kamiMotionDuration, kamiMotionUrls,
  };
}
