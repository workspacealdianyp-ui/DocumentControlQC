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
vi.mock('../../src/data/seedReports.js', () => ({ seedReports: () => [], SEED_COUNTERS: {}, SEED_STAMP: 'test' }))

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
    // A Quality Engineer sits above the technicians, not above himself.
    put(report('approved', { inspector: 'Quality Engineer' }))
    const { voidReport, SelfApprovalError } = await load()
    expect(() => voidReport('r1', 'Quality Engineer', 'wrong revision')).toThrow(SelfApprovalError)
    expect(stored()[0].status).toBe('approved')
  })

  it('can be done by the head of department on their own record', async () => {
    // The top of the chain has nobody above to ask, and a record that
    // can never be voided is worse than one voided by the person
    // answerable for it.
    put(report('approved', { inspector: 'QA Lead' }))
    const { voidReport } = await load()
    expect(() => voidReport('r1', 'QA Lead', 'wrong revision')).not.toThrow()
    expect(stored()[0].status).toBe('voided')
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

/* Technician Quality Control records. Quality Engineer and Spv Quality
   Control sit above and release that work. Dept Head Quality sits above
   them both. A report is released from above — that is the whole rule,
   and these are the corners of it. */
describe('the chain of command', () => {
  it('lets a Quality Engineer release a technician', async () => {
    const { canApprove } = await load()
    expect(canApprove(report('submitted', { inspector: 'Inspector One' }), 'Quality Engineer')).toBe(true)
  })

  it('lets a supervisor release a technician', async () => {
    const { canApprove } = await load()
    expect(canApprove(report('submitted', { inspector: 'Inspector Two' }), 'QC Supervisor')).toBe(true)
  })

  it('does not let one technician release another', async () => {
    const { canApprove } = await load()
    expect(canApprove(report('submitted', { inspector: 'Inspector One' }), 'Inspector Two')).toBe(false)
  })

  it('does not let the same tier release each other', async () => {
    // The engineer and the supervisor are one tier, so neither releases
    // the other's work — that goes up to the head of department.
    const { canApprove } = await load()
    expect(canApprove(report('submitted', { inspector: 'Quality Engineer' }), 'QC Supervisor')).toBe(false)
    expect(canApprove(report('submitted', { inspector: 'QC Supervisor' }), 'Quality Engineer')).toBe(false)
  })

  it('sends the engineer’s and supervisor’s own work to the head', async () => {
    const { canApprove } = await load()
    expect(canApprove(report('submitted', { inspector: 'Quality Engineer' }), 'QA Lead')).toBe(true)
    expect(canApprove(report('submitted', { inspector: 'QC Supervisor' }), 'QA Lead')).toBe(true)
  })

  it('never lets anyone below the top release their own work', async () => {
    const { canApprove } = await load()
    for (const who of ['Inspector One', 'Quality Engineer', 'QC Supervisor']) {
      expect(canApprove(report('submitted', { inspector: who }), who)).toBe(false)
    }
  })

  it('lets the head of department release their own, having nobody above', async () => {
    const { canApprove } = await load()
    expect(canApprove(report('submitted', { inspector: 'QA Lead' }), 'QA Lead')).toBe(true)
  })

  it('keeps a viewer out of it entirely', async () => {
    const { canApprove } = await load()
    expect(canApprove(report('submitted', { inspector: 'Inspector One' }), 'Management Viewer')).toBe(false)
  })

  it('reads a name it does not know as a technician', async () => {
    // Imported records, or somebody who has left. The lowest rank is the
    // safe way to be wrong: their work still needs releasing from above.
    const { canApprove } = await load()
    const stranger = report('submitted', { inspector: 'Someone Who Left' })
    expect(canApprove(stranger, 'Quality Engineer')).toBe(true)
    expect(canApprove(stranger, 'Inspector One')).toBe(false)
    expect(canApprove(stranger, 'Someone Who Left')).toBe(false)
  })

  it('says why, not just no', async () => {
    put(report('submitted', { inspector: 'Quality Engineer' }))
    const { approveReport } = await load()
    expect(() => approveReport('r1', 'Quality Engineer')).toThrow(/recorded this report/)
    put(report('submitted', { inspector: 'QC Supervisor' }))
    expect(() => approveReport('r1', 'Quality Engineer')).toThrow(/does not sit above QC Supervisor/)
  })
})
