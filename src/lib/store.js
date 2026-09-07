import { COMPANY } from './company.js'
import { allJobs } from './jobOrders.js'
import { SEED_REPORTS, SEED_COUNTERS } from '../data/seedReports.js'
// Front-end persistence layer (localStorage). PRD v1 scope = no back-end.
const KEYS = {
  session: 'qc.session',
  reports: 'qc.reports',
  overrides: 'qc.statusOverrides',
  assets: 'qc.assets',
  filters: 'qc.filters',
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}
/* A write that cannot happen must say so.

   localStorage gives us on the order of 9-10 MB and then refuses. This
   used to be an unguarded setItem: an inspector filled in a report, hit
   Submit, and the call threw where nobody was listening — the record was
   simply gone, with the app still showing the form as if all was well.
   Silence is not better: jobOrders.js swallows the same error, so a
   published order can fail to save and look as though it saved.

   So the failure is raised, named, and every caller that holds work a
   person typed has to deal with it. */
export class StorageFullError extends Error {
  constructor(cause) {
    super('There is no room left in this browser to save. Export your records in Settings → Storage, then clear the ones already backed up.')
    this.name = 'StorageFullError'
    this.cause = cause
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (e) {
    throw new StorageFullError(e)
  }
}

// For writes that are a convenience rather than a record — a filter, a
// preference. Losing one is not worth interrupting anybody.
function writeQuietly(key, value) {
  try { return write(key, value) } catch { return false }
}

// ---- Session (login / role) ----
export const getSession = () => read(KEYS.session, null)
/* Quiet on purpose: if the session cannot be written the app simply
   shows the login screen again, which is a state it already handles.
   Throwing here would break the one screen that could explain it. */
export const setSession = (s) => writeQuietly(KEYS.session, s)
export const clearSession = () => localStorage.removeItem(KEYS.session)

// ---- Reports (drafts + submitted inspection forms) ----
// First run installs the demo fixture so the app opens with filled forms
// instead of empty ones. The flag is separate from the reports key, so
// clearing your reports afterwards does not bring the fixture back.
// Where the issue high-water marks live. Declared here because
// ensureSeed below writes it; leaving it further down worked only
// because nothing calls ensureSeed during module initialisation.
const ISSUE_KEY = 'qc.issueCounters'

/* Installing the fixture on a browser that has been here before.

   This used to skip entirely if any reports were stored — the idea being
   not to touch somebody's work. That was right until the job list itself
   was replaced. Then every stored report pointed at a job number that no
   longer existed, the new fixture was never installed because the store
   was not empty, and the app opened showing forty jobs at 0 of 5 with a
   Reports list full of documents that answer "Job not found." when you
   open them.

   So the version bump now does the migration properly. A report whose
   job is gone cannot be opened and cannot be bound into anything: it is
   dropped. Whatever is left is somebody's real work on a job that still
   exists, and it is kept — the fixture is merged in beside it, never
   over it. */
const SEEDED_KEY = 'qc.seeded.v3'
function ensureSeed() {
  try {
    if (localStorage.getItem(SEEDED_KEY)) return
    localStorage.setItem(SEEDED_KEY, '1')

    const held = read(KEYS.reports, [])
    const live = new Set(allJobs().map((j) => String(j.jobNo)))
    const kept = held.filter((r) => r && live.has(String(r.jobNo)))
    const have = new Set(kept.map((r) => r.id))
    write(KEYS.reports, [...kept, ...SEED_REPORTS.filter((r) => !have.has(r.id))])

    // The numbers those reports already spent, so the next issue for a
    // seeded job carries on rather than colliding with one of them.
    // Whichever mark is higher wins; a number that has been on a
    // document is spent either way.
    const counters = { ...read(ISSUE_KEY, {}) }
    for (const [k, n] of Object.entries(SEED_COUNTERS)) {
      counters[k] = Math.max(counters[k] || 0, n)
    }
    write(ISSUE_KEY, counters)
  } catch { /* private mode: run without the fixture */ }
}

export const getReports = () => { ensureSeed(); return read(KEYS.reports, []) }

export function saveReport(report) {
  const all = getReports()
  const i = all.findIndex((r) => r.id === report.id)
  report.updatedAt = new Date().toISOString()
  if (i >= 0) all[i] = report
  else all.push(report)
  write(KEYS.reports, all)
  // Only once the write went through: a number spent on a report that
  // was never stored would leave a gap in the register for no reason.
  claimIssue(report.reportId)
  return report
}

/* An approved report is amended by raising the next issue, never by
   rewriting it.

   An override role could open an approved report and edit it in place:
   same id, same document number, changed content, with approvedBy and
   approvedAt still sitting on it from the version somebody actually
   read. Anyone holding the old printout had no way to know. So an
   amendment becomes its own record that says what it supersedes, and the
   approved issue stays exactly as it was approved.

   The revision starts as a draft, because it has not been approved
   either — and it cannot be approved by whoever raises it. */
export function reviseReport(base, code) {
  const reportId = nextReportId(code, base.jobNo)
  const rev = {
    ...base,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    reportId,
    status: 'draft',
    supersedes: base.reportId,
    supersedesId: base.id,
    revisedFromApprovedAt: base.approvedAt || null,
    createdAt: new Date().toISOString(),
    synced: false,
    values: { ...(base.values || {}), reportId },
  }
  delete rev.approvedBy
  delete rev.approvedAt
  delete rev.updatedAt
  saveReport(rev)
  return rev
}

export function deleteReport(id) {
  write(KEYS.reports, getReports().filter((r) => r.id !== id))
}

/* Lifecycle: draft -> submitted -> approved.

   Approval is a second person saying the record is sound. Nobody can do
   that for their own work, so the one thing this has to refuse is the
   inspector who filled the report approving it — which it did not: the
   name was written down and never compared to anything.

   This is a control, not a security boundary. Without a back end anyone
   can sign in as anyone, so it stops the ordinary mistake of approving
   your own report rather than a determined person. Saying which of the
   two this is matters more than the check itself. */
export class SelfApprovalError extends Error {
  constructor(name) {
    super(`${name} recorded this report, so cannot also approve it. Approval is a second person's judgement.`)
    this.name = 'SelfApprovalError'
  }
}

export const canApprove = (report, byName) =>
  !!report && !!byName && (report.inspector || '').trim().toLowerCase() !== byName.trim().toLowerCase()

export function approveReport(id, byName) {
  const all = getReports()
  const r = all.find((x) => x.id === id)
  if (!r) return null
  if (!canApprove(r, byName)) throw new SelfApprovalError(byName)
  r.status = 'approved'
  r.approvedBy = byName
  r.approvedAt = new Date().toISOString()
  r.updatedAt = r.approvedAt
  write(KEYS.reports, all)
  return r
}

// Simulated sync (front-end only): reports start offline; "sync" marks uploaded.
export function syncReports(ids) {
  const all = getReports()
  const now = new Date().toISOString()
  for (const r of all) {
    if (ids.includes(r.id)) { r.synced = true; r.syncedAt = now }
  }
  write(KEYS.reports, all)
}

export const getReport = (id) => getReports().find((r) => r.id === id)

export function reportsFor(jobNo, deliverable) {
  return getReports().filter(
    (r) => r.jobNo === jobNo && (!deliverable || r.deliverable === deliverable)
  )
}

/* Issue numbers, and why a count is the wrong way to get one.

   This used to be "how many reports exist for this job and form, plus
   one". Delete issue 02 of three and the next report is handed 03 —
   which the third report is already carrying. Two different inspection
   records, one document number, and no way to tell them apart in a data
   book afterwards.

   So the number comes from the highest ever issued, and the high-water
   mark outlives the record: deleting a report frees nothing, because a
   number that has been on a document is spent whether or not the
   document is still here. */
const issueKey = (code, jobNo) => `${code}/${jobNo}`

const readCounters = () => read(ISSUE_KEY, {})

// Highest issue visible on the reports still on file.
function highestLive(code, jobNo) {
  const prefix = `/${code}/${jobNo}/`
  let hi = 0
  for (const r of getReports()) {
    if (!r.reportId || !r.reportId.includes(prefix)) continue
    const m = String(r.reportId).match(/\/(\d+)$/)
    if (m) hi = Math.max(hi, Number(m[1]))
  }
  return hi
}

export function nextIssueNo(code, jobNo) {
  const counters = readCounters()
  return Math.max(counters[issueKey(code, jobNo)] || 0, highestLive(code, jobNo)) + 1
}

/* Pure: asking twice gives the same answer. An abandoned form must not
   burn a number, so the mark is only moved when a report is actually
   written — see saveReport. */
export function nextReportId(code, jobNo) {
  return `${COMPANY.short}/${code}/${jobNo}/${String(nextIssueNo(code, jobNo)).padStart(2, '0')}`
}

// Record that a number has been used, so nothing can be handed it again.
function claimIssue(reportId) {
  const m = String(reportId || '').match(/^[^/]+\/([^/]+)\/([^/]+)\/(\d+)$/)
  if (!m) return
  const [, code, jobNo, num] = m
  const counters = readCounters()
  const k = issueKey(code, jobNo)
  const n = Number(num)
  if ((counters[k] || 0) >= n) return
  counters[k] = n
  try { write(ISSUE_KEY, counters) } catch { /* the report itself matters more; highestLive still covers the common case */ }
}

// ---- Admin status overrides (inline matrix edit) ----
export const getOverrides = () => read(KEYS.overrides, {})
export function setOverride(jobNo, deliverable, status) {
  const o = getOverrides()
  if (!o[jobNo]) o[jobNo] = {}
  if (status === null) delete o[jobNo][deliverable]
  else o[jobNo][deliverable] = status
  write(KEYS.overrides, o)
}

// ---- Asset / instrument register (Settings) ----
import { DEFAULT_ASSETS } from '../data/assets.js'
export const getAssets = () => read(KEYS.assets, DEFAULT_ASSETS)
export const setAssets = (a) => write(KEYS.assets, a)

// ---- Persistent filter state per session (PRD 6) ----
export const getFilters = () => {
  try {
    const raw = sessionStorage.getItem(KEYS.filters)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
export const setFilters = (f) => sessionStorage.setItem(KEYS.filters, JSON.stringify(f))
