/* Generates a restorable mockup: one PO, 30 ISO TANK SPARGES units, with
   every inspection report filled in and signed, ready to compile into a
   data book.  node scripts/gen-mockup.mjs

   Output is a backup file for Settings → Storage → Restore, not a source
   change: the demo dataset stays out of the repository, loads on demand,
   and can be dropped again by clearing the browser.

   On the signatures. The app no longer draws a signature for anybody —
   a mark it invented on a real inspection record would be a forgery.
   What is generated here is different in kind and has to stay different:
   fictional people, on a fixture that says so in its own filename and in
   every record it writes. Nothing in the running app can produce these;
   only this script can, and only into a file a person has to choose to
   import. */
import { writeFileSync } from 'node:fs'
import { FORM_SCHEMAS } from '../src/data/formSchemas.js'

const QA = 'QA Lead'
const INSPECTORS = ['Inspector One', 'Inspector Two']

// Deterministic, so re-running gives byte-identical output.
let seed = 20260907
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
const pick = (a) => a[Math.floor(rnd() * a.length) % a.length]
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1))
const dec = (lo, hi, p = 1) => (lo + rnd() * (hi - lo)).toFixed(p)
const pad2 = (n) => String(n).padStart(2, '0')

/* Four different hands, so thirty units do not all carry one traced
   squiggle. Each person keeps theirs across every report they sign,
   which is what makes a data book look like it was signed by people. */
const HANDS = [
  "M8 56 C 26 18, 40 20, 45 50 C 48 68, 56 70, 62 44 C 68 22, 79 25, 82 52 C 84 71, 95 67, 107 39 C 115 21, 123 25, 125 51 C 127 69, 137 67, 153 43 C 171 17, 193 19, 199 43",
  "M10 62 C 22 30, 36 24, 42 52 C 46 70, 55 66, 60 40 C 65 18, 78 22, 83 48 C 87 68, 98 64, 112 42 C 122 26, 132 30, 136 54 C 139 70, 150 66, 166 46 C 178 31, 194 34, 204 50",
  "M9 50 C 20 22, 33 26, 39 54 C 43 72, 53 68, 58 44 C 63 20, 75 24, 80 50 C 84 70, 96 66, 108 44 C 118 26, 130 28, 134 52 C 137 70, 148 68, 162 48 C 174 32, 190 30, 202 44",
  "M12 58 C 24 26, 38 22, 44 48 C 48 66, 57 70, 63 46 C 69 22, 82 26, 86 54 C 89 72, 100 68, 113 44 C 122 27, 134 31, 138 55 C 141 71, 152 65, 167 45 C 179 30, 195 32, 206 48",
]
const handOf = (name) => HANDS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % HANDS.length]
const sig = (name, at) => ({
  name, at,
  img: 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='90' viewBox='0 0 240 90'>` +
    `<path d='${handOf(name)}' fill='none' stroke='%2317171a' stroke-width='2.6' ` +
    `stroke-linecap='round' stroke-linejoin='round'/></svg>`),
})

// Values that read like a real record for a tank container.
const BY_ID = {
  standard: () => 'ASME Sect. VIII, Div. 1, 2019 Edition',
  material: () => 'ASTM A516 Gr.70',
  materialSpec: () => 'ASTM A516 Gr.70',
  surfaceCond: () => 'As-welded, blast cleaned',
  designPressure: () => '4.0',
  mawp: () => '4.0',
  map: () => '-',
  testPressure: () => '6.0',
  holding: () => '30',
  scale: () => '1 div = 0.2 Bar',
  ncrRef: () => 'N/A',
  lightEquip: () => 'LED floodlight 50W',
  lightIntensity: () => String(int(1080, 1620)),
  equipId: () => `YK-2201`,
  brand: () => 'Magnaflux 7HF',
  particleDesc: () => `Wet fluorescent, batch WF${int(400, 899)}`,
  whiteContrast: () => `Contrast paint, batch WC${int(100, 399)}`,
  cleanerBatch: () => `Solvent cleaner, batch CL${int(200, 699)}`,
  abrasive: () => 'Steel grit G-40',
  anchorProfile: () => dec(50, 75, 0),
  dryTemp: () => dec(29, 33, 1),
  wetTemp: () => dec(24, 27, 1),
  matlTemp: () => dec(31, 35, 1),
  paintDesc: () => pick(['2-pack epoxy primer', 'Epoxy mastic MIO', 'Polyurethane topcoat']),
  thinner: () => 'Epoxy thinner',
  batchPaint: () => `B${int(20000, 29999)}`,
  batchThinner: () => `T${int(3000, 3999)}`,
  drawingNo: () => `DWG-IST-${int(4100, 4180)}-R${int(0, 2)}`,
  welderId: () => `W-${int(10, 48)}`,
  thickness: () => dec(6, 14, 1),
  partId: () => pick(['Shell longitudinal seam', 'Shell circumferential seam', 'Manlid nozzle N1',
                      'Outlet nozzle N2', 'Sparge pipe bracket', 'Frame corner casting']),
  weldNo: () => `WS-${int(1, 40)}`,
  soundpath: () => dec(10, 55, 1),
  amplitude: () => String(int(20, 68)),
  length: () => String(int(4, 26)),
  depth: () => dec(2, 12, 1),
  discontinuity: () => 'None',
  description: () => pick(['Overall length', 'Overall width', 'Overall height',
                           'Frame diagonal', 'Manlid centre offset', 'Sparge pipe pitch']),
  point: () => pick(['Shell external surface', 'Ladder mounting', 'Manlid seal face',
                     'Frame weld toe', 'Data plate', 'Outlet valve guard']),
  itemNo: () => String(int(1, 12)),
  note: () => pick(['Measured with steel tape.', 'Verified twice.', '']),
  suSerial: () => `SU-${int(1000, 9999)}`,
  suSize: () => '10 mm dia.',
  hole: () => 'SDH Ø 2.4 mm',
  refReflector: () => 'IIW V1 block',
  model: () => 'EPOCH 650',
  serialNo: () => `SN-${int(10000, 99999)}`,
  cable: () => 'Coaxial BNC, 2.0 m',
  couplant: () => 'CMC gel',
  sspc: () => 'SP 10',
  surfacePrep: () => 'SA 2½',
}

/* Options may now be a function of the current values, because the
   instrument fields draw on the calibrated register. Resolving it here
   is what keeps the fixture honest: every gauge on these reports is one
   the app itself would have offered on that date, carrying the
   calibration it was in. */
const optionsOf = (f, values) => {
  const o = typeof f.options === 'function' ? f.options(values, '') : f.options
  return Array.isArray(o) ? o : []
}

function fillField(f, ctx, values) {
  const t = f.type || 'text'
  if (['auto', 'computed', 'readonly', 'jobsearch'].includes(t)) return undefined
  if (t === 'sign') return undefined            // signatures are placed deliberately, below
  if (t === 'date') return ctx.date
  if (t === 'timer') return String(int(10, 40))
  if (['select', 'segmented', 'toggle', 'choice'].includes(t)) {
    const opts = optionsOf(f, values)
    if (!opts.length) return undefined
    return f.default ?? pick(opts)
  }
  if (BY_ID[f.id]) return BY_ID[f.id]()
  if (t === 'number') return dec(1, 100, 1)
  if (t === 'textarea') return 'Inspection carried out per the referenced procedure. No outstanding items.'
  if (f.default != null) return f.default
  if (f.placeholder) return f.placeholder.replace(/^e\.g\.\s*/i, '')
  return 'N/A'
}

function buildRow(columns, ctx, values, force = {}) {
  const r = {}
  for (const c of columns) {
    if (c.type === 'computed' || c.type === 'auto') continue
    const v = fillField(c, ctx, values)
    if (v !== undefined) r[c.id] = v
  }
  return { ...r, ...force }
}

/* ── the order ──────────────────────────────────────────────────── */
const PO = 'PO-2026-ISO-0447'
const ORDER_ID = 'po-mock-iso-0447'
const CUSTOMER = 'Customer 07'
const UNITS = 30
const FIRST_JOB = 1000300001

// The five deliverables that have a form behind them, so every one can
// be a real signed report rather than a row nobody can fill.
const REQUIRED = ['Dimension Report', 'NDE Report', 'Leak & Hydro Test', 'Painting', 'Pre-Shipment']
const FORM_FOR = {
  'Dimension Report': 'dimensional',
  'Leak & Hydro Test': 'hydrotest',
  'Painting': 'blasting',
  'Pre-Shipment': 'visual',
}
const NDE_ROTATION = ['mt', 'pt', 'ut']   // NDE Report is one of three methods

const units = Array.from({ length: UNITS }, (_, i) => ({
  jobNo: String(FIRST_JOB + i),
  wbsNo: `WBS-26-${pad2(i + 1)}47`,
  unitNo: `IST-0447-${pad2(i + 1)}`,
  productDesc: 'ISO TANK SPARGES',
  type: 'ISO TANK SPARGES',
}))

const order = {
  id: ORDER_ID,
  poNo: PO,
  customerName: CUSTOMER,
  customerId: 'C-07',
  kategori: 'NON TRAILER',
  datePB: '2026-03-02',
  datePdiRelease: '2026-11-20',
  required: REQUIRED,
  units,
  createdBy: QA,
  createdAt: '2026-03-02T02:15:00.000Z',
  fixture: 'mockup',
}

/* ── how each unit turns out ────────────────────────────────────────

   Twenty-six run clean. Two carry a rejection that was written up and
   approved as the record of it — a rejected inspection is still a
   document the book needs. Two were rejected, amended, and the amendment
   approved, so the register shows /01 superseded by /02. The last two are
   deliberately unfinished, so the data book refusing them is visible
   rather than theoretical. */
const PLAN = {}
for (let i = 0; i < UNITS; i++) PLAN[i] = { kind: 'clean' }
PLAN[6] = { kind: 'reject', form: 'Leak & Hydro Test' }
PLAN[13] = { kind: 'reject', form: 'NDE Report' }
PLAN[9] = { kind: 'revised', form: 'Dimension Report' }
PLAN[21] = { kind: 'revised', form: 'NDE Report' }
PLAN[27] = { kind: 'unfinished', form: 'Painting', state: 'draft' }
PLAN[29] = { kind: 'unfinished', form: 'Pre-Shipment', state: 'submitted' }

const reports = []

function makeReport({ unit, unitIndex, deliverable, formKey, issue, dayOffset, reject, status, supersedes }) {
  const schema = FORM_SCHEMAS[formKey]
  const inspector = INSPECTORS[(unitIndex + issue) % INSPECTORS.length]
  const d = new Date(Date.UTC(2026, 3, 6 + dayOffset))
  const date = d.toISOString().slice(0, 10)
  const ctx = { inspector, date }
  const reportId = `MFG/${schema.code}/${unit.jobNo}/${pad2(issue)}`

  const values = {
    reportId, inspDate: date, inspector,
    jobNo: unit.jobNo, poNo: PO, wbsNo: unit.wbsNo, jobDesc: unit.productDesc,
    sn: unit.unitNo, unit: unit.unitNo, customer: CUSTOMER,
  }
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
      const rej = sec.rejValue || 'Reject'
      const acc = sec.accValue || 'Acc'
      const rows = 5
      for (let i = 0; i < rows; i++) {
        const bad = reject && i === 2
        const force = sec.judgeKey && sec.autoJudge !== 'dim' ? { [sec.judgeKey]: bad ? rej : acc } : {}
        if (bad) {
          force.remark = 'Indication exceeds acceptance criteria. NCR raised.'
          if ((sec.columns || []).some((c) => c.id === 'discontinuity')) force.discontinuity = pick(['Porosity', 'Undercut', 'Slag inclusion'])
          if ((sec.columns || []).some((c) => c.id === 'defectType')) force.defectType = pick(['Surface porosity', 'Weld spatter', 'Coating holiday'])
        }
        if (sec.autoJudge === 'dim') {
          const nominal = [6058, 2438, 2591, 6470, 1220, 900][i % 6]
          Object.assign(force, {
            nominal: String(nominal),
            min: String(nominal - 3), max: String(nominal + 3),
            actual: String(nominal + (bad ? 7 : (i % 3) - 1)),
          })
          if (bad) force.note = 'Outside drawing tolerance. NCR raised.'
        }
        results.push(buildRow(sec.columns || [], ctx, values, force))
      }
    } else if (type === 'recording') {
      const punit = values.pressureUnit || 'Bar'
      const tp = parseFloat(values.testPressure || '6') || 6
      const steps = 5
      for (let i = 0; i < steps; i++) {
        const p = i === 0 ? 0 : reject && i === steps - 1 ? tp - 0.42 : tp - i * 0.01
        readings.push({
          time: `0${8 + i}:${pad2(int(5, 55))}`,
          pg1: p.toFixed(2), pg2: p.toFixed(2), rec: p.toFixed(2),
          water: dec(28, 31, 1), ambient: dec(30, 34, 1),
          remark: i === 0 ? `Start, 0 ${punit}`
            : reject && i === steps - 1 ? 'Pressure drop observed — leak at outlet nozzle. Test failed.'
            : i === steps - 1 ? 'Hold complete, no drop' : 'Stable',
        })
      }
    } else if (type === 'dft') {
      for (let c = 1; c <= 3; c++) {
        coats.push({
          coat: `Coat ${c}`,
          area: ['Shell exterior — Zone A', 'Shell exterior — Zone B', 'Frame & walkway'][c - 1],
          pts: Array.from({ length: 5 }, () => dec(c === 1 ? 120 : 180, c === 1 ? 175 : 260, 0)),
          std: c === 1 ? '120' : '175',
        })
      }
    }
  }

  /* Top and bottom gauges have to be two instruments. Picking at random
     landed on the same tag for both, which is the first thing a QC
     reviewer would query and would make the whole fixture look
     generated. */
  if (values.pg1 && values.pg2 === values.pg1) {
    const gauges = optionsOf({ options: (v, keep) => FORM_SCHEMAS.hydrotest.sections
      .find((x) => x.id === 'equip').fields.find((f) => f.id === 'pg1').options(v, keep) }, values)
    const other = gauges.find((g) => g !== values.pg1)
    if (other) values.pg2 = other
  }

  // The verdict fields the report is read by.
  if (schema.key === 'hydrotest') values.testResult = reject ? 'Unsatisfactory' : 'Satisfactory'
  if (schema.key === 'blasting') values.finalStatus = reject ? 'Reject' : 'Accept'
  if (reject) {
    values.ncr = 'Non-conformance raised against this unit. Rework and re-inspection required before release.'
    if (values.ncrRef !== undefined) values.ncrRef = `NCR-26-${pad2(unitIndex + 1)}${issue}`
  }

  /* Signatures. The inspector signs when the report is submitted; the QC
     supervisor signs at approval, and is never the same person — the app
     refuses that now, so a fixture that did it would be describing a
     state the app cannot reach. */
  const submittedAt = `${date}T09:${pad2(int(10, 55))}:00.000Z`
  const approvedAt = `${date}T15:${pad2(int(5, 50))}:00.000Z`
  if (status !== 'draft') values.signInspector = sig(inspector, submittedAt)
  if (status === 'approved') values.signQc = sig(QA, approvedAt)

  const rep = {
    id: `mock-${unit.jobNo}-${schema.code}-${pad2(issue)}`,
    reportId, formKey, jobNo: unit.jobNo, deliverable,
    status, inspector, values, readings, results, coats, photos,
    createdAt: `${date}T07:40:00.000Z`,
    updatedAt: status === 'approved' ? approvedAt : submittedAt,
    synced: status !== 'draft',
    fixture: 'mockup',
  }
  if (status === 'approved') { rep.approvedBy = QA; rep.approvedAt = approvedAt }
  if (rep.synced) rep.syncedAt = rep.updatedAt
  if (supersedes) { rep.supersedes = supersedes.reportId; rep.supersedesId = supersedes.id }
  return rep
}

units.forEach((unit, u) => {
  const plan = PLAN[u]
  REQUIRED.forEach((deliverable, k) => {
    const formKey = deliverable === 'NDE Report' ? NDE_ROTATION[u % NDE_ROTATION.length] : FORM_FOR[deliverable]
    const touched = plan.form === deliverable
    const dayOffset = u * 4 + k

    if (touched && plan.kind === 'unfinished') {
      reports.push(makeReport({ unit, unitIndex: u, deliverable, formKey, issue: 1, dayOffset,
        reject: false, status: plan.state }))
      return
    }
    if (touched && plan.kind === 'revised') {
      const first = makeReport({ unit, unitIndex: u, deliverable, formKey, issue: 1, dayOffset,
        reject: true, status: 'approved' })
      reports.push(first)
      reports.push(makeReport({ unit, unitIndex: u, deliverable, formKey, issue: 2, dayOffset: dayOffset + 9,
        reject: false, status: 'approved', supersedes: first }))
      return
    }
    reports.push(makeReport({ unit, unitIndex: u, deliverable, formKey, issue: 1, dayOffset,
      reject: touched && plan.kind === 'reject', status: 'approved' }))
  })
})

// The high-water marks, so a number already on one of these documents
// can never be handed out again.
const counters = {}
for (const r of reports) {
  const m = r.reportId.match(/^[^/]+\/([^/]+)\/([^/]+)\/(\d+)$/)
  if (!m) continue
  const k = `${m[1]}/${m[2]}`
  counters[k] = Math.max(counters[k] || 0, Number(m[3]))
}

const backup = {
  format: 'qc-inspection-monitor-backup',
  version: 2,
  exportedAt: new Date().toISOString(),
  note: `Mockup fixture — ${PO}, ${UNITS} ISO TANK SPARGES units. Generated by scripts/gen-mockup.mjs. Fictional people and fictional customer.`,
  counts: {
    reports: reports.length,
    approved: reports.filter((r) => r.status === 'approved').length,
    jobOrders: 1,
  },
  data: {
    'qc.jobOrders': [order],
    'qc.reports': reports,
    'qc.issueCounters': counters,
  },
}

const path = process.argv[2] || 'qc-mockup-iso-sparges.json'
writeFileSync(path, JSON.stringify(backup, null, 1))

const byStatus = reports.reduce((a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a), {})
const rejected = reports.filter((r) => r.values.testResult === 'Unsatisfactory' || r.values.finalStatus === 'Reject'
  || (r.results || []).some((x) => ['Reject', 'Rej', 'NG'].includes(x.judgement))).length
console.log(`${PO} — ${UNITS} unit ISO TANK SPARGES`)
console.log(`${reports.length} laporan:`, JSON.stringify(byStatus))
console.log(`${rejected} laporan berverdict Reject | ${reports.filter(r => r.supersedes).length} revisi`)
console.log(`file: ${path} (${(JSON.stringify(backup).length / 1024).toFixed(0)} KB)`)
