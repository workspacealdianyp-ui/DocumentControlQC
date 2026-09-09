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
import { DIM_LINES, handOf } from '../src/data/plates.js'

const QA = 'QA Lead'
const INSPECTORS = ['Inspector One', 'Inspector Two']

let seed = 20260907
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
const pick = (a) => a[Math.floor(rnd() * a.length) % a.length]
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1))
const dec = (lo, hi, p = 1) => (lo + rnd() * (hi - lo)).toFixed(p)
const pad2 = (n) => String(n).padStart(2, '0')

/* The pictures are drawn by src/data/plates.js, once each. What is
   recorded here is which picture: a plate name and its caption, a hand,
   a point map's drawing number. The fixture used to carry every one of
   them expanded — four signature hands written out four hundred times —
   and reached 1.2 MB, a quarter of the shipped bundle. */
const sig = (name, at) => ({ name, at, h: handOf(name) })
const photo = (kind, label, arg) => ({ id: `ph-${kind}-${int(1000, 9999)}`, label, k: kind, ...(arg ? { a: arg } : {}) })

const pointMap = (order, rows, values) => {
  const view = (order.view || 'General arrangement').toUpperCase()
  const letters = rows.slice(0, DIM_LINES.length).map((r) => r.itemNo)
  return {
    id: `map-${order.prefix}-${int(1000, 9999)}`,
    // The view is already named above the plate; the caption says what
    // the balloons on it are.
    label: `Measurement points ${letters.join(', ')}`,
    m: { prefix: order.prefix, dwg: values.drawingNo, view, letters },
  }
}

const docPage = (title, ref, issuer) => ({
  id: `doc-${int(1000, 9999)}`,
  label: `${title} ${ref} — signed page 1`,
  d: { title, ref, issuer },
})

// Which plates suit which report, and what the caption should say.
const PHOTOS_FOR = {
  hydrotest: (v, rows) => [
    photo('gauge', `Test pressure held at ${v.testPressure || '6.0'} ${v.pressureUnit || 'Bar'}`),
    photo('unit', `${v.jobDesc} ${v.unit} under test`),
  ],
  blasting: (v) => [
    photo('coating', `DFT reading, ${v.coatingPrep || 'Primer'} coat`),
    photo('unit', `${v.jobDesc} ${v.unit} after coating`),
  ],
  dimensional: (v, rows) => [
    photo('tape', `${rows[0]?.description || 'Overall length'} — ${rows[0]?.actual || ''} mm`),
    photo('unit', `${v.jobDesc} ${v.unit}`),
  ],
  visual: (v, rows) => [
    photo('unit', `${rows[0]?.point || 'External surface'}`),
    photo('plate', `Data plate, ${v.unit}`),
  ],
  nde: (v, rows) => [
    photo('weld', `${rows[0]?.partId || 'Weld seam'} after examination`),
    photo('unit', `${v.jobDesc} ${v.unit}`),
  ],
}
const photosFor = (formKey, values, rows) =>
  (PHOTOS_FOR[['mt', 'pt', 'ut'].includes(formKey) ? 'nde' : formKey] || (() => []))(values, rows)

const BY_ID = {
  standard: () => 'ASME Sect. VIII, Div. 1, 2019 Edition',
  material: () => 'ASTM A516 Gr.70',
  materialSpec: () => 'ASTM A516 Gr.70',
  surfaceCond: () => 'As-welded, blast cleaned',
  /* Written in Bar. The schema defaults the unit to PsiG, and 4 design
     / 6 test in PsiG is under half an atmosphere — a number no QC
     reviewer would read past on a pressure vessel. */
  pressureUnit: () => 'Bar',
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
  viewName: () => 'Tank general arrangement', inspStage: () => 'After welding',
  tagNumber: () => 'N/A',
  rev: () => `Rev. ${int(0, 2)}`,
  notes: () => 'Filed against this unit. Scope as stated on the document; no exclusions.',
  cable: () => 'Coaxial BNC, 2.0 m', couplant: () => 'CMC gel',
  sspc: () => 'SP 10', surfacePrep: () => 'SA 2½',
}

/* ── the three orders ───────────────────────────────────────────── */
const FORM_KEYS = new Set(DELIVERABLES.filter((d) => d.form).map((d) => d.key))
const ORDERS = [
  { po: 'PO-2026-ISO-0447', product: 'ISO TANK SPARGES', kategori: 'NON TRAILER', view: 'Side elevation',
    customer: 'Customer 07', customerId: 'CUST-007', units: 16, prefix: 'IST', first: 1000300001,
    required: ['Dimension Report', 'NDE Report', 'Leak & Hydro Test', 'Painting', 'Pre-Shipment'],
    parts: ['Shell longitudinal seam', 'Shell circumferential seam', 'Manlid nozzle N1',
            'Outlet nozzle N2', 'Sparge pipe bracket', 'Frame corner casting'],
    dims: ['Overall length', 'Overall width', 'Overall height', 'Frame diagonal',
           'Manlid centre offset', 'Sparge pipe pitch'],
    nominal: [6058, 2438, 2591, 6470, 1220, 900],
    points: ['Shell external surface', 'Ladder mounting', 'Manlid seal face',
             'Frame weld toe', 'Data plate', 'Outlet valve guard'] },
  { po: 'PO-2026-BKT-0512', product: 'BUCKET', kategori: 'NON TRAILER', view: 'Section A-A',
    customer: 'Customer 03', customerId: 'CUST-003', units: 10, prefix: 'BKT', first: 1000310001,
    required: ['Dimension Report', 'NDE Report', 'Painting', 'Pre-Shipment'],
    parts: ['Lip plate to side', 'Wear strip fillet', 'Pivot lug root',
            'Back sheet seam', 'Side cutter mount'],
    dims: ['Lip width', 'Bucket depth', 'Pin centre distance', 'Back height', 'Side plate pitch'],
    nominal: [3200, 1450, 1180, 1620, 2960],
    points: ['Lip wear plate', 'Pivot bore', 'Internal weld toe', 'Paint coverage', 'Data plate'] },
  { po: 'PO-2026-WTK-0388', product: 'WATER TRUCK', kategori: 'SUPEQ', view: 'Tank general arrangement',
    customer: 'Customer 05', customerId: 'CUST-005', units: 14, prefix: 'WTK', first: 1000320001,
    required: ['Dimension Report', 'NDE Report', 'Leak & Hydro Test', 'Painting', 'PDI'],
    variants: ['WATER TRUCK 20KL', 'WATER TRUCK 30KL', 'WATER TRUCK 35KL'],
    parts: ['Tank barrel seam', 'Baffle to shell', 'Sump weld', 'Filler neck',
            'Chassis mounting bracket'],
    dims: ['Tank length', 'Tank diameter', 'Sub-frame length', 'Baffle pitch', 'Sump depth'],
    nominal: [7200, 2200, 6800, 1500, 320],
    points: ['Tank external', 'Ladder & walkway', 'Spray bar', 'Pump guard', 'Data plate'] },

  /* The fourth order carries every deliverable there is.

     The other three each drop three or four — a bucket has nothing to
     hydrotest, an isotank order this shop runs needs no performance
     test — which is true to how the shop works and means none of them
     can show what a complete data book looks like. This one is the
     opposite case on purpose: nine deliverables, six units, all of them
     finished, approved and photographed, so an MDR can be compiled from
     it without filling anything in first. */
  { po: 'PO-2026-FTK-0621', product: 'FUEL TANK 25KL', kategori: 'SUPEQ', view: 'Tank general arrangement',
    customer: 'Customer 02', customerId: 'CUST-002', units: 6, prefix: 'FTK', first: 1000330001,
    required: DELIVERABLES.map((d) => d.key),
    parts: ['Shell longitudinal seam', 'Shell circumferential seam', 'Sump to shell fillet',
            'Filler neck to shell', 'Skid mounting bracket', 'Baffle to shell'],
    dims: ['Tank length', 'Tank height', 'Shell diameter', 'Skid length',
           'Baffle pitch', 'Sump centre offset'],
    nominal: [5400, 2100, 2000, 5600, 1350, 780],
    points: ['Shell external surface', 'Filler neck & breather', 'Sump & drain valve',
             'Skid frame weld toe', 'Ladder & platform', 'Data plate'] },
]

/* How far along each unit is. A live register is never uniformly
   finished, and a demo that is teaches nothing about the states in
   between. Everything here is expressed as "how many of the required
   reports exist" — never as a status written into the job list. */
/* How far along each unit is, set per order rather than by one ratio
   across all three.

   The isotank order is the one to open: fourteen of its sixteen units
   are finished, documented and photographed, so a data book can be
   compiled and a report opened without filling anything in first. The
   other two orders keep a spread, because a register where everything
   is finished shows none of the states an inspector actually works in —
   and because carrying evidence on all forty units would double a
   fixture that already weighs on the bundle.

   The two unfinished isotanks are deliberate: the last of them is what
   proves the data book refuses a document nobody has approved. */
const STAGE_MIX = {
  IST: ['complete', 'complete', 'complete', 'complete', 'complete', 'complete', 'complete',
        'complete', 'complete', 'complete', 'complete', 'complete', 'complete', 'complete',
        'nearly', 'started'],
  BKT: ['complete', 'complete', 'complete', 'complete', 'complete',
        'nearly', 'nearly', 'partway', 'partway', 'started'],
  WTK: ['complete', 'complete', 'complete', 'complete', 'complete', 'complete',
        'nearly', 'nearly', 'partway', 'partway', 'started', 'started', 'untouched', 'untouched'],
  // Every one of them, so the order it belongs to is the one to open.
  FTK: ['complete', 'complete', 'complete', 'complete', 'complete', 'complete'],
}
function stageFor(prefix, i, total) {
  const mix = STAGE_MIX[prefix]
  return mix?.[i] || (i / total < 0.4 ? 'complete' : 'partway')
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
    // A named value wins over the schema default: pressureUnit defaults
    // to PsiG, and these vessels are recorded in Bar.
    if (BY_ID[f.id]) return BY_ID[f.id]()
    const opts = optionsOf(f, values)
    return opts.length ? (f.default ?? pick(opts)) : undefined
  }
  if (f.id === 'partId') return pick(ctx.order.parts)
  if (f.id === 'description') return pick(ctx.order.dims)
  if (f.id === 'point') return pick(ctx.order.points)
  if (f.id === 'drawingNo') return `DWG-${ctx.order.prefix}-${int(4100, 4180)}-R${int(0, 2)}`
  if (f.id === 'viewName') return ctx.order.view || 'General arrangement'
  /* A document record carries somebody else's document: its own number,
     the day it was issued, and who signed it. Left to the generic
     fillers these came out as placeholder text on the one section a
     record exists for. */
  if (f.id === 'docRef') return `${ctx.code}-${ctx.order.po.slice(-4)}-${pad2(ctx.unitIndex + 1)}`
  if (f.id === 'issuedOn') return ctx.date
  if (f.id === 'issuedBy') return ctx.issuer || 'QC Engineering'
  if (BY_ID[f.id]) return BY_ID[f.id]()
  if (t === 'number') return dec(1, 100, 1)
  /* Non-conformance notes belong on a non-conformance. The blanket
     textarea filler was writing "No outstanding items." into the NCR box
     of every clean report, which is contradictory on the face of the
     document and made 27 passing reports read as non-conformances to
     anything counting them. The reject path fills this field itself. */
  if (f.id === 'ncr') return undefined
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
                   'Painting': 'blasting', 'Pre-Shipment': 'visual', 'PDI': 'visual',
                   ITP: 'itp', PTR: 'ptr', IRN: 'irn' }

const jobs = []
const reports = []
let jobNoCounter = 0
// Numbers already handed out, per form and job. See makeReport.
const issued = {}

function makeReport({ order, job, unitIndex, deliverable, formKey, issue, dayOffset, reject, status, supersedes, withEvidence }) {
  const schema = FORM_SCHEMAS[formKey]
  const inspector = INSPECTORS[(unitIndex + issue) % INSPECTORS.length]
  const date = new Date(Date.UTC(2026, 3, 6 + dayOffset)).toISOString().slice(0, 10)
  const ISSUER = { itp: 'QC Engineering & Client', ptr: 'Test house — PT Uji Mutu', irn: 'Client site inspector' }
  const ctx = { inspector, date, order, code: schema.code, unitIndex, issuer: ISSUER[schema.key] }

  /* The number is handed out per form and job, exactly as nextReportId
     does at runtime — not per deliverable. Pre-Shipment and PDI are both
     filled on the visual form, so an order carrying both used to produce
     two different documents under one number, MFG/VG/<job>/01 twice, and
     a data book cannot have that. */
  const numKey = `${schema.code}/${job.jobNo}`
  const seq = (issued[numKey] = (issued[numKey] || 0) + 1)
  const reportId = `MFG/${schema.code}/${job.jobNo}/${pad2(seq)}`

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
      /* A dimensional report has one row per balloon on its drawing, so
         the count comes from the drawing rather than from a round
         number: six lines, six letters, six rows. */
      const count = sec.autoJudge === 'dim' ? Math.min(order.dims.length, DIM_LINES.length) : 5
      for (let i = 0; i < count; i++) {
        const bad = reject && i === 2
        const force = sec.judgeKey && sec.autoJudge !== 'dim' ? { [sec.judgeKey]: bad ? rej : acc } : {}
        if (bad) {
          force.remark = 'Indication exceeds acceptance criteria. NCR raised.'
          if ((sec.columns || []).some((c) => c.id === 'discontinuity')) force.discontinuity = pick(['Porosity', 'Undercut', 'Slag inclusion'])
          if ((sec.columns || []).some((c) => c.id === 'defectType')) force.defectType = pick(['Surface porosity', 'Weld spatter', 'Coating holiday'])
        }
        if (sec.autoJudge === 'dim') {
          const nominal = order.nominal[i % order.nominal.length]
          // The letter is the row's tie to the balloon on the map above it.
          Object.assign(force, { itemNo: String.fromCharCode(65 + i),
            description: order.dims[i % order.dims.length],
            nominal: String(nominal), min: String(nominal - 3), max: String(nominal + 3),
            actual: String(nominal + (bad ? 7 : (i % 3) - 1)) })
          force.note = bad ? 'Outside drawing tolerance. NCR raised.' : ''
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

  /* Evidence goes on the finished units. Every schema has a Photo
     Evidence section and the visual form asks for one per inspection
     point, so a report with none printed "No photos attached" across a
     page of the book — true of all 138 of them until now. Carrying it on
     every report at every stage would double a fixture that already
     weighs on the bundle, and a unit nobody has finished inspecting has
     no evidence to show yet anyway. */
  if (withEvidence) photos.push(...photosFor(formKey, values, results))

  /* The point map is not photo evidence — it is the drawing the table is
     read against, and it belongs in the report whether or not this unit
     was photographed. fillField wrote the string "N/A" into it, so every
     dimensional report printed letters against nothing. */
  if (schema.key === 'dimensional') values.drawingFile = [pointMap(order, results, values)]

  /* A record is closed on the signed page it holds. Without one the
     section that is the entire point of the form printed "No photos
     attached". */
  if (schema.kind === 'record') photos.push(docPage(schema.title, values.docRef, values.issuedBy))

  const submittedAt = `${date}T09:${pad2(int(10, 55))}:00.000Z`
  const approvedAt = `${date}T15:${pad2(int(5, 50))}:00.000Z`
  if (status !== 'draft') values.signInspector = sig(inspector, submittedAt)
  if (status === 'approved') values.signQc = sig(QA, approvedAt)

  const rep = { id: `demo-${job.jobNo}-${schema.code}-${pad2(seq)}`, reportId, formKey,
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

    const stage = stageFor(order.prefix, u, order.units)
    // A finished unit is one whose book someone would actually open.
    const withEvidence = stage === 'complete'
    const n = order.required.length
    const howMany = { complete: n, nearly: n - 1, partway: Math.ceil(n / 2), started: 1, untouched: 0 }[stage]

    // the interesting units, spread across the three orders
    const special = (order.prefix === 'IST' && u === 4) ? 'reject'
      : (order.prefix === 'IST' && u === 9) ? 'revised'
      : (order.prefix === 'BKT' && u === 2) ? 'reject'
      : (order.prefix === 'WTK' && u === 6) ? 'revised'
      : (order.prefix === 'WTK' && u === 10) ? 'draft'
      : (order.prefix === 'BKT' && u === 8) ? 'held'
      : (order.prefix === 'IST' && u === 14) ? 'held'
      : null

    order.required.slice(0, howMany).forEach((deliverable, k) => {
      const formKey = deliverable === 'NDE Report' ? NDE_ROTATION[(u + k) % 3] : FORM_FOR[deliverable]
      const dayOffset = jobNoCounter * 3 + k
      const touched = k === Math.min(2, howMany - 1)

      if (special === 'draft' && touched) {
        reports.push(makeReport({ order, job, unitIndex: u, deliverable, formKey, issue: 1, dayOffset, reject: false, status: 'draft', withEvidence }))
        return
      }
      if (special === 'held' && touched) {
        reports.push(makeReport({ order, job, unitIndex: u, deliverable, formKey, issue: 1, dayOffset, reject: false, status: 'submitted', withEvidence }))
        return
      }
      if (special === 'revised' && touched) {
        const first = makeReport({ order, job, unitIndex: u, deliverable, formKey, issue: 1, dayOffset, reject: true, status: 'approved', withEvidence })
        reports.push(first)
        reports.push(makeReport({ order, job, unitIndex: u, deliverable, formKey, issue: 2, dayOffset: dayOffset + 9, reject: false, status: 'approved', supersedes: first, withEvidence }))
        return
      }
      reports.push(makeReport({ order, job, unitIndex: u, deliverable, formKey, issue: 1, dayOffset,
        reject: special === 'reject' && touched, status: 'approved', withEvidence }))
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
/* Written as a plain object literal.

   Emitting it as JSON.parse of a string is the usual advice for a large
   fixture, on the grounds that a JS engine has a faster path for the
   JSON grammar. Measured here it lost on both counts: 7.6 ms against
   6.4 ms to evaluate, and 49 KB larger, because escaping this much
   quoted text into a JS string literal costs more than the pretty-
   printing it saves. So it stays readable. */
writeFileSync('src/data/seedReports.js',
`// GENERATED by scripts/gen-demo.mjs — do not edit by hand.
// Demo fixture: ${reports.length} inspection reports across ${jobs.length} units,
// ${reports.filter((r) => (r.photos || []).length).length} of them carrying photo evidence.
// Every deliverable that reads Done has one of these behind it; the job
// list marks nothing done on its own. Fictional people and customers.
//
// Pictures are recipes, not data URLs: { k } names a plate, { m } a
// measurement point map, { d } a filed document, { h } a signing hand.
// hydrate() in ./plates.js draws them, and the store calls it once, when
// it seeds. Carrying them expanded here cost 1.2 MB.
import { hydrate } from './plates.js'

const RAW = ${JSON.stringify(reports)}

/* Built on demand, and only ever once: a device that has already seeded
   never asks, and a device that has not pays for the drawings at the one
   moment it needs them. */
let built = null
export const seedReports = () => (built ||= RAW.map(hydrate))

// Issue numbers already spent, so none can be handed out twice.
export const SEED_COUNTERS = ${JSON.stringify(counters)}
`)

const byStage = {}
for (const o of ORDERS) for (let u = 0; u < o.units; u++) { const s = stageFor(o.prefix, u, o.units); byStage[s] = (byStage[s] || 0) + 1 }
console.log(`${jobs.length} unit across ${ORDERS.length} PO:`, ORDERS.map((o) => `${o.product} ${o.units}`).join(' · '))
console.log(`${reports.length} laporan |`, JSON.stringify(byStage))
console.log('dengan bukti foto:', reports.filter((r) => (r.photos || []).length).length, 'laporan')
console.log('reject:', reports.filter((r) => r.values.testResult === 'Unsatisfactory' || r.values.finalStatus === 'Reject'
  || (r.results || []).some((x) => ['Reject', 'Rej', 'NG'].includes(x.judgement))
  || (r.results || []).some((x) => x.actual && x.max && Number(x.actual) > Number(x.max))).length,
  '| revisi:', reports.filter((r) => r.supersedes).length,
  '| draft:', reports.filter((r) => r.status === 'draft').length,
  '| submitted:', reports.filter((r) => r.status === 'submitted').length)
