"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("inline application scripts are valid JavaScript", () => {
  const scripts = Array.from(html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi));
  assert.ok(scripts.length > 0);
  for (const match of scripts) assert.doesNotThrow(() => new Function(match[1]));
});

test("Firebase Auth loads before application modules", () => {
  const authAt = html.indexOf("firebase-auth-compat.js");
  const appAt = html.indexOf('<script src="firebase.js"></script>');
  assert.ok(authAt > 0);
  assert.ok(appAt > authAt);
});

test("structure deck administration requires an admin claim and keeps a built-in fallback", () => {
  assert.match(html, /firebaseCurrentUserIsAdmin/);
  assert.match(html, /firebaseAdminChecked/);
  assert.match(html, /閲覧専用です。編集にはFirebase管理者権限が必要です/);
  assert.match(html, /CB_STRUCTURE_DECK_SEED_DEFAULTS\.map/);
});

test("shared build version loads before Firebase and the application", () => {
  const versionAt = html.indexOf('<script src="version.js"></script>');
  const firebaseAt = html.indexOf('<script src="firebase.js"></script>');
  assert.ok(versionAt > 0 && firebaseAt > versionAt);
});

test("Netlify revalidates entry points and mutable scripts", () => {
  const headers = fs.readFileSync(path.join(__dirname, "..", "_headers"), "utf8");
  assert.match(headers, /\/index\.html[\s\S]*no-cache, no-store, must-revalidate/);
  assert.match(headers, /\/version\.js[\s\S]*no-cache, no-store, must-revalidate/);
  assert.match(headers, /\/\*\.js[\s\S]*no-cache, must-revalidate/);
  assert.match(headers, /X-Content-Type-Options: nosniff/);
  assert.match(headers, /X-Frame-Options: DENY/);
  assert.match(headers, /Permissions-Policy: camera=\(\), microphone=\(\), geolocation=\(\)/);
});

test("online battle contract includes reconnect, version, hash and operation log", () => {
  assert.match(html, /BUILD_VERSION: TSUKURIYO_BUILD_VERSION/);
  assert.match(html, /_saveBattleReconnectSnapshot\(\)/);
  assert.match(html, /protocolVersion|\/protocol/);
  assert.match(html, /stateHash/);
  assert.match(html, /operationLog/);
  assert.match(html, /callFirebaseFunction\('publishBattleState'/);
  assert.match(html, /spectatorAccess/);
  assert.doesNotMatch(html, /const includeHand = n\.table === 'test'/);
  assert.match(html, /_battleSerializeSide\(bs\.self\)/);
  assert.match(html, /手札・山札は観戦でも枚数のみ/);
});

test("public room paging, cancellable matchmaking and effect audit are wired", () => {
  assert.match(html, /fetchPublicRoomsPage/);
  assert.match(html, /LoadMorePublic/);
  assert.match(html, /beginMatchmaking/);
  assert.match(html, /CancelMatch/);
  assert.match(html, /buildEffectCoverageAudit/);
  assert.match(html, /downloadEffectCoverageAudit/);
});

test("online timeout and disconnect grace constants are present", () => {
  assert.match(html, /BATTLE_ONLINE_TURN_LIMIT_SEC = 180/);
  assert.match(html, /BATTLE_DISCONNECT_GRACE_SEC = 90/);
  assert.match(html, /ServerValue\.TIMESTAMP/);
  assert.match(html, /BATTLE_REMOTE_DECISION_TIMEOUT_MS = 90 \* 1000/);
  assert.match(html, /_battleWaitForRemoteAnswer/);
  assert.match(html, /時間切れのため見送りとして処理しました/);
});

test("mobile viewport and reduced-motion support are enabled", () => {
  assert.match(html, /name="viewport"/);
  assert.match(html, /prefers-reduced-motion: reduce/);
  assert.match(html, /:focus-visible/);
});

test("battle effect guidance and motion preferences are available", () => {
  assert.match(html, /battleEffectGuide/);
  assert.match(html, /dslTargetUnavailableReason/);
  assert.match(html, /battleDeckChoiceReason/);
  assert.match(html, /battleAnimationSpeed/);
  assert.match(html, /battleSetAnimationSpeed/);
  assert.match(html, /motion-minimal/);
  assert.match(html, /battleEndTurnWarnings/);
  assert.match(html, /battleRequestEndTurn/);
  assert.match(html, /battleCardFlights/);
  assert.match(html, /_battleShowCardFlight/);
  assert.match(html, /battleEffectLinks/);
  assert.match(html, /_battleShowEffectLink/);
  assert.match(html, /battleKeywordBanner/);
  assert.match(html, /_battleShowKeywordBanner/);
  assert.match(html, /相手が攻撃可能なカードを確認しています/);
  assert.match(html, /dslTargetProgressPercent/);
  assert.match(html, /dslTargetSelectionReady/);
  assert.match(html, /battleCpuPhaseClass/);
  assert.match(html, /battle-cpu-thinking-steps/);
  assert.match(html, /battleNetHealth/);
  assert.match(html, /battleNetDisconnectRemainingSec/);
  assert.match(html, /battle-disconnect-progress/);
  assert.match(html, /localOnline/);
  assert.match(html, /resyncing/);
  assert.match(html, /_battleBuildDiagnosticReport/);
  assert.match(html, /battleDownloadDiagnosticReport/);
  assert.match(html, /battleCopyDiagnosticReport/);
  assert.match(html, /battleDownloadReplay/);
  assert.match(html, /tsukuriyo-public-battle-history/);
  assert.match(html, /battleSubmitProblemReport/);
  assert.match(html, /submitBattleReport/);
  assert.match(html, /roomCodeMasked/);
  assert.match(html, /publicBoard/);
  assert.match(html, /battleResultSummaryStats/);
  assert.match(html, /battleResultReasonText/);
  assert.match(html, /battle-result-review-actions/);
  assert.match(html, /battleSample\.result && battleResultRevealReady && !battleLogModal/);
  assert.match(html, /battleHistoryFilteredList/);
  assert.match(html, /battleHistoryStats/);
  assert.match(html, /downloadBattleHistory/);
  assert.match(html, /buildVersion: this\.BUILD_VERSION/);
  assert.match(html, /battle-mobile-nav/);
  assert.match(html, /battleMobileScroll/);
  assert.match(html, /対戦盤面の横移動/);
  assert.match(html, /aria-label="音量と演出設定を開く"/);
  assert.match(html, /battleNetworkBlocked/);
  assert.match(html, /battle-connection-blocker/);
  assert.match(html, /通信が復旧しました/);
  assert.match(html, /最新の共有盤面を確認してから操作を再開します/);
  assert.match(html, /battleNetworkBlockReason/);
  assert.match(html, /battleVersionCheckTimer/);
  assert.match(html, /battleVersionCheckToken/);
  assert.doesNotMatch(html, /alert\(message\)/);
  assert.match(html, /_battleBeginOpeningSequence/);
  assert.match(html, /if \(!options\.resume\) \{/);
  assert.match(html, /実際に開始演出を始めた時点から抑制時間を数える/);
  assert.match(html, /PublicVisibleLimit/);
  assert.match(html, /さらに表示/);
  assert.match(html, /for \(const room of candidates\)/);
  assert.match(html, /参加可能な公開セッションがありませんでした/);
  assert.match(html, /参加可能な公開ルームがありませんでした/);
  assert.match(html, /PublicSessions = this\.gsPublicSessions\.filter/);
  assert.match(html, /PublicRooms = this\.sbPublicRooms\.filter/);
  assert.match(html, /PublicRooms = this\.cbPublicRooms\.filter/);
});

test("problem reports and replays exclude private battle resources", () => {
  const replayMethod = html.match(/async battleDownloadReplay\(\)[\s\S]*?\n    },\n    async battleSubmitProblemReport/);
  assert.ok(replayMethod);
  assert.doesNotMatch(replayMethod[0], /\.hand|\.deck/);
  assert.match(replayMethod[0], /roomCodeMasked/);
  const functions = fs.readFileSync(path.join(__dirname, "..", "functions", "index.js"), "utf8");
  assert.match(functions, /exports\.submitBattleReport = onCall/);
  assert.match(functions, /enforceRateLimit\(db, uid, "submitBattleReport", 5/);
  assert.match(functions, /encoded\.length > 200000/);
});

test("room joins use atomic claims and reject expired rooms", () => {
  const root = path.join(__dirname, "..");
  const session = fs.readFileSync(path.join(root, "session.js"), "utf8");
  const shield = fs.readFileSync(path.join(root, "shield_battle.js"), "utf8");
  const construct = fs.readFileSync(path.join(root, "construct_battle.js"), "utf8");
  for (const source of [session, shield, construct]) {
    assert.match(source, /\.transaction\(cur =>/);
    assert.match(source, /createdAt/);
    assert.match(source, /TTL_MS/);
  }
  assert.doesNotMatch(shield.match(/async function joinRoom[\s\S]*?\n}/)[0], /await ref\.update/);
  assert.doesNotMatch(construct.match(/async function joinConstructRoom[\s\S]*?\n}/)[0], /await ref\.update/);
  assert.match(construct, /privateConstructRooms\/\$\{roomCode\}\/\$\{role\}\/deck/);
  assert.match(construct, /fetchPrivateConstructDeck/);
  assert.doesNotMatch(construct, /child\(role\)\.update\(\{\s*deck:/);
  assert.match(html, /_battleHiddenDeckCards\(oppInfo\.deckCount, this\.CONSTRUCT_DECK_SIZE\)/);
  assert.match(shield, /privateShieldRooms\/\$\{roomCode\}\/\$\{role\}\/deck/);
  assert.match(shield, /submitPrivateShieldDeck/);
  assert.match(html, /_battleHiddenDeckCards\(oppInfo\.deckCount, DECK_SIZE\)/);
});
