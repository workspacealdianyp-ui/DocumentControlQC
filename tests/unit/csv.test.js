import { describe, it, expect, vi } from 'vitest'
import { csvCell, csvRow, csvText, downloadCsv, stampToday } from '../../src/lib/csv.js'

describe('csvCell', () => {
  it('quotes every value, so a comma cannot split a column', () => {
    expect(csvCell('BUCKET, 20KL')).toBe('"BUCKET, 20KL"')
  })

  it('doubles an embedded quote instead of changing the data', () => {
    // The old exporter wrote "6" of weld" and shifted every column after
    // it; the other replaced the quote with an apostrophe.
    expect(csvCell('6" of weld')).toBe('"6"" of weld"')
    expect(csvCell('PT "Sinar" Abadi')).toBe('"PT ""Sinar"" Abadi"')
  })

  it('defuses a value a spreadsheet would run as a formula', () => {
    for (const risky of ['=1+1', '+44', '-40C RATING', '@SUM(A1)']) {
      expect(csvCell(risky)).toBe(`"\t${risky}"`)
    }
  })

  it('leaves an ordinary value alone', () => {
    expect(csvCell('1000300001')).toBe('"1000300001"')
    expect(csvCell('WBS-26-0147')).toBe('"WBS-26-0147"')
  })

  it('normalises line endings inside a field', () => {
    expect(csvCell('one\r\ntwo\rthree')).toBe('"one\ntwo\nthree"')
  })

  it('writes an empty field for nothing at all', () => {
    expect(csvCell(null)).toBe('""')
    expect(csvCell(undefined)).toBe('""')
    expect(csvCell('')).toBe('""')
  })

  it('keeps a zero, which is a number and not nothing', () => {
    expect(csvCell(0)).toBe('"0"')
    expect(csvCell(false)).toBe('"false"')
  })

  it('carries unicode through unchanged', () => {
    expect(csvCell('Ø 120 mm · 25 °C')).toBe('"Ø 120 mm · 25 °C"')
  })
})

describe('csvRow', () => {
  it('joins cells with commas', () => {
    expect(csvRow(['a', 'b'])).toBe('"a","b"')
  })

  it('survives a row where every field is hostile', () => {
    expect(csvRow(['=A1', 'has "quotes"', 'a,b', null]))
      .toBe('"\t=A1","has ""quotes""","a,b",""')
  })
})

describe('csvText', () => {
  it('leads with a BOM so Excel reads it as UTF-8', () => {
    expect(csvText([['x']]).charCodeAt(0)).toBe(0xfeff)
  })

  it('separates records with CRLF', () => {
    expect(csvText([['a'], ['b']])).toBe('﻿"a"\r\n"b"')
  })

  it('round-trips through a strict parser', () => {
    const rows = [
      ['Report ID', 'Customer', 'Note'],
      ['MFG/DIM/1000300001/01', 'PT "Sinar" Abadi', 'gap 6" — see\nphoto'],
      ['MFG/LHT/1000300002/01', 'Customer, 05', '-40C RATING'],
    ]
    const parsed = parseCsv(csvText(rows))
    expect(parsed).toEqual([
      ['Report ID', 'Customer', 'Note'],
      ['MFG/DIM/1000300001/01', 'PT "Sinar" Abadi', 'gap 6" — see\nphoto'],
      // The tab is the defusing prefix and is part of what the reader sees.
      ['MFG/LHT/1000300002/01', 'Customer, 05', '\t-40C RATING'],
    ])
  })
})

describe('downloadCsv', () => {
  it('clicks a link, cleans it up, and holds the URL until the download starts', () => {
    vi.useFakeTimers()
    const url = 'blob:test'
    URL.createObjectURL = vi.fn(() => url)
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    downloadCsv('qc.csv', [['a']])

    expect(click).toHaveBeenCalledOnce()
    expect(document.querySelector('a[download]')).toBeNull()
    // Revoking in the same tick cancels the download in some browsers.
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(url)
    vi.useRealTimers()
  })
})

describe('stampToday', () => {
  it('stamps a filename in an order that sorts', () => {
    expect(stampToday(new Date('2026-09-09T22:15:00Z'))).toBe('2026-09-09')
  })
})

/* A deliberately strict reader, so the tests check the file rather than
   the function that wrote it. */
function parseCsv(text) {
  const s = text.replace(/^\uFEFF/, '')
  const rows = [[]]
  let field = ''
  let quoted = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { rows[rows.length - 1].push(field); field = '' }
    else if (c === '\r' && s[i + 1] === '\n') { rows[rows.length - 1].push(field); field = ''; rows.push([]); i++ }
    else field += c
  }
  rows[rows.length - 1].push(field)
  return rows
}
