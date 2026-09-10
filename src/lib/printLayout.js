import { reportResult } from './verdict.js'
import { dimRowStatus } from '../data/formSchemas.js'

// Physical dimensions shared by the preview fitter and the report planner.
export const PRINT_GEOMETRY = { width: 210, height: 297, top: 12, bottom: 14, side: 10, body: 208, minZoom: 0.9 }
export const printDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
export const printValue = (value) => value === undefined || value === null || value === '' ? '—' : Array.isArray(value) ? value.join(', ') : String(value)
export const printStatus = (status) => ({ approved: 'Approved', submitted: 'Awaiting QA', returned: 'Sent back', voided: 'Voided', draft: 'Draft' }[status] || 'Draft')

export function printValues(schema, report, job) {
  const defaults = Object.fromEntries(schema.sections.flatMap((s) => (s.fields || []).filter((f) => f.default !== undefined).map((f) => [f.id, f.default])))
  return { ...defaults, jobNo: job?.jobNo, customer: job?.customerName, jobDesc: job?.productDesc,
    sn: job?.arasSN, unit: job?.unitNo, wbsNo: job?.wbsNo, poNo: job?.poNo,
    ...(report.values || {}), reportId: report.reportId || report.values?.reportId, inspector: report.inspector || report.values?.inspector }
}

export const printField = (field, values, report) => {
  let value = field.type === 'computed' ? field.compute?.(values, report) : values[field.id] ?? field.default
  if (field.type === 'date' || field.fmt === 'date') value = printDate(value)
  const unit = field.unitFrom ? values[field.unitFrom] : field.unit
  const compactLabels = { inspector: 'Inspector', finalStatus: 'Final result', ncr: 'NCR / remarks', ndeMapRef: 'Drawing / map ref.', ndeMapNote: 'Point numbering', equipId: 'Equipment ID / S/N' }
  return { label: compactLabels[field.id] || (typeof field.label === 'function' ? field.label(values) : field.label),
    value: `${printValue(value)}${unit && value !== undefined && value !== null && value !== '' && ['number', 'text'].includes(field.type) ? ` ${unit}` : ''}`,
    wide: field.type === 'textarea' || String(value ?? '').length > 150 }
}

const lines = (value, width) => String(value).split('\n').reduce((count, paragraph) => {
  let used = 0, total = 1
  for (const word of paragraph.split(/\s+/)) {
    if (used && used + word.length + 1 > width) { total++; used = 0 }
    total += Math.max(0, Math.ceil(word.length / width) - 1)
    used += word.length % width + (used ? 1 : 0)
  }
  return count + total
}, 0)
const fieldsHeight = (row) => 2.1 + Math.max(...row.map((f) => Math.max(lines(f.label, 24), lines(f.value, row.length === 1 ? 114 : 44)))) * 3.8
const dimHeight = (row) => 2.2 + Math.max(3, 1 + lines(printValue(row.description), 19) + (row.note ? lines(`Note: ${row.note}`, 21) : 0), lines(printValue(row.nominal), 17) + 2) * 3.7

// Long notes become explicitly labelled continuations; no text is ellipsized.
function fieldPieces(field) {
  if (field.value.length <= 1100) return [field]
  const pieces = []
  for (let from = 0; from < field.value.length; from += 1100) pieces.push({ ...field, wide: true,
    label: `${field.label}${from ? ' (continued)' : ''}`, value: field.value.slice(from, from + 1100) })
  return pieces
}

export function resultColumnWidths(columns) {
  const weights = columns.map((c) => /partId|point|description|discontinuity|remark|note/.test(c.id) ? 2.2 : 1)
  const total = weights.reduce((a, b) => a + b, 0)
  return [7, ...weights.map((w) => 183 * w / total)]
}

export const resultColumnLabel = (column) => ({ thickness: 'Thk.', amplitude: 'Ampl.', soundpath: 'Sound path', judgement: 'Result', discontinuity: 'Discontinuity' }[column.id] || column.label)

export function recordingLayout(v) {
  const columns = [{ id: 'pg1', label: `PG 1 (${v.pressureUnit})` }]
  if (v.gauges !== '1 Gauge') columns.push({ id: 'pg2', label: `PG 2 (${v.pressureUnit})` })
  if (v.useRecorder !== 'Not used') columns.push({ id: 'rec', label: `Recorder (${v.pressureUnit})` })
  if (v.useTemp !== 'Not used') columns.push({ id: 'water', label: 'Water (°C)' }, { id: 'ambient', label: 'Ambient (°C)' })
  // Remarks need a real text column; equal-width numeric columns left
  // long checkpoint observations wrapping far beyond the planned height.
  return { columns, widths: [8, 14, 14, ...columns.map(() => 110 / columns.length), 44] }
}

export function reportPlan(schema, report, job, { density = 1 } = {}) {
  const v = printValues(schema, report, job)
  const pages = []
  let page = [], used = 0
  const capacity = PRINT_GEOMETRY.body * Math.min(1, Math.max(0.25, density))
  const flush = () => { if (page.length) pages.push(page); page = []; used = 0 }
  const add = (block) => {
    let last = page.at(-1)
    let gap = last?.id === block.id ? 0 : (block.title ? 9 : 2) + (block.headHeight || 0)
    if (page.length && used + block.height + gap > capacity) { flush(); last = null; gap = (block.title ? 9 : 2) + (block.headHeight || 0) }
    if (last?.id === block.id && block.kind === 'fields') last.rows.push(...block.rows)
    else if (last?.id === block.id && ['results', 'recording', 'dft'].includes(block.kind)) last.to = block.to
    else page.push({ ...block, rows: block.rows ? [...block.rows] : undefined })
    used += block.height + gap
  }
  // Follow the inspection sequence: setup/details, the referenced maps,
  // measurements, then the concise overall decision and approvals.
  for (const section of schema.sections) {
    if (section.noPrint || ['setup', 'approvals', 'result'].includes(section.id)) continue
    if (section.type === 'photos') continue
    const id = section.id
    if (['results', 'recording', 'dft'].includes(section.type)) {
      const rows = report[section.type === 'recording' ? 'readings' : section.type === 'dft' ? 'coats' : 'results'] || []
      const cols = (section.columns || []).filter((f) => !f.showIf || f.showIf(v))
      const widths = resultColumnWidths(cols)
      // The repeated table header consumes space on every continuation,
      // including units and wrapped instrument/defect column labels.
      const headHeight = section.autoJudge === 'dim' ? 12 : cols.length
        ? 3 + Math.max(...cols.map((c, k) => lines(`${resultColumnLabel(c)}${c.unit ? ` (${c.unit})` : ''}`, Math.max(5, Math.floor(widths[k + 1] / 1.6))))) * 3.5 : section.type === 'recording' ? 14 : 11
      if (!rows.length) add({ id, kind: section.type, title: section.title, section, from: 0, to: 0, height: 14 })
      const chunks = []
      for (let i = 0; i < rows.length; i += section.autoJudge === 'dim' ? 2 : 1) {
        const row = rows[i]
        const count = cols.length ? Math.max(...cols.map((c, k) => lines(printValue(row[c.id]), Math.max(5, Math.floor(widths[k + 1] / 1.8)))))
          : Math.max(1, lines(row.remark || row.area || '', 24), lines((row.pts || []).join(', '), 22))
        const to = Math.min(rows.length, i + (section.autoJudge === 'dim' ? 2 : 1))
        chunks.push({ id, kind: section.type, title: section.title, section, from: i, to,
          height: section.autoJudge === 'dim' ? Math.max(...rows.slice(i, to).map(dimHeight)) : 2.6 + count * 4.1, headHeight })
      }
      // A results heading needs a useful opening group, not a token row at
      // the bottom of an otherwise administrative page.
      const completeTable = chunks.reduce((sum, block) => sum + block.height, 9 + headHeight)
      // A short table and its decision/signatures read as one result.
      // Longer tables still continue in useful row groups.
      const opening = completeTable <= 85 ? completeTable + 57
        : chunks.slice(0, section.autoJudge === 'dim' ? 2 : 3).reduce((sum, block) => sum + block.height, 9 + headHeight)
      if (page.length && used + opening > capacity) flush()
      chunks.forEach(add)
      continue
    }
    const fields = (section.fields || []).filter((f) => (!f.showIf || f.showIf(v)) && !['sign','photos','photos-inline','jobsearch'].includes(f.type)
      && !(id === 'header' && ['reportId', 'inspDate', 'inspector'].includes(f.id)))
      .flatMap((f) => fieldPieces(printField(f, v, report)))
    const fieldRows = []
    for (let i = 0; i < fields.length;) {
      const row = [fields[i++]]
      if (!row[0].wide && i < fields.length && !fields[i].wide) row.push(fields[i++])
      fieldRows.push(row)
    }
    // Keep a short equipment/identity section intact instead of leaving
    // its final pair of fields alone above the signatures on page two.
    const sectionHeight = fieldRows.reduce((sum, row) => sum + fieldsHeight(row), 9)
    if (page.length && sectionHeight <= 65 && used + sectionHeight > capacity) flush()
    fieldRows.forEach((row) => add({ id, kind: 'fields', title: section.title, rows: [row], height: fieldsHeight(row) }))
    for (const f of section.fields || []) {
      if (!['photos', 'photos-inline'].includes(f.type) || (f.showIf && !f.showIf(v))) continue
      const images = Array.isArray(v[f.id]) ? v[f.id] : []
      images.forEach((photo, i) => add({ id: `${id}-map-${i}`, kind: 'evidence', title: `${typeof f.label === 'function' ? f.label(v) : f.label} ${i + 1} of ${images.length}`, photos: [photo], from: i, total: images.length, full: true, map: true, height: 84 + lines(photo.label || '', 100) * 4 }))
      if (!images.length && /map|drawing/i.test(f.id)) add({ id, kind: 'note', text: `No ${String(f.label).toLowerCase()} attached.`, height: 9 })
    }
  }
  const summary = schema.sections.find((s) => s.id === 'result' && !s.noPrint)
  const approvals = schema.sections.find((s) => s.id === 'approvals')
  if (schema.kind !== 'record' || summary) {
    const recorded = v.testResult || v.finalStatus
    const results = report.results || []
    const decisions = results.map((r) => schema.key === 'dimensional' ? dimRowStatus(r) : r.judgement)
    const result = recorded || (decisions.some((value) => ['Reject', 'Rej', 'NG'].includes(value)) ? 'Reject'
      : decisions.length && decisions.every(Boolean) ? reportResult({ ...report, formKey: schema.key }) : 'Not recorded')
    const fields = (summary?.fields || []).filter((f) => !['finalStatus', 'testResult'].includes(f.id) && (!f.showIf || f.showIf(v)))
      .flatMap((f) => fieldPieces(printField(f, v, report)))
    const closingHeight = 14 + fields.reduce((sum, field) => sum + fieldsHeight([field]) + 2, 0) + (approvals ? 43 : 0)
    if (page.length && closingHeight <= capacity && used + closingHeight > capacity) flush()
    add({ id: 'overall-result', kind: 'verdict', text: result, height: 12 })
    fields.forEach((field) => add({ id: 'overall-notes', kind: 'fields', rows: [[field]], height: fieldsHeight([field]) }))
  }
  if (approvals) add({ id: 'approvals', kind: 'signatures', title: approvals.title, section: approvals, height: 34 })
  const photos = report.photos || []
  if (!photos.length) add({ id: 'no-photos', kind: 'note', title: 'Evidence register', text: 'No photographic evidence or document pages attached.', height: 12 })
  flush()
  if (schema.key === 'hydrotest' && (report.readings || []).length >= 2) pages.push([{ kind: 'chart', title: 'Pressure record analysis' }])
  const perPage = schema.kind === 'record' ? 1 : 2
  for (let from = 0; from < photos.length; from += perPage) pages.push([{ kind: 'evidence', title: schema.kind === 'record' ? 'Filed document' : 'Photographic evidence',
    photos: photos.slice(from, from + perPage), from, total: photos.length, full: perPage === 1 }])
  return pages.length ? pages : [[{ kind: 'note', title: 'Report', text: 'No details recorded.' }]]
}
