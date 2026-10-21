"use strict";
// Use the published CSS, card markup and renderer inside a ShadowRoot.
// No Vue/game startup code or authentication is executed.
(() => {
  const production=window.DashboardProduction;
  let live=null, loading=null, historyCss=null, sequence=0, oldLoader=null;
  const mounted=new Set();
  const sharedSheets=new Map();
  function rebaseCss(css, base=production.base) {
    return css.replace(/url\(\s*(?:(["'])(.*?)\1|([^)]*))\s*\)/g,(all,_q,quoted,plain)=>{
      const value=(quoted??plain).trim();
      return /^(?:data:|#)/i.test(value) ? all : 'url("'+new URL(value,base).href+'")';
    }).replace(/:root\b/g,":host");
  }
  function cleanTemplate(node) {
    const copy=node.cloneNode(true);
    for (const child of [...copy.children]) if (!child.matches(".token-art,.field-kind-frame,.battle-card-cost,.battle-card-attack,.battle-card-power")) child.remove();
    for (const el of [copy,...copy.querySelectorAll("*")]) {
      for (const attr of [...el.attributes]) if (/^(?:v-|:|@|on)/i.test(attr.name)) el.removeAttribute(attr.name);
      if (el.matches("script,iframe,object,embed,link")) el.remove();
    }
    return copy;
  }
  function templates(doc) {
    const cards=[...doc.querySelectorAll(".battle-card.field-card")];
    const legacy=cards.find(el=>el.querySelector(".battle-card-power"));
    const relic=cards.find(el=>!el.querySelector(".battle-card-power")&&el.querySelector(".field-kind-frame"));
    if (!legacy||!relic) throw Error("本番のカード構造が変わりました。確認が必要です");
    return {legacy:cleanTemplate(legacy),relic:cleanTemplate(relic)};
  }
  async function renderer(version) {
    const iframe=document.createElement("iframe");
    iframe.hidden=true;iframe.title="カード枠の描画処理";iframe.setAttribute("aria-hidden","true");
    const loaded=new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(Error("描画処理の取得がタイムアウトしました")),20000);
      iframe.onload=()=>{
        const api=iframe.contentWindow;
        clearTimeout(timeout);
        if (typeof api.fieldCardFrameForCard!=="function"||typeof api.fieldCardArtStyle!=="function") reject(Error("本番の描画処理を取得できません"));
        else resolve(api);
      };
    });
    const v=encodeURIComponent(version)+"-"+Date.now();
    iframe.srcdoc='<!doctype html><meta charset="utf-8"><script src="/__production/field_card_frames.js?v='+v+'"><\/script><script src="/__production/field_card_art.js?v='+v+'"><\/script>';
    document.body.append(iframe);
    try {return {api:await loaded,iframe};} catch(error) {iframe.remove();throw error;}
  }
  async function refresh(force=false) {
    if (loading) return loading;
    loading=(async()=>{
      const version=production.version(await production.text("version.js"));
      if (!force&&live?.version===version) return live;
      const html=await production.text("index.html");
      // Template contents stay inert: parsing the game must not preload its images or run it.
      const inert=document.createElement("template");inert.innerHTML=html;
      const doc=inert.content;
      const external=[...doc.querySelectorAll('link[rel~="stylesheet"]')].map(link=>new URL(link.getAttribute("href"),production.base)).filter(url=>url.origin===new URL(production.base).origin&&url.pathname.endsWith(".css"));
      const sheets=await Promise.all(external.map(async url=>rebaseCss(await production.text("styles/"+url.pathname.slice(1)),url.href)));
      const loader=await renderer(version);
      try {
        const css=[...doc.querySelectorAll("style")].map(el=>el.textContent).join("\n");
        if (!css.includes(".battle-card-cost")||!css.includes(".battle-card-attack")) throw Error("本番のカードCSSを確認できません");
        const next={version,css:rebaseCss(css)+"\n"+sheets.join("\n"),templates:templates(doc),api:loader.api};
        if (production.version(await production.text("version.js"))!==version) throw Error("本番の公開中です。少し待って更新してください");
        const previous=oldLoader;live=next;oldLoader=loader.iframe;sharedSheets.clear();
        if(previous) previous.remove();
        return live;
      } catch(error) {loader.iframe.remove();throw error;}
    })().finally(()=>{loading=null;});
    return loading;
  }
  const layoutCss=`
    :host{display:block;position:relative;color:#eee;font-family:'Hiragino Sans','Meiryo',sans-serif;overflow:visible}
    .sample-layout{position:static!important;display:block!important;width:auto!important;height:auto!important;min-height:0!important;margin:0!important;padding:0!important;background:transparent!important;border:0!important;overflow:visible!important}
    .sample-layout .sample-zone,.sample-layout .sample-row{position:static!important;display:flex!important;align-items:center!important;width:auto!important;height:auto!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important;overflow:visible!important;flex:none!important}
    .sample-layout .sample-zone{translate:none!important;transform:none!important}
    .preview-motion-off *{animation:none!important}
    @media(prefers-reduced-motion:reduce){.sample-layout *{animation:none!important}}
  `;
  async function archiveCss() {
    if (!historyCss) historyCss=fetch("historical_battle.css",{cache:"no-cache"}).then(r=>{if(!r.ok)throw Error("以前の採用版を取得できません");return r.text();});
    return historyCss;
  }
  function makePool(card) {
    const value={...card,isToken:card.kind==="token",type:card.kind==="dragon"?"龍":card.type};
    return {value,pool:card.kind==="basic"?[value,{...value,no:String(card.no)+"-basic-copy"}]:[value]};
  }
  async function mount(host, card, design, state, settings={}) {
    const entry={host};mounted.add(entry);
    host.classList.add("actual-card-host");
    const root=host.attachShadow({mode:"open"});
    const pending=document.createElement("span");pending.textContent="本番の表示を読み込み中…";root.append(pending);
    try {
      const source=live||await refresh(),isHistoric=design!=="current";
      if(!host.isConnected){mounted.delete(entry);return;}
      const css=(isHistoric?await archiveCss():source.css)+"\n"+layoutCss;
      const layout=document.createElement("div");layout.className="battle-layout-v2 sample-layout"+(settings.motion?"":" preview-motion-off");layout.style.zoom=String(settings.scale||1);
      const zone=document.createElement("div");zone.className="battle-zone field sample-zone "+(card.category==="レリック"?"self-relic-drop":"legacy-field");
      const row=document.createElement("div");row.className="battle-card-row sample-row";row.style.setProperty("--n","1");
      const node=source.templates[card.category==="レリック"?"relic":"legacy"].cloneNode(true);
      const attrs={赤:"red",青:"blue",緑:"green",黄:"yellow",紫:"purple",無:"colorless",創:"genesis"};
      node.classList.add("frame-"+(attrs[card.color]||"colorless"));
      node.dataset.fieldKind=card.kind;node.setAttribute("role","button");node.tabIndex=0;
      node.setAttribute("aria-label",(card.nickname?card.nickname+"・":"")+card.name);
      node.classList.toggle("tapped",state==="tapped");node.classList.toggle("effect-disabled",state==="disabled");node.classList.toggle("legacy-action-both",state==="ready");
      const image=new URL(card.image.replace(/^\.\.\//,""),production.base).href;
      const art=node.querySelector(".token-art");
      Object.assign(art.style,source.api.fieldCardArtStyle(card,image));
      const wide=art.querySelector(".token-art-wide");
      if(source.api.fieldCardArtCrop(card)?.wide) {if(wide)wide.style.backgroundImage='url("'+image+'")';} else wide?.remove();
      const frame=node.querySelector(".field-kind-frame");
      if(isHistoric) frame.innerHTML=window.largeFieldFrame(card.kind,design,card.category==="レリック"?"octagon":"portrait");
      else {const {value,pool}=makePool(card);frame.innerHTML=source.api.fieldCardFrameForCard(value,pool,"dashboard-"+(++sequence));}
      for(const img of frame.querySelectorAll("img[src]")) img.src=new URL(img.getAttribute("src"),production.base).href;
      for(const [selector,value] of [[".battle-card-cost",card.cost],[".battle-card-attack",card.attack||0],[".battle-card-power",card.power||0]]) {
        const stat=node.querySelector(selector);if(!stat)continue;
        for(const text of [...stat.childNodes]) if(text.nodeType===3)text.remove();
        stat.append(document.createTextNode(String(value)));
      }
      row.append(node);zone.append(row);layout.append(zone);
      if("adoptedStyleSheets" in root&&typeof CSSStyleSheet!=="undefined") {
        let sheet=sharedSheets.get(css);if(!sheet){sheet=new CSSStyleSheet();sheet.replaceSync(css);sharedSheets.set(css,sheet);}
        root.adoptedStyleSheets=[sheet];root.replaceChildren(layout);
      } else {const style=document.createElement("style");style.textContent=css;root.replaceChildren(style,layout);}
      const measure=()=>{if(!host.isConnected){entry.observer?.disconnect();mounted.delete(entry);return;}const box=node.getBoundingClientRect();host.style.width=box.width+"px";host.style.height=box.height+"px";};
      entry.observer=new ResizeObserver(measure);entry.observer.observe(node);requestAnimationFrame(measure);
    } catch(error) {pending.textContent="表示を取得できません："+error.message;host.classList.add("actual-card-error");}
  }
  function dispose() {for(const item of mounted)if(!item.host.isConnected){item.observer?.disconnect();mounted.delete(item);}}
  window.LiveBattlePreview={refresh,mount,dispose};
  if(typeof module!=="undefined")module.exports={rebaseCss,makePool,layoutCss};
})();
