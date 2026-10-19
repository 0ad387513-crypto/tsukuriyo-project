"use strict";

function filterReleaseEntries(entries, query, author) {
  const needle = query.trim().toLocaleLowerCase("ja");
  return entries.filter(entry => (!author || entry.author === author) &&
    [entry.title, entry.version, entry.author, ...(entry.changes || [])].join(" ").toLocaleLowerCase("ja").includes(needle));
}

if (typeof module !== "undefined") module.exports = { filterReleaseEntries };
if (typeof document !== "undefined") (async () => {
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text) node.textContent = text; return node; };
  const status = $("history-status"), list = $("history-list"), more = $("history-more");
  const dates = new Intl.DateTimeFormat("ja-JP", { dateStyle:"medium", timeStyle:"short", timeZone:"Asia/Tokyo" });
  try {
    const response = await fetch("/tools/hub/release-history.json", { cache:"no-store" });
    if (!response.ok) throw Error("HTTP " + response.status);
    const data = await response.json();
    if (data.schemaVersion !== 1 || !Array.isArray(data.entries) || !/^[a-f0-9]{40}$/.test(data.commit)) throw Error("履歴の形式を確認できません");
    $("release-version").textContent = "公開版 v" + data.version;
    $("release-snapshot").textContent = "公開コミット " + data.commit.slice(0,7) + " ／ 履歴生成 " + dates.format(new Date(data.generatedAt));
    for (const author of [...new Set(data.entries.map(entry => entry.author))].sort((a,b) => a.localeCompare(b,"ja"))) {
      const option=el("option", "", author); option.value=author; $("history-author").append(option);
    }
    let shown = 30;
    function render() {
      const entries=filterReleaseEntries(data.entries, $("history-search").value, $("history-author").value);
      const fragment=document.createDocumentFragment();
      for (const entry of entries.slice(0,shown)) {
        const article=el("article","release-entry"), meta=el("div","release-meta");
        const time=el("time","",dates.format(new Date(entry.date))); time.dateTime=entry.date;
        meta.append(time,el("span","badge",entry.version ? "v"+entry.version : "バージョン表記なし"),el("span","","担当："+entry.author));
        article.append(meta,el("h2","",entry.title));
        if (entry.changes?.length) { const ul=el("ul"); for(const change of entry.changes) ul.append(el("li","",change)); article.append(ul); }
        if (/^[a-f0-9]{40}$/.test(entry.id)) {
          const link=el("a","","変更内容を見る（"+entry.id.slice(0,7)+"）");
          link.href="https://github.com/0ad387513-crypto/tsukuriyo-project/commit/"+entry.id;
          link.target="_blank"; link.rel="noopener noreferrer"; article.append(link);
        }
        fragment.append(article);
      }
      list.replaceChildren(fragment); more.hidden=shown>=entries.length;
      status.textContent=entries.length ? `${entries.length}件中 ${Math.min(shown,entries.length)}件を表示（記録済み ${data.entries.length}件）` : "条件に合う修正履歴がありません。";
    }
    for(const id of ["history-search","history-author"]) $(id).addEventListener("input",()=>{shown=30;render();});
    more.addEventListener("click",()=>{shown+=30;render();}); render();
  } catch(error) { status.className="err"; status.textContent="修正履歴を読み込めませんでした。再読み込みしてください（"+error.message+"）。"; $("release-version").textContent="履歴を取得できませんでした"; }
})();
