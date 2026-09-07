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
  return { units: 0, complete: 0, overdue: 0, inprogress: 0, done: 0, applicable: 0, ncr: 0, lastAt: '' }
}

function fold(acc, job, ctx, reportsByJob) {
  const p = jobProgress(job, ctx)
  acc.units++
  acc.done += p.done
  acc.applicable += p.applicable
  if (p.applicable && p.done === p.applicable) acc.complete++
  if (p.overdue) acc.overdue++
  else if (p.inprogress || (p.done && p.done < p.applicable)) acc.inprogress++
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

// The orders one customer has placed, newest release date first.
export function ordersFor(customer, jobs, ctx) {
  const reportsByJob = indexReports()
  const m = new Map()
  for (const job of jobs) {
    if ((job.customerName || 'Unassigned') !== customer) continue
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

// The units on one order, unfinished first — the ones needing attention
// are the reason somebody opened the order.
export function unitsFor(poNo, jobs, ctx) {
  const reportsByJob = indexReports()
  return jobs
    .filter((j) => (j.poNo || 'No PO') === poNo)
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
    .sort((a, b) => Number(a.complete) - Number(b.complete) || a.pct - b.pct || String(a.job.jobNo).localeCompare(String(b.job.jobNo)))
}

export const customerOf = (name, jobs, ctx) => byCustomer(jobs, ctx).find((c) => c.name === name) || null
