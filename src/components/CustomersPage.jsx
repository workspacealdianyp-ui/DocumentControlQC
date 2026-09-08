import { useEffect, useMemo, useState } from 'react'
import { useApp, navigate } from '../App.jsx'
import { buildContext, exportMatrixCsv, fmtDate, jobProgress } from '../lib/status.js'
import { bookTotals, byCustomer, ordersByCustomer, outstandingBy, unitMix } from '../lib/rollup.js'
import { initials, katCode } from '../lib/label.js'
import { SearchField } from './RegisterBar.jsx'
import { Figure, InkBar, Pct, Ribbon } from './Readings.jsx'
import { IconChevronD, IconChevronR, IconDownload, IconPlus } from './Icons.jsx'

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
   orders and units at once and the answer says which kind it found.

   ── What changed, and why ────────────────────────────────────────────
   This page used to be one thin row per customer: a name, four counts
   that were usually blank because a slot was held open for a figure of
   zero, and a bar. Three customers left two thirds of a desktop screen
   empty under it, and none of what was there told anybody what to do
   next — a percentage says how much is left, never what it is.

   So each customer is now a panel rather than a line, and it carries
   three things a thin row could not:

   - the mix of unit states as one ribbon, because 64% is the same
     number whether eight units are half-inspected or six are finished
     and two have never been touched;
   - the customer's purchase orders, in place, so the second level of the
     register does not cost a page load;
   - what the work is waiting on, named by document type, which is the
     line somebody can actually act on.

   The band above the list does the same job for the whole book of work,
   and every figure in it opens the list it counts. */

const OPEN_KEY = 'qc.jobs.reg.open.v1'
// Orders sit open by default while the register is short enough that
// nothing is pushed off the screen by it. Past that, a customer's orders
// are one click away and the list stays scannable.
const AUTO_OPEN_UPTO = 6
const ORDERS_SHOWN = 3

/* How many document types the waiting line names before it starts
   counting instead.

   Three chips and a label fit one line on a desktop. On a phone they did
   not: the line wrapped to two or three rows, every panel grew by the
   height of the rows it wrapped, and the customer under it was pushed
   off the screen by a summary. So the cap is what the width can hold on
   one line, the rest is a count, and the count opens the rest in place
   for anybody who wants it. */
const WAIT_CAPS = [['(max-width: 460px)', 1], ['(max-width: 720px)', 2]]
const WAIT_CAP_WIDE = 3

const waitCap = () => {
  for (const [q, n] of WAIT_CAPS) if (window.matchMedia?.(q).matches) return n
  return WAIT_CAP_WIDE
}

/* One set of listeners for the page rather than one per customer panel:
   the answer is the same for every card on the screen. */
function useWaitCap() {
  const [cap, setCap] = useState(waitCap)
  useEffect(() => {
    const mqs = WAIT_CAPS.map(([q]) => window.matchMedia?.(q)).filter(Boolean)
    const read = () => setCap(waitCap())
    read()
    mqs.forEach((m) => m.addEventListener('change', read))
    return () => mqs.forEach((m) => m.removeEventListener('change', read))
  }, [])
  return cap
}

/* The status filter on the All-jobs list, as a link — but only when
   there is something behind it. A figure of zero that opens an empty
   list is a dead end dressed as an answer, so a zero stays a statement
   and does not offer the click. */
const listHref = (n, states) =>
  (n > 0 ? `#/monitoring?view=all${states ? `&state=${states}` : ''}` : undefined)

const readOpen = () => {
  try {
    const raw = sessionStorage.getItem(OPEN_KEY)
    return raw ? new Set(JSON.parse(raw)) : null
  } catch { return null }
}

/* The spine: one fixed-width code cell on the left of every row, at
   every level, so descending the register does not move the column your
   eye is already following. */
const Spine = ({ children }) => <span className="spine">{children}</span>

/* A customer, as a panel.

   The head is the link to their page and carries the identity and the
   reading; everything under it is the detail that used to require
   opening that page to see. */
function CustomerCard({ c, orders, waiting, waitCap: cap, open, onToggle }) {
  const href = `#/customer/${encodeURIComponent(c.name)}`
  const shown = open ? orders : orders.slice(0, ORDERS_SHOWN)
  const hidden = orders.length - shown.length
  const [allWait, setAllWait] = useState(false)
  const waitShown = allWait ? waiting : waiting.slice(0, cap)
  const waitRest = waiting.length - waitShown.length
  return (
    <section className="reg-cust">
      <a className="reg-cust-head" href={href}>
        <Spine>{initials(c.name)}</Spine>
        <span className="reg-id">
          <strong>{c.name}</strong>
          <small>
            {c.orders} order{c.orders === 1 ? '' : 's'} · {c.units} unit{c.units === 1 ? '' : 's'}
            {c.nextRelease ? ` · next release ${fmtDate(c.nextRelease)}` : ''}
          </small>
        </span>
        <span className="reg-cust-read">
          <b>{c.applicable ? Math.round((c.done / c.applicable) * 100) : 0}<i>%</i></b>
          <small>{c.done} of {c.applicable} reports</small>
        </span>
        <span className="reg-go" aria-hidden="true"><IconChevronR size={15} /></span>
      </a>

      <Ribbon mix={unitMix(c)} ncr={c.ncr} className="reg-cust-ribbon" />

      {orders.length > 0 && (
        <div className="reg-cust-orders">
          {shown.map((o) => (
            <a key={o.poNo} className="ord-row" href={`#/po/${encodeURIComponent(o.poNo)}`}>
              <Spine>PO</Spine>
              <span className="reg-id">
                <strong className="is-code">{o.poNo}</strong>
                <small>
                  {o.mixed ? 'Mixed products' : o.product || 'No product recorded'}
                  {' · '}{o.units} unit{o.units === 1 ? '' : 's'}
                  {o.complete ? ` · ${o.complete} finished` : ''}
                  {o.overdue ? ` · ${o.overdue} past release` : ''}
                </small>
              </span>
              <InkBar done={o.done} total={o.applicable} className="ord-bar" />
              <Pct done={o.done} total={o.applicable} />
              <span className="reg-go" aria-hidden="true"><IconChevronR size={14} /></span>
            </a>
          ))}
          {(hidden > 0 || open) && orders.length > ORDERS_SHOWN && (
            <button type="button" className="reg-cust-more" onClick={onToggle} aria-expanded={open}>
              <IconChevronD size={13} className={open ? 'is-open' : undefined} />
              {open ? 'Show fewer orders' : `Show ${hidden} more order${hidden === 1 ? '' : 's'}`}
            </button>
          )}
        </div>
      )}

      {/* The one-line rule is for the chips only: the sentence that stands
          in for them when nothing is outstanding has to be able to wrap. */}
      <p className={`reg-cust-wait${waiting.length > 0 && !allWait ? ' is-one-line' : ''}`}>
        {waiting.length === 0
          ? c.applicable === 0
            ? <><b>No reports required.</b> None of this customer&rsquo;s units asks for one.</>
            : <><b>All reports complete.</b> Nothing outstanding on this customer&rsquo;s work.</>
          : (
            <>
              <span className="wait-label">Waiting on</span>
              {waitShown.map((w) => (
                <span key={w.key} className={`wait-chip${w.late ? ' is-late' : ''}`}>
                  <span>{w.label}</span><b>{w.units}</b>
                </span>
              ))}
              {waiting.length > cap && (
                <button type="button" className="wait-rest" aria-expanded={allWait}
                  onClick={() => setAllWait((v) => !v)}>
                  {allWait ? 'Show fewer' : `+${waitRest} more`}
                </button>
              )}
            </>
          )}
      </p>
    </section>
  )
}

export default function CustomersPage() {
  const { jobs, role, tick } = useApp()
  const ctx = useMemo(() => buildContext(), [tick])
  const [q, setQ] = useState('')

  const cap = useWaitCap()

  const customers = useMemo(() => byCustomer(jobs, ctx), [jobs, ctx])
  const orders = useMemo(() => ordersByCustomer(jobs, ctx), [jobs, ctx])
  const totals = useMemo(() => bookTotals(customers), [customers])

  // One pass per customer for what they owe, rather than one per card
  // render — outstandingBy walks every deliverable of every unit.
  const waiting = useMemo(() => {
    const byName = new Map()
    for (const job of jobs) {
      const name = job.customerName || 'Unassigned'
      if (!byName.has(name)) byName.set(name, [])
      byName.get(name).push(job)
    }
    const out = new Map()
    for (const [name, list] of byName) out.set(name, outstandingBy(list, ctx))
    return out
  }, [jobs, ctx])

  const [open, setOpen] = useState(
    () => readOpen() || new Set(customers.length <= AUTO_OPEN_UPTO ? customers.map((c) => c.name) : []))

  useEffect(() => {
    try { sessionStorage.setItem(OPEN_KEY, JSON.stringify([...open])) }
    catch { /* Private browsing may refuse storage; the register still works in memory. */ }
  }, [open])

  const toggle = (name) => setOpen((s) => {
    const n = new Set(s)
    n.has(name) ? n.delete(name) : n.add(name)
    return n
  })

  const found = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return null
    const custs = customers.filter((c) => c.name.toLowerCase().includes(s))
    const hits = []
    for (const [name, list] of orders) {
      for (const o of list) if (o.poNo.toLowerCase().includes(s)) hits.push({ ...o, customer: name })
    }
    const units = jobs.filter((j) =>
      [j.jobNo, j.wbsNo, j.arasSN, j.unitNo, j.productDesc, j.type]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(s)))
    return {
      custs, orders: hits, unitTotal: units.length,
      units: units.slice(0, 40).map((job) => ({ job, p: jobProgress(job, ctx) })),
    }
  }, [q, customers, orders, jobs, ctx])

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

      {/* The whole book of work, and a way into each part of it. Counted
          from the record — there is no figure here the register cannot
          show you the rows behind. */}
      {customers.length > 0 && (
        <div className="fig-row book-figs">
          <Figure value={totals.units} label="Units on the books" href={listHref(totals.units)}
            sub={`${totals.customers} customer${totals.customers === 1 ? '' : 's'} · ${totals.orders} order${totals.orders === 1 ? '' : 's'}`} />
          <Figure value={totals.complete} label="Finished" tone={totals.complete ? 'done' : undefined}
            href={listHref(totals.complete, 'done')} sub="every report signed off" />
          <Figure value={totals.inprogress} label="In progress" tone={totals.inprogress ? 'work' : undefined}
            href={listHref(totals.inprogress, 'inprogress')} sub="something recorded, not finished" />
          <Figure value={totals.notstarted} label="Not started" href={listHref(totals.notstarted, 'notstarted')}
            sub="no report on file yet" />
          <Figure value={totals.overdue} label="Past release date" tone={totals.overdue ? 'late' : undefined}
            href={listHref(totals.overdue, 'overdue')} sub="release date already gone" />
          <Figure value={totals.ncr} label="Non-conformances" tone={totals.ncr ? 'late' : undefined}
            href={totals.ncr > 0 ? '#/reports?f=ncr' : undefined} sub="reports with a Reject verdict" />
        </div>
      )}

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
          <div className="reg-custs">
            {customers.map((c) => (
              <CustomerCard key={c.name} c={c}
                orders={orders.get(c.name) || []}
                waiting={waiting.get(c.name) || []}
                waitCap={cap}
                open={open.has(c.name)}
                onToggle={() => toggle(c.name)} />
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
          <InkBar done={c.done} total={c.applicable} />
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
          <InkBar done={o.done} total={o.applicable} />
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
          <InkBar done={p.done} total={p.applicable} />
          <Pct done={p.done} total={p.applicable} />
          <span className="reg-go" aria-hidden="true"><IconChevronR size={15} /></span>
        </button>
      ))}
    </div>
  )
}

/* Four slots, always in the same order, blank when the count is zero.

   Letting the counts pack left meant a row with an NCR pushed DONE and
   OPEN out of line with the row above it, so reading a column of them
   made the eye hunt. An empty cell holds the column instead. This is the
   search result's row, where rows of three different kinds have to line
   up with each other; the customer panels above use a ribbon, which
   cannot leave a hole. */
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
