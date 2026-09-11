/* The journeys a unit test cannot see.

   Playwright without the test runner: the app is a static build served
   by vite preview, and the things worth checking end to end are few
   enough to read in one file. It builds, serves, drives, and reports.

   What it covers is chosen by what a unit test cannot reach — that the
   role a person signs in as actually changes what they can press, that a
   destructive action asks before it acts, and that every route renders
   under each role at a phone width and a desktop one.

   Run with: npm run e2e   (add --headed to watch it) */
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'
import { setTimeout as wait } from 'node:timers/promises'
import { chromiumLaunch } from '../../scripts/chromium.mjs'
import { checkHomeLayout } from './home-layout.mjs'

const PORT = Number(process.env.E2E_PORT || 4180)
const BASE = `http://localhost:${PORT}`

let fail = 0
let count = 0
const check = (ok, msg) => {
  count++
  if (ok) console.log(`  ok    ${msg}`)
  else { fail++; console.log(`  FAIL  ${msg}`) }
}

const USERS = {
  admin: { name: 'QA Lead', role: 'admin' },
  inspector: { name: 'Inspector Two', role: 'inspector' },
  viewer: { name: 'Management Viewer', role: 'viewer' },
}

const ROUTES = [
  '#/', '#/monitoring', '#/monitoring?view=all', '#/reports', '#/vault',
  '#/customer/Customer%2003', '#/po/PO-2026-BKT-0512', '#/job/1000310001',
  '#/job/1000310001/form/dimensional?d=Dimension%20Report',
  '#/settings', '#/help', '#/profile', '#/monitoring/new',
]

async function serve() {
  const p = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE)
      if (r.ok) return p
    } catch { /* not up yet */ }
    await wait(500)
  }
  p.kill()
  throw new Error(`vite preview did not come up on ${PORT}`)
}

async function signIn(page, who) {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate((u) => {
    localStorage.clear()
    localStorage.setItem('qc.session', JSON.stringify(u))
  }, USERS[who])
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
}

async function main() {
  const server = await serve()
  const browser = await chromium.launch(chromiumLaunch())
  const errors = []

  try {
    await checkHomeLayout(browser, BASE, check, errors)
    /* ── every route paints, under every role, at both widths ── */
    for (const [w, h, size] of [[1440, 900, 'desktop'], [390, 844, 'phone']]) {
      for (const who of ['admin', 'inspector', 'viewer']) {
        const page = await browser.newPage({ viewport: { width: w, height: h } })
        page.on('pageerror', (e) => errors.push(`${size}/${who}: ${e.message}`))
        await signIn(page, who)
        console.log(`\n${size} · ${who}`)
        let painted = 0
        let overflow = 0
        for (const route of ROUTES) {
          await page.goto(BASE + '/' + route, { waitUntil: 'networkidle' })
          await page.waitForTimeout(500)
          const state = await page.evaluate(() => ({
            text: (document.querySelector('.content')?.innerText || '').trim().length,
            over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          }))
          if (state.text > 0) painted++
          if (state.over > 0) overflow++
        }
        check(painted === ROUTES.length, `all ${ROUTES.length} routes render something (${painted})`)
        check(overflow === 0, `no route scrolls sideways (${overflow} did)`)
        await page.close()
      }
    }

    /* ── the permission boundary ── */
    console.log('\nwhat each role can press')
    for (const [who, canManage] of [['admin', true], ['inspector', false], ['viewer', false]]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
      page.on('pageerror', (e) => errors.push(`perm/${who}: ${e.message}`))
      await signIn(page, who)

      await page.goto(`${BASE}/#/monitoring/new`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(900)
      const canRaise = await page.locator('button', { hasText: 'Publish job order' }).count()
      check(!!canRaise === canManage, `${who} ${canManage ? 'can' : 'cannot'} raise a job order`)

      await page.goto(`${BASE}/#/reports`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(1100)
      const bins = await page.locator('.rep-del').count()
      check(!!bins === canManage, `${who} ${canManage ? 'sees' : 'does not see'} the record actions in the register`)
      await page.close()
    }

    /* ── an approved report cannot be deleted, only voided ── */
    console.log('\nthe destructive action')
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    page.on('pageerror', (e) => errors.push(`void: ${e.message}`))
    await signIn(page, 'admin')
    await page.goto(`${BASE}/#/reports?f=approved`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1400)

    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('qc.reports') || '[]').length)
    const label = await page.locator('.rep-del').first().getAttribute('aria-label')
    check(/^Void /.test(label || ''), `the action on an approved report is Void, not Delete (${label})`)

    await page.locator('.rep-del').first().click()
    await page.waitForTimeout(500)
    check(await page.locator('[role="dialog"]').isVisible(), 'it asks before it acts')
    check(/not deleted/i.test(await page.locator('.confirm-body').innerText()), 'the dialog says the record is kept')

    // Without a reason it will not go through.
    await page.locator('.confirm-acts .btn').first().click()
    await page.waitForTimeout(400)
    check(await page.locator('[role="dialog"]').isVisible(), 'and will not proceed without a reason')

    await page.locator('.confirm-field textarea').fill('drawing revision B superseded')
    await page.locator('.confirm-acts .btn').first().click()
    await page.waitForTimeout(900)
    const after = await page.evaluate(() => {
      const all = JSON.parse(localStorage.getItem('qc.reports') || '[]')
      return { n: all.length, voided: all.filter((r) => r.status === 'voided').length }
    })
    check(after.n === before, `nothing was destroyed (${before} → ${after.n} records)`)
    check(after.voided === 1, 'the report is marked void and kept')

    // Escape closes without acting.
    await page.locator('.rep-del').first().click()
    await page.waitForTimeout(400)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    check(await page.locator('[role="dialog"]').count() === 0, 'Escape closes the dialog')
    await page.close()

    console.log('\npage errors:', errors.length ? errors : 'none')
    fail += errors.length
  } finally {
    await browser.close()
    server.kill()
  }

  console.log(`\n${fail ? `${fail} failed` : 'all passed'} — ${count} checks`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
