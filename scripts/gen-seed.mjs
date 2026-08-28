// Generates src/data/seedReports.js by walking FORM_SCHEMAS itself, so every
// seeded value lands on a field id that actually exists. Re-run after any
// schema change:  node scripts/gen-seed.mjs
import { writeFileSync } from 'node:fs'
import { FORM_SCHEMAS } from '../src/data/formSchemas.js'
import joblist from '../src/data/joblist.json' with { type: 'json' }

const INSPECTORS = ['Inspector One', 'Inspector Two']
const QA = 'QA Lead'

// Deterministic pseudo-random so re-running gives the same fixture.
let seed = 20260827
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
const pick = (a) => a[Math.floor(rnd() * a.length) % a.length]
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1))
const dec = (lo, hi, p = 1) => (lo + rnd() * (hi - lo)).toFixed(p)

const sig = (name) =>
  'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='90' viewBox='0 0 240 90'>` +
    `<path d='M10 58 C 28 20, 42 20, 46 50 C 49 68, 56 70, 62 46 C 68 24, 80 26, 82 52 C 84 72, 94 68, 106 40 C 114 22, 122 26, 124 52 C 126 70, 136 68, 152 44 C 170 18, 192 20, 198 44' ` +
    `fill='none' stroke='%2317171a' stroke-width='2.6' stroke-linecap='round'/>` +
    `<text x='10' y='84' font-family='monospace' font-size='9' fill='%236b6b72'>${name}</text></svg>`)

// Values that should read like a real record rather than lorem.
const BY_ID = {
  unit: () => `Unit ${String(int(1, 4)).padStart(2, '0')}`,
  spec: () => pick(['ASME VIII Div.1', 'AS 1210', 'API 650']),
  standard: () => pick(['AWS D1.1', 'ASME Sec. V', 'SSPC-VIS 1', 'ISO 8501-1']),
  material: () => pick(['ASTM A36', 'ASTM A516 Gr.70', 'S355JR', 'Hardox 450']),
  materialSpec: () => pick(['ASTM A36', 'ASTM A516 Gr.70', 'S355JR']),
  surfaceCond: () => pick(['As-welded', 'Ground flush', 'Blast cleaned']),
  designPressure: () => dec(6, 12, 1),
  mawp: () => dec(8, 14, 1),
  map: () => dec(9, 15, 1),
  testPressure: () => dec(10, 18, 1),
  holding: () => String(pick([30, 45, 60])),
  equip: () => `PG-00${int(1, 4)}`,
  ncrRef: () => 'N/A',
  lightEquip: () => 'LED floodlight 50W',
  lightmeter: () => `LUX-00${int(1, 2)}`,
  lightIntensity: () => String(int(1050, 1600)),
  equipId: () => `YK-2201`,
  abrasive: () => pick(['Steel grit G-40', 'Garnet 30/60', 'Copper slag']),
  anchorProfile: () => dec(45, 75, 0),
  dryTemp: () => dec(29, 34, 1),
  wetTemp: () => dec(24, 27, 1),
  matlTemp: () => dec(30, 36, 1),
  humidityRH: () => dec(58, 76, 0),
  dewPoint: () => dec(20, 24, 1),
  paintDesc: () => pick(['2-pack epoxy primer', 'Epoxy mastic', 'Polyurethane topcoat']),
  thinner: () => 'Epoxy thinner',
  batchPaint: () => `B${int(20000, 29999)}`,
  batchThinner: () => `T${int(3000, 3999)}`,
  drawingNo: () => `DWG-${int(1000, 9999)}-R${int(0, 2)}`,
  welderId: () => `W-${int(10, 48)}`,
  remark: () => pick(['Within acceptance.', 'No relevant indication.', 'Re-checked after grinding.']),
  thickness: () => dec(6, 20, 1),
  partId: () => `P-${int(100, 999)}`,
  weldNo: () => `WS-${int(1, 40)}`,
  soundpath: () => dec(10, 60, 1),
  amplitude: () => String(int(20, 70)),
  length: () => String(int(4, 30)),
  depth: () => dec(2, 14, 1),
  discontinuity: () => pick(['None', 'Porosity', 'Undercut', 'Slag inclusion']),
  description: () => pick(['Main seam', 'Nozzle N1 weld', 'Bracket fillet', 'Base frame joint']),
  point: () => `Point ${int(1, 12)}`,
  itemNo: () => `${int(1, 12)}`,
  nominal: () => dec(100, 2400, 0),
  note: () => pick(['Measured with steel tape.', 'Verified twice.', '']),
  // MT / PT / UT consumables and instrument details
  surfacePrep: () => pick(['SA 2\u00bd', 'SA 2', 'St 3']),
  sspc: () => pick(['SP 10', 'SP 6', 'SP 3']),
  brand: () => pick(['Magnaflux 7HF', 'Ardrox 800/3', 'Checkmor 250']),
  particleDesc: () => `Wet fluorescent, batch ${'WF'}${int(400, 899)}`,
  whiteContrast: () => `Contrast paint, batch WC${int(100, 399)}`,
  cleanerBatch: () => `Solvent cleaner, batch CL${int(200, 699)}`,
  model: () => pick(['USM Go+', 'EPOCH 650', 'DFX-8']),
  serialNo: () => `SN-${int(10000, 99999)}`,
  cable: () => `Coaxial BNC, ${pick([1.5, 2.0, 3.0])} m`,
  couplant: () => pick(['CMC gel', 'Glycerine', 'Cellulose paste']),
  suSerial: () => `SU-${int(1000, 9999)}`,
  suSize: () => pick(['10 mm dia.', '12.7 mm dia.', '6 x 6 mm']),
  hole: () => pick(['SDH \u00d8 2.4 mm', 'SDH \u00d8 1.6 mm', 'FBH \u00d8 3.0 mm']),
  refReflector: () => pick(['IIW V1 block', 'IIW V2 block', 'Step wedge']),
}

function fillField(f, ctx) {
  const t = f.type || 'text'
  if (['auto', 'computed', 'readonly', 'jobsearch'].includes(t)) return undefined
  if (t === 'user') return ctx.inspector
  if (t === 'sign') return f.req === 'O' ? undefined : sig(f.label.includes('QC') ? QA : ctx.inspector)
  if (t === 'date') return ctx.date
  if (t === 'timer') return String(int(10, 40))
  if (['select', 'segmented', 'toggle', 'choice'].includes(t)) {
    const opts = f.options || []
    return opts.length ? (f.default ?? pick(opts)) : undefined
  }
  if (BY_ID[f.id]) return BY_ID[f.id]()
  if (t === 'number') return dec(1, 100, 1)
  if (t === 'textarea') return 'Inspection carried out per the referenced procedure. No outstanding items.'
  if (f.default != null) return f.default
  if (f.placeholder) return f.placeholder.replace(/^e\.g\.\s*/i, '')
  // Last resort: never ship a bare 'OK'; say the value is not applicable.
  return 'N/A'
}

function buildRow(columns, ctx, force = {}) {
  const r = {}
  for (const c of columns) {
    if (c.type === 'computed' || c.type === 'auto') continue
    const v = fillField(c, ctx)
    if (v !== undefined) r[c.id] = v
  }
  return { ...r, ...force }
}

const jobs = joblist.jobs
const byKat = (k) => jobs.filter((j) => j.kategori === k)
const pool = [...byKat('SUPEQ'), ...byKat('TRAILER'), ...byKat('NON TRAILER')]

const PER_FORM = 3
const reports = []
let cursor = 0

for (const [key, schema] of Object.entries(FORM_SCHEMAS)) {
  for (let n = 0; n < PER_FORM; n++) {
    const job = pool[cursor++ % pool.length]
    const inspector = INSPECTORS[n % INSPECTORS.length]
    const day = 5 + ((cursor * 3) % 22)
    const date = `2026-0${1 + (cursor % 7)}-${String(day).padStart(2, '0')}`
    const ctx = { inspector, date, job }
    // one in three carries a rejected line so the NCR path is visible
    const hasReject = n === 2

    // page 1 is the job's identity, quoted from the job itself
    const values = { reportId: `MFG/${schema.code}/${job.jobNo}/0${n + 1}`, inspDate: date, inspector,
      jobNo: job.jobNo, poNo: job.poNo || '', wbsNo: job.wbsNo || '', jobDesc: job.productDesc,
      sn: job.arasSN, unit: job.unitNo || job.arasSN || '', customer: job.customerName }
    const results = [], readings = [], coats = [], photos = []

    for (const sec of schema.sections) {
      const type = sec.type || 'fields'
      if (type === 'fields') {
        for (const f of sec.fields || []) {
          if (values[f.id] !== undefined) continue
          const v = fillField(f, ctx)
          if (v !== undefined) values[f.id] = v
        }
      } else if (type === 'results') {
        const rej = sec.rejValue || 'Reject'
        const acc = sec.accValue || 'Acc'
        for (let i = 0; i < 3; i++) {
          const bad = hasReject && i === 1
          const force = sec.judgeKey ? { [sec.judgeKey]: bad ? rej : acc } : {}
          if (bad) force.remark = 'Indication exceeds acceptance. NCR raised.'
          if (sec.autoJudge === 'dim') {
            const nominal = +dec(200, 2400, 0)
            Object.assign(force, {
              nominal: String(nominal),
              min: String(nominal - 3), max: String(nominal + 3),
              actual: String((nominal + (bad ? 7 : 1)).toFixed(0)),
            })
          }
          results.push(buildRow(sec.columns || [], ctx, force))
        }
      } else if (type === 'recording') {
        const punit = values.pressureUnit || 'Bar'
        const tp = parseFloat(values.testPressure || '12') || 12
        for (let i = 0; i < 4; i++) {
          const p = i === 0 ? 0 : tp - i * 0.05
          readings.push({ time: `0${8 + i}:${String(int(10, 55)).padStart(2, '0')}`,
            pg1: p.toFixed(2), pg2: p.toFixed(2), rec: p.toFixed(2),
            water: dec(28, 31, 1), ambient: dec(30, 34, 1),
            remark: i === 0 ? `Start, 0 ${punit}` : i === 3 ? 'Hold complete, no drop' : 'Stable' })
        }
      } else if (type === 'dft') {
        for (let c = 1; c <= 2; c++) {
          coats.push({ coat: `Coat ${c}`, area: c === 1 ? 'Shell exterior' : 'Shell exterior',
            pts: Array.from({ length: 5 }, () => dec(120, 210, 0)), std: '150' })
        }
      }
    }

    const status = hasReject ? 'submitted' : n === 0 ? 'approved' : 'draft'
    // inspector is read off the report itself in several places (the job
    // detail row, the activity feed, "my drafts"); values.inspector alone
    // left those rendering undefined.
    const rep = { id: `seed-${key}-${n + 1}`, reportId: values.reportId, formKey: key,
      jobNo: job.jobNo, deliverable: schema.deliverable, status, inspector, values,
      readings, results, coats, photos,
      createdAt: `${date}T08:05:00.000Z`,
      updatedAt: `${date}T09:${String(int(10, 55)).padStart(2, '0')}:00.000Z`,
      synced: status !== 'draft' }
    if (status === 'approved') { rep.approvedBy = QA; rep.approvedAt = `${date}T15:20:00.000Z` }
    if (rep.synced) rep.syncedAt = rep.updatedAt
    reports.push(rep)
  }
}

const out = `// GENERATED by scripts/gen-seed.mjs — do not edit by hand.
// Demo fixture: ${reports.length} filled inspection reports, ${PER_FORM} per form type,
// spread across the job list. Loaded once on first run (see lib/store.js).
export const SEED_REPORTS = ${JSON.stringify(reports, null, 1)}
`
writeFileSync('src/data/seedReports.js', out)
console.log(`${reports.length} laporan (${PER_FORM} per form ×  ${Object.keys(FORM_SCHEMAS).length} form)`)
console.log('form:', Object.keys(FORM_SCHEMAS).join(', '))
