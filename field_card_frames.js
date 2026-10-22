'use strict';

// Shared E/H/I study and accepted H field frames. No artwork or card state is modified.
let materialFrameSequence = 0;
function materialFrame(kind, style, shape = 'portrait') {
  if (shape === 'octagon') return materialRelicFrame(kind, style);
  const id = `material-${++materialFrameSequence}`;
  const refined = style === 'h' || style === 'i';
  const palette = refined && kind === 'dragon'
    ? ['#8c353c', '#1c0c12', '#501c28', '#060709', '#bd263b']
    : {
    basic: ['#e4e8e7', '#66717a', '#b9c3c9', '#343e48', '#9aa8b1'],
    unique: ['#f1dfb0', '#806033', '#c9ac70', '#493a28', '#c8b280'],
    dragon: ['#a7a3a2', '#24232b', '#58515a', '#17171e', '#944c52'],
    token: ['#b8e6d7', '#2f6b72', '#599f99', '#153840', '#70c7b2']
  }[kind];
  const [light, mid, face, dark, accent] = palette;
  const glowLight = refined && kind === 'dragon' ? '#bc253e' : kind === 'dragon' ? '#bd6b7d' : light;
  const glowFace = kind === 'dragon' ? '#864054' : face;
  const defs = `<defs>
    ${refined ? `<linearGradient id="${id}-obsidian" x1="0" y1="0" x2="1" y2=".7"><stop stop-color="#08090c"/><stop offset=".18" stop-color="#37101a"/><stop offset=".31" stop-color="#83172c"/><stop offset=".42" stop-color="#160b11"/><stop offset=".62" stop-color="#08090c"/><stop offset=".76" stop-color="#5d1424"/><stop offset=".88" stop-color="#1d0a12"/><stop offset="1" stop-color="#030507"/></linearGradient><linearGradient id="${id}-blood" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#400914"/><stop offset=".3" stop-color="#a41b32"/><stop offset=".48" stop-color="#cb3246"/><stop offset=".64" stop-color="#650e21"/><stop offset="1" stop-color="#210711"/></linearGradient>` : ''}
    <linearGradient id="${id}-metal" x1="0" y1="0" x2=".8" y2="1" gradientUnits="objectBoundingBox">
      <stop stop-color="${light}"/><stop offset=".12" stop-color="${face}"/>
      <stop offset=".31" stop-color="${mid}"/><stop offset=".5" stop-color="${dark}"/>
      <stop offset=".72" stop-color="${face}"/><stop offset=".87" stop-color="${mid}"/><stop offset="1" stop-color="${dark}"/>
    </linearGradient>
    <linearGradient id="${id}-lacquer" x1="0" y1="0" x2="1" y2=".85">
      <stop stop-color="#41403e"/><stop offset=".2" stop-color="#151b1e"/>
      <stop offset=".5" stop-color="#0b0f13"/><stop offset=".85" stop-color="#292b2b"/><stop offset="1" stop-color="#12191c"/>
    </linearGradient>
    <linearGradient id="${id}-inlay" x1="0" y1="0" x2="1" y2=".6">
      <stop stop-color="${light}"/><stop offset=".4" stop-color="${accent}"/><stop offset=".72" stop-color="${face}"/><stop offset="1" stop-color="${mid}"/>
    </linearGradient>
    <linearGradient id="${id}-breath" x1="0" y1="0" x2=".5" y2="1">
      <stop stop-color="${accent}" stop-opacity="0"/><stop offset=".3" stop-color="${glowFace}" stop-opacity=".25"/>
      <stop offset=".5" stop-color="${glowLight}" stop-opacity=".8"/><stop offset=".7" stop-color="${accent}" stop-opacity=".3"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="${id}-fade" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff"/><stop offset=".24" stop-color="#fff"/><stop offset=".39" stop-color="#000"/><stop offset=".61" stop-color="#000"/><stop offset=".76" stop-color="#fff"/><stop offset="1" stop-color="#fff"/></linearGradient>
    <mask id="${id}-spirit" maskUnits="userSpaceOnUse" x="-30" y="-30" width="300" height="368"><rect x="-30" y="-30" width="300" height="368" fill="url(#${id}-fade)"/></mask>
    <filter id="${id}-shadow" x="-40%" y="-25%" width="180%" height="150%"><feDropShadow dx="0" dy="2" stdDeviation="1.4" flood-color="#000" flood-opacity=".85"/></filter>
    <filter id="${id}-haze" x="-60%" y="-30%" width="220%" height="160%"><feGaussianBlur stdDeviation="3"/></filter>
  </defs>`;
  const metal = `url(#${id}-metal)`, lacquer = `url(#${id}-lacquer)`, inlay = `url(#${id}-inlay)`;
  const round = (x, y, w, h, r) => `M${x+r} ${y}H${x+w-r}Q${x+w} ${y} ${x+w} ${y+r}V${y+h-r}Q${x+w} ${y+h} ${x+w-r} ${y+h}H${x+r}Q${x} ${y+h} ${x} ${y+h-r}V${y+r}Q${x} ${y} ${x+r} ${y}Z`;
  const ring = (outer, inner, fill, extra = '') => `<path d="${outer} ${inner}" fill="${fill}" fill-rule="evenodd" ${extra}/>`;
  const line = (d, stroke, width = 1, extra = '') => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
  const corners = shape => `<g>${shape}</g><g transform="translate(240 0) scale(-1 1)">${shape}</g><g transform="translate(0 308) scale(1 -1)">${shape}</g><g transform="translate(240 308) scale(-1 -1)">${shape}</g>`;
  const outer = round(-7, -7, 254, 322, 17), inner = round(1.5, 1.5, 237, 305, 11);
  let edge = '', detail = '', aura = '';

  if (refined) {
    // E remains intact. H/I add a deeper carved well and restrained relief work.
    const broad = kind === 'unique' || kind === 'dragon';
    const rimOuter = broad ? round(-13,-13,266,334,21) : round(-8,-8,256,324,17);
    edge = ring(rimOuter, inner, kind === 'dragon' ? `url(#${id}-obsidian)` : lacquer);
    edge += line(rimOuter, '#030609', 4.6);
    edge += line(rimOuter, metal, kind === 'unique' ? 2.8 : 2);
    edge += line(round(-7,-7,254,322,16), dark, 2.8);
    edge += line(round(-6,-6,252,320,15), inlay, .85, 'opacity=".8"');
    edge += line(round(-1,-1,242,310,11), metal, 1.3);
    edge += line(inner, '#05070a', 1.5);
    if (kind === 'basic') {
      const rail = 'M-5 29V14Q-5-5 14-5H29';
      detail = corners(line(rail,dark,3.8)+line(rail,metal,1.8)+line('M0 24V14Q0 0 14 0H24',light,.65,'opacity=".65"'));
    } else if (kind === 'unique') {
      const scroll = 'M-8 44C-4 33 12 29 11 18S-3 10-2 19S12 29 23 11S33-5 44-8';
      const base = `<path d="M-12 51V16Q-12-12 16-12H51L41-5H19Q-5-5-5 19V41Z" fill="${metal}" stroke="#261b11" stroke-width="1.4"/>`;
      const raised = line(scroll, '#302113', 4.8) + line(scroll, inlay, 2.4)
        + line('M-7 40C1 31 14 28 12 18M24 7C30-1 35-5 42-6',light,.7,'opacity=".9"');
      detail = corners(base+raised);
      const rail = 'M49-8H69C73-14 83-14 87-8H101C106-16 118-16 120-8C122-16 134-16 139-8H153C157-14 167-14 171-8H191';
      detail += line(rail, '#302113', 3.8) + line(rail, inlay, 1.6)
        + `<g transform="translate(0 308) scale(1 -1)">${line(rail,'#302113',3.8)+line(rail,inlay,1.6)}</g>`;
      detail += line('M-9 58V250M249 58V250',metal,1.4) + line('M-6 60V248M246 60V248',light,.5,'opacity=".45"');
      if (style === 'i') {
        // Cool silver fine work is recessed into the warm gold, never an added badge.
        const knot = 'M-8 53C-2 43 16 39 17 25C18 14 11 12 6 16';
        detail += corners(line(knot,'#211b15',3.2)+line(knot,'#c3c9c2',1.1));
        detail += line('M50-4H190M50 312H190','#a1aaa7',.7,'opacity=".65"');
      }
    } else if (kind === 'dragon') {
      // Red is embedded through the black material, rather than just outlining it.
      const surface = `url(#${id}-obsidian)`, blood = `url(#${id}-blood)`;
      const cut = `<path d="M-13 53-18 13-12-18 18-11 52-14 37-5H18Q-5-5-5 18V37Z" fill="${surface}" stroke="#08070b" stroke-width="2"/>`
        + line('M-13 36-13 14-9-10 14-7 34-9',blood,2.6)
        + line('M-8 23-8 13-5-4 13-4', '#a33040', .8, 'opacity=".7"');
      detail = corners(cut);
      const ringClip = ring(rimOuter, inner, '#fff').replace('fill-rule="evenodd"', 'fill-rule="evenodd" clip-rule="evenodd"');
      detail = `<defs><clipPath id="${id}-rim-only">${ringClip}</clipPath></defs><g clip-path="url(#${id}-rim-only)">`
        + `<path d="M-13 33C-1 68-15 91-7 120S-15 175-6 204S-15 260-6 281L-10 289C-20 257-9 236-17 207S-10 151-18 123S-8 65-17 37Z" fill="${blood}" opacity=".9"/>`
        + `<path d="M252 46C240 72 254 101 245 129S253 176 247 202S257 248 244 275L251 284C266 251 254 231 262 204S254 155 262 130S248 75 258 48Z" fill="${blood}" opacity=".9"/>`
        + `<path d="M27-15C62-4 89-18 120-9S174-18 213-8L217-15C179-26 151-10 122-20S60-12 31-23Z" fill="${blood}" opacity=".8"/>`
        + `<g transform="translate(0 308) scale(1 -1)"><path d="M29-14C65-6 91-18 124-8S178-18 211-10L218-16C181-25 155-12 125-20S63-11 30-22Z" fill="${blood}" opacity=".8"/></g></g>` + detail;
      for (let y=48;y<265;y+=23) {
        const scale = line(`M-11 ${y}Q-3 ${y+4}-10 ${y+14}`, '#1d1018', 3.4)
          + line(`M-10 ${y}Q-4 ${y+4}-9 ${y+13}`, blood, .9);
        detail += scale + `<g transform="translate(240 0) scale(-1 1)">${scale}</g>`;
      }
      detail += line('M-1 30V278M241 30V278', '#7c162b', 1.4);
      if (style === 'i') {
        aura = `<g class="material-haze" filter="url(#${id}-haze)" fill="none" stroke="#720b28" stroke-width="5" opacity=".22"><path d="M-15 60C-24 111-15 145-20 183S-11 234-14 258M254 46C266 92 255 128 262 161S254 223 256 251"/></g>`;
      }
    } else {
      edge = ring(round(-7,-7,254,322,18),inner,metal,'opacity=".44"');
      edge += line(round(-6,-6,252,320,17),light,.9,'opacity=".7"');
      detail = corners(line('M-6 36V14Q-6-6 14-6H36',dark,3.4)+line('M-6 36V14Q-6-6 14-6H36',inlay,1.6));
      detail += line('M-2 22V15Q-2-2 15-2H22',light,.7,'opacity=".7"');
    }
  } else if (style === 'e') {
    // A lacquer well between two bevels reads as an object, not a CSS outline.
    const broad = kind === 'unique' || kind === 'dragon';
    edge = ring(broad ? round(-12,-12,264,332,20) : outer, inner, lacquer);
    edge += line(broad ? round(-12,-12,264,332,20) : outer, metal, broad ? 3 : 2);
    edge += line(round(-3,-3,246,314,13), inlay, kind === 'basic' ? .9 : 1.2);
    edge += line(inner, '#05090c', 1.8);
    if (kind === 'basic') {
      detail = corners(line('M-4 27V12Q-4-4 12-4H27', metal, 2) + line('M1 23V13Q1 1 13 1H23', light, .6, 'opacity=".55"'));
    } else if (kind === 'unique') {
      const flourish = `<path d="M-11 48V17Q-11-11 17-11H48L38-6H19Q-5-5-5 19V38Z" fill="${metal}"/>`
        + line('M-7 39C6 32 14 25 10 16S-3 12-1 19S15 26 23 10S34-3 40-6', inlay, 1.7)
        + line('M-6 28C1 30 5 25 5 20M18 2C24 4 30 1 28-5', light, .8, 'opacity=".65"');
      detail = corners(flourish);
      // Connected cloud engraving within the top and bottom rails, no crest.
      const cloud = 'M45-6H61C65-13 78-13 80-6H90C94-15 112-15 117-6H123C128-15 146-15 150-6H160C162-13 175-13 179-6H195';
      detail += line(cloud, inlay, 1.05) + `<g transform="translate(0 308) scale(1 -1)">${line(cloud,inlay,1.05)}</g>`;
      detail += line('M-7 57V251M247 57V251', inlay, .7, 'opacity=".65"');
    } else if (kind === 'dragon') {
      const horns = `<path d="M-12 46L-16 3-8-16 17-9 38-11 26-3H13Q-3-3-3 13V28Z" fill="${metal}" stroke="#1b161c" stroke-width="1.2"/>`
        + line('M-11 21-10 3-7-8 10-4', '#b0827e', .9, 'opacity=".65"');
      detail = corners(horns);
      for (let y=42;y<274;y+=18) {
        const scale = line(`M-10 ${y}Q-3 ${y+4}-10 ${y+13}M-9 ${y+1}Q-5 ${y+4}-8 ${y+7}`, metal, 1.1);
        detail += scale + `<g transform="translate(240 0) scale(-1 1)">${scale}</g>`;
      }
      detail += line('M-1 29V278M241 29V278', '#853f49', 1.4, 'opacity=".8"');
    } else {
      // Porcelain and a recessed pale inner line, rather than a dashed token box.
      edge = ring(round(-6,-6,252,320,18),inner,metal,'opacity=".5"');
      edge += line(round(-5,-5,250,318,17),light,.9,'opacity=".7"');
      detail = corners(line('M-6 38V14Q-6-6 14-6H38M-2 32V15Q-2-2 15-2H32',inlay,1.3));
      detail += line('M-4 62V132M244 176V246',light,1.4,'opacity=".8"');
    }
  } else if (style === 'f') {
    const bevel = 'M13-10H227L250 13V295L227 318H13L-10 295V13Z';
    edge = ring(bevel,inner,kind==='token'?metal:lacquer,kind==='token'?'opacity=".42"':'');
    edge += line(bevel,metal,kind==='basic'?2:3);
    edge += line('M14-6H226L246 14V294L226 314H14L-6 294V14Z',inlay,.7,'opacity=".65"');
    if (kind === 'basic') {
      detail = corners(`<path d="M-9 29V14L14-9H29L25-4H16L-4 16V25Z" fill="${metal}"/>` + line('M-4 15 15-4',light,.8));
    } else if (kind === 'unique') {
      const plate = `<path d="M-13 48V13L13-13H48L43-4H19L-4 19V43Z" fill="${metal}" stroke="#42331e" stroke-width="1.2"/>`
        + line('M-8 35V16L16-8H35',light,1.1,'opacity=".8"')
        + line('M-3 28V19L19-3H28',dark,1.4)
        + `<circle cx="1" cy="9" r="2.2" fill="${dark}"/><circle cx="9" cy="1" r="2.2" fill="${dark}"/>`
        + line('M-1 8 2 7M7 1 9-1',light,.8);
      detail = corners(plate);
      detail += line('M54-5H186M54 313H186',inlay,2.4);
      detail += line('M57-8H183M57 316H183',light,.6,'opacity=".6"');
    } else if (kind === 'dragon') {
      const plate = `<path d="M-14 60-17 16-9-17 22-9 59-13 43-3H20L-3 20V44Z" fill="${metal}" stroke="#19141a" stroke-width="1.8"/>`
        + line('M-11 36-12 15-7-9 19-4 37-6',accent,1.5)
        + line('M-7 28-6 15 15-6 28-7',light,.8,'opacity=".6"');
      detail = corners(plate);
      for(let y=65;y<250;y+=32) {
        const d=`M-10 ${y}L-2 ${y+7}-10 ${y+15}-5 ${y+21}`;
        detail += line(d,metal,2)+`<g transform="translate(240 0) scale(-1 1)">${line(d,metal,2)}</g>`;
      }
      detail += line('M0 32V276M240 32V276',accent,1.4,'opacity=".7"');
    } else {
      detail = corners(`<path d="M-9 35V14L14-9H35L30-4H16L-4 16V30Z" fill="${metal}" opacity=".7"/>`+line('M-5 26V15L15-5H26',light,.8));
      edge += line('M-6 63V123M246 185V245',light,1.2);
    }
  } else {
    // Restrained luminous inlay. Light occupies a few unequal tapered arcs, not a neon rectangle.
    edge = ring(outer,inner,lacquer,kind==='token'?'opacity=".5"':'');
    edge += line(outer,metal,kind==='basic'?1.6:2.6)+line(inner,dark,1.2);
    const arc1='M-13 256C-28 226-18 194-21 165S-18 108-9 79C-14 113-20 127-16 162S-25 226-13 256Z';
    const arc2='M251 51C270 79 263 114 268 145S262 197 249 231C260 191 262 171 259 145S265 83 251 51Z';
    const arc3='M-13 44C-25 4-1-23 36-20S94-22 126-17C94-20 67-15 37-16S-18 6-13 44Z';
    if(kind!=='basic') {
      const hazeColor=kind==='dragon'?'#6c273d':accent;
      aura=`<g class="material-haze" fill="${hazeColor}" opacity="${kind==='dragon'?'.4':'.16'}" filter="url(#${id}-haze)"><path d="${arc1}"/><path d="${arc2}"/><path d="${arc3}"/></g>`;
      aura+=`<g class="material-current" fill="url(#${id}-breath)"><path d="${arc1}"/><path d="${arc2}"/><path d="${arc3}"/></g>`;
    }
    if(kind==='unique') {
      edge+=line(round(-3,-3,246,314,13),inlay,.8);
      detail=corners(line('M-7 35V14Q-7-7 14-7H35M-3 28V15Q-3-3 15-3H28',inlay,1.4));
    } else if(kind==='dragon') {
      detail=corners(`<path d="M-7 38-14 10-8-13 13-7 38-7 26-1H13Q-1-1-1 13V26Z" fill="${metal}"/>`+line('M-5 30-8 10-5-5 11-3',accent,1.1));
      detail+=line('M-2 39V269M242 39V269',accent,1.3,'opacity=".8"');
    } else if(kind==='token') {
      edge+=line(round(-3,-3,246,314,14),light,.9,'opacity=".8"');
      detail=corners(line('M-6 34V14Q-6-6 14-6H34',light,1.6,'opacity=".65"'));
    }
  }
  if (kind === 'token' && ['e', 'h', 'i'].includes(style)) {
    // Green-blue translucent jade is distinct from Basic's opaque silver.
    // Keep the broad central break as a second cue when color is reduced.
    const jadeOuter = round(-7,-7,254,322,18);
    edge = ring(jadeOuter,inner,metal,'opacity=".83"');
    edge += line(jadeOuter,accent,1.35,'opacity=".9"');
    edge += line(round(-2,-2,244,312,13),dark,1.3,'opacity=".7"');
    detail = corners(`<path d="M-6 39V14Q-6-6 14-6H39L29-1H15Q-1-1-1 15V29Z" fill="${inlay}" opacity=".75"/>`
      + line('M-4 29V14Q-4-4 14-4H29',light,.95,'opacity=".7"')
      + line('M0 24V15Q0 0 15 0H24',accent,1.2,'opacity=".8"'));
  }
  const rim = `<g filter="url(#${id}-shadow)">${edge}</g>${detail}`;
  return `<svg class="material-frame material-${style} material-${kind}" viewBox="0 0 240 308" preserveAspectRatio="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${defs}${aura}${kind === 'token' ? `<g mask="url(#${id}-spirit)">${rim}</g>` : rim}</svg>`;
}

function materialRelicFrame(kind, style = 'h') {
  const id = `material-relic-${++materialFrameSequence}`;
  const colors = {
    basic: ['#e4e8e7','#68757d','#a6b3bb','#273239'],
    unique: ['#f0ddb0','#795c31','#d3b478','#392a18'],
    dragon: ['#a52a3b','#160a10','#601827','#050609'],
    token: ['#b8e6d7','#2f6b72','#70c7b2','#153840']
  }[kind] || ['#e4e8e7','#68757d','#a6b3bb','#273239'];
  const [light,mid,accent,dark] = colors;
  const outer = 'M55 1H185L239 44V183L185 226H55L1 183V44Z';
  const inner = 'M57 8H183L232 48V179L183 219H57L8 179V48Z';
  const line = (d,stroke,w=1) => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
  const corners = d => `<g>${d}</g><g transform="translate(240 0) scale(-1 1)">${d}</g><g transform="translate(0 227) scale(1 -1)">${d}</g><g transform="translate(240 227) scale(-1 -1)">${d}</g>`;
  const metal = `url(#${id}-metal)`;
  const defs = `<defs><linearGradient id="${id}-metal" x1="0" y1="0" x2="1" y2=".8"><stop stop-color="${light}"/><stop offset=".25" stop-color="${mid}"/><stop offset=".5" stop-color="${dark}"/><stop offset=".73" stop-color="${accent}"/><stop offset="1" stop-color="${dark}"/></linearGradient><linearGradient id="${id}-fade" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff"/><stop offset=".27" stop-color="#fff"/><stop offset=".43" stop-color="#000"/><stop offset=".57" stop-color="#000"/><stop offset=".73" stop-color="#fff"/><stop offset="1" stop-color="#fff"/></linearGradient><mask id="${id}-spirit" maskUnits="userSpaceOnUse" x="-8" y="-8" width="256" height="243"><rect x="-8" y="-8" width="256" height="243" fill="url(#${id}-fade)"/></mask></defs>`;
  let rim = `<path d="${outer} ${inner}" fill="${kind==='dragon'?'#130a10':'#11191c'}" fill-rule="evenodd"/>` + line(outer,metal,3.2) + line(inner,dark,1.2);
  rim += line('M56 4H184L236 46V181L184 223H56L4 181V46Z',metal,.85);
  if(kind==='unique') {
    const scroll='M3 59V45L55 3H70L60 7H56L7 47V53Z';
    rim += corners(`<path d="${scroll}" fill="${metal}"/>`+line('M61 4C46 6 47 19 33 22S24 35 11 42',dark,3.1)+line('M61 4C46 6 47 19 33 22S24 35 11 42',metal,1.7));
    if(style==='i')rim+=corners(line('M63 7C47 8 49 24 32 26S26 36 13 45','#bec8c4',.8));
  } else if(kind==='dragon') {
    rim+=corners(`<path d="M1 68-3 43 50-3 78 0 65 5H56L5 47V59Z" fill="${metal}" stroke="#080509"/>`+line('M2 54V45L55 2H68','#b2233b',2));
    rim+=line('M2 71C7 92-1 110 4 129S-1 151 3 171M238 61C232 85 241 104 235 126S240 152 237 169','#8c192f',2.2);
  } else if(kind==='token') {
    rim=`<path d="${outer} ${inner}" fill="${metal}" fill-rule="evenodd" opacity=".85"/>`+line(outer,accent,1.2)+line(inner,dark,.9);
    rim+=corners(line('M3 60V45L55 3H72',accent,2)+line('M6 54V47L56 6H65',light,.8));
    rim=`<g mask="url(#${id}-spirit)">${rim}</g>`;
  }
  return `<svg class="material-frame field-relic-frame material-${style} material-${kind}" viewBox="0 0 240 227" preserveAspectRatio="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${defs}<path class="field-frame-attribute" d="${inner}" fill="none" stroke="#888" stroke-width="2"/>${rim}</svg>`;
}

function fieldCardKind(card, allCards = []) {
  if (!card || typeof card !== 'object') return '';
  const source = Array.isArray(allCards) ? allCards : [];
  const printed = source.find(c => c && c.no != null && String(c.no) === String(card.no));
  if (card.isToken || (printed && printed.isToken)) return 'token';
  if ((card.type || (printed && printed.type)) === '龍') return 'dragon';
  if ((card.color || (printed && printed.color)) === '創') return 'genesis';
  const nameKey = c => c.nickname ? `${c.nickname}・${c.name}` : c.name || '';
  const name = nameKey(card.name ? card : printed || card);
  const copies = source.filter(c => c && !c.isToken && !c.isKami && nameKey(c) === name).length;
  return copies >= 2 ? 'basic' : 'unique';
}

/* 場の札のレアリティ枠（2026-10 作り直し）。
   どの種類も同じ太さの縁で、飾りは付けない。違いは素材の色だけにして、ひと目で分かるようにする：
   返還値2＝銀、返還値1＝金、龍＝メタリックな黒、トークン＝クリスタル（透ける青緑） */
const RARITY_FRAME_COLORS = {
  // [縁のグラデーション（5段）, 外側と内側の輪郭, 縁の内側の細い光]
  // 明るすぎると樹脂のように見えるので、どれも少し沈んだ金属の色にする
  basic : [['#b6bcc1', '#4a525a', '#99a1a8', '#2c3238', '#7c858d'], '#0e1114', '#b6bcc1'],
  unique: [['#fff0b0', '#a8720f', '#f6d468', '#6b4306', '#e8b83a'], '#2a1802', '#fff0b0'],
  dragon: [['#8a8e98', '#09090b', '#4a4e57', '#020203', '#22242a'], '#000000', '#8a8e98'],
  token : [['#cceae4', '#2a726a', '#94cac2', '#164a46', '#62aaa0'], '#082020', '#cceae4'],
};
let rarityFrameSequence = 0;
function rarityFrame(kind, shape = 'portrait') {
  const [stops, outline, shine] = RARITY_FRAME_COLORS[kind] || RARITY_FRAME_COLORS.unique;
  const id = `rarity-${++rarityFrameSequence}`;
  const offsets = [0, .28, .5, .74, 1];
  const grad = `<linearGradient id="${id}-metal" x1="0" y1="0" x2=".85" y2="1">${stops.map((c, i) => `<stop offset="${offsets[i]}" stop-color="${c}"/>`).join('')}</linearGradient>`;
  const crystal = kind === 'token' ? ' opacity=".9"' : '';
  const shadow = `<filter id="${id}-shadow" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.2" flood-color="#000" flood-opacity=".75"/></filter>`;
  const line = (d, stroke, w, extra = '') => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round" ${extra}/>`;
  let outer, inner, mid, view, cls;
  if (shape === 'octagon') {
    outer = 'M54 -4H186L244 42V185L186 231H54L-4 185V42Z';
    inner = 'M58 5H182L235 47V180L182 222H58L5 180V47Z';
    mid = 'M56 0.5H184L239.5 44.5V182.5L184 226.5H56L0.5 182.5V44.5Z';
    view = '0 0 240 227'; cls = 'field-relic-frame';
  } else {
    const round = (x, y, w, h, r) => `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;
    outer = round(-5, -5, 250, 318, 16);
    inner = round(3, 3, 234, 302, 10);
    mid = round(-1, -1, 242, 310, 13);
    view = '0 0 240 308'; cls = '';
  }
  const rim = `<g filter="url(#${id}-shadow)"><path d="${outer} ${inner}" fill="url(#${id}-metal)" fill-rule="evenodd"${crystal}/>`
    + line(outer, outline, 1.6) + line(inner, outline, 1.4) + `</g>`
    + line(mid, shine, .7, 'opacity=".4"');
  return `<svg class="material-frame rarity-frame ${cls} rarity-${kind} material-${kind}" viewBox="${view}" preserveAspectRatio="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><defs>${grad}${shadow}</defs>${rim}</svg>`;
}

/* 場のレガシーの枠（結び・2026-10）：生成画像の「小さめの結び」を4色に塗り分けた透過画像。
   画像の縁の内側（KNOT_FRAME_INNER）を、カードの絵の端（縁の太さ --frame-w の内側）に合わせて置く。
   作り方は design_assets/field-knot-frame-v1/manifest.json（元画像・切り出し位置）
   金（unique）だけ上辺から外へはみ出す装飾があり、その分だけ画像の上に余白（KNOT_FRAME_TOP_EXTRA）を足してある
   （元は design_assets/frame-gold-top-ornament-v5-thin/frame-gold-J.png）
   龍（dragon）は枠が変形した角が上辺から左右の外へ伸びる。漆黒の枠で、角の先だけがカードの属性の色に灯る（創は灰）。
   上に55・左右に17の余白を足してある（元は design_assets/frame-dragon-horns-v3-massive、作り方は design_assets/field-knot-frame-v1/dragon/files.json） */
const KNOT_FRAME_FILES = {
  basic: 'battle_ui/field-knot-frame-silver-b9c9d856174f.webp',
  unique: 'battle_ui/field-knot-frame-gold-771466e07939.webp',
  token: 'battle_ui/field-knot-frame-crystal-892881c66371.webp',
};
const KNOT_FRAME_DRAGON_FILES = {
  '赤': 'battle_ui/field-knot-frame-dragon-red-80e8eda98882.webp',
  '青': 'battle_ui/field-knot-frame-dragon-blue-1b158bcdcfb8.webp',
  '緑': 'battle_ui/field-knot-frame-dragon-green-bcb4dcc89cac.webp',
  '黄': 'battle_ui/field-knot-frame-dragon-yellow-e472e27019cf.webp',
  '紫': 'battle_ui/field-knot-frame-dragon-purple-44216f86a4a7.webp',
  '創': 'battle_ui/field-knot-frame-dragon-ash-6d7b5b139e0f.webp',
};
const KNOT_FRAME_SIZE = { width: 387, height: 454 };
const KNOT_FRAME_INNER = { left: 16, right: 372, top: 14, bottom: 440 };
const KNOT_FRAME_TOP_EXTRA = { unique: 39, dragon: 55 };
const KNOT_FRAME_SIDE_EXTRA = { dragon: 17 };
let knotFrameSequence = 0;
function knotFrame(kind, color = '') {
  const file = kind === 'dragon' ? (KNOT_FRAME_DRAGON_FILES[color] || KNOT_FRAME_DRAGON_FILES['創']) : (KNOT_FRAME_FILES[kind] || KNOT_FRAME_FILES.unique);
  const extra = KNOT_FRAME_TOP_EXTRA[kind] || 0, side = KNOT_FRAME_SIDE_EXTRA[kind] || 0;
  const W = KNOT_FRAME_SIZE.width + side * 2, H = KNOT_FRAME_SIZE.height + extra;
  const left = KNOT_FRAME_INNER.left + side, right = KNOT_FRAME_INNER.right + side;
  const top = KNOT_FRAME_INNER.top + extra, bottom = KNOT_FRAME_INNER.bottom + extra;
  const iw = right - left, ih = bottom - top;
  // 内側の幅・高さ＝カードの幅・高さ − 縁の太さ×2 になるように、画像全体の大きさと位置を決める
  const sx = `(100% - 2 * var(--frame-w)) / ${iw}`, sy = `(100% - 2 * var(--frame-w)) / ${ih}`;
  const css = `position:absolute;pointer-events:none;max-width:none;`
    + `left:calc(var(--frame-w) - ${left} * ${sx});top:calc(var(--frame-w) - ${top} * ${sy});`
    + `width:calc(${W} * ${sx});height:calc(${H} * ${sy});`;
  return `<img class="material-frame rarity-frame knot-frame rarity-${kind} material-${kind}" data-frame-id="knot-${++knotFrameSequence}" src="${file}" alt="" aria-hidden="true" draggable="false" style="${css}">`;
}

const fieldCardFrameCache = new WeakMap();
function fieldCardFrameForCard(card, allCards, slot = '') {
  if (!card || typeof card !== 'object') return '';
  const kind = fieldCardKind(card, allCards);
  const shape = card.category === 'レリック' ? 'octagon' : 'portrait';
  const key = `${kind}:${card.color || ''}:${shape}:${slot}`;
  let entries = fieldCardFrameCache.get(card);
  if (!entries) { entries = new Map(); fieldCardFrameCache.set(card, entries); }
  if (!entries.has(key)) {
    // 創のカード（ジェネシス）は1枚しかないので金の縁
    // レガシーは結びの枠（画像）、レリックは八角形の縁（結びの画像は縦長のカード用）
    const k = kind === 'genesis' ? 'unique' : kind;
    entries.set(key, shape === 'portrait' ? knotFrame(k, card.color) : rarityFrame(k, shape));
  }
  return entries.get(key);
}

if (typeof module !== 'undefined') module.exports = { materialFrame, materialRelicFrame, rarityFrame, knotFrame, fieldCardKind, fieldCardFrameForCard };
