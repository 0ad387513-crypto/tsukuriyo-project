/**
 * session.js
 * ツクリヨ ゲームセッション（4人）の管理ロジック
 *   - ロビー（セッション作成 / 参加 / 準備完了）
 *   - 壱 神託の儀（カミ選択：席順1→2→3→4で「3枚引いて1枚選ぶ」）
 *
 * 依存:
 *   - firebase.js（getDb, fbArr, generateRoomCode）
 *   - pack_generator.js（mulberry32, seededShuffle）
 *
 * Firebase データモデル（sessions/{code}）:
 *   {
 *     phase: "lobby" | "kami_select" | "kami_done",
 *     createdAt, hostId, seed,
 *     seats: {
 *       "1": { id, name, ready, kamiNo },   // 2,3,4 も同様（未参加席は欠落）
 *     },
 *     kami: { turn: 1..4, offer: { "1": [no,no,no], ... } }
 *   }
 *
 * 神託の儀ルール（説明書準拠）:
 *   - 全カミをシャッフルし、席1に3枚配る → 1枚選択、残り2枚は山に戻す
 *   - 山を再シャッフルして席2,3,4も同様（既に選ばれたカミは山から除外）
 *   - 選ばれなかったカミはゲームから除外
 *   ※ 選択により山が変わるため、配布は「その席の番が来た時」に都度行う（lazy）
 */

"use strict";

/* ================================================================== */
/* 純粋ヘルパー（Node テスト可能）                                       */
/* ================================================================== */

/** その席に配る3枚のカミNoを決定論的に算出（seed＋席番号で再現可能） */
function dealKamiCandidatesFor(allKamiNos, pickedNos, seed, seat) {
  const pickedSet = new Set((pickedNos || []).map(String));
  const remaining = (allKamiNos || []).filter(no => !pickedSet.has(String(no)));
  const rng       = mulberry32(((seed | 0) + seat * 131 + 17) | 0);
  const shuffled  = seededShuffle(remaining, rng);
  return shuffled.slice(0, Math.min(3, shuffled.length));
}

/** セッション内で既に選ばれたカミNoの一覧 */
function pickedKamiNos(s) {
  const out = [];
  for (let n = 1; n <= 4; n++) {
    const seat = s.seats && s.seats[n];
    if (seat && seat.kamiNo != null && seat.kamiNo !== "") out.push(seat.kamiNo);
  }
  return out;
}

/** 全4席が埋まっているか */
function allSeatsFilled(s) {
  return [1, 2, 3, 4].every(n => s.seats && s.seats[n] && s.seats[n].id);
}

/** 全4席が準備完了か */
function allSeatsReady(s) {
  return [1, 2, 3, 4].every(n => s.seats && s.seats[n] && s.seats[n].ready);
}

/* ================================================================== */
/* セッション作成                                                       */
/* ================================================================== */
/**
 * @param {string} playerName
 * @returns {Promise<{ sessionCode, playerId, seat: 1 }>}
 */
async function createSession(playerName) {
  const db       = getDb();
  const code     = generateRoomCode();
  const playerId = generateRoomCode();

  const session = {
    phase:     "lobby",
    createdAt: Date.now(),
    hostId:    playerId,
    seed:      null,
    seats: {
      1: { id: playerId, name: playerName || "プレイヤー1", ready: false, kamiNo: null },
    },
    kami: null,
  };

  await db.ref(`sessions/${code}`).set(session);

  // 2時間後に自動削除（Firebase側のTTLが無いためクライアント側タイマー）
  setTimeout(() => db.ref(`sessions/${code}`).remove(), 2 * 60 * 60 * 1000);

  return { sessionCode: code, playerId, seat: 1 };
}

/* ================================================================== */
/* セッション参加（空いている席 2〜4 に着席）                            */
/* ================================================================== */
/**
 * @param {string} code
 * @param {string} playerName
 * @returns {Promise<{ playerId, seat }>}
 */
async function joinSession(code, playerName) {
  const db  = getDb();
  const ref = db.ref(`sessions/${code}`);

  const snap = await ref.once("value");
  if (!snap.exists()) throw new Error("セッションが見つかりません");
  if (snap.val().phase !== "lobby") throw new Error("このセッションはすでに開始されています");

  const playerId = generateRoomCode();

  const res = await ref.transaction(cur => {
    if (!cur) return cur;
    if (cur.phase !== "lobby") return;          // 開始済み → 中止
    cur.seats = cur.seats || {};
    let seat = null;
    for (let n = 1; n <= 4; n++) {
      if (!cur.seats[n] || !cur.seats[n].id) { seat = n; break; }
    }
    if (seat === null) return;                  // 満員 → 中止
    cur.seats[seat] = {
      id: playerId, name: playerName || ("プレイヤー" + seat), ready: false, kamiNo: null,
    };
    return cur;
  });

  if (!res.committed) throw new Error("入室に失敗しました（満員またはセッション開始済み）");

  const committed = res.snapshot.val();
  let seat = null;
  for (let n = 1; n <= 4; n++) {
    if (committed.seats[n] && committed.seats[n].id === playerId) { seat = n; break; }
  }
  if (seat === null) throw new Error("満員です");

  return { playerId, seat };
}

/* ================================================================== */
/* CPU席（席3・4限定）                                                  */
/* ================================================================== */
/* 「プレイヤー2人＋CPU2人」構成用。CPUは席3・4のみを占有し、ドラフトの
 * 数合わせとして参加する（星戦は人間2人同士でのみ行う）。
 * CPU席は ready:true 固定・isCpu:true でマークし、既存の
 * allSeatsFilled / allSeatsReady 判定をそのまま通す。 */

/** セッション内のCPU席番号一覧（isCpu:true の席） */
function cpuSeatsOf(s) {
  const out = [];
  for (let n = 1; n <= 4; n++) {
    if (s && s.seats && s.seats[n] && s.seats[n].isCpu) out.push(n);
  }
  return out;
}

/** CPU席が1つでもあるか */
function sessionHasCpu(s) {
  return cpuSeatsOf(s).length > 0;
}

/** ロビーでCPUを1体追加（席3→席4の順で空席に着席。ホスト操作想定） */
async function addCpuSeat(code) {
  const ref = getDb().ref(`sessions/${code}`);
  const res = await ref.transaction(s => {
    if (!s || s.phase !== "lobby") return;      // ロビー以外 → 中止
    s.seats = s.seats || {};
    let seat = null;
    for (const n of [3, 4]) {                    // CPUは席3・4のみ
      if (!s.seats[n] || !s.seats[n].id) { seat = n; break; }
    }
    if (seat === null) return;                   // 空きなし → 中止
    s.seats[seat] = {
      id: "cpu-" + seat, name: "CPU" + seat, ready: true, isCpu: true, kamiNo: null,
    };
    return s;
  });
  if (!res.committed) throw new Error("CPUを追加できません（席3・4が埋まっているか、開始済みです）");
}

/** ロビーでCPU席を1つ外す（席4→席3の順。ホスト操作想定） */
async function removeCpuSeat(code) {
  const ref = getDb().ref(`sessions/${code}`);
  await ref.transaction(s => {
    if (!s || s.phase !== "lobby") return s;
    for (const n of [4, 3]) {
      if (s.seats && s.seats[n] && s.seats[n].isCpu) { s.seats[n] = null; break; }
    }
    return s;
  });
}

/* ================================================================== */
/* 準備完了（全4席が ready になったら神託の儀へ自動遷移）                */
/* ================================================================== */
async function setSeatReady(code, seat) {
  const db  = getDb();
  const ref = db.ref(`sessions/${code}`);

  await ref.child(`seats/${seat}/ready`).set(true);

  await ref.transaction(s => {
    if (!s) return s;
    if (s.phase !== "lobby") return s;
    if (allSeatsFilled(s) && allSeatsReady(s)) {
      s.phase = "kami_select";
      if (!s.seed) s.seed = Math.floor(Math.random() * 1e9);
      s.kami = { turn: 1, offer: {} };
    }
    return s;
  });
}

/* ================================================================== */
/* 準備解除（ロビーで取り消し）                                          */
/* ================================================================== */
async function unsetSeatReady(code, seat) {
  const ref = getDb().ref(`sessions/${code}`);
  await ref.transaction(s => {
    if (!s || s.phase !== "lobby") return s;
    if (s.seats && s.seats[seat]) s.seats[seat].ready = false;
    return s;
  });
}

/* ================================================================== */
/* 神託の儀：自分の番のカミ候補3枚を配布（未配布なら）                   */
/* ================================================================== */
/**
 * @param {string}   code
 * @param {number}   seat
 * @param {Array}    kamiNoList  全カミのNo一覧（クライアントの allKamiCards 由来）
 */
async function dealKamiOffer(code, seat, kamiNoList) {
  const ref = getDb().ref(`sessions/${code}`);
  await ref.transaction(s => {
    if (!s || s.phase !== "kami_select" || !s.kami) return s;
    if (s.kami.turn !== seat) return s;                 // 自分の番のみ配布
    s.kami.offer = s.kami.offer || {};
    if (s.kami.offer[seat]) return s;                   // 配布済み
    s.kami.offer[seat] = dealKamiCandidatesFor(
      kamiNoList, pickedKamiNos(s), s.seed, seat
    );
    return s;
  });
}

/* ================================================================== */
/* 神託の儀：カミを1枚選択（配られた3枚の中から）                        */
/* ================================================================== */
async function pickKami(code, seat, kamiNo) {
  const ref = getDb().ref(`sessions/${code}`);
  await ref.transaction(s => {
    if (!s || s.phase !== "kami_select" || !s.kami) return s;
    if (s.kami.turn !== seat) return s;                 // 自分の番のみ
    const offer = (s.kami.offer && s.kami.offer[seat]) ? fbArr(s.kami.offer[seat]) : [];
    if (!offer.map(String).includes(String(kamiNo))) return s; // 配られた3枚のみ
    if (!s.seats[seat]) return s;

    s.seats[seat].kamiNo = kamiNo;

    if (seat >= 4) {
      s.phase = "kami_done";                            // 全員選択完了
    } else {
      s.kami.turn = seat + 1;                           // 次の席へ（席は1〜4全て埋まっている）
    }
    return s;
  });
}

/* ================================================================== */
/* 弐 選別の儀（4人ドラフト）                                            */
/* ================================================================== */
/* ラウンドごとの配分（更新ルール 2026-06）:
 *   R1: 10枚束 × 4人 × 3セット = 120枚 → 各自30枚（左隣へ渡す）
 *   R2: 10枚束 × 4人 × 1セット =  40枚 → 各自10枚（右隣へ渡す）
 *   R3:  5枚束 × 4人 × 1セット =  20枚 → 各自 5枚（左隣へ渡す）
 *
 * 進行方式（ブースタードラフト）:
 *   全員が現在のパックから1枚選び、残りを隣へ一斉に回す。
 *   全員が選び終わった時点でパスが成立し、パックが空になるまで繰り返す。
 *   1セット完了で次セットを配り、全セット完了でそのラウンドのドラフト終了。
 */
const DRAFT_ROUND_CONFIG = {
  1: { numSets: 3, bundleSize: 10, direction: 'L' },
  2: { numSets: 1, bundleSize: 10, direction: 'R' },
  3: { numSets: 1, bundleSize: 5,  direction: 'L' },
};

/** そのラウンドで各プレイヤーが取得する枚数 */
function draftRoundTarget(round) {
  const cfg = DRAFT_ROUND_CONFIG[round];
  return cfg ? cfg.numSets * cfg.bundleSize : 0;
}

/** パックの中身（カードno配列）を取り出す。
 *  新フォーマット: { round, origSeat, setIdx, cards:[...] }
 *  旧フォーマット: [...]
 *  どちらにも対応。空配列はnullになることがあるためfbArrで正規化。
 */
function packCards(pack) {
  if (!pack) return [];
  if (Array.isArray(pack)) return pack;
  if ('cards' in pack) return fbArr(pack.cards);
  // 旧フォーマット fallback：オブジェクト全体が numeric-keyed array
  return fbArr(pack);
}

/** パックを隣へ回す（'L'=左隣 seat-1 / 'R'=右隣 seat+1）。束のメタ情報（origSeat/setIdx/round）は維持。 */
function rotatePacks(packs, dir) {
  const out = {};
  for (let s = 1; s <= 4; s++) {
    const target = dir === 'L' ? (s === 1 ? 4 : s - 1)
                               : (s === 4 ? 1 : s + 1);
    out[target] = packs[s];          // 束オブジェクトごと移動（origSeat等を維持）
  }
  return out;
}

/** ラウンドのカードプール（no配列）を numSets×4 の束に分割（決定論）。
 *  各束は { round, origSeat, setIdx, cards:[...] } 形式。 */
function dealDraftSets(cardNos, seed, round) {
  const cfg = DRAFT_ROUND_CONFIG[round];
  const rng = mulberry32(((seed | 0) + round * 777 + 31) | 0);
  const shuffled = seededShuffle((cardNos || []).map(String), rng);
  const sets = [];
  let idx = 0;
  for (let st = 0; st < cfg.numSets; st++) {
    const packs = { 1: null, 2: null, 3: null, 4: null };
    for (let seat = 1; seat <= 4; seat++) {
      packs[seat] = {
        round,
        origSeat: seat,
        setIdx: st,
        cards: shuffled.slice(idx, idx + cfg.bundleSize),
      };
      idx += cfg.bundleSize;
    }
    sets.push(packs);
  }
  return sets;
}

/**
 * ドラフト開始（idempotent：同ラウンドで既に進行中なら何もしない）
 * @param {string}  code
 * @param {number}  round         1〜3
 * @param {Array}   roundCardNos  そのラウンドのカードno配列（クライアントの allCards 由来）
 */
async function startDraft(code, round, roundCardNos) {
  const cfg = DRAFT_ROUND_CONFIG[round];
  if (!cfg) throw new Error('不正なラウンド: ' + round);
  const ref = getDb().ref(`sessions/${code}`);
  await ref.transaction(s => {
    if (!s) return s;
    if (s.draft && s.draft.round === round && !s.draft.done) return s; // 開始済み
    const seed = s.seed || Math.floor(Math.random() * 1e9);
    const sets = dealDraftSets(roundCardNos, seed, round);
    s.seed  = seed;
    s.draft = {
      round,
      numSets:   cfg.numSets,
      bundleSize: cfg.bundleSize,
      direction: cfg.direction,
      setIndex:  0,
      step:      0,
      sets,
      packs:     sets[0],
      picks:     {},
      done:      false,
    };
    s.round = round;        // 現在のラウンド
    s.phase = 'draft';
    return s;
  });
}

/**
 * カードを1枚ピック。全員が選ぶと自動でパス（パック回転）し、
 * セット／ラウンドの完了も自動処理する。
 */
async function draftPick(code, seat, cardNo) {
  const ref = getDb().ref(`sessions/${code}`);
  await ref.transaction(s => {
    if (!s || s.phase !== 'draft' || !s.draft || s.draft.done) return s;
    const d = s.draft;
    d.picks = d.picks || {};
    if (d.picks[seat] != null) return s;                  // 既にこのステップで選択済み
    const myPackObj = d.packs && d.packs[seat];
    const myCards   = packCards(myPackObj);
    if (myCards.findIndex(c => String(c) === String(cardNo)) < 0) return s; // 自分のパックに無い
    d.picks[seat] = cardNo;

    // 全員が選んだら一斉にパス
    const allPicked = [1, 2, 3, 4].every(n => d.picks[n] != null);
    if (allPicked) {
      s.decks = s.decks || { 1: [], 2: [], 3: [], 4: [] };
      const remaining = {};
      for (let n = 1; n <= 4; n++) {
        const packObj  = d.packs[n];
        const cardsArr = packCards(packObj).slice();
        const chosen   = d.picks[n];
        const i = cardsArr.findIndex(c => String(c) === String(chosen));
        if (i >= 0) cardsArr.splice(i, 1);                // 同名カードでも1枚だけ取り除く
        s.decks[n] = [...fbArr(s.decks[n]), chosen];
        // 束メタ情報を保持しつつカードを更新
        if (packObj && typeof packObj === 'object' && !Array.isArray(packObj)) {
          remaining[n] = { ...packObj, cards: cardsArr };
        } else {
          remaining[n] = cardsArr;                        // 旧フォーマット fallback
        }
      }
      d.packs = rotatePacks(remaining, d.direction);
      d.picks = {};
      d.step  = (d.step || 0) + 1;

      const emptyAll = [1, 2, 3, 4].every(n => packCards(d.packs[n]).length === 0);
      if (emptyAll) {
        if (d.setIndex < d.numSets - 1) {
          d.setIndex += 1;
          d.packs = fbArr(d.sets)[d.setIndex];            // 次セットを配る
          d.step  = 0;
        } else {
          d.done = true;
          d.completedRound = d.round;
          s.phase = 'draft_done';                         // ラウンドのドラフト完了
        }
      }
    }
    return s;
  });
}

/* ================================================================== */
/* 深化の刻（見識の使用：省察 / 理の開花）                               */
/* ================================================================== */
/* 見識の獲得:
 *   - ゲーム開始時: 全員 +1（初回の深化の刻で付与）
 *   - 深化の刻 開始時: 直前の星戦の 勝者+1 / 敗者+3（星戦実装後=Step5で連結）
 * 使用:
 *   - 省察 (見識1): デッキから1枚を星魂に変換（デッキから除去・変換分を記録）
 *   - 理の開花 (見識3): ジェネシスを3枚引いて1枚をデッキに加える
 * 見識はラウンドを超えて持ち越し可能。
 */

/* 星戦の対戦カード（総当たり）: 各ラウンド 卓1/卓2 のペア */
const PAIRINGS = {
  1: [[1, 2], [3, 4]],
  2: [[1, 3], [2, 4]],
  3: [[1, 4], [2, 3]],
};

/** そのラウンドの実際のペアリングを返す。
 *  CPUあり構成（プレイヤー2人＋CPU2人）では総当たりにせず、
 *  常に「人間2人＝卓1／CPU2人＝卓2」に固定する（星戦は人間同士でのみ行うため）。 */
function pairingsFor(s, round) {
  if (!sessionHasCpu(s)) return PAIRINGS[round];
  const cpus = cpuSeatsOf(s);
  const humans = [1, 2, 3, 4].filter(n => !cpus.includes(n));
  // 想定は 人間[1,2]/CPU[3,4]。想定外の席構成でも人間卓を先頭に安定して組む
  return [humans.slice(0, 2), cpus.slice(0, 2)];
}

/** あるラウンドの星戦で seat が勝ったか（battle={t1Winner,t2Winner}） */
function battleWonBySeat(battle, pairs, seat) {
  if (!battle || !pairs) return false;
  const inT1 = pairs[0].map(String).includes(String(seat));
  const winner = inT1 ? battle.t1Winner : battle.t2Winner;
  return String(winner) === String(seat);
}

/**
 * 深化の刻フェーズへ移行。見識を付与：
 *   - ラウンド1: ゲーム開始時 全員+1
 *   - ラウンド2,3: 直前の星戦の 勝者+1 / 敗者+3
 * （いずれもラウンドごとに一度だけ。見識は持ち越し）
 */
async function startDeepen(code) {
  const ref = getDb().ref(`sessions/${code}`);
  await ref.transaction(s => {
    if (!s) return s;
    const round = s.round || 1;
    s.insight = s.insight || {};
    if (round === 1) {
      if (!s.insightInit) {
        for (let n = 1; n <= 4; n++) s.insight[n] = (s.insight[n] || 0) + 1;
        s.insightInit = true;
      }
    } else {
      const flag = `deepenInsight_r${round}`;
      if (!s[flag]) {
        const battle = s.battles && s.battles[round - 1];
        const pairs  = pairingsFor(s, round - 1);
        for (let n = 1; n <= 4; n++) {
          const won = battleWonBySeat(battle, pairs, n);
          s.insight[n] = (s.insight[n] || 0) + (won ? 1 : 3);
        }
        s[flag] = true;
      }
    }
    s.converted  = s.converted || { 1: [], 2: [], 3: [], 4: [] };
    s.deepenDone = {};
    s.bloomOffer = {};
    s.phase = 'deepen';
    return s;
  });
}

/** 省察：見識1で デッキの1枚を星魂に変換（デッキから除去） */
async function deepenReflect(code, seat, cardNo) {
  const ref = getDb().ref(`sessions/${code}`);
  await ref.transaction(s => {
    if (!s || s.phase !== 'deepen') return s;
    if (((s.insight && s.insight[seat]) || 0) < 1) return s;
    const deck = fbArr(s.decks && s.decks[seat]);
    const i = deck.findIndex(c => String(c) === String(cardNo));
    if (i < 0) return s;
    deck.splice(i, 1);
    s.decks[seat] = deck;
    s.converted = s.converted || {};
    s.converted[seat] = [...fbArr(s.converted[seat]), cardNo];
    s.insight[seat] = (s.insight[seat] || 0) - 1;
    return s;
  });
}

/** 習合：見識2で 次の星戦のマリガン権を1回取得（1ラウンドの深化で1度だけ） */
async function deepenFusion(code, seat) {
  const ref = getDb().ref(`sessions/${code}`);
  await ref.transaction(s => {
    if (!s || s.phase !== 'deepen') return s;
    if (((s.insight && s.insight[seat]) || 0) < 2) return s;
    const r = s.round || 1;
    s.fusionUsed = s.fusionUsed || {};
    s.fusionUsed[r] = s.fusionUsed[r] || {};
    if (s.fusionUsed[r][seat]) return s;          // この深化で既に習合済み
    s.fusionUsed[r][seat] = true;
    s.mulliganRights = s.mulliganRights || {};
    s.mulliganRights[seat] = true;                 // 次の星戦のマリガン権を1回付与
    s.insight[seat] = (s.insight[seat] || 0) - 2;
    return s;
  });
}

/** 理の開花：見識3で ジェネシスを3枚引く（束をシャッフルして3枚／見識-3） */
async function deepenBloomDraw(code, seat, genesisNos) {
  const ref = getDb().ref(`sessions/${code}`);
  await ref.transaction(s => {
    if (!s || s.phase !== 'deepen') return s;
    if (((s.insight && s.insight[seat]) || 0) < 3) return s;
    if ((genesisNos || []).length < 1) return s; // プールが空なら何もしない
    s.bloomOffer = s.bloomOffer || {};
    if (s.bloomOffer[seat]) return s;            // 既に引き済み（未確定）
    const a = (genesisNos || []).map(String);
    for (let k = a.length - 1; k > 0; k--) {     // Fisher-Yates（毎回シャッフル）
      const j = Math.floor(Math.random() * (k + 1));
      [a[k], a[j]] = [a[j], a[k]];
    }
    s.bloomOffer[seat] = a.slice(0, 3);
    s.insight[seat] = (s.insight[seat] || 0) - 3;
    return s;
  });
}

/** 理の開花：引いた3枚から1枚を選んでデッキに加える */
async function deepenBloomPick(code, seat, cardNo) {
  const ref = getDb().ref(`sessions/${code}`);
  await ref.transaction(s => {
    if (!s || s.phase !== 'deepen') return s;
    const offer = fbArr(s.bloomOffer && s.bloomOffer[seat]);
    if (!offer.map(String).includes(String(cardNo))) return s;
    s.decks[seat] = [...fbArr(s.decks && s.decks[seat]), cardNo];
    s.bloomOffer[seat] = null;                   // 消費（残り2枚は破棄）
    return s;
  });
}

/** 深化完了フラグの設定（全員完了で 星戦フェーズへ） */
async function deepenSetDone(code, seat, done) {
  const ref = getDb().ref(`sessions/${code}`);
  await ref.transaction(s => {
    if (!s || s.phase !== 'deepen') return s;
    s.deepenDone = s.deepenDone || {};
    s.deepenDone[seat] = !!done;
    if (done && [1, 2, 3, 4].every(n => s.deepenDone[n])) {
      const r = s.round || 1;
      s.battles = s.battles || {};
      if (!s.battles[r]) s.battles[r] = { t1Winner: null, t2Winner: null };
      s.phase = 'battle';   // 星戦（ユドナリウムで対戦→結果記録）
    }
    return s;
  });
}

/* ================================================================== */
/* 星戦（ユドナリウムで対戦し、勝敗だけ記録）                            */
/* ================================================================== */
/** 卓の勝者を記録（ホスト操作。table=1|2, winnerSeat=勝者の席） */
async function recordBattleResult(code, table, winnerSeat) {
  const ref = getDb().ref(`sessions/${code}`);
  await ref.transaction(s => {
    if (!s || s.phase !== 'battle') return s;
    const r = s.round || 1;
    s.battles = s.battles || {};
    s.battles[r] = s.battles[r] || { t1Winner: null, t2Winner: null };
    // 勝者がその卓のペアに含まれるか検証
    const pairs = pairingsFor(s, r);
    const pair  = table === 1 ? pairs[0] : pairs[1];
    if (!pair.map(String).includes(String(winnerSeat))) return s;
    if (table === 1) s.battles[r].t1Winner = winnerSeat;
    else             s.battles[r].t2Winner = winnerSeat;
    return s;
  });
}

/**
 * 星戦の結果記録後に進行（ホスト操作）。
 * 両卓の勝者が記録済みなら、ラウンド<3 は次の選別の儀へ、=3 は終戦集計へ。
 * @param {Array} nextRoundCardNos 次ラウンドのカードno配列（round<3のとき必須）
 */
async function advanceAfterBattle(code, nextRoundCardNos) {
  const ref  = getDb().ref(`sessions/${code}`);
  const snap = await ref.once('value');
  const s0   = snap.val();
  if (!s0 || s0.phase !== 'battle') return;
  const r = s0.round || 1;
  const b = s0.battles && s0.battles[r];
  if (!b || b.t1Winner == null || b.t2Winner == null) {
    throw new Error('両卓の勝者を記録してください');
  }
  // この星戦で使ったマリガン権を全消去（次の星戦は再度習合が必要）
  await ref.child('mulliganRights').set(null);
  if (r < 3) {
    await startDraft(code, r + 1, nextRoundCardNos);   // 次の選別の儀（phase=draft, round=r+1）
  } else {
    await ref.child('phase').set('scoring');           // 終戦集計
  }
}

/* ================================================================== */
/* 購読                                                                 */
/* ================================================================== */
function subscribeSession(code, callback) {
  const ref = getDb().ref(`sessions/${code}`);
  ref.on("value", snap => callback(snap.val()));
  return () => ref.off("value");
}

/* Node.js テスト用 */
if (typeof module !== "undefined") {
  module.exports = {
    createSession, joinSession, setSeatReady, unsetSeatReady,
    dealKamiOffer, pickKami, subscribeSession,
    dealKamiCandidatesFor, pickedKamiNos, allSeatsFilled, allSeatsReady,
    startDraft, draftPick, dealDraftSets, rotatePacks, draftRoundTarget,
    DRAFT_ROUND_CONFIG,
    startDeepen, deepenReflect, deepenFusion, deepenBloomDraw, deepenBloomPick,
    deepenSetDone, packCards,
    PAIRINGS, battleWonBySeat, recordBattleResult, advanceAfterBattle,
    cpuSeatsOf, sessionHasCpu, addCpuSeat, removeCpuSeat, pairingsFor,
  };
}
