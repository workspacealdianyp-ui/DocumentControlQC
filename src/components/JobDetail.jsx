import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp, navigate } from '../App.jsx'
import { DELIVERABLES, NDE_FORMS } from '../lib/constants.js'
import { FORM_SCHEMAS } from '../data/formSchemas.js'
import { buildContext, jobProgress, fmtDate, fmtDateTime } from '../lib/status.js'
import { reportsFor } from '../lib/store.js'
import { requiredFor } from '../lib/jobOrders.js'
import StatusChip, { StateBadge } from './StatusChip.jsx'
import MdrReport from './MdrReport.jsx'
import CompletionDial from './CompletionDial.jsx'
import { reportResult } from '../lib/verdict.js'
import { IconDoc, IconPrint } from './Icons.jsx'
import Masthead from './Masthead.jsx'

const KAT_LABEL = { SUPEQ: 'Support Equipment', TRAILER: 'Trailer', 'NON TRAILER': 'Non Trailer' }

const Meta = ({ label, value }) => (
  <div className="meta-item">
    <span className="meta-label">{label}</span>
    <span className="meta-value">{value || '—'}</span>
  </div>
)

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
  // What this job was actually raised for. Showing the other five as
  // greyed N/A rows was noise an inspector had to read past.
  const wanted = requiredFor(job)

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

  const pct = p.applicable ? Math.round((p.done / p.applicable) * 100) : 0
  const done = !!p.applicable && p.done === p.applicable

  return (
    <div className="page">
      {/* The same band every document in this app wears, with the ring
          as its mark: how much of this job is finished is the first
          thing anyone opening it wants to know, and it sits on the left
          where the stone's scrim is fully opaque. Back goes to the
          category this job belongs to, so returning keeps the list where
          the reader left it. */}
      <Masthead variant="job"
        mark={<CompletionDial done={p.done} total={p.applicable} />} wide
        eyebrow={<>{KAT_LABEL[job.kategori] || 'Job'}{job.poNo ? <> · PO {job.poNo}</> : null}</>}
        title={job.customerName || `Job ${job.jobNo}`}
        sub={<>Job {job.jobNo}{job.productDesc ? <> · {job.productDesc}</> : null}</>}
        backLabel={`Back to ${KAT_LABEL[job.kategori] || 'jobs'}`}
        onBack={() => navigate(job.kategori ? `/jobs?kat=${encodeURIComponent(job.kategori)}` : '/jobs')}>
        {/* The dial reads the number at both widths, so the only thing
            left to say is the one state it cannot show: late. */}
        {p.overdue && !done && <span className="report-state jd-state state-overdue">Overdue</span>}
      </Masthead>

      {/* Metadata. Category, customer and serial live in the hero now, so
          this card carries only what the hero does not already say — and
          the type only when it differs from the product description. */}
      <div className="card jd-meta-card">
        <div className="meta-grid">
          {job.poNo && <Meta label="PO No." value={job.poNo} />}
          {job.type && job.type.toUpperCase() !== (job.productDesc || '').toUpperCase() &&
            <Meta label="Type" value={job.type} />}
          <Meta label="WBS No." value={job.wbsNo} />
          <Meta label="Unit No." value={job.unitNo || job.arasSN} />
          <Meta label="Customer ID" value={job.customerId} />
          <Meta label="Date PB" value={fmtDate(job.datePB)} />
          <Meta label="PDI Release" value={fmtDate(job.datePdiRelease)} />
        </div>
      </div>

      {/* Required reports — app-style rows */}
      <h3 className="section-title">Required Reports</h3>
      <div className="rep-list">
        {DELIVERABLES.filter((d) => wanted.includes(d.key)).map((d) => {
          const cell = p.statuses[d.key]
          const reps = reportsFor(job.jobNo, d.key)
          const last = reps.length ? reps[reps.length - 1] : null
          const tappable = !!d.form && (role.canEdit || !!last)
          const foot = cell.ref
            || (last ? [last.reportId, fmtDate(last.updatedAt), last.inspector].filter(Boolean).join(' · ') : null)
            || (d.form ? (role.canEdit ? 'Not started — open to fill the form' : 'No report yet') : 'Document deliverable, tracked manually')
          return (
            <div key={d.key} className={`rep-card is-deliv tone-${cell.status}${tappable ? '' : ' is-flat'}`}
              role={tappable ? 'button' : undefined} tabIndex={tappable ? 0 : undefined}
              onClick={tappable ? () => openDeliv(d, cell, last) : undefined}
              onKeyDown={tappable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDeliv(d, cell, last) } } : undefined}>
              <span className="rep-code" aria-hidden="true">{d.short}</span>
              <strong className="rep-id">{d.label}</strong>
              <span className="rep-state"><StatusChip status={cell.status} /></span>
              <small className="rep-foot">{foot}</small>
              {tappable && <span className="rep-go" aria-hidden="true"><Chevron /></span>}
            </div>
          )
        })}
      </div>

      {/* Documents — categorized by type, with filter + summary generator */}
      <div className="page-head" style={{ marginTop: 24, marginBottom: 10 }}>
        <h3 className="section-title" style={{ margin: 0 }}>Documents ({docs.length})</h3>
        <button className="btn btn-primary btn-sm" disabled={!docs.some((d) => d.status === 'approved')}
          title={docs.some((d) => d.status === 'approved') ? 'Compile the Manufacturing Data Report from approved documents' : 'Needs at least one approved document'}
          onClick={() => { setSumSel(docs.filter((d) => d.status === 'approved').map((d) => d.id)); setSumPicker(true) }}>
          <IconPrint size={13} /> Generate MDR
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
                <StateBadge status={r.status} />
                <Chevron />
              </span>
            </button>
          ))
        )}
      </div>

      {/* MDR document picker — approved only */}
      {sumPicker && (
        <div className="modal-backdrop" onClick={() => setSumPicker(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Generate Manufacturing Data Report">
            <div className="sheet-handle" />
            <h3>Generate MDR</h3>
            <p className="page-sub">
              Choose the documents to bind into the Manufacturing Data Report. Each one is reproduced in
              full, on its own page, behind a cover and a table of contents. Only{' '}
              <strong>approved</strong> documents can be issued.
            </p>
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
        <MdrReport job={job} reports={summary} session={session} onClose={() => setSummary(null)} />,
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
