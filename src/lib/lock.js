/* A passcode for this device.

   There is no account password to change here: signing in picks a role
   from a list and no credential is ever checked, so a "change password"
   field would protect nothing and say it protected something. What a
   tablet left on a shop floor actually needs is a lock on the device it
   is left on, and that is what this is.

   The code is stored as a SHA-256 hash with a random salt, so reading
   localStorage does not hand anyone the number. That is the honest limit
   of it: anyone who can run script on this origin can clear the key and
   remove the lock. It keeps a passing hand out of an unattended browser.
   It is not a defence against someone with the device and the intent. */

const KEY = 'qc.lock'
const OPEN = 'qc.lock.open'   // session-scoped: relocks when the tab closes

const enc = new TextEncoder()
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

async function digest(code, salt) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(`${salt}:${code}`)))
}

export function lockConfig() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null') } catch { return null }
}

export const hasLock = () => !!lockConfig()

// Unlocked for as long as this tab lives. Closing it relocks, which is
// the behaviour a shared device wants.
export const isOpen = () => {
  try { return sessionStorage.getItem(OPEN) === '1' } catch { return true }
}
export const markOpen = () => { try { sessionStorage.setItem(OPEN, '1') } catch { /* private mode */ } }
export const markShut = () => { try { sessionStorage.removeItem(OPEN) } catch { /* private mode */ } }

export async function setLock(code) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)))
  localStorage.setItem(KEY, JSON.stringify({ salt, hash: await digest(code, salt), at: new Date().toISOString() }))
  markOpen()
}

export async function verify(code) {
  const cfg = lockConfig()
  if (!cfg) return true
  return (await digest(code, cfg.salt)) === cfg.hash
}

export async function clearLock(code) {
  if (!(await verify(code))) return false
  localStorage.removeItem(KEY)
  markOpen()
  return true
}
