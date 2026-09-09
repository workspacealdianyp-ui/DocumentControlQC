import { describe, it, expect, vi, beforeEach } from 'vitest'

/* A second build cannot be produced inside a browser test, so the
   worker registration is the thing being stubbed: what matters is which
   of its states this module treats as news. */
const load = async () => { vi.resetModules(); return import('../../src/lib/appUpdate.js') }

class FakeWorker extends EventTarget {
  constructor(state = 'installing') { super(); this.state = state; this.messages = [] }
  postMessage(m) { this.messages.push(m) }
  become(state) { this.state = state; this.dispatchEvent(new Event('statechange')) }
}

class FakeReg extends EventTarget {
  constructor({ waiting = null } = {}) { super(); this.waiting = waiting; this.installing = null; this.updates = 0 }
  update() { this.updates++; return Promise.resolve() }
  install(worker) { this.installing = worker; this.dispatchEvent(new Event('updatefound')) }
}

const setup = ({ controller = {}, reg = new FakeReg() } = {}) => {
  navigator.serviceWorker = {
    controller,
    register: vi.fn(() => Promise.resolve(reg)),
    getRegistration: vi.fn(() => Promise.resolve(reg)),
  }
  return reg
}

const settle = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => { vi.useRealTimers() })

describe('noticing a new build', () => {
  it('says nothing on the first install, when there is no controller', async () => {
    const reg = setup({ controller: null })
    const { registerServiceWorker, updateReady } = await load()
    registerServiceWorker('/')
    await settle()

    const w = new FakeWorker()
    reg.install(w)
    w.become('installed')
    // No controller = this page's own worker arriving for the first
    // time. That is not an update and telling somebody to reload for it
    // would be telling them to reload into what they already have.
    expect(updateReady()).toBe(false)
  })

  it('announces a worker that installs while a page is already controlled', async () => {
    const reg = setup()
    const { registerServiceWorker, updateReady } = await load()
    const seen = []
    registerServiceWorker('/')
    await settle()

    const { onUpdateReady } = await import('../../src/lib/appUpdate.js')
    onUpdateReady((v) => seen.push(v))

    const w = new FakeWorker()
    reg.install(w)
    w.become('installed')

    expect(updateReady()).toBe(true)
    expect(seen).toEqual([true])
  })

  it('announces one that was already waiting when the page opened', async () => {
    // The update landed while the tab was closed; nothing fired an event
    // for it, so the registration has to be looked at rather than waited on.
    setup({ reg: new FakeReg({ waiting: new FakeWorker('installed') }) })
    const { registerServiceWorker, updateReady } = await load()
    registerServiceWorker('/')
    await settle()
    expect(updateReady()).toBe(true)
  })

  it('tells a listener that subscribes after the fact', async () => {
    const reg = setup()
    const mod = await load()
    mod.registerServiceWorker('/')
    await settle()
    const w = new FakeWorker()
    reg.install(w)
    w.become('installed')

    const late = []
    mod.onUpdateReady((v) => late.push(v))
    expect(late).toEqual([true])
  })

  it('stops telling a listener that unsubscribed', async () => {
    const reg = setup()
    const mod = await load()
    mod.registerServiceWorker('/')
    await settle()
    const seen = []
    mod.onUpdateReady((v) => seen.push(v))()   // subscribe and immediately drop it

    const w = new FakeWorker()
    reg.install(w)
    w.become('installed')
    expect(seen).toEqual([])
  })

  it('asks the registration to check when the page becomes visible', async () => {
    const reg = setup()
    const { registerServiceWorker } = await load()
    registerServiceWorker('/')
    await settle()
    const first = reg.updates
    document.dispatchEvent(new Event('visibilitychange'))
    await settle()
    expect(reg.updates).toBeGreaterThan(first)
  })

  it('does nothing at all where there is no service worker', async () => {
    delete navigator.serviceWorker
    const { registerServiceWorker, updateReady } = await load()
    expect(() => registerServiceWorker('/')).not.toThrow()
    expect(updateReady()).toBe(false)
  })

  it('survives a registration that fails', async () => {
    navigator.serviceWorker = { controller: {}, register: () => Promise.reject(new Error('blocked')) }
    const { registerServiceWorker, updateReady } = await load()
    registerServiceWorker('/')
    await settle()
    expect(updateReady()).toBe(false)
  })
})

describe('reloading onto the new build', () => {
  it('clears every cache, asks the waiting worker to take over, then reloads', async () => {
    const deleted = []
    globalThis.caches = {
      keys: () => Promise.resolve(['qc-old', 'qc-new']),
      delete: (k) => { deleted.push(k); return Promise.resolve(true) },
    }
    const waiting = new FakeWorker('installed')
    setup({ reg: new FakeReg({ waiting }) })
    const reload = vi.fn()
    Object.defineProperty(window, 'location', { value: { reload }, writable: true })

    const { reloadForUpdate } = await load()
    await reloadForUpdate()

    // A plain reload can be answered from the cache the old worker still
    // controls, so the caches go first.
    expect(deleted).toEqual(['qc-old', 'qc-new'])
    expect(waiting.messages).toEqual([{ type: 'SKIP_WAITING' }])
    expect(reload).toHaveBeenCalledOnce()
  })

  it('reloads even when clearing the caches throws', async () => {
    globalThis.caches = { keys: () => Promise.reject(new Error('denied')) }
    setup()
    const reload = vi.fn()
    Object.defineProperty(window, 'location', { value: { reload }, writable: true })
    const { reloadForUpdate } = await load()
    await reloadForUpdate()
    expect(reload).toHaveBeenCalledOnce()
  })
})
