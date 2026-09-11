// Static design-review output; no browser session or customer data.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
const out = resolve(process.argv[2] || 'tmp/home-review')
await mkdir(out, { recursive: true })
const memory = new Map()
globalThis.localStorage = { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, String(v)), removeItem: (k) => memory.delete(k) }
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { HomeDashboard } = await server.ssrLoadModule('/src/components/Home.jsx')
  const { ROLES, USERS } = await server.ssrLoadModule('/src/lib/constants.js')
  const { seedReports, SEED_STAMP } = await server.ssrLoadModule('/src/data/seedReports.js')
  const { homeOverview } = await server.ssrLoadModule('/src/lib/homeOverview.js')
  const { buildContext } = await server.ssrLoadModule('/src/lib/status.js')
  const { byCustomer } = await server.ssrLoadModule('/src/lib/rollup.js')
  const { jobs } = JSON.parse(await readFile('src/data/joblist.json', 'utf8'))
  const records = seedReports()
  memory.set('qc.seeded.v3', '1'); memory.set('qc.storeVersion', '4'); memory.set('qc.seedStamp', SEED_STAMP); memory.set('qc.reports', JSON.stringify(records))
  const ctx = buildContext(records), now = new Date('2026-09-11T08:00:00')
  const css = `${await readFile('src/styles.css', 'utf8')}\n${await readFile('src/components/Home.css', 'utf8')}`
  const art = `data:image/webp;base64,${(await readFile('src/assets/home-mining.webp')).toString('base64')}`
  await writeFile(resolve(out, 'styles.css'), css)
  for (const role of Object.keys(ROLES)) {
    const session = USERS.find((u) => u.role === role)
    const props = { records, role: ROLES[role], session, now, data: homeOverview(jobs, records, ctx, session.name, now), customers: byCustomer(jobs, ctx), onOpen() {}, onJob() {}, onNew() {} }
    const body = renderToStaticMarkup(React.createElement(HomeDashboard, props)).replace(/src="[^"]*home-mining[^" ]*"/, `src="${art}"`)
    await writeFile(resolve(out, `${role}.html`), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="styles.css"><title>${role} Home design review</title></head><body><p class="qa-note">DEMONSTRATION DATA · OFFLINE LAYOUT REVIEW</p>${body}</body></html>`)
  }
  console.log(`Home samples written to ${out}`)
} finally { await server.close() }
