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
