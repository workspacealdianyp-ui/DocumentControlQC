import { describe, it, expect } from 'vitest'
import { reportSheetCount } from '../../src/components/PrintReport.jsx'
import { FORM_SCHEMAS, dimRowStatus, dimDeviation, dimLimits } from '../../src/data/formSchemas.js'

const rep = (over = {}) => ({ id: 'r1', reportId: 'MFG/X/1/01', values: {}, results: [], readings: [], photos: [], ...over })

describe('the report page plan', () => {
  it('does not create a blank attachment sheet for a document with no evidence', () => {
    expect(reportSheetCount(FORM_SCHEMAS.itp, rep())).toBe(1)
  })

  it('omits the statement when the MDR carries it and preserves document records', () => {
    const normal = reportSheetCount(FORM_SCHEMAS.hydrotest, rep())
    expect(reportSheetCount(FORM_SCHEMAS.hydrotest, rep(), 1, true)).toBeLessThanOrEqual(normal)
    expect(reportSheetCount(FORM_SCHEMAS.itp, rep(), 1, true)).toBe(reportSheetCount(FORM_SCHEMAS.itp, rep()))
  })

  it('gives every filed signed page its own readable evidence sheet', () => {
    const base = reportSheetCount(FORM_SCHEMAS.itp, rep())
    const photos = Array.from({ length: 3 }, (_, i) => ({ img: `image-${i}`, label: `Signed page ${i + 1}` }))
    expect(reportSheetCount(FORM_SCHEMAS.itp, rep({ photos }))).toBe(base + 3)
  })

  it('continues long result tables instead of fitting all rows onto one sheet', () => {
    const rows = (n) => Array.from({ length: n }, (_, i) => ({ itemNo: String(i), actual: '1', min: '0', max: '2' }))
    expect(reportSheetCount(FORM_SCHEMAS.dimensional, rep({ results: rows(60) }))).toBeGreaterThan(reportSheetCount(FORM_SCHEMAS.dimensional, rep({ results: rows(6) })))
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
