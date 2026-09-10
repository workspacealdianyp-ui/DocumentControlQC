import React from 'react'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { FORM_SCHEMAS } from '../../src/data/formSchemas.js'
import { seedReports } from '../../src/data/seedReports.js'
import { ReportSheets, reportSheetCount } from '../../src/components/PrintReport.jsx'
import MdrReport from '../../src/components/MdrReport.jsx'
import { reportPlan, printValue } from '../../src/lib/printLayout.js'

const job = { jobNo: '1000300001', customerName: 'Long customer name for industrial equipment', productDesc: 'Fabricated process vessel', required: [], deliverables: {} }
const record = (key, extra = {}) => ({ id: key, reportId: `QC/${key}/01`, formKey: key, jobNo: job.jobNo, status: 'approved', inspector: 'Inspector', values: { inspDate: '2026-09-09' }, results: [], photos: [], readings: [], coats: [], ...extra })
const doc = (key, report, props = {}) => new DOMParser().parseFromString(renderToStaticMarkup(<ReportSheets schema={FORM_SCHEMAS[key]} report={report} job={job} {...props} />), 'text/html')

it.each(Object.keys(FORM_SCHEMAS))('%s uses the same document identity and exact planned sheet count', (key) => {
  const report = record(key)
  const output = doc(key, report)
  const count = reportSheetCount(FORM_SCHEMAS[key], report, 1, false, job)
  expect(output.querySelectorAll('.print-sheet')).toHaveLength(count)
  expect(output.querySelectorAll('.ps-letterhead')).toHaveLength(count)
  expect(output.querySelectorAll('.ps-footer')).toHaveLength(count)
  expect(output.querySelector('.ps-footer').textContent).toContain(`of ${count}`)
  expect(output.querySelector('.ps-number').textContent).toContain(report.reportId)
})

it('points MDR contents to the actual report starts in the bound document', () => {
  const reports = [record('visual'), record('itp', { photos: [{ img: 'data:image/png;base64,AA==', label: 'Signed page' }] })]
  const html = renderToStaticMarkup(<MdrReport job={job} reports={reports} session={{ name: 'QA compiler' }} onClose={() => {}} />)
  const output = new DOMParser().parseFromString(html, 'text/html')
  const sheets = [...output.querySelectorAll('.print-sheet')]
  const entries = [...output.querySelectorAll('.ps-toc tbody tr')].slice(2)
  expect(entries).toHaveLength(reports.length)
  for (const entry of entries) {
    const cells = entry.querySelectorAll('td')
    const number = cells[2].textContent
    const first = sheets.findIndex((sheet) => sheet.querySelector('.ps-number strong')?.textContent === number)
    expect(Number(cells[5].textContent)).toBe(first + 1)
  }
  expect(sheets.at(-1).querySelector('.ps-footer').textContent).toContain(`of ${sheets.length}`)
  sheets.slice(1).forEach((sheet, i) => expect(sheet.querySelector('.ps-form-control tr:last-child td').textContent).toBe(`${i + 2} of ${sheets.length}`))
})

describe('compact controlled forms', () => {
  it('uses three form-control lines and the same page numbers as the footer', () => {
    const report = record('visual', { formRevision: 0 })
    const output = doc('visual', report, { pageMap: [[12, 12]], pageTotal: 20 })
    const controls = [...output.querySelectorAll('.ps-form-control tr')].slice(0, 3)
    expect(controls.map((row) => row.querySelector('th').textContent)).toEqual(['Form no.', 'Revision', 'Page'])
    expect(controls.map((row) => row.querySelector('td').textContent)).toEqual([FORM_SCHEMAS.visual.formNo, '0', '12 of 20'])
    expect(output.querySelector('.ps-footer').textContent).toContain('Page 12 of 20')
  })

  it('keeps the attached document revision separate from the form revision', () => {
    const output = doc('itp', record('itp', { values: { rev: 'C' } }))
    expect(output.querySelector('.ps-form-control tr:nth-child(2) td').textContent).toBe('—')
    expect([...output.querySelectorAll('.ps-facts .ps-c-value')].map((cell) => cell.textContent)).toContain('C')
  })

  it.each(['hydrotest', 'blasting', 'mt', 'pt', 'ut', 'visual', 'dimensional'])('%s puts recorded results on the first page before supporting settings', (key) => {
    const report = seedReports().find((r) => r.formKey === key && r.status === 'approved')
    const plan = reportPlan(FORM_SCHEMAS[key], report, job)
    const first = plan[0]
    const at = first.findIndex((block) => ['results', 'recording', 'dft'].includes(block.kind))
    expect(at).toBeGreaterThanOrEqual(0)
    expect(first[at].from).toBe(0)
    expect(first[at].to).toBeGreaterThanOrEqual(3)
    const all = plan.flat()
    const support = all.findIndex((block) => ['equipment', 'instrument', 'calibration', 'equip', 'coating'].includes(block.id))
    if (support >= 0) expect(all.indexOf(first[at])).toBeLessThan(support)
  })

  it('keeps an odd number of dimensional points in order across paired continuation tables', () => {
    const results = Array.from({ length: 41 }, (_, i) => ({ itemNo: `D-${i + 1}`, description: `Checking point ${i + 1}`, nominal: 10, min: 9, max: 11, actual: i === 40 ? 12 : 10, note: i === 40 ? 'OUTSIDE-UPPER-LIMIT' : '' }))
    const output = doc('dimensional', record('dimensional', { results }))
    const ids = [...output.querySelectorAll('.ps-dim-grid tbody td.ps-left > strong')].map((node) => node.textContent)
    expect(ids).toEqual(results.map((row) => row.itemNo))
    expect(output.querySelectorAll('.ps-dim-empty')).toHaveLength(1)
    expect(output.querySelectorAll('.ps-dim-grid')).not.toHaveLength(1)
    const last = [...output.querySelectorAll('.ps-dim-grid tbody tr')].at(-1)
    expect(last.textContent).toContain('OUTSIDE-UPPER-LIMIT')
    expect(last.textContent).toContain('Δ 2.00')
    expect(last.textContent).toContain('Reject')
  })
})

describe('evidence survives the layout', () => {
  it('retains every NDE drawing and metadata fact, including material specification', () => {
    const report = record('mt', { values: { materialSpec: 'ASTM A36', ndeMap: [1,2,3].map((n) => ({ img: `data:image/png;base64,MAP${n}`, label: `DRAWING-${n}` })) } })
    const output = doc('mt', report)
    expect(output.body.textContent).toContain('ASTM A36')
    expect([...output.querySelectorAll('.ps-evidence-full img')].map((img) => img.getAttribute('src'))).toEqual(['data:image/png;base64,MAP1','data:image/png;base64,MAP2','data:image/png;base64,MAP3'])
  })

  it('keeps all rows of a long report once each, with repeated table headings', () => {
    const report = record('visual', { results: Array.from({ length: 65 }, (_, i) => ({ point: `POINT-${i + 1}-END`, description: 'Recorded inspection of the weld and surrounding material.', judgement: 'OK', remark: 'Reference the marked drawing.' })) })
    const output = doc('visual', report)
    const text = output.body.textContent
    for (const row of report.results) expect(text.split(row.point)).toHaveLength(2)
    expect(output.querySelectorAll('.ps-results')).toHaveLength(reportPlan(FORM_SCHEMAS.visual, report, job).flat().filter((b) => b.kind === 'results').length)
    expect(output.querySelectorAll('.ps-results')).not.toHaveLength(1)
  })

  it('does not discard long notes when splitting field blocks', () => {
    const notes = 'Check this complete observation against the associated drawing.\n'.repeat(60)
    const report = record('itp', { values: { notes } })
    const pieces = reportPlan(FORM_SCHEMAS.itp, report, job).flat().filter((b) => b.kind === 'fields').flatMap((b) => b.rows.flat()).filter((f) => f.label.startsWith('Notes'))
    expect(pieces.map((p) => p.value).join('')).toBe(notes)
    expect(pieces.length).toBeGreaterThan(1)
  })

  it('preserves zero measurements and conditional hydrotest equipment', () => {
    const report = record('hydrotest', { values: { gauges: '1 Gauge', useRecorder: 'Not used', useTemp: 'Not used', pg2: 'HIDDEN-GAUGE', pressureUnit: 'Bar' }, readings: [{ pg1: 0, time: '08:00' }] })
    const output = doc('hydrotest', report)
    expect(printValue(0)).toBe('0')
    expect(output.body.textContent).not.toContain('HIDDEN-GAUGE')
    expect(output.querySelector('.ps-grid-rec tbody').textContent).toContain('0')
    expect(output.querySelector('.ps-grid-rec thead').textContent).not.toContain('PG 2')
  })

  it('uses full-page frames for signed document pages and keeps every caption', () => {
    const report = record('irn', { photos: Array.from({ length: 3 }, (_, i) => ({ img: 'data:image/png;base64,AA==', label: `SIGNED-PAGE-${i + 1}` })) })
    const output = doc('irn', report)
    expect(output.querySelectorAll('.ps-evidence-full')).toHaveLength(3)
    expect(output.querySelector('.ps-statement')).toBeNull()
    report.photos.forEach((photo) => expect(output.body.textContent).toContain(photo.label))
  })

  it.each(['submitted','returned','voided'])('prints the actual %s lifecycle without calling it final', (status) => {
    const output = doc('visual', record('visual', { status }))
    const expected = { submitted: 'Awaiting QA', returned: 'Sent back', voided: 'Voided' }[status]
    expect(output.querySelector('.ps-control').textContent).toContain(expected)
    expect(output.querySelector('.ps-control').textContent).not.toContain('FINAL')
  })

  it('shows PDI context in the report title and preserves captured signatures only', () => {
    const report = record('visual', { values: { signInspector: { name: 'Inspector without a captured mark' } } })
    const output = doc('visual', report, { deliverable: 'PDI' })
    expect(output.querySelector('h1').textContent).toBe('Pre-Delivery Inspection Report')
    expect(output.querySelector('.ps-sign-img')).toBeNull()
    expect(output.body.textContent).toContain('Inspector without a captured mark')
  })
})
