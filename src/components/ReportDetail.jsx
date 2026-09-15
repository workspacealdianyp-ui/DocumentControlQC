import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { dimRowStatus, dimDeviation, approverFields, extraApprovers, APPROVER_SIGN, APPROVER_ACTS } from '../data/formSchemas.js'
import { MR } from '../lib/compute.js'
import { fmtDate } from '../lib/status.js'
import { buildResume } from '../lib/resume.js'
import { IconPrint, IconPen, IconApprove, IconSend, IconXCircle, IconReturn, IconPlus } from './Icons.jsx'
import { canApprove } from '../lib/store.js'
import SignaturePad from './SignaturePad.jsx'
import Masthead from './Masthead.jsx'
import { artFor } from '../lib/productArt.js'

// read-only detail view of a submitted/approved report — shows the entered data, never edits
const lbl = (f, v) => (typeof f.label === 'function' ? f.label(v) : f.label)
const showField = (f, v) => (typeof f.showIf === 'function' ? f.showIf(v) : true)

const dval = (f, v, report) => {
  if (f.type === 'computed') return (f.compute ? f.compute(v, report) : '') || '—'
  if (f.type === 'sign') return v[f.id]?.name || '—'
  if (f.type === 'date' || f.fmt === 'date') return fmtDate(v[f.id] ?? f.default)
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

/* The two acts the schema names — prepared by, reviewed by — then
   whoever else signed, each under the act they signed for.

   Name over the rule, position and date under it, which is the order a
   signature block is read in. It was the other way round: the mark, then
   a line, then the name, so the rule read as an underscore on the
   signature rather than the line it was signed above. */
function DetailSignatures({ fields, v }) {
  const vis = fields.filter((f) => showField(f, v))
  return (
    <div className="detail-signs">
      {vis.map((f) => {
        const s = v[f.id]
        return (
          <div className={`detail-sign${s ? '' : ' is-pending'}`} key={f.id}>
            <span className="detail-sign-role">{typeof f.label === 'function' ? f.label(v) : f.label}</span>
            <span className="detail-sign-space" />
            {/* The mark hangs off the rule the name sits on, centred and
                straddling it, the way a pen does on a printed form. */}
            <span className="detail-sign-name">
              {s?.name || f.name || '\u00a0'}
              {s && (s.img ? <img className="detail-sign-img" src={s.img} alt="" /> : <span className="detail-sign-script">{s.name}</span>)}
            </span>
            <span className="detail-sign-post">{f.position || '\u00a0'}</span>
            <span className="detail-sign-date">{s ? fmtDate(s.at) : 'Not signed'}</span>
          </div>
        )
      })}
    </div>
  )
}

/* Adding a signature to a report that is already in. Offered only to
   somebody who could approve it and only while it is waiting: an
   approved document has been relied on, and changing one is a new issue
   rather than an edit. */
function AddSignature({ session, onSign, onCancel }) {
  const [act, setAct] = useState(APPROVER_ACTS[0])
  const [name, setName] = useState(session?.name || '')
  const [post, setPost] = useState('')
  const [pad, setPad] = useState(false)
  return (
    <div className="card appr-add">
      <div className="rowcard-body">
        <div className="field" data-span="6">
          <label>Signing as</label>
          {/* The same switch the form uses, across the width of the
              panel: one answer with five positions, not five pills. */}
          <div className="seg is-wrap" role="radiogroup">
            {APPROVER_ACTS.map((o) => (
              <button key={o} type="button" role="radio" aria-checked={act === o}
                className={`seg-btn${act === o ? ' active' : ''}`} onClick={() => setAct(o)}>{o}</button>
            ))}
          </div>
        </div>
        <div className="field" data-span="3">
          <label>Name</label>
          <input value={name} placeholder="As it is signed" onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field" data-span="3">
          <label>Position</label>
          <input value={post} placeholder="e.g. QC Engineer" onChange={(e) => setPost(e.target.value)} />
        </div>
      </div>
      <div className="appr-add-acts">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-primary btn-sm" disabled={!name.trim()} onClick={() => setPad(true)}>
          <IconPen size={14} /> Sign
        </button>
      </div>
      {pad && createPortal(
        <SignaturePad name={name.trim()} saved=""
          onClose={() => setPad(false)}
          onSave={(sig) => { setPad(false); onSign({ act, name: name.trim(), post: post.trim(), sig }) }} />,
        document.body)}
    </div>
  )
}

const VIEW_KEY = 'qc.detailView'

export default function ReportDetail({ schema, report, job, deliverable, status, role, session, onBack, onPdf, onApprove, onReturn, onEdit, onSign }) {
  const v = report.values || {}
  const [zoom, setZoom] = useState(null)
  const [adding, setAdding] = useState(false)
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
  /* The same gate the Approve button uses. Somebody who cannot approve
     the report cannot add a name to its approvals either, and once it is
     approved the document is fixed — a further signature is a new issue,
     not an edit to this one. */
  const canSign = !!onSign && role?.canOverride && status === 'submitted' && canApprove(report, session?.name)

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
      <Masthead variant="job" title={schema.title} onBack={onBack} backLabel="Back to job"
        eyebrow={<>{deliverable}{job ? <> · Job {job.jobNo}</> : null}</>}
        sub={<>{v.reportId}{job?.productDesc ? <> · {job.productDesc}</> : null}</>}
        art={artFor(job?.productDesc, job?.type)} />

      {/* State on the left, what can be done about it on the right.

          The two badges used to sit in the middle of the band, floating
          between the title and the unit. They belong with the controls:
          where the document stands and what you may do about it are one
          thought, and reading them together is how anybody decides
          whether to press Approve. */}
      <div className="detail-bar">
        <div className="detail-marks">
          {/* Two badges of the same shape, so they read as one kind of fact. */}
          <span className={`dbadge state-${status}`}>
            {status === 'approved' ? <IconApprove size={13} /> : <IconSend size={13} />}
            {statusLabel}
          </span>
          {/* A verdict badge on a filed plan or release note would be
              this app's opinion of somebody else's document. Records show
              one only when the document itself recorded a result. */}
          {(schema.kind !== 'record' || schema.verdict) && (
            <span className={`dbadge verdict ${r.released ? 'is-acc' : 'is-rej'}`}>
              {r.released ? <IconApprove size={13} /> : <IconXCircle size={13} />}
              {r.released ? 'Accept' : 'Reject'}
            </span>
          )}
        </div>

        {/* Controls: one row, one height, one weight. Nothing here is
            more important than its neighbour. */}
        <div className="detail-controls">
          <div className="detail-viewsw" role="group" aria-label="Section view">
            <button className={view === 'all' ? 'on' : ''} aria-pressed={view === 'all'}
              onClick={() => setViewMode('all')}>All</button>
            <button className={view === 'paged' ? 'on' : ''} aria-pressed={view === 'paged'}
              onClick={() => setViewMode('paged')}>Pages</button>
          </div>
          {/* Not offered to whoever recorded it: approval is the second
              person's judgement, and a button you are not allowed to
              press is worse than one that is not there. */}
          {role.canOverride && status === 'submitted' && canApprove(report, session?.name) && (
            <>
              <button className="dbtn is-primary" onClick={onApprove}><IconApprove size={14} /> Approve</button>
              {/* The other half of the same judgement. Offered here and
                  not in the register: a document is not sent back from a
                  list, it is sent back by somebody who has read it. */}
              <button className="dbtn" onClick={onReturn}><IconReturn size={14} /> Send back</button>
            </>
          )}
          <button className="dbtn" onClick={onPdf}><IconPrint size={14} /> PDF Report</button>
          {role.canOverride && <button className="dbtn" onClick={onEdit}><IconPen size={14} /> Edit</button>}
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
      ) : null}

      <div className="detail-sections">
        {shown.map((s) => (
          <section className={`card detail-card${view === "paged" ? " is-paged" : ""}`} key={s.id}>
            <h3>{s.title}{s.subtitle ? <small>{s.subtitle}</small> : null}</h3>
            {s.id === 'approvals' ? <>
              <DetailSignatures fields={[...s.fields, ...approverFields(v)]} v={v} />
              {canSign && (adding
                ? <AddSignature session={session} onCancel={() => setAdding(false)} onSign={(entry) => {
                  const list = extraApprovers(v)
                  const id = String(1 + Math.max(0, ...list.map((a) => Number(a.id) || 0)))
                  if (onSign({
                    approvers: [...list, { id, name: entry.name, position: entry.post, capacity: entry.act }],
                    [APPROVER_SIGN(id)]: entry.sig,
                  }) !== false) setAdding(false)
                }} />
                : <button type="button" className="btn btn-secondary btn-sm appr-add-btn" onClick={() => setAdding(true)}>
                  <IconPlus size={15} /> Add a signature
                </button>)}
            </>
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
