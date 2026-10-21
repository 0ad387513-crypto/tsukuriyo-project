"use strict";

function filterReleaseEntries(entries, query, author) {
  const needle = query.trim().toLocaleLowerCase("ja");
  return entries.filter(entry => (!author || entry.author === author) &&
    [entry.title, entry.version, entry.author, ...(entry.changes || [])].join(" ").toLocaleLowerCase("ja").includes(needle));
}

function releaseAuthorCounts(entries) {
  return [...entries.reduce((counts, entry) => counts.set(entry.author, (counts.get(entry.author) || 0) + 1), new Map())]
    .map(([author, count]) => ({ author, count })).sort((a,b) => a.author.localeCompare(b.author, 'ja'));
}
if (typeof module !== 'undefined') module.exports = { filterReleaseEntries, releaseAuthorCounts };
if (typeof document !== 'undefined') (() => {
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text) node.textContent = text; return node; };
  const status = $('history-status'), list = $('history-list'), more = $('history-more');
  const dates = new Intl.DateTimeFormat('ja-JP', { dateStyle:'medium', timeStyle:'short', timeZone:"Asia/Tokyo" });
  let data = null, shown = 30, busy = false;
  function render() {
    if (!data) return;
    const entries = filterReleaseEntries(data.entries, $('history-search').value, $('history-author').value);
    const fragment = document.createDocumentFragment();
    for (const entry of entries.slice(0, shown)) {
      const article = el('article', 'release-entry'), meta = el('div', 'release-meta');
      const time = el('time', '', dates.format(new Date(entry.date))); time.dateTime = entry.date;
      meta.append(time, el('span', 'badge', entry.version ? 'v'+entry.version : 'バージョン表記なし'), el('span', '', '担当：'+entry.author));
      article.append(meta, el('h2', '', entry.title));
      if (entry.changes?.length) { const ul=el('ul'); for(const change of entry.changes) ul.append(el('li','',change)); article.append(ul); }
      if (/^[a-f0-9]{40}$/.test(entry.id)) {
        const link=el('a','','変更内容を見る（'+entry.id.slice(0,7)+'）');
        link.href='https://github.com/0ad387513-crypto/tsukuriyo-project/commit/'+entry.id; link.target='_blank'; link.rel='noopener noreferrer'; article.append(link);
      }
      fragment.append(article);
    }
    list.replaceChildren(fragment); more.hidden=shown>=entries.length;
    status.className='';status.textContent=entries.length ? entries.length+'件中 '+Math.min(shown,entries.length)+'件を表示（記録済み '+data.entries.length+'件）' : '条件に合う修正履歴がありません';
    for (const button of $('history-author-buttons').children) button.setAttribute('aria-pressed', String(button.dataset.author === $('history-author').value));
  }
  function authorControls() {
    const selected=$('history-author').value;
    $('history-author').replaceChildren(el('option','','すべての担当者')); $('history-author').firstChild.value='';
    $('history-author-buttons').replaceChildren();
    const counts=releaseAuthorCounts(data.entries);
    const total=data.entries.length, others=counts.filter(row=>row.author!=='キジマ').reduce((sum,row)=>sum+row.count,0);
    $('history-authors-summary').textContent='全'+counts.length+'名・'+total+'件の公開済み修正（キジマ以外：'+others+'件）';
    for(const row of [{author:'',count:total},...counts]) {
      if(row.author) {const option=el('option','',row.author+'（'+row.count+'件）');option.value=row.author;$('history-author').append(option);}
      const button=el('button','',(row.author||'全メンバー')+' '+row.count+'件');button.type='button';button.dataset.author=row.author;
      button.addEventListener('click',()=>{$('history-search').value='';$('history-author').value=row.author;shown=30;render();});
      $('history-author-buttons').append(button);
    }
    $('history-author').value=counts.some(row=>row.author===selected)?selected:'';
  }
  async function load() {
    if(busy)return;busy=true;
    try {
      let next, cached=false;
      try { next=JSON.parse(await DashboardProduction.text('release-history.json')); }
      catch {const response=await fetch('/tools/hub/release-history.json',{cache:"no-store"});if(!response.ok)throw Error('HTTP '+response.status);next=await response.json();cached=true;}
      if(next.schemaVersion!==1||!Array.isArray(next.entries)||!/^[a-f0-9]{40}$/.test(next.commit))throw Error('履歴の形式を確認できません');
      $('release-version').textContent='公開版 v'+next.version;
      $('release-snapshot').textContent='公開コミット '+next.commit.slice(0,7)+' ／ 履歴生成 '+dates.format(new Date(next.generatedAt))+(cached?' ／ 本番との接続を確認できないため同梱の履歴を表示':' ／ 本番の最新履歴を自動取得');
      if(data?.commit!==next.commit) {data=next;authorControls();render();}
      else if(status.className==='err') render();
    } catch(error) { status.className='err';status.textContent='修正履歴を読み込めませんでした（'+error.message+'）'; }
    finally {busy=false;}
  }
  for(const id of ['history-search','history-author']) $(id).addEventListener('input',()=>{shown=30;render();});
  more.addEventListener('click',()=>{shown+=30;render();});
  setInterval(()=>{if(!document.hidden)load();},60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});load();
})();
