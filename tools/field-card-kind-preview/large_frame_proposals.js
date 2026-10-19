'use strict';

// Preview only. The battle renderer continues to select the accepted H frame.
let largeFrameSequence = 0;
const largeProposalBaseFrame = typeof module !== 'undefined' && module.exports
  ? require('../../field_card_frames.js').materialFrame : materialFrame;
function largeFieldFrame(kind, design, shape = 'portrait') {
  if (!['j','k','l'].includes(design)) return largeProposalBaseFrame(kind,design,shape);
  const id=`large-frame-${++largeFrameSequence}`, height=shape==='octagon'?227:308;
  const [bright,face,dark,glow] = {
    basic:['#e2edf0','#869ba9','#263440','#c6e4ee'],
    unique:['#ffe4a4','#c29445','#463018','#f0b749'],
    dragon:['#d64554','#67132c','#08080d','#dc2445'],
    token:['#b0f0d7','#4da99f','#173f47','#62dfc7']
  }[kind];
  const rr=(m,r=18+m)=>`M${r-m} ${-m}H${240+m-r}Q${240+m} ${-m} ${240+m} ${r-m}V${height+m-r}Q${240+m} ${height+m} ${240+m-r} ${height+m}H${r-m}Q${-m} ${height+m} ${-m} ${height+m-r}V${r-m}Q${-m} ${-m} ${r-m} ${-m}Z`;
  const contour=m=>shape==='octagon'?`M55 ${-m}H185L${240+m} 44V${height-44}L185 ${height+m}H55L${-m} ${height-44}V44Z`:rr(m);
  const line=(d,color,w=1,extra='')=>`<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
  const corners=s=>`<g>${s}</g><g transform="translate(240 0) scale(-1 1)">${s}</g><g transform="translate(0 ${height}) scale(1 -1)">${s}</g><g transform="translate(240 ${height}) scale(-1 -1)">${s}</g>`;
  const metal=`url(#${id}-metal)`, margin=design==='j'?22:design==='k'?15:17;
  const inner=shape==='octagon'?0:(kind==='unique'||kind==='dragon'?12:7);
  const defs=`<defs>
    <linearGradient id="${id}-metal" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="${bright}"/><stop offset=".16" stop-color="${face}"/><stop offset=".34" stop-color="${dark}"/><stop offset=".55" stop-color="${face}"/><stop offset=".76" stop-color="${bright}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
    <linearGradient id="${id}-fade" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff"/><stop offset=".24" stop-color="#fff"/><stop offset=".4" stop-color="#000"/><stop offset=".6" stop-color="#000"/><stop offset=".76" stop-color="#fff"/><stop offset="1" stop-color="#fff"/></linearGradient>
    <mask id="${id}-token" maskUnits="userSpaceOnUse" x="-55" y="-55" width="350" height="${height+110}"><rect x="-55" y="-55" width="350" height="${height+110}" fill="url(#${id}-fade)"/></mask>
    <mask id="${id}-outside" maskUnits="userSpaceOnUse" x="-55" y="-55" width="350" height="${height+110}"><rect x="-55" y="-55" width="350" height="${height+110}" fill="#fff"/><path d="${contour(0)}" fill="#000"/></mask>
    <filter id="${id}-glow" x="-45%" y="-40%" width="190%" height="180%"><feGaussianBlur stdDeviation="4"/></filter>
  </defs>`;
  let rim=`<path d="${contour(margin)} ${contour(inner)}" fill="${metal}" fill-rule="evenodd"/>`;
  rim+=line(contour(margin),'#060a0e',3.5)+line(contour(margin-1),bright,1.4,'opacity=".85"')+line(contour(inner),dark,2.4);
  if(kind==='dragon') {
    rim+=line(contour(margin-3),'#bd213f',2.8,'opacity=".9"');
    const d=shape==='octagon'?`M-8 57C-3 91-12 119-7 151M248 66C242 101 253 129 247 164`:`M-16 45C-21 88-12 104-18 146S-11 211-17 264M256 48C262 95 251 119 258 153S250 226 256 261`;
    rim+=line(d,'#190b15',5)+line(d,'#c82a46',1.6);
  }
  let detail='';
  if(design==='k') {
    if(shape==='octagon') {
      detail=corners(`<path d="M-19 68V37L49-19H82L65-6H55L-6 45V55Z" fill="${metal}" stroke="${dark}" stroke-width="2"/>`+line('M-13 53V40L52-13H69',bright,1.4));
    } else if(kind==='dragon') {
      detail=corners(`<path d="M-22 65-23 4-15-29 16-20 66-23 44-9H17Q-8-8-8 17V45Z" fill="${metal}" stroke="#08070d" stroke-width="1.4"/>`+line('M-18 45-18 7-12-21 14-14 43-16','#e34257',2));
    } else {
      const n=kind==='basic'?42:64;
      detail=corners(`<path d="M-22 ${n}V13Q-22-22 13-22H${n}L${n-15}-10H18Q-10-10-10 18V${n-15}Z" fill="${metal}" stroke="${dark}" stroke-width="1.4"/>`+line(`M-17 ${n-18}V14Q-17-17 14-17H${n-18}`,bright,1.3));
      if(kind==='unique')detail+=corners(line('M-14 49C1 39 19 31 14 17S-6 8-5 20S15 38 31 14S39-9 52-14',dark,5)+line('M-14 49C1 39 19 31 14 17S-6 8-5 20S15 38 31 14S39-9 52-14',bright,2.4));
    }
  }
  let aura='';
  if(design==='l') {
    // Light is visible outside the card only, so it cannot wash out the face.
    aura=`<g mask="url(#${id}-outside)" class="proposal-glow"><g filter="url(#${id}-glow)" opacity=".8">${line(contour(12),glow,18)}</g>${line(contour(19),glow,2.2,'opacity=".75"')}</g>`;
    detail+=line(contour(margin-4),bright,1.7,'opacity=".8"');
  }
  if(kind==='token' && aura) aura=`<g mask="url(#${id}-token)">${aura}</g>`;
  const base=largeProposalBaseFrame(kind,'h',shape).replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');
  const additions=kind==='token'?`<g mask="url(#${id}-token)">${rim}${detail}</g>`:rim+detail;
  return `<svg class="material-frame material-${design} material-${kind} large-proposal" viewBox="0 0 240 ${height}" preserveAspectRatio="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${defs}${aura}${additions}${base}</svg>`;
}

if(typeof module!=='undefined')module.exports={largeFieldFrame};
