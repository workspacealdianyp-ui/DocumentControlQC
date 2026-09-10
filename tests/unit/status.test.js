import { describe, it, expect, vi, beforeEach } from 'vitest'

const jobs = { list: [] }
vi.mock('../../src/lib/jobOrders.js', () => ({
  allJobs: () => jobs.list,
  getOrders: () => [],
  saveOrder: () => {},
  orderById: () => null,
  takenJobNos: () => new Set(),
  requiredFor: () => [],
}))
vi.mock('../../src/data/seedReports.js', () => ({ seedReports: () => [], SEED_COUNTERS: {}, SEED_STAMP: 'test' }))

const load = async () => { vi.resetModules(); return import('../../src/lib/status.js') }

const JOB = {
  jobNo: '900', customerName: 'Customer 03', productDesc: 'BUCKET',
  required: ['Dimension Report', 'Painting'],
  deliverables: {},
}

const rep = (deliverable, status, extra = {}) => ({
  id: `${deliverable}-${status}`, jobNo: '900', deliverable, status,
  reportId: `MFG/X/900/01`, values: {}, ...extra,
})

const ctxWith = (...reports) => {
  const reportIndex = {}
  for (const r of reports) {
    const k = `${r.jobNo}|${r.deliverable}`
    ;(reportIndex[k] ||= []).push(r)
  }
  return { overrides: {}, reportIndex }
}

beforeEach(() => { jobs.list = [{ jobNo: '900' }] })

describe('done means approved', () => {
  it('an approved report makes a deliverable done', async () => {
    const { cellStatus } = await load()
    const ctx = ctxWith(rep('Dimension Report', 'approved'))
    expect(cellStatus(JOB, 'Dimension Report', ctx).status).toBe('done')
  })

  it('a submitted report is awaiting QA, not done', async () => {
    const { cellStatus } = await load()
    const ctx = ctxWith(rep('Dimension Report', 'submitted'))
    // This is the defect: submitted used to return 'done', so an unsigned
    // document counted as finished work everywhere downstream.
    expect(cellStatus(JOB, 'Dimension Report', ctx).status).toBe('awaiting')
  })

  it('a draft is in progress', async () => {
    const { cellStatus } = await load()
    const ctx = ctxWith(rep('Dimension Report', 'draft'))
    expect(cellStatus(JOB, 'Dimension Report', ctx).status).toBe('inprogress')
  })

  it('a voided report counts as nothing at all', async () => {
    const { cellStatus } = await load()
    const ctx = ctxWith(rep('Dimension Report', 'voided'))
    expect(cellStatus(JOB, 'Dimension Report', ctx).status).toBe('notstarted')
  })

  it('an approved issue outranks a submitted one on the same deliverable', async () => {
    const { cellStatus } = await load()
    const ctx = ctxWith(rep('Dimension Report', 'submitted'), rep('Dimension Report', 'approved'))
    expect(cellStatus(JOB, 'Dimension Report', ctx).status).toBe('done')
  })

  it('a deliverable the order did not ask for is not applicable', async () => {
    const { cellStatus } = await load()
    expect(cellStatus(JOB, 'NDE Report', ctxWith()).status).toBe('na')
  })
})

describe('jobProgress', () => {
  it('counts approved as done and submitted as awaiting, separately', async () => {
    const { jobProgress } = await load()
    const p = jobProgress(JOB, ctxWith(
      rep('Dimension Report', 'approved'),
      rep('Painting', 'submitted'),
    ))
    expect(p).toMatchObject({ done: 1, awaiting: 1, recorded: 2, applicable: 2 })
  })

  it('does not read as complete while a document is unsigned', async () => {
    const { jobProgress } = await load()
    const p = jobProgress(JOB, ctxWith(
      rep('Dimension Report', 'approved'),
      rep('Painting', 'submitted'),
    ))
    expect(p.done === p.applicable).toBe(false)
    // The shop has still done the work, and that is a different number.
    expect(p.recorded === p.applicable).toBe(true)
  })

  it('reads as complete once both are approved', async () => {
    const { jobProgress } = await load()
    const p = jobProgress(JOB, ctxWith(
      rep('Dimension Report', 'approved'),
      rep('Painting', 'approved'),
    ))
    expect(p.done).toBe(2)
    expect(p.done === p.applicable).toBe(true)
  })

  it('treats awaiting as work in progress', async () => {
    const { jobProgress } = await load()
    expect(jobProgress(JOB, ctxWith(rep('Painting', 'submitted'))).inprogress).toBe(true)
  })
})

describe('overdue, against the date it is asked on', () => {
  const late = { ...JOB, dateTarget: '2026-03-01' }

  it('is not overdue before the date', async () => {
    const { cellStatus } = await load()
    expect(cellStatus(late, 'Painting', ctxWith(), new Date('2026-02-28T23:00:00')).status).toBe('notstarted')
  })

  it('is not overdue on the day itself', async () => {
    const { cellStatus } = await load()
    // Due today is due, not late. The old comparison against a timestamp
    // taken at module load made this depend on what time the app opened.
    expect(cellStatus(late, 'Painting', ctxWith(), new Date('2026-03-01T18:00:00')).status).toBe('notstarted')
  })

  it('is overdue the next day', async () => {
    const { cellStatus } = await load()
    expect(cellStatus(late, 'Painting', ctxWith(), new Date('2026-03-02T00:30:00')).status).toBe('overdue')
  })

  it('rolls over while the tab stays open', async () => {
    const { jobProgress } = await load()
    // One module load, two days. This is the PWA left running overnight.
    expect(jobProgress(late, ctxWith(), new Date('2026-03-01T09:00:00')).overdue).toBe(false)
    expect(jobProgress(late, ctxWith(), new Date('2026-03-02T09:00:00')).overdue).toBe(true)
  })

  it('is never overdue once it is approved', async () => {
    const { cellStatus } = await load()
    const ctx = ctxWith(rep('Painting', 'approved'))
    expect(cellStatus(late, 'Painting', ctx, new Date('2027-01-01')).status).toBe('done')
  })

  it('falls back to the old release date for a job that has no target', async () => {
    const { dueDate } = await load()
    expect(dueDate({ datePdiRelease: '2026-11-20' })).toBe('2026-11-20')
    expect(dueDate({ dateTarget: '2026-12-01', datePdiRelease: '2026-11-20' })).toBe('2026-12-01')
    expect(dueDate({})).toBeNull()
  })
})

describe('releasedAt', () => {
  it('reads the day the final inspection was approved', async () => {
    const { releasedAt } = await load()
    const job = { jobNo: '900', required: ['PDI'] }
    const ctx = ctxWith({ ...rep('PDI', 'approved'), approvedAt: '2026-04-13T09:20:00.000Z' })
    expect(releasedAt(job, ctx)).toBe('2026-04-13')
  })

  it('says nothing when it has not been approved', async () => {
    const { releasedAt } = await load()
    const job = { jobNo: '900', required: ['PDI'] }
    expect(releasedAt(job, ctxWith(rep('PDI', 'submitted')))).toBeNull()
  })

  it('takes the latest of several approvals', async () => {
    const { releasedAt } = await load()
    const job = { jobNo: '900', required: ['PDI'] }
    const ctx = ctxWith(
      { ...rep('PDI', 'approved'), id: 'a', approvedAt: '2026-04-13T09:20:00.000Z' },
      { ...rep('PDI', 'approved'), id: 'b', approvedAt: '2026-05-02T11:00:00.000Z' },
    )
    expect(releasedAt(job, ctx)).toBe('2026-05-02')
  })
})

describe('workingDaysLeft', () => {
  // 2026-03-02 is a Monday; 03-07 a Saturday, 03-08 a Sunday.
  const monday = new Date('2026-03-02T09:00:00')

  it('counts nothing when the target is today', async () => {
    const { workingDaysLeft } = await load()
    expect(workingDaysLeft('2026-03-02', monday)).toBe(0)
  })

  it('counts the target day itself', async () => {
    const { workingDaysLeft } = await load()
    expect(workingDaysLeft('2026-03-03', monday)).toBe(1)
    expect(workingDaysLeft('2026-03-06', monday)).toBe(4)
  })

  it('does not count Saturday or Sunday', async () => {
    const { workingDaysLeft } = await load()
    // A Saturday or Sunday target is worth no more working time than the
    // Friday before it: the weekend adds calendar days and no working
    // ones, so all three read four.
    expect(workingDaysLeft('2026-03-07', monday)).toBe(4)
    expect(workingDaysLeft('2026-03-08', monday)).toBe(4)
    // The Monday after is the fifth.
    expect(workingDaysLeft('2026-03-09', monday)).toBe(5)
  })

  it('reads a Friday target from a Friday as zero, and the Monday as one', async () => {
    const { workingDaysLeft } = await load()
    const friday = new Date('2026-03-06T16:00:00')
    expect(workingDaysLeft('2026-03-06', friday)).toBe(0)
    expect(workingDaysLeft('2026-03-09', friday)).toBe(1)
  })

  it('goes negative once the target is past, counting the same way', async () => {
    const { workingDaysLeft } = await load()
    expect(workingDaysLeft('2026-02-27', monday)).toBe(-1)
    // Two weekends back: 02-23 is the Monday before.
    expect(workingDaysLeft('2026-02-23', monday)).toBe(-5)
  })

  it('does not depend on the hour it is asked at', async () => {
    const { workingDaysLeft } = await load()
    expect(workingDaysLeft('2026-03-06', new Date('2026-03-02T00:01:00'))).toBe(4)
    expect(workingDaysLeft('2026-03-06', new Date('2026-03-02T23:59:00'))).toBe(4)
  })

  it('returns null for a missing or malformed target', async () => {
    const { workingDaysLeft } = await load()
    expect(workingDaysLeft(null, monday)).toBe(null)
    expect(workingDaysLeft('', monday)).toBe(null)
    expect(workingDaysLeft('2026-3-2', monday)).toBe(null)
  })
})
