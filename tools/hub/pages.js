/* 開発ダッシュボードに並べるページの一覧。ダッシュボード（index.html）と、ページを開く枠（view.html）が使う。
   （全ページを誰でも開ける。直す操作のボタンだけ、メンバーには押せない「キジマ専用」になる）
   memberHide … メンバーが開いたときに押せなくするボタン（text に当てはまる文字のボタン）と、隠す欄（selectors）
   items … ページの中で「タップすると、その対象の修正メモが開く」もの。selector に当てはまる要素を押すと、label(要素) が対象になる
   whole … 決まった区切りのないページ。操作部品以外の場所を押すと、target(document) が対象になる
   edit … キジマが押したときに開く修正画面（focus に対象を渡す） */
(() => {
  const text = (e, sel) => { const x = sel ? e.querySelector(sel) : e; return x ? x.textContent.replace(/\s+/g, " ").trim() : ""; };
  const selectedOptions = doc => [...doc.querySelectorAll("select")].map(s => s.selectedOptions[0] ? s.selectedOptions[0].textContent.trim() : "").filter(Boolean);
  const selectedOption = doc => { const s = doc.querySelector("select"); return s && s.selectedOptions[0] ? s.selectedOptions[0].textContent.trim() : ""; };
  window.DEV_PAGES = [
    { id: "field-kinds", group: "カード", title: "フィールドカードの枠", path: "/tools/field-card-kind-preview/", kind: "ui", desc: "現在の本番の枠と以前採用したH案を並べて比較　マナの輪・神攻力・戦闘力の札と過去の案も確認できます",
      items: [{ selector: ".comparison-table tbody td", label: e => text(e.parentElement, ".row-title") + "：" + text(e.closest("table").querySelector("thead th:nth-child(" + (e.cellIndex + 1) + ")")) }],
      whole: { target: doc => "フィールドカードの枠：" + selectedOptions(doc).join("・") } },
    { id: "voices", group: "ボイス・音", title: "ボイス", kind: "voice", desc: "試聴室と台本を1か所で。上のタブで切り替えます。",
      tabs: ["voice", "voice-script"] },
    { id: "voice", inside: "voices", group: "ボイス・音", title: "試聴室", path: "/tools/voice-preview/", kind: "voice", desc: "キャラごとの声と、作った台詞を聴いて確認。カミのボイスも「カミ」のタブで、台詞と演技の方針を直して作り直せます。",
      memberHide: { text: /決める|作る|作り直|削除|保存|追加|狙って|切り出|これにする|登録|コピー|まとめて|反映|戻す/, selectors: ["details", ".runner", "#runner", "input[type=checkbox]"] },
      items: [
        { selector: ".line-row", label: e => { const cast = text(e.closest(".cast") || e, ".cast-name"); const info = text(e, "small:not(.orig):not(.heard)").split("｜"); const line = text(e, ".spoken"); return cast + "：" + (info[0] || "") + (info[1] ? "（" + info[1] + "）" : "") + (line ? "「" + line + "」" : ""); } }, // 台詞ごとに分かるよう、話す場面と台詞の文まで入れる（.orig は「台本の文」の欄なので使わない）
        { selector: ".cast-name", label: e => text(e) + "（声）" },
      ] },
    { id: "voice-script", inside: "voices", group: "ボイス・音", title: "台本", path: "/tools/voice-script/", kind: "voice", desc: "台詞と掛け合いの一覧。",
      memberHide: { text: /保存|削除|追加|書き出|反映/, selectors: [] },
      items: [{ selector: ".row", label: e => text(e, ".card") }] },
    { id: "sfx", group: "ボイス・音", title: "SE 作業室", path: "/tools/sfx-lab/", kind: "se", desc: "効果音の計画と候補の試聴。", memberHide: { text: /作る|生成|採用|削除|保存/, selectors: [] }, items: [{ selector: "tr", label: e => { const use = text(e, ".use"); if (!use) return null; const td = e.querySelector("td"); const key = td ? (td.innerText || td.textContent).trim().split(/\s+/)[0] : ""; return use + (key ? "（" + key + "）" : ""); } }], whole: { target: () => "SE 全体" } },
    { id: "card-effects", group: "カード", title: "カード効果の一覧", path: "/tools/card-effects/", kind: "effect", desc: "全カードの画像と効果。変えたいカードを押すと、今の値が入った欄で属性・マナ・戦闘力・効果などを直せます。",
      proposal: true,
      items: [{ selector: ".ce-card", label: e => text(e, ".nm") }] },
    { id: "art", group: "イラスト", title: "イラスト・画像の一覧", path: "/tools/art-gallery/", kind: "illust", desc: "カミのイラスト・カミのカード・創世神技カットイン・ジェネシスカード・ちびキャラ（エモート・チュートリアル）・TOP画面の画像を、種類ごとに確認。",
      items: [{ selector: ".art", label: e => e.dataset.label }] },
    { id: "field-crop", aliases: ["field-art"], group: "イラスト", title: "場のカードの絵", path: "/tools/field-card-crop/", kind: "illust", desc: "対戦の場に出したときに見える部分をカードごとに確認。位置と拡大率はその場で試せます（保存はキジマ専用）。",
      items: [{ selector: ".cell", label: e => text(e, ".nm") }, { selector: ".item", label: e => text(e, ".nm") }] },
    { id: "card-gen", group: "カード", title: "カードジェネレーター", path: "/tools/card-editor/", kind: "illust", desc: "カードの文と画像を作る道具。見るのは誰でも、保存や反映はキジマ専用。",
      memberHide: { text: /保存|反映|生成|削除|設定|フォルダ|読み込み|更新/, selectors: [] } }, // メモは残さないページ（「メモを書く」のボタンを出さない）
    { id: "motion", group: "演出", title: "カミの対戦中モーション", kind: "motion", desc: "待機の呼吸・まばたき・ダメージの動きと、対戦画面と同じ配置で流れを見るデモ。上のタブで切り替えます。", tabs: ["motion-battle", "motion-parts"] },
    { id: "motion-battle", inside: "motion", group: "演出", title: "対戦デモ", path: "/kami_motion_battle_demo.html", kind: "motion", desc: "対戦画面と同じ配置で、神攻でライフが減ったときのカミの動きを順に再生。", whole: { target: doc => { const o = selectedOptions(doc); return "対戦デモ（自分：" + (o[0] || "") + "・相手：" + (o[1] || "") + "）"; } } },
    { id: "motion-parts", inside: "motion", group: "演出", title: "1柱ずつ確認", path: "/kami_motion_preview.html", kind: "motion", desc: "待機の呼吸・まばたき・ダメージの動きを1柱ずつ。", whole: { target: doc => selectedOption(doc) + "（モーション）" } },
    { id: "divine", group: "演出", title: "神技・創世神技の演出", kind: "motion", desc: "カミごとの演出の再生と、演出で使っている画像（カットインなど）を1か所で。上のタブで切り替えます。", tabs: ["effects", "divine-assets"] },
    { id: "effects", inside: "divine", group: "演出", title: "演出の再生", path: "/effects_preview.html", kind: "motion", desc: "カミごとのカットイン演出を再生して確認。", whole: { target: doc => { const o = selectedOptions(doc); return (o[0] || "") + "・" + (o[1] || "演出"); } } },
    { id: "divine-assets", inside: "divine", group: "演出", title: "カットイン・演出の画像", path: "/tools/divine-assets/", kind: "illust", desc: "神技・創世神技で使う画像を、カミごとに1枚ずつ確認。",
      items: [{ selector: ".asset", label: e => e.dataset.label }] },
    { id: "vfx", group: "演出", title: "演出の絵コンテ", path: "/tools/vfx-storyboard/", kind: "motion", desc: "演出の流れの確認。", items: [{ selector: ".object-row", label: e => "素材：" + text(e, ".object-label") }, { selector: ".track-row", label: e => "時間軸：" + text(e, ".track-name") }], whole: { target: doc => { const n = [...doc.querySelectorAll("input")].find(i => i.closest("label, .field") && /演出名/.test((i.closest("label, .field") || {}).textContent || "")); return "演出：" + ((n && n.value) || "絵コンテ"); } } },
    { id: "op-scenes", group: "OP・トレーラー", title: "創世決戦OPの場面", path: "/tools/op-scenes/", kind: "illust", desc: "オープニングの場面の絵と語りの文を、流れる順に確認。",
      items: [{ selector: ".scene", label: e => text(e, ".nm") }] },
    { id: "trailer", group: "OP・トレーラー", title: "ゲームトレーラー", path: "/tools/trailer/", kind: "motion", desc: "トレーラーの構成案（まだ検討中）。場面ごとにメモを残せます。",
      items: [{ selector: "tr.tr-item", label: e => e.dataset.label }, { selector: "section.part", label: e => e.dataset.label }] },
    { id: "game", group: "ゲーム", title: "ゲーム本体", path: "/index.html", kind: "ui", desc: "ゲームを遊んで確かめられます。キジマのPCでは公開前の作業中のゲーム、ほかの人には今公開中のゲームが開きます。" },
  ];
})();
