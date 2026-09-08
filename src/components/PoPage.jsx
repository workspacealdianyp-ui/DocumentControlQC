import { useMemo } from 'react'
import { useApp, navigate } from '../App.jsx'
import { buildContext, fmtDate } from '../lib/status.js'
import { unitsFor } from '../lib/rollup.js'
import { Figure, Meter } from './CustomerPage.jsx'
import Masthead from './Masthead.jsx'
import { IconChevronR } from './Icons.jsx'

/* One purchase order, unit by unit.

   A PO is how the work is actually sold and how a customer asks about
   it: "where are my thirty tanks". So the units are the page, ordered
   with the unfinished ones first — somebody opening an order is looking
   for what is holding it, not admiring what is done. */
export default function PoPage({ poNo }) {
  const { jobs, tick } = useApp()
  const ctx = useMemo(() => buildContext(), [tick])
  const rows = useMemo(() => unitsFor(poNo, jobs, ctx), [poNo, jobs, ctx])

  const head = rows[0]?.job
  const roll = rows.reduce((a, r) => ({
    done: a.done + r.done, applicable: a.applicable + r.applicable,
    complete: a.complete + (r.complete ? 1 : 0),
    overdue: a.overdue + (r.overdue ? 1 : 0),
    ncr: a.ncr + r.ncr,
  }), { done: 0, applicable: 0, complete: 0, overdue: 0, ncr: 0 })

  if (!head) {
    return (
      <div className="page">
        <div className="card empty-state">
          <p><strong>No such order.</strong></p>
          <button className="btn btn-secondary" onClick={() => navigate('/jobs')}>Back to customers</button>
        </div>
      </div>
    )
  }

  const products = [...new Set(rows.map((r) => r.job.productDesc).filter(Boolean))]

  return (
    <div className="page">
      <Masthead variant="job"
        code="PO"
        eyebrow={head.customerName}
        title={poNo}
        sub={<>{rows.length} unit{rows.length === 1 ? '' : 's'} · {products.length === 1 ? products[0] : `${products.length} products`}</>}
        backLabel={`Back to ${head.customerName}`}
        onBack={() => navigate(`/customer/${encodeURIComponent(head.customerName)}`)}>
        <Meter done={roll.done} total={roll.applicable} className="mh-meter" />
      </Masthead>

      <div className="fig-row">
        <Figure value={rows.length} label="Units" />
        <Figure value={roll.complete} label="Finished" tone={roll.complete ? 'done' : undefined} />
        <Figure value={rows.length - roll.complete} label="Still open" tone={rows.length - roll.complete ? 'work' : undefined} />
        <Figure value={roll.overdue} label="Past release date" tone={roll.overdue ? 'late' : undefined} />
        <Figure value={roll.ncr} label="Non-conformances" tone={roll.ncr ? 'late' : undefined} />
      </div>

      <h3 className="section-title" style={{ marginTop: 24 }}>Units ({rows.length})</h3>

      {/* Not the job-order picker, which is a capped box inside a card:
          this is the page. Sixteen units were being clipped to eight
          behind an inner scrollbar under a heading that said 16. */}
      <div className="unit-list po-units">
        {rows.map((r) => (
          <button key={r.job.jobNo} className={`unit-row${r.complete ? ' is-done' : ''}`}
            onClick={() => navigate(`/job/${r.job.jobNo}`)}>
            <span className="unit-id">
              <strong>{r.job.unitNo || r.job.arasSN || r.job.jobNo}</strong>
              <small>Job {r.job.jobNo}{r.job.wbsNo ? ` · ${r.job.wbsNo}` : ''}</small>
            </span>
            <span className="unit-state">
              {r.complete
                ? <i className="u-done">Finished</i>
                : r.overdue
                  ? <i className="u-late">Past release</i>
                  : r.done ? <i className="u-work">In progress</i> : <i className="u-idle">Not started</i>}
              {r.ncr > 0 && <i className="u-ncr">NCR {r.ncr}</i>}
            </span>
            <span className="unit-count">{r.done}/{r.applicable}</span>
            <span className="unit-bar" aria-label={`${r.pct}% done`}>
              <i className={r.complete ? 'is-done' : ''} style={{ width: `${Math.max(2, r.pct)}%` }} />
            </span>
            <span className="unit-go" aria-hidden="true"><IconChevronR size={16} /></span>
          </button>
        ))}
      </div>
    </div>
  )
}
