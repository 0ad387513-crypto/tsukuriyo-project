"use strict";
/* 開発ダッシュボードの修正メモ・依頼（Firebase の devNotes）と残タスク（devTasks）を、Claude・Codex が読み書きする道具。
   ゲームと同じ Web 用の設定で匿名ログインして使う（キーなどの秘密は不要）。
     node scripts/dev_notes.js list [--status approved] [--assignee codex]   一覧（既定は完了・見送り以外）
     node scripts/dev_notes.js show ID                                        1件の全文
     node scripts/dev_notes.js set ID --status doing                          状態を変える（doing / review など）
     node scripts/dev_notes.js set ID --status review --result "やったこと…"  結果を書いて確認待ちにする
     node scripts/dev_notes.js tasks                                          残タスクの一覧
     node scripts/dev_notes.js task-set ID --status done [--note "…"]          残タスクを更新
     node scripts/dev_notes.js seed-tasks file.json                           残タスクをまとめて登録（[{title, group, status, lead, note, order}]）
   作業してよいのは status が approved（制作者が承認済み）のものだけ。memo は覚え書きなので作業しない。 */
const fs = require("node:fs");
const path = require("node:path");

const src = fs.readFileSync(path.join(__dirname, "..", "firebase.js"), "utf8");
const pick = k => (src.match(new RegExp(k + ':\\s*"([^"]+)"')) || [])[1];
const API_KEY = pick("apiKey"), DB = pick("databaseURL");
const arg = name => { const i = process.argv.indexOf("--" + name); return i > 0 ? process.argv[i + 1] : undefined; };
const STATUS = ["memo", "wait", "approved", "doing", "review", "done", "rejected"], TASK = ["todo", "doing", "review", "done"];

let tokenPromise = null;
function token() { return tokenPromise || (tokenPromise = signIn()); }
async function signIn() {
  const res = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=" + API_KEY, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }) });
  if (!res.ok) throw new Error("匿名ログインに失敗しました（" + res.status + "）");
  return (await res.json()).idToken;
}
async function call(method, p, body) {
  const res = await fetch(`${DB}/${p}.json?auth=${await token()}`, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${p} に失敗しました（${res.status}）${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}
const now = () => new Date().toISOString();

(async () => {
  const cmd = process.argv[2];
  if (cmd === "list") {
    const all = Object.entries(await call("GET", "devNotes") || {}).map(([id, n]) => Object.assign({ id }, n));
    const st = arg("status"), who = arg("assignee");
    const list = all.filter(n => (st ? n.status === st : !["done", "rejected"].includes(n.status)) && (!who || n.assignee === who)).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    for (const n of list) console.log(`${n.id}  [${n.status}] ${n.kind || ""} 担当:${n.assignee} ${n.pageTitle || n.page}${n.target ? "／" + n.target : ""}（${n.name}）\n  メモ：${(n.memo || "").replace(/\n/g, " ").slice(0, 120)}${n.prompt ? "\n  指示：" + n.prompt.replace(/\n/g, " ").slice(0, 200) : ""}`);
    console.log(`${list.length}件（全${all.length}件）`);
  } else if (cmd === "show") {
    console.log(JSON.stringify(await call("GET", "devNotes/" + process.argv[3]), null, 2));
  } else if (cmd === "set") {
    const id = process.argv[3], patch = { updatedAt: now() };
    if (arg("status")) { if (!STATUS.includes(arg("status"))) throw new Error("status は " + STATUS.join(" / ")); patch.status = arg("status"); }
    if (arg("result") !== undefined) patch.result = String(arg("result")).slice(0, 4000);
    await call("PATCH", "devNotes/" + id, patch); console.log("更新しました：" + id + " " + JSON.stringify(patch));
  } else if (cmd === "delete") {
    // 動作確認で書いたメモなどを消す（メンバーのメモは消さない）
    await call("DELETE", "devNotes/" + process.argv[3]); console.log("削除しました：" + process.argv[3]);
  } else if (cmd === "tasks") {
    const all = Object.entries(await call("GET", "devTasks") || {}).map(([id, t]) => Object.assign({ id }, t)).sort((a, b) => (a.order || 0) - (b.order || 0));
    for (const t of all) console.log(`${t.id}  [${t.status}] ${t.group}／${t.title}${t.lead ? "（" + t.lead + "）" : ""}`);
  } else if (cmd === "task-set") {
    const patch = { updatedAt: now() };
    if (arg("status")) { if (!TASK.includes(arg("status"))) throw new Error("status は " + TASK.join(" / ")); patch.status = arg("status"); }
    if (arg("note") !== undefined) patch.note = String(arg("note")).slice(0, 1000);
    await call("PATCH", "devTasks/" + process.argv[3], patch); console.log("更新しました");
  } else if (cmd === "seed-tasks") {
    const items = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
    const body = {};
    for (const t of items) body[t.id] = { title: t.title, group: t.group || "そのほか", status: t.status || "todo", lead: t.lead || "", note: t.note || "", order: Number(t.order) || 0, updatedAt: now() };
    await call("PATCH", "devTasks", body); console.log(Object.keys(body).length + "件を登録しました");
  } else {
    console.log(fs.readFileSync(__filename, "utf8").split("\n").slice(1, 14).join("\n"));
  }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
