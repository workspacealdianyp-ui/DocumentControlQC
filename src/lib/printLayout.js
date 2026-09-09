import { buildResume } from './resume.js'

// Physical dimensions shared by the preview fitter and the report planner.
export const PRINT_GEOMETRY = { width: 210, height: 297, top: 12, bottom: 14, side: 10, body: 180, minZoom: 0.9 }
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
  return { label: typeof field.label === 'function' ? field.label(values) : field.label,
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
const fieldsHeight = (row) => 8 + Math.max(...row.map((f) => lines(f.value, row.length === 1 ? 104 : 48))) * 4.1

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

export function reportPlan(schema, report, job, { density = 1, noStatement = false } = {}) {
  const v = printValues(schema, report, job)
  const pages = []
  let page = [], used = 0
  const capacity = (schema.kind === 'record' ? 200 : PRINT_GEOMETRY.body) * Math.min(1, Math.max(0.25, density))
  const flush = () => { if (page.length) pages.push(page); page = []; used = 0 }
  const add = (block) => {
    let last = page.at(-1)
    let gap = last?.id === block.id ? 0 : 10 + (block.headHeight || 0)
    if (page.length && used + block.height + gap > capacity) { flush(); last = null; gap = 10 + (block.headHeight || 0) }
    if (last?.id === block.id && block.kind === 'fields') last.rows.push(...block.rows)
    else if (last?.id === block.id && ['results', 'recording', 'dft'].includes(block.kind)) last.to = block.to
    else page.push({ ...block, rows: block.rows ? [...block.rows] : undefined })
    used += block.height + gap
  }
  const attachments = []
  for (const section of schema.sections) {
    if (section.noPrint || section.id === 'setup' || section.id === 'approvals') continue
    if (section.type === 'photos') continue
    const id = section.id
    if (['results', 'recording', 'dft'].includes(section.type)) {
      const rows = report[section.type === 'recording' ? 'readings' : section.type === 'dft' ? 'coats' : 'results'] || []
      const cols = (section.columns || []).filter((f) => !f.showIf || f.showIf(v))
      const widths = resultColumnWidths(cols)
      // The repeated table header consumes space on every continuation,
      // including units and wrapped instrument/defect column labels.
      const headHeight = section.autoJudge === 'dim' ? 12 : cols.length
        ? 4 + Math.max(...cols.map((c, k) => lines(`${c.label}${c.unit ? ` (${c.unit})` : ''}`, Math.max(5, Math.floor(widths[k + 1] / 1.6))))) * 3.5 : 13
      if (!rows.length) add({ id, kind: section.type, title: section.title, section, from: 0, to: 0, height: 14 })
      rows.forEach((row, i) => {
        const count = section.autoJudge === 'dim' ? Math.max(2.5, lines(printValue(row.description), 22) + 1, lines(printValue(row.note), 25))
          : cols.length ? Math.max(...cols.map((c, k) => lines(printValue(row[c.id]), Math.max(5, Math.floor(widths[k + 1] / 1.8)))))
          : Math.max(1, lines(row.remark || row.area || '', 24), lines((row.pts || []).join(', '), 22))
        add({ id, kind: section.type, title: section.title, section, from: i, to: i + 1, height: 4 + count * 4.1, headHeight })
      })
      continue
    }
    const fields = (section.fields || []).filter((f) => (!f.showIf || f.showIf(v)) && !['sign','photos','photos-inline','jobsearch'].includes(f.type)
      && !(id === 'header' && ['reportId', 'inspDate'].includes(f.id)))
      .flatMap((f) => fieldPieces(printField(f, v, report)))
    for (let i = 0; i < fields.length;) {
      const row = [fields[i++]]
      if (!row[0].wide && i < fields.length && !fields[i].wide) row.push(fields[i++])
      add({ id, kind: 'fields', title: section.title, rows: [row], height: fieldsHeight(row) })
    }
    for (const f of section.fields || []) {
      if (!['photos', 'photos-inline'].includes(f.type) || (f.showIf && !f.showIf(v))) continue
      const images = Array.isArray(v[f.id]) ? v[f.id] : []
      images.forEach((photo, i) => attachments.push({ kind: 'evidence', title: `${typeof f.label === 'function' ? f.label(v) : f.label} ${i + 1} of ${images.length}`, photos: [photo], full: true }))
      if (!images.length && /map|drawing/i.test(f.id)) add({ id: `${id}-empty`, kind: 'note', title: section.title, text: `No ${String(f.label).toLowerCase()} attached.`, height: 12 })
    }
  }
  if (!noStatement && schema.kind !== 'record') {
    // Keep the declaration with its signature block, away from an orphan page.
    const text = buildResume(schema, report, job).paragraph
    const height = 2 + lines(text, 100) * 4.7
    if (used + height + 58 > capacity) flush()
    add({ id: 'statement', kind: 'statement', title: 'Statement of result', height, text })
  }
  const approvals = schema.sections.find((s) => s.id === 'approvals')
  if (approvals) add({ id: 'approvals', kind: 'signatures', title: approvals.title, section: approvals, height: 38 })
  const photos = report.photos || []
  if (!photos.length) add({ id: 'no-photos', kind: 'note', title: 'Evidence register', text: 'No photographic evidence or document pages attached.', height: 12 })
  flush()
  if (schema.key === 'hydrotest' && (report.readings || []).length >= 2) pages.push([{ kind: 'chart', title: 'Pressure record analysis' }])
  attachments.forEach((block) => pages.push([block]))
  const perPage = schema.kind === 'record' ? 1 : 2
  for (let from = 0; from < photos.length; from += perPage) pages.push([{ kind: 'evidence', title: schema.kind === 'record' ? 'Filed document' : 'Photographic evidence',
    photos: photos.slice(from, from + perPage), from, total: photos.length, full: perPage === 1 }])
  return pages.length ? pages : [[{ kind: 'note', title: 'Report', text: 'No details recorded.' }]]
}
