import { getAssets } from './store.js'
import { INSTRUMENT_KINDS } from '../data/assets.js'

/* The calibrated-instrument register, and the one place that decides
   whether an instrument may be used.

   The register used to be decorative. Settings held tags PG-001..PG-004
   with calibration dates, while the hydrotest form offered a hardcoded
   PG-64 / PG-12 / PG-88 that appeared nowhere in it — the two lists had
   no tag in common. Editing the register changed nothing an inspector
   could pick, so the calibration control never reached the point where a
   measurement was recorded, which is the only place it matters.

   Now the form draws from here, and an instrument whose calibration has
   expired on the day of the inspection cannot be selected: a reading
   taken with it is not evidence of anything. */

export { INSTRUMENT_KINDS }

const pad = (n) => String(n).padStart(2, '0')
export const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/* Older registers stored each instrument as one string —
   "PG-001 · Pressure Gauge 0-25 Bar · Cal 2026-01". They are read back
   into the structured shape so an upgrade does not empty anybody's
   register, and a month-only date is kept as the last day of that month,
   which is the reading most favourable to the instrument. */
export function normalise(entry) {
  if (entry && typeof entry === 'object') {
    return { tag: entry.tag || '', desc: entry.desc || '', cal: entry.cal || '', due: entry.due || '', method: entry.method || '' }
  }
  const s = String(entry || '')
  const parts = s.split('·').map((x) => x.trim())
  const calPart = parts.find((p) => /^cal\b/i.test(p)) || ''
  const m = calPart.match(/(\d{4}-\d{2}-\d{2})|(\d{4}-\d{2})/)
  let cal = ''
  if (m) {
    if (m[1]) cal = m[1]
    else {
      const [y, mo] = m[2].split('-').map(Number)
      cal = `${y}-${pad(mo)}-${pad(new Date(y, mo, 0).getDate())}`
    }
  }
  return {
    tag: parts[0] || s,
    desc: parts.slice(1).filter((p) => !/^cal\b/i.test(p)).join(' · '),
    cal, due: '', method: '',
  }
}

export function getRegister() {
  const raw = getAssets() || {}
  const out = {}
  for (const kind of Object.keys(INSTRUMENT_KINDS)) {
    const list = raw[kind]
    if (Array.isArray(list)) out[kind] = list.map(normalise)
    else if (list && typeof list === 'object') {
      // the oldest shape for MT equipment: { 'Yoke': 'YK-2201 · ...' }
      out[kind] = Object.entries(list).map(([method, v]) => ({ ...normalise(v), method }))
    } else out[kind] = []
  }
  return out
}

/* Where an instrument stands on a given day.

   'over'    — calibration expired; the reading would not be valid
   'soon'    — inside 30 days of expiry; usable, worth knowing
   'ok'      — in date
   'unknown' — no due date recorded. Not treated as expired and not
               treated as fine: the register is incomplete and says so
               rather than the app inventing an interval. */
export function calState(inst, on = today()) {
  if (!inst?.due) return 'unknown'
  if (inst.due < on) return 'over'
  const soon = new Date(on)
  soon.setDate(soon.getDate() + 30)
  const limit = `${soon.getFullYear()}-${pad(soon.getMonth() + 1)}-${pad(soon.getDate())}`
  return inst.due <= limit ? 'soon' : 'ok'
}

/* The string a report stores.

   Self-describing on purpose: the report has to stand on its own years
   later, so it carries the tag, the description and the calibration date
   it was taken under. Editing the register afterwards cannot rewrite
   what a signed document says. */
export const labelOf = (inst) =>
  [inst.tag, inst.desc, inst.cal ? `Cal ${inst.cal}` : null].filter(Boolean).join(' · ')

/* What the form may offer on the day of the inspection.

   An expired instrument is left out. A value already stored on the
   report is always included even if it has since expired — the record
   says what was used, and hiding it would silently blank a submitted
   field. */
export function optionsFor(kind, { on = today(), keep = '' } = {}) {
  const list = getRegister()[kind] || []
  const opts = list.filter((i) => calState(i, on) !== 'over').map(labelOf)
  if (keep && !opts.includes(keep)) opts.unshift(keep)
  return opts
}

// Instruments held back from a form, so it can say why rather than just
// showing a shorter list.
export function withheld(kind, on = today()) {
  return (getRegister()[kind] || []).filter((i) => calState(i, on) === 'over')
}

export const findByLabel = (kind, label) =>
  (getRegister()[kind] || []).find((i) => labelOf(i) === label) || null

/* The magnetising methods actually available today, taken from the
   register rather than written into the form. The schema used to offer
   'Yoke' / 'Prod.' / 'Other' against a register holding Yoke, Prod. and
   Coil, so 'Other' matched nothing and 'Coil' could not be chosen. */
export function methodsFor(kind, on = today()) {
  const seen = []
  for (const i of getRegister()[kind] || []) {
    if (i.method && calState(i, on) !== 'over' && !seen.includes(i.method)) seen.push(i.method)
  }
  return seen
}
