/* The drawings a demo fixture is made of.

   Every seeded report carries pictures: a signature on the approval, two
   plates of photo evidence, a marked-up drawing on a dimensional
   report, a scan of the signed page on a document record. They are
   drawings rather than photographs on purpose — a fixture that faked a
   site photograph would be the same mistake as one that faked a
   signature, and these say plainly what they are.

   They live here rather than in the fixture because the fixture used to
   carry each one expanded. Four signature hands appeared four hundred
   times, the same grid of drawing paper forty-six times, and the file
   reached 1.2 MB — a quarter of the shipped bundle, to say six things
   over and over. Here the drawing is written once and the fixture holds
   the recipe: which plate, what caption. The picture is built when the
   store seeds, which happens once on a device and never again.

   Nothing outside the demo data uses this module. */

const svgUrl = (body) => 'data:image/svg+xml;utf8,' + encodeURIComponent(body)
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/* Four hands, so a data book does not carry one traced squiggle forty
   times. Paths are written without separators — SVG allows it. */
const HANDS = [
  'M8 56C26 18 40 20 45 50C48 68 56 70 62 44C68 22 79 25 82 52C84 71 95 67 107 39C115 21 123 25 125 51C127 69 137 67 153 43C171 17 193 19 199 43',
  'M10 62C22 30 36 24 42 52C46 70 55 66 60 40C65 18 78 22 83 48C87 68 98 64 112 42C122 26 132 30 136 54C139 70 150 66 166 46C178 31 194 34 204 50',
  'M9 50C20 22 33 26 39 54C43 72 53 68 58 44C63 20 75 24 80 50C84 70 96 66 108 44C118 26 130 28 134 52C137 70 148 68 162 48C174 32 190 30 202 44',
  'M12 58C24 26 38 22 44 48C48 66 57 70 63 46C69 22 82 26 86 54C89 72 100 68 113 44C122 27 134 31 138 55C141 71 152 65 167 45C179 30 195 32 206 48',
]
export const handOf = (n) => [...String(n)].reduce((a, c) => a + c.charCodeAt(0), 0) % HANDS.length

export const signImg = (hand) => svgUrl(
  `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='90'><path d='${HANDS[hand] || HANDS[0]}'`
  + ` fill='none' stroke='#17171a' stroke-width='2.6' stroke-linecap='round'/></svg>`)

/* Which plate goes on which report follows what was actually inspected —
   a gauge face on a pressure test, a weld macro on an NDE report — since
   a photo that does not match the test is worse than none. */
const PLATE = {
  gauge: (unit = 'Bar') => `<rect width='400' height='300' fill='#e8e6e1'/><circle cx='200' cy='142' r='96' fill='#fbfbf9' stroke='#3a3a3f' stroke-width='7'/><circle cx='200' cy='142' r='84' fill='none' stroke='#c9c6bf' stroke-width='1.5'/><g stroke='#2a2a30' stroke-width='3'><path d='M200 66v14M274 142h-14M200 218v-14M126 142h14M252 90l-10 10M252 194l-10-10M148 194l10-10M148 90l10 10'/></g><path d='M200 142L246 96' stroke='#b3261e' stroke-width='5' stroke-linecap='round'/><circle cx='200' cy='142' r='9' fill='#3a3a3f'/><text x='200' y='190' font-family='monospace' font-size='15' fill='#4a4a52' text-anchor='middle'>${esc(unit).toUpperCase()}</text>`,
  weld: () => `<rect width='400' height='300' fill='#cfcbc4'/><path d='M0 150h400' stroke='#8e8880' stroke-width='58'/><path d='M0 150q20 -13 40 0t40 0 40 0 40 0 40 0 40 0 40 0 40 0 40 0 40 0' fill='none' stroke='#a8a29a' stroke-width='30'/><path d='M0 136q20 -11 40 0t40 0 40 0 40 0 40 0 40 0 40 0 40 0 40 0 40 0' fill='none' stroke='#bdb7ae' stroke-width='7'/><g fill='#6e6a64'><circle cx='96' cy='150' r='4'/><circle cx='214' cy='156' r='3'/><circle cx='300' cy='146' r='3.5'/></g><rect x='16' y='232' width='118' height='30' fill='#f5f3ef' stroke='#5a564f'/><text x='75' y='253' font-family='monospace' font-size='16' fill='#2a2a30' text-anchor='middle'>10 mm</text>`,
  coating: () => `<rect width='400' height='300' fill='#d9d6d0'/><rect y='150' width='400' height='150' fill='#6b6660'/><rect y='120' width='400' height='30' fill='#c8621e'/><rect y='104' width='400' height='16' fill='#d8d3cb'/><g stroke='#2a2a30' stroke-width='2.5'><path d='M300 104v46M292 104h16M292 150h16'/></g><text x='318' y='132' font-family='monospace' font-size='17' fill='#2a2a30'>DFT</text><rect x='16' y='226' width='150' height='34' rx='4' fill='#fbfbf9' stroke='#5a564f'/><text x='91' y='250' font-family='monospace' font-size='18' fill='#2a2a30' text-anchor='middle'>168 um</text>`,
  tape: () => `<rect width='400' height='300' fill='#dedbd5'/><rect y='96' width='400' height='108' fill='#a9a49c'/><rect y='128' width='400' height='30' fill='#f0c419'/><g stroke='#2a2a30' stroke-width='2'>${Array.from({ length: 20 }, (_, i) => `<path d='M${i * 20} 128v${i % 5 === 0 ? 30 : 14}'/>`).join('')}</g><g font-family='monospace' font-size='12' fill='#2a2a30'>${Array.from({ length: 4 }, (_, i) => `<text x='${i * 100 + 4}' y='176'>${i * 500}</text>`).join('')}</g>`,
  plate: () => `<rect width='400' height='300' fill='#cdcac4'/><rect x='52' y='58' width='296' height='184' rx='5' fill='#b7b2ab' stroke='#5a564f' stroke-width='4'/><g font-family='monospace' fill='#232328'><text x='76' y='100' font-size='19'>MANUFACTURING CO.</text><text x='76' y='134' font-size='14'>SERIAL</text><text x='76' y='162' font-size='14'>DESIGN P.  4.0 BAR</text><text x='76' y='190' font-size='14'>TEST P.    6.0 BAR</text><text x='76' y='218' font-size='14'>YEAR       2026</text></g><g fill='#6e6a64'><circle cx='68' cy='72' r='5'/><circle cx='332' cy='72' r='5'/><circle cx='68' cy='228' r='5'/><circle cx='332' cy='228' r='5'/></g>`,
  unit: () => `<rect width='400' height='300' fill='#c6d2da'/><rect y='196' width='400' height='104' fill='#b0a89c'/><rect x='40' y='96' width='320' height='104' rx='48' fill='#d8d4cc' stroke='#5a564f' stroke-width='4'/><rect x='34' y='88' width='332' height='120' rx='7' fill='none' stroke='#3f3b36' stroke-width='5'/><g fill='#5a564f'><circle cx='104' cy='210' r='19'/><circle cx='296' cy='210' r='19'/></g><path d='M40 148h320' stroke='#c8621e' stroke-width='9'/>`,
}

// The caption strip is part of the plate, the way a site photo carries one.
export const photoImg = (kind, label, arg) => svgUrl(
  `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'>`
  + PLATE[kind](arg)
  + `<rect y='272' width='400' height='28' fill='#000000' fill-opacity='0.55'/>`
  + `<text x='9' y='291' font-family='monospace' font-size='13' fill='#ffffff'>${esc(label).slice(0, 46)}</text>`
  + `</svg>`)

/* ── the measurement point map ───────────────────────────────────

   A dimensional report is letters against numbers, and the letters mean
   nothing without the drawing they are balloon-ed on.

   One dimension-line layout serves every product: six lines around and
   through the body of the unit, lettered A to F in the same order the
   rows are written, so balloon B on the drawing is row B in the table.
   Only the outline under them changes. */
export const DIM_LINES = [
  [30, 314, 530, 314],   // A — overall length, along the bottom
  [24, 58, 24, 274],     // B — overall height, at the left
  [74, 44, 486, 44],     // C — body length, along the top
  [536, 92, 536, 240],   // D — body height, at the right
  /* E and F cross inside the body, and each balloon sits at the middle
     of its own line — so neither is centred on the sheet, or the two
     boxes would be drawn on top of each other. */
  [140, 200, 400, 200],  // E — inside, across
  [340, 96, 340, 240],   // F — inside, down
]

const arrow = (x1, y1, x2, y2) => {
  const a = 5, c = '#1f5fbf'
  const heads = y1 === y2
    ? `<path d='M${x1} ${y1}l${a} -${a}v${2 * a}z' fill='${c}'/><path d='M${x2} ${y2}l-${a} -${a}v${2 * a}z' fill='${c}'/>`
    : `<path d='M${x1} ${y1}l-${a} ${a}h${2 * a}z' fill='${c}'/><path d='M${x2} ${y2}l-${a} -${a}h${2 * a}z' fill='${c}'/>`
  return `<path d='M${x1} ${y1}L${x2} ${y2}' stroke='${c}' stroke-width='1.6'/>${heads}`
}
// Boxed, the way the shop's own drawings balloon a dimension.
const balloon = (x, y, letter) =>
  `<rect x='${x - 12}' y='${y - 11}' width='24' height='22' rx='2.5' fill='#ffffff' stroke='#1f5fbf' stroke-width='1.6'/>`
  + `<text x='${x}' y='${y + 6}' font-family='monospace' font-size='14' font-weight='700' fill='#12305f' text-anchor='middle'>${esc(letter)}</text>`

/* The unit under the dimensions. Schematic on purpose: this is a
   drawing extract, not a photograph of a tank. */
const OUTLINE = {
  IST: `<rect x='30' y='58' width='500' height='216' fill='none' stroke='#2a2a30' stroke-width='4'/>`
    + `<rect x='74' y='92' width='412' height='148' rx='74' fill='#e4e2dd' stroke='#2a2a30' stroke-width='3.5'/>`
    + `<circle cx='280' cy='108' r='16' fill='#d3d0ca' stroke='#2a2a30' stroke-width='2.5'/>`
    + `<path d='M120 240v34M440 240v34' stroke='#2a2a30' stroke-width='3'/>`
    + `<g fill='#2a2a30'><rect x='30' y='58' width='26' height='22'/><rect x='504' y='58' width='26' height='22'/>`
    + `<rect x='30' y='252' width='26' height='22'/><rect x='504' y='252' width='26' height='22'/></g>`,
  BKT: `<path d='M74 70h412v78l-56 118H130L74 148z' fill='#e4e2dd' stroke='#2a2a30' stroke-width='4'/>`
    + `<path d='M130 266h300' stroke='#2a2a30' stroke-width='9'/>`
    + `<g fill='none' stroke='#2a2a30' stroke-width='3'><circle cx='180' cy='112' r='17'/><circle cx='380' cy='112' r='17'/></g>`
    + `<path d='M74 148h412' stroke='#2a2a30' stroke-width='2' stroke-dasharray='7 5'/>`,
  WTK: `<rect x='74' y='96' width='412' height='140' rx='66' fill='#e4e2dd' stroke='#2a2a30' stroke-width='3.5'/>`
    + `<rect x='56' y='240' width='448' height='22' fill='#cfccc6' stroke='#2a2a30' stroke-width='3'/>`
    + `<g fill='#2a2a30'><circle cx='140' cy='280' r='22'/><circle cx='400' cy='280' r='22'/></g>`
    + `<path d='M196 96v140M300 96v140M404 96v140' stroke='#2a2a30' stroke-width='2' stroke-dasharray='6 5'/>`
    + `<rect x='268' y='74' width='40' height='24' fill='#d3d0ca' stroke='#2a2a30' stroke-width='2.5'/>`,
  // A horizontal pressure vessel on saddles: dished ends, a manway on
  // the crown, a drain at the bottom.
  ART: `<path d='M110 96h340a52 52 0 0 1 0 148H110a52 52 0 0 1 0-148z' fill='#e4e2dd' stroke='#2a2a30' stroke-width='4'/>`
    + `<path d='M110 96a52 52 0 0 0 0 148M450 96a52 52 0 0 1 0 148' fill='none' stroke='#2a2a30' stroke-width='2' stroke-dasharray='6 5'/>`
    + `<rect x='252' y='72' width='56' height='26' rx='3' fill='#d3d0ca' stroke='#2a2a30' stroke-width='2.5'/>`
    + `<path d='M280 244v22' stroke='#2a2a30' stroke-width='4'/>`
    + `<g fill='#cfccc6' stroke='#2a2a30' stroke-width='3'><path d='M150 244h72l14 30h-100z'/><path d='M338 244h72l14 30h-100z'/></g>`
    + `<circle cx='430' cy='128' r='13' fill='none' stroke='#2a2a30' stroke-width='2.5'/>`,
  FTK: `<rect x='74' y='84' width='412' height='158' rx='16' fill='#e4e2dd' stroke='#2a2a30' stroke-width='4'/>`
    + `<rect x='56' y='246' width='448' height='26' fill='#cfccc6' stroke='#2a2a30' stroke-width='3'/>`
    + `<path d='M74 132h412M74 194h412' stroke='#2a2a30' stroke-width='2' stroke-dasharray='6 5'/>`
    + `<rect x='250' y='62' width='60' height='24' fill='#d3d0ca' stroke='#2a2a30' stroke-width='2.5'/>`
    + `<circle cx='430' cy='112' r='15' fill='none' stroke='#2a2a30' stroke-width='2.5'/>`,
}

/* Drawing paper, as one tile rather than thirty-five drawn lines: the
   same picture, a tenth of the characters, forty-six times over. */
const PAPER = `<defs><pattern id='g' width='28' height='28' patternUnits='userSpaceOnUse'>`
  + `<path d='M28 0H0v28' fill='none' stroke='#e6e4df' stroke-width='1'/></pattern></defs>`
  + `<rect width='560' height='340' fill='url(#g)'/>`

export const mapImg = ({ prefix, dwg, view, letters }) => svgUrl(
  `<svg xmlns='http://www.w3.org/2000/svg' width='560' height='372' viewBox='0 0 560 372'>`
  + `<rect width='560' height='372' fill='#fbfbf9'/>` + PAPER
  + OUTLINE[prefix]
  + letters.map((L, i) => {
    const [x1, y1, x2, y2] = DIM_LINES[i]
    return arrow(x1, y1, x2, y2) + balloon((x1 + x2) / 2, (y1 + y2) / 2, L)
  }).join('')
  + `<rect y='340' width='560' height='32' fill='#eceae5' stroke='#c9c6bf'/>`
  + `<text x='10' y='361' font-family='monospace' font-size='14' fill='#2a2a30'>${esc(dwg)}</text>`
  + `<text x='550' y='361' font-family='monospace' font-size='14' fill='#2a2a30' text-anchor='end'>${esc(view)}</text>`
  + `</svg>`)

/* The signed page a document record is closed on. ITP, PTR and IRN are
   not inspections this shop performs — what is filed is somebody else's
   document, and the record exists to hold it. */
export const docImg = ({ title, ref, issuer }) => svgUrl(
  `<svg xmlns='http://www.w3.org/2000/svg' width='420' height='300' viewBox='0 0 420 300'>`
  + `<rect width='420' height='300' fill='#d7d4ce'/><rect x='34' y='16' width='352' height='268' fill='#fdfdfb' stroke='#8e8880' stroke-width='2'/>`
  + `<rect x='34' y='16' width='352' height='40' fill='#eceae5' stroke='#8e8880' stroke-width='2'/>`
  + `<text x='48' y='42' font-family='monospace' font-size='15' font-weight='700' fill='#232328'>${esc(title).slice(0, 34)}</text>`
  + `<text x='48' y='78' font-family='monospace' font-size='12' fill='#3a3a42'>No. ${esc(ref).slice(0, 30)}</text>`
  + `<text x='48' y='98' font-family='monospace' font-size='12' fill='#3a3a42'>Issued by ${esc(issuer).slice(0, 26)}</text>`
  + `<g stroke='#b8b4ad' stroke-width='1.4'>`
  + Array.from({ length: 8 }, (_, i) => `<path d='M48 ${122 + i * 16}h${i === 7 ? 180 : 324}'/>`).join('')
  + `</g>`
  + `<path d='M250 262c14-26 26-22 30 4c3 16 10 14 16-6c6-19 18-15 24 6' fill='none' stroke='#17171a' stroke-width='2.4' stroke-linecap='round'/>`
  + `<path d='M240 274h130' stroke='#8e8880' stroke-width='1.4'/>`
  + `<text x='240' y='288' font-family='monospace' font-size='10' fill='#5a564f'>Signature / date</text>`
  + `</svg>`)

/* Turning a fixture's recipes into the pictures themselves.

   `k` names a plate, `m` a point map, `d` a filed document, `h` a hand.
   A report that carries none of them comes back untouched. */
const pic = (p) => (p.k ? { id: p.id, label: p.label, img: photoImg(p.k, p.label, p.a) }
  : p.m ? { id: p.id, label: p.label, img: mapImg(p.m) }
    : p.d ? { id: p.id, label: p.label, img: docImg(p.d) }
      : p)

export function hydrate(report) {
  const values = { ...report.values }
  for (const [k, v] of Object.entries(values)) {
    if (v && typeof v === 'object' && v.h !== undefined && v.name) values[k] = { name: v.name, at: v.at, img: signImg(v.h) }
    else if (Array.isArray(v) && v.some((x) => x && (x.m || x.k || x.d))) values[k] = v.map(pic)
  }
  return { ...report, values, photos: (report.photos || []).map(pic) }
}
