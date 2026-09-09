import { describe, it, expect } from 'vitest'
import { reportSheetCount } from '../../src/components/PrintReport.jsx'
import { FORM_SCHEMAS, dimRowStatus, dimDeviation, dimLimits } from '../../src/data/formSchemas.js'

const rep = (over = {}) => ({ id: 'r1', reportId: 'MFG/X/1/01', values: {}, results: [], readings: [], photos: [], ...over })

/* Every schema here has a Photo Evidence section, and the attachment
   sheet follows the section rather than the pictures — an empty one
   prints "No photos attached", which is a statement about the record
   and not a page to omit. So one sheet of each count below is that. */
describe('how many sheets a report prints on', () => {
  it('gives a hydrotest its own statement sheet', () => {
    expect(reportSheetCount(FORM_SCHEMAS.hydrotest, rep())).toBe(3)   // form + attachments + statement
  })

  it('drops that sheet when the book makes one statement for the unit', () => {
    expect(reportSheetCount(FORM_SCHEMAS.hydrotest, rep(), 1, true)).toBe(2)
  })

  it('never gave a document record one to drop', () => {
    // An ITP is somebody else's document on file. A page declaring that
    // this shop carried it out and hereby accepts the object would be
    // false on both halves, so there was never one to suppress.
    expect(reportSheetCount(FORM_SCHEMAS.itp, rep())).toBe(2)
    expect(reportSheetCount(FORM_SCHEMAS.itp, rep(), 1, true)).toBe(2)
  })

  it('keeps a one-page report to one page either way', () => {
    // MT and the dimensional report carry their statement inline, so
    // suppressing it changes what is on the sheet, not how many there are.
    for (const key of ['mt', 'dimensional']) {
      expect(reportSheetCount(FORM_SCHEMAS[key], rep())).toBe(2)
      expect(reportSheetCount(FORM_SCHEMAS[key], rep(), 1, true)).toBe(2)
    }
  })

  it('continues a table that outruns its sheet', () => {
    // 22 rows fit the two-column grid; the 23rd starts a continuation.
    const rows = (n) => Array.from({ length: n }, (_, i) => ({ itemNo: String(i), actual: '1', min: '0', max: '2' }))
    expect(reportSheetCount(FORM_SCHEMAS.dimensional, rep({ results: rows(22) }))).toBe(2)
    expect(reportSheetCount(FORM_SCHEMAS.dimensional, rep({ results: rows(30) }))).toBe(3)
  })
})

describe('the dimensional row, as the sheet reads it', () => {
  const row = { itemNo: 'B', nominal: '1869', min: '1866', max: '1872', actual: '1867' }

  it('judges against the limits on the drawing', () => {
    expect(dimRowStatus(row)).toBe('Accept')
    expect(dimRowStatus({ ...row, actual: '1874' })).toBe('Reject')
  })

  it('reports the deviation from nominal, not from the limit', () => {
    expect(dimDeviation(row)).toBe('-2.00')
    expect(dimDeviation({ ...row, actual: '1872' })).toBe('3.00')
  })

  it('reads a symmetric band off min and max', () => {
    expect(dimLimits(row)).toEqual({ lo: 1866, hi: 1872 })
  })

  it('leaves a row with no limits unjudged rather than accepting it', () => {
    expect(dimRowStatus({ itemNo: 'A', nominal: '100', actual: '100' })).toBe('')
  })
})

describe('the dimensional form asks for what the sheet prints', () => {
  const dim = FORM_SCHEMAS.dimensional
  const sec = (id) => dim.sections.find((s) => s.id === id)

  it('carries the point map above the measurements', () => {
    const ids = dim.sections.map((s) => s.id)
    expect(ids.indexOf('drawing')).toBeLessThan(ids.indexOf('results'))
    const f = sec('drawing').fields.map((x) => x.id)
    expect(f).toContain('drawingFile')
    expect(f).toContain('viewName')
    expect(f).toContain('inspStage')
  })

  it('leads the table with the balloon letter, and requires one', () => {
    const cols = sec('results').columns
    expect(cols[0].id).toBe('itemNo')
    expect(cols[0].req).toBe('M')
  })
})
