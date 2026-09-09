import { describe, it, expect, vi, beforeEach } from 'vitest'

const jobs = { list: [{ jobNo: '900' }] }
vi.mock('../../src/lib/jobOrders.js', () => ({
  allJobs: () => jobs.list,
  getOrders: () => [],
  saveOrder: () => {},
  orderById: () => null,
  takenJobNos: () => new Set(),
  requiredFor: () => [],
}))
vi.mock('../../src/data/seedReports.js', () => ({ SEED_REPORTS: [], SEED_COUNTERS: {} }))

const load = async () => { vi.resetModules(); return import('../../src/lib/store.js') }

const report = (status, extra = {}) => ({
  id: 'r1', jobNo: '900', reportId: 'MFG/DIM/900/01', formKey: 'dimensional',
  deliverable: 'Dimension Report', inspector: 'Inspector One', status, values: {}, ...extra,
})
const put = (r) => localStorage.setItem('qc.reports', JSON.stringify([r]))
const stored = () => JSON.parse(localStorage.getItem('qc.reports') || '[]')

beforeEach(() => { jobs.list = [{ jobNo: '900' }] })

describe('what may be done to a report', () => {
  it('offers the action its state allows, and nothing else', async () => {
    const { actionFor } = await load()
    expect(actionFor(report('draft'))).toBe('delete')
    expect(actionFor(report('returned'))).toBe('delete')
    expect(actionFor(report('submitted'))).toBe('withdraw')
    expect(actionFor(report('approved'))).toBe('void')
    expect(actionFor(report('voided'))).toBeNull()
    expect(actionFor(null)).toBeNull()
  })
})

describe('deleting', () => {
  it('removes a draft', async () => {
    put(report('draft'))
    const { deleteReport, getAllReports } = await load()
    deleteReport('r1', 'QA Lead', 'keyed against the wrong unit')
    expect(getAllReports()).toHaveLength(0)
  })

  it('refuses a submitted report and leaves it exactly as it was', async () => {
    put(report('submitted'))
    const { deleteReport, ProtectedRecordError, getAllReports } = await load()
    expect(() => deleteReport('r1', 'QA Lead')).toThrow(ProtectedRecordError)
    expect(getAllReports()).toHaveLength(1)
    expect(stored()[0].status).toBe('submitted')
  })

  it('refuses an approved report — the evidence stays', async () => {
    put(report('approved', { approvedBy: 'QA Lead' }))
    const { deleteReport, ProtectedRecordError, getAllReports } = await load()
    expect(() => deleteReport('r1', 'QA Lead')).toThrow(ProtectedRecordError)
    expect(getAllReports()).toHaveLength(1)
  })

  it('says what can be done instead', async () => {
    put(report('approved'))
    const { deleteReport } = await load()
    expect(() => deleteReport('r1', 'QA Lead')).toThrow(/can be voided/)
  })
})

describe('withdrawing', () => {
  it('puts a submitted report back to draft and keeps why', async () => {
    put(report('submitted'))
    const { withdrawReport } = await load()
    const r = withdrawReport('r1', 'Inspector One', 'wrong gauge on section 3')
    expect(r.status).toBe('draft')
    expect(r.audit).toHaveLength(1)
    expect(r.audit[0]).toMatchObject({
      event: 'withdrawn', by: 'Inspector One', from: 'submitted', note: 'wrong gauge on section 3',
    })
  })

  it('will not do it without a reason', async () => {
    put(report('submitted'))
    const { withdrawReport, ReasonRequiredError } = await load()
    expect(() => withdrawReport('r1', 'Inspector One', '   ')).toThrow(ReasonRequiredError)
    expect(stored()[0].status).toBe('submitted')
  })

  it('does not touch an approved report', async () => {
    put(report('approved'))
    const { withdrawReport, ProtectedRecordError } = await load()
    expect(() => withdrawReport('r1', 'QA Lead', 'because')).toThrow(ProtectedRecordError)
  })
})

describe('voiding', () => {
  it('keeps the record, marks it, and stops it counting', async () => {
    put(report('approved', { approvedBy: 'QA Lead', approvedAt: '2026-01-02T00:00:00.000Z' }))
    const { voidReport, getAllReports } = await load()
    const r = voidReport('r1', 'QA Lead', 'wrong drawing revision')

    expect(r.status).toBe('voided')
    expect(r.voidedBy).toBe('QA Lead')
    expect(r.voidReason).toBe('wrong drawing revision')
    // Everything that made it evidence is still there.
    expect(r.reportId).toBe('MFG/DIM/900/01')
    expect(r.approvedBy).toBe('QA Lead')
    expect(getAllReports()).toHaveLength(1)
  })

  it('needs a reason', async () => {
    put(report('approved'))
    const { voidReport, ReasonRequiredError } = await load()
    expect(() => voidReport('r1', 'QA Lead', '')).toThrow(ReasonRequiredError)
    expect(stored()[0].status).toBe('approved')
  })

  it('cannot be done by the person who wrote it', async () => {
    put(report('approved', { inspector: 'QA Lead' }))
    const { voidReport, SelfApprovalError } = await load()
    expect(() => voidReport('r1', 'QA Lead', 'wrong revision')).toThrow(SelfApprovalError)
    expect(stored()[0].status).toBe('approved')
  })

  it('cannot be done twice', async () => {
    put(report('approved'))
    const { voidReport, ProtectedRecordError } = await load()
    voidReport('r1', 'QA Lead', 'wrong revision')
    expect(() => voidReport('r1', 'QA Lead', 'again')).toThrow(ProtectedRecordError)
  })

  it('leaves an audit entry naming the state it came from', async () => {
    put(report('approved'))
    const { voidReport, reportAudit } = await load()
    const r = voidReport('r1', 'QA Lead', 'wrong revision')
    expect(reportAudit(r)[0]).toMatchObject({ event: 'voided', from: 'approved', by: 'QA Lead' })
  })
})
