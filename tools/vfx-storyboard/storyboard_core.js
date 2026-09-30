"use strict";
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.StoryboardCore = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  const WIDTH = 1280;
  const HEIGHT = 720;
  const MIN_DURATION = 1000;
  const MAX_DURATION = 30000;
  const ASSETS = Object.freeze({
    fan: { label: "金の扇", path: "divine_assets/amenouzume-golden-fan-2cc76299100e.webp" },
    silk1: { label: "羽衣：横に広がる", path: "divine_assets/amenouzume-hagoromo-wind-poses-c0da1212d44f.webp", cell: 0 },
    silk2: { label: "羽衣：裏が返る", path: "divine_assets/amenouzume-hagoromo-wind-poses-c0da1212d44f.webp", cell: 1 },
    silk3: { label: "羽衣：縦にねじれる", path: "divine_assets/amenouzume-hagoromo-wind-poses-c0da1212d44f.webp", cell: 2 },
    silk4: { label: "羽衣：斜めに伸びる", path: "divine_assets/amenouzume-hagoromo-wind-poses-c0da1212d44f.webp", cell: 3 },
    uzume: { label: "アメノウズメ", path: "kami_cutin/amenouzume-genesis-wide-de6bb559c748.webp" },
    card: { label: "レガシー（仮）", path: "card_images/600/001.webp" }
  });
  const BACKGROUNDS = Object.freeze({
    dark: { label: "暗い舞台", path: "" },
    shinshi: { label: "神使のフィールド", path: "battle_fields/shinshi.webp" },
    forest: { label: "森のフィールド", path: "battle_fields/beast.webp" }
  });
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const round = n => Math.round(n * 100) / 100;
  const copy = value => JSON.parse(JSON.stringify(value));
  const frame = (t, x, y, scale = 1, rotation = 0, opacity = 1) => ({ t, x, y, scale, rotation, opacity });

  function example() {
    return {
      schema: "tsukuriyo-vfx-storyboard", version: 1,
      title: "アメノウズメ：椿の花吹雪と羽衣", duration: 7000, background: "dark",
      objects: [
        { id: "fan", name: "扇", type: "image", asset: "fan", width: 280, height: 280, easing: "smooth", frames: [frame(0, 640, -145, .75, -20, 0), frame(800, 585, 145, .85, -13), frame(2000, 690, 430, 1, 14), frame(2900, 610, 465, 1, -8), frame(5000, 680, 110, .8, 19), frame(7000, 650, -180, .6, -8, 0)] },
        { id: "silk", name: "羽衣：表から裏へ", type: "image", asset: "silk1", width: 500, height: 500, easing: "smooth", frames: [frame(0, 405, 630, .8, -8, 0), frame(2300, 440, 515, .9, -4, 0), frame(3200, 510, 390, 1, 3, .88), frame(5200, 820, 190, 1.1, 12, .7), frame(7000, 920, -120, 1.15, 17, 0)] },
        { id: "red", name: "赤い椿の花びら", type: "petals", color: "red", count: 14, spread: 280, width: 330, height: 260, easing: "smooth", frames: [frame(0, 360, 650, .7, 0, 0), frame(1500, 490, 520, .8, 20, .75), frame(3300, 650, 385, 1, 80), frame(5100, 760, 140, 1.2, 170), frame(7000, 890, -110, 1.3, 250, 0)] },
        { id: "white", name: "白い椿の花びら", type: "petals", color: "white", count: 12, spread: 280, width: 330, height: 260, easing: "smooth", frames: [frame(0, 900, 670, .7, 0, 0), frame(1600, 790, 500, .8, -20, .7), frame(3400, 590, 340, 1, -90), frame(5300, 490, 110, 1.2, -180), frame(7000, 430, -110, 1.3, -260, 0)] },
        { id: "wind", name: "柔らかな風", type: "wind", width: 540, height: 180, easing: "smooth", frames: [frame(0, 660, 590, .7, -20, 0), frame(2600, 660, 470, .9, -15, .15), frame(4600, 640, 300, 1.2, -8, .24), frame(7000, 630, 20, 1.4, 0, 0)] }
      ]
    };
  }
  function ease(u, mode) {
    if (mode === "hold") return 0;
    if (mode === "smooth") return u * u * (3 - 2 * u);
    return u;
  }
  function sample(object, time) {
    const frames = object.frames;
    if (!frames.length) return null;
    if (time <= frames[0].t) return copy(frames[0]);
    if (time >= frames[frames.length - 1].t) return copy(frames[frames.length - 1]);
    for (let i = 0; i < frames.length - 1; i++) {
      const a = frames[i], b = frames[i + 1];
      if (time > b.t) continue;
      if (time === b.t) return copy(b);
      const u = ease((time - a.t) / (b.t - a.t), object.easing);
      const out = { t: time };
      for (const key of ["x", "y", "scale", "rotation", "opacity"]) out[key] = round(a[key] + (b[key] - a[key]) * u);
      return out;
    }
    return copy(frames[frames.length - 1]);
  }
  function upsertFrame(object, time, patch) {
    const t = clamp(Math.round(time), 0, MAX_DURATION);
    const existing = object.frames.find(item => item.t === t);
    const target = existing || { ...sample(object, t), t };
    for (const key of ["x", "y", "scale", "rotation", "opacity"]) {
      if (patch[key] == null) continue;
      const number = Number(patch[key]);
      if (!Number.isFinite(number)) continue;
      const limits = key === "x" ? [-WIDTH, WIDTH * 2] : key === "y" ? [-HEIGHT, HEIGHT * 2] : key === "scale" ? [.05, 8] : key === "opacity" ? [0, 1] : [-3600, 3600];
      target[key] = round(clamp(number, ...limits));
    }
    if (!existing) object.frames.push(target);
    object.frames.sort((a, b) => a.t - b.t);
    return target;
  }
  function safeImage(value) {
    if (typeof value !== "string") return null;
    if (/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(value) && value.length <= 2800000) return value;
    return null;
  }
  function validate(input) {
    if (!input || input.schema !== "tsukuriyo-vfx-storyboard" || input.version !== 1 || !Array.isArray(input.objects)) throw new Error("この編集ツールの構成データではありません。");
    const duration = Number(input.duration);
    if (!Number.isInteger(duration) || duration < MIN_DURATION || duration > MAX_DURATION) throw new Error("長さは1～30秒にしてください。");
    if (input.objects.length > 80) throw new Error("オブジェクトは80個までです。");
    const ids = new Set();
    const objects = input.objects.map(raw => {
      if (!raw || typeof raw.id !== "string" || !/^[\w-]{1,60}$/.test(raw.id) || ids.has(raw.id)) throw new Error("オブジェクトIDが重複または不正です。");
      ids.add(raw.id);
      if (!["image", "petals", "wind", "text"].includes(raw.type)) throw new Error("未対応のオブジェクトがあります。");
      if (!Array.isArray(raw.frames) || !raw.frames.length || raw.frames.length > 100) throw new Error("動きの指定は各オブジェクト100点までです。");
      if (raw.asset && !ASSETS[raw.asset] && !safeImage(raw.asset)) throw new Error("画像の指定が不正です。");
      const frames = raw.frames.map(f => {
        const result = {};
        for (const key of ["t", "x", "y", "scale", "rotation", "opacity"]) {
          if (!Number.isFinite(f[key])) throw new Error("動きの数値が不正です。");
          result[key] = f[key];
        }
        if (result.t < 0 || result.t > duration || result.scale < .05 || result.scale > 8 || result.opacity < 0 || result.opacity > 1) throw new Error("動きの指定が範囲外です。");
        if (Math.abs(result.x) > WIDTH * 2 || Math.abs(result.y) > HEIGHT * 2 || Math.abs(result.rotation) > 3600) throw new Error("位置や回転が範囲外です。");
        return result;
      }).sort((a, b) => a.t - b.t);
      if (frames.some((f, i) => i && f.t === frames[i - 1].t)) throw new Error("同じ時刻の指定が重複しています。");
      return {
        id: raw.id, name: String(raw.name || "オブジェクト").slice(0, 60), type: raw.type,
        asset: raw.asset || "", color: raw.color === "white" ? "white" : "red",
        text: String(raw.text || "").slice(0, 100), count: clamp(Math.round(Number(raw.count) || 12), 1, 40),
        spread: clamp(Math.round(Number(raw.spread) || 250), 10, 800),
        width: clamp(Math.round(Number(raw.width) || 200), 10, 1200),
        height: clamp(Math.round(Number(raw.height) || 200), 10, 1000),
        easing: ["linear", "smooth", "hold"].includes(raw.easing) ? raw.easing : "smooth", frames
      };
    });
    return { schema: "tsukuriyo-vfx-storyboard", version: 1, title: String(input.title || "無題の演出").slice(0, 100), duration, background: BACKGROUNDS[input.background] ? input.background : "dark", objects };
  }
  function instructions(project) {
    const seconds = n => (n / 1000).toFixed(2).replace(/\.00$/, "");
    const lines = [`演出：${project.title}`, `画面：1280×720 / 全体 ${seconds(project.duration)} 秒 / 背景：${BACKGROUNDS[project.background]?.label || "暗い舞台"}`, "※位置は画面左上を(0,0)、中央を(640,360)とした座標です。", ""];
    for (const object of project.objects) {
      lines.push(`■ ${object.name}（${object.type === "image" ? ASSETS[object.asset]?.label || "持ち込み画像" : object.type === "petals" ? `${object.color === "red" ? "赤" : "白"}の花びら ${object.count}枚` : object.type === "wind" ? "風" : "文字"}、移動：${object.easing}）`);
      for (const f of object.frames) lines.push(`  ${seconds(f.t)}秒：位置(${Math.round(f.x)}, ${Math.round(f.y)})、大きさ${Math.round(f.scale * 100)}%、角度${Math.round(f.rotation)}°、見え方${Math.round(f.opacity * 100)}%`);
      lines.push("");
    }
    return lines.join("\n");
  }
  return { WIDTH, HEIGHT, MIN_DURATION, MAX_DURATION, ASSETS, BACKGROUNDS, clamp, copy, frame, example, sample, upsertFrame, validate, instructions };
});
