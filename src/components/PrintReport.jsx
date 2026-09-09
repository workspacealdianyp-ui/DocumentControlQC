import { COMPANY } from '../lib/company.js'
import { useEffect, useRef, useState } from 'react'
import { MR } from '../lib/compute.js'
import { dimRowStatus, dimDeviation, dimLimits } from '../data/formSchemas.js'
import { buildResume } from '../lib/resume.js'
import { useFitToPage, pageSpans, sameFit, oneEach, tighten, useSheetZoom } from '../lib/pagefit.js'
import { IconPrint } from './Icons.jsx'

// Formal industrial inspection report — bordered A4, generated from the report model.
const lbl = (f, v) => (typeof f.label === 'function' ? f.label(v) : f.label)
const showField = (f, v) => (typeof f.showIf === 'function' ? f.showIf(v) : true)

// Long-format date for the report, e.g. "14 June 2026"
const fmtLong = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Testing date with weekday — dddd, dd mmmm yyyy, e.g. "Sunday, 14 June 2026"
const fmtFull = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}

const fmt = (f, v, report) => {
  if (f.type === 'computed') return (f.compute ? f.compute(v, report) : '') || '—'
  if (f.type === 'sign') return v[f.id]?.name || '—'
  if (f.type === 'date' || f.fmt === 'date') return f.id === 'inspDate' ? fmtFull(v[f.id] ?? f.default) : fmtLong(v[f.id] ?? f.default)
  const val = v[f.id] ?? f.default
  if (val === undefined || val === null || val === '') return '—'
  // unit comes either from a sibling value (unitFrom, e.g. pressureUnit) or a fixed f.unit
  const unit = f.unitFrom ? (v[f.unitFrom] || '') : (f.unit || '')
  return unit && (f.type === 'number' || f.type === 'text') ? `${val} ${unit}` : String(val)
}

// Short date — 09 Sep 2026. The weekday belonged to a letter, not a
// controlled record, and it cost a line of width on every page.
const fmtShort = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// fields that only print when they actually carry a value
const EMPTYISH = new Set(['', '-', '–', '—', 'n/a', 'na'])
const HIDE_IF_BLANK = new Set(['designPressure', 'mawp', 'map', 'poNo', 'wbsNo'])
const isBlank = (f, v) => { const val = v[f.id] ?? f.default; return val == null || EMPTYISH.has(String(val).trim().toLowerCase()) }

function Pairs({ fields, v, report }) {
  const vis = fields.filter((f) => f.type !== 'sign' && f.type !== 'photos' && f.type !== 'photos-inline' && f.type !== 'jobsearch' && showField(f, v) && !(HIDE_IF_BLANK.has(f.id) && isBlank(f, v)))
  const rows = []
  for (let i = 0; i < vis.length; i += 2) rows.push([vis[i], vis[i + 1]])
  return (
    <table><tbody>
      {rows.map(([a, b], i) => (
        <tr key={i}>
          <td className="ps-label">{lbl(a, v)}</td><td className="ps-value">{fmt(a, v, report)}</td>
          {b ? <><td className="ps-label">{lbl(b, v)}</td><td className="ps-value">{fmt(b, v, report)}</td></>
            : <><td className="ps-label" style={{ background: '#fff' }} /><td className="ps-value" /></>}
        </tr>
      ))}
    </tbody></table>
  )
}

function RecordingTable({ report }) {
  const rows = report.readings || []
  const v = report.values || {}
  const twoG = v.gauges !== '1 Gauge', useRec = v.useRecorder !== 'Not used', useTemp = v.useTemp !== 'Not used'
  const pu = v.pressureUnit || 'PsiG'
  const cols = [['pg1', `${twoG ? 'PG 1' : 'PG'} (${pu})`]]
  if (twoG) cols.push(['pg2', `PG 2 (${pu})`])
  if (useRec) cols.push(['rec', `Rec. (${pu})`])
  if (useTemp) cols.push(['water', 'Water °C'], ['ambient', 'Amb °C'])
  return (
    <>
      {v.testDesc && <div className="ps-rec-object"><strong>Object</strong> : {v.testDesc}</div>}
      <table className="ps-grid ps-grid-rec"><thead><tr>
        <th style={{ width: '8mm' }}>CP</th><th style={{ width: '16mm' }}>Time</th><th style={{ width: '16mm' }}>Δ min</th>
        {cols.map(([k, l]) => <th key={k}>{l}</th>)}<th>Remark</th>
      </tr></thead><tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td>{i + 1}</td><td>{r.time || '—'}</td><td>{i === 0 ? 0 : MR.minutesBetween(rows[i - 1].time, r.time)}</td>
            {cols.map(([k]) => <td key={k}>{r[k] || '—'}</td>)}<td className="ps-left">{r.remark || '—'}</td>
          </tr>
        ))}
        {!rows.length && <tr><td colSpan={cols.length + 4} className="ps-na">No checkpoints recorded</td></tr>}
      </tbody></table>
    </>
  )
}

// Pressure × Time line chart — printed as an attachment for hydrotest
function PressureChart({ report }) {
  const rows = report.readings || []
  const v = report.values || {}
  const pu = v.pressureUnit || 'PsiG'
  const pts = rows.map((r, i) => ({ i, t: r.time || '', p: parseFloat(r.pg1) })).filter((p) => !isNaN(p.p))
  if (pts.length < 2) return null
  const W = 680, H = 300, padL = 46, padR = 16, padT = 18, padB = 44
  const ps = pts.map((p) => p.p)
  const pmax = Math.max(...ps), pmin = Math.min(...ps, 0)
  const span = pmax - pmin || 1
  const X = (i) => padL + (i * (W - padL - padR)) / (pts.length - 1)
  const Y = (p) => H - padB - ((p - pmin) / span) * (H - padT - padB)
  const line = pts.map((p, k) => `${k ? 'L' : 'M'}${X(k).toFixed(1)},${Y(p.p).toFixed(1)}`).join(' ')
  const ticks = 4
  return (
    <table><tbody><tr><td style={{ padding: '6pt' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }} aria-label="Pressure vs time">
        {Array.from({ length: ticks + 1 }).map((_, k) => {
          const p = pmin + (span * k) / ticks
          const y = Y(p)
          return (
            <g key={k}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#ccc" strokeWidth="0.6" />
              <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#444" fontFamily="monospace">{Math.round(p)}</text>
            </g>
          )
        })}
        <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="#000" strokeWidth="1" />
        <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="#000" strokeWidth="1" />
        <path d={line} fill="none" stroke="#142b54" strokeWidth="2" />
        {pts.map((p, k) => (
          <g key={k}>
            <circle cx={X(k)} cy={Y(p.p)} r="3" fill="#142b54" />
            {/* value callout — white halo so it reads over the gridlines */}
            <text x={X(k)} y={Y(p.p) - 7 < padT + 6 ? Y(p.p) + 14 : Y(p.p) - 7} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#142b54" fontFamily="monospace" stroke="#fff" strokeWidth="2.8" paintOrder="stroke">{p.p}</text>
            <text x={X(k)} y={H - padB + 13} textAnchor="middle" fontSize="8" fill="#333" fontFamily="monospace">{p.t}</text>
            <text x={X(k)} y={H - padB + 24} textAnchor="middle" fontSize="7.5" fill="#777" fontFamily="monospace">CP{p.i + 1}</text>
          </g>
        ))}
        <text x={padL} y={11} fontSize="8.5" fill="#555" fontFamily="monospace">Pressure ({pu})</text>
        <text x={W - padR} y={H - 4} textAnchor="end" fontSize="8.5" fill="#555" fontFamily="monospace">Time / Checkpoint →</text>
      </svg>
      <div className="ps-chart-note">
        Note: The graph plots the test pressure recorded at each checkpoint / time. The pressure is held and
        monitored at every interval to confirm there is no pressure drop that would indicate leakage. Pressure unit: {pu}.
      </div>
    </td></tr></tbody></table>
  )
}

// Key-metrics strip shown above the chart on the attachment page
function ChartSummary({ schema, report, job }) {
  const r = buildResume(schema, report, job)
  const stats = r.stats || []
  if (!stats.length) return null
  const rows = []
  for (let i = 0; i < stats.length; i += 3) rows.push(stats.slice(i, i + 3))
  return (
    <table className="ps-stats"><tbody>
      {rows.map((grp, ri) => (
        <tr key={ri}>
          {grp.map((s, ci) => (
            <td key={ci} className="ps-stat"><span className="ps-stat-l">{s.label}</span><span className="ps-stat-v">{s.value}</span></td>
          ))}
          {grp.length < 3 && Array.from({ length: 3 - grp.length }).map((_, k) => <td key={`e${k}`} className="ps-stat" />)}
        </tr>
      ))}
    </tbody></table>
  )
}

// Auto-written observations under the chart so the page reads as a real analysis
function Observations({ report }) {
  const rows = report.readings || []
  const v = report.values || {}
  const pu = v.pressureUnit || 'PsiG'
  if (rows.length < 1) return null
  const ps = rows.map((r) => parseFloat(r.pg1)).filter((n) => !isNaN(n))
  const peak = ps.length ? Math.max(...ps) : 0
  const peakIdx = rows.findIndex((r) => parseFloat(r.pg1) === peak)
  const totalMin = rows.length > 1 ? MR.minutesBetween(rows[0].time, rows[rows.length - 1].time) : 0
  const startP = ps[0], endP = ps[ps.length - 1]
  const drop = (startP != null && endP != null) ? +(startP - endP).toFixed(1) : null
  const obs = []
  obs.push(`The test was executed across ${rows.length} checkpoint${rows.length === 1 ? '' : 's'}${totalMin ? ` over a holding period of ${totalMin} minute${totalMin === 1 ? '' : 's'}` : ''}.`)
  if (peak) obs.push(`Peak pressure recorded: ${peak} ${pu}${peakIdx >= 0 ? ` at checkpoint CP${peakIdx + 1}` : ''}.`)
  if (drop != null) obs.push(drop <= 0
    ? `No pressure drop was observed during the holding period (start ${startP} → end ${endP} ${pu}); the system held pressure and showed no sign of leakage.`
    : `A pressure change of ${drop} ${pu} was observed over the holding period (start ${startP} → end ${endP} ${pu}).`)
  obs.push(`Test medium: ${v.testMedia || '—'}. Specified test pressure: ${v.testPressure ? `${v.testPressure} ${pu}` : '—'}.`)
  return (
    <div className="ps-keep ps-mt-3">
      <div className="ps-obs-title">Observations</div>
      <ul className="ps-obs">{obs.map((o, i) => <li key={i}>{o}</li>)}</ul>
    </div>
  )
}

function ResultsTable({ sec, report, from = 0, to }) {
  const all = report.results || []
  const rows = all.slice(from, to ?? all.length)
  const v = report.values || {}
  const cols = sec.columns.filter((c) => showField(c, v))
  return (
    <table className="ps-grid"><thead><tr>
      <th style={{ width: '8mm' }}>No</th>
      {cols.map((c) => <th key={c.id}>{c.label}{c.unit ? ` (${c.unit})` : ''}</th>)}
      {sec.autoJudge === 'dim' && <><th>Dev</th><th>Status</th></>}
    </tr></thead><tbody>
      {rows.map((row, i) => {
        const judged = sec.autoJudge === 'dim' ? dimRowStatus(row) : row[sec.judgeKey]
        return (
          <tr key={i}>
            <td>{from + i + 1}</td>
            {cols.map((c) => {
              const val = row[c.id] || (c.rejOnly && judged !== sec.rejValue ? '—' : (row[c.id] || '—'))
              const cls = val === sec.rejValue || val === 'Reject' || val === 'NG' || val === 'Rej' ? 'ps-result-rej' : (val === sec.accValue || val === 'Accept' || val === 'OK' || val === 'Acc') ? 'ps-result-acc' : ''
              return <td key={c.id} className={`${cls} ${c.id === 'partId' || c.id === 'description' || c.id === 'point' || c.id === 'remark' ? 'ps-left' : ''}`}>{val}</td>
            })}
            {sec.autoJudge === 'dim' && <><td>{dimDeviation(row) || '—'}</td><td className={judged === 'Reject' ? 'ps-result-rej' : 'ps-result-acc'}>{judged || '—'}</td></>}
          </tr>
        )
      })}
      {!all.length && <tr><td colSpan={cols.length + 1} className="ps-na">No rows recorded</td></tr>}
    </tbody></table>
  )
}

function DftTable({ report }) {
  const coats = report.coats || []
  return (
    <table className="ps-grid"><thead><tr>
      <th>Coat</th><th className="ps-left">Identification Area</th><th>Pts (µm)</th><th>Avg</th><th>Std</th><th>Status</th>
    </tr></thead><tbody>
      {coats.map((c, i) => {
        const avg = MR.dftAvg(c.pts), std = parseFloat(c.std)
        const status = avg == null || isNaN(std) ? '—' : avg >= std ? 'ACC.' : 'REJ.'
        return <tr key={i}><td>{c.coat}</td><td className="ps-left">{c.area || '—'}</td><td>{(c.pts || []).filter(Boolean).join(', ') || '—'}</td><td>{avg ?? '—'}</td><td>{c.std || '—'}</td><td className={status === 'REJ.' ? 'ps-result-rej' : 'ps-result-acc'}>{status}</td></tr>
      })}
      {!coats.length && <tr><td colSpan={6} className="ps-na">No coats recorded</td></tr>}
    </tbody></table>
  )
}

/* One page, for a report that has always been one page of facts.

   The MT report printed across four sheets: a two-column label/value
   block for every field, then the result table, then the photographs,
   then a Statement of Result that repeated the customer, the product,
   the serial number and the job — all of them already printed 200mm
   further up the same document.

   This is the same content on one sheet, and nothing was dropped to get
   it there. What changed is how it is packed:

   - the identity is one strip of six cells rather than six rows;
   - related facts share a line — a particle is its type, how it was
     applied and the batch it came from, which is one sentence about one
     consumable rather than three rows;
   - the dates lost their weekday, which no data book indexes on;
   - the statement lost its own sheet and its repeated identity block,
     because it now sits under the table it refers to.

   Padding drops from 4.5/7pt to 3/5pt everywhere except the result rows
   and the signature block, which keep the room they need to be read and
   signed. Type size is untouched. */

// A label and its value, side by side, as one cell of a strip.
const Cell = ({ label, children, span }) => (
  <td colSpan={span}>
    <span className="ps-c-label">{label}</span>
    <span className="ps-c-value">{children || '—'}</span>
  </td>
)

// The facts that belong to one thing, joined into one line.
const joined = (...parts) => parts.filter((x) => x && String(x).trim() && String(x) !== '—').join(' · ') || '—'

function NdeCompactPage({ schema, report, job, v, approvalSec, chunk, noStatement }) {
  const rows = report.results || []
  const rej = rows.filter((r) => ['Reject', 'Rej', 'NG'].includes(r.judgement)).length
  const acc = rows.length - rej
  const r = buildResume(schema, report, job)
  const genFields = schema.sections.find((s) => s.id === 'general')?.fields || []
  const accFld = genFields.find((f) => f.id === 'acceptance')
  const acceptance = accFld?.compute ? accFld.compute(v) : (v.acceptance || '—')
  /* Procedure is a readonly field, so it is never typed and never
     stored — its value lives on the schema as that field's default. */
  const procedure = v.procedure || genFields.find((f) => f.id === 'procedure')?.default
  const resultsSec = schema.sections.find((s) => s.type === 'results')

  return (
    <div className="ps-compact">
      {/* identity — one strip, six cells */}
      <table className="ps-strip"><tbody>
        <tr>
          <Cell label="Customer">{v.customer || job?.customerName}</Cell>
          <Cell label="Job No.">{job?.jobNo || v.jobNo}</Cell>
          <Cell label="Unit / S.N.">{v.unit || job?.unitNo || v.sn || job?.arasSN}</Cell>
        </tr>
        <tr>
          <Cell label="Product">{job?.productDesc || v.jobDesc}</Cell>
          <Cell label="WBS / PO">{joined(v.wbsNo || job?.wbsNo, v.poNo || job?.poNo)}</Cell>
          <Cell label="Inspection date">{fmtShort(v.inspDate)}</Cell>
        </tr>
      </tbody></table>

      {/* What it was judged against, before it was judged. A reader
          works down the sheet in the order the inspection happened: the
          rule, the method, the readings, and only then the verdict. */}
      <table className="ps-strip"><tbody>
        <tr>
          <Cell label="Applicable code">{v.code}</Cell>
          <Cell label="Acceptance criteria">{acceptance}</Cell>
          <Cell label="Procedure">{procedure}</Cell>
        </tr>
      </tbody></table>

      {/* method and equipment — every fact, six to a row */}
      <div className="ps-blk-head ps-blk-head-tight">Method &amp; Equipment</div>
      <table className="ps-strip"><tbody>
        <tr>
          <Cell label="Equipment">{joined(v.mtEquipment, v.equipId && `ID ${v.equipId}`)}</Cell>
          <Cell label="Current">{v.currentType}</Cell>
          <Cell label="Technique">{v.method}</Cell>
        </tr>
        <tr>
          <Cell label="Lighting" span={2}>
            {joined(v.lightEquip, v.lightIntensity && `${v.lightIntensity} lux`, v.lightmeter && `Meter ${v.lightmeter}`)}
          </Cell>
          <Cell label="Magnetizing">{v.magTechnique}</Cell>
        </tr>
        <tr>
          <Cell label="White contrast">{v.whiteContrast}</Cell>
          <Cell label="Cleaner">{v.cleanerBatch}</Cell>
          <Cell label="Particle">
            {joined(v.particle, v.particleApp, v.particleDesc && `Batch ${v.particleDesc}`)}
          </Cell>
        </tr>
        <tr>
          <Cell label="Surface prep.">{v.surfacePreparation}</Cell>
          <Cell label="Stage / process">{joined(v.stage, v.weldingProcess)}</Cell>
          <Cell label="Scope">{v.scope}</Cell>
        </tr>
      </tbody></table>

      {(v.ndeMapRef || v.ndeMapNote) && (
        <table className="ps-strip"><tbody><tr>
          <Cell label="NDE map" span={3}>{joined(v.ndeMapRef, v.ndeMapNote)}</Cell>
        </tr></tbody></table>
      )}

      <div className="ps-blk-head ps-blk-head-tight">{resultsSec?.title || 'Result Table'}</div>
      <ResultsTable sec={resultsSec} report={report} from={0} to={chunk} />

      {/* The verdict, under the readings it was reached from. It sat at
          the top, above the method and the table, which asked the reader
          to accept the answer before seeing any of the working. */}
      <table className="ps-verdict"><tbody><tr>
        <td className="ps-verdict-box">
          <div className="ps-c-label">Result</div>
          <div className={`ps-verdict-word ${r.released ? 'ps-result-acc' : 'ps-result-rej'}`}>
            {r.released ? 'ACCEPTED' : 'REJECTED'}
          </div>
        </td>
        <td className="ps-verdict-crit">
          <table className="ps-strip ps-strip-tight"><tbody>
            <tr>
              <Cell label="Inspected">{rows.length}</Cell>
              <Cell label="Accepted">{acc}</Cell>
              <Cell label="Rejected">{rej}</Cell>
              <Cell label="NCR ref.">{v.ncrRef || 'None'}</Cell>
            </tr>
          </tbody></table>
        </td>
      </tr></tbody></table>

      {/* The statement, where the table it refers to can still be seen —
          unless the data book binding this report carries one statement
          for the whole unit, in which case saying it again here is the
          same declaration made twice about the same object. */}
      {!noStatement && (
      <div className="ps-statement">
        <span className="ps-c-label">Statement of result</span>
        <p>
          Based on the results recorded above, the inspected object is declared{' '}
          <strong className={r.released ? 'ps-result-acc' : 'ps-result-rej'}>
            {r.released ? 'ACCEPTED' : 'REJECTED'}
          </strong>{' '}
          in accordance with {acceptance}. Issued by and on behalf of {COMPANY.legalName}.
        </p>
      </div>
      )}

      {approvalSec && <Signatures fields={approvalSec.fields} v={v} />}
    </div>
  )
}

/* ── the dimensional report ──────────────────────────────────────

   A dimensional report is a page of numbers against letters, and the
   letters are meaningless on their own. On the shop's own form the
   marked drawing is the top half of the sheet — every measurement
   balloon-ed where it was taken — and the numbers are read against it.
   This app printed the numbers and left the drawing in the Photo
   Evidence attachment three pages later, if it was attached at all, so
   "B · 1869 · 1867 · -2 · A" meant nothing to anybody who had not stood
   at the unit.

   So: the map first, at the size it has to be read at, then the
   readings under it — two columns of six, the way the form does it,
   because twelve dimensions down one column is a page of white space
   beside a page of numbers. */

// The deviation as an inspector writes it: +3, -2, 0 — never "3.00".
const signedDev = (row) => {
  const d = dimDeviation(row)
  if (d === '') return '—'
  const n = +d
  return n > 0 ? `+${n}` : String(n)
}

/* What the measurement was judged against, under the nominal it is
   judged around. A symmetric band prints as ±3, because that is what the
   drawing says; anything else prints as the two limits themselves. */
const specBand = (row) => {
  const { lo, hi } = dimLimits(row)
  if (lo == null && hi == null) return null
  const n = parseFloat(row.nominal)
  if (lo != null && hi != null && !isNaN(n) && Math.abs((n - lo) - (hi - n)) < 1e-9) return `±${+(hi - n)}`
  return `${lo ?? '—'} – ${hi ?? '—'}`
}

const DimCells = ({ row, no }) => {
  if (!row) return <><td className="ps-dim-pad" colSpan={6} /></>
  const st = dimRowStatus(row)
  const band = specBand(row)
  return (
    <>
      <td className="ps-dim-id">
        <strong>{row.itemNo || no}</strong>
        {row.description ? <small>{row.description}</small> : null}
      </td>
      <td>
        {row.nominal || '—'}
        {band ? <small>{band}</small> : null}
      </td>
      <td className="ps-dim-act">{row.actual || '—'}</td>
      <td>{signedDev(row)}</td>
      <td className={st === 'Reject' ? 'ps-result-rej' : st === 'Accept' ? 'ps-result-acc' : ''}>
        {st === 'Reject' ? 'R' : st === 'Accept' ? 'A' : '—'}
      </td>
      <td className="ps-left ps-dim-note">{row.note || ''}</td>
    </>
  )
}

const DimHead = () => (
  <>
    <th className="ps-dim-id">Dim</th>
    <th className="ps-dim-w-spec">Spec<small>(mm)</small></th>
    <th className="ps-dim-w-act">Actual<small>(mm)</small></th>
    <th className="ps-dim-w-dev">Dev<small>(mm)</small></th>
    <th className="ps-dim-w-ar">A/R*</th>
    <th className="ps-left">Note</th>
  </>
)

/* Two columns of readings, filled down the left before the right, the
   way the form is read and the way a second sheet continues. */
function DimGrid({ rows }) {
  if (!rows.length) return <table className="ps-grid"><tbody><tr><td className="ps-na">No measurements recorded</td></tr></tbody></table>
  const half = Math.ceil(rows.length / 2)
  const left = rows.slice(0, half)
  const right = rows.slice(half)
  return (
    <>
      <table className="ps-grid ps-dim-grid"><thead><tr>
        <DimHead /><th className="ps-dim-split" /><DimHead />
      </tr></thead><tbody>
        {left.map((row, i) => (
          <tr key={i}>
            <DimCells row={row} no={i + 1} />
            <td className="ps-dim-split" />
            <DimCells row={right[i]} no={half + i + 1} />
          </tr>
        ))}
      </tbody></table>
      <div className="ps-dim-key">A/R* = Accept / Reject · Dev = actual less nominal</div>
    </>
  )
}

/* The map itself. Whatever the inspector attached to the point-map
   field, at the size the balloons can be read at — one across the sheet,
   two side by side if there are two views. */
function PointMap({ shots, view, drawingNo }) {
  const list = (Array.isArray(shots) ? shots : []).filter((p) => p && p.img).slice(0, 2)
  if (!list.length) {
    return (
      <div className="ps-dim-nomap">
        No measurement point map attached. Refer to drawing {drawingNo || '—'} for the location of each dimension.
      </div>
    )
  }
  return (
    <div className="ps-dim-map">
      {view ? <div className="ps-dim-view">{view}</div> : null}
      <table className="ps-dim-maps"><tbody><tr>
        {list.map((p, i) => (
          <td key={i} style={{ width: `${100 / list.length}%` }}>
            <img className={`ps-dim-img${list.length > 1 ? ' is-half' : ''}`} src={p.img} alt="" />
            {p.label ? <div className="ps-photo-cap">{p.label}</div> : null}
          </td>
        ))}
      </tr></tbody></table>
    </div>
  )
}

function DimCompactPage({ schema, report, job, v, approvalSec, chunk, noStatement }) {
  const all = report.results || []
  const rows = all.slice(0, chunk)
  const rej = all.filter((x) => dimRowStatus(x) === 'Reject').length
  const acc = all.length - rej
  const r = buildResume(schema, report, job)

  return (
    <div className="ps-compact">
      {/* identity — the shop's own kop, three lines of three */}
      <table className="ps-strip"><tbody>
        <tr>
          <Cell label="Customer">{v.customer || job?.customerName}</Cell>
          <Cell label="Job No.">{job?.jobNo || v.jobNo}</Cell>
          <Cell label="Unit / S.N.">{v.unit || job?.unitNo || v.sn || job?.arasSN}</Cell>
        </tr>
        <tr>
          <Cell label="Product">{job?.productDesc || v.jobDesc}</Cell>
          <Cell label="WBS / PO">{joined(v.wbsNo || job?.wbsNo, v.poNo || job?.poNo)}</Cell>
          <Cell label="Inspection date">{fmtShort(v.inspDate)}</Cell>
        </tr>
        <tr>
          <Cell label="Drawing No. / Rev">{v.drawingNo}</Cell>
          <Cell label="Inspection stage">{v.inspStage}</Cell>
          <Cell label="Tag number">{v.tagNumber}</Cell>
        </tr>
      </tbody></table>

      {/* the map, then what was measured on it */}
      <PointMap shots={v.drawingFile} view={v.viewName} drawingNo={v.drawingNo} />

      <div className="ps-blk-head ps-blk-head-tight">Measurements</div>
      <DimGrid rows={rows} />

      <table className="ps-verdict"><tbody><tr>
        <td className="ps-verdict-box">
          <div className="ps-c-label">Result</div>
          <div className={`ps-verdict-word ${r.released ? 'ps-result-acc' : 'ps-result-rej'}`}>
            {r.released ? 'ACCEPTED' : 'REJECTED'}
          </div>
        </td>
        <td className="ps-verdict-crit">
          <table className="ps-strip ps-strip-tight"><tbody>
            <tr>
              <Cell label="Measured">{all.length}</Cell>
              <Cell label="Accepted">{acc}</Cell>
              <Cell label="Rejected">{rej}</Cell>
              <Cell label="NCR ref.">{v.ncrRef || 'None'}</Cell>
            </tr>
          </tbody></table>
        </td>
      </tr></tbody></table>

      {!noStatement && (
        <div className="ps-statement">
          <span className="ps-c-label">Statement of result</span>
          <p>
            Based on the measurements recorded above, taken at the points marked on{' '}
            {v.drawingNo || 'the referenced drawing'}, the inspected object is declared{' '}
            <strong className={r.released ? 'ps-result-acc' : 'ps-result-rej'}>
              {r.released ? 'ACCEPTED' : 'REJECTED'}
            </strong>{' '}
            against the dimensions and tolerances stated. Issued by and on behalf of {COMPANY.legalName}.
          </p>
        </div>
      )}

      {v.ncr ? (
        <div className="ps-statement">
          <span className="ps-c-label">Non-conformance</span>
          <p>{v.ncr}</p>
        </div>
      ) : null}

      {approvalSec && <Signatures fields={approvalSec.fields} v={v} />}
    </div>
  )
}

function Signatures({ fields, v }) {
  const vis = fields.filter((f) => showField(f, v))
  return (
    <table className="ps-sign-table"><tbody>
      <tr className="ps-sign-head">{vis.map((f) => <td key={f.id}>{f.label}</td>)}</tr>
      <tr>{vis.map((f) => {
        // The pad stores { name, at, img }; older fixtures stored the image
        // on its own. Either way, no image means nobody signed — the block
        // then leaves the space clear for a wet signature and records the
        // name under the rule. It used to set the typed name in a script
        // face there, which reads as a signature and is not one.
        const s = v[f.id]
        const img = typeof s === 'string' ? s : s?.img
        const who = typeof s === 'string' ? '' : s?.name
        const at = typeof s === 'string' ? '' : s?.at
        return <td key={f.id}>
          {img ? <img className="ps-sign-img" src={img} alt="" /> : <div style={{ height: '14mm' }} />}
          {/* "Name / Signature" and "Date:" are prompts for whoever signs
              the printed page by hand. Under a mark that is already
              there they are wrong, so they only appear when the block is
              still waiting for a signature. The rule stays either way. */}
          <div className="ps-sign-name">{who || (img ? '' : 'Name / Signature')}</div>
          <div className="ps-sign-date">{at ? fmtLong(at) : (img ? '' : 'Date:')}</div>
        </td>
      })}</tr>
    </tbody></table>
  )
}

/* Which pages one report prints on.

   The layout decides this — results and approval, then attachments if
   there are any, then the statement — so the data book has to ask the
   layout rather than guess, or its contents page would point at the
   wrong sheets. */
/* A result table can be longer than the paper. Scaling a sixty-row
   dimensional report down to fit would make it unreadable, and letting it
   flow makes the page count something we can only estimate — so it is
   split across sheets instead, the way a printed data book continues a
   table: the same head, "continued", and the row numbering carrying on.

   The first sheet shares its page with the identity block and the rest of
   the form, so it takes fewer rows than the ones after it. These are
   deliberately shy of what fits; the zoom-to-fit pass absorbs the
   difference when a row wraps to two lines. */
const ROWS_FIRST = 14
const ROWS_MORE = 26

/* The forms that print as one page, and how each of them does it.

   MT was the trial: the compact page carries the identity, the verdict,
   the criteria, the method, the map reference, the table and the
   statement on one sheet, so it has room for fewer table rows than the
   old spread-out first page did — anything past that continues on a
   second sheet exactly as before.

   The dimensional report is the second, and it is laid out differently
   because it is a different document: its top half is the marked
   drawing and its bottom half is two columns of readings, so twice as
   many rows fit as would down a single column. */
const ONE_PAGE = { mt: NdeCompactPage, dimensional: DimCompactPage }
const isCompact = (schema) => !!ONE_PAGE[schema.key]
const COMPACT_ROWS = { mt: 8, dimensional: 22 }

function resultChunks(schema, report, rowFit = 1) {
  const sec = schema.sections.find((s) => s.type === 'results' && !s.noPrint)
  const n = sec ? (report.results || []).length : 0
  // A row is as tall as its longest cell wraps, which differs by form, so
  // these are a starting guess that the measured fit corrects.
  const first = Math.max(4, Math.round((COMPACT_ROWS[schema.key] ?? ROWS_FIRST) * rowFit))
  const more = Math.max(4, Math.round(ROWS_MORE * rowFit))
  if (!sec || n <= first) return [[0, n]]
  const out = [[0, first]]
  for (let at = first; at < n; at += more) out.push([at, Math.min(at + more, n)])
  return out
}

function sheetPlan(schema, report, rowFit) {
  const bodySecs = schema.sections.filter((s) => s.id !== 'header' && s.id !== 'approvals' && !s.noPrint && s.id !== 'setup')
  // documentation / photos belong with the attachments, not the data
  const photoSecs = bodySecs.filter((s) => s.type === 'photos')
  const mainSecs = bodySecs.filter((s) => s.type !== 'photos')
  const hasChart = schema.key === 'hydrotest' && (report.readings || []).length >= 2
  const chunks = resultChunks(schema, report, rowFit)
  return { photoSecs, mainSecs, hasChart, hasAttach: hasChart || photoSecs.length > 0, chunks }
}

export function reportSheetCount(schema, report, rowFit, noStatement) {
  const { hasAttach, chunks } = sheetPlan(schema, report, rowFit)
  /* form + continuation sheets + attachments + statement. A compact
     report carries its statement on the form sheet, so it has no last
     page of its own — and a report bound into a book that makes one
     statement for the whole unit has none at all. */
  const statement = noStatement || isCompact(schema) || schema.kind === 'record' ? 0 : 1
  return 1 + (chunks.length - 1) + (hasAttach ? 1 : 0) + statement
}

export default function PrintReport({ schema, report, job, deliverable, status, onClose }) {
  const wrap = useRef(null)
  const [fit, setFit] = useState(null)
  const [rowFit, setRowFit] = useState(1)
  useEffect(() => {
    document.body.classList.add('printing')
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => { document.body.classList.remove('printing'); window.removeEventListener('keydown', onKey) }
  }, [onClose])
  /* Number the pages from what the paper did, not from a guess — and if a
     sheet would not fit even reduced, put fewer rows on it and let the
     next pass confirm. */
  useFitToPage(wrap, [report.id, report.reportId, rowFit], (f) => {
    setFit((p) => (sameFit(p, f) ? p : f))
    setRowFit((r) => tighten(r, f))
  })
  useSheetZoom(wrap)
  const sheets = reportSheetCount(schema, report, rowFit)
  const { spans, total } = pageSpans(fit && fit.length === sheets ? fit : oneEach(sheets))

  return (
    <div className="print-overlay" ref={wrap}>
      <div className="print-toolbar">
        <button className="btn btn-primary" onClick={() => window.print()}><IconPrint size={15} /> Print / Save as PDF</button>
        <button className="btn btn-secondary" onClick={onClose}>Close preview</button>
      </div>
      {/* The page keeps its 210mm; this wrapper is what shrinks. */}
      <div className="print-scaler">
        <ReportSheets schema={schema} report={report} job={job} deliverable={deliverable} status={status}
          pageMap={spans} pageTotal={total} rowFit={rowFit} />
      </div>
    </div>
  )
}

/* Every printed page of one report.

   Standing on its own — rather than inside the preview overlay — is what
   lets the data book bind these same pages behind its cover and contents,
   numbered as part of the book instead of as a loose document. */
export function ReportSheets({ schema, report, job, deliverable, status, pageMap, pageTotal, sectionNo, breakFirst, rowFit, noStatement }) {
  // pressureUnit may not be persisted if left at its default — fall back so units always print
  const v = schema.key === 'hydrotest' ? { pressureUnit: 'PsiG', ...(report.values || {}) } : (report.values || {})
  const isDraft = status !== 'submitted' && status !== 'approved'
  const headerSec = schema.sections.find((s) => s.id === 'header')
  const approvalSec = schema.sections.find((s) => s.id === 'approvals')
  const { photoSecs, mainSecs, hasChart, hasAttach, chunks } = sheetPlan(schema, report, rowFit)
  // General block drops Report ID (already in the kop) and Inspector (covered by the signature)
  const generalFields = (headerSec?.fields || []).filter((f) => f.id !== 'reportId' && f.id !== 'inspector')

  // kop reused on every sheet/page
  const kop = (
    <thead><tr><td className="ps-runcell">
      <table className="ps-header"><tbody><tr>
        <td className="ps-logo-cell"><span className="ps-logo">{COMPANY.short}</span></td>
        <td className="ps-company">
          <div className="ps-co-name">{COMPANY.legalName.toUpperCase()}</div>
          <div className="ps-co-sub">QA / QC Department — Inspection &amp; Test Record</div>
          <div className="ps-doc-title">{schema.title}</div>
        </td>
        <td className="ps-meta-cell"><table><tbody>
          <tr><td className="ps-meta-label">Report No.</td><td>{v.reportId || '—'}</td></tr>
          <tr><td className="ps-meta-label">Form</td><td>{schema.formNo || '—'}</td></tr>
          <tr><td className="ps-meta-label">Status</td><td style={{ fontWeight: 700 }}>{status === 'approved' ? 'APPROVED' : status === 'submitted' ? 'FINAL' : 'DRAFT'}</td></tr>
        </tbody></table></td>
      </tr></tbody></table>
    </td></tr></thead>
  )
  /* Every page says which page it is and of how many — on its own that
     is the report's own count, and inside the data book it is the
     book's, which is what the contents page points at.

     The footer sits in a <tfoot>, so a sheet the printer had to break
     repeats it on both halves. Such a sheet states its span rather than
     a single number, which is true on either page. */
  const foot = (i) => {
    const [from, to] = pageMap?.[i] || [i + 1, i + 1]
    return (
      <tfoot><tr><td className="ps-runcell">
        <div className="ps-footer">
          <span>{schema.formNo} — Generated by QC Inspection Monitor</span>
          <span>
            Job {job?.jobNo} · {v.reportId} · Page {from === to ? from : `${from}–${to}`} of {pageTotal}
          </span>
        </div>
      </td></tr></tfoot>
    )
  }
  // shown on continuation pages so they read as one continuous, genuine document
  const contNote = (
    <div className="ps-cont-note">
      Continuation of Inspection Report No. <strong>{v.reportId || '—'}</strong> · Job No. <strong>{job?.jobNo || '—'}</strong>. This page is a continuation of and forms an integral, inseparable part of the report on the preceding page(s).
    </div>
  )

  // ── the pages of this report, in the order they print ──
  const bodies = []

  // 1 — results, evidence blocks and the approval
  bodies.push(isCompact(schema) ? (
    <>
      {sectionNo != null && (
        <div className="ps-tab">
          <span className="ps-tab-no">Section {sectionNo}</span>
          <span className="ps-tab-title">{schema.title}</span>
        </div>
      )}
      {(() => {
        const Compact = ONE_PAGE[schema.key]
        return <Compact schema={schema} report={report} job={job} v={v}
          approvalSec={approvalSec} chunk={chunks[0][1]} noStatement={noStatement} />
      })()}
    </>
  ) : (
    <>
      {sectionNo != null && (
        <div className="ps-tab">
          <span className="ps-tab-no">Section {sectionNo}</span>
          <span className="ps-tab-title">{schema.title}</span>
        </div>
      )}
      <div className="ps-blk ps-keep">
        {headerSec && <Pairs fields={generalFields} v={v} report={report} />}
      </div>

      {mainSecs.map((sec) => {
        const isTable = sec.type === 'recording' || sec.type === 'results' || sec.type === 'dft'
        return (
          <div key={sec.id} className="ps-blk ps-keep">
            {isTable && <div className="ps-blk-head">{sec.title}</div>}
            {sec.type === 'recording' ? <RecordingTable report={report} />
              : sec.type === 'results' ? <ResultsTable sec={sec} report={report} from={0} to={chunks[0][1]} />
                : sec.type === 'dft' ? <DftTable report={report} />
                  : <Pairs fields={sec.id === 'general' ? sec.fields.filter((f) => f.id !== 'testDesc') : sec.fields} v={v} report={report} />}
          </div>
        )
      })}

      {approvalSec && (
        <div className="ps-blk ps-keep">
          <Signatures fields={approvalSec.fields} v={v} />
        </div>
      )}
    </>
  ))

  // 1b — the rest of a result table that did not fit on the form sheet
  const resultsSec = mainSecs.find((sec) => sec.type === 'results')
  chunks.slice(1).forEach(([from, to]) => bodies.push(
    <>
      {contNote}
      <div className="ps-blk ps-keep">
        <div className="ps-blk-head">{resultsSec.title} <em>(continued — rows {from + 1}–{to})</em></div>
        <ResultsTable sec={resultsSec} report={report} from={from} to={to} />
      </div>
    </>
  ))

  // 2 — attachments: the pressure chart and the photographic evidence
  if (hasAttach) bodies.push(
    <>
      {contNote}
      {hasChart && (
        <div className="ps-mt-3">
          <div className="ps-attach-cap">Attachment 1 — Test Pressure Analysis</div>
          <ChartSummary schema={schema} report={report} job={job} />
          <div className="ps-keep"><PressureChart report={report} /></div>
          <Observations report={report} />
        </div>
      )}
      {photoSecs.map((sec, i) => (
        <div key={sec.id} className="ps-mt-3 ps-keep">
          <div className="ps-attach-cap">Attachment {(hasChart ? 2 : 1) + i} — {sec.title || 'Documentation'}</div>
          <PhotoList photos={report.photos} />
        </div>
      ))}
    </>
  )

  /* 3 — the formal statement of result, on its own sheet.

     Not for a document record: that sheet declares that this shop
     carried out the inspection and hereby accepts the object. For a
     filed ITP or release note neither half is true, and a data book is
     the last place to print a statement nobody made. The record's own
     pages are the statement. */
  if (!noStatement && schema.kind !== 'record' && !isCompact(schema)) bodies.push(
    <>
      {contNote}
      {(() => {
        const r = buildResume(schema, report, job)
        return (
          <div className="ps-sec-body ps-letter">
            <div className="ps-letter-title">Statement of {schema.title} Result</div>
            <div className="ps-letter-meta">Report No. {v.reportId || '—'}</div>
            <p>On this day, {fmtFull(v.inspDate)}, the {schema.title} was carried out on the product identified as follows:</p>
            <table className="ps-letter-id"><tbody>
              <tr><td>Job No.</td><td>: {job?.jobNo || '—'}{job?.wbsNo ? `  (WBS ${job.wbsNo})` : ''}</td></tr>
              <tr><td>Product</td><td>: {job?.productDesc || v.jobDesc || '—'}</td></tr>
              <tr><td>Serial No.</td><td>: {v.sn || job?.arasSN || '—'}</td></tr>
              <tr><td>Customer</td><td>: {v.customer || job?.customerName || '—'}</td></tr>
              <tr><td>Inspection</td><td>: {schema.title}{deliverable ? ` — ${deliverable}` : ''}</td></tr>
            </tbody></table>
            <p>{r.paragraph}</p>
            <p>Based on the inspection results above, the object is hereby declared <strong className={r.released ? 'ps-result-acc' : 'ps-result-rej'}>{r.released ? 'ACCEPTED' : 'REJECTED'}</strong>.</p>
            <p className="ps-letter-close">This statement is issued by and on behalf of {COMPANY.legalName}, and is made truthfully to be used as required.</p>
            {approvalSec && <Signatures fields={approvalSec.fields} v={v} />}
          </div>
        )
      })()}
    </>
  )

  return bodies.map((bodyEl, i) => (
    <div key={i} className={`print-sheet${i > 0 || breakFirst ? ' ps-sheet-break' : ''}`}>
      {isDraft && <div className="ps-watermark" aria-hidden="true">DRAFT</div>}
      <table className="ps-doc">
        {kop}{foot(i)}
        <tbody><tr><td className="ps-runcell ps-body">{bodyEl}</td></tr></tbody>
      </table>
    </div>
  ))
}

function PhotoList({ photos }) {
  const ps = photos || []
  if (!ps.length) return <table><tbody><tr><td className="ps-na">No photos attached</td></tr></tbody></table>
  return (
    <table className="ps-photo-grid"><tbody>
      {Array.from({ length: Math.ceil(ps.length / 2) }).map((_, r) => (
        <tr key={r}>
          {[ps[r * 2], ps[r * 2 + 1]].map((p, c) => (
            <td key={c} style={{ width: '50%', textAlign: 'center', verticalAlign: 'top' }}>
              {p ? <>{p.img && <img className="ps-photo" src={p.img} alt="" />}<div className="ps-photo-cap">{p.label || ''}</div></> : null}
            </td>
          ))}
        </tr>
      ))}
    </tbody></table>
  )
}
