import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp, navigate } from '../App.jsx'
import { artFor } from '../lib/productArt.js'
import { DELIVERABLES, NDE_FORMS } from '../lib/constants.js'
import { FORM_SCHEMAS } from '../data/formSchemas.js'
import { buildContext, jobProgress, fmtDate, fmtDateTime, dueDate, releasedAt } from '../lib/status.js'
import { reportsFor } from '../lib/store.js'
import { requiredFor } from '../lib/jobOrders.js'
import StatusChip, { StateBadge } from './StatusChip.jsx'
import MdrReport from './MdrReport.jsx'
import { ReportId } from './Reports.jsx'
import CompletionDial from './CompletionDial.jsx'
import { reportResult } from '../lib/verdict.js'
import { IconPrint, IconChevronD } from './Icons.jsx'
import Masthead from './Masthead.jsx'
import { useDismiss } from '../lib/useDismiss.js'

const KAT_LABEL = { SUPEQ: 'Support Equipment', TRAILER: 'Trailer', 'NON TRAILER': 'Non Trailer' }
// The chip carries a code, the way a report's carries LHT or DIM.

const Meta = ({ label, value }) => (
  <div className="meta-item">
    <span className="meta-label">{label}</span>
    <span className="meta-value">{value || '—'}</span>
  </div>
)


/* The document register, as a register.

   nextReportId() numbers by form type and job, so MFG/LHT/1000200002/01,
   /02 and /03 are three issues of the same document, not three
   documents. The list showed them flat, which is how a superseded
   revision ends up bound into a data book: the latest issue leads, the
   ones it replaced fold underneath it and say what they are. */
const issueNo = (reportId = '') => {
  const m = String(reportId).match(/\/(\d+)$/)
  return m ? Number(m[1]) : 0
}

function byDocument(reports) {
  const m = new Map()
  for (const r of reports) {
    const key = `${r.formKey}::${r.deliverable}`
    if (!m.has(key)) m.set(key, [])
    m.get(key).push(r)
  }
  return [...m.values()]
    .map((issues) => {
      const sorted = issues.slice().sort((a, b) => issueNo(b.reportId) - issueNo(a.reportId)
        || (b.updatedAt || '').localeCompare(a.updatedAt || ''))
      return { current: sorted[0], superseded: sorted.slice(1) }
    })
    .sort((a, b) => (b.current.updatedAt || '').localeCompare(a.current.updatedAt || ''))
}

/* The shell the two hand-built pickers share.

   Backdrop dismissal is a mouse convenience; Escape is the keyboard's
   version of the same gesture, and these two were the only overlays in
   the app that did not answer it. useDismiss brings the rest with it:
   focus moves into the dialog on open, cannot Tab out of it, and returns
   to whatever opened it on close. */
function Dismissable({ label, onClose, children }) {
  const { box, dialogProps } = useDismiss(onClose)
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" ref={box} {...dialogProps} aria-label={label}
        onMouseDown={(e) => e.stopPropagation()}>
        {children}
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
  /* Which list is on screen. Required is what the order asks for and
     what the percentage counts; Documents is everything filed against
     the unit, which is the same set plus anything the order stopped
     asking for after it was filed. */
  const [tab, setTab] = useState('required')
  const [openIssues, setOpenIssues] = useState(null)
  const [sumPicker, setSumPicker] = useState(false)
  const [sumSel, setSumSel] = useState([])
  const [summary, setSummary] = useState(null)
  /* Where the declaration is made. One statement for the book is the
     default: nine reports about one unit, signed on one day, do not each
     need their own page saying so. 'each' keeps the per-report
     statement, for a customer who takes the documents loose. */
  const [sumStmt, setSumStmt] = useState('book')
  const ctx = useMemo(() => buildContext(), [tick])
  const docs = useMemo(
    () => (job ? reportsFor(job.jobNo).slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')) : []),
    [job, tick]
  )

  // Only a current issue may be bound: a data book carrying a revision
  // that something else replaced is a finding, not a document.
  const bindable = useMemo(
    () => byDocument(docs).map((g) => g.current).filter((r) => r.status === 'approved'),
    [docs]
  )
  // Every document on the unit, newest issue leading its own earlier ones.
  const docGroups = useMemo(() => byDocument(docs), [docs])

  const openDoc = (r) =>
    navigate(`/job/${job.jobNo}/form/${r.formKey}?d=${encodeURIComponent(r.deliverable)}&rid=${encodeURIComponent(r.id)}`)

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
  // Not a field on the job: the date its pre-delivery inspection was
  // approved, read back off the reports.
  const released = releasedAt(job, ctx)
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
      {/* Built to the same model as a report's band: a code chip on the
          left, the name and its two lines beside it, and the state on
          the right. A job and a report are the same kind of object to
          the person reading them, so they should not arrive in two
          different shapes. */}
      {/* Back goes up the register the unit was reached through — the
          order it belongs to — not sideways into the category it happens
          to be filed under. */}
      {/* No code chip. It stamped NTR in a box beside an eyebrow that
          already said NON TRAILER in full, and a box is a thing to read
          around. The PO number carries its own PO- prefix, so the label
          in front of it was saying it twice. */}
      <Masthead variant="job"
        eyebrow={<>{KAT_LABEL[job.kategori] || 'Job'}{job.poNo ? <> · {job.poNo}</> : null}</>}
        title={job.customerName || `Job ${job.jobNo}`}
        sub={<>Job {job.jobNo}{job.productDesc ? <> · {job.productDesc}</> : null}</>}
        backLabel={job.poNo ? `Back to ${job.poNo}` : 'Back to jobs'}
        onBack={() => navigate(job.poNo ? `/po/${encodeURIComponent(job.poNo)}` : '/monitoring')}
        art={artFor(job.productDesc, job.type)}
        reading={
          <span className="jd-meter">
            <span className="jd-meter-top">
              <strong>{pct}<i>%</i></strong>
              <small>{p.done} of {p.applicable} reports done</small>
            </span>
            <span className="jd-meter-track" aria-hidden="true">
              <span className={done ? 'is-done' : ''} style={{ width: `${Math.max(2, pct)}%` }} />
            </span>
          </span>
        }>

        {/* A circle is the right shape on a phone, where the band is
            short and the reading has to be compact. A desktop band is
            1100px of width and a circle wastes it, so there the same
            number is a meter that can also say what the fraction is
            counting. One reading, two shapes, never both at once.

            The circle stays in the side slot rather than moving under the
            title with the meter: on a phone that slot is the tall right
            column the band's grid keeps for it, and the meter it swaps
            with is not on screen at that width anyway. */}
        <CompletionDial done={p.done} total={p.applicable} size={64} className="jd-dial-sm" />

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
          <Meta label="Target delivery" value={fmtDate(dueDate(job))} />
          {/* Read off the record, not off the order: the date the
              pre-delivery inspection was approved. */}
          <Meta label="PDI released" value={released ? fmtDate(released) : 'Not yet'} />
        </div>
      </div>

      {/* One list, not two.

         This page used to state every document twice: once as a
         Required Reports row carrying its number and date, and again a
         thousand pixels down a phone as a Documents card carrying the
         same number and date. Across the 48 units in the register that
         was 224 rows printed twice. The deliverable and the document
         that answers it are one thing to the person reading them, and
         the register that lists them should be one thing too.

         So the document folds into the row that asks for it: the same
         row, with the issues it replaced folded underneath, and Generate
         MDR at the head of the list rather than buried at the bottom of
         the page. The filter chips went with the second list — six
         wrapping chips to filter nine rows was a control that cost more
         than it saved. */}
      <div className="page-head jd-list-head">
        {/* The tabs are the heading. A "Required Reports" title above a
            "Required" tab says it twice, and on a phone that is a whole
            row of chrome to say nothing. */}
        <nav className="mon-tabs jd-tabs" aria-label="What to list">
          <button className={`mon-tab${tab === 'required' ? ' on' : ''}`}
            aria-current={tab === 'required' ? 'page' : undefined}
            onClick={() => { setTab('required'); setOpenIssues(null) }}>
            Required<span className="mon-tab-n">{wanted.length}</span>
          </button>
          <button className={`mon-tab${tab === 'documents' ? ' on' : ''}`}
            aria-current={tab === 'documents' ? 'page' : undefined}
            onClick={() => { setTab('documents'); setOpenIssues(null) }}>
            Documents<span className="mon-tab-n">{docGroups.length}</span>
          </button>
        </nav>
        {/* Not a tab: it binds the approved documents whichever list is
            on screen, so it stays beside the switch rather than inside
            it. */}
        <button className="btn btn-primary btn-sm jd-mdr" disabled={!bindable.length}
          title={bindable.length ? 'Compile the Manufacturing Data Report from the approved current issues' : undefined}
          onClick={() => { setSumSel(bindable.map((d) => d.id)); setSumPicker(true) }}>
          <IconPrint size={13} /> Generate MDR
        </button>
      </div>
      {/* Why it cannot be pressed, where a thumb can read it. The reason
          lived in a title attribute, which is a tooltip, which is a
          hover — and there is no hover on the screen most of these units
          are inspected from. */}
      {!bindable.length && (
        <p className="jd-mdr-note">No approved document to bind yet. One is enough to start the data report.</p>
      )}
      {tab === 'required' && (
      <div className="rep-list">
        {DELIVERABLES.filter((d) => wanted.includes(d.key)).map((d) => {
          const cell = p.statuses[d.key]
          /* Newest issue first, by issue number rather than by the order
             the store happens to hold them in. The row and the old
             Documents list sorted differently, so on a revised document
             they could name different issues as the current one. */
          const reps = reportsFor(job.jobNo, d.key).slice().sort(
            (a, b) => issueNo(b.reportId) - issueNo(a.reportId)
              || (b.updatedAt || '').localeCompare(a.updatedAt || ''))
          const last = reps[0] || null
          const earlier = reps.slice(1)
          const open = openIssues === d.key
          const tappable = !!d.form && (role.canEdit || !!last)
          /* cell.ref is gone with the branch that set it: an imported
             sheet can no longer make a cell done, so there is no ref
             without a report. What is left is a cell an admin marked
             done by hand — a deliberate statement, but not a document,
             and the row has to say which of the two it is. */
          /* With a document, the row takes the shape the register's own
             document cards take: name, then the number on its own line,
             then when and who. All three on one line is what the
             deliverable row used to do, and at 390px it cut the
             inspector's name off — the merge gave this row a third fact
             to carry and the single line could not hold it. */
          const foot = (last ? [fmtDate(last.updatedAt), last.inspector].filter(Boolean).join(' · ') : null)
            || (cell.status === 'done' ? 'Marked done by an admin — no document held here' : null)
            || (d.form
              ? (FORM_SCHEMAS[d.form]?.kind === 'record'
                /* ITP, PTR and IRN are documents issued elsewhere. What
                   is opened here records one, so the row says that
                   rather than offering to fill in a test. */
                ? (role.canEdit ? 'Not filed — open to record the document' : 'No document on file')
                : (role.canEdit ? 'Not started — open to fill the form' : 'No report yet'))
              : 'Document deliverable, tracked manually')
          return (
            <div className="doc-stack" key={d.key}>
            <div className={`rep-card tone-${cell.status}${last ? '' : ' is-deliv'}${tappable ? '' : ' is-flat'}`}
              role={tappable ? 'button' : undefined} tabIndex={tappable ? 0 : undefined}
              onClick={tappable ? () => openDeliv(d, cell, last) : undefined}
              onKeyDown={tappable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDeliv(d, cell, last) } } : undefined}>
              <span className="rep-code" aria-hidden="true">{d.short}</span>
              <strong className="rep-id">{d.label}</strong>
              {/* Done and rejected are not the same fact. A deliverable
                  whose report found a non-conformance still counts as
                  done — the inspection happened — but a register that
                  shows only "Done" hides the one thing somebody scanning
                  this page is looking for. */}
              <span className="rep-state">
                {last && reportResult(last) === 'Reject' && <span className="rep-ncr" title="Non-conformance recorded">NCR</span>}
                <StatusChip status={cell.status} />
              </span>
              {last && <small className="rep-sub doc-num"><ReportId id={last.reportId} /></small>}
              <small className="rep-foot">
                {last && issueNo(last.reportId) > 0 && (
                  <>
                    <span className="doc-issue">Issue {String(issueNo(last.reportId)).padStart(2, '0')}</span>
                    <span className="rep-dot" aria-hidden="true">·</span>
                  </>
                )}
                {foot}
              </small>
              {tappable && <span className="rep-go" aria-hidden="true"><Chevron /></span>}
            </div>

            {/* What this issue replaced. Kept, because a QC record is the
                history as well as the current sheet, and folded, because
                only one of them is the live document. */}
            {earlier.length > 0 && (
              <>
                <button className={`doc-more${open ? ' is-open' : ''}`} aria-expanded={open}
                  onClick={() => setOpenIssues(open ? null : d.key)}>
                  <IconChevronD size={13} />
                  {open ? 'Hide' : 'Show'} {earlier.length} earlier issue{earlier.length === 1 ? '' : 's'}
                </button>
                {open && (
                  <div className="doc-past">
                    {earlier.map((o) => (
                      <button key={o.id} className="doc-past-row" onClick={() => openDoc(o)}>
                        <span className="doc-past-txt">
                          <strong><ReportId id={o.reportId} /></strong>
                          <small>{fmtDateTime(o.updatedAt)}{o.inspector ? ` · ${o.inspector}` : ''}</small>
                        </span>
                        <em>Superseded</em>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            </div>
          )
        })}
      </div>
      )}

      {tab === 'documents' && (
        docGroups.length === 0 ? (
          <div className="card empty-state">
            <p><strong>Nothing filed against this unit yet.</strong></p>
            <p>Every inspection report submitted here appears in this list, latest issue first.</p>
          </div>
        ) : (
          <div className="rep-list">
            {docGroups.map(({ current: r, superseded }) => {
              const open = openIssues === r.id
              const n = issueNo(r.reportId)
              /* job.required is editable after the fact, so an order can
                 be revised to drop a deliverable that already has a
                 document filed against it. That document is evidence and
                 still belongs on the unit — it simply no longer answers
                 anything the order asks for, and the row has to say so
                 rather than sit among the ones that do. */
              const spare = !wanted.includes(r.deliverable)
              return (
                <div className="doc-stack" key={r.id}>
                  <div className={`rep-card tone-${r.status}`} role="button" tabIndex={0}
                    onClick={() => openDoc(r)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDoc(r) } }}>
                    <span className="rep-code" aria-hidden="true">{FORM_SCHEMAS[r.formKey]?.code || '—'}</span>
                    <strong className="rep-id">
                      {FORM_SCHEMAS[r.formKey]?.title || r.deliverable}
                      {spare && <em className="rep-spare" title="Filed before the order was revised">not in this order</em>}
                    </strong>
                    <span className="rep-state">
                      {reportResult(r) === 'Reject' && <span className="rep-ncr" title="Non-conformance recorded">NCR</span>}
                      <StateBadge status={r.status} />
                    </span>
                    <small className="rep-sub doc-num"><ReportId id={r.reportId} /></small>
                    <small className="rep-foot">
                      {n > 0 && (
                        <>
                          <span className="doc-issue">Issue {String(n).padStart(2, '0')}</span>
                          <span className="rep-dot" aria-hidden="true">·</span>
                        </>
                      )}
                      {fmtDateTime(r.updatedAt)}{r.inspector ? ` · ${r.inspector}` : ''}
                    </small>
                    <span className="rep-go" aria-hidden="true"><Chevron /></span>
                  </div>

                  {superseded.length > 0 && (
                    <>
                      <button className={`doc-more${open ? ' is-open' : ''}`} aria-expanded={open}
                        onClick={() => setOpenIssues(open ? null : r.id)}>
                        <IconChevronD size={13} />
                        {open ? 'Hide' : 'Show'} {superseded.length} earlier issue{superseded.length === 1 ? '' : 's'}
                      </button>
                      {open && (
                        <div className="doc-past">
                          {superseded.map((o) => (
                            <button key={o.id} className="doc-past-row" onClick={() => openDoc(o)}>
                              <span className="doc-past-txt">
                                <strong><ReportId id={o.reportId} /></strong>
                                <small>{fmtDateTime(o.updatedAt)}{o.inspector ? ` · ${o.inspector}` : ''}</small>
                              </span>
                              <em>Superseded</em>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )
      )}

      {/* MDR document picker — approved only */}
      {sumPicker && (
        <Dismissable label="Generate Manufacturing Data Report" onClose={() => setSumPicker(false)}>
            <div className="sheet-handle" />
            <h3>Generate MDR</h3>
            <p className="page-sub">
              Choose the documents to bind into the Manufacturing Data Report. Each one is reproduced in
              full, on its own page, behind a cover and a table of contents. Only the{' '}
              <strong>approved current issue</strong> of each document can be bound; a revision
              something else replaced is not eligible.
            </p>
            <div className="unit-list" style={{ margin: '14px 0' }}>
              {byDocument(docs).map(({ current: r, superseded }) => {
                const ok = r.status === 'approved'
                const checked = sumSel.includes(r.id)
                return (
                  <label key={r.id} className={`sum-row${ok ? '' : ' disabled'}`}>
                    <input type="checkbox" disabled={!ok} checked={checked}
                      onChange={() => setSumSel(checked ? sumSel.filter((x) => x !== r.id) : [...sumSel, r.id])} />
                    <span className="act-main">
                      <strong>{r.reportId}</strong>
                      <small>
                        {FORM_SCHEMAS[r.formKey]?.title}
                        {/* One form can answer two deliverables — Pre-Shipment
                            and PDI are both filled on the visual form — and two
                            rows reading the same title with nothing to tell them
                            apart is a document picked at random. */}
                        {r.deliverable && r.deliverable !== FORM_SCHEMAS[r.formKey]?.deliverable
                          ? ` · ${r.deliverable}` : ''} · {reportResult(r)} · {ok ? 'approved' : `${r.status} — not eligible`}
                        {superseded.length > 0 && ` · replaces ${superseded.length} earlier issue${superseded.length === 1 ? '' : 's'}`}
                      </small>
                    </span>
                  </label>
                )
              })}
            </div>
            <div className="mdr-stmt">
              <span className="set-group-label">Statement of result</span>
              <div className="mdr-stmt-opts">
                {[
                  { id: 'book', title: 'One statement for the book',
                    sub: 'A Statement of Inspection at the front, listing every inspection carried out and declaring the unit on all of them. The reports carry none of their own.' },
                  { id: 'each', title: 'A statement in every report',
                    sub: 'Each report keeps its own Statement of Result, as it prints on its own. The same declaration is then made once per document.' },
                ].map((o) => (
                  <label key={o.id} className={`mdr-stmt-opt${sumStmt === o.id ? ' is-on' : ''}`}>
                    <input type="radio" name="mdr-stmt" checked={sumStmt === o.id}
                      onChange={() => setSumStmt(o.id)} />
                    <span className="act-main"><strong>{o.title}</strong><small>{o.sub}</small></span>
                  </label>
                ))}
              </div>
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
        </Dismissable>
      )}

      {summary && createPortal(
        <MdrReport job={job} reports={summary} session={session} statements={sumStmt}
          onClose={() => setSummary(null)} />,
        document.body
      )}

      {/* NDE method picker — bottom sheet */}
      {ndePicker && (
        <Dismissable label="Choose NDE method" onClose={() => setNdePicker(false)}>
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
        </Dismissable>
      )}
    </div>
  )
}
