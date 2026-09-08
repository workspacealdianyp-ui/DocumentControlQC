import { useMemo, useState } from 'react'
import { useApp, navigate } from '../App.jsx'
import { buildContext, exportMatrixCsv, jobProgress } from '../lib/status.js'
import { byCustomer, ordersFor } from '../lib/rollup.js'
import { initials, katCode } from '../lib/label.js'
import { SearchField } from './RegisterBar.jsx'
import { IconChevronR, IconDownload, IconPlus } from './Icons.jsx'

/* The register, entered the way the work is sold: customer, then the
   order, then the unit.

   Category tabs used to be the way in — Support Equipment, Trailer, Non
   Trailer — which is how the shop files things, not how anybody is asked
   about them. The question that arrives is "where is Customer 07's
   order" or "where is job 1000300007", and neither of those starts with
   a category.

   One search covers all three levels for the same reason. A document
   controller handed a job number should not have to know whose it is
   before they can look it up, so a query is matched against customers,
   orders and units at once and the answer says which kind it found. */

/* Progress without colour.

   The brief asks for no accent, so the bar is ink on a hairline rather
   than a hue: density reads as "how much of this is done" on its own,
   and it inverts correctly in dark mode without a second palette. */
function Bar({ done, total, className = '' }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <span className={`ink-bar ${className}`} role="img" aria-label={`${pct}% done, ${done} of ${total} reports`}>
      <i style={{ width: `${Math.max(2, pct)}%` }} />
    </span>
  )
}

const Pct = ({ done, total }) => (
  <span className="ink-pct">{total ? Math.round((done / total) * 100) : 0}<i>%</i></span>
)

/* The spine: one fixed-width code cell on the left of every row, at
   every level, so descending the register does not move the column your
   eye is already following. */
const Spine = ({ children }) => <span className="spine">{children}</span>

/* Four slots, always in the same order, blank when the count is zero.

   Letting the counts pack left meant a row with an NCR pushed DONE and
   OPEN out of line with the row above it, so reading a column of them
   made the eye hunt. An empty cell holds the column instead. */
function Counts({ done, open, late, ncr }) {
  return (
    <span className="reg-counts">
      <i>{done > 0 ? <><b>{done}</b>done</> : null}</i>
      <i>{open > 0 ? <><b>{open}</b>open</> : null}</i>
      <i className="is-late">{late > 0 ? <><b>{late}</b>late</> : null}</i>
      <i className="is-late">{ncr > 0 ? <><b>{ncr}</b>NCR</> : null}</i>
    </span>
  )
}

export default function CustomersPage() {
  const { jobs, role, tick } = useApp()
  const ctx = useMemo(() => buildContext(), [tick])
  const [q, setQ] = useState('')

  const customers = useMemo(() => byCustomer(jobs, ctx), [jobs, ctx])

  const found = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return null
    const custs = customers.filter((c) => c.name.toLowerCase().includes(s))
    const orders = []
    for (const c of customers) {
      for (const o of ordersFor(c.name, jobs, ctx)) {
        if (o.poNo.toLowerCase().includes(s)) orders.push({ ...o, customer: c.name })
      }
    }
    const units = jobs.filter((j) =>
      [j.jobNo, j.wbsNo, j.arasSN, j.unitNo, j.productDesc, j.type]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(s)))
    return {
      custs, orders, unitTotal: units.length,
      units: units.slice(0, 40).map((job) => ({ job, p: jobProgress(job, ctx) })),
    }
  }, [q, customers, jobs, ctx])

  const totals = customers.reduce((a, c) => ({
    units: a.units + c.units, open: a.open + c.open, overdue: a.overdue + c.overdue,
  }), { units: 0, open: 0, overdue: 0 })

  return (
    <div className="page">
      <div className="page-bar jobs-page-bar">
        <nav className="mon-tabs" aria-label="How to browse jobs">
          <a className="mon-tab on" aria-current="page" href="#/monitoring">
            Customers<span className="mon-tab-n">{customers.length}</span>
          </a>
          <a className="mon-tab" href="#/monitoring?view=all">
            All jobs<span className="mon-tab-n">{jobs.length}</span>
          </a>
        </nav>
        <div className="mon-head-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => exportMatrixCsv(jobs, ctx)}>
            <IconDownload size={14} /> Export {jobs.length} jobs
          </button>
          {role.canManage && (
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/monitoring/new')}>
              <IconPlus size={14} /> New job order
            </button>
          )}
        </div>
      </div>

      <div className="card reg-card">
        <div className="reg-bar">
          <SearchField value={q} onChange={setQ} label="Search the register"
            placeholder="Customer, PO, job number, WBS, serial…" />
          {!q && (
            <p className="reg-summary">
              {totals.units} units · <b>{totals.open}</b> still open
              {totals.overdue > 0 && <> · <b className="is-late">{totals.overdue}</b> past release</>}
            </p>
          )}
        </div>

        {found ? (
          <Results found={found} q={q} onClear={() => setQ('')} />
        ) : customers.length === 0 ? (
          <div className="reg-empty">
            <p><strong>No work on file.</strong></p>
            <p>Raise a job order and the customer will appear here.</p>
            {role.canManage && (
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/monitoring/new')}>
                <IconPlus size={14} /> New job order
              </button>
            )}
          </div>
        ) : (
          <div className="reg-list">
            {customers.map((c) => (
              <button key={c.name} className="reg-row cust"
                onClick={() => navigate(`/customer/${encodeURIComponent(c.name)}`)}>
                <Spine>{initials(c.name)}</Spine>
                <span className="reg-id">
                  <strong>{c.name}</strong>
                  <small>{c.orders} order{c.orders === 1 ? '' : 's'} · {c.units} unit{c.units === 1 ? '' : 's'}</small>
                </span>
                <Counts done={c.complete} open={c.open} late={c.overdue} ncr={c.ncr} />
                <Bar done={c.done} total={c.applicable} />
                <Pct done={c.done} total={c.applicable} />
                <span className="reg-go" aria-hidden="true"><IconChevronR size={15} /></span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* Results say what kind of thing they are, because the same query can
   legitimately hit all three levels and "1000300007" landing silently on
   a unit is only obvious once you already know the answer. */
function Results({ found, q, onClear }) {
  const nothing = !found.custs.length && !found.orders.length && !found.units.length
  if (nothing) {
    return (
      <div className="reg-empty">
        <p><strong>Nothing matches "{q}".</strong></p>
        <p>Search by customer name, PO number, job number, WBS or serial.</p>
        <button className="btn btn-secondary btn-sm" onClick={onClear}>Clear the search</button>
      </div>
    )
  }
  return (
    <div className="reg-list">
      {found.custs.length > 0 && <p className="reg-kind">Customers</p>}
      {found.custs.map((c) => (
        <button key={c.name} className="reg-row cust"
          onClick={() => navigate(`/customer/${encodeURIComponent(c.name)}`)}>
          <Spine>{initials(c.name)}</Spine>
          <span className="reg-id">
            <strong>{c.name}</strong>
            <small>{c.orders} order{c.orders === 1 ? '' : 's'} · {c.units} unit{c.units === 1 ? '' : 's'}</small>
          </span>
          <Counts done={c.complete} open={c.open} late={c.overdue} ncr={c.ncr} />
          <Bar done={c.done} total={c.applicable} />
          <Pct done={c.done} total={c.applicable} />
          <span className="reg-go" aria-hidden="true"><IconChevronR size={15} /></span>
        </button>
      ))}

      {found.orders.length > 0 && <p className="reg-kind">Orders</p>}
      {found.orders.map((o) => (
        <button key={o.poNo} className="reg-row"
          onClick={() => navigate(`/po/${encodeURIComponent(o.poNo)}`)}>
          <Spine>PO</Spine>
          <span className="reg-id">
            <strong className="is-code">{o.poNo}</strong>
            <small>{o.customer} · {o.units} unit{o.units === 1 ? '' : 's'}</small>
          </span>
          <Counts done={o.complete} open={o.open} late={o.overdue} ncr={o.ncr} />
          <Bar done={o.done} total={o.applicable} />
          <Pct done={o.done} total={o.applicable} />
          <span className="reg-go" aria-hidden="true"><IconChevronR size={15} /></span>
        </button>
      ))}

      {found.units.length > 0 && (
        <p className="reg-kind">
          Units{found.unitTotal > found.units.length ? ` (first ${found.units.length} of ${found.unitTotal})` : ''}
        </p>
      )}
      {found.units.map(({ job: j, p }) => (
        <button key={j.jobNo} className="reg-row" onClick={() => navigate(`/job/${j.jobNo}`)}>
          <Spine>{katCode(j.kategori)}</Spine>
          <span className="reg-id">
            <strong className="is-code">{j.jobNo}</strong>
            <small>{j.customerName}{j.productDesc ? ` · ${j.productDesc}` : ''}{j.wbsNo ? ` · ${j.wbsNo}` : ''}</small>
          </span>
          <span className="reg-counts">
            <i className="wide"><b>{p.done}/{p.applicable}</b>reports</i>
            <i className="is-late">{p.overdue ? <b>late</b> : null}</i>
          </span>
          <Bar done={p.done} total={p.applicable} />
          <Pct done={p.done} total={p.applicable} />
          <span className="reg-go" aria-hidden="true"><IconChevronR size={15} /></span>
        </button>
      ))}
    </div>
  )
}
