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

/* Installing the fixture, and surviving a job list that changed under it.

   This used to skip entirely if any reports were stored — the idea being
   not to touch somebody's work. That was right until the job list itself
   was replaced. Then every stored report pointed at a job number that no
   longer existed, the new fixture was never installed because the store
   was not empty, and the app opened showing forty jobs at 0 of 5 with a
   Reports list full of documents that answer "Job not found." when you
   open them.

   The first fix dropped those reports. That was the wrong half of the
   problem to solve: an inspection report is the evidence that an
   inspection happened, and an update to the app is not a reason to
   destroy one. A job number can come back — an order is re-published, a
   backup is restored, a unit is renumbered — and a record deleted on
   Tuesday cannot.

   So nothing is deleted. A report whose job is gone is marked orphaned
   and kept out of the registers, where it would only offer to open a
   job that is not there. Settings lists them, an admin can reattach one
   to a job, and export carries them like any other record. Before any
   of this touches the store it takes a snapshot of what was there. */
const SEEDED_KEY = 'qc.seeded.v3'
const VERSION_KEY = 'qc.storeVersion'
const MIGRATION_KEY = 'qc.migrations'
const SNAPSHOT_KEY = 'qc.snapshot'
const STORE_VERSION = 4

/* Marks, never removes. Returns the same list with a flag on the
   records that have nothing to point at, and a count of them.

   Exported because it is the piece worth testing on its own: the bug it
   replaces was one `.filter()`. */
export function markOrphans(reports, liveJobNos, at = new Date().toISOString()) {
  const live = liveJobNos instanceof Set ? liveJobNos : new Set([...liveJobNos].map(String))
  let orphaned = 0
  let adopted = 0
  const out = reports.filter(Boolean).map((r) => {
    const has = live.has(String(r.jobNo))
    if (!has && !r.orphaned) { orphaned++; return { ...r, orphaned: true, orphanedAt: at } }
    // A job that came back takes its reports with it.
    if (has && r.orphaned) {
      adopted++
      const { orphaned: _was, orphanedAt: _when, ...rest } = r
      return rest
    }
    return r
  })
  return { reports: out, orphaned, adopted }
}

// What the store looked like before a migration ran. Best-effort: if
// there is no room for a copy the migration still goes ahead, because
// refusing to start the app is worse than starting it without a spare.
function snapshot(label) {
  try {
    const body = JSON.stringify({
      at: new Date().toISOString(), label,
      data: { [KEYS.reports]: localStorage.getItem(KEYS.reports) },
    })
    localStorage.setItem(SNAPSHOT_KEY, body)
    return true
  } catch { return false }
}

function logMigration(entry) {
  try {
    const log = read(MIGRATION_KEY, [])
    localStorage.setItem(MIGRATION_KEY, JSON.stringify([...log, entry].slice(-20)))
  } catch { /* the log is not worth failing a migration for */ }
}

/* Both of these describe the store, so they bring it up to date first.
   Reading them before anything has read a report would otherwise answer
   "no migration has run" when one is simply still pending. */
export const migrationLog = () => { ensureSeed(); return read(MIGRATION_KEY, []) }
export const lastSnapshot = () => { ensureSeed(); return read(SNAPSHOT_KEY, null) }

function ensureSeed() {
  try {
    const version = Number(read(VERSION_KEY, 0)) || 0
    const seeded = !!localStorage.getItem(SEEDED_KEY)
    if (seeded && version >= STORE_VERSION) return

    const held = read(KEYS.reports, [])
    if (held.length) snapshot(`v${version} → v${STORE_VERSION}`)

    // The fixture goes in beside held work, never over it, and only once.
    let all = held
    if (!seeded) {
      localStorage.setItem(SEEDED_KEY, '1')
      const have = new Set(held.map((r) => r.id))
      all = [...held, ...SEED_REPORTS.filter((r) => !have.has(r.id))]

      /* The numbers those reports already spent, so the next issue for a
         seeded job carries on rather than colliding with one of them.
         Whichever mark is higher wins; a number that has been on a
         document is spent either way. */
      const counters = { ...read(ISSUE_KEY, {}) }
      for (const [k, n] of Object.entries(SEED_COUNTERS)) {
        counters[k] = Math.max(counters[k] || 0, n)
      }
      write(ISSUE_KEY, counters)
    }

    const live = new Set(allJobs().map((j) => String(j.jobNo)))
    const { reports, orphaned, adopted } = markOrphans(all, live)
    write(KEYS.reports, reports)
    localStorage.setItem(VERSION_KEY, String(STORE_VERSION))
    logMigration({ at: new Date().toISOString(), from: version, to: STORE_VERSION,
                   held: held.length, kept: reports.length, orphaned, adopted })
  } catch { /* private mode: run without the fixture */ }
}

/* Everything the store holds, orphans included. Backup uses the raw key
   and so keeps them too; this is for the screens that exist to show
   them. */
export const getAllReports = () => { ensureSeed(); return read(KEYS.reports, []) }

export const orphanedReports = () => getAllReports().filter((r) => r.orphaned)

/* Reattaching an orphan to a job that exists.

   The report keeps its number, its readings, its photographs and its
   signatures — the only thing that changes is which job it belongs to,
   and that change is written into the record so the move is visible
   later. */
export class UnknownJobError extends Error {
  constructor(jobNo) {
    super(`There is no job ${jobNo} to attach this report to.`)
    this.name = 'UnknownJobError'
  }
}

export function adoptReport(id, jobNo, byName) {
  const live = new Set(allJobs().map((j) => String(j.jobNo)))
  if (!live.has(String(jobNo))) throw new UnknownJobError(jobNo)
  const all = getAllReports()
  const r = all.find((x) => x.id === id)
  if (!r) return null
  const at = new Date().toISOString()
  r.movedFrom = [...(r.movedFrom || []), { from: r.jobNo, at, by: byName || 'unknown' }]
  r.jobNo = String(jobNo)
  if (r.values) r.values = { ...r.values, jobNo: String(jobNo) }
  delete r.orphaned
  delete r.orphanedAt
  r.updatedAt = at
  write(KEYS.reports, all)
  return r
}

/* The reports the app works with: everything that still belongs to a
   job. An orphan is not gone, it is out of the way — listing it in a
   register would only offer to open a job that is not there. */
export const getReports = () => getAllReports().filter((r) => !r.orphaned)

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

/* What may be done to a report, and what may not.

   Deletion used to be one action available to anyone who could manage,
   on any report, at any point in its life. An approved inspection report
   is the evidence that an inspection happened — it is bound into a data
   book, it is what a customer is shown, and in this app it is the only
   copy. Offering a bin next to it is offering to destroy the record.

   So the action depends on where the report stands:

   draft      delete      nothing has been claimed by it yet
   returned   delete      the same draft, sent back
   submitted  withdraw    it goes back to draft; the claim is retracted
   approved   void        it stays, marked, and stops counting
   voided     nothing     already withdrawn from the record

   Void is the one that matters. A signed document that turns out to be
   wrong is not removed from a controlled set; it is marked void, the
   reason is recorded, and a new issue supersedes it. That is what
   reviseReport already does for the replacement half — this is the
   other half.

   A reason is required on both of the ones a person will be asked about
   later. */
export const REPORT_ACTIONS = {
  draft: 'delete',
  returned: 'delete',
  new: 'delete',
  submitted: 'withdraw',
  approved: 'void',
  voided: null,
}

export const actionFor = (report) => (report ? REPORT_ACTIONS[report.status] ?? null : null)

export class ProtectedRecordError extends Error {
  constructor(report, wanted) {
    const can = actionFor(report)
    super(can
      ? `${report.reportId} is ${report.status}, so it cannot be ${wanted}. It can be ${can === 'void' ? 'voided' : can + 'n'}.`
      : `${report.reportId} is ${report.status}. Nothing further can be done to it.`)
    this.name = 'ProtectedRecordError'
  }
}

export class ReasonRequiredError extends Error {
  constructor(what) {
    super(`Say why this report is being ${what}. The reason is kept on the record.`)
    this.name = 'ReasonRequiredError'
  }
}

// An entry on the report's own history. Nothing here is ever rewritten.
const audit = (r, event, by, note, extra = {}) => {
  const at = new Date().toISOString()
  r.audit = [...(r.audit || []), { event, by: by || 'unknown', at, note: note || '', from: r.status, ...extra }]
  return at
}

/* Only a draft goes. Anything that has been submitted has been claimed
   by somebody, and anything approved has been relied on. */
export function deleteReport(id, byName, note) {
  const all = getAllReports()
  const r = all.find((x) => x.id === id)
  if (!r) return null
  if (actionFor(r) !== 'delete') throw new ProtectedRecordError(r, 'deleted')
  write(KEYS.reports, all.filter((x) => x.id !== id))
  // The number stays spent: see nextIssueNo. A deleted draft does not
  // hand its report number to the next one.
  logMigration({ at: new Date().toISOString(), event: 'delete', reportId: r.reportId,
                 by: byName || 'unknown', note: String(note || '').trim() })
  return r
}

/* Taking a submitted report back off the reviewer's desk. It becomes a
   draft again, with the fact that it was submitted and pulled kept. */
export function withdrawReport(id, byName, note) {
  const all = getAllReports()
  const r = all.find((x) => x.id === id)
  if (!r) return null
  if (actionFor(r) !== 'withdraw') throw new ProtectedRecordError(r, 'withdrawn')
  const reason = String(note || '').trim()
  if (!reason) throw new ReasonRequiredError('withdrawn')
  const at = audit(r, 'withdrawn', byName, reason)
  r.status = 'draft'
  r.updatedAt = at
  write(KEYS.reports, all)
  return r
}

/* Voiding an approved report.

   It is not deleted and it is not edited. It keeps its number, its
   readings and its signatures, and gains a mark that takes it out of
   every count of finished work. The replacement is a new issue, which
   reviseReport makes; `supersededBy` is filled in by whoever raises it.

   Only somebody who can override may do this, and never on their own
   work — the same second-person rule that governs approval, for the
   same reason. */
export function voidReport(id, byName, note) {
  const all = getAllReports()
  const r = all.find((x) => x.id === id)
  if (!r) return null
  if (actionFor(r) !== 'void') throw new ProtectedRecordError(r, 'voided')
  if (!canApprove(r, byName)) throw new SelfApprovalError(byName, 'void it')
  const reason = String(note || '').trim()
  if (!reason) throw new ReasonRequiredError('voided')
  const at = audit(r, 'voided', byName, reason)
  r.status = 'voided'
  r.voidedBy = byName
  r.voidedAt = at
  r.voidReason = reason
  r.updatedAt = at
  write(KEYS.reports, all)
  return r
}

export const reportAudit = (report) => [...(report?.audit || [])]

/* Lifecycle: draft -> submitted -> approved, and submitted -> returned
   -> submitted for the half that was missing.

   Review is a second person saying the record is sound. Nobody can do
   that for their own work, so the one thing this has to refuse is the
   inspector who filled the report reviewing it — which it did not: the
   name was written down and never compared to anything.

   This is a control, not a security boundary. Without a back end anyone
   can sign in as anyone, so it stops the ordinary mistake of approving
   your own report rather than a determined person. Saying which of the
   two this is matters more than the check itself. */
const secondPerson = (name, act) =>
  `${name} recorded this report, so cannot also ${act}. That call belongs to a second person.`

export class SelfApprovalError extends Error {
  constructor(name, act = 'approve it') {
    super(secondPerson(name, act))
    this.name = 'SelfApprovalError'
  }
}

// The same rule decides both ends of a review: whoever may approve a
// report may send it back, and neither on their own work.
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

/* Sending a submitted report back.

   Approval was the only judgement this app could record: a report was
   either approved or it sat in the waiting lane forever. A reviewer who
   found a gap had nothing to press — the deliverable kept counting as
   done on the strength of a document nobody would sign, and the only
   way back was for an override role to quietly edit somebody else's
   readings in place.

   So the other half of the judgement exists now. It is not a rejection
   of the inspection: the verdict on the work stays whatever the readings
   say. It is the document going back to the person who recorded it,
   with the reason attached.

   The reason is required, because "sent back" without one is a message
   nobody can act on. And each one is kept: a report that went back
   twice for the same thing is a fact about the work, so `returns` is
   appended to rather than overwritten. */
export class ReturnReasonRequiredError extends Error {
  constructor() {
    super('Say what has to change before sending the report back — the inspector only sees this note.')
    this.name = 'ReturnReasonRequiredError'
  }
}

export function returnReport(id, byName, note) {
  const all = getReports()
  const r = all.find((x) => x.id === id)
  if (!r) return null
  /* An approved report is never pulled back: it has been read and
     relied on, so a change to it is the next issue. Same rule as
     reviseReport, stated where somebody might try the other thing. */
  if (r.status !== 'submitted') {
    throw new Error(`Only a report waiting for approval can be sent back. ${r.reportId} is ${r.status}.`)
  }
  if (!canApprove(r, byName)) throw new SelfApprovalError(byName, 'send it back')
  const reason = String(note || '').trim()
  if (!reason) throw new ReturnReasonRequiredError()

  const at = new Date().toISOString()
  r.status = 'returned'
  r.returnedBy = byName
  r.returnedAt = at
  r.returnNote = reason
  r.returns = [...(r.returns || []), { by: byName, at, note: reason }]
  r.updatedAt = at
  write(KEYS.reports, all)
  return r
}

/* The three fields that describe an open return are about where the
   report stands, so going in again clears them. What does not clear is
   `returns` — that it was sent back, by whom and why, is the record.

   The three names are destructured to drop them and never read, which
   is the point of writing it this way rather than deleting keys off a
   copy; a linter reading it as three unused variables is reading it
   right and drawing the wrong conclusion. */
export function withoutOpenReturn(report) {
  const { returnedBy, returnedAt, returnNote, ...rest } = report
  return rest
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

/* Admin status overrides — an event log, not a colour.

   An override was stored as a bare status string under a job and a
   deliverable key. It turned a cell green and said nothing about who
   decided that, when, why, what it had been before, or what evidence
   stood behind it. On a controlled record that is the one statement
   most in need of a name against it: a person overrode the system,
   deliberately, and somebody will ask about it.

   So the current value is still a string — every screen that reads a
   cell keeps working — and it is now derived from a list of events that
   is only ever appended to. Clearing an override is an event too;
   nothing erases what was there.

   `evidenceRef` is a free field for the thing that justified it: a
   report number, a transmittal, an email reference. */
const HISTORY_KEY = 'qc.overrideEvents'

export const overrideEvents = () => read(HISTORY_KEY, [])

export const overrideHistory = (jobNo, deliverable) =>
  overrideEvents().filter((e) => String(e.jobNo) === String(jobNo)
    && (!deliverable || e.deliverable === deliverable))

export const getOverrides = () => read(KEYS.overrides, {})

export class OverrideReasonRequiredError extends Error {
  constructor() {
    super('Say why this status is being set by hand. An override without a reason is the first thing an audit asks about.')
    this.name = 'OverrideReasonRequiredError'
  }
}

/* status === null clears the override. `by` and `reason` are required
   either way, because taking one off is as deliberate as putting it on. */
export function setOverride(jobNo, deliverable, status, { by, reason, evidenceRef } = {}) {
  const note = String(reason || '').trim()
  if (!note) throw new OverrideReasonRequiredError()

  const o = getOverrides()
  const from = o[jobNo]?.[deliverable] ?? null
  if (!o[jobNo]) o[jobNo] = {}
  if (status === null) {
    delete o[jobNo][deliverable]
    if (!Object.keys(o[jobNo]).length) delete o[jobNo]
  } else {
    o[jobNo][deliverable] = status
  }

  const event = {
    id: `ov-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    jobNo: String(jobNo), deliverable,
    fromStatus: from, toStatus: status,
    reason: note, evidenceRef: evidenceRef || null,
    actor: by || 'unknown', createdAt: new Date().toISOString(),
  }
  // The events first: if the second write fails the log is ahead of the
  // state, which is recoverable. The other order loses the reason for a
  // change that already happened.
  write(HISTORY_KEY, [...overrideEvents(), event])
  write(KEYS.overrides, o)
  return event
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
