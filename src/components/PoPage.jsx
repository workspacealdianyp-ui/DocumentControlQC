import { useMemo } from 'react'
import { useApp, navigate } from '../App.jsx'
import { buildContext, fmtDate, dueDate } from '../lib/status.js'
import { outstandingBy, unitMix, unitsFor } from '../lib/rollup.js'
import { orderByPo } from '../lib/jobOrders.js'
import { artFor } from '../lib/productArt.js'
import { Figure, Meter, Outstanding, Ribbon } from './Readings.jsx'
import Masthead from './Masthead.jsx'
import UnitList from './UnitList.jsx'
import { IconPen } from './Icons.jsx'

/* One purchase order, unit by unit.

   A PO is how the work is actually sold and how a customer asks about
   it: "where are my thirty tanks". So the units are the page, ordered
   with the unfinished ones first — somebody opening an order is looking
   for what is holding it, not admiring what is done. */
export default function PoPage({ poNo }) {
  const { jobs, role, tick } = useApp()
  /* Only an order raised in the app can be revised — the bundled job
     list is history, with no order behind it to edit. */
  const order = useMemo(() => orderByPo(poNo), [poNo, tick])
  const ctx = useMemo(() => buildContext(), [tick])
  const rows = useMemo(() => unitsFor(poNo, jobs, ctx), [poNo, jobs, ctx])
  const waiting = useMemo(
    () => outstandingBy(jobs.filter((j) => (j.poNo || 'No PO') === poNo), ctx), [poNo, jobs, ctx])

  const head = rows[0]?.job
  // Shaped like a roll-up from rollup.js so unitMix can derive the
  // fourth unit state from it the same way the customer page does.
  const roll = rows.reduce((a, r) => ({
    units: a.units + 1,
    done: a.done + r.done, applicable: a.applicable + r.applicable,
    complete: a.complete + (r.complete ? 1 : 0),
    overdue: a.overdue + (r.overdue ? 1 : 0),
    inprogress: a.inprogress + (!r.complete && !r.overdue && r.done > 0 ? 1 : 0),
    ncr: a.ncr + r.ncr,
  }), { units: 0, done: 0, applicable: 0, complete: 0, overdue: 0, inprogress: 0, ncr: 0 })

  if (!head) {
    return (
      <div className="page">
        <div className="card empty-state">
          <p><strong>No such order.</strong></p>
          <button className="btn btn-secondary" onClick={() => navigate('/monitoring')}>Back to customers</button>
        </div>
      </div>
    )
  }

  const products = [...new Set(rows.map((r) => r.job.productDesc).filter(Boolean))]

  return (
    <div className="page">
      <Masthead variant="job"
        eyebrow={head.customerName}
        title={poNo}
        sub={<>{rows.length} unit{rows.length === 1 ? '' : 's'} · {products.length === 1 ? products[0] : `${products.length} products`}</>}
        backLabel={`Back to ${head.customerName}`}
        onBack={() => navigate(`/customer/${encodeURIComponent(head.customerName)}`)}
        art={artFor(...products)}
        reading={<Meter done={roll.done} total={roll.applicable} className="mh-meter" />} />

      {role.canManage && order && (
        <div className="po-admin">
          <span>
            Raised by {order.createdBy || 'an admin'}
            {order.revisedAt ? <> · revised {fmtDate(order.revisedAt)}</> : null}
          </span>
          <button className="btn btn-secondary btn-sm"
            onClick={() => navigate(`/monitoring/edit/${encodeURIComponent(order.id)}`)}>
            <IconPen size={14} /> Revise order
          </button>
        </div>
      )}

      <div className="fig-row">
        <Figure value={rows.length} label="Units" />
        <Figure value={roll.complete} label="Finished" tone={roll.complete ? 'done' : undefined} />
        <Figure value={rows.length - roll.complete} label="Still open" tone={rows.length - roll.complete ? 'work' : undefined} />
        <Figure value={roll.overdue} label="Past release date" tone={roll.overdue ? 'late' : undefined} />
        <Figure value={roll.ncr} label="Non-conformances" tone={roll.ncr ? 'late' : undefined} />
      </div>

      <div className="cust-layout">
        <aside className="cust-aside">
          <section className="card brief">
            <h3 className="brief-title">Where the units stand</h3>
            <Ribbon mix={unitMix(roll)} ncr={roll.ncr} className="brief-ribbon" />
            <dl className="brief-facts">
              <div>
                <dt>Target delivery</dt>
                <dd>{dueDate(head) ? fmtDate(dueDate(head)) : 'Not set'}</dd>
              </div>
              <div>
                <dt>Product</dt>
                <dd>{products.length === 1 ? products[0] : `${products.length} products`}</dd>
              </div>
            </dl>
          </section>

          <section className="card brief">
            <h3 className="brief-title">Waiting on</h3>
            <Outstanding rows={waiting} units={rows.length} done={roll.done} applicable={roll.applicable} />
          </section>
        </aside>

        <div className="cust-main">
          <h3 className="section-title">Units ({rows.length})</h3>
          {/* Not the job-order picker, which is a capped box inside a
              card: this is the page. Sixteen units were being clipped to
              eight behind an inner scrollbar under a heading that said
              16. */}
          <UnitList rows={rows} />
        </div>
      </div>
    </div>
  )
}
