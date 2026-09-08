/* Renders the masthead plate.
     node scripts/gen-banner.mjs

   Writes src/assets/banner-light.svg and banner-dark.svg. Both are
   committed, so this only has to run when the drawing changes.

   The drawing: squares on a lattice tilted 20 degrees, lit from the
   upper left, with a few large planes lifted off the field on soft
   shadows. Three things make it hold together.

   The quilt behind it is a <pattern>, so it costs the same four lines
   whatever width the band is stretched to, and it never repeats a seam.

   The planes are positioned in plate space and only then snapped to the
   lattice. Placing them in lattice space instead walks them off the top
   of the plate as the column index rises, because the tilt carries the
   whole lattice upward — which is how the first pass lost its accent
   square off the edge.

   And every gradient is counter-rotated by the tilt, so the lit corner
   of every square is the same corner. A square lit along whichever edge
   the lattice happened to leave facing up is what makes this kind of
   field read as noise rather than as one surface under one light. */
import { writeFileSync } from 'node:fs'

const W = 1200, H = 160          // the plate; the band crops to its middle
const T = 26                     // quilt cell
const ANG = -20                  // lattice tilt
const CX = 600, CY = 80          // rotation centre, shared by quilt and planes

const rad = (ANG * Math.PI) / 180
const cos = Math.cos(rad), sin = Math.sin(rad)
const toPlate = (x, y) => {
  const dx = x - CX, dy = y - CY
  return [CX + dx * cos - dy * sin, CY + dx * sin + dy * cos]
}
const toLattice = (x, y) => {
  const dx = x - CX, dy = y - CY
  return [CX + dx * cos + dy * sin, CY - dx * sin + dy * cos]
}
const poly = (cx, cy, half) => [[-1, -1], [1, -1], [1, 1], [-1, 1]]
  .map(([sx, sy]) => toPlate(cx + sx * half, cy + sy * half).map((n) => n.toFixed(1)).join(','))
  .join(' ')

/* The quilt's tone per cell. Deterministic, and weighted so the two
   lightest tones dominate: a field using all five evenly reads as noise
   rather than as one surface with some squares catching the light. */
const hash = (i, j) => { const n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return n - Math.floor(n) }
const PICK = [0, 1, 0, 2, 1, 0, 3, 1, 0, 1, 2, 0, 4, 1, 0, 2]
const cellTone = (i, j) => PICK[Math.floor(hash(i, j) * PICK.length) % PICK.length]

/* The planes, placed where they should land on the plate — x and y as
   fractions of it — and snapped to the lattice from there so they still
   sit square to the quilt. `k` is the size in cells.

   Sparse and large on the left, where the title is read over them;
   gathering and smaller toward the right, where the band is at full
   strength and there is nothing to read. y stays near the middle third,
   which is the strip the band actually crops to. */
const PLANES = [
  { x: 0.05, y: 0.36, k: 3, tone: 'pale' },
  { x: 0.16, y: 0.70, k: 2, tone: 'mid' },
  { x: 0.27, y: 0.30, k: 2, tone: 'pale' },
  { x: 0.38, y: 0.64, k: 3, tone: 'deep' },
  { x: 0.50, y: 0.34, k: 2, tone: 'pale' },
  { x: 0.46, y: 0.72, k: 3, tone: 'mid' },
  { x: 0.76, y: 0.28, k: 3, tone: 'pale' },
  { x: 0.80, y: 0.66, k: 2, tone: 'deep' },
  { x: 0.93, y: 0.62, k: 3, tone: 'pale' },
  /* The accent, last so nothing crops it — a plane drawn over it turns
     the one square with a job into an L-shaped offcut.

     Its position is the whole of its design. Vertically centred, because
     the band crops to the middle of the plate and an accent cut in half
     by that crop reads as a mistake. And two thirds across, which is the
     clear lane: the title runs out before it and the reading on the far
     right starts after it, so the one coloured thing in the band is not
     sitting behind either of them. That lane is 0.28-0.81 of the band on
     a desktop and 0.34-0.73 at tablet width; 0.55 is the middle of both,
     which is why it is not simply "somewhere on the right". */
  { x: 0.55, y: 0.50, k: 2, tone: 'accent' },
]

const THEMES = {
  light: {
    ground: ['#fcfcfa', '#eeeeea'],
    // each tone is [lit corner, shaded corner] — the bevel, not two colours
    tones: [['#ffffff', '#f6f6f3'], ['#f6f6f2', '#e9e9e3'], ['#eeeee8', '#dedeD7'],
            ['#e4e4dd', '#d2d2ca'], ['#d8d8d0', '#c4c4bb']],
    planes: {
      pale: ['#ffffff', '#f2f2ee'],
      mid: ['#f2f2ed', '#e0e0d9'],
      deep: ['#e6e6df', '#d0d0c7'],
      accent: ['#ff8636', '#dd5500'],
    },
    shadow: '#14141a', shadowOp: 0.18,
    wash: 0.5, washTint: '#ffffff',
    settle: 0.10,
    edge: '#ffffff', edgeOp: 0.6,
  },
  dark: {
    ground: ['#1b1b21', '#101014'],
    tones: [['#20202824', '#17171c'], ['#1a1a20', '#131318'], ['#282831', '#1d1d24'],
            ['#313139', '#24242c'], ['#3b3b45', '#2b2b34']],
    planes: {
      pale: ['#2e2e38', '#1f1f26'],
      mid: ['#26262e', '#19191f'],
      deep: ['#383842', '#26262f'],
      accent: ['#ff8c3c', '#c44b00'],
    },
    shadow: '#000000', shadowOp: 0.5,
    wash: 0.16, washTint: '#b9c6e0',
    settle: 0.4,
    edge: '#ffffff', edgeOp: 0.09,
  },
}

// A tone lit from the upper left. The gradient is counter-rotated so the
// highlight stays on the same corner of every square whatever the
// lattice does underneath it.
const grad = (p, id, [a, b]) => `    <linearGradient id="${p}${id}" x1="0" y1="0" x2="1" y2="1" gradientTransform="rotate(${-ANG} 0.5 0.5)">
      <stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/>
    </linearGradient>`

function build(name) {
  const t = THEMES[name]
  // Ids are namespaced per theme. Both files are only ever loaded as
  // their own document, but two SVGs inlined in one page share an id
  // space, and the second one then silently draws with the first one
  // palette — which is exactly what happened on the contact sheet.
  const p = `${name[0]}-`

  const cells = []
  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < 4; i++) {
      cells.push(`      <rect x="${i * T}" y="${j * T}" width="${T}" height="${T}" fill="url(#${p}q${cellTone(i, j)})"/>`)
    }
  }

  const planes = PLANES.map((pl) => {
    const half = (pl.k * T) / 2
    const [lx, ly] = toLattice(pl.x * W, pl.y * H)
    // Snapped to half a cell: on the lattice, but free to straddle a
    // seam, which is what stops the planes reading as a second quilt.
    const snap = (v) => Math.round(v / (T / 2)) * (T / 2)
    const cx = snap(lx), cy = snap(ly)
    const accent = pl.tone === 'accent'
    return `    <g>
      <polygon points="${poly(cx, cy, half)}" fill="url(#${p}pl-${pl.tone})"/>
      <polygon points="${poly(cx, cy, half - 0.8)}" fill="none" stroke="${t.edge}" stroke-opacity="${accent ? 0.3 : t.edgeOp}" stroke-width="1.6"/>
    </g>`
  }).join('\n')

  const pair = name === 'light' ? 'dark' : 'light'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
  <!-- GENERATED by scripts/gen-banner.mjs - do not edit by hand.

       The masthead plate: squares on a lattice tilted 20 degrees, lit
       from the upper left, with a few large planes lifted off the field
       on soft shadows. The quilt is a pattern, so it costs the same at
       any width; the planes over it are drawn in unrotated space, which
       is what keeps every shadow falling the same way.

       One square carries the safety orange. It is the only colour in the
       band, so it reads as a mark rather than as decoration.

       Pairs with banner-${pair}.svg; see .masthead in styles.css. -->
  <defs>
    <linearGradient id="${p}ground" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="${t.ground[0]}"/><stop offset="1" stop-color="${t.ground[1]}"/>
    </linearGradient>
${t.tones.map((c, n) => grad(p, `q${n}`, c)).join('\n')}
${Object.entries(t.planes).map(([k, c]) => grad(p, `pl-${k}`, c)).join('\n')}
    <!-- the light itself: brightest off the upper left and falling away
         to the far corner, so the field reads as one lit surface rather
         than as tiles that happen to differ -->
    <radialGradient id="${p}wash" cx="0.22" cy="-0.15" r="1.1">
      <stop offset="0" stop-color="${t.washTint}" stop-opacity="${t.wash}"/>
      <stop offset="0.5" stop-color="${t.washTint}" stop-opacity="${(t.wash * 0.3).toFixed(3)}"/>
      <stop offset="1" stop-color="${t.washTint}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="${p}settle" x1="0.15" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${t.shadow}" stop-opacity="0"/>
      <stop offset="1" stop-color="${t.shadow}" stop-opacity="${t.settle}"/>
    </linearGradient>
    <pattern id="${p}quilt" patternUnits="userSpaceOnUse" width="${4 * T}" height="${4 * T}"
      patternTransform="rotate(${ANG} ${CX} ${CY})">
${cells.join('\n')}
    </pattern>
    <filter id="${p}lift" x="-30%" y="-30%" width="180%" height="190%">
      <feDropShadow dx="5" dy="8" stdDeviation="7" flood-color="${t.shadow}" flood-opacity="${t.shadowOp}"/>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#${p}ground)"/>
  <rect width="${W}" height="${H}" fill="url(#${p}quilt)"/>
  <g filter="url(#${p}lift)">
${planes}
  </g>
  <rect width="${W}" height="${H}" fill="url(#${p}wash)"/>
  <rect width="${W}" height="${H}" fill="url(#${p}settle)"/>
</svg>
`
}

for (const name of ['light', 'dark']) writeFileSync(`src/assets/banner-${name}.svg`, build(name))
console.log('src/assets/banner-light.svg, src/assets/banner-dark.svg')
