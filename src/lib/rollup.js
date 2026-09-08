import { DELIVERABLES } from './constants.js'
import { jobProgress } from './status.js'
import { getReports } from './store.js'
import { reportResult } from './verdict.js'

/* What a customer's work actually amounts to, and what one of their
   purchase orders amounts to.

   Every figure here is counted from the record. The home page used to
   show a customer card carrying an on-time percentage, an NCR count, a
   Gold/Silver/Bronze tier, a "customer since" year and a six-point trend
   line, all produced by a seeded random number generator — the comment
   above it said so outright: "real data is thin, fabricate". A QC system
   that invents 84% on-time is doing the same thing as one that draws a
   signature nobody made.

   So the thin ones are gone rather than dressed up. What is left is
   fewer numbers that are all true: orders, units, how many of the
   reports those units need are done, how many units are finished, how
   many are past their release date, and how many carry a
   non-conformance. */

const pct = (done, total) => (total ? Math.round((done / total) * 100) : 0)

/* A non-conformance is a report whose verdict is Reject.

   Counting "the NCR notes box has text in it" as well looks generous and
   is wrong twice over: notes can be written and then the finding closed,
   and any filler in that box turns a passing report into a
   non-conformance — which is exactly what happened here, 27 clean
   reports carrying "No outstanding items." in the NCR field.

   reportResult is also what the badges on the job page use, so the count
   and the badge cannot disagree. */
const isNcr = (r) => reportResult(r) === 'Reject'

/* Only the current issue of each document counts. An amendment that was
   raised because /01 was rejected should not leave the unit reading as
   non-conforming once /02 is approved and clean. */
const issueNo = (id = '') => { const m = String(id).match(/\/(\d+)$/); return m ? Number(m[1]) : 0 }
function currentIssues(reports) {
  const byDoc = new Map()
  for (const r of reports) {
    const k = `${r.jobNo}::${r.formKey}::${r.deliverable}`
    const held = byDoc.get(k)
    if (!held || issueNo(r.reportId) > issueNo(held.reportId)) byDoc.set(k, r)
  }
  return [...byDoc.values()]
}

function blank() {
  return { units: 0, complete: 0, overdue: 0, inprogress: 0, done: 0, applicable: 0, ncr: 0,
           lastAt: '', nextRelease: '' }
}

function fold(acc, job, ctx, reportsByJob) {
  const p = jobProgress(job, ctx)
  acc.units++
  acc.done += p.done
  acc.applicable += p.applicable
  const finished = !!p.applicable && p.done === p.applicable
  if (finished) acc.complete++
  if (p.overdue) acc.overdue++
  else if (p.inprogress || (p.done && p.done < p.applicable)) acc.inprogress++
  /* The date somebody is working towards is the earliest one still owed.
     A finished unit's release date has already been met, so including it
     would make a customer read as due sooner than they are. */
  if (!finished && job.datePdiRelease && (!acc.nextRelease || job.datePdiRelease < acc.nextRelease)) {
    acc.nextRelease = job.datePdiRelease
  }
  for (const r of currentIssues(reportsByJob.get(String(job.jobNo)) || [])) {
    if (isNcr(r)) acc.ncr++
    if ((r.updatedAt || '') > acc.lastAt) acc.lastAt = r.updatedAt || ''
  }
  return acc
}

const indexReports = () => {
  const m = new Map()
  for (const r of getReports()) {
    const k = String(r.jobNo)
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(r)
  }
  return m
}

/* One row per customer, ordered by the work in front of them: whoever
   has the most unfinished units first, because that is the reason to
   open this page at all. A finished customer is not the urgent one. */
export function byCustomer(jobs, ctx) {
  const reportsByJob = indexReports()
  const m = new Map()
  for (const job of jobs) {
    const name = job.customerName || 'Unassigned'
    if (!m.has(name)) m.set(name, { name, orders: new Set(), ...blank() })
    const c = m.get(name)
    if (job.poNo) c.orders.add(job.poNo)
    fold(c, job, ctx, reportsByJob)
  }
  return [...m.values()]
    .map((c) => ({ ...c, orders: c.orders.size, pct: pct(c.done, c.applicable), open: c.units - c.complete }))
    .sort((a, b) => b.open - a.open || b.units - a.units || a.name.localeCompare(b.name))
}

/* The orders a set of units belongs to, newest release date first.

   The report index is passed in rather than read here: the register
   draws every customer's orders on one screen, and re-reading and
   re-parsing the whole report store once per customer is how that page
   got slow enough to notice. */
function foldOrders(jobs, ctx, reportsByJob) {
  const m = new Map()
  for (const job of jobs) {
    const po = job.poNo || 'No PO'
    if (!m.has(po)) {
      m.set(po, { poNo: po, kategori: job.kategori, product: job.productDesc,
                  datePB: job.datePB, datePdiRelease: job.datePdiRelease, ...blank() })
    }
    const o = m.get(po)
    // An order can carry more than one product; say so rather than
    // showing whichever unit happened to be first.
    if (o.product && job.productDesc && o.product !== job.productDesc) o.mixed = true
    fold(o, job, ctx, reportsByJob)
  }
  return [...m.values()]
    .map((o) => ({ ...o, pct: pct(o.done, o.applicable), open: o.units - o.complete }))
    .sort((a, b) => (b.datePdiRelease || '').localeCompare(a.datePdiRelease || '') || a.poNo.localeCompare(b.poNo))
}

const nameOf = (job) => job.customerName || 'Unassigned'

// The orders one customer has placed, newest release date first.
export function ordersFor(customer, jobs, ctx) {
  return foldOrders(jobs.filter((j) => nameOf(j) === customer), ctx, indexReports())
}

// Every customer's orders in one pass, keyed by customer name — what the
// register needs to show a customer's orders without leaving the page.
export function ordersByCustomer(jobs, ctx) {
  const reportsByJob = indexReports()
  const grouped = new Map()
  for (const job of jobs) {
    const name = nameOf(job)
    if (!grouped.has(name)) grouped.set(name, [])
    grouped.get(name).push(job)
  }
  const out = new Map()
  for (const [name, list] of grouped) out.set(name, foldOrders(list, ctx, reportsByJob))
  return out
}

/* Needs-attention first, then unfinished, then the rest.

   "Unfinished first" was the rule and it read past the one case it
   exists for: a unit whose reports are all signed but whose verdict
   carries a non-conformance is finished by the count and is the first
   thing anybody wants to see. It sat among the finished ones, forty rows
   down. A unit past its release date is already unfinished, so it comes
   along with the same rank. */
const attentionRank = (r) => (r.overdue || r.ncr > 0 ? 0 : r.complete ? 2 : 1)

function foldUnits(jobs, ctx, reportsByJob) {
  return jobs
    .map((job) => {
      const p = jobProgress(job, ctx)
      const mine = currentIssues(reportsByJob.get(String(job.jobNo)) || [])
      return {
        job,
        done: p.done, applicable: p.applicable, pct: pct(p.done, p.applicable),
        overdue: p.overdue,
        complete: !!p.applicable && p.done === p.applicable,
        ncr: mine.filter(isNcr).length,
        lastAt: mine.reduce((a, r) => ((r.updatedAt || '') > a ? r.updatedAt : a), ''),
      }
    })
    .sort((a, b) => attentionRank(a) - attentionRank(b) || a.pct - b.pct
      || String(a.job.jobNo).localeCompare(String(b.job.jobNo)))
}

// The units on one order.
export function unitsFor(poNo, jobs, ctx) {
  return foldUnits(jobs.filter((j) => (j.poNo || 'No PO') === poNo), ctx, indexReports())
}

/* Every unit a customer has on the books, across all of their orders.
   The order page cannot answer "which of this customer's units is
   behind" when the answer spans two purchase orders. */
export function unitsForCustomer(customer, jobs, ctx) {
  return foldUnits(jobs.filter((j) => nameOf(j) === customer), ctx, indexReports())
}

/* The mix of unit states behind a customer or an order roll-up.

   fold counts finished, past-release and in-progress; whatever is left
   has had nothing recorded against it. Deriving the fourth here keeps
   the four adding up to the unit count, which is what lets them be drawn
   as one bar. */
export const unitMix = (r) => ({
  units: r.units,
  complete: r.complete,
  overdue: r.overdue,
  inprogress: r.inprogress,
  notstarted: Math.max(0, r.units - r.complete - r.overdue - r.inprogress),
})

/* Which document type is holding the work up.

   "64% done" says how much is left but not what it is. This counts, for
   each of the nine deliverables, how many units still owe it — the fact
   a QC lead actually acts on, because it names the inspection to
   schedule next. Deliverables an order does not require are not owed by
   anybody and never appear. */
export function outstandingBy(jobs, ctx) {
  const m = new Map()
  for (const job of jobs) {
    const { statuses } = jobProgress(job, ctx)
    for (const d of DELIVERABLES) {
      const s = statuses[d.key]?.status
      if (!s || s === 'na' || s === 'done') continue
      if (!m.has(d.key)) m.set(d.key, { key: d.key, label: d.label, units: 0, late: 0 })
      const c = m.get(d.key)
      c.units++
      if (s === 'overdue') c.late++
    }
  }
  return [...m.values()].sort((a, b) => b.units - a.units || b.late - a.late || a.label.localeCompare(b.label))
}

/* The whole book of work, summed from the customer roll-up rather than
   walked a second time. */
export function bookTotals(customers) {
  const t = customers.reduce((a, c) => ({
    customers: a.customers + 1,
    orders: a.orders + c.orders,
    units: a.units + c.units,
    complete: a.complete + c.complete,
    overdue: a.overdue + c.overdue,
    inprogress: a.inprogress + c.inprogress,
    done: a.done + c.done,
    applicable: a.applicable + c.applicable,
    ncr: a.ncr + c.ncr,
  }), { customers: 0, orders: 0, units: 0, complete: 0, overdue: 0, inprogress: 0, done: 0, applicable: 0, ncr: 0 })
  return { ...t, ...unitMix(t), open: t.units - t.complete, pct: pct(t.done, t.applicable) }
}

export const customerOf = (name, jobs, ctx) => byCustomer(jobs, ctx).find((c) => c.name === name) || null
