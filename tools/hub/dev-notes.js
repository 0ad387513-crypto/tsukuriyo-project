/* 開発ダッシュボード共通：修正メモ・依頼と残タスクの保存（Firebase Realtime Database の devNotes / devTasks）。
   ゲームと同じ Firebase（匿名認証）を使う。読み込み順：firebase-app/auth/database-compat → /firebase.js → このファイル。
   キジマとして表示中：このPCの確認用サーバー（localhost）で開いたとき。声づくりなどの操作と、承認・状態の変更はこのときだけ出す。 */
(() => {
  "use strict";
  const OWNER = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const STATUS = { memo: "未確認のメモ", wait: "未確認のメモ", approved: "作業待ち", doing: "作業中", review: "確認待ち", done: "完了", rejected: "見送り" };
  const WHO = { auto: "おまかせ", claude: "Claude", codex: "Codex" };
  const KINDS = { voice: "ボイス", illust: "イラスト", effect: "カード効果", motion: "アニメーション・演出", se: "SE・BGM", ui: "画面・操作", other: "その他" };
  // カードの値の調整案に使う項目（カード効果の一覧で、メモと一緒に書く）
  const PROPOSAL = [["color", "属性"], ["type", "種族"], ["cost", "マナ"], ["power", "戦闘力"], ["attack", "神攻力"], ["round", "ラウンド"], ["ret", "返還値"], ["text", "効果"]];
  const cleanProposal = p => {
    if (!p || typeof p !== "object") return null;
    const out = {};
    for (const [k] of PROPOSAL) if (p[k] !== undefined && p[k] !== null) out[k] = String(p[k]).slice(0, k === "text" ? 2000 : 40);
    return Object.keys(out).length ? out : null;
  };
  const TASK_STATUS = { todo: "未着手", doing: "作業中", review: "確認待ち", done: "完了" };
  let readyPromise = null;
  const ready = () => readyPromise || (readyPromise = (async () => {
    if (typeof ensureFirebaseAuth !== "function" || typeof getDb !== "function") throw new Error("Firebase を読み込めませんでした");
    const user = await ensureFirebaseAuth();
    return { db: getDb(), uid: user.uid };
  })().catch(e => { readyPromise = null; throw e; }));
  const now = () => new Date().toISOString();
  const name = {
    get() { try { return localStorage.getItem("tsukuriyo-dev-name") || ""; } catch (e) { return ""; } },
    set(v) { try { localStorage.setItem("tsukuriyo-dev-name", String(v || "").slice(0, 30)); } catch (e) { /* 保存できなくても続ける */ } },
  };
  const trim = (v, max) => String(v == null ? "" : v).trim().slice(0, max);

  const numsOf = t => { const m = String(t || "").match(/^No\.([\d,]+)/); return m ? m[1].split(",").filter(Boolean) : null; };
  const sameTarget = (a, b) => { if ((a || "") === (b || "")) return true; const x = numsOf(a), y = numsOf(b); return !!(x && y && x.some(n => y.includes(n))); };
  window.DevNotes = {
    sameTarget,
    OWNER, STATUS, WHO, KINDS, TASK_STATUS, PROPOSAL, name,
    async uid() { return (await ready()).uid; },
    /* 一覧を購読する。戻り値で購読をやめる */
    watch(path, cb, onError) {
      let off = null, stopped = false;
      ready().then(({ db }) => {
        if (stopped) return;
        const r = db.ref(path);
        const h = snap => { const v = snap.val() || {}; cb(Object.entries(v).map(([id, x]) => Object.assign({ id }, x))); };
        r.on("value", h, e => onError && onError(e));
        off = () => r.off("value", h);
      }).catch(e => onError && onError(e));
      return () => { stopped = true; if (off) off(); };
    },
    async addNote(n) {
      const { db, uid } = await ready();
      const memo = trim(n.memo, 2000), prompt = trim(n.prompt, 4000);
      const proposal = cleanProposal(n.proposal);
      if (!memo && !prompt && !proposal) throw new Error("メモを書くか、値を変えてください");
      const t = now(), ref = db.ref("devNotes").push();
      await ref.set({ page: trim(n.page, 200), pageTitle: trim(n.pageTitle, 120), target: trim(n.target, 80), kind: KINDS[n.kind] ? n.kind : "other",
        memo, prompt, assignee: WHO[n.assignee] ? n.assignee : "auto", status: prompt ? "wait" : "memo", name: trim(n.name || name.get(), 30) || "名前なし",
        uid, result: "", createdAt: t, updatedAt: t, ...(proposal ? { proposal } : {}) });
      return ref.key;
    },
    async updateNote(id, patch) {
      const { db } = await ready();
      const p = {};
      for (const k of ["target", "memo", "prompt", "result"]) if (patch[k] !== undefined) p[k] = trim(patch[k], k === "target" ? 80 : 4000);
      if (patch.assignee !== undefined && WHO[patch.assignee]) p.assignee = patch.assignee;
      if (patch.kind !== undefined && KINDS[patch.kind]) p.kind = patch.kind;
      if (patch.status !== undefined && STATUS[patch.status]) p.status = patch.status;
      if (patch.proposal !== undefined) p.proposal = cleanProposal(patch.proposal);
      p.updatedAt = now();
      await db.ref("devNotes/" + id).update(p);
    },
    async removeNote(id) { const { db } = await ready(); await db.ref("devNotes/" + id).remove(); },
    async addTask(t) {
      const { db } = await ready();
      const ref = db.ref("devTasks").push();
      await ref.set({ title: trim(t.title, 80), group: trim(t.group, 30) || "そのほか", status: TASK_STATUS[t.status] ? t.status : "todo", lead: trim(t.lead, 20), note: trim(t.note, 1000), order: Number(t.order) || 0, updatedAt: now() });
    },
    async updateTask(id, patch) {
      const { db } = await ready();
      const p = { updatedAt: now() };
      if (patch.status !== undefined && TASK_STATUS[patch.status]) p.status = patch.status;
      if (patch.note !== undefined) p.note = trim(patch.note, 1000);
      await db.ref("devTasks/" + id).update(p);
    },
  };
})();
