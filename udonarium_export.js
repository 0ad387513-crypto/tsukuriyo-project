/**
 * udonarium_export.js  v2
 * ユドナリウムコネクト用 card-stack ZIP を生成してダウンロード
 *
 * 実際のZIPフォーマット（xml_山札_2026-06-10_2148.zip）から判明した仕様:
 *   - ルート要素: <card-stack>
 *   - カード画像: ZIPに {sha256hash}.webp として埋め込み
 *   - XMLの front/back フィールド: SHA-256ハッシュ文字列（拡張子なし）
 *   - size: 2（カードサイズ固定）
 *   - detail: 空（サンプルに倣う）
 *
 * 依存: JSZip（既存 deck_builder.html に読み込み済み）
 */

"use strict";

/* ------------------------------------------------------------------ */
/* UUID v4 生成                                                         */
/* ------------------------------------------------------------------ */
function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/* ------------------------------------------------------------------ */
/* SHA-256 ハッシュ（Web Crypto API）                                  */
/* ------------------------------------------------------------------ */
async function sha256hex(arrayBuffer) {
  const hashBuf = await crypto.subtle.digest("SHA-256", arrayBuffer);
  return Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/* ------------------------------------------------------------------ */
/* 画像取得 → canvas 経由 WebP 変換 → ハッシュ計算                     */
/* CORS対応: crossOrigin="anonymous" で <img> 経由                     */
/* ------------------------------------------------------------------ */
async function fetchImageAsWebp(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = async () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width  = img.naturalWidth  || 744;
        canvas.height = img.naturalHeight || 1039;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(async (blob) => {
          if (!blob) { resolve(null); return; }
          const arrayBuf = await blob.arrayBuffer();
          const hash = await sha256hex(arrayBuf);
          resolve({ hash, blob });
        }, "image/webp", 0.90);
      } catch (e) {
        console.warn("Image convert error:", url, e);
        resolve(null);
      }
    };
    img.onerror = () => {
      console.warn("Image load failed:", url);
      resolve(null);
    };
    img.src = url;
  });
}

/* ------------------------------------------------------------------ */
/* XML エスケープ                                                        */
/* ------------------------------------------------------------------ */
function xe(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/* ------------------------------------------------------------------ */
/* <card> XML 要素生成（1枚分）                                         */
/* ------------------------------------------------------------------ */
function buildCardElement(cardName, frontHash, backHash, zindex, faceUp) {
  const cardId    = uuidv4();
  const dataId    = uuidv4();
  const imgId     = uuidv4();
  const imgInnId  = uuidv4();
  const frontId   = uuidv4();
  const backId    = uuidv4();
  const commonId  = uuidv4();
  const nameId    = uuidv4();
  const sizeId    = uuidv4();
  const detailId  = uuidv4();

  const state = faceUp ? "0" : "1";
  // location.x/y を少しずつずらして山になるよう設定（サンプルに倣う）
  const lx = 301.01657961506163;
  const ly = -296.16654458564176;

  return `    <card state="${state}" rotate="0" owner="" zindex="${zindex}" location.name="table" location.x="${lx}" location.y="${ly}" posZ="0" identifier="${cardId}" isLocked="false" previewBackFace="false" hitArea1HeightPercent="100" hitArea1WidthPercent="100" hitArea1StartXPercent="0" hitArea1StartYPercent="0" hitArea2HeightPercent="0" hitArea2WidthPercent="0" hitArea2StartXPercent="0" hitArea2StartYPercent="0" hitArea3HeightPercent="0" hitArea3WidthPercent="0" hitArea3StartXPercent="0" hitArea3StartYPercent="0" enableHitAreaTuning="false" hideHitAreaColor="false" angleSwapEnabled="false" angleSwapImageIdentifier="" angleSwapAnglesCsv="" frontMemoEnabled="false" frontMemoFontSize="5" frontMemoAspectW="2" frontMemoAspectH="3" frontMemoBorderRadius="8" frontMemoCentered="false" frontMemoVCentered="false" frontMemoShowImage="false" frontMemoAlwaysShow="false" frontMemoLetterSpacing="0" hideOwnerNameOnSelfView="false" isSharedAcrossTables="false">
      <data identifier="${dataId}" name="card">
        <data identifier="${imgId}" name="image">
          <data identifier="${imgInnId}" type="image" name="imageIdentifier"></data>
          <data identifier="${frontId}" type="image" name="front">${xe(frontHash)}</data>
          <data identifier="${backId}" type="image" name="back">${xe(backHash)}</data>
        </data>
        <data identifier="${commonId}" name="common">
          <data identifier="${nameId}" name="name">${xe(cardName)}</data>
          <data identifier="${sizeId}" name="size">2</data>
        </data>
        <data identifier="${detailId}" name="detail"></data>
      </data>
    </card>`;
}

/* ------------------------------------------------------------------ */
/* <card-stack> XML 全体を組み立て                                      */
/* ------------------------------------------------------------------ */
function buildCardStackXml(cards, imageHashMap, backHash, deckName, kamiBackHash) {
  const stackId  = uuidv4();
  const dataId   = uuidv4();
  const imgId    = uuidv4();
  const imgInnId = uuidv4();
  const commonId = uuidv4();
  const nameId   = uuidv4();
  const detailId = uuidv4();
  const nodeId   = uuidv4();

  const cardCount = cards.length;

  const cardLines = cards.map((c, i) => {
    const name       = c._fullName || c.name || "カード";
    const frontHash  = imageHashMap[c._imageKey] || "";
    const thisBack   = c._isKami ? (kamiBackHash || backHash) : backHash;
    return buildCardElement(name, frontHash, thisBack, i, !!c._isKami);
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<card-stack rotate="0" zindex="163" owner="" isShowTotal="true" location.name="table" location.x="475" location.y="-200" posZ="0" identifier="${stackId}" isPositionFixed="false" returnFaceMode="current" isInstantDrawAndGrabEnabled="true" drawVisibility="auto" isHeightOffsetByCount="false" targetTerrainNumber="0" cardStackNumber="${cardCount}" nameFontSize="15" countPrefix="" countSuffix="枚" isSharedAcrossTables="false">`,
    `  <data identifier="card-stack_${dataId}" name="card-stack">`,
    `    <data identifier="image_${imgId}" name="image">`,
    `      <data identifier="imageIdentifier_${imgInnId}" type="image" name="imageIdentifier"></data>`,
    `    </data>`,
    `    <data identifier="common_${commonId}" name="common">`,
    `      <data identifier="name_${nameId}" name="name">${xe(deckName)}</data>`,
    `    </data>`,
    `    <data identifier="detail_${detailId}" name="detail"></data>`,
    `  </data>`,
    `  <node identifier="cardRoot_${nodeId}" name="cardRoot">`,
    ...cardLines,
    `  </node>`,
    `</card-stack>`,
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/* メイン：エクスポート                                                  */
/* ------------------------------------------------------------------ */
/**
 * @param {Object[]} mainDeck      メインデッキのカード配列（40枚）
 * @param {Object|null} kamiCard   カミカード（null 可）
 * @param {Function} imageUrlFn    (card) => URL文字列
 * @param {string}  [deckName]     デッキ名（省略時は自動生成）
 * @param {Function} [onProgress]  (current, total) => void  進捗コールバック
 * @param {string}  [cardBackUrl]  通常カード裏面画像URL（省略時は裏面なし）
 * @param {string}  [kamiBackUrl]  カミカード裏面画像URL（省略時は cardBackUrl と同じ）
 */
async function exportToUdonarium(mainDeck, kamiCard, imageUrlFn, deckName, onProgress, cardBackUrl, kamiBackUrl) {
  if (typeof JSZip !== "function") {
    throw new Error("JSZipが読み込まれていません。ページを再読み込みしてください。");
  }
  if (!mainDeck || mainDeck.length === 0) {
    throw new Error("デッキが空です。");
  }

  /* ── 1. カードリスト組み立て ── */
  const cards = [
    ...mainDeck.map(c => ({
      ...c,
      _fullName:  c.nickname ? `${c.nickname}・${c.name}` : c.name,
      _imageKey:  imageUrlFn(c) || "",
    })),
    ...(kamiCard ? [{
      ...kamiCard,
      _fullName:  (kamiCard.nickname ? `${kamiCard.nickname}・${kamiCard.name}` : kamiCard.name) + "【カミ】",
      _imageKey:  imageUrlFn(kamiCard) || "",
      _isKami:    true,
    }] : []),
  ];

  /* ── 2. ユニークURLを収集（重複取得を避ける） ── */
  const urlSet = new Set(cards.map(c => c._imageKey).filter(Boolean));
  const backUrl     = cardBackUrl || "";
  const kamiBack    = kamiBackUrl || backUrl;  // カミ専用裏面がなければ通常裏面を使用
  if (backUrl)  urlSet.add(backUrl);
  if (kamiBack && kamiBack !== backUrl) urlSet.add(kamiBack);

  /* ── 3. 画像を取得してハッシュ計算 ── */
  const imageHashMap = {}; // url  → hash
  const imageBlobs   = {}; // hash → Blob
  let done = 0;
  const total = urlSet.size;

  for (const url of urlSet) {
    const result = await fetchImageAsWebp(url);
    if (result) {
      imageHashMap[url]          = result.hash;
      imageBlobs[result.hash]    = result.blob;
    }
    done++;
    onProgress && onProgress(done, total);
  }

  /* ── 4. 裏面ハッシュ決定 ── */
  const backHash     = backUrl  ? (imageHashMap[backUrl]  || "") : "";
  const kamiBackHash = kamiBack ? (imageHashMap[kamiBack] || "") : backHash;

  /* ── 5. XML 生成 ── */
  const dt   = new Date();
  const date = dt.getFullYear() +
    ("0" + (dt.getMonth() + 1)).slice(-2) +
    ("0" + dt.getDate()).slice(-2);
  const kamiPart = kamiCard
    ? "_" + (kamiCard.nickname ? `${kamiCard.nickname}・${kamiCard.name}` : kamiCard.name)
    : "";
  const name  = deckName || `ツクリヨデッキ${kamiPart}_${date}`;
  const fname = `${name}.zip`;

  const xml = buildCardStackXml(cards, imageHashMap, backHash, name, kamiBackHash);

  /* ── 6. ZIP 組み立て ── */
  const zip = new JSZip();
  zip.file("data.xml", xml);

  for (const [hash, blob] of Object.entries(imageBlobs)) {
    zip.file(`${hash}.webp`, blob);
  }

  /* ── 7. ダウンロード ── */
  const zipBlob = await zip.generateAsync({
    type:        "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  const dlUrl  = URL.createObjectURL(zipBlob);
  const link   = document.createElement("a");
  link.href     = dlUrl;
  link.download = fname;
  link.click();
  setTimeout(() => URL.revokeObjectURL(dlUrl), 3000);

  return fname;
}

/* Node.js テスト用 */
if (typeof module !== "undefined") {
  module.exports = { exportToUdonarium, buildCardStackXml };
}
