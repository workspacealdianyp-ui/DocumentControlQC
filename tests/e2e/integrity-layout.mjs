import { mkdir } from 'node:fs/promises'

export async function checkIntegrityLayout(browser, base, check, errors) {
  await mkdir('tmp/home-layout/integrity', { recursive: true })
  for (const width of [1440, 820, 390]) {
    for (const theme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width, height: 900 } })
      page.on('pageerror', (error) => errors.push(`integrity/${width}/${theme}: ${error.message}`))
      await page.goto(base, { waitUntil: 'networkidle' })
      await page.evaluate((theme) => {
        localStorage.clear()
        localStorage.setItem('qc.session', JSON.stringify({ name: 'QA Lead', role: 'admin' }))
        localStorage.setItem('qc.theme', theme)
      }, theme)
      await page.goto(`${base}/#/reports`, { waitUntil: 'networkidle' })
      await page.reload({ waitUntil: 'networkidle' })
      await page.locator('.sync-tag').first().waitFor()
      const tags = await page.locator('.sync-tag').allTextContents()
      check(tags.length > 0 && tags.every((tag) => tag.includes('On this device')), `integrity/${width}/${theme}: reports state local storage honestly`)
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `integrity/${width}/${theme}: report list does not overflow`)
      await page.screenshot({ path: `tmp/home-layout/integrity/reports-${width}-${theme}.png`, fullPage: true })
      await page.close()
    }
  }
}
