import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { dimRowStatus, dimDeviation } from '../data/formSchemas.js'
import { MR } from '../lib/compute.js'
import { fmtDate } from '../lib/status.js'
import { buildResume } from '../lib/resume.js'
import { IconBack, IconPrint, IconPen, IconChevronR } from './Icons.jsx'

// read-only detail view of a submitted/approved report — shows the entered data, never edits
const lbl = (f, v) => (typeof f.label === 'function' ? f.label(v) : f.label)
const showField = (f, v) => (typeof f.showIf === 'function' ? f.showIf(v) : true)

const dval = (f, v, report) => {
  if (f.type === 'computed') return (f.compute ? f.compute(v, report) : '') || '—'
  if (f.type === 'sign') return v[f.id]?.name || '—'
  if (f.type === 'date') return fmtDate(v[f.id] ?? f.default)
  const val = v[f.id] ?? f.default
  if (val === undefined || val === null || val === '') return '—'
  const unit = f.unitFrom ? (v[f.unitFrom] || '') : (f.unit || '')
  return unit && (f.type === 'number' || f.type === 'text') ? `${val} ${unit}` : String(val)
}

function DetailPairs({ fields, v, report }) {
  const vis = fields.filter((f) => !['sign', 'photos', 'photos-inline', 'jobsearch'].includes(f.type) && showField(f, v))
  if (!vis.length) return null
  return (
    <div className="detail-grid">
      {vis.map((f) => (
        <div className="detail-item" key={f.id}>
          <span className="detail-label">{lbl(f, v)}</span>
          <span className="detail-value">{dval(f, v, report)}</span>
        </div>
      ))}
    </div>
  )
}

function DetailRecording({ report }) {
  const rows = report.readings || []
  const v = report.values || {}
  const twoG = v.gauges !== '1 Gauge', useRec = v.useRecorder !== 'Not used', useTemp = v.useTemp !== 'Not used'
  const pu = v.pressureUnit || 'PsiG'
  const cols = [['pg1', `${twoG ? 'PG 1' : 'PG'} (${pu})`]]
  if (twoG) cols.push(['pg2', `PG 2 (${pu})`])
  if (useRec) cols.push(['rec', `Rec. (${pu})`])
  if (useTemp) cols.push(['water', 'Water °C'], ['ambient', 'Amb °C'])
  return (
    <div className="detail-table-wrap">
      <table className="detail-table">
        <thead><tr><th>CP</th><th>Time</th>{cols.map(([k, l]) => <th key={k}>{l}</th>)}<th>Remark</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}><td>{i + 1}</td><td>{r.time || '—'}</td>{cols.map(([k]) => <td key={k}>{r[k] || '—'}</td>)}<td className="detail-left">{r.remark || '—'}</td></tr>
          ))}
          {!rows.length && <tr><td colSpan={cols.length + 3} className="detail-empty">No checkpoints recorded</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function DetailResults({ sec, report }) {
  const rows = report.results || []
  const v = report.values || {}
  const cols = sec.columns.filter((c) => showField(c, v))
  return (
    <div className="detail-table-wrap">
      <table className="detail-table">
        <thead><tr><th>No</th>{cols.map((c) => <th key={c.id}>{c.label}{c.unit ? ` (${c.unit})` : ''}</th>)}{sec.autoJudge === 'dim' && <><th>Dev</th><th>Status</th></>}</tr></thead>
        <tbody>
          {rows.map((row, i) => {
            const judged = sec.autoJudge === 'dim' ? dimRowStatus(row) : row[sec.judgeKey]
            const rej = judged === 'Reject' || judged === 'NG' || judged === 'Rej'
            return (
              <tr key={i}><td>{i + 1}</td>{cols.map((c) => <td key={c.id} className={c.id === 'partId' || c.id === 'description' || c.id === 'point' || c.id === 'remark' ? 'detail-left' : ''}>{row[c.id] || '—'}</td>)}{sec.autoJudge === 'dim' && <><td>{dimDeviation(row) || '—'}</td><td className={rej ? 'detail-rej' : 'detail-acc'}>{judged || '—'}</td></>}</tr>
            )
          })}
          {!rows.length && <tr><td colSpan={cols.length + 1} className="detail-empty">No rows recorded</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function DetailDft({ report }) {
  const coats = report.coats || []
  return (
    <div className="detail-table-wrap">
      <table className="detail-table">
        <thead><tr><th>Coat</th><th className="detail-left">Identification Area</th><th>Pts (µm)</th><th>Avg</th><th>Std</th><th>Status</th></tr></thead>
        <tbody>
          {coats.map((c, i) => {
            const avg = MR.dftAvg(c.pts), std = parseFloat(c.std)
            const st = avg == null || isNaN(std) ? '—' : avg >= std ? 'ACC.' : 'REJ.'
            return <tr key={i}><td>{c.coat}</td><td className="detail-left">{c.area || '—'}</td><td>{(c.pts || []).filter(Boolean).join(', ') || '—'}</td><td>{avg ?? '—'}</td><td>{c.std || '—'}</td><td className={st === 'REJ.' ? 'detail-rej' : 'detail-acc'}>{st}</td></tr>
          })}
          {!coats.length && <tr><td colSpan={6} className="detail-empty">No coats recorded</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function DetailPhotos({ photos, onZoom }) {
  const ps = photos || []
  if (!ps.length) return <p className="detail-empty">No photos attached</p>
  return (
    <div className="detail-photos">
      {ps.map((p, i) => (
        <figure key={i} onClick={() => p.img && onZoom(p)}>
          {p.img && <img src={p.img} alt={p.label || ''} />}
          <figcaption>{p.label || `Photo ${i + 1}`}</figcaption>
        </figure>
      ))}
    </div>
  )
}

function DetailSignatures({ fields, v }) {
  const vis = fields.filter((f) => showField(f, v))
  return (
    <div className="detail-signs">
      {vis.map((f) => {
        const s = v[f.id]
        return (
          <div className="detail-sign" key={f.id}>
            <span className="detail-sign-role">{f.label}</span>
            {s
              ? <>{s.img ? <img className="detail-sign-img" src={s.img} alt="" /> : <div className="detail-sign-script">{s.name}</div>}<span className="detail-sign-name">{s.name}</span><span className="detail-sign-date">{fmtDate(s.at)}</span></>
              : <span className="detail-sign-pending">Pending</span>}
          </div>
        )
      })}
    </div>
  )
}

const VIEW_KEY = 'qc.detailView'

export default function ReportDetail({ schema, report, job, deliverable, status, role, onBack, onPdf, onApprove, onEdit }) {
  const v = report.values || {}
  const [zoom, setZoom] = useState(null)
  const secs = schema.sections.filter((s) => !s.noPrint && s.id !== 'setup')
  const r = buildResume(schema, report, job)

  // Read the whole record at once, or one section at a time. Which one you
  // prefer depends on whether you are auditing or scanning, so it is a
  // setting rather than a decision made for you.
  const [view, setView] = useState(() => {
    try { return localStorage.getItem(VIEW_KEY) === 'paged' ? 'paged' : 'all' } catch { return 'all' }
  })
  const setViewMode = (mode) => {
    setView(mode)
    try { localStorage.setItem(VIEW_KEY, mode) } catch { /* private mode */ }
  }
  const [page, setPage] = useState(0)
  const at = Math.min(page, secs.length - 1)
  useEffect(() => { setPage(0) }, [report.id])

  // The bar condenses once the hero has scrolled away. An observer on a
  // sentinel does this without listening to every scroll frame.
  const sentinel = useRef(null)
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    const el = sentinel.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting), { rootMargin: '-4px 0px 0px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const shown = view === 'paged' ? [secs[at]] : secs
  const statusLabel = status === 'approved' ? 'Approved' : 'Submitted'

  return (
    <div className="page form-page form-page-pad">
      <button className="btn btn-ghost back-btn btn-sm" onClick={onBack}><IconBack size={14} /> Job {job.jobNo}</button>

      <div className="detail-hero">
        <div className="detail-hero-main">
          <h2>{schema.title}</h2>
          <p>{v.reportId} · {deliverable} · {job.jobNo} · {job.productDesc}</p>
          <p className={`detail-hero-verdict ${r.released ? 'is-acc' : 'is-rej'}`}>{r.headline}</p>
        </div>

        <div className="detail-hero-actions">
          <span className={`report-state state-${status}`}>{statusLabel}</span>
          {role.canOverride && status === 'submitted' && <button className="btn btn-primary btn-sm" onClick={onApprove}>Approve</button>}
          <button className="btn btn-secondary btn-sm" onClick={onPdf}><IconPrint size={13} /> PDF Report</button>
          {role.canOverride && <button className="btn btn-ghost btn-sm" onClick={onEdit}><IconPen size={13} /> Edit</button>}
        </div>

        {/* Read the whole record, or one section at a time. */}
        <div className="detail-viewsw" role="group" aria-label="Section view">
          <button className={view === 'all' ? 'on' : ''} aria-pressed={view === 'all'}
            onClick={() => setViewMode('all')}>All</button>
          <button className={view === 'paged' ? 'on' : ''} aria-pressed={view === 'paged'}
            onClick={() => setViewMode('paged')}>Pages</button>
        </div>

        {/* The verdict as a stamp across the corner, the way it lands on
            the paper copy. Decorative angle, real text for screen readers. */}
        <div className={`detail-stamp ${r.released ? 'is-acc' : 'is-rej'}`}>
          {r.released ? 'ACCEPT' : 'REJECT'}
        </div>
      </div>

      {/* Sentinel: once this leaves the viewport the strip below has stuck. */}
      <div ref={sentinel} aria-hidden="true" className="detail-sentinel" />

      {view === 'paged' ? (
        <nav className={`detail-filetabs${stuck ? ' is-stuck' : ''}`} aria-label="Sections">
          {secs.map((s, i) => (
            <button key={s.id} className={i === at ? 'on' : ''} aria-current={i === at ? 'true' : undefined}
              onClick={() => setPage(i)}>{s.title}</button>
          ))}
        </nav>
      ) : (
        <div className={`detail-idstrip${stuck ? ' is-stuck' : ''}`}>
          <strong>{v.reportId}</strong>
          <span className={`report-state state-${status}`}>{statusLabel}</span>
        </div>
      )}

      <div className="detail-sections">
        {shown.map((s) => (
          <section className={`card detail-card${view === "paged" ? " is-paged" : ""}`} key={s.id}>
            <h3>{s.title}{s.subtitle ? <small>{s.subtitle}</small> : null}</h3>
            {s.id === 'approvals' ? <DetailSignatures fields={s.fields} v={v} />
              : s.type === 'recording' ? <DetailRecording report={report} />
                : s.type === 'results' ? <DetailResults sec={s} report={report} />
                  : s.type === 'dft' ? <DetailDft report={report} />
                    : s.type === 'photos' ? <DetailPhotos photos={report.photos} onZoom={setZoom} />
                      : <DetailPairs fields={s.fields} v={v} report={report} />}
          </section>
        ))}
      </div>

      {zoom && createPortal(
        <div className="photo-lightbox" onClick={() => setZoom(null)}>
          <button className="photo-lightbox-x" onClick={() => setZoom(null)}>×</button>
          <img src={zoom.img} alt={zoom.label || ''} onClick={(e) => e.stopPropagation()} />
          {zoom.label && <div className="photo-lightbox-cap">{zoom.label}</div>}
        </div>, document.body)}
    </div>
  )
}
