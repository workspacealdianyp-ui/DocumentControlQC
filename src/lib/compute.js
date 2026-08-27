// Auto-calculation registry + conditional-visibility evaluator.
// Shared by the live form renderer (FormView) and the printable report (PrintReport).
import { getAssets } from './store.js'

function minutesOf(t) {
  if (!t || !/^\d{2}:\d{2}/.test(t)) return null
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// ── engineering calc helpers (ported from old app/data.js MRCalc) ──
export const MR = {
  nowTime() {
    const d = new Date()
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
  },
  minutesBetween(t1, t2) {
    const a = minutesOf(t1), b = minutesOf(t2)
    if (a == null || b == null) return 0
    return b - a
  },
  // relative humidity from dry/wet bulb (simplified psychrometric)
  rh(dry, wet) {
    const d = parseFloat(dry), w = parseFloat(wet)
    if (isNaN(d) || isNaN(w)) return null
    const es = (t) => 6.112 * Math.exp((17.67 * t) / (t + 243.5))
    const e = es(w) - 0.00066 * (1 + 0.00115 * w) * (d - w) * 1013
    const rh = Math.round((e / es(d)) * 100)
    return Math.max(0, Math.min(100, rh))
  },
  dewPoint(dry, wet) {
    const d = parseFloat(dry)
    const rh = MR.rh(dry, wet)
    if (rh == null || isNaN(d)) return null
    const g = Math.log(rh / 100) + (17.67 * d) / (d + 243.5)
    return Math.round((243.5 * g) / (17.67 - g) * 10) / 10
  },
  dftAvg(pts) {
    const nums = (pts || []).map(parseFloat).filter((n) => !isNaN(n))
    if (!nums.length) return null
    return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10
  },
}

export const COMPUTE = {
  duration: (row) => {
    const a = minutesOf(row.timeStart), b = minutesOf(row.timeFinish)
    if (a == null || b == null) return ''
    let d = b - a
    if (d < 0) d += 24 * 60
    return `${Math.floor(d / 60)}h ${String(d % 60).padStart(2, '0')}m`
  },
  dewpoint: (vals) => {
    const T = parseFloat(vals.blastAmbient), RH = parseFloat(vals.blastRh)
    if (isNaN(T) || isNaN(RH) || RH <= 0) return ''
    const g = Math.log(RH / 100) + (17.625 * T) / (243.04 + T)
    return ((243.04 * g) / (17.625 - g)).toFixed(1)
  },
  dftTol: (row) => {
    const t = parseFloat(row.dftTarget)
    return isNaN(t) ? '' : (t * 0.8).toFixed(0)
  },
  dftAvg: (row) => {
    const nums = String(row.dftSpots || '').split(/[,;\s]+/).map(parseFloat).filter((n) => !isNaN(n))
    if (!nums.length) return ''
    return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1)
  },
  mtEquipSn: (vals) => getAssets().mtEquipment?.[vals.mtEquip] || '',
  deviation: (row) => {
    const n = parseFloat(row.nominal), a = parseFloat(row.actual)
    return isNaN(n) || isNaN(a) ? '' : (a - n).toFixed(2)
  },
  dimStatus: (row) => {
    const dev = parseFloat(COMPUTE.deviation(row))
    if (isNaN(dev)) return ''
    const tol = String(row.tolerance || '').trim()
    let lo = null, hi = null
    let m = tol.match(/^±?\s*(\d+(?:\.\d+)?)$/)
    if (m) { hi = parseFloat(m[1]); lo = -hi }
    m = tol.match(/^\+\s*(\d+(?:\.\d+)?)\s*\/\s*-\s*(\d+(?:\.\d+)?)$/)
    if (m) { hi = parseFloat(m[1]); lo = -parseFloat(m[2]) }
    if (lo == null) return '—'
    return dev >= lo && dev <= hi ? 'Accept' : 'Reject'
  },
  leakage: (vals) => {
    const rows = vals.record || []
    if (!rows.length) return ''
    return rows.some((r) => r.result === 'Fail') ? 'Leak' : 'No Leak'
  },
  finalFromRows: (vals) => {
    const rows = vals.record || []
    if (!rows.length) return ''
    return rows.some((r) => r.result === 'Fail') ? 'Reject' : 'Accept'
  },
  finalFromRowsAR: (vals) => {
    const rows = vals.grid || []
    if (!rows.length) return ''
    return rows.some((r) => r.rowResult === 'Reject') ? 'Reject' : 'Accept'
  },
  finalFromRowsOK: (vals) => {
    const rows = vals.grid || []
    if (!rows.length) return ''
    return rows.some((r) => r.rowResult === 'NG') ? 'Reject' : 'Accept'
  },
  finalFromRowsDim: (vals) => {
    const rows = vals.grid || []
    if (!rows.length) return ''
    return rows.some((r) => COMPUTE.dimStatus(r) === 'Reject') ? 'Reject' : 'Accept'
  },
}

export const evalCond = (cond, rowVals, formVals) => {
  if (!cond) return true
  const v = rowVals && cond.field in rowVals ? rowVals[cond.field] : formVals[cond.field]
  return v === cond.eq
}

export const computeValue = (field, rowVals, formVals) =>
  COMPUTE[field.compute] ? COMPUTE[field.compute](rowVals || formVals) : ''
