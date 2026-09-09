/* Telling somebody a new version is ready.

   The worker already does the right thing: navigations go to the network
   first, install calls skipWaiting, and activate deletes every older
   cache. What it could not do is tell the person looking at the screen.
   A browser tab picks the new build up on its next load, but an
   installed app on a tablet is not "loaded" again for days — it is left
   open on a bench — so a change shipped in the morning was still
   invisible that evening, and the only way to know was to know.

   So the page asks whether a new worker has appeared, and says so when
   one has. It does not reload on its own: a reload throws away whatever
   is typed into the form on screen, and losing an inspector's readings
   to a version bump would be a worse bug than the stale build.

   CHECK_EVERY is deliberately slow. This is a shop-floor tool on a
   metered connection; the check costs one conditional request for a 3 KB
   file, and nobody needs it more often than a coffee break. */
const CHECK_EVERY = 15 * 60 * 1000

let waiting = false
const listeners = new Set()

const announce = () => {
  waiting = true
  for (const fn of listeners) { try { fn(true) } catch { /* a listener must not stop the others */ } }
}

export const updateReady = () => waiting

export function onUpdateReady(fn) {
  listeners.add(fn)
  if (waiting) fn(true)
  return () => listeners.delete(fn)
}

export function registerServiceWorker(base = '/') {
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.register(`${base}sw.js`, { scope: base })
    .then((reg) => {
      /* A worker already sitting in `waiting` means the update arrived
         while this page was closed and nothing announced it. */
      if (reg.waiting && navigator.serviceWorker.controller) announce()

      reg.addEventListener('updatefound', () => {
        const next = reg.installing
        if (!next) return
        next.addEventListener('statechange', () => {
          /* installed with a controller already present = an update.
             installed with no controller = the very first install, which
             is this page's own version and not news. */
          if (next.state === 'installed' && navigator.serviceWorker.controller) announce()
        })
      })

      const check = () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}) }
      setInterval(check, CHECK_EVERY)
      document.addEventListener('visibilitychange', check)
      check()
    })
    .catch(() => { /* not fatal: the app runs, it just will not run offline */ })
}

/* Reloading past the worker.

   A plain reload can be answered from the cache the old worker still
   controls. Clearing the caches first means the next request has nowhere
   to come from but the network. */
export async function reloadForUpdate() {
  try {
    if ('caches' in window) {
      for (const k of await caches.keys()) await caches.delete(k)
    }
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg?.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' })
  } catch { /* whatever fails here, the reload below is still worth doing */ }
  window.location.reload()
}
