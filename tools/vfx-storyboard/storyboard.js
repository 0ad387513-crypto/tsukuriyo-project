"use strict";
(() => {
  const C = window.StoryboardCore;
  const $ = id => document.getElementById(id);
  const STORAGE_KEY = "tsukuriyo-vfx-storyboard-v1";
  const icon = { image: "▣", petals: "❀", wind: "〰", text: "字" };
  let project;
  try { project = C.validate(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
  catch { project = C.example(); }
  let selectedId = project.objects[0]?.id || null;
  const savedTime = localStorage.getItem(STORAGE_KEY + "-time");
  let time = C.clamp(savedTime !== null && Number.isFinite(Number(savedTime)) ? Number(savedTime) : 3200, 0, project.duration);
  let playing = false;
  let lastTick = 0;
  let stageScale = 1;
  let drag = null;
  let history = [];
  let future = [];
  const objectElements = new Map();

  function current() { return project.objects.find(o => o.id === selectedId) || null; }
  function status(message) { $("saveState").textContent = message; }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(project)); status("このブラウザーに自動保存しました"); }
    catch { status("自動保存できません。設計データを保存してください"); }
  }
  function snapshot() {
    history.push(C.copy(project));
    if (history.length > 30) history.shift();
    future = [];
    $("undo").disabled = false;
    $("redo").disabled = true;
  }
  function undo() {
    if (!history.length) return;
    future.push(C.copy(project));
    project = history.pop();
    if (!project.objects.some(o => o.id === selectedId)) selectedId = project.objects[0]?.id || null;
    time = Math.min(time, project.duration);
    refresh(); save();
  }
  function redo() {
    if (!future.length) return;
    history.push(C.copy(project));
    project = future.pop();
    refresh(); save();
  }
  function stopPlayback() {
    const wasPlaying = playing;
    playing = false;
    $("play").textContent = "▶ 再生";
    if (wasPlaying) { renderScene(); renderProperties(); }
  }
  function setTime(next) {
    time = C.clamp(Math.round(next), 0, project.duration);
    if (!playing) { try { localStorage.setItem(STORAGE_KEY + "-time", String(time)); } catch {} }
    $("timeDisplay").textContent = `${(time / 1000).toFixed(2)} / ${(project.duration / 1000).toFixed(2)} 秒`;
    $("selectedTime").textContent = `${(time / 1000).toFixed(2)} 秒`;
    $("playhead").style.left = `${time / project.duration * 100}%`;
    renderScene();
    if (!playing) renderProperties();
  }
  function assetUrl(asset) {
    if (asset?.startsWith("data:image/")) return asset;
    return C.ASSETS[asset] ? "../../" + C.ASSETS[asset].path : "";
  }
  function setVisual(el, object) {
    el.replaceChildren();
    el.className = `scene-object ${object.type}${object.type === "petals" ? " " + object.color : ""}`;
    el.dataset.id = object.id;
    if (object.type === "image") {
      const info = C.ASSETS[object.asset];
      el.style.backgroundImage = `url(${JSON.stringify(assetUrl(object.asset))})`;
      el.style.backgroundSize = info?.cell == null ? "contain" : "200% 200%";
      el.style.backgroundPosition = info?.cell == null ? "center" : `${info.cell % 2 * 100}% ${Math.floor(info.cell / 2) * 100}%`;
    } else if (object.type === "petals") {
      for (let i = 0; i < object.count; i++) {
        const petal = document.createElement("span");
        petal.className = "petal";
        const angle = i * 2.399963;
        const radius = Math.sqrt((i + .35) / object.count) * object.spread / 2;
        const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius * .62;
        petal.style.left = `${object.width / 2 + x - 21}px`;
        petal.style.top = `${object.height / 2 + y - 14}px`;
        petal.style.transform = `rotate(${(i * 137) % 360}deg) scale(${.7 + i % 4 * .12})`;
        el.append(petal);
      }
    } else if (object.type === "text") {
      el.textContent = object.text || "文字を入力";
    }
  }
  function buildScene() {
    const content = $("sceneContent");
    content.replaceChildren(); objectElements.clear();
    for (const object of project.objects) {
      const el = document.createElement("div");
      setVisual(el, object);
      content.append(el);
      objectElements.set(object.id, el);
    }
    renderScene();
  }
  function renderScene() {
    for (const object of project.objects) {
      const el = objectElements.get(object.id);
      if (!el) continue;
      const f = C.sample(object, time);
      el.style.left = f.x + "px";
      el.style.top = f.y + "px";
      el.style.width = object.width + "px";
      el.style.height = object.height + "px";
      el.style.opacity = f.opacity;
      el.style.transform = `translate(-50%,-50%) rotate(${f.rotation}deg) scale(${f.scale})`;
      el.style.zIndex = String(project.objects.indexOf(object) + 1);
    }
    const object = current();
    const guide = $("selectionGuide");
    guide.hidden = !object || playing;
    if (object && !playing) {
      const f = C.sample(object, time);
      guide.style.left = `${f.x / C.WIDTH * 100}%`;
      guide.style.top = `${f.y / C.HEIGHT * 100}%`;
      guide.style.width = `${object.width * f.scale / C.WIDTH * 100}%`;
      guide.style.height = `${object.height * f.scale / C.HEIGHT * 100}%`;
      guide.style.transform = `translate(-50%,-50%) rotate(${f.rotation}deg)`;
    }
  }
  function renderObjectList() {
    const list = $("objectList"); list.replaceChildren();
    for (const object of [...project.objects].reverse()) {
      const button = document.createElement("button");
      button.type = "button"; button.className = "object-row" + (selectedId === object.id ? " active" : "");
      button.setAttribute("role", "option"); button.setAttribute("aria-selected", selectedId === object.id ? "true" : "false");
      const mark = document.createElement("span"); mark.className = "object-icon"; mark.textContent = icon[object.type];
      const name = document.createElement("span"); name.className = "object-label"; name.textContent = object.name;
      const kind = document.createElement("span"); kind.className = "object-kind"; kind.textContent = object.type === "petals" ? `${object.count}枚` : "";
      button.append(mark, name, kind);
      button.addEventListener("click", () => selectObject(object.id));
      list.append(button);
    }
    $("objectCount").textContent = `${project.objects.length} 個`;
    for (const id of ["raiseObject", "lowerObject", "duplicateObject", "deleteObject"]) $(id).disabled = !current();
  }
  function renderTimeline() {
    const ruler = $("ruler"); ruler.replaceChildren();
    const tickMs = project.duration <= 12000 ? 500 : project.duration <= 20000 ? 1000 : 2000;
    for (let t = 0; t <= project.duration; t += tickMs) {
      const tick = document.createElement("span");
      tick.className = "tick" + (t % (tickMs * 2) === 0 ? " major" : "");
      tick.style.left = `${t / project.duration * 100}%`;
      ruler.append(tick);
      if (t % (tickMs * 2) === 0) {
        const label = document.createElement("span"); label.className = "tick-label";
        label.style.left = tick.style.left; label.textContent = `${t / 1000}s`; ruler.append(label);
      }
    }
    const tracks = $("tracks"); tracks.replaceChildren();
    for (const object of [...project.objects].reverse()) {
      const row = document.createElement("div"); row.className = "track-row" + (object.id === selectedId ? " selected" : "");
      const name = document.createElement("div"); name.className = "track-name"; name.textContent = object.name; name.title = object.name;
      name.addEventListener("click", () => selectObject(object.id));
      const line = document.createElement("div"); line.className = "track-line"; line.title = "クリックで時間を移動、ダブルクリックで◆を追加";
      line.addEventListener("click", event => {
        if (event.target.closest(".keyframe")) return;
        selectObject(object.id);
        setTime((event.clientX - line.getBoundingClientRect().left) / line.clientWidth * project.duration);
      });
      line.addEventListener("dblclick", event => {
        if (event.target.closest(".keyframe")) return;
        selectObject(object.id);
        const t = Math.round((event.clientX - line.getBoundingClientRect().left) / line.clientWidth * project.duration / 50) * 50;
        setTime(t); addFrame();
      });
      for (const f of object.frames) {
        const point = document.createElement("button"); point.type = "button"; point.className = "keyframe" + (f.t === time ? " current" : "");
        point.style.left = `${f.t / project.duration * 100}%`;
        point.title = `${(f.t / 1000).toFixed(2)}秒: ${object.name}`;
        point.setAttribute("aria-label", point.title);
        point.addEventListener("click", event => { event.stopPropagation(); selectObject(object.id); stopPlayback(); setTime(f.t); renderTimeline(); });
        line.append(point);
      }
      row.append(name, line); tracks.append(row);
    }
    const playhead = $("playhead");
    playhead.style.top = `-${tracks.clientHeight + 31}px`;
    playhead.style.height = `${tracks.clientHeight + 31}px`;
    playhead.style.left = `${time / project.duration * 100}%`;
  }
  function renderProperties() {
    const object = current();
    $("emptySelection").hidden = !!object;
    $("propertyPanel").hidden = !object;
    if (!object) return;
    const f = C.sample(object, time);
    $("propName").value = object.name;
    $("imageProperties").hidden = object.type !== "image";
    $("petalProperties").hidden = object.type !== "petals";
    $("textProperties").hidden = object.type !== "text";
    if (object.type === "image") $("propAsset").value = C.ASSETS[object.asset] ? object.asset : "__custom__";
    $("propCount").value = object.count;
    $("propSpread").value = object.spread;
    $("propText").value = object.text;
    $("propWidth").value = object.width;
    $("propHeight").value = object.height;
    $("propEasing").value = object.easing;
    $("propX").value = Math.round(f.x);
    $("propY").value = Math.round(f.y);
    $("propScale").value = Math.round(f.scale * 100);
    $("propRotation").value = Math.round(f.rotation);
    $("propOpacity").value = Math.round(f.opacity * 100);
    $("opacityValue").textContent = `${Math.round(f.opacity * 100)}%`;
    const exact = object.frames.some(item => item.t === time);
    $("frameStatus").textContent = exact ? "◆ 記録済み" : "点の間を表示中";
    $("deleteFrame").disabled = !exact || object.frames.length === 1;
  }
  function refresh() {
    $("projectTitle").value = project.title;
    $("background").value = project.background;
    $("duration").value = project.duration / 1000;
    const bg = C.BACKGROUNDS[project.background]?.path;
    $("scene").style.backgroundImage = bg ? `linear-gradient(#05050a8c,#05050a9a),url(${JSON.stringify("../../" + bg)})` : "";
    $("scene").style.backgroundSize = bg ? "cover" : "";
    $("scene").style.backgroundPosition = "center";
    buildScene(); renderObjectList(); renderTimeline(); setTime(time);
    $("undo").disabled = !history.length;
    $("redo").disabled = !future.length;
  }
  function selectObject(id) { selectedId = id; renderObjectList(); renderTimeline(); renderProperties(); renderScene(); }
  function uniqueId() { return "item-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7); }
  function addObject(kind, customImage) {
    if (project.objects.length >= 80) return alert("オブジェクトは80個までです。");
    stopPlayback(); snapshot();
    const type = kind === "red" || kind === "white" ? "petals" : kind === "wind" ? "wind" : kind === "text" ? "text" : "image";
    const name = kind === "red" ? "赤い椿の花びら" : kind === "white" ? "白い椿の花びら" : kind === "wind" ? "風" : kind === "text" ? "文字" : customImage ? "持ち込み画像" : C.ASSETS[kind]?.label || "画像";
    const x = 640, y = 360;
    const visible = C.frame(time, x, y);
    const frames = time ? [C.frame(0, x, y, 1, 0, 0), visible] : [visible];
    const object = { id: uniqueId(), name, type, asset: customImage || (type === "image" ? kind : ""), color: kind === "white" ? "white" : "red", text: "文字を入力", count: 12, spread: 260, width: type === "petals" ? 320 : type === "wind" ? 520 : type === "text" ? 320 : 300, height: type === "petals" ? 250 : type === "wind" ? 170 : type === "text" ? 90 : 300, easing: "smooth", frames };
    project.objects.push(object); selectedId = object.id;
    refresh(); save();
  }
  function addFrame() {
    const object = current(); if (!object) return;
    if (object.frames.some(f => f.t === time)) { status("この時刻には既に◆があります"); return; }
    snapshot(); C.upsertFrame(object, time, {}); renderTimeline(); renderProperties(); save();
  }
  function editFrame(patch) {
    const object = current(); if (!object) return;
    C.upsertFrame(object, time, patch);
    renderScene(); renderTimeline(); renderProperties(); save();
  }
  function moveSelected(delta) {
    const object = current(); if (!object) return;
    const index = project.objects.indexOf(object);
    const destination = C.clamp(index + delta, 0, project.objects.length - 1);
    if (index === destination) return;
    snapshot(); project.objects.splice(index, 1); project.objects.splice(destination, 0, object); refresh(); save();
  }
  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement("a"); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function fileName(extension) { return (project.title.trim().replace(/[\\/:*?"<>|]/g, "_").slice(0, 35) || "演出設計") + extension; }

  for (const [id, entry] of Object.entries(C.BACKGROUNDS)) {
    const option = document.createElement("option"); option.value = id; option.textContent = entry.label; $("background").append(option);
  }
  for (const [id, entry] of Object.entries(C.ASSETS)) {
    const option = document.createElement("option"); option.value = id; option.textContent = entry.label; $("propAsset").append(option);
  }
  const customOption = document.createElement("option"); customOption.value = "__custom__"; customOption.textContent = "持ち込み画像"; customOption.disabled = true; $("propAsset").append(customOption);
  document.querySelectorAll("[data-add]").forEach(button => button.addEventListener("click", () => addObject(button.dataset.add)));
  $("addImage").addEventListener("click", () => $("imageFile").click());
  $("imageFile").addEventListener("change", async event => {
    const file = event.target.files[0]; event.target.value = "";
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 1900000) return alert("PNG・JPEG・WebPの画像を1.9MB以下で選んでください。");
    const reader = new FileReader();
    reader.onload = () => addObject("image", String(reader.result));
    reader.readAsDataURL(file);
  });
  $("scene").addEventListener("pointerdown", event => {
    const element = event.target.closest(".scene-object");
    const guide = event.target.closest(".selection-guide");
    if (!element && !guide) return;
    stopPlayback(); if (element) selectObject(element.dataset.id);
    const object = current(), f = C.sample(object, time), rect = $("scene").getBoundingClientRect();
    snapshot();
    drag = { pointerId: event.pointerId, object, startX: (event.clientX - rect.left) * C.WIDTH / rect.width, startY: (event.clientY - rect.top) * C.HEIGHT / rect.height, x: f.x, y: f.y };
    $("scene").setPointerCapture(event.pointerId);
    element?.classList.add("dragging");
    event.preventDefault();
  });
  $("scene").addEventListener("pointermove", event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const rect = $("scene").getBoundingClientRect();
    const x = (event.clientX - rect.left) * C.WIDTH / rect.width;
    const y = (event.clientY - rect.top) * C.HEIGHT / rect.height;
    C.upsertFrame(drag.object, time, { x: drag.x + x - drag.startX, y: drag.y + y - drag.startY });
    renderScene(); renderProperties();
  });
  function finishDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    objectElements.get(drag.object.id)?.classList.remove("dragging");
    drag = null; renderTimeline(); save();
  }
  $("scene").addEventListener("pointerup", finishDrag);
  $("scene").addEventListener("pointercancel", finishDrag);
  $("ruler").addEventListener("pointerdown", event => { stopPlayback(); const rect = $("ruler").getBoundingClientRect(); setTime((event.clientX - rect.left) / rect.width * project.duration); renderTimeline(); });
  $("play").addEventListener("click", () => { if (playing) { stopPlayback(); return; } if (time >= project.duration) setTime(0); playing = true; $("play").textContent = "Ⅱ 一時停止"; lastTick = performance.now(); renderScene(); requestAnimationFrame(tick); });
  $("stop").addEventListener("click", () => { stopPlayback(); setTime(0); renderTimeline(); });
  function tick(now) {
    if (!playing) return;
    const elapsed = Math.min(100, now - lastTick); lastTick = now;
    setTime(time + elapsed);
    if (time >= project.duration) { stopPlayback(); renderTimeline(); return; }
    requestAnimationFrame(tick);
  }
  $("undo").addEventListener("click", undo); $("redo").addEventListener("click", redo);
  $("showGuides").addEventListener("change", event => { $("sceneGuides").hidden = !event.target.checked; });
  $("raiseObject").addEventListener("click", () => moveSelected(1));
  $("lowerObject").addEventListener("click", () => moveSelected(-1));
  $("duplicateObject").addEventListener("click", () => {
    const object = current(); if (!object || project.objects.length >= 80) return;
    snapshot(); const twin = C.copy(object); twin.id = uniqueId(); twin.name += "（複製）";
    twin.frames.forEach(f => { f.x += 35; f.y += 25; });
    project.objects.push(twin); selectedId = twin.id; refresh(); save();
  });
  $("deleteObject").addEventListener("click", () => {
    const object = current(); if (!object) return;
    snapshot(); project.objects = project.objects.filter(o => o !== object);
    selectedId = project.objects.at(-1)?.id || null; refresh(); save();
  });
  $("addFrame").addEventListener("click", addFrame);
  $("deleteFrame").addEventListener("click", () => {
    const object = current(); if (!object || object.frames.length <= 1) return;
    const index = object.frames.findIndex(f => f.t === time); if (index < 0) return;
    snapshot(); object.frames.splice(index, 1); renderTimeline(); renderProperties(); renderScene(); save();
  });
  const staticProps = { propName: "name", propWidth: "width", propHeight: "height", propCount: "count", propSpread: "spread", propText: "text", propEasing: "easing", propAsset: "asset" };
  for (const [id, key] of Object.entries(staticProps)) $(id).addEventListener("change", event => {
    const object = current(); if (!object) return;
    if (id === "propAsset" && event.target.value === "__custom__") return;
    snapshot();
    let value = event.target.value;
    if (["width", "height", "count", "spread"].includes(key)) value = C.clamp(Math.round(Number(value) || 1), key === "count" ? 1 : 10, key === "width" ? 1200 : key === "height" ? 1000 : key === "count" ? 40 : 800);
    object[key] = value;
    buildScene(); renderObjectList(); renderTimeline(); renderProperties(); save();
  });
  const frameProps = { propX: ["x", 1], propY: ["y", 1], propScale: ["scale", .01], propRotation: ["rotation", 1], propOpacity: ["opacity", .01] };
  for (const [id, [key, multiplier]] of Object.entries(frameProps)) {
    const el = $(id); let session = false;
    el.addEventListener("focus", () => { session = false; });
    el.addEventListener("input", () => {
      if (!current()) return;
      if (!session) { snapshot(); session = true; }
      const value = Number(el.value);
      if (Number.isFinite(value)) editFrame({ [key]: value * multiplier });
    });
    el.addEventListener("blur", () => { session = false; renderProperties(); });
  }
  $("projectTitle").addEventListener("change", event => { snapshot(); project.title = event.target.value.trim().slice(0, 100) || "無題の演出"; save(); });
  $("background").addEventListener("change", event => { snapshot(); project.background = event.target.value; refresh(); save(); });
  $("duration").addEventListener("change", event => {
    const value = Math.round(Number(event.target.value) * 1000);
    if (!Number.isFinite(value)) return refresh();
    snapshot(); project.duration = C.clamp(value, C.MIN_DURATION, C.MAX_DURATION);
    for (const object of project.objects) object.frames = object.frames.filter(f => f.t <= project.duration).length ? object.frames.filter(f => f.t <= project.duration) : [{ ...object.frames[0], t: project.duration }];
    time = Math.min(time, project.duration); refresh(); save();
  });
  $("exportProject").addEventListener("click", () => download(fileName(".json"), JSON.stringify(project, null, 2), "application/json"));
  $("importProject").addEventListener("click", () => $("projectFile").click());
  $("projectFile").addEventListener("change", async event => {
    const file = event.target.files[0]; event.target.value = ""; if (!file) return;
    if (file.size > 8500000) return alert("設計データは8.5MB以下にしてください。");
    try {
      const loaded = C.validate(JSON.parse(await file.text()));
      stopPlayback(); snapshot(); project = loaded; time = 0; selectedId = project.objects[0]?.id || null; refresh(); save();
    } catch (error) { alert("開けませんでした：" + error.message); }
  });
  $("copyInstructions").addEventListener("click", async () => {
    const text = C.instructions(project);
    try { await navigator.clipboard.writeText(text); status("指示文をコピーしました。会話に貼り付けてください"); }
    catch { download(fileName("-指示文.txt"), text, "text/plain"); status("指示文をテキストで保存しました"); }
  });
  $("resetExample").addEventListener("click", () => {
    if (!confirm("現在の設計を見本に戻しますか？ 今の内容は「設計データを保存」で残せます。")) return;
    stopPlayback(); snapshot(); project = C.example(); selectedId = project.objects[0].id; time = 0; refresh(); save();
  });
  window.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); }
    if (event.code === "Space" && !["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(document.activeElement?.tagName)) { event.preventDefault(); $("play").click(); }
  });
  function resizeStage() { stageScale = $("scene").clientWidth / C.WIDTH; $("sceneContent").style.transform = `scale(${stageScale})`; }
  new ResizeObserver(resizeStage).observe($("scene"));
  resizeStage(); refresh();
})();
