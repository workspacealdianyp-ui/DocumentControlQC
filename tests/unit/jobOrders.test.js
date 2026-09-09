import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { saveOrder, getOrders, OrderNotSavedError } from '../../src/lib/jobOrders.js'
import { StorageFullError } from '../../src/lib/store.js'

const order = (extra = {}) => ({
  id: 'po-1', poNo: 'PO-2026-TEST-1', customerName: 'Customer 03', kategori: 'SUPEQ',
  required: ['Dimension Report'],
  units: [{ jobNo: '1000200301', wbsNo: 'WBS-26-0301', unitNo: '200301-001', productDesc: 'BUCKET', type: '' }],
  ...extra,
})

let setItem
beforeEach(() => { setItem = Storage.prototype.setItem })
afterEach(() => { Storage.prototype.setItem = setItem })

describe('publishing a job order', () => {
  it('saves it and reads it back', () => {
    expect(saveOrder(order())).toMatchObject({ poNo: 'PO-2026-TEST-1' })
    expect(getOrders()).toHaveLength(1)
  })

  it('replaces an order being revised rather than forking it', () => {
    saveOrder(order())
    saveOrder(order({ poNo: 'PO-2026-TEST-1', customerName: 'Customer 05' }))
    expect(getOrders()).toHaveLength(1)
    expect(getOrders()[0].customerName).toBe('Customer 05')
  })

  /* The defect: the write helper caught every storage error and returned
     the value as though it had been written, so the screen said
     "published — 4 jobs ready to inspect" and navigated away with
     nothing saved. */
  it('throws when the browser refuses the write, instead of reporting success', () => {
    Storage.prototype.setItem = vi.fn(() => {
      const e = new Error('exceeded the quota')
      e.name = 'QuotaExceededError'
      throw e
    })
    expect(() => saveOrder(order())).toThrow(StorageFullError)
  })

  it('says what to do about it', () => {
    Storage.prototype.setItem = vi.fn(() => { throw new DOMException('full', 'QuotaExceededError') })
    expect(() => saveOrder(order())).toThrow(/Export your records|no room left/i)
  })

  it('throws when the write is accepted but the order is not there afterwards', () => {
    // Private mode on some browsers: setItem succeeds, getItem returns
    // nothing. A save that cannot be read back did not happen.
    Storage.prototype.setItem = vi.fn(() => {})
    expect(() => saveOrder(order())).toThrow(OrderNotSavedError)
  })

  it('throws when what comes back is not what went in', () => {
    Storage.prototype.setItem = vi.fn(function (k) {
      // Half the units land — a truncated write is not a save.
      setItem.call(this, k, JSON.stringify([order({ units: [] })]))
    })
    expect(() => saveOrder(order())).toThrow(OrderNotSavedError)
  })

  it('names the PO in the failure, so the message is about their work', () => {
    Storage.prototype.setItem = vi.fn(() => {})
    expect(() => saveOrder(order())).toThrow(/PO-2026-TEST-1/)
  })
})
