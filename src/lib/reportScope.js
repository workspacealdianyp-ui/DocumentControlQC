import { canApprove } from './store.js'

export const sameAuthor = (a, b) => Boolean(a && b) && a.trim().toLowerCase() === b.trim().toLowerCase()

// Home and the destination register must describe the same set of records.
export function scopeReports(reports, scope, session, role, author) {
  return reports.filter((r) => {
    if (author && !sameAuthor(r.inspector, author)) return false
    if (scope === 'mine') return sameAuthor(r.inspector, session.name)
    if (scope === 'work') return sameAuthor(r.inspector, session.name) && ['returned', 'draft'].includes(r.status)
    if (scope === 'review') return role.canOverride && r.status === 'submitted' && canApprove(r, session.name)
    if (scope === 'unfinished') return ['draft', 'returned', 'submitted'].includes(r.status)
    return true
  })
}

export function sortWork(a, b) {
  return Number(b.status === 'returned') - Number(a.status === 'returned')
    || (a.status === 'returned'
      ? (a.returnedAt || a.updatedAt || '').localeCompare(b.returnedAt || b.updatedAt || '')
      : (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    || String(a.id).localeCompare(String(b.id))
}

export const sortReview = (a, b) => (a.submittedAt || a.updatedAt || '').localeCompare(b.submittedAt || b.updatedAt || '') || String(a.id).localeCompare(String(b.id))
