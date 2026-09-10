import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/* The check workflow was red on every run for a week and never at a
   journey: the harness handed launch a browser path that exists on the
   dev container and on no runner, so it died before the first one. The
   rule that came out of it is the thing worth holding onto — a path is
   passed only when something is actually there. */

const present = new Set()
const existsSync = (p) => present.has(p)
// A default export as well as the named one: something further down the
// chain reaches for `fs` rather than `{ existsSync }`, and vitest fails
// the mock outright rather than falling back to the real module.
vi.mock('node:fs', () => ({ existsSync, default: { existsSync } }))

const CONTAINER = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const load = async () => { vi.resetModules(); return import('../../scripts/chromium.mjs') }

describe('which chromium the tooling drives', () => {
  beforeEach(() => { present.clear(); delete process.env.PW_CHROMIUM })
  afterEach(() => { delete process.env.PW_CHROMIUM })

  it('passes no path when there is no browser to point at', async () => {
    // A runner after `playwright install`: Playwright knows where its
    // own browser is, and an executablePath only gets in the way.
    const { chromiumLaunch } = await load()
    expect(chromiumLaunch()).toEqual({})
  })

  it('ignores PW_CHROMIUM when it names a file that is not there', async () => {
    // The failure itself. A path that cannot be opened must never reach
    // launch — a missing browser means "you find it", not "fail".
    process.env.PW_CHROMIUM = '/nonexistent/chrome'
    const { chromiumLaunch } = await load()
    expect(chromiumLaunch()).toEqual({})
  })

  it('uses the container browser when that is what is installed', async () => {
    present.add(CONTAINER)
    const { chromiumLaunch } = await load()
    expect(chromiumLaunch()).toEqual({ executablePath: CONTAINER })
  })

  it('prefers PW_CHROMIUM over the container path', async () => {
    present.add(CONTAINER)
    present.add('/custom/chrome')
    process.env.PW_CHROMIUM = '/custom/chrome'
    const { chromiumLaunch } = await load()
    expect(chromiumLaunch()).toEqual({ executablePath: '/custom/chrome' })
  })

  it('falls through to the container path when PW_CHROMIUM is wrong', async () => {
    present.add(CONTAINER)
    process.env.PW_CHROMIUM = '/nonexistent/chrome'
    const { chromiumLaunch } = await load()
    expect(chromiumLaunch()).toEqual({ executablePath: CONTAINER })
  })

  it('keeps the options the caller passed, either way', async () => {
    const { chromiumLaunch } = await load()
    expect(chromiumLaunch({ headless: false })).toEqual({ headless: false })
    present.add(CONTAINER)
    const fresh = await load()
    expect(fresh.chromiumLaunch({ headless: false }))
      .toEqual({ executablePath: CONTAINER, headless: false })
  })
})
