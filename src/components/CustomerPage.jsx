import { useMemo } from 'react'
import { useApp, navigate } from '../App.jsx'
import { buildContext, fmtDate, fmtDateTime } from '../lib/status.js'
import { byCustomer, ordersFor, outstandingBy, unitMix, unitsForCustomer } from '../lib/rollup.js'
import { initials } from '../lib/label.js'
import { artFor } from '../lib/productArt.js'
import Masthead from './Masthead.jsx'
import UnitList from './UnitList.jsx'
import { Figure, Meter, Outstanding, Ribbon } from './Readings.jsx'
import { IconChevronR } from './Icons.jsx'

/* One customer, at the altitude a QC head works at.

   The question this page answers is "where does this customer stand" —
   how many orders, how many units, how much of the inspection is done,
   and what is holding. Every figure is counted from the record; there is
   no on-time score or tier here because the app does not hold the data
   those would need, and inventing them is what this page replaced.

   ── What changed, and why ────────────────────────────────────────────
   The page used to stop after six figures and a list of orders. For a
   customer with one purchase order that was a masthead, a strip of
   numbers — three of them zero — one row, and then half a screen of
   nothing. It also stopped one level short of the thing somebody came
   for: which unit is behind, and which document is holding it.

   So the page now reads in two columns on a desktop. The wide one is the
   record — the orders, then every unit across all of them, unfinished
   first. The narrow one is the instruction: how the units divide between
   finished, working, untouched and late, and which document type is owed
   by the most of them. Narrow screens stack the instruction first,
   because on a phone the summary is the whole visit. */

/* An order, as a row. The release date is on it because an order is the
   thing a delivery date is actually promised against. */
function OrderRow({ o }) {
  return (
    <button className="po-row" onClick={() => navigate(`/po/${encodeURIComponent(o.poNo)}`)}>
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
  )
}

export default function CustomerPage({ name }) {
  const { jobs, tick } = useApp()
  const ctx = useMemo(() => buildContext(), [tick])
  const cust = useMemo(() => byCustomer(jobs, ctx).find((c) => c.name === name), [jobs, ctx, name])
  const orders = useMemo(() => (cust ? ordersFor(name, jobs, ctx) : []), [cust, name, jobs, ctx])
  const units = useMemo(() => (cust ? unitsForCustomer(name, jobs, ctx) : []), [cust, name, jobs, ctx])
  const waiting = useMemo(
    () => (cust ? outstandingBy(jobs.filter((j) => (j.customerName || 'Unassigned') === name), ctx) : []),
    [cust, name, jobs, ctx])

  if (!cust) {
    return (
      <div className="page">
        <div className="card empty-state">
          <p><strong>No such customer.</strong></p>
          <button className="btn btn-secondary" onClick={() => navigate('/monitoring')}>Back to customers</button>
        </div>
      </div>
    )
  }

  const late = units.filter((u) => u.overdue).length
  const carrying = units.filter((u) => u.ncr > 0).length
  const attention = [
    late && `${late} unit${late === 1 ? '' : 's'} past the release date`,
    carrying && `${carrying} carrying a non-conformance`,
  ].filter(Boolean).join(', ')

  return (
    <div className="page">
      <Masthead variant="job"
        mark={<span className="cust-mono">{initials(cust.name)}</span>}
        eyebrow="Customer"
        title={cust.name}
        sub={<>{cust.orders} order{cust.orders === 1 ? '' : 's'} · {cust.units} unit{cust.units === 1 ? '' : 's'}</>}
        backLabel="Back to customers"
        onBack={() => navigate('/monitoring')}
        // Whatever this customer's units are. With one order of one
        // product that is exact; across a mixed book it is the first
        // product they have on the books.
        art={artFor(...units.map((u) => u.job.productDesc))}
        reading={<Meter done={cust.done} total={cust.applicable} className="mh-meter" />} />

      <div className="fig-row">
        <Figure value={cust.orders} label="Purchase orders" />
        <Figure value={cust.units} label="Units" />
        <Figure value={cust.complete} label="Units finished" tone={cust.complete ? 'done' : undefined} />
        <Figure value={cust.open} label="Still open" tone={cust.open ? 'work' : undefined} />
        <Figure value={cust.overdue} label="Past release date" tone={cust.overdue ? 'late' : undefined} />
        <Figure value={cust.ncr} label="Non-conformances" tone={cust.ncr ? 'late' : undefined} />
      </div>

      <div className="cust-layout">
        <aside className="cust-aside">
          <section className="card brief">
            <h3 className="brief-title">Where the units stand</h3>
            <Ribbon mix={unitMix(cust)} ncr={cust.ncr} className="brief-ribbon" />
            <dl className="brief-facts">
              <div>
                <dt>Next release owed</dt>
                <dd>{cust.nextRelease ? fmtDate(cust.nextRelease) : 'Nothing outstanding'}</dd>
              </div>
              <div>
                <dt>Last report recorded</dt>
                <dd>{cust.lastAt ? fmtDateTime(cust.lastAt) : 'No report yet'}</dd>
              </div>
            </dl>
            {attention && (
              <p className="brief-note is-late">{attention} — listed first under Units.</p>
            )}
          </section>

          <section className="card brief">
            <h3 className="brief-title">Waiting on</h3>
            <Outstanding rows={waiting} units={cust.units} done={cust.done} applicable={cust.applicable} />
          </section>
        </aside>

        <div className="cust-main">
          <h3 className="section-title">Orders ({orders.length})</h3>
          {orders.length === 0 ? (
            <div className="card empty-state"><p>No orders recorded for this customer yet.</p></div>
          ) : (
            <div className="po-list">
              {orders.map((o) => <OrderRow key={o.poNo} o={o} />)}
            </div>
          )}

          <h3 className="section-title">Units ({units.length})</h3>
          {units.length === 0 ? (
            <div className="card empty-state"><p>No units recorded against this customer yet.</p></div>
          ) : (
            /* Across every order, unfinished first: the customer page is
               the only place that can answer "which of their units is
               behind" when the answer spans two purchase orders. */
            <UnitList rows={units} showPo={orders.length > 1} />
          )}
        </div>
      </div>
    </div>
  )
}
