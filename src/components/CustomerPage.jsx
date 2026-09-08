import { useMemo } from 'react'
import { useApp, navigate } from '../App.jsx'
import { buildContext, fmtDate } from '../lib/status.js'
import { byCustomer, ordersFor } from '../lib/rollup.js'
import { initials } from '../lib/label.js'
import Masthead from './Masthead.jsx'
import { IconChevronR } from './Icons.jsx'

/* One customer, at the altitude a QC head works at.

   The question this page answers is "where does this customer stand" —
   how many orders, how many units, how much of the inspection is done,
   and what is holding. Every figure is counted from the record; there is
   no on-time score or tier here because the app does not hold the data
   those would need, and inventing them is what this page replaced. */

export function Figure({ value, label, tone }) {
  return (
    <div className={`fig${tone ? ` fig-${tone}` : ''}`}>
      <b>{value}</b>
      <span>{label}</span>
    </div>
  )
}

/* A bar, not a ring. A ring reads as one unit's progress, and this is a
   sum across many; the bar says "this much of the whole" without
   implying it belongs to a single object. */
export function Meter({ done, total, className = '' }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <div className={`meter ${className}`}>
      <div className="meter-top">
        <strong>{pct}<i>%</i></strong>
        <small>{done} of {total} reports</small>
      </div>
      <div className="meter-track" role="img" aria-label={`${pct}% of the reports on this work are done`}>
        <span className={done === total && total ? 'is-done' : ''} style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
    </div>
  )
}

export default function CustomerPage({ name }) {
  const { jobs, tick } = useApp()
  const ctx = useMemo(() => buildContext(), [tick])
  const cust = useMemo(() => byCustomer(jobs, ctx).find((c) => c.name === name), [jobs, ctx, name])
  const orders = useMemo(() => (cust ? ordersFor(name, jobs, ctx) : []), [cust, name, jobs, ctx])

  if (!cust) {
    return (
      <div className="page">
        <div className="card empty-state">
          <p><strong>No such customer.</strong></p>
          <button className="btn btn-secondary" onClick={() => navigate('/jobs')}>Back to customers</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <Masthead variant="job"
        mark={<span className="cust-mono">{initials(cust.name)}</span>}
        eyebrow="Customer"
        title={cust.name}
        sub={<>{cust.orders} order{cust.orders === 1 ? '' : 's'} · {cust.units} unit{cust.units === 1 ? '' : 's'}</>}
        backLabel="Back to customers"
        onBack={() => navigate('/jobs')}>
        <Meter done={cust.done} total={cust.applicable} className="mh-meter" />
      </Masthead>

      <div className="fig-row">
        <Figure value={cust.orders} label="Purchase orders" />
        <Figure value={cust.units} label="Units" />
        <Figure value={cust.complete} label="Units finished" tone={cust.complete ? 'done' : undefined} />
        <Figure value={cust.open} label="Still open" tone={cust.open ? 'work' : undefined} />
        <Figure value={cust.overdue} label="Past release date" tone={cust.overdue ? 'late' : undefined} />
        <Figure value={cust.ncr} label="Non-conformances" tone={cust.ncr ? 'late' : undefined} />
      </div>

      <h3 className="section-title" style={{ marginTop: 24 }}>Orders ({orders.length})</h3>

      {orders.length === 0 ? (
        <div className="card empty-state"><p>No orders recorded for this customer yet.</p></div>
      ) : (
        <div className="po-list">
          {orders.map((o) => (
            <button key={o.poNo} className="po-row" onClick={() => navigate(`/po/${encodeURIComponent(o.poNo)}`)}>
              <span className="po-id">
                <strong>{o.poNo}</strong>
                <small>{o.mixed ? 'Mixed products' : o.product}{o.datePdiRelease ? ` · release ${fmtDate(o.datePdiRelease)}` : ''}</small>
              </span>
              <span className="po-figs">
                <i><b>{o.units}</b> units</i>
                <i><b>{o.complete}</b> finished</i>
                {o.overdue > 0 && <i className="is-late"><b>{o.overdue}</b> late</i>}
                {o.ncr > 0 && <i className="is-late"><b>{o.ncr}</b> NCR</i>}
              </span>
              <Meter done={o.done} total={o.applicable} className="po-meter" />
              <span className="po-go" aria-hidden="true"><IconChevronR size={16} /></span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
