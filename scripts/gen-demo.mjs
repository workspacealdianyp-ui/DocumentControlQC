/* Builds the demo data the app opens with: src/data/joblist.json and
   src/data/seedReports.js, together, from one description.
     node scripts/gen-demo.mjs

   Together is the point. The two files used to be written separately —
   a job list imported from a status sheet, and a handful of reports —
   so a job could say a deliverable was finished while no document
   existed anywhere. The register read 8 of 9 complete, the Documents
   list was empty, and clicking one of the eight opened a blank form.

   Here nothing is marked done in the job list at all. A deliverable is
   done because a report below made it done, so the invariant holds by
   construction rather than by anyone remembering to keep two files in
   step. The only thing the job list still decides is scope: which
   deliverables this product needs, and which do not apply.

   Manual deliverables — ITP, PTR, IRN — have no form, so they can never
   carry a document and are marked not applicable here. Leaving them in
   scope would put 100% permanently out of reach.

   Fictional customers, fictional inspectors, generated signatures. The
   app itself cannot draw a signature; only this script can, and only
   into demo fixtures that say so. */
import { writeFileSync } from 'node:fs'
import { FORM_SCHEMAS } from '../src/data/formSchemas.js'
import { DELIVERABLES } from '../src/lib/constants.js'

const QA = 'QA Lead'
const INSPECTORS = ['Inspector One', 'Inspector Two']

let seed = 20260907
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
const pick = (a) => a[Math.floor(rnd() * a.length) % a.length]
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1))
const dec = (lo, hi, p = 1) => (lo + rnd() * (hi - lo)).toFixed(p)
const pad2 = (n) => String(n).padStart(2, '0')

/* Four hands, so a data book does not carry one traced squiggle forty
   times. Paths are written without separators — SVG allows it — because
   every character here is multiplied by a hundred-odd reports and ends
   up in the bundle. */
const HANDS = [
  'M8 56C26 18 40 20 45 50C48 68 56 70 62 44C68 22 79 25 82 52C84 71 95 67 107 39C115 21 123 25 125 51C127 69 137 67 153 43C171 17 193 19 199 43',
  'M10 62C22 30 36 24 42 52C46 70 55 66 60 40C65 18 78 22 83 48C87 68 98 64 112 42C122 26 132 30 136 54C139 70 150 66 166 46C178 31 194 34 204 50',
  'M9 50C20 22 33 26 39 54C43 72 53 68 58 44C63 20 75 24 80 50C84 70 96 66 108 44C118 26 130 28 134 52C137 70 148 68 162 48C174 32 190 30 202 44',
  'M12 58C24 26 38 22 44 48C48 66 57 70 63 46C69 22 82 26 86 54C89 72 100 68 113 44C122 27 134 31 138 55C141 71 152 65 167 45C179 30 195 32 206 48',
]
const handOf = (n) => HANDS[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % HANDS.length]
const sig = (name, at) => ({
  name, at,
  img: 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='90'><path d='${handOf(name)}' fill='none' stroke='%2317171a' stroke-width='2.6' stroke-linecap='round'/></svg>`),
})

const BY_ID = {
  standard: () => 'ASME Sect. VIII, Div. 1, 2019 Edition',
  material: () => 'ASTM A516 Gr.70',
  materialSpec: () => 'ASTM A516 Gr.70',
  surfaceCond: () => 'As-welded, blast cleaned',
  designPressure: () => '4.0', mawp: () => '4.0', map: () => '-',
  testPressure: () => '6.0', holding: () => '30',
  scale: () => '1 div = 0.2 Bar', ncrRef: () => 'N/A',
  lightEquip: () => 'LED floodlight 50W',
  lightIntensity: () => String(int(1080, 1620)),
  equipId: () => 'YK-2201', brand: () => 'Magnaflux 7HF',
  particleDesc: () => `Wet fluorescent, batch WF${int(400, 899)}`,
  whiteContrast: () => `Contrast paint, batch WC${int(100, 399)}`,
  cleanerBatch: () => `Solvent cleaner, batch CL${int(200, 699)}`,
  abrasive: () => 'Steel grit G-40', anchorProfile: () => dec(50, 75, 0),
  dryTemp: () => dec(29, 33, 1), wetTemp: () => dec(24, 27, 1), matlTemp: () => dec(31, 35, 1),
  paintDesc: () => pick(['2-pack epoxy primer', 'Epoxy mastic MIO', 'Polyurethane topcoat']),
  thinner: () => 'Epoxy thinner',
  batchPaint: () => `B${int(20000, 29999)}`, batchThinner: () => `T${int(3000, 3999)}`,
  welderId: () => `W-${int(10, 48)}`, thickness: () => dec(6, 14, 1),
  weldNo: () => `WS-${int(1, 40)}`, soundpath: () => dec(10, 55, 1),
  amplitude: () => String(int(20, 68)), length: () => String(int(4, 26)), depth: () => dec(2, 12, 1),
  discontinuity: () => 'None', itemNo: () => String(int(1, 12)),
  note: () => pick(['Measured with steel tape.', 'Verified twice.', '']),
  suSerial: () => `SU-${int(1000, 9999)}`, suSize: () => '10 mm dia.',
  hole: () => 'SDH Ø 2.4 mm', refReflector: () => 'IIW V1 block',
  model: () => 'EPOCH 650', serialNo: () => `SN-${int(10000, 99999)}`,
  cable: () => 'Coaxial BNC, 2.0 m', couplant: () => 'CMC gel',
  sspc: () => 'SP 10', surfacePrep: () => 'SA 2½',
}

/* ── the three orders ───────────────────────────────────────────── */
const FORM_KEYS = new Set(DELIVERABLES.filter((d) => d.form).map((d) => d.key))
const ORDERS = [
  { po: 'PO-2026-ISO-0447', product: 'ISO TANK SPARGES', kategori: 'NON TRAILER',
    customer: 'Customer 07', customerId: 'CUST-007', units: 16, prefix: 'IST', first: 1000300001,
    required: ['Dimension Report', 'NDE Report', 'Leak & Hydro Test', 'Painting', 'Pre-Shipment'],
    parts: ['Shell longitudinal seam', 'Shell circumferential seam', 'Manlid nozzle N1',
            'Outlet nozzle N2', 'Sparge pipe bracket', 'Frame corner casting'],
    dims: ['Overall length', 'Overall width', 'Overall height', 'Frame diagonal',
           'Manlid centre offset', 'Sparge pipe pitch'],
    nominal: [6058, 2438, 2591, 6470, 1220, 900],
    points: ['Shell external surface', 'Ladder mounting', 'Manlid seal face',
             'Frame weld toe', 'Data plate', 'Outlet valve guard'] },
  { po: 'PO-2026-BKT-0512', product: 'BUCKET', kategori: 'NON TRAILER',
    customer: 'Customer 03', customerId: 'CUST-003', units: 10, prefix: 'BKT', first: 1000310001,
    required: ['Dimension Report', 'NDE Report', 'Painting', 'Pre-Shipment'],
    parts: ['Lip plate to side', 'Wear strip fillet', 'Pivot lug root',
            'Back sheet seam', 'Side cutter mount'],
    dims: ['Lip width', 'Bucket depth', 'Pin centre distance', 'Back height', 'Side plate pitch'],
    nominal: [3200, 1450, 1180, 1620, 2960],
    points: ['Lip wear plate', 'Pivot bore', 'Internal weld toe', 'Paint coverage', 'Data plate'] },
  { po: 'PO-2026-WTK-0388', product: 'WATER TRUCK', kategori: 'SUPEQ',
    customer: 'Customer 05', customerId: 'CUST-005', units: 14, prefix: 'WTK', first: 1000320001,
    required: ['Dimension Report', 'NDE Report', 'Leak & Hydro Test', 'Painting', 'PDI'],
    variants: ['WATER TRUCK 20KL', 'WATER TRUCK 30KL', 'WATER TRUCK 35KL'],
    parts: ['Tank barrel seam', 'Baffle to shell', 'Sump weld', 'Filler neck',
            'Chassis mounting bracket'],
    dims: ['Tank length', 'Tank diameter', 'Sub-frame length', 'Baffle pitch', 'Sump depth'],
    nominal: [7200, 2200, 6800, 1500, 320],
    points: ['Tank external', 'Ladder & walkway', 'Spray bar', 'Pump guard', 'Data plate'] },
]

/* How far along each unit is. A live register is never uniformly
   finished, and a demo that is teaches nothing about the states in
   between. Everything here is expressed as "how many of the required
   reports exist" — never as a status written into the job list. */
function stageFor(i, total) {
  const r = i / total
  if (r < 0.35) return 'complete'      // every report approved — data book ready
  if (r < 0.60) return 'nearly'        // one still to come
  if (r < 0.80) return 'partway'       // about half
  if (r < 0.92) return 'started'       // just the first
  return 'untouched'                   // raised, nothing recorded yet
}

const optionsOf = (f, values) => {
  const o = typeof f.options === 'function' ? f.options(values, '') : f.options
  return Array.isArray(o) ? o : []
}

function fillField(f, ctx, values) {
  const t = f.type || 'text'
  if (['auto', 'computed', 'readonly', 'jobsearch', 'sign'].includes(t)) return undefined
  if (t === 'date') return ctx.date
  if (t === 'timer') return String(int(10, 40))
  if (['select', 'segmented', 'toggle', 'choice'].includes(t)) {
    const opts = optionsOf(f, values)
    return opts.length ? (f.default ?? pick(opts)) : undefined
  }
  if (f.id === 'partId') return pick(ctx.order.parts)
  if (f.id === 'description') return pick(ctx.order.dims)
  if (f.id === 'point') return pick(ctx.order.points)
  if (f.id === 'drawingNo') return `DWG-${ctx.order.prefix}-${int(4100, 4180)}-R${int(0, 2)}`
  if (BY_ID[f.id]) return BY_ID[f.id]()
  if (t === 'number') return dec(1, 100, 1)
  if (t === 'textarea') return 'Inspection carried out per the referenced procedure. No outstanding items.'
  if (f.default != null) return f.default
  if (f.placeholder) return f.placeholder.replace(/^e\.g\.\s*/i, '')
  return 'N/A'
}

const buildRow = (columns, ctx, values, force = {}) => {
  const r = {}
  for (const c of columns) {
    if (c.type === 'computed' || c.type === 'auto') continue
    const v = fillField(c, ctx, values)
    if (v !== undefined) r[c.id] = v
  }
  return { ...r, ...force }
}

const NDE_ROTATION = ['mt', 'pt', 'ut']
const FORM_FOR = { 'Dimension Report': 'dimensional', 'Leak & Hydro Test': 'hydrotest',
                   'Painting': 'blasting', 'Pre-Shipment': 'visual', 'PDI': 'visual' }

const jobs = []
const reports = []
let jobNoCounter = 0

function makeReport({ order, job, unitIndex, deliverable, formKey, issue, dayOffset, reject, status, supersedes }) {
  const schema = FORM_SCHEMAS[formKey]
  const inspector = INSPECTORS[(unitIndex + issue) % INSPECTORS.length]
  const date = new Date(Date.UTC(2026, 3, 6 + dayOffset)).toISOString().slice(0, 10)
  const ctx = { inspector, date, order }
  const reportId = `MFG/${schema.code}/${job.jobNo}/${pad2(issue)}`

  const values = { reportId, inspDate: date, inspector, jobNo: job.jobNo, poNo: order.po,
    wbsNo: job.wbsNo, jobDesc: job.productDesc, sn: job.arasSN, unit: job.unitNo, customer: order.customer }
  const results = [], readings = [], coats = [], photos = []

  for (const sec of schema.sections) {
    const type = sec.type || 'fields'
    if (type === 'fields') {
      for (const f of sec.fields || []) {
        if (values[f.id] !== undefined) continue
        const v = fillField(f, ctx, values)
        if (v !== undefined) values[f.id] = v
      }
    } else if (type === 'results') {
      const rej = sec.rejValue || 'Reject', acc = sec.accValue || 'Acc'
      for (let i = 0; i < 5; i++) {
        const bad = reject && i === 2
        const force = sec.judgeKey && sec.autoJudge !== 'dim' ? { [sec.judgeKey]: bad ? rej : acc } : {}
        if (bad) {
          force.remark = 'Indication exceeds acceptance criteria. NCR raised.'
          if ((sec.columns || []).some((c) => c.id === 'discontinuity')) force.discontinuity = pick(['Porosity', 'Undercut', 'Slag inclusion'])
          if ((sec.columns || []).some((c) => c.id === 'defectType')) force.defectType = pick(['Surface porosity', 'Weld spatter', 'Coating holiday'])
        }
        if (sec.autoJudge === 'dim') {
          const nominal = order.nominal[i % order.nominal.length]
          Object.assign(force, { description: order.dims[i % order.dims.length],
            nominal: String(nominal), min: String(nominal - 3), max: String(nominal + 3),
            actual: String(nominal + (bad ? 7 : (i % 3) - 1)) })
          if (bad) force.note = 'Outside drawing tolerance. NCR raised.'
        }
        results.push(buildRow(sec.columns || [], ctx, values, force))
      }
    } else if (type === 'recording') {
      const punit = values.pressureUnit || 'Bar'
      const tp = parseFloat(values.testPressure || '6') || 6
      for (let i = 0; i < 5; i++) {
        const p = i === 0 ? 0 : reject && i === 4 ? tp - 0.42 : tp - i * 0.01
        readings.push({ time: `0${8 + i}:${pad2(int(5, 55))}`,
          pg1: p.toFixed(2), pg2: p.toFixed(2), rec: p.toFixed(2),
          water: dec(28, 31, 1), ambient: dec(30, 34, 1),
          remark: i === 0 ? `Start, 0 ${punit}`
            : reject && i === 4 ? 'Pressure drop observed — leak at outlet nozzle. Test failed.'
            : i === 4 ? 'Hold complete, no drop' : 'Stable' })
      }
    } else if (type === 'dft') {
      for (let c = 1; c <= 3; c++) {
        coats.push({ coat: `Coat ${c}`,
          area: ['Exterior — Zone A', 'Exterior — Zone B', 'Frame & walkway'][c - 1],
          pts: Array.from({ length: 5 }, () => dec(c === 1 ? 120 : 180, c === 1 ? 175 : 260, 0)),
          std: c === 1 ? '120' : '175' })
      }
    }
  }

  // Two gauges have to be two instruments.
  if (values.pg1 && values.pg2 === values.pg1) {
    const eq = FORM_SCHEMAS.hydrotest.sections.find((x) => x.id === 'equip')
    const gauges = optionsOf(eq.fields.find((f) => f.id === 'pg1'), values)
    const other = gauges.find((g) => g !== values.pg1)
    if (other) values.pg2 = other
  }

  if (schema.key === 'hydrotest') values.testResult = reject ? 'Unsatisfactory' : 'Satisfactory'
  if (schema.key === 'blasting') values.finalStatus = reject ? 'Reject' : 'Accept'
  if (reject) {
    values.ncr = 'Non-conformance raised against this unit. Rework and re-inspection required before release.'
    if (values.ncrRef !== undefined) values.ncrRef = `NCR-26-${pad2(unitIndex + 1)}${issue}`
  }

  const submittedAt = `${date}T09:${pad2(int(10, 55))}:00.000Z`
  const approvedAt = `${date}T15:${pad2(int(5, 50))}:00.000Z`
  if (status !== 'draft') values.signInspector = sig(inspector, submittedAt)
  if (status === 'approved') values.signQc = sig(QA, approvedAt)

  const rep = { id: `demo-${job.jobNo}-${schema.code}-${pad2(issue)}`, reportId, formKey,
    jobNo: job.jobNo, deliverable, status, inspector, values, readings, results, coats, photos,
    createdAt: `${date}T07:40:00.000Z`,
    updatedAt: status === 'approved' ? approvedAt : submittedAt,
    synced: status !== 'draft' }
  if (status === 'approved') { rep.approvedBy = QA; rep.approvedAt = approvedAt }
  if (rep.synced) rep.syncedAt = rep.updatedAt
  if (supersedes) { rep.supersedes = supersedes.reportId; rep.supersedesId = supersedes.id }
  return rep
}

for (const order of ORDERS) {
  for (let u = 0; u < order.units; u++) {
    jobNoCounter++
    const jobNo = String(order.first + u)
    const unitNo = `${order.prefix}-${order.po.slice(-4)}-${pad2(u + 1)}`
    const productDesc = order.variants ? order.variants[u % order.variants.length] : order.product

    // Scope only. Nothing here says anything is finished.
    const deliverables = {}
    for (const d of DELIVERABLES) {
      deliverables[d.key] = {
        status: order.required.includes(d.key) ? 'not-started' : 'na',
        ref: null,
      }
    }
    const job = {
      no: jobNoCounter, kategori: order.kategori, type: productDesc, productDesc,
      datePB: '2026-03-02', jobNo, wbsNo: `WBS-26-${pad2(u + 1)}${order.po.slice(-2)}`,
      arasSN: unitNo, unitNo, poNo: order.po,
      customerId: order.customerId, customerName: order.customer,
      cogm: String(226000000 + jobNoCounter * 137),
      datePdiRelease: '2026-11-20',
      required: order.required,
      deliverables,
    }
    jobs.push(job)

    const stage = stageFor(u, order.units)
    const n = order.required.length
    const howMany = { complete: n, nearly: n - 1, partway: Math.ceil(n / 2), started: 1, untouched: 0 }[stage]

    // the interesting units, spread across the three orders
    const special = (order.prefix === 'IST' && u === 4) ? 'reject'
      : (order.prefix === 'IST' && u === 9) ? 'revised'
      : (order.prefix === 'BKT' && u === 2) ? 'reject'
      : (order.prefix === 'WTK' && u === 6) ? 'revised'
      : (order.prefix === 'WTK' && u === 11) ? 'draft'
      : (order.prefix === 'BKT' && u === 8) ? 'held'
      : null

    order.required.slice(0, howMany).forEach((deliverable, k) => {
      const formKey = deliverable === 'NDE Report' ? NDE_ROTATION[(u + k) % 3] : FORM_FOR[deliverable]
      const dayOffset = jobNoCounter * 3 + k
      const touched = k === Math.min(2, howMany - 1)

      if (special === 'draft' && touched) {
        reports.push(makeReport({ order, job, unitIndex: u, deliverable, formKey, issue: 1, dayOffset, reject: false, status: 'draft' }))
        return
      }
      if (special === 'held' && touched) {
        reports.push(makeReport({ order, job, unitIndex: u, deliverable, formKey, issue: 1, dayOffset, reject: false, status: 'submitted' }))
        return
      }
      if (special === 'revised' && touched) {
        const first = makeReport({ order, job, unitIndex: u, deliverable, formKey, issue: 1, dayOffset, reject: true, status: 'approved' })
        reports.push(first)
        reports.push(makeReport({ order, job, unitIndex: u, deliverable, formKey, issue: 2, dayOffset: dayOffset + 9, reject: false, status: 'approved', supersedes: first }))
        return
      }
      reports.push(makeReport({ order, job, unitIndex: u, deliverable, formKey, issue: 1, dayOffset,
        reject: special === 'reject' && touched, status: 'approved' }))
    })
  }
}

const src = JSON.parse(JSON.stringify({
  deliverableTypes: DELIVERABLES.map((d) => d.key),
  customers: [...new Set(ORDERS.map((o) => o.customer))].sort(),
  kategoris: ['SUPEQ', 'TRAILER', 'NON TRAILER'],
  types: [...new Set(jobs.map((j) => j.type))].sort(),
  jobs,
}))
writeFileSync('src/data/joblist.json', JSON.stringify(src, null, 1) + '\n')

const counters = {}
for (const r of reports) {
  const m = r.reportId.match(/^[^/]+\/([^/]+)\/([^/]+)\/(\d+)$/)
  if (m) { const k = `${m[1]}/${m[2]}`; counters[k] = Math.max(counters[k] || 0, Number(m[3])) }
}
writeFileSync('src/data/seedReports.js',
`// GENERATED by scripts/gen-demo.mjs — do not edit by hand.
// Demo fixture: ${reports.length} inspection reports across ${jobs.length} units.
// Every deliverable that reads Done has one of these behind it; the job
// list marks nothing done on its own. Fictional people and customers.
export const SEED_REPORTS = ${JSON.stringify(reports, null, 1)}

// Issue numbers already spent, so none can be handed out twice.
export const SEED_COUNTERS = ${JSON.stringify(counters, null, 1)}
`)

const byStage = {}
for (const o of ORDERS) for (let u = 0; u < o.units; u++) { const s = stageFor(u, o.units); byStage[s] = (byStage[s] || 0) + 1 }
console.log(`${jobs.length} unit across ${ORDERS.length} PO:`, ORDERS.map((o) => `${o.product} ${o.units}`).join(' · '))
console.log(`${reports.length} laporan |`, JSON.stringify(byStage))
console.log('reject:', reports.filter((r) => r.values.testResult === 'Unsatisfactory' || r.values.finalStatus === 'Reject'
  || (r.results || []).some((x) => ['Reject', 'Rej', 'NG'].includes(x.judgement))
  || (r.results || []).some((x) => x.actual && x.max && Number(x.actual) > Number(x.max))).length,
  '| revisi:', reports.filter((r) => r.supersedes).length,
  '| draft:', reports.filter((r) => r.status === 'draft').length,
  '| submitted:', reports.filter((r) => r.status === 'submitted').length)
