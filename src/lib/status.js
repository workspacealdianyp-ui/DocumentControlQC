import { DELIVERABLES } from './constants.js'
import { getReports, getOverrides } from './store.js'

const TODAY = new Date()

// Status for one job x deliverable cell.
// Layering: admin override > app report (draft=inprogress, submitted=done) > Excel data,
// then Overdue rule: not done + applicable + PDI already released in the past.
export function cellStatus(job, delivKey, ctx) {
  const { overrides, reportIndex } = ctx
  // An order says outright which reports it wants; anything outside that
  // list is not applicable to this job, whatever else is recorded.
  if (job.required && !job.required.includes(delivKey)) return { status: 'na', source: 'order' }
  const ov = overrides[job.jobNo]?.[delivKey]
  if (ov) return { status: ov, source: 'override' }

  const reps = reportIndex[`${job.jobNo}|${delivKey}`] || []
  const finished = reps.find((r) => r.status === 'submitted' || r.status === 'approved')
  if (finished) return { status: 'done', source: 'report', report: finished }
  if (reps.length > 0) return { status: 'inprogress', source: 'report', report: reps[0] }

  const base = job.deliverables[delivKey]?.status || 'notstarted'
  if (base === 'done') return { status: 'done', source: 'excel', ref: job.deliverables[delivKey].ref }
  if (base === 'na') return { status: 'na', source: 'excel' }

  if (job.datePdiRelease && new Date(job.datePdiRelease) < TODAY) {
    return { status: 'overdue', source: 'derived' }
  }
  return { status: 'notstarted', source: 'excel' }
}

export function buildContext() {
  const reportIndex = {}
  for (const r of getReports()) {
    const k = `${r.jobNo}|${r.deliverable}`
    if (!reportIndex[k]) reportIndex[k] = []
    reportIndex[k].push(r)
  }
  return { overrides: getOverrides(), reportIndex }
}

export function jobStatuses(job, ctx) {
  const out = {}
  for (const d of DELIVERABLES) out[d.key] = cellStatus(job, d.key, ctx)
  return out
}

export function jobProgress(job, ctx) {
  const sts = jobStatuses(job, ctx)
  let done = 0
  let applicable = 0
  let overdue = false
  let inprog = false
  for (const k in sts) {
    const s = sts[k].status
    if (s === 'na') continue
    applicable++
    if (s === 'done') done++
    if (s === 'overdue') overdue = true
    if (s === 'inprogress') inprog = true
  }
  return { done, applicable, overdue, inprogress: inprog, statuses: sts }
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
  const head = ['Job No', 'WBS No', 'Serial No', 'Category', 'Type', 'Product', 'Customer', 'Date PB', 'PDI Release',
    ...DELIVERABLES.map((d) => d.label)]
  const lines = [head.join(',')]
  for (const job of jobs) {
    const sts = jobStatuses(job, ctx)
    const row = [job.jobNo, job.wbsNo, job.arasSN, job.kategori, job.type,
      `"${(job.productDesc || '').replace(/"/g, "'")}"`,
      `"${(job.customerName || '').replace(/"/g, "'")}"`,
      job.datePB || '', job.datePdiRelease || '',
      ...DELIVERABLES.map((d) => sts[d.key].status)]
    lines.push(row.join(','))
  }
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `qc-status-matrix-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
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
export function ncrReports() {
  return getReports()
    .filter((r) => {
      const v = r.values || {}
      const hasNcr = typeof v.ncr === 'string' && v.ncr.trim() !== ''
      const rejected = v.finalStatus === 'Reject' || v.testResult === 'Unsatisfactory'
      const rowRej = (r.results || []).some((row) => ['Reject', 'Rej', 'NG'].includes(row.judgement))
      return hasNcr || rejected || rowRej
    })
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
}
