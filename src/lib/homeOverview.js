import { DELIVERABLES } from './constants.js'
import { validTarget, jobProgress, ncrReports } from './status.js'
import { sameAuthor, sortWork, sortReview } from './reportScope.js'

export const REPORT_LABELS = {
  draft: 'Draft', submitted: 'Awaiting QA', returned: 'Sent back',
  approved: 'Approved', voided: 'Voided',
}

export const reportPath = (r) => `/job/${r.jobNo}/form/${r.formKey}?d=${encodeURIComponent(r.deliverable)}&rid=${encodeURIComponent(r.id)}`

// Reports, jobs and deliverable cells remain separate counting units.
// One snapshot supplies both the readings and the rows behind them.
export function homeOverview(jobs, reports, ctx, name, now = new Date()) {
  const ncrs = ncrReports(reports)
  const ncrByJob = new Map()
  for (const r of ncrs) {
    const key = String(r.jobNo)
    ncrByJob.set(key, (ncrByJob.get(key) || 0) + 1)
  }
  const totals = { jobs: jobs.length, open: 0, done: 0, applicable: 0, overdue: 0, gaps: 0, overrides: 0, noScope: 0 }
  const attention = []
  const units = []
  const jobNos = new Set(jobs.map((j) => String(j.jobNo)))
  for (const job of jobs) {
    const progress = jobProgress(job, ctx, now)
    totals.done += progress.done
    totals.applicable += progress.applicable
    if (!progress.applicable) totals.noScope++
    else if (progress.done < progress.applicable) totals.open++
    const late = DELIVERABLES.filter((d) => progress.statuses[d.key]?.status === 'overdue')
    const pending = DELIVERABLES.filter((d) => !['done', 'na'].includes(progress.statuses[d.key]?.status))
    totals.overdue += Number(progress.overdue)
    totals.gaps += late.length
    totals.overrides += Object.values(progress.statuses).filter((s) => s.status === 'done' && s.source === 'override').length
    const ncr = ncrByJob.get(String(job.jobNo)) || 0
    const unit = { job, progress, late, pending, ncr, target: validTarget(job) }
    units.push(unit)
    if (progress.overdue || ncr) attention.push(unit)
  }
  attention.sort((a, b) => Number(b.ncr > 0) - Number(a.ncr > 0)
    || (a.target || '9999').localeCompare(b.target || '9999')
    || String(a.job.jobNo).localeCompare(String(b.job.jobNo)))
  const mine = reports.filter((r) => sameAuthor(r.inspector, name) && ['returned', 'draft'].includes(r.status)).sort(sortWork)
  const submitted = reports.filter((r) => r.status === 'submitted')
    .sort(sortReview)
  const counts = { all: reports.length, ncr: ncrs.length }
  for (const status of Object.keys(REPORT_LABELS)) counts[status] = reports.filter((r) => r.status === status).length
  return {
    totals, attention, units, mine, submitted, counts,
    pct: totals.applicable ? Math.round(totals.done / totals.applicable * 100) : null,
    unavailableNcr: ncrs.filter((r) => !jobNos.has(String(r.jobNo))).length,
    recent: [...reports].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 6),
  }
}
