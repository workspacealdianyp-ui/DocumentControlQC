import { COMPANY } from './company.js'
// Auto-generated, plain-English Resume of a report — compiled from all entered data.
// Returns { verdict, headline, stats:[{label,value}], paragraph }.
import { MR } from './compute.js'
import { dimRowStatus } from '../data/formSchemas.js'
import { reportResult } from '../components/SummaryReport.jsx'

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

export function buildResume(schema, report, job) {
  const v = report.values || {}
  const verdict = reportResult(report) // 'Accept' | 'Reject'
  const stats = []
  const facts = [] // sentence fragments

  const unit = job ? `${job.productDesc} (Job ${job.jobNo}${job.arasSN ? `, S/N ${job.arasSN}` : ''})` : 'the unit'
  const customer = job?.customerName || 'the customer'

  // ── per-form detail ──
  if (schema.key === 'hydrotest') {
    const rows = report.readings || []
    const peak = Math.max(0, ...rows.map((r) => parseFloat(r.pg1) || 0))
    const totalMin = rows.length > 1 ? MR.minutesBetween(rows[0].time, rows[rows.length - 1].time) : 0
    stats.push(
      { label: 'Test', value: v.testType || 'Hydrostatic Test' },
      { label: 'Media', value: v.testMedia || '—' },
      { label: 'Test Pressure', value: v.testPressure || '—' },
      { label: 'Peak Reading', value: peak ? `${peak} PsiG` : '—' },
      { label: 'Checkpoints', value: String(rows.length) },
      { label: 'Hold', value: totalMin ? `${totalMin} min` : (v.holding ? `${v.holding} min` : '—') },
    )
    facts.push(`a ${(v.testType || 'Hydrostatic Test').toLowerCase()} was performed using ${(v.testMedia || 'water').toLowerCase()} as the test medium`)
    if (v.testPressure) facts.push(`at a test pressure of ${v.testPressure}`)
    if (rows.length) facts.push(`across ${rows.length} recorded checkpoint${rows.length === 1 ? '' : 's'}${totalMin ? ` over ${totalMin} minutes` : ''}, reaching a peak of ${peak} PsiG`)
  } else if (schema.key === 'blasting') {
    const coats = report.coats || []
    const rh = MR.rh(v.dryTemp, v.wetTemp)
    stats.push(
      { label: 'Surface Std', value: v.surfacePrep || '—' },
      { label: 'Humidity', value: rh != null ? `${rh}%` : '—' },
      { label: 'Coats', value: String(coats.length) },
    )
    facts.push(`surface preparation to ${v.surfacePrep || 'the specified standard'} was carried out`)
    if (rh != null) facts.push(`with relative humidity recorded at ${rh}% (limit ≤ 85%)`)
    if (coats.length) {
      const ok = coats.filter((c) => { const a = MR.dftAvg(c.pts), s = parseFloat(c.std); return a != null && !isNaN(s) && a >= s }).length
      facts.push(`${coats.length} coat${coats.length === 1 ? '' : 's'} were measured for dry film thickness, ${ok} of which met the specified DFT`)
    }
  } else if (['mt', 'pt', 'ut'].includes(schema.key)) {
    const rows = report.results || []
    const rej = rows.filter((r) => ['Reject', 'Rej', 'NG'].includes(r.judgement)).length
    const accFld = (schema.sections.find((s) => s.id === 'general')?.fields || []).find((f) => f.id === 'acceptance')
    const acceptance = accFld && typeof accFld.compute === 'function' ? accFld.compute(v) : (v.acceptance || '—')
    stats.push(
      { label: 'Method', value: schema.code },
      { label: 'Code', value: v.code || '—' },
      { label: 'Acceptance', value: acceptance },
      { label: 'Joints', value: String(rows.length) },
      { label: 'Rejected', value: String(rej) },
    )
    facts.push(`a ${schema.title.replace(' Report', '').toLowerCase()} was conducted on ${rows.length} weld${rows.length === 1 ? '' : 's'}/part${rows.length === 1 ? '' : 's'} per ${v.code || 'the applicable code'}`)
    facts.push(rej === 0 ? 'with no rejectable indications found' : `with ${rej} item${rej === 1 ? '' : 's'} recording rejectable indications`)
  } else if (schema.key === 'visual') {
    const rows = report.results || []
    const ng = rows.filter((r) => r.judgement === 'NG').length
    stats.push(
      { label: 'Type', value: v.inspType || 'Visual' },
      { label: 'Points', value: String(rows.length) },
      { label: 'NG', value: String(ng) },
    )
    facts.push(`${rows.length} inspection point${rows.length === 1 ? '' : 's'} were checked`)
    facts.push(ng === 0 ? 'and all were found acceptable' : `of which ${ng} were marked NG`)
  } else if (schema.key === 'dimensional') {
    const rows = report.results || []
    const rej = rows.filter((r) => dimRowStatus(r) === 'Reject').length
    stats.push(
      { label: 'Dimensions', value: String(rows.length) },
      { label: 'Out of Tol.', value: String(rej) },
    )
    facts.push(`${rows.length} dimension${rows.length === 1 ? '' : 's'} were measured against the drawing`)
    facts.push(rej === 0 ? 'and all fell within tolerance' : `with ${rej} dimension${rej === 1 ? '' : 's'} outside tolerance`)
  }

  // ── verdict line ──
  const released = verdict === 'Accept'
  const headline = released ? 'Acceptable. Conforms to requirements' : 'Non-conforming. See findings'

  const dateStr = v.inspDate ? new Date(v.inspDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'
  let paragraph = `On ${dateStr}, ${unit} owned by ${customer} was inspected and tested by ${COMPANY.legalName} (${COMPANY.department}). `
  if (facts.length) paragraph += cap(facts.join(', ')) + '. '
  paragraph += released
    ? 'All results were found within the applicable acceptance criteria, and the item is considered acceptable.'
    : 'One or more results did not meet the acceptance criteria; corrective action and re-inspection are required before acceptance.'

  return { verdict, released, headline, stats, paragraph }
}
