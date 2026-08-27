import { COMPANY } from '../lib/company.js'
import { useEffect } from 'react'
import { MR } from '../lib/compute.js'
import { dimRowStatus, dimDeviation } from '../data/formSchemas.js'
import { buildResume } from '../lib/resume.js'
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
  if (f.type === 'date') return f.id === 'inspDate' ? fmtFull(v[f.id] ?? f.default) : fmtLong(v[f.id] ?? f.default)
  const val = v[f.id] ?? f.default
  if (val === undefined || val === null || val === '') return '—'
  // unit comes either from a sibling value (unitFrom, e.g. pressureUnit) or a fixed f.unit
  const unit = f.unitFrom ? (v[f.unitFrom] || '') : (f.unit || '')
  return unit && (f.type === 'number' || f.type === 'text') ? `${val} ${unit}` : String(val)
}

// fields that only print when they actually carry a value
const EMPTYISH = new Set(['', '-', '–', '—', 'n/a', 'na'])
const HIDE_IF_BLANK = new Set(['designPressure', 'mawp', 'map'])
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

function ResultsTable({ sec, report }) {
  const rows = report.results || []
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
            <td>{i + 1}</td>
            {cols.map((c) => {
              const val = row[c.id] || (c.rejOnly && judged !== sec.rejValue ? '—' : (row[c.id] || '—'))
              const cls = val === sec.rejValue || val === 'Reject' || val === 'NG' || val === 'Rej' ? 'ps-result-rej' : (val === sec.accValue || val === 'Accept' || val === 'OK' || val === 'Acc') ? 'ps-result-acc' : ''
              return <td key={c.id} className={`${cls} ${c.id === 'partId' || c.id === 'description' || c.id === 'point' || c.id === 'remark' ? 'ps-left' : ''}`}>{val}</td>
            })}
            {sec.autoJudge === 'dim' && <><td>{dimDeviation(row) || '—'}</td><td className={judged === 'Reject' ? 'ps-result-rej' : 'ps-result-acc'}>{judged || '—'}</td></>}
          </tr>
        )
      })}
      {!rows.length && <tr><td colSpan={cols.length + 1} className="ps-na">No rows recorded</td></tr>}
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

function Signatures({ fields, v }) {
  const vis = fields.filter((f) => showField(f, v))
  return (
    <table className="ps-sign-table"><tbody>
      <tr className="ps-sign-head">{vis.map((f) => <td key={f.id}>{f.label}</td>)}</tr>
      <tr>{vis.map((f) => {
        const s = v[f.id]
        return <td key={f.id}>
          {s ? <>{s.img ? <img className="ps-sign-img" src={s.img} alt="" /> : <div className="ps-sign-script">{s.name}</div>}<div className="ps-sign-name">{s.name}</div><div className="ps-sign-date">{fmtLong(s.at)}</div></>
            : <><div style={{ height: '14mm' }} /><div className="ps-sign-name">Name / Signature</div><div className="ps-sign-date">Date:</div></>}
        </td>
      })}</tr>
    </tbody></table>
  )
}

export default function PrintReport({ schema, report, job, deliverable, status, onClose }) {
  useEffect(() => {
    document.body.classList.add('printing')
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => { document.body.classList.remove('printing'); window.removeEventListener('keydown', onKey) }
  }, [onClose])

  // pressureUnit may not be persisted if left at its default — fall back so units always print
  const v = schema.key === 'hydrotest' ? { pressureUnit: 'PsiG', ...(report.values || {}) } : (report.values || {})
  const isDraft = status !== 'submitted' && status !== 'approved'
  const headerSec = schema.sections.find((s) => s.id === 'header')
  const approvalSec = schema.sections.find((s) => s.id === 'approvals')
  // config/control sections (noPrint) and header/approvals are handled specially
  const bodySecs = schema.sections.filter((s) => s.id !== 'header' && s.id !== 'approvals' && !s.noPrint && s.id !== 'setup')
  // documentation / photos belong with the attachments (section 3), not the data (section 1)
  const photoSecs = bodySecs.filter((s) => s.type === 'photos')
  const mainSecs = bodySecs.filter((s) => s.type !== 'photos')
  const hasChart = schema.key === 'hydrotest' && (report.readings || []).length >= 2
  const hasAttach = hasChart || photoSecs.length > 0
  // General block drops Report ID (already in the kop) and Inspector (covered by the signature)
  const generalFields = (headerSec?.fields || []).filter((f) => f.id !== 'reportId' && f.id !== 'inspector')

  // kop + footer reused on every sheet/page
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
  const foot = (
    <tfoot><tr><td className="ps-runcell">
      <div className="ps-footer">
        <span>{schema.formNo} — Generated by QC Inspection Monitor</span>
        <span>Job {job?.jobNo} · {v.reportId}</span>
      </div>
    </td></tr></tfoot>
  )
  // shown on continuation pages so they read as one continuous, genuine document
  const contNote = (
    <div className="ps-cont-note">
      Continuation of Inspection Report No. <strong>{v.reportId || '—'}</strong> · Job No. <strong>{job?.jobNo || '—'}</strong>. This page is a continuation of and forms an integral, inseparable part of the report on the preceding page(s).
    </div>
  )

  return (
    <div className="print-overlay">
      <div className="print-toolbar">
        <button className="btn btn-primary" onClick={() => window.print()}><IconPrint size={15} /> Print / Save as PDF</button>
        <button className="btn btn-secondary" onClick={onClose}>Close preview</button>
      </div>

      {/* ══════════ PAGE 1 — Section 1: Test results & evidence + approval ══════════ */}
      <div className="print-sheet">
        {isDraft && <div className="ps-watermark" aria-hidden="true">DRAFT</div>}
        <table className="ps-doc">
          {kop}{foot}
          <tbody><tr><td className="ps-runcell ps-body">
            <div className="ps-blk ps-keep">
              {headerSec && <Pairs fields={[...generalFields, { id: '_wbs', label: 'WBS No.', type: 'text' }]} v={{ ...v, _wbs: job?.wbsNo }} report={report} />}
            </div>

            {mainSecs.map((s) => {
              const isTable = s.type === 'recording' || s.type === 'results' || s.type === 'dft'
              return (
                <div key={s.id} className="ps-blk ps-keep">
                  {isTable && <div className="ps-blk-head">{s.title}</div>}
                  {s.type === 'recording' ? <RecordingTable report={report} />
                    : s.type === 'results' ? <ResultsTable sec={s} report={report} />
                      : s.type === 'dft' ? <DftTable report={report} />
                        : <Pairs fields={s.id === 'general' ? s.fields.filter((f) => f.id !== 'testDesc') : s.fields} v={v} report={report} />}
                </div>
              )
            })}

            {approvalSec && (
              <div className="ps-blk ps-keep">
                <Signatures fields={approvalSec.fields} v={v} />
              </div>
            )}
          </td></tr></tbody>
        </table>
      </div>

      {/* ══════════ PAGE 2 — Section 2: Attachment (chart + documentation) ══════════ */}
      {hasAttach && (
        <div className="print-sheet ps-sheet-break">
          {isDraft && <div className="ps-watermark" aria-hidden="true">DRAFT</div>}
          <table className="ps-doc">
            {kop}{foot}
            <tbody><tr><td className="ps-runcell ps-body">
              {contNote}

              {hasChart && (
                <div className="ps-mt-3">
                  <div className="ps-attach-cap">Attachment 1 — Test Pressure Analysis</div>
                  <ChartSummary schema={schema} report={report} job={job} />
                  <div className="ps-keep"><PressureChart report={report} /></div>
                  <Observations report={report} />
                </div>
              )}

              {photoSecs.map((s, i) => (
                <div key={s.id} className="ps-mt-3 ps-keep">
                  <div className="ps-attach-cap">Attachment {(hasChart ? 2 : 1) + i} — {s.title || 'Documentation'}</div>
                  <PhotoList photos={report.photos} />
                </div>
              ))}
            </td></tr></tbody>
          </table>
        </div>
      )}

      {/* ══════════ PAGE 3 — Berita Acara (formal letter, own A4 page) ══════════ */}
      <div className="print-sheet ps-sheet-break">
        {isDraft && <div className="ps-watermark" aria-hidden="true">DRAFT</div>}
        <table className="ps-doc">
          {kop}{foot}
          <tbody><tr><td className="ps-runcell ps-body">
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
                  <p>Based on the inspection results above, the object is hereby declared <strong className={r.released ? 'ps-result-acc' : 'ps-result-rej'}>{r.released ? 'ACCEPTED' : 'REJECTED'}</strong> — {r.headline}.</p>
                  <p className="ps-letter-close">This statement is issued by and on behalf of {COMPANY.legalName}, and is made truthfully to be used as required.</p>
                  {approvalSec && <Signatures fields={approvalSec.fields} v={v} />}
                </div>
              )
            })()}
          </td></tr></tbody>
        </table>
      </div>
    </div>
  )
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
