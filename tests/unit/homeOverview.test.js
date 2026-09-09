import { describe, expect, it } from 'vitest'
import { homeOverview, reportPath } from '../../src/lib/homeOverview.js'
import { validTarget } from '../../src/lib/status.js'
import { REPORT_CHOICES, canStartFor, existingFor } from '../../src/lib/reportChoices.js'

const date = new Date('2026-09-09T10:00:00')
const job = (jobNo, required, extra = {}) => ({ jobNo, required, deliverables: {}, ...extra })
const report = (id, jobNo, deliverable, status, extra = {}) => ({
  id, reportId: `${id}/01`, jobNo, deliverable, status, formKey: 'dimensional',
  inspector: 'Inspector One', values: {}, updatedAt: '2026-09-08T10:00:00Z', ...extra,
})
const context = (reports = [], overrides = {}) => {
  const reportIndex = {}
  for (const r of reports) (reportIndex[`${r.jobNo}|${r.deliverable}`] ||= []).push(r)
  return { reportIndex, overrides }
}

describe('home readings and attention', () => {
  it('keeps job, deliverable and report counts distinct, with explicit overrides and no-scope jobs', () => {
    const jobs = [
      job('A', ['Dimension Report', 'NDE Report'], { dateTarget: '2026-09-01' }),
      job('B', ['Painting']), job('C', []),
      job('D', ['PDI'], { dateTarget: '2026-09-01' }), job('E', ['PTR']),
      job('F', ['Dimension Report', 'Painting'], { dateTarget: '2026-09-02' }),
    ]
    const reports = [report('a', 'A', 'Dimension Report', 'approved', { values: { finalStatus: 'Reject' } }),
      report('b', 'B', 'Painting', 'approved'), report('d', 'D', 'PDI', 'submitted')]
    const data = homeOverview(jobs, reports, context(reports, { E: { PTR: 'done' } }), 'Inspector One', date)
    expect(data.totals).toEqual({ jobs: 6, open: 3, done: 3, applicable: 7, overdue: 2, gaps: 3, overrides: 1, noScope: 1 })
    expect(data.counts.submitted).toBe(1)
    expect(data.pct).toBe(43)
    expect(data.attention.map((r) => r.job.jobNo)).toEqual(['A', 'F'])
    expect(data.attention[0]).toMatchObject({ ncr: 1, late: [{ key: 'NDE Report' }] })
  })

  it('keeps completed jobs with Reject verdicts visible and deduplicates a job with multiple NCR reports', () => {
    const jobs = [job('A', ['Dimension Report', 'Painting'])]
    const reports = [report('dim', 'A', 'Dimension Report', 'approved', { values: { finalStatus: 'Reject' } }),
      report('paint', 'A', 'Painting', 'approved', { formKey: 'blasting', values: { finalStatus: 'Reject' } })]
    const data = homeOverview(jobs, reports, context(reports), 'Inspector One', date)
    expect(data.totals.open).toBe(0)
    expect(data.pct).toBe(100)
    expect(data.attention).toHaveLength(1)
    expect(data.attention[0].ncr).toBe(2)
  })

  it('uses the current issue for NCR and exposes unavailable job references separately', () => {
    const reports = [report('old', 'A', 'Dimension Report', 'approved', { reportId: 'DIM/A/01', values: { finalStatus: 'Reject' } }),
      report('new', 'A', 'Dimension Report', 'approved', { reportId: 'DIM/A/02' }),
      report('missing', 'MISSING', 'Dimension Report', 'submitted', { values: { finalStatus: 'Reject' } })]
    const data = homeOverview([job('A', ['Dimension Report'])], reports, context(reports), 'Inspector One', date)
    expect(data.counts.ncr).toBe(1)
    expect(data.attention).toHaveLength(0)
    expect(data.unavailableNcr).toBe(1)
  })

  it('sorts personal returns before recent drafts and review by oldest submission', () => {
    const reports = [report('draft-old', 'A', 'PDI', 'draft'),
      report('draft-new', 'A', 'PDI', 'draft', { updatedAt: '2026-09-09T01:00:00Z' }),
      report('returned', 'A', 'PDI', 'returned', { returnedAt: '2026-09-01T01:00:00Z' }),
      report('other', 'A', 'PDI', 'returned', { inspector: 'Someone Else' }),
      report('review-new', 'A', 'PDI', 'submitted', { submittedAt: '2026-09-08T01:00:00Z' }),
      report('review-old', 'A', 'PDI', 'submitted', { submittedAt: '2026-09-01T01:00:00Z' })]
    const data = homeOverview([], reports, context(reports), 'Inspector One', date)
    expect(data.mine.map((r) => r.id)).toEqual(['returned', 'draft-new', 'draft-old'])
    expect(data.submitted.map((r) => r.id)).toEqual(['review-old', 'review-new'])
  })

  it('shows no percentage without an applicable denominator', () => {
    expect(homeOverview([job('A', [])], [], context(), '', date).pct).toBeNull()
  })

  it('refreshes overdue gaps when the calendar day changes', () => {
    const jobs = [job('A', ['PDI'], { dateTarget: '2026-09-09' })]
    expect(homeOverview(jobs, [], context(), '', date).totals.overdue).toBe(0)
    expect(homeOverview(jobs, [], context(), '', new Date('2026-09-10T00:00:01')).totals.overdue).toBe(1)
  })

  it('does not normalize invalid calendar dates into a real target label', () => {
    expect(validTarget({ dateTarget: '2026-02-31' })).toBeNull()
    expect(validTarget({ dateTarget: 'invalid' })).toBeNull()
    expect(validTarget({ datePdiRelease: '2026-09-09' })).toBe('2026-09-09')
    expect(homeOverview([job('A', ['PDI'], { dateTarget: '2026-02-31' })], [], context(), '', date).totals.overdue).toBe(0)
  })
})

describe('report entry routes', () => {
  it('maps PDI and Pre-Shipment to distinct deliverables on the same existing template', () => {
    const pdi = REPORT_CHOICES.find((c) => c.id === 'pdi')
    const pre = REPORT_CHOICES.find((c) => c.id === 'visual')
    expect(pdi.key).toBe(pre.key)
    const unit = job('A', ['PDI'])
    expect(canStartFor(unit, pdi, context())).toBe(true)
    expect(canStartFor(unit, pre, context())).toBe(false)
    expect(REPORT_CHOICES.filter((c) => c.group === 'Document record').map((c) => c.id)).toEqual(['itp', 'ptr', 'irn'])
  })

  it('opens the current existing issue without silently replacing approved evidence', () => {
    const choice = REPORT_CHOICES.find((c) => c.id === 'dimensional')
    const reports = [report('approved', 'A', 'Dimension Report', 'approved', { reportId: 'DIM/A/01' }),
      report('amendment', 'A', 'Dimension Report', 'draft', { reportId: 'DIM/A/02' })]
    expect(existingFor(reports, 'A', choice).id).toBe('amendment')
    expect(existingFor(reports.map((r) => ({ ...r, status: 'voided' })), 'A', choice)).toBeNull()
  })

  it('uses the internal report ID in rid and encodes deliverable context', () => {
    expect(reportPath(report('internal/42', 'A', 'Dimension Report', 'draft')))
      .toBe('/job/A/form/dimensional?d=Dimension%20Report&rid=internal%2F42')
  })
})
