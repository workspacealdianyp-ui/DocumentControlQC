import { COMPANY } from './company.js'
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
function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

// ---- Session (login / role) ----
export const getSession = () => read(KEYS.session, null)
export const setSession = (s) => write(KEYS.session, s)
export const clearSession = () => localStorage.removeItem(KEYS.session)

// ---- Reports (drafts + submitted inspection forms) ----
export const getReports = () => read(KEYS.reports, [])

export function saveReport(report) {
  const all = getReports()
  const i = all.findIndex((r) => r.id === report.id)
  report.updatedAt = new Date().toISOString()
  if (i >= 0) all[i] = report
  else all.push(report)
  write(KEYS.reports, all)
  return report
}

export function deleteReport(id) {
  write(KEYS.reports, getReports().filter((r) => r.id !== id))
}

// Lifecycle: draft -> submitted -> approved (Admin/QA Lead approves)
export function approveReport(id, byName) {
  const all = getReports()
  const r = all.find((x) => x.id === id)
  if (!r) return null
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

export function nextReportId(code, jobNo) {
  const n = getReports().filter((r) => r.reportId && r.reportId.includes(`/${code}/${jobNo}/`)).length
  return `${COMPANY.short}/${code}/${jobNo}/${String(n + 1).padStart(2, '0')}`
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
