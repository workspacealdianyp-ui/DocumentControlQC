/* Light or dark, or whatever the machine is set to.

   The whole interface is drawn from the token block in styles.css, so a
   theme is a second set of those tokens rather than a second stylesheet.
   The choice is stamped on <html> as data-theme, which is also where
   color-scheme lives — that is what makes the browser's own furniture
   (select menus, date pickers, scrollbars, form focus rings) follow
   along instead of staying stubbornly white on a dark page. */

const KEY = 'qc.theme'
export const THEMES = ['light', 'dark', 'system']

const media = () =>
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null

export function getThemePref() {
  try {
    const v = localStorage.getItem(KEY)
    return THEMES.includes(v) ? v : 'system'
  } catch { return 'system' }
}

// What the preference actually resolves to right now.
export const resolveTheme = (pref = getThemePref()) =>
  pref === 'system' ? (media()?.matches ? 'dark' : 'light') : pref

export function applyTheme(pref = getThemePref()) {
  const mode = resolveTheme(pref)
  const root = document.documentElement
  root.setAttribute('data-theme', mode)
  root.style.colorScheme = mode
  return mode
}

export function setThemePref(pref) {
  try { localStorage.setItem(KEY, pref) } catch { /* private mode */ }
  return applyTheme(pref)
}

/* Following the system means following it as it changes, not only as it
   was when the tab opened. Returns the unsubscribe. */
export function watchSystemTheme(onChange) {
  const m = media()
  if (!m) return () => {}
  const fn = () => { if (getThemePref() === 'system') onChange(applyTheme('system')) }
  m.addEventListener('change', fn)
  return () => m.removeEventListener('change', fn)
}
