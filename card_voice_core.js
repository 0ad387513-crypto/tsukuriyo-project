"use strict";
/* カード音声は盤面・通信・効果解決から独立させる。再生終了をゲーム進行の条件にしない。 */
const CardVoiceCore = (() => {
  function clipsFor(manifest, card, event) {
    const no = String(Number(card && card.no));
    return (manifest && manifest.cards && manifest.cards[no] && manifest.cards[no][event]) || [];
  }
  function pairFor(manifest, card, side, battle, used) {
    const no = String(Number(card && card.no));
    return ((manifest && manifest.pairs) || []).find(pair => {
      if (!pair.who.includes(no) || used.has(pair.id)) return false;
      const targetSide = pair.kind === 'rival' ? (side === 'self' ? 'opp' : 'self') : side;
      const field = battle && battle[targetSide];
      return field && (field.legacies || []).some(c => c !== card && pair.target.includes(String(Number(c.no))));
    });
  }
  function fieldSnapshot(battle) {
    const result = {};
    for (const side of ['self', 'opp']) {
      const p = (battle && battle[side]) || {};
      result[side] = { field: (p.legacies || []).slice(), left: [...(p.graveyard || []), ...(p.crumbled || [])] };
    }
    return result;
  }
  // バウンス・進化・初回同期を死亡と誤認しない。実際に墓地/崩壊が増えたものだけ。
  function remoteDeaths(before, battle) {
    const counts = list => list.reduce((m, c) => { const n = String(Number(c.no)); m[n] = (m[n] || 0) + 1; return m; }, {});
    const after = fieldSnapshot(battle), result = [];
    for (const side of ['self', 'opp']) {
      const old = before[side], now = after[side];
      const oldField = counts(old.field), newField = counts(now.field), oldLeft = counts(old.left), newLeft = counts(now.left);
      for (const no of Object.keys(oldField)) {
        const lost = Math.min(oldField[no] - (newField[no] || 0), (newLeft[no] || 0) - (oldLeft[no] || 0));
        if (lost > 0) result.push({ side, card: old.field.find(c => String(Number(c.no)) === no) });
      }
    }
    return result;
  }
  function createPlayer({ makeAudio, url = s => s, volume, canPlay, busy = () => false, onActive = () => {}, now = Date.now,
    timer = setTimeout, untimer = clearTimeout }) {
    let queue = [], current = null, draining = false, generation = 0, active = false;
    function setActive(value) { if (active !== value) { active = value; onActive(value); } }
    const stop = () => {
      generation++; queue = [];
      if (current) current.finish(false);
      setActive(false);
    };
    async function drain() {
      if (draining) return;
      draining = true;
      const run = generation;
      try {
        while (queue.length && run === generation) {
          const item = queue.shift();
          if (now() - item.at > 4000 || !canPlay() || busy() || !(volume() > 0)) continue;
          for (const clip of item.clips) {
            if (run !== generation || !canPlay() || busy() || !(volume() > 0)) break;
            await new Promise(resolve => {
              let audio, timeout, finished = false;
              const finish = () => {
                if (finished) return;
                finished = true; untimer(timeout);
                if (audio) {
                  for (const event of ['ended', 'error', 'pause']) audio.removeEventListener(event, finish);
                  try { audio.pause(); } catch (_) { /* noop */ }
                }
                current = null; setActive(false); resolve();
              };
              try {
                audio = makeAudio(url(clip.src)); audio.volume = volume(); audio.preload = 'none';
                current = { audio, finish };
                for (const event of ['ended', 'error', 'pause']) audio.addEventListener(event, finish);
                // stalled/自動再生拒否でもキューやBGMを永久に保持しない。
                timeout = timer(finish, 12000); setActive(true);
                const started = audio.play();
                if (started && started.catch) started.catch(finish);
              } catch (_) { finish(); }
            });
          }
        }
      } finally {
        draining = false;
        if (queue.length) drain();
      }
    }
    return {
      enqueue(clips) {
        if (!clips || !clips.length || !canPlay() || busy() || !(volume() > 0)) return false;
        queue.push({ clips, at: now() });
        if (queue.length > 3) queue.shift();
        drain(); return true;
      },
      stop,
      setVolume() {
        if (!(volume() > 0)) { stop(); return; }
        if (current) current.audio.volume = volume();
      },
    };
  }
  return { clipsFor, pairFor, fieldSnapshot, remoteDeaths, createPlayer };
})();
if (typeof module !== 'undefined') module.exports = CardVoiceCore;
