import { useEffect, useMemo, useState } from 'react'
import { useApp, navigate } from '../App.jsx'
import { FORM_SCHEMAS } from '../data/formSchemas.js'
import { getReports } from '../lib/store.js'
import { fmtDateTime } from '../lib/status.js'
import { reportResult } from '../lib/verdict.js'
import { initials } from '../lib/label.js'
import Masthead from './Masthead.jsx'
import { Figure } from './Readings.jsx'
import { SearchField } from './RegisterBar.jsx'
import { IconChevronR } from './Icons.jsx'

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

const STATES = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Draft' },
  { id: 'submitted', label: 'Waiting' },
  { id: 'approved', label: 'Approved' },
  { id: 'ncr', label: 'NCR' },
]

/* Three steps, always all three, with the one it has reached filled in.

   A status word says where a document is. It does not say how far that
   is from done, which is the thing you are actually asking when you open
   this page — so the word keeps a track beside it. */
// 80 documents is a long scroll to reach a filter you meant to change.
const PAGE = 40

const STEPS = ['draft', 'submitted', 'approved']
function Track({ status }) {
  const at = Math.max(0, STEPS.indexOf(status))
  return (
    <span className="vt-track" role="img"
      aria-label={`Step ${at + 1} of 3: ${status === 'submitted' ? 'waiting for approval' : status}`}>
      {STEPS.map((s, i) => (
        <i key={s} className={i <= at ? 'on' : ''} />
      ))}
    </span>
  )
}

// What is holding this document, said as the thing to do about it.
function standing(r) {
  if (r.status === 'draft') return 'Not submitted yet'
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
  const [state, setState] = useState('all')
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
    submitted: mine.filter((r) => r.status === 'submitted').length,
    approved: mine.filter((r) => r.status === 'approved').length,
    ncr: mine.filter((r) => reportResult(r) === 'Reject').length,
  }), [mine])

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const rank = { draft: 0, submitted: 1, approved: 2 }
    return mine
      .filter((r) => (state === 'all' ? true : state === 'ncr' ? reportResult(r) === 'Reject' : r.status === state))
      .filter((r) => {
        if (!ql) return true
        const job = jobIndex.get(r.jobNo)
        return `${r.reportId} ${r.jobNo} ${r.deliverable} ${FORM_SCHEMAS[r.formKey]?.title || ''} ${job?.customerName || ''} ${job?.unitNo || ''}`
          .toLowerCase().includes(ql)
      })
      // What is still on you, first.
      .sort((a, b) => (rank[a.status] ?? 3) - (rank[b.status] ?? 3)
        || (b.updatedAt || '').localeCompare(a.updatedAt || ''))
  }, [mine, state, q, jobIndex])

  useEffect(() => { setLimit(PAGE) }, [lane, state, q])

  const shown = rows.slice(0, limit)

  const open = (r) =>
    navigate(`/job/${r.jobNo}/form/${r.formKey}?d=${encodeURIComponent(r.deliverable)}&rid=${encodeURIComponent(r.id)}`)

  const showLanes = lanes.approved.length > 0 || role.canOverride

  return (
    <div className="page">
      <Masthead variant="job"
        mark={<span className="cust-mono">{initials(session?.name || '')}</span>}
        eyebrow="Vault"
        title={session?.name || 'Your documents'}
        sub={<>{lanes.mine.length} written{lanes.approved.length > 0 ? ` · ${lanes.approved.length} approved` : ''}</>} />

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
              onClick={() => { setLane(l.id); setState('all') }}>
              {l.label}<span className="mon-tab-n">{lanes[l.id].length}</span>
            </button>
          ))}
        </nav>
      )}

      <div className="card reg-card" style={{ marginTop: showLanes ? 12 : 16 }}>
        <div className="reg-bar">
          <SearchField value={q} onChange={setQ} label="Search your documents"
            placeholder="Report number, job, unit, customer…" />
          <div className="vt-states" role="tablist" aria-label="Document state">
            {STATES.map((s) => (
              <button key={s.id} role="tab" aria-selected={state === s.id}
                className={`vt-state${state === s.id ? ' on' : ''}${s.id === 'ncr' && counts.ncr ? ' is-ncr' : ''}`}
                onClick={() => setState(s.id)}>
                {s.label}<b>{counts[s.id]}</b>
              </button>
            ))}
          </div>
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
                  onClick={() => { setQ(''); setState('all') }}>Show all {lanes[lane].length}</button>
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
                    <b>{standing(r)}</b>
                    <small>
                      {r.photos?.length ? `${r.photos.length} photo${r.photos.length === 1 ? '' : 's'} · ` : ''}
                      {fmtDateTime(r.updatedAt)}
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
