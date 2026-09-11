import { mkdir } from 'node:fs/promises'

// Runs on the CI browser with seeded demonstration data. Measure the real
// layout: a PDF renderer cannot establish browser grid/flex sizing.
export async function checkHomeLayout(browser, base, check, errors) {
  await mkdir('tmp/home-layout', { recursive: true })
  const users = [
    { name: 'Inspector Two', role: 'inspector' },
    { name: 'Quality Engineer', role: 'engineer' },
    { name: 'QC Supervisor', role: 'supervisor' },
    { name: 'QA Lead', role: 'admin' },
    { name: 'Management Viewer', role: 'viewer' },
  ]
  for (const width of [1440, 820, 390]) {
    for (const theme of ['light', 'dark']) {
      for (const user of users) {
        const label = `home/${width}/${theme}/${user.role}`
        const page = await browser.newPage({ viewport: { width, height: 900 } })
        page.on('pageerror', (e) => errors.push(`${label}: ${e.message}`))
        await page.goto(base, { waitUntil: 'networkidle' })
        await page.evaluate(({ user, theme }) => {
          localStorage.clear()
          localStorage.setItem('qc.session', JSON.stringify(user))
          localStorage.setItem('qc.theme', theme)
        }, { user, theme })
        await page.reload({ waitUntil: 'networkidle' })
        await page.locator('.home-toolbar img').evaluate((img) => img.decode())
        await page.evaluate(() => document.fonts.ready)
        const geometry = await page.evaluate(() => {
          const rect = (n) => n.getBoundingClientRect()
          const rows = [...document.querySelectorAll('.home-row')].map((row) => {
            const panels = [...row.children].map(rect)
            return { heights: panels.map((p) => p.height), aligned: panels.every((p, i) => panels.every((q, j) => i === j || Math.abs(p.y - q.y) > 2 || Math.abs(p.height - q.height) < 2)) }
          })
          const recent = document.querySelector('#home-updates-title').closest('section')
          return {
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            rows, recentHeight: rect(recent).height,
            bannerHeight: rect(document.querySelector('.home-toolbar')).height,
          }
        })
        check(geometry.overflow <= 1, `${label}: no horizontal overflow`)
        check(geometry.rows.every((r) => r.aligned), `${label}: panels on the same row have equal heights`)
        check(geometry.rows.every((r) => r.heights.every((h) => h < 700)) && geometry.recentHeight < 300,
          `${label}: content determines panel height (${JSON.stringify(geometry)})`)
        check(geometry.bannerHeight <= 340, `${label}: compact banner (${geometry.bannerHeight}px)`)
        await page.locator('.home-actions > *').first().focus()
        check(await page.locator('.home-actions > *').first().evaluate((n) => n === document.activeElement && getComputedStyle(n).outlineStyle !== 'none'), `${label}: visible keyboard focus`)
        await page.screenshot({ path: `tmp/home-layout/${user.role}-${width}-${theme}.png`, fullPage: true })
        await page.close()
      }
    }
  }
}
