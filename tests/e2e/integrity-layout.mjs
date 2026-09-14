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
      await page.goto(`${base}/#/settings?s=storage`, { waitUntil: 'networkidle' })
      const file = { format: 'qc-inspection-monitor-backup', version: 3, data: { 'qc.reports': [], 'qc.overrideEvents': [{ id: 'restore-preview-event', reason: 'Evidence checked' }], 'qc.issueCounters': { 'preview-counter': 1 } } }
      await page.locator('input[type="file"][accept="application/json,.json"]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) })
      await page.getByRole('heading', { name: 'Restore this backup?' }).waitFor()
      check(await page.getByText('Status history: 1 added', { exact: false }).isVisible(), `integrity/${width}/${theme}: restore previews history changes`)
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `integrity/${width}/${theme}: restore preview does not overflow`)
      await page.getByRole('button', { name: 'Cancel', exact: true }).focus()
      check(await page.getByRole('button', { name: 'Cancel', exact: true }).evaluate((node) => node === document.activeElement && getComputedStyle(node).outlineStyle !== 'none'), `integrity/${width}/${theme}: restore has visible keyboard focus`)
      await page.screenshot({ path: `tmp/home-layout/integrity/restore-${width}-${theme}.png`, fullPage: true })
      await page.getByRole('button', { name: 'Cancel', exact: true }).click()
      await page.close()
    }
  }
}
