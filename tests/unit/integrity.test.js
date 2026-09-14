import { describe, it, expect, vi } from 'vitest'
import { reportResult } from '../../src/lib/verdict.js'
import { FORM_SCHEMAS } from '../../src/data/formSchemas.js'
import { exportAll, planImport, applyImport } from '../../src/lib/backup.js'

const put = (key, value) => localStorage.setItem(key, JSON.stringify(value))
const read = (key) => JSON.parse(localStorage.getItem(key))
const backup = (data) => ({ format: 'qc-inspection-monitor-backup', version: 3, data })

describe('evidence-based verdicts', () => {
  it.each([{}, { results: [{}] }, { readings: [{ remark: 'No leak observed' }] }, { formKey: 'dimensional', values: { finalStatus: 'Accept' }, results: [{}] }])('does not accept incomplete evidence: %j', (report) => {
    expect(reportResult(report)).toBe('Not evaluated')
  })
  it('keeps rejection visible despite other missing or accepted results', () => {
    expect(reportResult({ formKey: 'mt', results: [{ judgement: 'Reject' }, {}] })).toBe('Reject')
    expect(reportResult({ formKey: 'dimensional', values: { finalStatus: 'Reject' } })).toBe('Reject')
  })
  it('requires every row to carry a known acceptance decision', () => {
    expect(reportResult({ formKey: 'mt', results: [{ judgement: 'Acc' }, {}] })).toBe('Not evaluated')
    expect(reportResult({ formKey: 'visual', results: [{ judgement: 'OK' }] })).toBe('Accept')
    expect(reportResult({ formKey: 'mt', results: [{ judgement: 'unknown' }] })).toBe('Not evaluated')
  })
  it('uses the same incomplete decision in computed form fields', () => {
    for (const key of ['visual', 'dimensional']) {
      const field = FORM_SCHEMAS[key].sections.flatMap((s) => s.fields || []).find((f) => f.id === 'finalStatus')
      expect(field.compute({}, { results: [] })).toBe('Not evaluated')
    }
  })
  it('does not invent inspection acceptance for a filed document', () => {
    expect(reportResult({ formKey: 'itp' })).toBe('N/A')
    expect(reportResult({ formKey: 'hydrotest', values: { testResult: 'Satisfactory' } })).toBe('Accept')
  })
})

describe('complete and non-destructive backup', () => {
  it('round trips history, orphan evidence, and spent issue numbers', () => {
    const data = { 'qc.reports': [{ id: 'orphan', orphaned: true }], 'qc.overrideEvents': [{ id: 'ov1', reason: 'Evidence checked' }], 'qc.issueCounters': { DIM900: 7 }, 'qc.migrations': [{ event: 'delete', reportId: 'DIM/01' }] }
    for (const [key, value] of Object.entries(data)) put(key, value)
    const file = exportAll()
    localStorage.clear()
    applyImport(file)
    for (const [key, value] of Object.entries(data)) expect(read(key)).toEqual(value)
  })
  it('updates a newer job and reports the actual pre-import counts', () => {
    put('qc.jobOrders', [{ id: 'j1', updatedAt: '2026-01-01', poNo: 'old' }])
    const file = backup({ 'qc.jobOrders': [{ id: 'j1', updatedAt: '2026-02-01', poNo: 'new' }] })
    expect(applyImport(file).entities['qc.jobOrders'].updated).toBe(1)
    expect(read('qc.jobOrders')[0].poNo).toBe('new')
  })
  it('keeps newer local reports and never rolls back spent counters', () => {
    put('qc.reports', [{ id: 'r1', updatedAt: '2026-03-01' }])
    put('qc.issueCounters', { DIM900: 9 })
    applyImport(backup({ 'qc.reports': [{ id: 'r1', updatedAt: '2026-01-01' }], 'qc.issueCounters': { DIM900: 2 } }))
    expect(read('qc.reports')[0].updatedAt).toBe('2026-03-01')
    expect(read('qc.issueCounters').DIM900).toBe(9)
  })
  it('stops ambiguous report and master-data conflicts without writing', () => {
    put('qc.reports', [{ id: 'r1', values: { note: 'held' } }])
    const before = localStorage.getItem('qc.reports')
    expect(() => applyImport(backup({ 'qc.reports': [{ id: 'r1', values: { note: 'incoming' } }] }))).toThrow(/Conflict/)
    expect(localStorage.getItem('qc.reports')).toBe(before)
    put('qc.settings', { units: 'mm' })
    expect(() => planImport(backup({ 'qc.settings': { units: 'inch' } }))).toThrow(/Conflict/)
  })
  it('fails visibly on corrupt local data during export and restore', () => {
    localStorage.setItem('qc.reports', '{broken')
    expect(() => exportAll()).toThrow(/could not be read/)
    expect(() => applyImport(backup({ 'qc.reports': [] }))).toThrow(/could not be read/)
    expect(localStorage.getItem('qc.reports')).toBe('{broken')
  })
  it('rejects malformed and duplicate incoming records', () => {
    expect(() => planImport(backup({ 'qc.reports': {} }))).toThrow(/Invalid/)
    expect(() => planImport(backup({ 'qc.reports': [{ id: 'x' }, { id: 'x' }] }))).toThrow(/duplicate/)
  })
  it('supports legacy backups without deleting newer history', () => {
    put('qc.overrideEvents', [{ id: 'ov1' }])
    applyImport({ ...backup({ 'qc.reports': [] }), version: 2 })
    expect(read('qc.overrideEvents')).toEqual([{ id: 'ov1' }])
  })
})


it('rolls back all changed keys when a later backup write fails', () => {
  put('qc.reports', [{ id: 'held' }])
  const original = Storage.prototype.setItem
  let failed = false
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
    if (key === 'qc.jobOrders' && !failed) { failed = true; throw new Error('quota') }
    return original.call(this, key, value)
  })
  try {
    expect(() => applyImport(backup({ 'qc.reports': [{ id: 'new' }], 'qc.jobOrders': [{ id: 'order' }] }))).toThrow(/Previous data was restored/)
    expect(read('qc.reports')).toEqual([{ id: 'held' }])
    expect(localStorage.getItem('qc.jobOrders')).toBeNull()
  } finally { spy.mockRestore() }
})
