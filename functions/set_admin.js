"use strict";

const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

async function main(argv = process.argv.slice(2)) {
  const uid = String(argv[0] || "").trim();
  const enabledArg = String(argv[1] || "true").toLowerCase();
  if (!uid) throw new Error("使い方: npm run admin:set -- <Firebase UID> [true|false]");
  if (!/^(true|false)$/.test(enabledArg)) throw new Error("第2引数は true または false を指定してください");
  const enabled = enabledArg === "true";
  initializeApp({ credential: applicationDefault() });
  const auth = getAuth();
  const user = await auth.getUser(uid);
  const claims = Object.assign({}, user.customClaims || {});
  if (enabled) claims.admin = true;
  else delete claims.admin;
  await auth.setCustomUserClaims(uid, claims);
  process.stdout.write(`${uid} の admin 権限を ${enabled ? "有効" : "無効"} にしました。対象ブラウザーで再読み込みしてください。\n`);
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write(`${error.message || error}\n`);
    process.exitCode = 1;
  });
}

module.exports = { main };
