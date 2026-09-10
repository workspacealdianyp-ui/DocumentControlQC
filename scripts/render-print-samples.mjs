// Render the actual React print components to static HTML for offline PDF
// layout review. No app server, browser session, or production data is used.
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const output = resolve(process.argv[2] || 'tmp/print-review')
await mkdir(output, { recursive: true })
const memory = new Map()
globalThis.localStorage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, String(value)), removeItem: (key) => memory.delete(key) }
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { ReportSheets, reportSheetCount } = await server.ssrLoadModule('/src/components/PrintReport.jsx')
  const { default: MdrReport } = await server.ssrLoadModule('/src/components/MdrReport.jsx')
  const { FORM_SCHEMAS } = await server.ssrLoadModule('/src/data/formSchemas.js')
  const { seedReports, SEED_STAMP } = await server.ssrLoadModule('/src/data/seedReports.js')
  const { jobs } = JSON.parse(await readFile('src/data/joblist.json', 'utf8'))
  const records = seedReports()
  memory.set('qc.seeded.v3', '1'); memory.set('qc.storeVersion', '4'); memory.set('qc.seedStamp', SEED_STAMP)
  memory.set('qc.reports', JSON.stringify(records))
  const css = await readFile('src/print.css', 'utf8')
  const samples = []
  async function save(name, component, expected) {
    const body = renderToStaticMarkup(component)
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${name} - design review</title><style>${css}\n@page { @bottom-left { content: 'DEMONSTRATION / DESIGN REVIEW'; font: 7pt Arial; color: #666; } }</style></head><body class="printing">${body}</body></html>`
    await writeFile(resolve(output, `${name}.html`), html)
    samples.push({ name, expected: expected || (body.match(/class="print-sheet/g) || []).length })
  }
  for (const [key, schema] of Object.entries(FORM_SCHEMAS)) {
    const report = records.find((r) => r.formKey === key && r.status === 'approved') || { id: key, reportId: `SAMPLE/${key}/01`, formKey: key, values: {}, status: 'draft' }
    const job = jobs.find((j) => String(j.jobNo) === String(report.jobNo)) || jobs[0]
    await save(key, React.createElement(ReportSheets, { schema, report, job, status: report.status, deliverable: report.deliverable }), reportSheetCount(schema, report, 1, false, job))
  }
  const job = jobs[0]
  await save('mdr', React.createElement(MdrReport, { job, reports: records.filter((r) => String(r.jobNo) === String(job.jobNo) && r.status === 'approved'), session: { name: 'QA sample compiler' }, onClose() {} }))
  const source = records.find((r) => r.formKey === 'visual')
  const stress = { ...source, id: 'stress', reportId: 'SAMPLE/LONG-REPORT/01', status: 'returned', values: { ...source.values, ncr: 'Long inspection finding with traceable references. '.repeat(65) },
    results: Array.from({ length: 60 }, (_, i) => ({ ...source.results[0], point: `POINT-${String(i + 1).padStart(3, '0')}`, remark: 'Verify this recorded observation against the marked drawing and the identified weld joint. '.repeat(2) })), photos: Array.from({ length: 5 }, (_, i) => ({ ...source.photos[0], label: `Evidence ${i + 1}` })) }
  await save('long-report', React.createElement(ReportSheets, { schema: FORM_SCHEMAS.visual, report: stress, job }), reportSheetCount(FORM_SCHEMAS.visual, stress, 1, false, job))
  const dimensional = records.find((r) => r.formKey === 'dimensional')
  const dense = { ...dimensional, id: 'dense-dim', reportId: 'SAMPLE/DIMENSIONAL/41', results: Array.from({ length: 41 }, (_, i) => ({ itemNo: `DIM-${i + 1}`, description: `Frame checking point ${i + 1}`, nominal: 100, min: 98, max: 102, actual: i % 9 === 0 ? 103 : 100, note: i % 9 === 0 ? 'Outside upper limit; verify after correction.' : '' })) }
  await save('dimensional-41', React.createElement(ReportSheets, { schema: FORM_SCHEMAS.dimensional, report: dense, job }), reportSheetCount(FORM_SCHEMAS.dimensional, dense, 1, false, job))
  const hydro = records.find((r) => r.formKey === 'hydrotest')
  const longHydro = { ...hydro, id: 'long-hydro', reportId: 'SAMPLE/HYDROTEST/20', readings: Array.from({ length: 20 }, (_, i) => ({ ...hydro.readings[i % hydro.readings.length], time: `09:${String(i * 2).padStart(2, '0')}`, remark: i % 3 === 0 ? 'Recorded pressure stable during the observation interval; checked against the instrument log.' : 'Stable' })) }
  await save('hydrotest-20', React.createElement(ReportSheets, { schema: FORM_SCHEMAS.hydrotest, report: longHydro, job }), reportSheetCount(FORM_SCHEMAS.hydrotest, longHydro, 1, false, job))
  await writeFile(resolve(output, 'manifest.json'), JSON.stringify(samples, null, 2))
  console.log(JSON.stringify(samples))
} finally { await server.close() }
