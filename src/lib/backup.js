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

export const BACKUP_VERSION = 2

const RECORD_KEYS = [
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
    try { data[k] = JSON.parse(raw) } catch { /* unreadable: leave it out rather than ship garbage */ }
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

/* What an import would do, worked out before anything is written.

   Nothing is ever deleted by an import. Records are matched by id and
   the newer updatedAt wins, so bringing yesterday's file into today's
   browser cannot undo today's work — the common way a well-meant restore
   destroys an archive. */
export function planImport(payload) {
  if (!payload || payload.format !== 'qc-inspection-monitor-backup') {
    throw new Error('That is not a backup from this app.')
  }
  if (!payload.data || typeof payload.data !== 'object') {
    throw new Error('That backup file has no records in it.')
  }
  if (Number(payload.version) > BACKUP_VERSION) {
    throw new Error(`That file was written by a newer version of the app (v${payload.version}). Update before restoring it.`)
  }
  const mine = (() => { try { return JSON.parse(localStorage.getItem('qc.reports') || '[]') } catch { return [] } })()
  const theirs = Array.isArray(payload.data['qc.reports']) ? payload.data['qc.reports'] : []
  const byId = new Map(mine.map((r) => [r.id, r]))
  let added = 0, updated = 0, kept = 0
  for (const r of theirs) {
    if (!r || !r.id) continue
    const have = byId.get(r.id)
    if (!have) { added++; continue }
    if ((r.updatedAt || '') > (have.updatedAt || '')) updated++
    else kept++
  }
  return { added, updated, kept, alreadyHere: mine.length, inFile: theirs.length }
}

export function applyImport(payload) {
  planImport(payload)   // throws on anything that is not a backup
  const d = payload.data

  // reports merge by id, newest wins
  const mine = (() => { try { return JSON.parse(localStorage.getItem('qc.reports') || '[]') } catch { return [] } })()
  const merged = new Map(mine.map((r) => [r.id, r]))
  for (const r of (Array.isArray(d['qc.reports']) ? d['qc.reports'] : [])) {
    if (!r || !r.id) continue
    const have = merged.get(r.id)
    if (!have || (r.updatedAt || '') > (have.updatedAt || '')) merged.set(r.id, r)
  }
  const out = { 'qc.reports': [...merged.values()] }

  // orders merge the same way, by id
  const myOrders = (() => { try { return JSON.parse(localStorage.getItem('qc.jobOrders') || '[]') } catch { return [] } })()
  const om = new Map(myOrders.map((o) => [o.id, o]))
  for (const o of (Array.isArray(d['qc.jobOrders']) ? d['qc.jobOrders'] : [])) {
    if (o && o.id && !om.has(o.id)) om.set(o.id, o)
  }
  out['qc.jobOrders'] = [...om.values()]

  // the rest are single objects: the file's copy is taken whole, since
  // there is no per-entry identity to merge on
  for (const k of ['qc.statusOverrides', 'qc.assets', 'qc.savedSign', 'qc.settings']) {
    if (d[k] !== undefined) out[k] = d[k]
  }

  // Write everything or nothing. A half-applied restore is worse than a
  // refused one, so the previous values go back if the browser runs out
  // of room part way through.
  const rollback = []
  try {
    for (const [k, v] of Object.entries(out)) {
      rollback.push([k, localStorage.getItem(k)])
      localStorage.setItem(k, JSON.stringify(v))
    }
  } catch {
    for (const [k, prev] of rollback) {
      if (prev == null) localStorage.removeItem(k); else localStorage.setItem(k, prev)
    }
    throw new Error('There was not enough room to restore this file. Nothing was changed.')
  }
  return planImport(payload)
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
