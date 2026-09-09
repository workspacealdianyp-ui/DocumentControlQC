import { describe, it, expect, vi, beforeEach } from 'vitest'

/* The job list is a module the store reads at migration time, so it is
   stubbed rather than fixtured: these tests are about what happens to
   stored reports when that list changes, not about the demo data. */
const jobs = { list: [] }
vi.mock('../../src/lib/jobOrders.js', () => ({
  allJobs: () => jobs.list,
  getOrders: () => [],
  saveOrder: () => {},
  orderById: () => null,
  takenJobNos: () => new Set(),
  requiredFor: () => [],
}))
vi.mock('../../src/data/seedReports.js', () => ({
  // A draft, so the deletion rules let the "does not run twice" test
  // remove it through the real API rather than around it.
  SEED_REPORTS: [{ id: 'seed-1', jobNo: '900', reportId: 'MFG/DIM/900/01', status: 'draft' }],
  SEED_COUNTERS: { 'DIM/900': 1 },
}))

const load = async () => {
  vi.resetModules()
  return import('../../src/lib/store.js')
}

const put = (reports) => localStorage.setItem('qc.reports', JSON.stringify(reports))
const raw = () => JSON.parse(localStorage.getItem('qc.reports') || '[]')

const report = (id, jobNo, extra = {}) => ({
  id, jobNo, reportId: `MFG/DIM/${jobNo}/01`, status: 'approved',
  inspector: 'Inspector One', values: { jobNo }, ...extra,
})

beforeEach(() => { jobs.list = [{ jobNo: '900' }] })

describe('markOrphans', () => {
  it('marks a report whose job is gone instead of removing it', async () => {
    const { markOrphans } = await load()
    const { reports, orphaned } = markOrphans([report('a', '900'), report('b', '404')], ['900'])
    expect(reports).toHaveLength(2)
    expect(orphaned).toBe(1)
    expect(reports[0].orphaned).toBeUndefined()
    expect(reports[1].orphaned).toBe(true)
    expect(reports[1].orphanedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('takes the mark off again when the job comes back', async () => {
    const { markOrphans } = await load()
    const was = report('b', '404', { orphaned: true, orphanedAt: '2026-01-01T00:00:00.000Z' })
    const { reports, adopted } = markOrphans([was], ['404'])
    expect(adopted).toBe(1)
    expect(reports[0]).not.toHaveProperty('orphaned')
    expect(reports[0]).not.toHaveProperty('orphanedAt')
  })

  it('compares job numbers as text, so 900 and "900" are one job', async () => {
    const { markOrphans } = await load()
    const { orphaned } = markOrphans([report('a', 900)], ['900'])
    expect(orphaned).toBe(0)
  })

  it('drops nothing when every job is gone', async () => {
    const { markOrphans } = await load()
    const { reports, orphaned } = markOrphans([report('a', '1'), report('b', '2')], [])
    expect(reports).toHaveLength(2)
    expect(orphaned).toBe(2)
  })
})

describe('the migration', () => {
  it('keeps a report whose job no longer exists', async () => {
    put([report('mine', '404')])
    const { getReports, getAllReports, orphanedReports } = await load()

    expect(getReports().map((r) => r.id)).not.toContain('mine')
    expect(getAllReports().map((r) => r.id)).toContain('mine')
    expect(orphanedReports().map((r) => r.id)).toEqual(['mine'])
    // The record is still in storage, whole.
    expect(raw().find((r) => r.id === 'mine')).toMatchObject({ reportId: 'MFG/DIM/404/01', status: 'approved' })
  })

  it('keeps work on a job that still exists, and merges the fixture beside it', async () => {
    put([report('mine', '900')])
    const { getReports } = await load()
    expect(getReports().map((r) => r.id).sort()).toEqual(['mine', 'seed-1'])
  })

  it('takes a snapshot of what was there before it writes', async () => {
    put([report('mine', '404')])
    const { lastSnapshot } = await load()
    const snap = lastSnapshot()
    expect(snap).toBeTruthy()
    expect(JSON.parse(snap.data['qc.reports'])).toHaveLength(1)
  })

  it('records what it did', async () => {
    put([report('a', '900'), report('b', '404'), report('c', '404')])
    const { migrationLog } = await load()
    expect(migrationLog()).toHaveLength(1)
    expect(migrationLog()[0]).toMatchObject({ from: 0, to: 4, held: 3, orphaned: 2 })
  })

  it('does not run twice, so a deleted fixture report stays deleted', async () => {
    let store = await load()
    store.getReports()                       // installs the fixture
    store.deleteReport('seed-1')
    expect(raw().map((r) => r.id)).not.toContain('seed-1')

    store = await load()                     // a fresh page load
    expect(store.getReports().map((r) => r.id)).not.toContain('seed-1')
  })

  it('leaves an empty store empty apart from the fixture', async () => {
    const { getReports } = await load()
    expect(getReports().map((r) => r.id)).toEqual(['seed-1'])
  })
})

describe('adopting an orphan', () => {
  it('reattaches it to a job that exists and says where it came from', async () => {
    put([report('mine', '404')])
    const { orphanedReports, adoptReport, getReports } = await load()
    expect(orphanedReports()).toHaveLength(1)

    const moved = adoptReport('mine', '900', 'QA Lead')
    expect(moved.jobNo).toBe('900')
    expect(moved.values.jobNo).toBe('900')
    expect(moved.movedFrom).toEqual([{ from: '404', at: expect.any(String), by: 'QA Lead' }])
    expect(orphanedReports()).toHaveLength(0)
    expect(getReports().map((r) => r.id)).toContain('mine')
  })

  it('refuses a job that does not exist, and changes nothing', async () => {
    put([report('mine', '404')])
    const { adoptReport, orphanedReports, UnknownJobError } = await load()
    expect(() => adoptReport('mine', '123')).toThrow(UnknownJobError)
    expect(orphanedReports()).toHaveLength(1)
  })

  it('keeps every earlier move on the record', async () => {
    put([report('mine', '404', { movedFrom: [{ from: '111', at: '2026-01-01T00:00:00.000Z', by: 'Someone' }] })])
    const { adoptReport } = await load()
    expect(adoptReport('mine', '900', 'QA Lead').movedFrom).toHaveLength(2)
  })
})
