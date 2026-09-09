import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/lib/jobOrders.js', () => ({
  allJobs: () => [{ jobNo: '900' }],
  getOrders: () => [], saveOrder: () => {}, orderById: () => null,
  takenJobNos: () => new Set(), requiredFor: () => [],
}))
vi.mock('../../src/data/seedReports.js', () => ({ seedReports: () => [], SEED_COUNTERS: {}, SEED_STAMP: 'test' }))

const load = async () => { vi.resetModules(); return import('../../src/lib/store.js') }
let store
beforeEach(async () => { store = await load() })

describe('setting a status by hand', () => {
  it('keeps who, when, why, and what it was before', async () => {
    const { setOverride, getOverrides, overrideHistory } = store
    setOverride('900', 'ITP', 'done', {
      by: 'QA Lead', reason: 'ITP signed on paper, filed in the project folder', evidenceRef: 'TRN-2026-018',
    })

    expect(getOverrides()['900'].ITP).toBe('done')
    const [event] = overrideHistory('900', 'ITP')
    expect(event).toMatchObject({
      jobNo: '900', deliverable: 'ITP',
      fromStatus: null, toStatus: 'done',
      reason: 'ITP signed on paper, filed in the project folder',
      evidenceRef: 'TRN-2026-018', actor: 'QA Lead',
    })
    expect(event.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('refuses to record one without a reason, and changes nothing', async () => {
    const { setOverride, getOverrides, overrideEvents, OverrideReasonRequiredError } = store
    expect(() => setOverride('900', 'ITP', 'done', { by: 'QA Lead' })).toThrow(OverrideReasonRequiredError)
    expect(() => setOverride('900', 'ITP', 'done', { by: 'QA Lead', reason: '  ' })).toThrow(OverrideReasonRequiredError)
    expect(getOverrides()).toEqual({})
    expect(overrideEvents()).toEqual([])
  })

  it('records the previous value when one is changed', async () => {
    const { setOverride, overrideHistory } = store
    setOverride('900', 'ITP', 'done', { by: 'QA Lead', reason: 'signed on paper' })
    setOverride('900', 'ITP', 'notstarted', { by: 'QA Lead', reason: 'the paper copy was for the wrong unit' })

    const history = overrideHistory('900', 'ITP')
    expect(history).toHaveLength(2)
    expect(history[1]).toMatchObject({ fromStatus: 'done', toStatus: 'notstarted' })
  })

  it('appends when an override is taken off rather than erasing the reason it was put on', async () => {
    const { setOverride, getOverrides, overrideHistory } = store
    setOverride('900', 'ITP', 'done', { by: 'QA Lead', reason: 'signed on paper' })
    setOverride('900', 'ITP', null, { by: 'QA Lead', reason: 'raising the document properly instead' })

    expect(getOverrides()['900']?.ITP).toBeUndefined()
    const history = overrideHistory('900', 'ITP')
    expect(history).toHaveLength(2)
    expect(history[0].reason).toBe('signed on paper')      // still there
    expect(history[1]).toMatchObject({ fromStatus: 'done', toStatus: null })
  })

  it('keeps one job’s history out of another’s', async () => {
    const { setOverride, overrideHistory } = store
    setOverride('900', 'ITP', 'done', { by: 'QA Lead', reason: 'a' })
    setOverride('901', 'ITP', 'done', { by: 'QA Lead', reason: 'b' })
    expect(overrideHistory('900')).toHaveLength(1)
    expect(overrideHistory('901')).toHaveLength(1)
  })

  it('names the actor as unknown rather than pretending nobody did it', async () => {
    const { setOverride, overrideHistory } = store
    setOverride('900', 'ITP', 'done', { reason: 'signed on paper' })
    expect(overrideHistory('900', 'ITP')[0].actor).toBe('unknown')
  })
})
