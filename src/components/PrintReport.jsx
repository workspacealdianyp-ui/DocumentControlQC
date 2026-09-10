import { Fragment, useEffect, useRef, useState } from 'react'
import { MR } from '../lib/compute.js'
import { dimRowStatus, dimDeviation, dimLimits } from '../data/formSchemas.js'
import { buildResume } from '../lib/resume.js'
import { useFitToPage, pageSpans, sameFit, oneEach, tighten, useSheetZoom } from '../lib/pagefit.js'
import { reportPlan, printValues, printValue, printDate, printStatus, resultColumnWidths, resultColumnLabel, recordingLayout } from '../lib/printLayout.js'
import { PrintHeader, PrintFooter, PrintToolbar } from './PrintDocument.jsx'

function FieldRows({ rows }) {
  return <table className="ps-facts"><colgroup>{[30, 65, 30, 65].map((width, i) => <col key={i} style={{ width: `${width}mm` }} />)}</colgroup><tbody>{rows.map((row, i) => <tr key={i}>{row.map((field, j) => <Fragment key={j}>
    <th scope="row" className="ps-fact-label">{field.label}</th><td colSpan={row.length === 1 ? 3 : 1} className="ps-c-value">{field.value}</td>
  </Fragment>)}</tr>)}</tbody></table>
}

function RecordingTable({ report, v, from, to }) {
  const all = report.readings || []
  const { columns, widths } = recordingLayout(v)
  return <table className="ps-grid ps-grid-rec"><colgroup>{widths.map((width, i) => <col key={i} style={{ width: `${width}mm` }} />)}</colgroup><thead><tr><th>CP</th><th>Time</th><th>Interval (min)</th>{columns.map(({ id, label }) => <th key={id}>{label}</th>)}<th className="ps-left">Remark</th></tr></thead>
    <tbody>{all.slice(from, to).map((row, i) => <tr key={from + i}><td>{from + i + 1}</td><td>{printValue(row.time)}</td><td>{from + i === 0 ? 0 : MR.minutesBetween(all[from + i - 1].time, row.time)}</td>{columns.map(({ id }) => <td key={id}>{printValue(row[id])}</td>)}<td className="ps-left">{printValue(row.remark)}</td></tr>)}
      {!all.length && <tr><td colSpan={columns.length + 4} className="ps-na">No checkpoints recorded</td></tr>}</tbody>
  </table>
}

function ResultsTable({ section, report, v, from, to }) {
  const all = report.results || []
  const rows = all.slice(from, to)
  if (section.autoJudge === 'dim') {
    const pairs = Array.from({ length: Math.ceil(rows.length / 2) }, (_, i) => rows.slice(i * 2, i * 2 + 2))
    const cells = (row, index) => {
      if (!row) return <td colSpan={4} className="ps-dim-empty" aria-hidden="true" />
      const limits = dimLimits(row), result = dimRowStatus(row)
      return <>
        <td className="ps-left"><strong>{printValue(row.itemNo || index + 1)}</strong><span className="ps-dim-description">{printValue(row.description)}</span>{row.note != null && row.note !== '' && <small className="ps-dim-note">Note: {printValue(row.note)}</small>}</td>
        <td>{printValue(row.nominal)}<small>Min {printValue(limits.lo)}<br />Max {printValue(limits.hi)}</small></td>
        <td className="ps-measured">{printValue(row.actual)}<small>Δ {printValue(dimDeviation(row))}</small></td>
        <td className={result === 'Reject' ? 'ps-result-rej' : ''}>{result || 'Not judged'}</td>
      </>
    }
    const headings = <><th className="ps-left">Point / description</th><th>Nominal / limits</th><th>Actual / Δ</th><th>Result</th></>
    return <><div className="ps-dim-legend">All dimensions in mm · Δ = actual − nominal · Read left to right, then down</div><table className="ps-grid ps-dim-grid">
      <colgroup>{[31, 26, 17, 19, 4, 31, 26, 17, 19].map((width, i) => <col key={i} style={{ width: `${width}mm` }} />)}</colgroup>
      <thead><tr>{headings}<th className="ps-dim-gutter" aria-hidden="true" />{headings}</tr></thead>
      <tbody>{pairs.map((pair, i) => <tr key={from + i * 2}>{cells(pair[0], from + i * 2)}<td className="ps-dim-gutter" aria-hidden="true" />{cells(pair[1], from + i * 2 + 1)}</tr>)}
        {!all.length && <tr><td colSpan={9} className="ps-na">No measurements recorded</td></tr>}</tbody>
    </table></>
  }
  const columns = section.columns.filter((f) => !f.showIf || f.showIf(v))
  const widths = resultColumnWidths(columns)
  return <table className="ps-grid"><colgroup>{widths.map((width, i) => <col key={i} style={{ width: `${width}mm` }} />)}</colgroup>
    <thead><tr><th>No</th>{columns.map((c) => <th key={c.id}>{resultColumnLabel(c)}{c.unit ? ` (${c.unit})` : ''}</th>)}</tr></thead>
    <tbody>{rows.map((row, i) => <tr key={from + i}><td>{from + i + 1}</td>{columns.map((c) => <td key={c.id} className={`${/partId|point|description|remark|note|discontinuity/.test(c.id) ? 'ps-left' : ''} ${['Reject', 'Rej', 'NG'].includes(row[c.id]) ? 'ps-result-rej' : ''}`}>{printValue(row[c.id])}</td>)}</tr>)}
      {!all.length && <tr><td colSpan={columns.length + 1} className="ps-na">No inspection rows recorded</td></tr>}</tbody>
  </table>
}

function DftTable({ report, from, to }) {
  const all = report.coats || []
  return <table className="ps-grid"><thead><tr><th>Coat</th><th className="ps-left">Identification area</th><th>Readings (µm)</th><th>Average (µm)</th><th>Minimum (µm)</th><th>Result</th></tr></thead>
    <tbody>{all.slice(from, to).map((coat, i) => {
      const avg = MR.dftAvg(coat.pts), minimum = parseFloat(coat.std)
      const result = avg == null || Number.isNaN(minimum) ? 'Not judged' : avg >= minimum ? 'Accept' : 'Reject'
      return <tr key={from + i}><td>{printValue(coat.coat)}</td><td className="ps-left">{printValue(coat.area)}</td><td>{(coat.pts || []).filter((p) => p !== '' && p != null).join(', ') || '—'}</td><td>{printValue(avg)}</td><td>{printValue(coat.std)}</td><td className={result === 'Reject' ? 'ps-result-rej' : ''}>{result}</td></tr>
    })}{!all.length && <tr><td colSpan={6} className="ps-na">No coats recorded</td></tr>}</tbody>
  </table>
}

export function Signatures({ fields, v }) {
  const visible = fields.filter((f) => !f.showIf || f.showIf(v))
  return <table className="ps-sign-table"><tbody><tr className="ps-sign-head">{visible.map((f) => <td key={f.id}>{f.label}</td>)}</tr>
    <tr>{visible.map((f) => {
      const sign = v[f.id], img = typeof sign === 'string' ? sign : sign?.img
      const name = typeof sign === 'string' ? '' : sign?.name
      const date = typeof sign === 'string' ? '' : sign?.at
      return <td key={f.id}><div className="ps-sign-space">{img && <img className="ps-sign-img" src={img} alt="Recorded signature" />}</div><div className="ps-sign-name">{name || (img ? '' : 'Name / signature')}</div><div className="ps-sign-date">{date ? printDate(date) : img ? '' : 'Date:'}</div></td>
    })}</tr></tbody></table>
}

function Evidence({ block }) {
  return <div className={`ps-evidence${block.full ? ' ps-evidence-full' : ''}${block.map ? ' ps-evidence-map' : ''}`}><table className="ps-photo-grid"><tbody><tr>{block.photos.map((photo, i) => <td key={i}>
    <div className="ps-photo-frame">{photo?.img ? <img className="ps-photo" src={photo.img} alt={photo.label || 'Recorded evidence'} /> : <p className="ps-na">Image unavailable</p>}</div>
    <div className="ps-photo-cap"><strong>{block.map ? 'Figure' : block.full ? 'Page' : 'Evidence'} {(block.from || 0) + i + 1}{block.total ? ` of ${block.total}` : ''}</strong>{photo?.label && <span>{photo.label}</span>}</div>
  </td>)}</tr></tbody></table></div>
}

export const reportSheetCount = (schema, report, rowFit = 1, job) => reportPlan(schema, report, job, { density: rowFit }).length

export default function PrintReport({ schema, report, job, deliverable, status, onClose }) {
  const wrap = useRef(null)
  const [fit, setFit] = useState(null)
  const [rowFit, setRowFit] = useState(1)
  useEffect(() => {
    document.body.classList.add('printing')
    const onKey = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => { document.body.classList.remove('printing'); window.removeEventListener('keydown', onKey) }
  }, [onClose])
  useFitToPage(wrap, [report.id, report.updatedAt, rowFit], (f) => { setFit((previous) => sameFit(previous, f) ? previous : f); setRowFit((previous) => tighten(previous, f)) })
  useSheetZoom(wrap)
  const sheets = reportSheetCount(schema, report, rowFit, job)
  const { spans, total } = pageSpans(fit?.length === sheets ? fit : oneEach(sheets))
  return <div className="print-overlay" ref={wrap}><PrintToolbar title={schema.title} pages={total} onClose={onClose} /><div className="print-scaler">
    <ReportSheets schema={schema} report={report} job={job} deliverable={deliverable} status={status} pageMap={spans} pageTotal={total} rowFit={rowFit} />
  </div></div>
}

export function ReportSheets({ schema, report, job, deliverable, status = report.status, pageMap, pageTotal, sectionNo, breakFirst, rowFit = 1 }) {
  const v = printValues(schema, report, job)
  const pages = reportPlan(schema, report, job, { density: rowFit })
  const number = report.reportId || v.reportId
  const watermark = status === 'approved' || status === 'submitted' ? null : printStatus(status)
  const title = schema.key === 'visual' && deliverable === 'PDI' ? 'Pre-Delivery Inspection Report' : schema.title
  return pages.map((blocks, i) => {
    const [from, to] = pageMap?.[i] || [i + 1, i + 1]
    return <div key={i} className={`print-sheet${i || breakFirst ? ' ps-sheet-break' : ''}`}>
      {watermark && <div className="ps-watermark" aria-hidden="true">{watermark}</div>}
      <table className="ps-doc"><PrintHeader title={title} number={number} compact={blocks[0]?.kind === 'evidence'} form={schema.formNo} revision={report.formRevision ?? schema.revision} from={from} to={to} total={pageTotal || pages.length} subtitle={schema.kind === 'record' ? 'Filed document record' : 'Inspection & test record'} metadata={[
        ['Form', schema.formNo], ['Job', v.jobNo], [schema.kind === 'record' ? 'Date filed' : 'Inspection date', printDate(v.inspDate)], ['Inspector', v.inspector]
      ]} /><PrintFooter number={number} form={schema.formNo} jobNo={v.jobNo} from={from} to={to} total={pageTotal || pages.length} />
        <tbody><tr><td className="ps-runcell ps-body">
          {i === 0 && sectionNo != null && <div className="ps-cont-note">MDR · Section {sectionNo}</div>}
          {i > 0 && <div className="ps-cont-note">{blocks[0]?.kind === 'evidence' || blocks[0]?.kind === 'chart' ? 'Supporting evidence' : 'Report continuation'} · {number}</div>}
          {blocks.map((block, k) => <section className={`ps-blk ps-${block.kind}`} key={k}>{block.title && <h2 className="ps-blk-head">{block.title}{block.from > 0 && ['results', 'recording', 'dft'].includes(block.kind) ? ` · continued from row ${block.from + 1}` : ''}</h2>}
            {block.kind === 'fields' ? <FieldRows rows={block.rows} />
              : block.kind === 'results' ? <ResultsTable section={block.section} report={report} v={v} from={block.from} to={block.to} />
                : block.kind === 'recording' ? <RecordingTable report={report} v={v} from={block.from} to={block.to} />
                  : block.kind === 'dft' ? <DftTable report={report} from={block.from} to={block.to} />
                    : block.kind === 'signatures' ? <Signatures fields={block.section.fields} v={v} />
                      : block.kind === 'verdict' ? <div className="ps-overall-result"><span>Overall result</span><strong>{block.text}</strong></div>
                        : block.kind === 'evidence' ? <Evidence block={block} />
                          : block.kind === 'chart' ? <><ChartSummary schema={schema} report={report} job={job} /><PressureChart report={report} /><Observations report={report} /></>
                            : <p className="ps-na">{block.text}</p>}
          </section>)}
        </td></tr></tbody>
      </table>
    </div>
  })
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
    ? `No pressure drop was observed during the holding period (start ${startP} → end ${endP} ${pu}); the end reading was not lower than the start reading. Refer to the recorded inspection result for the acceptance decision.`
    : `A pressure change of ${drop} ${pu} was observed over the holding period (start ${startP} → end ${endP} ${pu}).`)
  obs.push(`Test medium: ${v.testMedia || '—'}. Specified test pressure: ${v.testPressure ? `${v.testPressure} ${pu}` : '—'}.`)
  return (
    <div className="ps-keep ps-mt-3">
      <div className="ps-obs-title">Observations</div>
      <ul className="ps-obs">{obs.map((o, i) => <li key={i}>{o}</li>)}</ul>
    </div>
  )
}
