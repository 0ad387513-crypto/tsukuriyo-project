"use strict";
// Same-origin, read-only proxy to the fixed public production site. No credentials.
(() => {
  const files = new Set(["version.js", "index.html", "field_card_frames.js", "field_card_frames.css", "field_card_art.js", "release-history.json"]);
  async function text(file) {
    if (!files.has(file)&&!/^styles\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.css$/.test(file)) throw Error("公開情報の取得対象が不正です");
    const response = await fetch("/__production/" + file + "?check=" + Date.now(), {
      cache:"no-store", credentials:"omit", signal:AbortSignal.timeout(20000),
    });
    if (!response.ok) throw Error("本番の情報を取得できません（HTTP " + response.status + "）");
    return response.text();
  }
  function version(source) {
    const value = source.match(/TSUKURIYO_BUILD_VERSION\s*=\s*"(\d+\.\d+\.\d+)"/)?.[1];
    if (!value) throw Error("本番のバージョンを確認できません");
    return value;
  }
  const api = {text, version, base:"https://tsukuriyo-online.netlify.app/"};
  if (typeof module !== "undefined") module.exports=api;
  if (typeof window !== "undefined") window.DashboardProduction=api;
})();
