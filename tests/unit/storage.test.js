import { describe, expect, it, beforeEach } from 'vitest'
import { storageUsage, fmtBytes } from '../../src/lib/storage.js'

/* The gauge told an inspector they were at 45% when they were at 24%,
   because it measured against 5 MB and the browser gives 10. The remedy
   offered beside it is "export and clear records", so reading high is
   the direction that costs evidence. */
beforeEach(() => localStorage.clear())

describe('how full this browser is', () => {
  it('measures against what a browser actually gives an origin', () => {
    const { budget } = storageUsage()
    expect(budget).toBe(10 * 1024 * 1024)
  })

  it('counts only what this app wrote', () => {
    localStorage.setItem('qc.reports', 'x'.repeat(1000))
    localStorage.setItem('somebody.else', 'y'.repeat(50_000))
    const { bytes } = storageUsage()
    // UTF-16: the key plus the value, two bytes a unit.
    expect(bytes).toBe(('qc.reports'.length + 1000) * 2)
  })

  it('does not report pressure that is not there', () => {
    localStorage.setItem('qc.reports', 'x'.repeat(1_200_000))   // ~2.4 MB
    const { pct } = storageUsage()
    expect(pct).toBe(23)          // against 5 MB this read 46
    expect(pct).toBeLessThan(30)
  })

  it('never reads past full, however much is in there', () => {
    // jsdom caps its own localStorage below the real budget, so the
    // clamp is exercised through the budget argument instead of by
    // filling a store that would refuse the write first.
    localStorage.setItem('qc.reports', 'x'.repeat(600_000))   // ~1.2 MB
    expect(storageUsage(256 * 1024).pct).toBe(100)
    expect(storageUsage(10 * 1024 * 1024).pct).toBe(11)
  })

  it('says so when the browser will not answer', () => {
    const real = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new Error('blocked in private mode') },
    })
    const r = storageUsage()
    expect(r.unavailable).toBe(true)
    expect(r.pct).toBe(0)
    Object.defineProperty(window, 'localStorage', real)
  })

  it('writes a size the way a person reads one', () => {
    expect(fmtBytes(512)).toBe('512 B')
    expect(fmtBytes(2048)).toBe('2.0 KB')
    expect(fmtBytes(2.4 * 1024 * 1024)).toBe('2.4 MB')
  })
})
