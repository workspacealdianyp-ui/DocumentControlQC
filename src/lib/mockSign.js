// A reusable mock signature (cursive SVG → data URL) + per-user saved-signature store.
// Lets an inspector sign once and reuse the saved image, no backend.

const sigSvg = (label) => {
  const safe = (label || 'Inspector').slice(0, 18)
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='90' viewBox='0 0 240 90'>
      <path d='M8 60 C 26 18, 40 18, 44 50 C 47 70, 54 72, 60 46 C 66 22, 78 24, 80 52 C 82 74, 92 70, 104 40 C 112 20, 120 24, 122 52 C 124 72, 134 70, 150 44 C 168 16, 190 18, 196 44 C 200 60, 210 58, 232 40'
        fill='none' stroke='%23142b54' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/>
      <path d='M150 64 C 175 58, 200 60, 224 56' fill='none' stroke='%23142b54' stroke-width='2' stroke-linecap='round'/>
      <text x='10' y='84' font-family='monospace' font-size='9' fill='%237a8aa3'>${safe}</text>
    </svg>`
  )
}

// the default mock — what gets pre-saved so signing works out of the box
export const MOCK_SIGNATURE = sigSvg('Inspector')

const KEY = 'qc.savedSign'
function readAll() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} } }

// Saved signature for a given name. Falls back to a generated mock the first time.
export function getSavedSignature(name) {
  const all = readAll()
  if (all[name]) return all[name]
  return sigSvg(name)
}
export function saveSignatureFor(name, img) {
  const all = readAll()
  all[name] = img
  localStorage.setItem(KEY, JSON.stringify(all))
}
