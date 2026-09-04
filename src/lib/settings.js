import { DELIVERABLES } from './constants.js'

/* App settings, persisted alongside the rest of the front-end state.
   Split by panel so a section can be read on its own, and merged over the
   defaults on read so adding a key here does not strand anyone who
   already has a saved object. */

const KEY = 'qc.settings'

export const UNITS = {
  pressure: ['Bar', 'PsiG', 'kPa'],
  temperature: ['°C', '°F'],
  length: ['mm', 'in'],
  coating: ['µm', 'mil'],
  light: ['lux', 'fc'],
}

export const DEFAULT_SETTINGS = {
  profile: {
    name: '',
    email: '',
    timezone: 'Asia/Jakarta',
    locale: 'en-GB',
    language: 'en-GB',
    // Both are data URIs held in this browser. The photo stands in for
    // the initials wherever an avatar is drawn; the signature is offered
    // as the default when a form asks the inspector to sign.
    photo: '',
    signature: '',
  },
  notify: {
    onSubmit: true,
    onApprove: true,
    onReject: true,
    push: false,          // needs a back-end; the control stays disabled
    overdueDigest: false,
    autoPurgeDrafts: false,
    privateSignatures: true,
    // which deliverables raise a notification at all
    watch: DELIVERABLES.reduce(
      (m, d) => ({ ...m, [d.key]: ['Dimension Report', 'NDE Report', 'Leak & Hydro Test', 'Painting'].includes(d.key) }),
      {}
    ),
  },
  measurement: {
    pressure: 'Bar',
    temperature: '°C',
    length: 'mm',
    coating: 'µm',
    light: 'lux',
    decimals: 2,
    warnOutOfTolerance: true,
    autoDeviation: true,
    showUnits: true,
  },
}

// One level of merge per panel is enough: every panel is a flat object of
// scalars, apart from notify.watch, which is keyed by deliverable.
function merge(saved) {
  const out = {}
  for (const k of Object.keys(DEFAULT_SETTINGS)) {
    out[k] = { ...DEFAULT_SETTINGS[k], ...(saved?.[k] || {}) }
  }
  out.notify.watch = { ...DEFAULT_SETTINGS.notify.watch, ...(saved?.notify?.watch || {}) }
  return out
}

export function getSettings() {
  try {
    const raw = localStorage.getItem(KEY)
    return merge(raw ? JSON.parse(raw) : null)
  } catch {
    return merge(null)
  }
}

export function setSettings(next) {
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* private mode */ }
  return next
}

export function resetSettings() {
  try { localStorage.removeItem(KEY) } catch { /* private mode */ }
  return merge(null)
}
