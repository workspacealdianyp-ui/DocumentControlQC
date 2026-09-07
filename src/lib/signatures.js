// Where a person's own signature image lives, keyed by name, in
// localStorage. One signature per person, no backend.
//
// There is deliberately no generator in this file. A QC record carries a
// mark because somebody made one; a drawing the app invented would be a
// forgery with extra steps, and it would be indistinguishable from a
// real mark once it is on the sheet. Nothing saved means nothing to
// apply, and the caller has to say so rather than paper over it.

const KEY = 'qc.savedSign'

function readAll() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}

// This person's saved signature, or null. Never a stand-in.
export function getSavedSignature(name) {
  const img = readAll()[name]
  return typeof img === 'string' && img ? img : null
}

export const hasSavedSignature = (name) => getSavedSignature(name) !== null

export function saveSignatureFor(name, img) {
  const all = readAll()
  all[name] = img
  // Private mode refuses the write; the signature still applies to the
  // report in hand, it just will not be there next time.
  try { localStorage.setItem(KEY, JSON.stringify(all)) } catch { /* not fatal */ }
}
