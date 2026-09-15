import { describe, it, expect } from 'vitest'
import { reportSheetCount } from '../../src/components/PrintReport.jsx'
import { reportPlan } from '../../src/lib/printLayout.js'
import { FORM_SCHEMAS, dimRowStatus, dimDeviation, dimLimits } from '../../src/data/formSchemas.js'

const rep = (over = {}) => ({ id: 'r1', reportId: 'MFG/X/1/01', values: {}, results: [], readings: [], photos: [], ...over })

describe('the report page plan', () => {
  it('does not create a blank attachment sheet for a document with no evidence', () => {
    expect(reportSheetCount(FORM_SCHEMAS.itp, rep())).toBe(1)
  })

  it('prints a concise overall decision without a narrative statement', () => {
    const blocks = reportPlan(FORM_SCHEMAS.hydrotest, rep({ values: { testResult: 'Satisfactory' } })).flat()
    expect(blocks.find((b) => b.kind === 'verdict')?.text).toBe('Satisfactory')
    expect(blocks.some((b) => b.kind === 'statement')).toBe(false)
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
    expect(f).toContain('inspStage')
  })

  // Two facts locate a drawing again: which drawing, and the stage it
  // was measured at. "View / area shown" described the picture printed
  // directly beneath it, and the tag number was filled N/A on every
  // report in the register.
  it('asks only what the drawing does not already show', () => {
    const f = sec('drawing').fields.map((x) => x.id)
    expect(f).toEqual(['drawingNo', 'inspStage', 'drawingFile'])
  })

  // The number is stamped in the corner of the drawing it names rather
  // than set as a fact in a table above the picture.
  it('stamps the drawing number on the drawing', () => {
    expect(sec('drawing').fields.find((x) => x.id === 'drawingNo').tagFor).toBe('drawingFile')
  })

  it('leads the table with the balloon letter, and requires one', () => {
    const cols = sec('results').columns
    expect(cols[0].id).toBe('itemNo')
    expect(cols[0].req).toBe('M')
  })

  /* The nominal is the drawing dimension and Min/Max are the tolerance
     either side of it, so the three sit on one line in that proportion:
     the figure at four sixths, the pair that qualifies it sharing the
     last two. Stacked, one dimension cost three lines. */
  it('sets the nominal against its tolerance on one line', () => {
    const by = Object.fromEntries(sec('results').columns.map((c) => [c.id, c]))
    expect(by.nominal.span).toBe(4)
    expect(by.min.span).toBe(1)
    expect(by.max.span).toBe(1)
    expect(by.nominal.span + by.min.span + by.max.span).toBe(6)
  })

  // A label naming itself is not an instruction: "Dim." over an empty
  // box does not say whether it wants the letter, the dimension or the
  // drawing's callout number.
  it('says what goes in the columns a label cannot explain', () => {
    const by = Object.fromEntries(sec('results').columns.map((c) => [c.id, c]))
    expect(by.itemNo.hint).toBeTruthy()
    expect(by.description.hint).toBeTruthy()
  })
})
