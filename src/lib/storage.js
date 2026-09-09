/* How much of this browser's storage the app has used.

   Everything the app records — reports, photos, signatures, job orders,
   settings — lives in localStorage, and the browser gives that origin a
   few megabytes and no warning before it runs out. The rail shows the
   real number rather than a decorative one, because it is the limit that
   actually binds here. */

/* What this browser will actually take.

   5 MB was the old figure and it is wrong here: filling localStorage in
   Chromium until it refused took 9.5 MB, so the gauge read 45% where the
   truth was 24%. That is the wrong direction to be wrong in. The remedy
   this app offers beside the gauge is "export and clear records", so an
   inflated reading pushes somebody toward deleting inspection evidence
   they had plenty of room to keep.

   10 MB is what current Chromium, Firefox and Safari all allow per
   origin. It is a ceiling, not a promise — a browser in private mode, or
   one with site data restricted, can refuse far earlier — so the number
   here is only ever for the gauge. What actually protects a record is
   the write failing loudly: see StorageFullError in store.js, which is
   raised on the spot and shown in place rather than in a toast.

   Measured in UTF-16 code units, which is how the string is stored. */
const BUDGET = 10 * 1024 * 1024

export function storageUsage(budget = BUDGET) {
  let bytes = 0
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k || !k.startsWith('qc.')) continue
      bytes += (k.length + (localStorage.getItem(k)?.length || 0)) * 2
    }
  } catch {
    return { bytes: 0, budget, pct: 0, unavailable: true }
  }
  return { bytes, budget, pct: Math.min(100, Math.round((bytes / budget) * 100)), unavailable: false }
}

export function fmtBytes(n) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
