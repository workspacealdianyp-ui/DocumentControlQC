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
  const count = reportSheetCount(FORM_SCHEMAS[key], report, 1, job)
  expect(output.querySelectorAll('.print-sheet')).toHaveLength(count)
  expect(output.querySelectorAll('.ps-letterhead')).toHaveLength(count)
  expect(output.querySelectorAll('.ps-footer')).toHaveLength(count)
  expect(output.querySelector('.ps-footer').textContent).toContain(`of ${count}`)
  expect(output.querySelector('.ps-number').textContent).toContain(report.reportId)
})

it('points MDR contents to the actual report starts in the bound document', () => {
  const reports = [record('visual', { deliverable: 'PDI' }), record('itp', { photos: [{ img: 'data:image/png;base64,AA==', label: 'Signed page' }] })]
  const html = renderToStaticMarkup(<MdrReport job={job} reports={reports} session={{ name: 'QA compiler' }} onClose={() => {}} />)
  const output = new DOMParser().parseFromString(html, 'text/html')
  const sheets = [...output.querySelectorAll('.print-sheet')]
  const entries = [...output.querySelectorAll('.ps-toc tbody tr')].slice(2)
  expect(entries).toHaveLength(reports.length)
  for (const entry of entries) {
    const cells = entry.querySelectorAll('td')
    const number = cells[2].textContent
    const first = sheets.findIndex((sheet) => sheet.querySelector('.ps-number strong')?.textContent === number)
    expect(Number(cells[5].textContent)).toBe(first)
    expect(sheets[first - 1].classList.contains('ps-divider-sheet')).toBe(true)
    expect(sheets[first - 1].querySelector('h1').textContent).toBe(sheets[first].querySelector('h1').textContent)
    expect(cells[1].textContent).toBe(sheets[first].querySelector('h1').textContent)
  }
  expect(sheets.at(-1).querySelector('.ps-footer').textContent).toContain(`of ${sheets.length}`)
  sheets.slice(1).forEach((sheet, i) => {
    expect(sheet.querySelector('.ps-footer').textContent).toContain(`Page ${i + 2} of ${sheets.length}`)
    const control = sheet.querySelector('.ps-form-control tr:last-child td')
    if (control) expect(control.textContent).toBe(`${i + 2} of ${sheets.length}`)
  })
  expect(output.querySelectorAll('.ps-divider-sheet')).toHaveLength(reports.length + 3)
  expect(output.body.textContent).not.toContain('Statement of Inspection')
})


it.each([false, true])('retains MDR completeness warnings across dividers (incomplete: %s)', (incomplete) => {
  const reports = [record('visual', { deliverable: 'PDI', results: [{ judgement: 'OK' }] })]
  const requiredJob = { ...job, required: incomplete ? ['PDI', 'ITP'] : ['PDI'] }
  const html = renderToStaticMarkup(<MdrReport job={requiredJob} reports={reports} session={{ name: 'QA compiler' }} onClose={() => {}} />)
  const output = new DOMParser().parseFromString(html, 'text/html')
  const preview = output.querySelector('.print-scaler.is-preview')
  expect(Boolean(preview)).toBe(incomplete)
  if (incomplete) {
    expect(preview.querySelectorAll('.print-sheet')).toHaveLength(output.querySelectorAll('.print-sheet').length)
    expect(preview.querySelectorAll('.ps-divider-sheet')).toHaveLength(4)
    expect(output.querySelector('.ps-cover-verdict').textContent).toContain('PREVIEW — NOT FOR ISSUE')
    expect(output.querySelector('.ps-cover-missing').textContent).toContain('ITP')
    expect(output.querySelector('.ps-cover-verdict').textContent).not.toContain('RELEASED FOR SHIPMENT')
  } else {
    expect(output.querySelector('.ps-cover-verdict').textContent).toContain('RELEASED FOR SHIPMENT')
    expect(output.querySelector('.ps-cover-missing')).toBeNull()
  }
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

  it.each(['hydrotest', 'blasting', 'mt', 'pt', 'ut', 'visual', 'dimensional'])('%s keeps details before results and finishes with a concise decision', (key) => {
    const report = seedReports().find((r) => r.formKey === key && r.status === 'approved')
    const blocks = reportPlan(FORM_SCHEMAS[key], report, job).flat()
    const at = blocks.findIndex((block) => ['results', 'recording', 'dft'].includes(block.kind))
    expect(at).toBeGreaterThanOrEqual(0)
    const support = blocks.findLastIndex((block) => ['equipment', 'instrument', 'calibration', 'equip', 'coating', 'lighting'].includes(block.id))
    if (support >= 0) expect(support).toBeLessThan(at)
    const lastResult = blocks.findLastIndex((block) => ['results', 'recording', 'dft'].includes(block.kind))
    const verdict = blocks.findIndex((block) => block.kind === 'verdict')
    expect(verdict).toBeGreaterThan(lastResult)
    expect(blocks.findIndex((block) => block.kind === 'signatures')).toBeGreaterThan(verdict)
    expect(blocks.some((block) => block.kind === 'statement')).toBe(false)
    const pages = reportPlan(FORM_SCHEMAS[key], report, job)
    const decisionPage = pages.findIndex((page) => page.some((b) => b.kind === 'verdict'))
    const signaturePage = pages.findIndex((page) => page.some((b) => b.kind === 'signatures'))
    expect(signaturePage).toBe(decisionPage)
  })

  it('tables report number, inspector and job without a lifecycle status column', () => {
    const report = record('mt')
    const output = doc('mt', report)
    const table = output.querySelector('.ps-control')
    expect([...table.querySelectorAll('th')].map((cell) => cell.textContent)).toEqual(['Report no.', 'Job', 'Inspection date', 'Inspector'])
    expect(table.textContent).toContain(report.reportId)
    expect(table.textContent).toContain(job.jobNo)
    expect(table.textContent).toContain(report.inspector)
    expect(table.textContent).not.toContain('Status')
    expect(output.body.textContent).not.toContain('Statement of result')
  })

  it('does not invent acceptance for an empty result grid', () => {
    const output = doc('dimensional', record('dimensional'))
    expect(output.querySelector('.ps-overall-result').textContent).toContain('Not evaluated')
  })

  /* The nominal and the tolerance either side of it share one line, and
     the heading says tolerance, because Min and Max are the tolerance —
     "limits" is what the actual is judged against, which is the next
     column along. */
  it('sets the nominal against its tolerance on one line', () => {
    const results = [{ itemNo: 'A', description: 'Overall length', nominal: 90, min: 88, max: 92, actual: 91 }]
    const output = doc('dimensional', record('dimensional', { results }))
    expect(output.querySelector('.ps-dim-grid thead').textContent).toContain('Nominal / tolerance')
    expect(output.querySelector('.ps-dim-grid thead').textContent).not.toContain('limits')
    const spec = output.querySelector('.ps-dim-grid tbody .ps-dim-spec')
    expect(spec.querySelector('.ps-dim-nom').textContent).toBe('90')
    expect(spec.querySelector('.ps-dim-tol').textContent).toBe('Min 88Max 92')
  })

  /* Six points and up read two to a line; five and under get the width
     to themselves, with the note in a column of its own. Pairing a short
     grid halves the page it could have used for nothing. */
  it('gives a short grid the width and pairs a long one', () => {
    const rows = (n) => Array.from({ length: n }, (_, i) => ({ itemNo: String.fromCharCode(65 + i), nominal: 90, min: 88, max: 92, actual: 90, note: i ? '' : 'Checked twice' }))
    const short = doc('dimensional', record('dimensional', { results: rows(5) }))
    expect(short.querySelectorAll('.ps-dim-one')).toHaveLength(1)
    expect(short.querySelectorAll('.ps-dim-grid thead th')).toHaveLength(5)
    expect(short.querySelector('.ps-dim-grid thead').textContent).toContain('Note')
    expect(short.querySelector('.ps-dim-note-cell').textContent).toBe('Checked twice')
    expect(short.querySelectorAll('.ps-dim-grid tbody tr')).toHaveLength(5)

    const long = doc('dimensional', record('dimensional', { results: rows(6) }))
    expect(long.querySelectorAll('.ps-dim-one')).toHaveLength(0)
    expect(long.querySelectorAll('.ps-dim-grid tbody tr')).toHaveLength(3)
  })

  // The map already says what each balloon measures; the column made an
  // inspector retype it.
  it('does not print a description column', () => {
    const results = [{ itemNo: 'A', description: 'Overall length', nominal: 90, min: 88, max: 92, actual: 91 }]
    const output = doc('dimensional', record('dimensional', { results }))
    expect(output.querySelector('.ps-dim-grid thead').textContent).not.toContain('description')
    expect(output.querySelector('.ps-dim-grid tbody').textContent).not.toContain('Overall length')
  })

  /* Page 1 states what the record is. Pages after it say which record
     they continue, and nothing else — the report number, job, date and
     inspector restated on every sheet say nothing new. */
  it('drops the identity table from continuation pages', () => {
    const results = Array.from({ length: 80 }, (_, i) => ({ itemNo: `P${i + 1}`, nominal: 90, min: 88, max: 92, actual: 90 }))
    const output = doc('dimensional', record('dimensional', { results }))
    const sheets = [...output.querySelectorAll('.print-sheet')]
    expect(sheets.length).toBeGreaterThan(1)
    expect(sheets[0].querySelectorAll('.ps-control')).toHaveLength(1)
    sheets.slice(1).forEach((sheet) => {
      expect(sheet.querySelectorAll('.ps-control')).toHaveLength(0)
      expect(sheet.querySelector('.ps-cont-note')).toBeTruthy()
      // still identified, by the line under the letterhead and the footer
      expect(sheet.textContent).toContain('QC/dimensional/01')
    })
  })

  // Accept and reject are told apart by the colour of the word, and the
  // block is one rule rather than a box inside the section's own box.
  it('colours the overall result and leaves the section unboxed', () => {
    const pass = doc('dimensional', record('dimensional', { results: [{ itemNo: 'A', nominal: 90, min: 88, max: 92, actual: 90 }] }))
    expect(pass.querySelector('.ps-overall-result').className).toContain('is-acc')
    const fail = doc('dimensional', record('dimensional', { results: [{ itemNo: 'A', nominal: 90, min: 88, max: 92, actual: 99 }] }))
    expect(fail.querySelector('.ps-overall-result').className).toContain('is-rej')
  })

  /* Name over the rule, position and date under it. The heading says the
     act — prepared by, reviewed by — not the job title. */
  it('sets the signature block in reading order, act over name over position', () => {
    const report = record('dimensional', { values: { inspDate: '2026-09-09',
      signInspector: { name: 'Inspector Two', at: '2026-09-09T09:00:00.000Z' } } })
    const output = doc('dimensional', report)
    const head = output.querySelector('.ps-sign-head')
    expect(head.textContent).toContain('Prepared by')
    expect(head.textContent).toContain('Reviewed by')
    expect(head.textContent).not.toContain('QC Supervisor')
    const box = output.querySelector('.ps-sign-table tr:not(.ps-sign-head) td')
    const order = [...box.children].map((n) => n.className)
    expect(order).toEqual(['ps-sign-space', 'ps-sign-name', 'ps-sign-foot'])
    expect(box.querySelector('.ps-sign-name').textContent).toBe('Inspector Two')
    expect(box.querySelector('.ps-sign-foot').textContent).toContain('Inspector')
  })

  /* A point map is 80mm of sheet. The grid that follows it used to
     reserve the whole table plus the decision and the signatures before
     it would start, so a short grid pushed itself overleaf and left the
     map's page with a hole in it. */
  it('starts the grid under the point map instead of leaving the page half empty', () => {
    const results = Array.from({ length: 6 }, (_, i) => ({ itemNo: String.fromCharCode(65 + i), description: 'Overall length', nominal: 90, min: 88, max: 92, actual: 90 }))
    const report = record('dimensional', { results, values: { inspDate: '2026-09-09', drawingNo: 'DWG-7781-R2', inspStage: 'After welding',
      drawingFile: [{ img: 'data:image/png;base64,AA==', label: 'Points A to F' }] } })
    const pages = reportPlan(FORM_SCHEMAS.dimensional, report, job)
    const mapPage = pages.findIndex((page) => page.some((b) => b.kind === 'evidence' && b.map))
    expect(mapPage).toBeGreaterThanOrEqual(0)
    expect(pages[mapPage].some((b) => b.kind === 'results')).toBe(true)
  })

  // The drawing number is stamped in the corner of the drawing rather
  // than set as a fact in a table above it.
  it('stamps the drawing number on the point map and not above it', () => {
    const report = record('dimensional', { values: { inspDate: '2026-09-09', drawingNo: 'DWG-7781-R2', inspStage: 'After welding',
      drawingFile: [{ img: 'data:image/png;base64,AA==', label: 'Points A to F' }] } })
    const output = doc('dimensional', report)
    expect(output.querySelector('.ps-photo-tag').textContent).toBe('DWG-7781-R2')
    const facts = [...output.querySelectorAll('.ps-facts')].map((t) => t.textContent).join(' ')
    expect(facts).toContain('After welding')
    expect(facts).not.toContain('DWG-7781-R2')
  })

  /* Two signatures was never the real number: a report engineering
     witnessed carries three, one a third party attended carries four.
     Each extra box is headed by the capacity the person signed in, with
     the position they hold under their name. */
  it('prints every approver the inspector recorded', () => {
    const report = record('dimensional', { values: { inspDate: '2026-09-09',
      signInspector: { name: 'Inspector Two', at: '2026-09-09T09:00:00.000Z' },
      approvers: [{ id: '1', name: 'Budi Santoso', position: 'Lead Design Engineer', capacity: 'Engineering' },
        { id: '2', name: 'A. Whitfield', position: 'Surveyor', capacity: 'Third Party (LRQA)' }],
      signExtra_1: { name: 'Budi Santoso', at: '2026-09-10T02:00:00.000Z' } } })
    const output = doc('dimensional', report)
    const block = output.querySelector('.ps-sign-table')
    expect(block.textContent).toContain('Engineering')
    expect(block.textContent).toContain('Third Party (LRQA)')
    expect(block.textContent).toContain('Budi Santoso')
    expect(block.textContent).toContain('Lead Design Engineer')
    // Named but unsigned still prints the name over an empty box.
    expect(block.textContent).toContain('A. Whitfield')
    expect([...output.querySelectorAll('.ps-sign-head')].length).toBe(1)
  })

  // Five boxes on a 190mm sheet is 38mm each, narrower than a signature.
  it('wraps the signature block rather than shrinking the boxes', () => {
    const approvers = Array.from({ length: 4 }, (_, i) => ({ id: String(i + 1), name: `Approver ${i + 1}`, position: 'Engineer', capacity: `Party ${i + 1}` }))
    const report = record('dimensional', { values: { inspDate: '2026-09-09', approvers } })
    const output = doc('dimensional', report)
    expect(output.querySelectorAll('.ps-sign-head')).toHaveLength(2)
    expect([...output.querySelectorAll('.ps-sign-head')][0].children).toHaveLength(4)
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
    expect([...output.querySelectorAll('.ps-evidence-map img')].map((img) => img.getAttribute('src'))).toEqual(['data:image/png;base64,MAP1','data:image/png;base64,MAP2','data:image/png;base64,MAP3'])
    const blocks = reportPlan(FORM_SCHEMAS.mt, report, job).flat()
    const equipment = blocks.findLastIndex((b) => b.id === 'equipment')
    const maps = blocks.map((b, i) => b.map ? i : -1).filter((i) => i >= 0)
    expect(maps.every((i) => i > equipment)).toBe(true)
    expect(Math.max(...maps)).toBeLessThan(blocks.findIndex((b) => b.kind === 'results'))
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
    expect(output.querySelector('.ps-control').textContent).not.toContain(expected)
    if (status !== 'submitted') expect(output.querySelector('.ps-watermark').textContent).toBe(expected)
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

it.each(['approved', 'submitted'])('never releases an unevaluated MDR (%s)', (status) => {
  const reports = [record('visual', { deliverable: 'PDI', status })]
  const html = renderToStaticMarkup(<MdrReport job={{ ...job, required: ['PDI'] }} reports={reports} session={{ name: 'QA compiler' }} onClose={() => {}} />)
  expect(html).not.toContain('RELEASED FOR SHIPMENT')
  expect(html).toContain('NOT EVALUATED')
})
