import { useEffect, useMemo, useState } from 'react'
import { useApp, navigate } from '../App.jsx'
import { FORM_SCHEMAS } from '../data/formSchemas.js'
import { getReports } from '../lib/store.js'
import { fmtDateTime } from '../lib/status.js'
import { reportResult } from '../lib/verdict.js'
import Masthead from './Masthead.jsx'
import { artFor } from '../lib/productArt.js'
import { Figure } from './Readings.jsx'
import { SearchField, ToolButton, PopCheck, PopRadio, PopFooter } from './RegisterBar.jsx'
import { IconChevronR, IconFilter, IconSort } from './Icons.jsx'

/* Your documents, and where each one has got to.

   The registers elsewhere answer "where does this order stand". Nobody
   was answering "where do the six documents I wrote this week stand" —
   an inspector had to find their own work by filtering a list of every
   report in the company by their own name, and a document sitting in
   submitted, waiting on somebody else, looked exactly like one that was
   finished.

   So this is scoped to the signed-in account and ordered by what is
   still on you: drafts first, then waiting, then done. Two lanes,
   because a QA Lead who writes nothing still owns everything they
   approved — the same document, seen from the other side of the
   signature. */

const LANES = [
  { id: 'mine', label: 'Written by me' },
  { id: 'approved', label: 'Approved by me' },
]

/* The four states a document of yours can be in. They are checkboxes
   rather than tabs: "show me what is waiting and what came back" is one
   question, and it used to take two visits.

   Non-conformance is not one of them. It is a result, not a step, and
   a document can be approved and still carry one — which the old chip
   row could not say, because picking NCR there dropped the state filter
   entirely. It is its own switch below, and it narrows whatever states
   are picked rather than replacing them. */
const STATES = [
  { id: 'draft', label: 'Draft' },
  { id: 'returned', label: 'Sent back' },
  { id: 'submitted', label: 'Waiting' },
  { id: 'approved', label: 'Approved' },
]

/* Ordering. The default is the one this page was built on — what is
   still on you, first — and it stays the default because it is the
   answer to the question the page exists to ask. The rest are for
   finding one document you already know about. */
const ONYOU = { returned: -1, draft: 0, submitted: 1, approved: 2 }
const ORDERS = [
  { id: 'standing', label: 'What is on you first',
    of: (a, b) => (ONYOU[a.status] ?? 3) - (ONYOU[b.status] ?? 3)
      || (b.updatedAt || '').localeCompare(a.updatedAt || '') },
  { id: 'new', label: 'Newest first', of: (a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '') },
  { id: 'old', label: 'Oldest first', of: (a, b) => (a.updatedAt || '').localeCompare(b.updatedAt || '') },
  { id: 'id', label: 'Report number', of: (a, b) => (a.reportId || '').localeCompare(b.reportId || '') },
  { id: 'job', label: 'Job number',
    of: (a, b) => String(a.jobNo).localeCompare(String(b.jobNo)) || (a.reportId || '').localeCompare(b.reportId || '') },
]

/* Three steps, always all three, with the one it has reached filled in.

   A status word says where a document is. It does not say how far that
   is from done, which is the thing you are actually asking when you open
   this page — so the word keeps a track beside it. */
// 80 documents is a long scroll to reach a filter you meant to change.
const PAGE = 40

const STEPS = ['draft', 'submitted', 'approved']
/* A report that was sent back stands at the first step again, but not
   for the same reason a draft does — it has been read and returned. So
   it takes the draft position and marks it, rather than inventing a
   fourth segment for a step that does not exist. */
function Track({ status }) {
  const back = status === 'returned'
  const at = back ? 0 : Math.max(0, STEPS.indexOf(status))
  return (
    <span className={`vt-track${back ? ' is-back' : ''}`} role="img"
      aria-label={back ? 'Step 1 of 3: sent back to be corrected'
        : `Step ${at + 1} of 3: ${status === 'submitted' ? 'waiting for approval' : status}`}>
      {STEPS.map((s, i) => (
        <i key={s} className={i <= at ? 'on' : ''} />
      ))}
    </span>
  )
}

// What is holding this document, said as the thing to do about it.
function standing(r) {
  if (r.status === 'draft') return 'Not submitted yet'
  if (r.status === 'returned') return r.returnedBy ? `Sent back by ${r.returnedBy}` : 'Sent back'
  if (r.status === 'submitted') return 'Waiting for approval'
  // The date is on the line directly beneath, so naming it here only
  // made the sentence long enough to be cut off.
  if (r.status === 'approved') return r.approvedBy ? `Approved by ${r.approvedBy}` : 'Approved'
  return 'Not submitted yet'
}

export default function Vault() {
  const { session, role, jobIndex, tick } = useApp()
  // null until somebody chooses: which lane opens depends on which one
  // has anything in it. A QA Lead who writes nothing was landing on an
  // empty page with 151 documents one tab away.
  const [pickedLane, setLane] = useState(null)
  const [states, setStates] = useState(() => new Set())
  const [ncrOnly, setNcrOnly] = useState(false)
  const [order, setOrder] = useState('standing')
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(PAGE)

  const me = (session?.name || '').trim().toLowerCase()
  const all = useMemo(() => getReports(), [tick])

  const lanes = useMemo(() => ({
    mine: all.filter((r) => (r.inspector || '').trim().toLowerCase() === me),
    approved: all.filter((r) => (r.approvedBy || '').trim().toLowerCase() === me),
  }), [all, me])

  const lane = pickedLane
    ?? (lanes.mine.length || !lanes.approved.length ? 'mine' : 'approved')
  const mine = lanes[lane]

  const counts = useMemo(() => ({
    all: mine.length,
    draft: mine.filter((r) => r.status === 'draft').length,
    returned: mine.filter((r) => r.status === 'returned').length,
    submitted: mine.filter((r) => r.status === 'submitted').length,
    approved: mine.filter((r) => r.status === 'approved').length,
    ncr: mine.filter((r) => reportResult(r) === 'Reject').length,
  }), [mine])

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const sortBy = ORDERS.find((o) => o.id === order)?.of || ORDERS[0].of
    return mine
      // No state picked means every state, which is what an empty filter
      // has always meant here; picking some narrows to those.
      .filter((r) => (states.size === 0 || states.has(r.status)))
      .filter((r) => (!ncrOnly || reportResult(r) === 'Reject'))
      .filter((r) => {
        if (!ql) return true
        const job = jobIndex.get(r.jobNo)
        return `${r.reportId} ${r.jobNo} ${r.deliverable} ${FORM_SCHEMAS[r.formKey]?.title || ''} ${job?.customerName || ''} ${job?.unitNo || ''}`
          .toLowerCase().includes(ql)
      })
      .sort(sortBy)
  }, [mine, states, ncrOnly, order, q, jobIndex])

  useEffect(() => { setLimit(PAGE) }, [lane, states, ncrOnly, order, q])

  const shown = rows.slice(0, limit)

  const open = (r) =>
    navigate(`/job/${r.jobNo}/form/${r.formKey}?d=${encodeURIComponent(r.deliverable)}&rid=${encodeURIComponent(r.id)}`)

  const showLanes = lanes.approved.length > 0 || role.canOverride

  return (
    <div className="page">
      {/* The same band as everywhere else, machine and all. It is a
          top-level section, so the way back is the way out: the
          dashboard, not a level above it. */}
      <Masthead variant="job"
        eyebrow="Vault"
        title={session?.name || 'Your documents'}
        sub={<>{lanes.mine.length} written{lanes.approved.length > 0 ? ` · ${lanes.approved.length} approved` : ''}</>}
        art={artFor()}
        onBack={() => navigate('/')} backLabel="Back to the dashboard" />

      <div className="fig-row">
        <Figure value={counts.all} label={lane === 'mine' ? 'Documents written' : 'Documents approved'} />
        <Figure value={counts.draft} label="Draft" tone={counts.draft ? 'work' : undefined} />
        <Figure value={counts.submitted} label="Waiting for approval" tone={counts.submitted ? 'work' : undefined} />
        <Figure value={counts.approved} label="Approved" />
        <Figure value={counts.ncr} label="Non-conformances" tone={counts.ncr ? 'late' : undefined} />
      </div>

      {showLanes && (
        <nav className="mon-tabs vt-lanes" aria-label="Whose signature">
          {LANES.map((l) => (
            <button key={l.id} className={`mon-tab${lane === l.id ? ' on' : ''}`}
              aria-current={lane === l.id ? 'page' : undefined}
              onClick={() => { setLane(l.id); setStates(new Set()); setNcrOnly(false) }}>
              {l.label}<span className="mon-tab-n">{lanes[l.id].length}</span>
            </button>
          ))}
        </nav>
      )}

      <div className="card reg-card" style={{ marginTop: showLanes ? 12 : 16 }}>
        {/* The same toolbar the other two registers wear: the field, then
            the tools beside it. This page carried six chips on their own
            row instead — a second copy of the figures directly above,
            drawn as controls, wrapping to two lines on a phone and each
            one 28px tall against a thumb. The counts they carried live
            on the options inside the panel, so nothing was lost. */}
        <div className="reg-bar">
          <div className="rb-group">
            <SearchField value={q} onChange={setQ} label="Search your documents"
              placeholder="Report number, job, unit, customer…" />
            <ToolButton icon={IconFilter} label="Filter" count={states.size + (ncrOnly ? 1 : 0)}>
              {() => (
                <>
                  {STATES.map((st) => (
                    <PopCheck key={st.id} label={st.label} on={states.has(st.id)} hint={counts[st.id]}
                      onChange={(on) => setStates((s0) => {
                        const n = new Set(s0)
                        if (on) n.add(st.id); else n.delete(st.id)
                        return n
                      })} />
                  ))}
                  <div className="rb-pop-legend">Result</div>
                  <PopCheck label="Non-conformance only" on={ncrOnly} hint={counts.ncr}
                    onChange={setNcrOnly} />
                  <PopFooter>
                    <button className="btn btn-ghost btn-sm" disabled={!states.size && !ncrOnly}
                      onClick={() => { setStates(new Set()); setNcrOnly(false) }}>Clear</button>
                  </PopFooter>
                </>
              )}
            </ToolButton>
            <ToolButton icon={IconSort} label="Sort" count={order === 'standing' ? 0 : 1}>
              {({ close }) => (
                <>
                  {ORDERS.map((o) => (
                    <PopRadio key={o.id} label={o.label} on={order === o.id}
                      onChange={() => { setOrder(o.id); close() }} />
                  ))}
                </>
              )}
            </ToolButton>
          </div>
          <span className="mon-count">
            {rows.length} document{rows.length === 1 ? '' : 's'}
            {rows.length > shown.length && <> · showing {shown.length}</>}
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="reg-empty">
            {lanes[lane].length === 0 ? (
              <>
                <p><strong>Nothing in your vault yet.</strong></p>
                <p>
                  {lane === 'mine'
                    ? 'Every inspection report you fill in is kept here, with what it is waiting on.'
                    : 'Reports you approve are kept here, so you can find what you signed.'}
                </p>
                {role.canEdit && lane === 'mine' && (
                  <button className="btn btn-secondary btn-sm" onClick={() => navigate('/monitoring')}>
                    Find a unit to inspect
                  </button>
                )}
              </>
            ) : (
              <>
                <p><strong>Nothing here.</strong></p>
                <p>{q ? `No document of yours matches "${q}".` : 'No document of yours is in this state.'}</p>
                <button className="btn btn-secondary btn-sm"
                  onClick={() => { setQ(''); setStates(new Set()); setNcrOnly(false) }}>
                  Show all {lanes[lane].length}
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="reg-list">
            {shown.map((r) => {
              const job = jobIndex.get(r.jobNo)
              const ncr = reportResult(r) === 'Reject'
              return (
                <button key={r.id} className="reg-row vt-row" onClick={() => open(r)}>
                  <span className="spine">{FORM_SCHEMAS[r.formKey]?.code || '—'}</span>
                  <span className="reg-id">
                    <strong className="is-code">{r.reportId}</strong>
                    <small>
                      {FORM_SCHEMAS[r.formKey]?.title || r.formKey} · Job {r.jobNo}
                      {job?.unitNo ? ` · ${job.unitNo}` : ''}{job?.customerName ? ` · ${job.customerName}` : ''}
                    </small>
                  </span>
                  <span className="vt-standing">
                    <b className={r.status === 'returned' ? 'is-back' : undefined}>{standing(r)}</b>
                    <small>
                      {/* On a returned report the reason outranks the
                          photo count: it is the thing to act on. */}
                      {r.status === 'returned' && r.returnNote
                        ? r.returnNote
                        : <>{r.photos?.length ? `${r.photos.length} photo${r.photos.length === 1 ? '' : 's'} · ` : ''}{fmtDateTime(r.updatedAt)}</>}
                    </small>
                  </span>
                  {/* Always rendered, blank when clean: a cell that
                      appears only on some rows shifts every column to
                      its right on those rows. */}
                  <span className="vt-ncr">{ncr ? 'NCR' : null}</span>
                  <Track status={r.status} />
                  <span className="reg-go" aria-hidden="true"><IconChevronR size={15} /></span>
                </button>
              )
            })}
            {rows.length > shown.length && (
              <div className="rep-more">
                <button className="btn btn-secondary btn-sm" onClick={() => setLimit((v) => v + PAGE)}>
                  Show {Math.min(PAGE, rows.length - shown.length)} more
                </button>
                <small>{shown.length} of {rows.length}</small>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
