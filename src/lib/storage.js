/* How much of this browser's storage the app has used.

   Everything the app records — reports, photos, signatures, job orders,
   settings — lives in localStorage, and the browser gives that origin a
   few megabytes and no warning before it runs out. The rail shows the
   real number rather than a decorative one, because it is the limit that
   actually binds here. */

// Browsers give an origin roughly 5 MB for localStorage. Measured in
// UTF-16 code units, which is how the string is actually stored.
const BUDGET = 5 * 1024 * 1024

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
