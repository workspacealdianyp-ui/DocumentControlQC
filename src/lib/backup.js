/* Getting the records out of the browser, and back in.

   Every QC record this app holds lives in one browser's localStorage.
   Clear the site data and the archive is gone; open the app on a second
   machine and it is empty. Until there is a back end, a file is the only
   thing standing between a cleared browser and a lost inspection
   history, so producing one has to be a first-class action rather than
   something only the settings panel could do for its own preferences.

   What travels is the record, not the seat: session, theme, the device
   passcode and the seed flag stay behind, because they describe this
   browser rather than the work. */

export const BACKUP_VERSION = 3

const RECORD_KEYS = [
  'qc.overrideEvents',   // reasons and actors behind manual status changes
  'qc.issueCounters',    // spent numbers must never become available again
  'qc.migrations',       // migration and deletion history
  'qc.reports',          // the inspection reports themselves
  'qc.jobOrders',        // orders raised in the app
  'qc.statusOverrides',  // deliberate admin statements about a cell
  'qc.assets',           // the calibrated-instrument register
  'qc.savedSign',        // each person's own signature image
  'qc.settings',         // unit and format choices a report is read against
]

export function exportAll() {
  const data = {}
  for (const k of RECORD_KEYS) {
    const raw = localStorage.getItem(k)
    if (raw == null) continue
    data[k] = readRecord(k)
    validate(k, data[k])
  }
  const reports = data['qc.reports'] || []
  return {
    format: 'qc-inspection-monitor-backup',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    counts: {
      reports: reports.length,
      approved: reports.filter((r) => r.status === 'approved').length,
      jobOrders: (data['qc.jobOrders'] || []).length,
    },
    data,
  }
}

export function downloadBackup() {
  const payload = exportAll()
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `qc-records-${payload.exportedAt.slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(a.href)
  return payload.counts
}

const ARRAY_KEYS = new Set(['qc.reports', 'qc.jobOrders', 'qc.overrideEvents', 'qc.migrations'])
const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))
const canonical = (v) => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])])) : v
function readRecord(key) {
  const raw = localStorage.getItem(key)
  if (raw === null) return ARRAY_KEYS.has(key) ? [] : {}
  try { return JSON.parse(raw) } catch { throw new Error(`${key} could not be read. Restore stopped; preserve the existing data before repairing it.`) }
}
function validate(key, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) !== ARRAY_KEYS.has(key)) throw new Error(`Invalid records in ${key}. Nothing was changed.`)
  if (['qc.reports', 'qc.jobOrders', 'qc.overrideEvents'].includes(key)) {
    const ids = new Set()
    for (const row of value) {
      if (!row || typeof row.id !== 'string' || !row.id || ids.has(row.id)) throw new Error(`Missing or duplicate record identity in ${key}. Nothing was changed.`)
      ids.add(row.id)
    }
  }
  if (key === 'qc.statusOverrides' && Object.values(value).some((entry) => !entry || typeof entry !== 'object' || Array.isArray(entry))) throw new Error('Invalid manual statuses. Nothing was changed.')
  if (key === 'qc.issueCounters' && Object.values(value).some((n) => !Number.isInteger(n) || n < 0)) throw new Error('Invalid issue counters. Nothing was changed.')
}
function prepare(payload) {
  if (!payload || payload.format !== 'qc-inspection-monitor-backup') throw new Error('That is not a backup from this app.')
  if (!payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) throw new Error('That backup file has no records in it.')
  if (!Number.isInteger(payload.version) || payload.version < 1 || payload.version > BACKUP_VERSION) throw new Error('Unsupported backup version. Update the app before restoring a newer file.')
  const out = {}, entities = {}
  for (const key of RECORD_KEYS) {
    if (!(key in payload.data)) continue
    const mine = readRecord(key), theirs = payload.data[key]
    validate(key, mine); validate(key, theirs)
    const counts = { added: 0, updated: 0, kept: 0, alreadyHere: Array.isArray(mine) ? mine.length : Object.keys(mine).length, inFile: Array.isArray(theirs) ? theirs.length : Object.keys(theirs).length }
    if (['qc.reports', 'qc.jobOrders', 'qc.overrideEvents'].includes(key)) {
      const merged = new Map(mine.map((r) => [r.id, r]))
      for (const row of theirs) {
        const have = merged.get(row.id)
        if (!have) { merged.set(row.id, row); counts.added++; continue }
        if (equal(have, row)) { counts.kept++; continue }
        const oldTime = Date.parse(have.updatedAt), newTime = Date.parse(row.updatedAt)
        if (key === 'qc.overrideEvents' || !Number.isFinite(oldTime) || !Number.isFinite(newTime) || oldTime === newTime) throw new Error(`Conflict in ${key}: ${row.id}. Both versions differ without a reliable newer version. Nothing was changed.`)
        if (newTime > oldTime) { merged.set(row.id, row); counts.updated++ } else counts.kept++
      }
      out[key] = [...merged.values()]
    } else if (key === 'qc.migrations') {
      out[key] = [...mine]
      for (const event of theirs) if (!out[key].some((held) => equal(held, event))) { out[key].push(event); counts.added++ }
    } else {
      // Maps merge by entry; conflicting settings or master records require
      // an explicit decision instead of silently replacing the whole register.
      const mergeMap = (held, incoming, path) => {
        const merged = { ...held }
        for (const [id, value] of Object.entries(incoming)) {
          if (!Object.hasOwn(held, id)) { Object.defineProperty(merged, id, { value, enumerable: true, writable: true, configurable: true }); counts.added++; continue }
          if (equal(held[id], value)) { counts.kept++; continue }
          if (key === 'qc.issueCounters') { merged[id] = Math.max(held[id], value); counts.updated++; continue }
          if (key === 'qc.statusOverrides' && path === key) { merged[id] = mergeMap(held[id], value, `${path}.${id}`); continue }
          throw new Error(`Conflict in ${path}: ${id}. Keep both backups and resolve this difference before restoring. Nothing was changed.`)
        }
        return merged
      }
      out[key] = mergeMap(mine, theirs, key)
    }
    entities[key] = counts
  }
  const reports = entities['qc.reports'] || { added: 0, updated: 0, kept: 0, alreadyHere: 0, inFile: 0 }
  return { out, plan: { ...reports, entities } }
}

export function planImport(payload) { return prepare(payload).plan }

export function applyImport(payload) {
  const { out, plan } = prepare(payload)
  const rollback = []
  try {
    for (const [key, value] of Object.entries(out)) {
      rollback.push([key, localStorage.getItem(key)])
      localStorage.setItem(key, JSON.stringify(value))
    }
  } catch {
    let restored = true
    for (const [key, previous] of rollback.reverse()) {
      try { if (previous === null) localStorage.removeItem(key); else localStorage.setItem(key, previous) }
      catch { restored = false }
    }
    throw new Error(restored ? 'Restore failed. Previous data was restored.' : 'Restore failed and some previous data could not be restored. Keep your backup and do not clear this browser.')
  }
  return plan
}

export function readBackupFile(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onerror = () => reject(new Error('That file could not be read.'))
    fr.onload = () => {
      try { resolve(JSON.parse(fr.result)) }
      catch { reject(new Error('That file is not valid JSON.')) }
    }
    fr.readAsText(file)
  })
}
