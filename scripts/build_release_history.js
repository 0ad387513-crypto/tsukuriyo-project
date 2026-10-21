"use strict";

// Netlify builds this snapshot from the deployed commit, never from a developer's dirty files.
const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const ROOT = path.resolve(__dirname, "..");
const OUTPUT = "tools/hub/release-history.json";
const REPOSITORY = "https://github.com/0ad387513-crypto/tsukuriyo-project";
const LIMIT = 300;

function createSnapshot({ ref, git, notes = [], previous = null, now = new Date().toISOString() }) {
  if (!/^(?:[a-f0-9]{40}|HEAD|origin\/main)$/.test(ref)) throw Error("公開履歴の参照先が不正です");
  const commit = git(["rev-parse", "--verify", ref + "^{commit}"]).trim();
  if (!/^[a-f0-9]{40}$/.test(commit)) throw Error("公開コミットを特定できません");
  const source = git(["show", commit + ":version.js"]);
  const version = source.match(/const TSUKURIYO_BUILD_VERSION\s*=\s*"([0-9.]+)"/)?.[1];
  if (!version) throw Error("公開バージョンを読み取れません");
  // All reachable commits, including merged contributors. Do not filter by author or first parent.
  const log = git(["log", commit, "--date-order", "-n", String(LIMIT), "--format=%H%x1f%cI%x1f%an%x1f%s%x1e"]);
  const entries = log.split("\x1e").map(row => row.trim()).filter(Boolean).map(row => {
    const [id, date, author, subject] = row.split("\x1f");
    if (!/^[a-f0-9]{40}$/.test(id) || !date || !author || !subject) throw Error("コミット履歴の形式が不正です");
    const entryVersion = subject.match(/\bv(\d+\.\d+\.\d+)\b/)?.[1] || null;
    const note = notes.find(n => n.version === entryVersion);
    return { id, date, author, version: entryVersion,
      title: note?.title || subject.replace(/^(?:feat|fix|docs|chore|refactor|test|perf)(?:\([^)]*\))?:\s*/, "").replace(/\s+v\d+\.\d+\.\d+\s*$/, ""),
      changes: note?.changes || [] };
  });
  if (!entries.length || entries[0].id !== commit) throw Error("公開コミットが履歴に含まれていません");
  // Preserve already-published older records when the hosting checkout has shallow history.
  const known = new Set(entries.map(e => e.id));
  if (previous?.repository === REPOSITORY) for (const entry of previous.entries || []) {
    if (/^[a-f0-9]{40}$/.test(entry.id) && !known.has(entry.id)) {
      known.add(entry.id); entries.push(entry);
    }
  }
  return { schemaVersion: 1, repository: REPOSITORY, commit, version, generatedAt: now,
    limit: LIMIT, entries: entries.slice(0, LIMIT) };
}

async function fetchPublishedHistory(fetcher = fetch) {
  const response = await fetcher("https://tsukuriyo-online.netlify.app/tools/hub/release-history.json", {
    cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw Error("本番の修正履歴を取得できません: HTTP " + response.status);
  const data = await response.json();
  if (data.schemaVersion !== 1 || data.repository !== REPOSITORY || !/^[a-f0-9]{40}$/.test(data.commit)
      || !/^\d+\.\d+\.\d+$/.test(data.version) || !Array.isArray(data.entries)) throw Error("本番の修正履歴の形式が不正です");
  return data;
}

async function main() {
  const output = path.join(ROOT, OUTPUT);
  // 共有確認用の未公開変更を「本番の修正履歴」へ混ぜない
  if (["deploy-preview", "branch-deploy"].includes(process.env.CONTEXT)) {
    const published = await fetchPublishedHistory();
    fs.writeFileSync(output, JSON.stringify(published, null, 2) + "\n");
    console.log(`本番修正履歴を共有確認用へ反映: v${published.version} / ${published.commit.slice(0, 7)}`);
    return;
  }
  const git = args => {
    const result = cp.spawnSync("git", ["-c", "safe.directory=" + ROOT, ...args], { cwd: ROOT, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
    if (result.status !== 0) throw Error("公開履歴を生成できません: " + (result.stderr || result.error));
    return result.stdout;
  };
  const snapshot = createSnapshot({ ref: process.env.COMMIT_REF || "origin/main", git,
    notes: JSON.parse(fs.readFileSync(path.join(ROOT, "docs/release-notes.json"), "utf8")),
    previous: fs.existsSync(output) ? JSON.parse(fs.readFileSync(output, "utf8")) : null });
  fs.writeFileSync(output, JSON.stringify(snapshot, null, 2) + "\n");
  console.log(`本番修正履歴: v${snapshot.version} / ${snapshot.entries.length}件 / ${snapshot.commit.slice(0, 7)}`);
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { createSnapshot, fetchPublishedHistory };
