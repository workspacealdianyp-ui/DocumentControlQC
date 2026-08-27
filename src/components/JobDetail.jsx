import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp, navigate } from '../App.jsx'
import { DELIVERABLES, NDE_FORMS } from '../lib/constants.js'
import { FORM_SCHEMAS } from '../data/formSchemas.js'
import { buildContext, jobProgress, fmtDate, fmtDateTime } from '../lib/status.js'
import { reportsFor } from '../lib/store.js'
import StatusChip from './StatusChip.jsx'
import SummaryReport, { reportResult } from './SummaryReport.jsx'
import { IconBack, IconDoc, IconPrint } from './Icons.jsx'

const KAT_LABEL = { SUPEQ: 'Support Equipment', TRAILER: 'Trailer', 'NON TRAILER': 'Non Trailer' }

// COGM arrives as a bare integer; grouped digits are the difference
// between reading it and counting it.
const fmtNum = (v) => {
  const n = Number(v)
  return v == null || v === '' || Number.isNaN(n) ? v : n.toLocaleString('en-GB')
}

const Meta = ({ label, value }) => (
  <div className="meta-item">
    <span className="meta-label">{label}</span>
    <span className="meta-value">{value || '—'}</span>
  </div>
)

function ProgressRing({ done, total }) {
  const pct = total ? done / total : 0
  const R = 38, C = 2 * Math.PI * R
  return (
    <div className="ring-wrap" role="img" aria-label={`${done} of ${total} reports complete`}>
      <svg width="92" height="92" viewBox="0 0 92 92">
        <circle className="ring-track" cx="46" cy="46" r={R} strokeWidth="9" fill="none" />
        <circle className="ring-bar" cx="46" cy="46" r={R} strokeWidth="9" fill="none"
          strokeDasharray={C} strokeDashoffset={C * (1 - pct)} />
      </svg>
      <div className="ring-label">
        <strong>{Math.round(pct * 100)}%</strong>
        <small>{done}/{total} done</small>
      </div>
    </div>
  )
}

const Chevron = () => (
  <svg className="deliv-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="9 18 15 12 9 6" />
  </svg>
)

export default function JobDetail({ job }) {
  const { role, tick, session, notify } = useApp()
  const [ndePicker, setNdePicker] = useState(false)
  const [docFilter, setDocFilter] = useState('All')
  const [sumPicker, setSumPicker] = useState(false)
  const [sumSel, setSumSel] = useState([])
  const [summary, setSummary] = useState(null)
  const ctx = useMemo(() => buildContext(), [tick])
  const docs = useMemo(
    () => (job ? reportsFor(job.jobNo).slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')) : []),
    [job, tick]
  )

  if (!job) {
    return (
      <div className="page">
        <div className="card empty-state">
          <p><strong>Job not found.</strong></p>
          <button className="btn btn-secondary" onClick={() => navigate('/')}>Back to Dashboard</button>
        </div>
      </div>
    )
  }

  const p = jobProgress(job, ctx)

  const openDeliv = (d, cell, last) => {
    if (!d.form) return
    if (!role.canEdit) {
      if (last) navigate(`/job/${job.jobNo}/form/${last.formKey}?d=${encodeURIComponent(d.key)}&rid=${encodeURIComponent(last.id)}`)
      return
    }
    if (d.form === 'nde') { setNdePicker(true); return }
    if (last) {
      navigate(`/job/${job.jobNo}/form/${last.formKey}?d=${encodeURIComponent(d.key)}&rid=${encodeURIComponent(last.id)}`)
    } else {
      navigate(`/job/${job.jobNo}/form/${d.form}?d=${encodeURIComponent(d.key)}`)
    }
  }

  return (
    <div className="page">
      {/* Back to the category this job belongs to, so returning keeps the
          list where the reader left it. */}
      <button className="btn btn-ghost back-btn btn-sm"
        onClick={() => navigate(job.kategori ? `/jobs?kat=${encodeURIComponent(job.kategori)}` : '/jobs')}>
        <IconBack size={14} /> {KAT_LABEL[job.kategori] || 'Jobs'}
      </button>

      {/* Hero. Was the one dark panel in a light app; it reads as a card
          now, with the ring carrying the only colour. */}
      <div className={`jd-hero${p.applicable && p.done === p.applicable ? ' is-complete' : ''}`}>
        <div className="jd-hero-main">
          <div className="jd-hero-id">
            <h2>{job.jobNo}</h2>
            {job.kategori && <span className="jd-kat">{KAT_LABEL[job.kategori] || job.kategori}</span>}
          </div>
          <p className="jd-product">{job.productDesc}</p>
          <p className="jd-cust">
            {job.customerName}
            {job.arasSN && <span className="jd-sn">{job.arasSN}</span>}
          </p>
        </div>
        <ProgressRing done={p.done} total={p.applicable} />
      </div>

      {/* Metadata. Category, customer and serial live in the hero now, so
          this card carries only what the hero does not already say — and
          the type only when it differs from the product description. */}
      <div className="card jd-meta-card">
        <div className="meta-grid">
          {job.type && job.type.toUpperCase() !== (job.productDesc || '').toUpperCase() &&
            <Meta label="Type" value={job.type} />}
          <Meta label="WBS No." value={job.wbsNo} />
          <Meta label="Customer ID" value={job.customerId} />
          <Meta label="COGM" value={fmtNum(job.cogm)} />
          <Meta label="Date PB" value={fmtDate(job.datePB)} />
          <Meta label="PDI Release" value={fmtDate(job.datePdiRelease)} />
        </div>
      </div>

      {/* Required reports — app-style rows */}
      <h3 className="section-title">Required Reports</h3>
      <div className="card table-card deliv-list">
        {DELIVERABLES.map((d) => {
          const cell = p.statuses[d.key]
          const reps = reportsFor(job.jobNo, d.key)
          const last = reps.length ? reps[reps.length - 1] : null
          const tappable = !!d.form && (role.canEdit || !!last)
          const sub = cell.ref
            || (last ? [last.reportId, fmtDate(last.updatedAt), last.inspector].filter(Boolean).join(' · ') : null)
            || (d.form ? (role.canEdit ? 'Tap to fill the inspection form' : 'No report yet') : 'Document deliverable, tracked manually')
          const Row = tappable ? 'button' : 'div'
          return (
            <Row key={d.key} className={`deliv-row${tappable ? ' tappable' : ''}`}
              onClick={tappable ? () => openDeliv(d, cell, last) : undefined}>
              <span className="deliv-ico">{d.short}</span>
              <span className="deliv-main">
                <strong>{d.label}</strong>
                <small>{sub}</small>
              </span>
              <span className="deliv-end">
                <StatusChip status={cell.status} />
                {tappable ? <Chevron /> : <span className="deliv-chevron-gap" aria-hidden="true" />}
              </span>
            </Row>
          )
        })}
      </div>

      {/* Documents — categorized by type, with filter + summary generator */}
      <div className="page-head" style={{ marginTop: 24, marginBottom: 10 }}>
        <h3 className="section-title" style={{ margin: 0 }}>Documents ({docs.length})</h3>
        <button className="btn btn-primary btn-sm" disabled={!docs.some((d) => d.status === 'approved')}
          title={docs.some((d) => d.status === 'approved') ? 'Generate a summary from approved documents' : 'Needs at least one approved document'}
          onClick={() => { setSumSel(docs.filter((d) => d.status === 'approved').map((d) => d.id)); setSumPicker(true) }}>
          <IconPrint size={13} /> Generate Summary
        </button>
      </div>

      {docs.length > 0 && (
        <div className="filters-row" style={{ marginBottom: 10 }}>
          {['All', ...new Set(docs.map((d) => d.deliverable))].map((t) => (
            <button key={t} className={`mselect-btn${docFilter === t ? ' has-value' : ''}`} onClick={() => setDocFilter(t)}>
              {t}
            </button>
          ))}
        </div>
      )}

      <div className="card table-card deliv-list">
        {docs.length === 0 ? (
          <div className="empty-state">
            <p><strong>No documents yet for this job.</strong></p>
            <p>Submitted inspection forms will appear here, grouped by type.</p>
          </div>
        ) : (
          docs.filter((d) => docFilter === 'All' || d.deliverable === docFilter).map((r) => (
            <button key={r.id} className="deliv-row tappable"
              onClick={() => navigate(`/job/${job.jobNo}/form/${r.formKey}?d=${encodeURIComponent(r.deliverable)}&rid=${encodeURIComponent(r.id)}`)}>
              <span className="deliv-ico"><IconDoc size={17} /></span>
              <span className="deliv-main">
                <strong>{r.reportId}</strong>
                <small>{[FORM_SCHEMAS[r.formKey]?.title, r.deliverable, fmtDateTime(r.updatedAt), r.inspector].filter(Boolean).join(' · ')}</small>
              </span>
              <span className="deliv-end">
                <span className={`report-state state-${r.status}`}>{r.status}</span>
                <Chevron />
              </span>
            </button>
          ))
        )}
      </div>

      {/* Summary doc picker — approved only */}
      {sumPicker && (
        <div className="modal-backdrop" onClick={() => setSumPicker(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Generate summary">
            <div className="sheet-handle" />
            <h3>Generate Summary</h3>
            <p className="page-sub">Select the documents to include. Only <strong>approved</strong> documents can be summarized.</p>
            <div className="unit-list" style={{ margin: '14px 0' }}>
              {docs.map((r) => {
                const ok = r.status === 'approved'
                const checked = sumSel.includes(r.id)
                return (
                  <label key={r.id} className={`sum-row${ok ? '' : ' disabled'}`}>
                    <input type="checkbox" disabled={!ok} checked={checked}
                      onChange={() => setSumSel(checked ? sumSel.filter((x) => x !== r.id) : [...sumSel, r.id])} />
                    <span className="act-main">
                      <strong>{r.reportId}</strong>
                      <small>{FORM_SCHEMAS[r.formKey]?.title} · {reportResult(r)} · {ok ? 'approved' : `${r.status} — not eligible`}</small>
                    </span>
                  </label>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setSumPicker(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 2 }} disabled={!sumSel.length}
                onClick={() => {
                  const sel = docs.filter((d) => sumSel.includes(d.id))
                  if (!sel.length) return notify('Select at least one approved document', 'err')
                  setSumPicker(false)
                  setSummary(sel)
                }}>
                Generate ({sumSel.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {summary && createPortal(
        <SummaryReport job={job} reports={summary} session={session} onClose={() => setSummary(null)} />,
        document.body
      )}

      {/* NDE method picker — bottom sheet */}
      {ndePicker && (
        <div className="modal-backdrop" onClick={() => setNdePicker(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Choose NDE method">
            <div className="sheet-handle" />
            <h3>NDE Report: choose method</h3>
            <p className="page-sub">The NDE deliverable can be fulfilled by MT, PT, or UT examination.</p>
            <div className="nde-options">
              {NDE_FORMS.map((f) => (
                <button key={f} className="nde-option"
                  onClick={() => navigate(`/job/${job.jobNo}/form/${f}?d=NDE%20Report`)}>
                  <span className="deliv-ico">{FORM_SCHEMAS[f].code}</span>
                  <span className="nde-option-text">
                    <strong>{FORM_SCHEMAS[f].title}</strong>
                    <span>Form {FORM_SCHEMAS[f].code} · per Field Form V2</span>
                  </span>
                </button>
              ))}
            </div>
            <button className="btn btn-ghost btn-block" onClick={() => setNdePicker(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
