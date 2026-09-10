import { DELIVERABLES } from './constants.js'
import { getReports, getOverrides } from './store.js'
import { currentIssues, reportResult } from './verdict.js'
import { downloadCsv, stampToday } from './csv.js'

/* Evaluated when the question is asked, not when the file loaded.

   This was `const TODAY = new Date()` at module scope. An installed PWA
   on a bench tablet is opened on Monday and still open on Thursday: the
   comparison below kept measuring against Monday, so a unit that went
   past its date on Tuesday read as on time until somebody reloaded the
   whole app. Passing it in also makes the boundary testable, which is
   the only way to be sure about a rule that turns on midnight. */
const startOfToday = (now = new Date()) => {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d
}

/* When the unit is due out, and when it actually went.

   These were one field. A job order asked for a "PDI release" date up
   front and then measured lateness against it, which is two different
   things wearing one name: the date somebody promised the customer, and
   the date the pre-delivery inspection was actually signed. The first is
   a plan and belongs on the order; the second is a fact and cannot be
   known until the inspection is approved.

   So an order now carries dateTarget, and the release date is read back
   off the record. The bundled sheet only ever had the one field, and it
   used it as the deadline, so that is what it falls back to. */
export const dueDate = (job) => job?.dateTarget || job?.datePdiRelease || null

// Reject impossible calendar dates instead of allowing Date to roll them
// into another month and invent an overdue deadline.
export function validTarget(job) {
  const value = dueDate(job)
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  const [year, month, day] = value.split('-').map(Number)
  return date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === day ? value : null
}

/* Working days between today and the target date, Saturday and Sunday
   not counted. Shops here work a five-day week, so a target eight
   calendar days out is six days of work, and a person reading a
   register wants the number they can plan against.

   The count runs from the day after today up to and including the
   target: the day a unit is due is still a day someone can work on it.
   A target already past comes back negative, counted the same way, so
   the caller can say how late it is rather than only that it is late.
   Public holidays are not in this app's data and are not guessed at. */
export function workingDaysLeft(target, from = new Date()) {
  if (!target || !/^\d{4}-\d{2}-\d{2}$/.test(target)) return null
  const [y, m, d] = target.split('-').map(Number)
  const end = new Date(y, m - 1, d)
  if (Number.isNaN(end.getTime())) return null
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const late = end < today
  const first = late ? end : today
  const last = late ? today : end
  // Both ends are local midnight, so a daylight-saving change inside the
  // span moves the difference by an hour rather than a day; round.
  const span = Math.round((last - first) / 86400000)
  let days = 0
  for (let i = 1; i <= span; i++) {
    const wd = new Date(first.getFullYear(), first.getMonth(), first.getDate() + i).getDay()
    if (wd !== 0 && wd !== 6) days++
  }
  return late ? -days : days
}

/* The final inspection this shop releases a unit on. PDI is the one the
   order names when it wants it; on a job whose set ends at Pre-Shipment
   that is the same gate under the other name, so it stands in rather
   than leaving the release date blank on a unit that has plainly been
   released. */
const RELEASE_KEYS = ['PDI', 'Pre-Shipment']

export function releasedAt(job, ctx) {
  if (!job || !ctx?.reportIndex) return null
  for (const key of RELEASE_KEYS) {
    if (job.required && !job.required.includes(key)) continue
    const approved = (ctx.reportIndex[`${job.jobNo}|${key}`] || [])
      .filter((r) => r.status === 'approved' && r.approvedAt)
    if (approved.length) {
      return approved.reduce((a, r) => (r.approvedAt > a ? r.approvedAt : a), '').slice(0, 10)
    }
  }
  return null
}

// Status for one job x deliverable cell.
// Layering: admin override > app report (draft=inprogress, submitted=done),
// then Overdue rule: not done + applicable + PDI already released in the past.
// The imported sheet only decides applicability; it cannot make a cell done,
// because done has to mean there is a document to bind.
export function cellStatus(job, delivKey, ctx, now = new Date()) {
  const { overrides, reportIndex } = ctx
  // An order says outright which reports it wants; anything outside that
  // list is not applicable to this job, whatever else is recorded.
  if (job.required && !job.required.includes(delivKey)) return { status: 'na', source: 'order' }
  const ov = overrides[job.jobNo]?.[delivKey]
  if (ov) return { status: ov, source: 'override' }

  /* Approved is done. Submitted is awaiting, which is a document that
     exists and has not been signed — real progress, not finished work.
     A voided report is neither: it stays on the record and stops
     counting, so the deliverable reads by whatever else is there. */
  const reps = (reportIndex[`${job.jobNo}|${delivKey}`] || []).filter((r) => r.status !== 'voided')
  const approved = reps.find((r) => r.status === 'approved')
  if (approved) return { status: 'done', source: 'report', report: approved }
  const submitted = reps.find((r) => r.status === 'submitted')
  if (submitted) return { status: 'awaiting', source: 'report', report: submitted }
  if (reps.length > 0) return { status: 'inprogress', source: 'report', report: reps[0] }

  /* An imported status sheet can say a deliverable was finished, but it
     cannot produce the document. This used to return done on that word
     alone: a job read 8 of 9 complete, its Documents list was empty,
     and clicking one of the eight opened a blank new form — because
     there was nothing to open. A count that cannot be printed into a
     data book is not a count of finished work.

     So done is only what a report makes done, or what an admin has
     deliberately overridden above. The sheet still decides what is not
     applicable, which is a statement about scope rather than about
     evidence. */
  const base = job.deliverables[delivKey]?.status || 'notstarted'
  if (base === 'na') return { status: 'na', source: 'excel' }

  /* Past its date and still not recorded. Compared at the start of the
     day, so a unit due today is not overdue until tomorrow. */
  const due = validTarget(job)
  if (due && new Date(`${due}T00:00:00`) < startOfToday(now)) {
    return { status: 'overdue', source: 'derived' }
  }
  return { status: 'notstarted', source: 'excel' }
}

export function buildContext(reports = getReports()) {
  const reportIndex = {}
  for (const r of reports) {
    const k = `${r.jobNo}|${r.deliverable}`
    if (!reportIndex[k]) reportIndex[k] = []
    reportIndex[k].push(r)
  }
  return { overrides: getOverrides(), reportIndex }
}

export function jobStatuses(job, ctx, now = new Date()) {
  const out = {}
  for (const d of DELIVERABLES) out[d.key] = cellStatus(job, d.key, ctx, now)
  return out
}

/* Two counts, because there are two questions.

   `done` is what a QA lead has approved — the releasable work, and the
   only thing a completion percentage or an MDR should be built on.
   `awaiting` is recorded and unsigned. `recorded` is the two together:
   what the shop has physically inspected, which is the number an
   inspector is measured by and a customer is not. */
export function jobProgress(job, ctx, now = new Date()) {
  const sts = jobStatuses(job, ctx, now)
  let done = 0
  let awaiting = 0
  let applicable = 0
  let overdue = false
  let inprog = false
  for (const k in sts) {
    const s = sts[k].status
    if (s === 'na') continue
    applicable++
    if (s === 'done') done++
    if (s === 'awaiting') awaiting++
    if (s === 'overdue') overdue = true
    if (s === 'inprogress' || s === 'awaiting') inprog = true
  }
  return { done, awaiting, recorded: done + awaiting, applicable, overdue, inprogress: inprog, statuses: sts }
}

export function computeKpis(jobs, ctx) {
  let totalCells = 0
  let doneCells = 0
  let notStartedCells = 0
  let jobsInProgress = 0
  let jobsOverdue = 0
  let jobsComplete = 0
  for (const job of jobs) {
    const p = jobProgress(job, ctx)
    totalCells += p.applicable
    doneCells += p.done
    for (const k in p.statuses) {
      const s = p.statuses[k].status
      if (s === 'notstarted') notStartedCells++
    }
    if (p.overdue) jobsOverdue++
    if (p.applicable > 0 && p.done === p.applicable) jobsComplete++
    else if (p.done > 0 || p.inprogress) jobsInProgress++
  }
  return {
    totalJobs: jobs.length,
    pctComplete: totalCells ? Math.round((doneCells / totalCells) * 100) : 0,
    jobsInProgress,
    jobsOverdue,
    notStarted: notStartedCells,
    jobsComplete,
  }
}

export function filterJobs(jobs, f, ctx) {
  const q = (f.search || '').trim().toLowerCase()
  return jobs.filter((job) => {
    if (f.customers?.length && !f.customers.includes(job.customerName)) return false
    if (f.kategoris?.length && !f.kategoris.includes(job.kategori)) return false
    if (f.types?.length && !f.types.includes(job.type)) return false
    if (f.dateFrom && (!job.datePB || job.datePB < f.dateFrom)) return false
    if (f.dateTo && (!job.datePB || job.datePB > f.dateTo)) return false
    if (q) {
      const hay = `${job.jobNo} ${job.wbsNo} ${job.arasSN} ${job.customerName} ${job.productDesc}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (f.statuses?.length) {
      const sts = jobStatuses(job, ctx)
      const has = Object.values(sts).some((s) => f.statuses.includes(s.status))
      if (!has) return false
    }
    return true
  })
}

export function exportMatrixCsv(jobs, ctx) {
  downloadCsv(`qc-status-matrix-${stampToday()}.csv`, [
    ['Job No', 'WBS No', 'Serial No', 'Category', 'Type', 'Product', 'Customer', 'Date PB',
      'Target delivery', 'PDI released', ...DELIVERABLES.map((d) => d.label)],
    ...jobs.map((job) => {
      const sts = jobStatuses(job, ctx)
      return [job.jobNo, job.wbsNo, job.arasSN, job.kategori, job.type, job.productDesc, job.customerName,
        job.datePB, dueDate(job), releasedAt(job, ctx),
        ...DELIVERABLES.map((d) => sts[d.key].status)]
    }),
  ])
}

export const fmtDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export const fmtDateTime = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// ---- Document stats for the Home dashboard ----
export function docStats() {
  const reps = getReports()
  return {
    total: reps.length,
    draft: reps.filter((r) => r.status === 'draft').length,
    submitted: reps.filter((r) => r.status === 'submitted').length,
    approved: reps.filter((r) => r.status === 'approved').length,
  }
}

// ---- Recent activity feed (derived from report lifecycle) ----
export function recentActivity(limit = 8) {
  return getReports()
    .slice()
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    .slice(0, limit)
    .map((r) => ({
      report: r,
      verb: r.status === 'approved' ? 'approved' : r.status === 'submitted' ? 'submitted' : 'saved as draft',
      at: r.updatedAt,
    }))
}

// ---- NCR / findings list (reports carrying non-conformance notes) ----
/* Reports carrying a non-conformance.

   This used to count a report whose NCR notes box had any text in it,
   alongside the actual verdict. Notes get written and findings get
   closed, and filler in that box turned passing reports into
   non-conformances. The verdict is the fact; reportResult is what the
   rest of the app reads, so this reads it too rather than keeping a
   second opinion.

   And only the current issue of each document, for the same reason the
   register counts it that way: an amendment raised because /01 was
   rejected is not a second finding once /02 is approved and clean. The
   two disagreed - the register tile read two non-conformances and the
   list it links to opened four, two of them already closed out - so a QA
   lead could not get from the figure to the rows behind it. Nothing is
   hidden by narrowing it: the superseded issue is still in the full
   report register, it is just not an open finding. */
export function ncrReports(reports = getReports()) {
  return currentIssues(reports)
    .filter((r) => reportResult(r) === 'Reject')
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
}
