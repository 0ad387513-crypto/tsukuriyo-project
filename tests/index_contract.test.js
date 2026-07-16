"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const effectSpec = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "effect_spec.json"), "utf8"));

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

test("four-player draft exposes return values and recommendation reasons", () => {
  assert.match(html, /class="gm-pack-return-overlay"/);
  assert.match(html, /デッキ返還値 <b>\{\{ gsMyDraftDeckReturnTotal \}\}<\/b>/);
  assert.match(html, /gsDraftCardReturnValue\(card\)/);
  assert.match(html, /gsCpuScoreBreakdown\(card, ctx\)/);
  assert.match(html, /kami: 'カミ', tribe: '種族', color: '属性', curve: 'コスト', other: 'その他'/);
  assert.match(html, /class="pick-assist-reason"/);
});

test("four-player milestone cinematics are wired to shared and personal events", () => {
  for (const asset of [
    "ui_cinematics/kami-summoning-shrine.png",
    "ui_cinematics/bloom-lotus-closed.png",
    "ui_cinematics/bloom-lotus-open.png",
    "ui_cinematics/dies-irae-ritual.png",
  ]) assert.match(html, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(html, /_gsPlayKamiCinematic\(\)/);
  assert.match(html, /_gsPlayBloomCinematic\(\)/);
  assert.match(html, /_gsPlayDiesIraeCinematic\(diesSeats\)/);
  assert.match(html, /previousPhase === 'draft'/);
  assert.match(html, /prefers-reduced-motion:reduce/);
});

test("four-player Kami choice requires reviewing effects, pick policy and creation philosophy", () => {
  const guideMatch = html.match(/const GS_KAMI_SELECTION_GUIDES = Object\.freeze\((\{[\s\S]*?\})\);\s*\/\* ={20,}/);
  assert.ok(guideMatch, "Kami selection guides were not found");
  const guides = new Function(`return (${guideMatch[1]});`)();
  assert.deepEqual(Object.keys(guides), ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
  for (const guide of Object.values(guides)) {
    assert.equal(typeof guide.cause, "string");
    assert.equal(typeof guide.vision, "string");
    assert.equal(typeof guide.world, "string");
    assert.ok(Array.isArray(guide.pick) && guide.pick.length >= 2);
  }
  assert.match(html, /class="gs-kami-info-overlay"/);
  assert.match(html, /カミの情報を確認する/);
  assert.match(html, /選別の儀 ― ピックの基本方針/);
  assert.match(html, /gsKamiAcceptanceLabel\(gsKamiInfoCard\)/);
  assert.match(html, /kamiSelectionIllustrationUrl\(gsKamiInfoCard\)/);
  assert.match(html, /kami_illustrations\/selection\/\$\{String\(no\)\.padStart\(3, '0'\)\}\.webp/);
  assert.match(html, /\.gs-kami-info-card-image[^}]*aspect-ratio:\s*2\/3/);
  assert.match(html, /gsKamiVisionParts\(gsKamiInfoCard\)/);
  assert.match(html, /gsShowAdjacentKamiInfo\(-1\)/);
  assert.match(html, /gsShowAdjacentKamiInfo\(1\)/);
  assert.match(html, /gsKamiPickSubmitting \? '確定中…' : 'はい'/);
  assert.match(html, />いいえ<\/button>/);
  assert.doesNotMatch(html, /目指す創世：\{\{/);
  assert.match(html, /\.gs-kami-info-name[^}]*white-space:\s*nowrap/);
  assert.match(html, /@click="gsOpenKamiInfo\(card\)"/);
  assert.doesNotMatch(html, /@click="gsConfirmKami\(card\)"/);
  assert.match(html, /await pickKami\(this\.gs\.sessionCode, this\.gs\.seat, String\(card\.no\)\)/);
  for (let no = 1; no <= 10; no++) {
    assert.equal(fs.existsSync(path.join(__dirname, "..", "kami_illustrations", "selection", `${String(no).padStart(3, "0")}.webp`)), true);
  }
});

test("top menu preserves artwork ratios and scrolls on short screens", () => {
  assert.match(html, /\.top-menu\.top-menu-home[\s\S]*?overflow-y:\s*auto/);
  assert.match(html, /\.top-mode-grid[\s\S]*?height:\s*auto/);
  assert.match(html, /\.top-mode-card\.game \.top-mode-thumb,[\s\S]*?aspect-ratio:\s*1\s*\/\s*1/);
  assert.match(html, /\.top-mode-card\.construct \.top-mode-thumb,[\s\S]*?aspect-ratio:\s*1024\s*\/\s*536/);
  assert.match(html, /@media \(max-width:\s*1100px\)[\s\S]*?grid-template-columns:\s*1fr 1fr/);
  assert.match(html, /@media \(max-width:\s*700px\)[\s\S]*?grid-template-columns:\s*1fr/);
  assert.equal((html.match(/class="top-mode-column/g) || []).length, 3);
});

test("play manual is separated from the pick guide and contains the revised rules", () => {
  assert.match(html, /manualModalOpen: false/);
  assert.match(html, /ツクリヨ プレイガイド/);
  assert.match(html, /🧭 ピックガイド/);
  assert.match(html, /class="top-mode-guide-btn manual"/);
  assert.match(html, /class="top-mode-guide-btn pick"/);
  assert.match(html, /10枚束 × 3回[\s\S]*?<strong>30枚<\/strong>/);
  assert.match(html, /10枚束 × 1回[\s\S]*?<strong>10枚<\/strong>/);
  assert.match(html, /5枚束 × 1回[\s\S]*?<strong>5枚<\/strong>/);
  assert.match(html, /無料返還[\s\S]*?1枚[\s\S]*?2枚[\s\S]*?2枚/);
  assert.match(html, /習合 ／ 見識2/);
  assert.match(html, /手札が9枚以上なら8枚になるまで/);
  assert.match(html, /理念構築戦[\s\S]*?星紡ぎ戦/);
  assert.match(html, /集めた48枚をそのままデッキ/);
  assert.match(html, /ui_decorations\/manual-battle-field\.png/);
  assert.equal((html.match(/manual-card-pin p\d+/g) || []).length, 10);
  assert.match(html, /セッション開始時にランダムな組み合わせ/);
  assert.match(html, /word-break:\s*auto-phrase/);
  assert.match(html, /【死角】を持たないレガシーは、このレガシーを【戦闘】の攻撃対象に選ぶことができず、【守護】により攻撃先を変更することもできません/);
  assert.match(html, /手札以外から使用された場合は、【昇華】を発動することができません/);
  assert.match(html, /同時に発生した効果は、<strong>ターンプレイヤーから好きな順番<\/strong>/);
  assert.match(html, /オオクニヌシ[\s\S]*?難易度 ★★★/);
  assert.doesNotMatch(html, /隠密/);
});

test("battle end phase enforces the eight-card hand limit", () => {
  assert.match(html, /const BATTLE_HAND_LIMIT = 8/);
  assert.match(html, /await this\._battleEnforceHandLimit\(endingSide\)/);
  assert.match(html, /手札上限は\$\{BATTLE_HAND_LIMIT\}枚です/);
  assert.match(html, /dslAskCustomTargets\([\s\S]*?false, true/);
  assert.match(html, /player\[destination\]\.push\(card\)/);
});

test("pick guide annotates full nickname and card name before shorter aliases", () => {
  assert.match(html, /const full = c\.nickname \? `\$\{c\.nickname\}・\$\{c\.name\}` : c\.name/);
  assert.match(html, /Object\.keys\(nameMap\)\.sort\(\(a, b\) => b\.length - a\.length\)/);
  assert.match(html, /\.howto-card-ref\s*\{[\s\S]*?white-space:\s*nowrap/);
});

test("higanbana corner artwork decorates all three requested screens without blocking UI", () => {
  assert.equal((html.match(/src="ui_decorations\/higanbana-left\.png"/g) || []).length, 3);
  assert.equal((html.match(/src="ui_decorations\/higanbana-right\.png"/g) || []).length, 3);
  assert.match(html, /\.higanbana-corner\s*\{[\s\S]*?pointer-events:\s*none/);
  assert.match(html, /@media \(max-width:\s*700px\)\s*\{[\s\S]*?\.higanbana-corner\s*\{\s*display:\s*none/);
  assert.match(html, /\.gm-modal\s*\{[\s\S]*?position:\s*relative;\s*z-index:\s*1/);
});

test("card pool lazily loads smaller thumbnails without repeating Drive discovery", () => {
  assert.match(html, /Vue\.directive\("lazy-card-bg"/);
  assert.match(html, /IntersectionObserver/);
  assert.match(html, /rootMargin:\s*"600px 0px"/);
  assert.match(html, /v-lazy-card-bg="cardImageUrl\(card, 320\)"/);
  assert.match(html, /cardImageUrl\(card, width = 600\)/);
  assert.match(html, /localCardImageUrl\(no, !!card\.isKami, requestedWidth, this\.BUILD_VERSION\)/);
  assert.match(html, /assetWidth = Number\(width\) <= 400 \? 320 : 600/);
  assert.match(html, /driveThumbUrl\(fileId, requestedWidth\)/);
  assert.match(html, /!this\.driveFileMap \|\| Object\.keys\(this\.driveFileMap\)\.length === 0/);
  assert.doesNotMatch(html, /cardFileMap/);
  for (const width of [320, 600]) {
    assert.equal(fs.readdirSync(path.join(__dirname, "..", "card_images", String(width))).filter(name => name.endsWith(".webp")).length, 198);
    assert.equal(fs.readdirSync(path.join(__dirname, "..", "kami_card_images", String(width))).filter(name => name.endsWith(".webp")).length, 10);
  }
});

test("battle result frames winner dialogue and optional defeated Kami artwork", () => {
  const victoryMatch = html.match(/const KAMI_VICTORY_LINES = Object\.freeze\((\{[\s\S]*?\})\);/);
  assert.ok(victoryMatch);
  const victoryLines = new Function(`return (${victoryMatch[1]});`)();
  assert.deepEqual(Object.keys(victoryLines), ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
  for (let winner = 1; winner <= 10; winner++) {
    const expectedLosers = Array.from({ length: 10 }, (_, i) => String(i + 1)).filter(no => no !== String(winner));
    assert.deepEqual(Object.keys(victoryLines[String(winner)]), expectedLosers);
    assert.equal(Object.values(victoryLines[String(winner)]).every(line => typeof line === "string" && line.length > 0), true);
  }
  assert.equal(Object.values(victoryLines).reduce((sum, lines) => sum + Object.keys(lines).length, 0), 90);
  assert.match(html, /battleResultLoserKami\(\)/);
  assert.match(html, /battleResultVictoryLine\(\)/);
  assert.match(html, /battleResultVictoryLineClauses\(\)/);
  assert.match(html, /class="battle-result-dialogue-clause"/);
  assert.match(html, /text-wrap:\s*balance/);
  assert.match(html, /v-if="battleResultWinnerKami && battleResultLoserKami" class="battle-result-duel"/);
  assert.match(html, /class="battle-result-portrait winner"/);
  assert.match(html, /class="battle-result-portrait loser"/);
  assert.match(html, /v-if="battleResultWinnerKami && battleResultLoserKami" class="battle-result-dialogue"/);
  assert.match(html, /battleResultPortraitUrl\(battleResultLoserKami, 'defeat'\)/);
  assert.match(html, /kami_illustrations\/defeat\//);
  assert.match(html, /img\.dataset\.expression === 'defeat'/);
  assert.equal(fs.existsSync(path.join(__dirname, "..", "kami_illustrations", "defeat", "README.md")), true);
  const kamiManifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "kami_illustrations", "manifest.json"), "utf8"));
  for (const filename of Object.values(kamiManifest)) {
    assert.equal(fs.existsSync(path.join(__dirname, "..", "kami_illustrations", "defeat", filename)), true, filename);
  }
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

test("mulligan, reroll, evolution and kami image replacement UX stays intentional", () => {
  const mulligan = html.match(/<div v-if="battleMulligan"[\s\S]*?<div class="battle-board">/);
  assert.ok(mulligan);
  assert.doesNotMatch(mulligan[0], /フィールドを確認/);
  assert.match(html, /リロールに使用できるカード/);
  assert.match(html, /cards: Array\.isArray\(options\.cards\)/);
  assert.match(html, /'reroll',\s*\{ cards: candidates \}/);
  assert.doesNotMatch(html, /\.battle-card\.field-card\.evolved::after/);
  assert.match(html, /KAMI_ILLUST_MANIFEST_URL/);
  assert.match(html, /kami_illustrations\/manifest\.json/);
  assert.match(html, /file\.localUrl/);
});
test("battle opening, legacy readiness, Orochi cut-ins and scoring skip stay wired", () => {
  assert.match(html, /deck\.splice\(0, Math\.min\(4, deck\.length\)\)/);
  assert.match(html, /初期手札はマリガン時点で4枚[\s\S]*?this\._battleDrawForTurn\(side\)/);
  assert.match(html, /legacy-action-sick/);
  assert.match(html, /summon-piyopiyo/);
  assert.match(html, /legacy-action-both/);
  assert.match(html, /kami_cutin_eyes\/10\.png/);
  assert.match(html, /orochi-skill2/);
  assert.match(html, /this\._sfxStop\('endofwar'\)/);
  assert.match(html, /gsSkipScoringReveal/);
});

test("four-player scoring keeps its vertical Kami reveal and victory BGM", () => {
  assert.match(html, /:src="kamiSelectionIllustrationUrl\(gsScoringWinnerKami\)"/);
  assert.match(html, /GS_SCORING_KAMI_LINES/);
  assert.match(html, /gsScoringWinnerLine/);
  assert.match(html, /100% \{ opacity: 1; transform: scale\(1\); filter: brightness\(1\); \}/);
  const skip = html.match(/gsSkipScoringReveal\(\) \{([\s\S]*?)\r?\n    \},/);
  assert.ok(skip, "scoring skip handler was not found");
  assert.match(skip[1], /_bgmPlay\('victory'\)/);
  assert.doesNotMatch(skip[1], /_bgmStopCurrentSource|bgmCurrentKey\s*=\s*null/);
});

test("summoning sickness uses circling chicks and Orochi has the requested skill line", () => {
  assert.match(html, /\.summon-piyopiyo i::before \{ content:'🐥'/);
  assert.match(html, /@keyframes piyopiyoChickOrbitKf/);
  assert.match(html, /skill1: "終焉の刻は近づいているぞ"/);
});

test("Kashima disables choices whose required targets do not exist", () => {
  const ability = effectSpec["72"].能力.find(entry => entry.契機 === "出現時");
  const choice = ability.処理.find(action => action.操作 === "選択");
  assert.equal(choice.選択肢.length, 3);
  assert.deepEqual(choice.選択肢[0].条件.存在.絞込, ["レリック"]);
  assert.equal(choice.選択肢[0].条件.存在.領域, "hand");
  assert.equal(choice.選択肢[1].条件.存在.比較, "untapped");
  assert.equal(choice.選択肢[1].処理[0].対象.比較, "untapped");
  assert.equal(choice.選択肢[2].条件.存在.領域, "hand");
});
