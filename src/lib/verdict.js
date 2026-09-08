import { dimRowStatus } from '../data/formSchemas.js'

/* The verdict a single report carries.

   Every screen that ranks, counts or reports on a document needs this
   answer, so it lives here rather than inside whichever component asked
   for it first. It is read off what was recorded — the stated result, the
   computed status, then the rows themselves — so a report never has to be
   asked twice. */
export const reportResult = (r) => {
  const v = r.values || {}
  if (v.testResult) return v.testResult === 'Unsatisfactory' ? 'Reject' : 'Accept'
  if (v.finalStatus) return v.finalStatus === 'Reject' ? 'Reject' : 'Accept'
  const results = r.results || []
  if (results.length) {
    if (r.formKey === 'dimensional') return results.some((row) => dimRowStatus(row) === 'Reject') ? 'Reject' : 'Accept'
    const rejVals = ['Reject', 'Rej', 'NG']
    return results.some((row) => rejVals.includes(row.judgement)) ? 'Reject' : 'Accept'
  }
  if ((r.readings || []).some((row) => /fail|leak|drop/i.test(row.remark || ''))) return 'Reject'
  return 'Accept'
}

/* Which reports are the live ones.

   A document can be amended: /01 is raised, rejected, and /02 is raised
   against the same job, form and deliverable to close it out. Only the
   highest issue is the document's current state, so a rejection that has
   already been answered by a clean amendment is history rather than an
   open finding.

   This lives here with reportResult because the two are always used
   together — "what does this document say" is only meaningful about the
   issue that is current. It used to be a private copy inside rollup.js,
   which is how the register came to count two non-conformances while the
   list it linked to opened four.  */
const issueNo = (id = '') => { const m = String(id).match(/\/(\d+)$/); return m ? Number(m[1]) : 0 }

export function currentIssues(reports) {
  const byDoc = new Map()
  for (const r of reports) {
    const k = `${r.jobNo}::${r.formKey}::${r.deliverable}`
    const held = byDoc.get(k)
    if (!held || issueNo(r.reportId) > issueNo(held.reportId)) byDoc.set(k, r)
  }
  return [...byDoc.values()]
}
