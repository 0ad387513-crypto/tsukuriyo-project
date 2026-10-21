'use strict';

// 現在の本番は結びの枠　E/H/I/J/K/Lは過去の比較用
const designs = [
  { id: 'current', title: '結びの枠', tag: '本番で採用中',
    note: '縁の太さと結びの位置をそろえ、種類を素材の色で見分ける枠　マナの輪・刀・戦闘力の札も同じ色に統一',
    points: ['銀の結び枠・基本', '金の結び枠・ユニーク', 'メタリックな黒の結び枠・龍', '青緑のクリスタル・トークン'] },
  { id: 'e', title: '黒漆・蒔絵', tag: '従来案・比較元',
    note: '漆の黒い溝に金銀を象嵌。ユニークは雲の彫りと曲線の角飾り、龍は黒鉄に鱗の彫り。強く光らせず、工芸品のような質感を目指す案。',
    points: ['黒漆に細い銀の象嵌', '金の雲彫りと唐草の角飾り', '黒鉄の鱗彫りと暗い朱の内縁', '青緑の翡翠・上下に分かれた半枠'] },
  { id: 'h', title: '黒漆・高蒔絵', tag: '以前の採用案',
    note: 'Eの造形を保ち、溝を深く、唐草を浮き彫りに。金の明暗と細い反射で立体感を少し強めた案。龍は黒曜のような黒に深紅が入り込みます。',
    points: ['深い漆の溝と銀の面取り', '浮き彫りの唐草と二段の金縁', '黒曜と深紅が混じる鱗の枠', '青緑の翡翠・透ける半枠'] },
  { id: 'i', title: '黒漆・金銀象嵌', tag: '過去の比較案',
    note: '金の浮き彫りに銀の細工を控えめに重ねた案。龍は赤黒い素材の脈に淡い瘴気を添え、邪悪さを強めています。',
    points: ['漆に沈む銀の細工', '金の浮き彫りに銀の象嵌', '赤黒い脈と暗い瘴気の枠', '青緑の翡翠・磨いた半枠'] },
  { id: 'j', title: '太縁・高蒔絵', tag: '過去の試作',
    note: 'Hの外側へ幅のある金属の縁を追加。彫りと光沢を残し、カードが小さくても種類の色がはっきり残る案。',
    points: ['幅のある銀の額縁', '厚い金の面取りと高蒔絵', '太い赤黒の鱗枠', '幅のある翡翠の半枠'] },
  { id: 'k', title: '大角飾り・高蒔絵', tag: '過去の試作',
    note: '四隅の金具と彫刻を外へ大きく張り出す案。龍は角を強調。絵の大きさを変えず、枠の輪郭を目立たせます。',
    points: ['大きな銀の角金具', '外へ広がる金の唐草飾り', '深紅が混じる大きな黒い角', '大きな翡翠の角金具'] },
  { id: 'l', title: '光彩・高蒔絵', tag: '過去の試作',
    note: '太い縁の外側に明るいオーラを追加。銀・金・深紅・翡翠の光がゆっくり明滅。光は絵の中心へかからないようにしています。',
    points: ['白銀の光と太い銀枠', '金のオーラと高蒔絵', '強い深紅のオーラと黒鉄', '青緑の光と翡翠の半枠'] }
];
const labels = { basic: '基本', unique: 'ユニーク', dragon: '龍', token: 'トークン', genesis: 'ジェネシス' };
const byNo = new Map(FIELD_KIND_PREVIEW_CARDS.map(card => [String(card.no), card]));
const controls = Object.fromEntries(['view', 'samples', 'scale', 'state', 'motion', 'mono', 'field-design'].map(id => [id, document.getElementById(id)]));
const fullName = card => (card.nickname ? card.nickname + '・' : '') + card.name;
const escapeHtml = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function makeCard(card, design, state = 'normal') {
  const kind = card.kind;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `field-card design-${design} kind-${kind} attr-${card.color} state-${state}${card.category === 'レリック' ? ' relic' : ''}`;
  button.setAttribute('aria-label', `${fullName(card)}、${labels[kind]}、${card.color}属性${state === 'tapped' ? '、タップ中' : state === 'ready' ? '、行動可能' : ''}`);
  button.title = `${fullName(card)} / ${labels[kind]} / ${card.color}属性`;
  button.innerHTML = `<span class="action-ring" aria-hidden="true"></span><span class="aura" aria-hidden="true"></span>
    <span class="kind-frame" aria-hidden="true"></span><span class="art"><span class="art-image"></span></span>
    <span class="edge-detail" aria-hidden="true"></span><span class="corners" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
    ${design === 'current' ? currentFieldFramePreview(kind, card.category === 'レリック' ? 'octagon' : 'portrait') : largeFieldFrame(kind, design, card.category === 'レリック' ? 'octagon' : 'portrait')}
    <span class="stat cost">${card.cost}</span>${card.category === 'レガシー' ? `<span class="stat attack">${card.attack}</span><span class="power">${card.power}</span>` : ''}
    <span class="tap-shade" aria-hidden="true"></span><span class="tap-mark" aria-hidden="true"></span>
    <span class="disabled-label">効果無効</span>`;
  const art = button.querySelector('.art-image');
  const crop = fieldCardArtCrop(card);
  art.style.backgroundImage = `url("../../${card.image}")`;
  art.style.backgroundPosition = crop?.position || '68% 8%';
  art.style.backgroundSize = crop?.size || 'auto 200%';
  if (crop?.wide) {
    // Same illustration-only crop as .token-art-wide in the current field.
    art.classList.add('wide');
    art.style.backgroundSize = '129.87% 201.207%';
    art.style.backgroundPosition = '78.261% 11.08%';
  }
  button.addEventListener('click', () => {
    document.querySelectorAll('.is-selected').forEach(el => el.classList.remove('is-selected'));
    button.classList.add('is-selected');
    document.getElementById('selection').textContent = `${fullName(card)}　/　${labels[kind]}　/　${card.color}属性　/　${card.category}`;
  });
  return button;
}

function samples() {
  const ids = controls.samples.value === 'mixed' ? ['30', '80', '44', '181']
    : controls.samples.value === 'relic' ? ['141', '176', '21', '187'] : ['1', '13', '21', '181'];
  return ids.map(id => byNo.get(id));
}

function render() {
  document.documentElement.style.setProperty('--scale', controls.scale.value);
  document.body.classList.toggle('motion-off', !controls.motion.checked);
  document.body.classList.toggle('monochrome', controls.mono.checked);
  const host = document.getElementById('designs');
  host.replaceChildren();
  const table = document.createElement('table');
  table.className = 'comparison-table';
  table.innerHTML = '<caption>現在の枠と以前採用したH案を比較できます</caption>';
  const head = document.createElement('thead');
  head.innerHTML = `<tr><th scope="col">デザイン案</th>${samples().map(card => `<th scope="col">${labels[card.kind]}<small>${escapeHtml(fullName(card))}</small></th>`).join('')}</tr>`;
  const body = document.createElement('tbody');
  for (const design of designs) {
    const view = controls.view.value;
    if (view === 'adopted' && !['current','h'].includes(design.id)) continue;
    if (view === 'large' && !['h','j','k','l'].includes(design.id)) continue;
    if (view === 'previous' && !['e','h','i'].includes(design.id)) continue;
    if (!['adopted','all','large','previous'].includes(view) && view !== design.id) continue;
    const row = document.createElement('tr');
    row.innerHTML = `<th scope="row"><span class="row-title"><span class="letter${design.id === 'current' ? ' current-letter' : ''}">${design.id === 'current' ? '採用' : design.id.toUpperCase()}</span>${design.title}</span>${design.tag ? `<span class="recommend-tag">${escapeHtml(design.tag)}</span>` : ''}<p>${design.note}</p></th>`;
    for (const [i, card] of samples().entries()) {
      const cell = document.createElement('td');
      const wrap = document.createElement('div');
      wrap.className = 'comparison-cell';
      const caption = document.createElement('p');
      caption.className = 'treatment-caption';
      caption.textContent = design.points[i];
      wrap.append(makeCard(card, design.id, controls.state.value), caption);
      cell.append(wrap);
      row.append(cell);
    }
    body.append(row);
  }
  table.append(head, body);
  host.append(table);
  const field = document.getElementById('field');
  field.replaceChildren();
  const lineup = ['1', '13', '30', '80', '21', '181', '198'];
  const states = ['normal', 'normal', 'tapped', 'ready', 'normal', 'tapped', 'normal'];
  for (const [i, no] of lineup.entries()) field.append(makeCard(byNo.get(no), controls['field-design'].value, states[i]));
  document.getElementById('selection').textContent = 'カードを選択して確認';
}
Object.values(controls).forEach(control => control.addEventListener('change', render));
render();
