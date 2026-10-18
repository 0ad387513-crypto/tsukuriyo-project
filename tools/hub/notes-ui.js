/* 修正メモ・依頼の表示と書く欄（ページの枠 view.html と 修正依頼ボード requests.html で共通）。
   メンバーは気づいたことを気楽に書くだけ（修正の指示は書かない）。分類はページから、対象は押した項目から、名前は最初に一度だけ聞いてこの端末に覚えておく。
   直すかどうか・担当（Claude／Codex）は、キジマがメモを見て決める */
(() => {
  "use strict";
  const N = window.DevNotes;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const when = iso => { const d = new Date(iso); return isNaN(d) ? "" : (d.getMonth() + 1) + "/" + d.getDate() + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
  const btn = (text, cls, onClick) => { const b = el("button", "btn small" + (cls ? " " + cls : ""), text); b.type = "button"; b.addEventListener("click", onClick); return b; };
  function seg(values, current, onPick, label) {
    const box = el("div", "seg"); box.setAttribute("role", "group"); if (label) box.setAttribute("aria-label", label);
    for (const [v, t] of Object.entries(values)) {
      const b = el("button", "", t); b.type = "button"; b.setAttribute("aria-pressed", String(v === current));
      b.addEventListener("click", () => { for (const x of box.children) x.setAttribute("aria-pressed", String(x === b)); onPick(v); });
      box.append(b);
    }
    return box;
  }
  /* メモ1件。opts.uid（自分の匿名ID）、opts.showPage（どのページのメモかを出す）、opts.onEdit、opts.onError */
  function noteNode(n, opts = {}) {
    const box = el("div", "note " + n.status);
    const head = el("div", "row");
    head.append(el("span", "badge " + n.status, N.STATUS[n.status] || n.status), el("span", "badge", N.KINDS[n.kind] || "その他"));
    if (N.OWNER && n.prompt && n.assignee && n.assignee !== "auto") head.append(el("span", "badge", "担当：" + (N.WHO[n.assignee] || n.assignee)));
    if (opts.showPage && n.pageTitle) { const a = el("a", "", n.pageTitle); a.href = "/tools/hub/view.html?p=" + encodeURIComponent(n.page || "") + (n.target ? "&focus=" + encodeURIComponent(n.target) : ""); head.append(a); }
    if (n.target && opts.showTarget !== false) head.append(el("b", "", n.target));
    head.append(el("span", "muted", (n.name || "") + "・" + when(n.createdAt)));
    box.append(head);
    if (n.proposal) box.append(proposalNode(n.proposal, opts.current));
    if (n.memo) box.append(el("div", "body", n.memo));
    if (n.prompt) box.append(el("div", "prompt", "指示：" + n.prompt));
    if (n.result) box.append(el("div", "result", "結果：" + n.result));
    // Claude は押されたことに自分では気づけないので、伝え方を添える
    if (N.OWNER && n.status === "approved" && n.assignee === "claude") box.append(el("div", "muted", "Claude に「依頼を見て」と伝えると、この内容をもとに直す準備をします（声のメモなら、試聴室に声の作り直しの提案を用意します）。"));
    const tools = el("div", "row");
    const fail = e => opts.onError && opts.onError(e);
    const mine = opts.uid && n.uid === opts.uid;
    // メモの編集・削除はキジマだけ（ほかの人は見るだけ。書いた本人でも直せない）
    if (N.OWNER && ["memo", "wait"].includes(n.status) && opts.onEdit) tools.append(btn("編集", "", () => opts.onEdit(n)));
    if (N.OWNER) {
      if (n.status === "wait" || n.status === "memo") {
        // メモを見て、直すなら担当を決めて作業に回す
        tools.append(btn("Claude に回す", "primary", () => N.updateNote(n.id, { status: "approved", assignee: "claude" }).catch(fail)),
          btn("Codex に回す", "primary", () => N.updateNote(n.id, { status: "approved", assignee: "codex" }).catch(fail)),
          btn("直さない", "", () => N.updateNote(n.id, { status: "rejected" }).catch(fail)));
      }
      if (n.status === "approved") tools.append(btn("回すのを取り消す", "", () => N.updateNote(n.id, { status: "memo", assignee: "auto" }).catch(fail)));
      if (["review", "doing", "approved"].includes(n.status)) tools.append(btn("確認した（完了にする）", "primary", () => N.updateNote(n.id, { status: "done" }).catch(fail)));
    }
    // ページごとのキジマ専用の操作（例：カード効果の調整案をカードジェネレーターで開く）
    if (N.OWNER && opts.ownerAction && opts.ownerAction.when(n)) tools.append(btn(opts.ownerAction.label, "primary", () => opts.ownerAction.run(n)));
    if (N.OWNER) {
      const del = btn("削除", "", () => { if (del.dataset.sure) N.removeNote(n.id).catch(fail); else { del.dataset.sure = "1"; del.textContent = "本当に削除する"; del.style.color = "var(--danger)"; } });
      tools.append(del);
    }
    if (tools.childElementCount) box.append(tools);
    return box;
  }
  /* カードの値の調整案：変えた項目だけを「今の値 → 調整案」で出す（今の値が分からないときは調整案だけ） */
  function proposalNode(p, current) {
    const box = el("div", "proposal-box"); box.style.cssText = "display:flex;flex-direction:column;gap:3px;background:var(--sunken);border-radius:6px;padding:6px 9px";
    box.append(el("b", "", "調整案"));
    for (const [k, label] of N.PROPOSAL) {
      if (p[k] === undefined) continue;
      const line = el("div"); line.style.cssText = "white-space:pre-wrap;overflow-wrap:anywhere";
      const before = current && current[k] !== undefined ? String(current[k]) : null;
      line.textContent = label + "：" + (before !== null && k !== "text" ? before + " → " : "") + (p[k] || "（なし）");
      box.append(line);
    }
    return box;
  }
  /* 書く欄。page（ページの情報。分類に使う）、target（押した項目）、editing（編集するメモ）、current（調整案の項目の今の値） */
  function form({ page, target, editing, onDone, current }) {
    const box = el("div"); box.style.cssText = "display:flex;flex-direction:column;gap:8px";
    // 名前：最初の1回だけ入れてもらい、この端末に覚えておく
    const who = el("div", "row");
    const paintWho = () => {
      who.replaceChildren();
      const saved = N.name.get();
      if (!saved) {
        const nameIn = el("input"); nameIn.type = "text"; nameIn.maxLength = 30; nameIn.placeholder = "あなたの名前（最初の1回だけ）"; nameIn.setAttribute("aria-label", "名前");
        nameIn.addEventListener("change", () => { if (nameIn.value.trim()) { N.name.set(nameIn.value.trim()); paintWho(); } });
        who.append(nameIn);
      } else {
        who.append(el("span", "muted", "記録する名前：" + saved), btn("変える", "", () => { N.name.set(""); paintWho(); }));
      }
    };
    paintWho();
    const memo = el("textarea"); memo.maxLength = 2000; memo.placeholder = (page && page.memoPlaceholder) || "気づいたことを気軽にどうぞ（例：顔が少し切れている、声がもう少し明るいほうがいい）"; memo.value = editing ? editing.memo || "" : ""; memo.setAttribute("aria-label", "メモ");
    // カード効果の一覧：属性・種族・マナ・戦闘力・神攻力・ラウンド・返還値・効果を、今の値が入った状態で個別に直せる
    const fields = {};
    let fieldBox = null;
    if (page && page.proposal && current) {
      fieldBox = el("div"); fieldBox.style.cssText = "display:grid;grid-template-columns:auto minmax(0,1fr);gap:6px 10px;align-items:center";
      const start = editing && editing.proposal ? Object.assign({}, current, editing.proposal) : current;
      for (const [k, label] of N.PROPOSAL) {
        if (current[k] === undefined) continue;
        const input = el(k === "text" ? "textarea" : "input"); if (k !== "text") input.type = "text";
        input.value = start[k] == null ? "" : String(start[k]); input.setAttribute("aria-label", label);
        if (k === "text") { input.style.minHeight = "110px"; }
        fields[k] = input;
        const lab = el("label", "muted", label); lab.style.fontWeight = "700"; if (k === "text") lab.style.alignSelf = "start";
        fieldBox.append(lab, input);
      }
      memo.placeholder = "理由やコメント（任意）";
    }
    const changed = () => { const out = {}; for (const [k, input] of Object.entries(fields)) if (input.value !== String(current[k] == null ? "" : current[k])) out[k] = input.value; return out; };
    const msg = el("span", "muted");
    const save = btn(editing ? "変更を保存" : "保存する", "primary", async () => {
      const nameIn = who.querySelector("input");
      if (nameIn && nameIn.value.trim()) N.name.set(nameIn.value.trim());
      if (!N.name.get()) { msg.textContent = "最初に名前を入れてください。"; if (nameIn) nameIn.focus(); return; }
      const prop = changed();
      if (!memo.value.trim() && !Object.keys(prop).length) { msg.textContent = fieldBox ? "値を変えるか、コメントを書いてください。" : "メモを書いてください。"; return; }
      save.disabled = true; msg.textContent = "保存しています…";
      try {
        if (editing) {
          await N.updateNote(editing.id, fieldBox ? { memo: memo.value, proposal: prop } : { memo: memo.value });
        } else {
          await N.addNote({ page: page.path, pageTitle: page.title, target: target || "", kind: page.kind, memo: memo.value, prompt: "", assignee: "auto", name: N.name.get(), proposal: fieldBox ? prop : undefined });
        }
        msg.textContent = "保存しました。ありがとうございます。";
        if (onDone) onDone();
      } catch (e) { msg.textContent = e.message || "保存できませんでした"; save.disabled = false; }
    });
    const actions = el("div", "row"); actions.append(save);
    if (editing && onDone) actions.append(btn("やめる", "", onDone));
    actions.append(msg);
    box.append(...[who, fieldBox, memo, actions].filter(Boolean));
    if (paintWho && who.querySelector("input")) setTimeout(() => who.querySelector("input").focus(), 0); else setTimeout(() => memo.focus(), 0);
    return box;
  }
  window.DevNotesUI = { el, btn, seg, noteNode, form, when, proposalNode };
})();
