/* Renders public/icon.svg and icon-maskable.svg to the PNGs a phone needs
   when the app is installed to a home screen.
     node scripts/gen-icons.mjs

   Needs Playwright, which is not a dependency of this project — the PNGs
   are committed, so this only has to run when the icon changes. Rendering
   through a browser rather than hand-rolling a PNG encoder is what gets
   the strokes anti-aliased the way the mark is drawn. */
import { readFileSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const OUT = [
  { src: 'public/icon.svg', size: 192, file: 'public/icon-192.png' },
  { src: 'public/icon.svg', size: 512, file: 'public/icon-512.png' },
  // iOS has no maskable concept and does not round the corners itself, so
  // it gets the already-rounded one at the size Safari asks for.
  { src: 'public/icon.svg', size: 180, file: 'public/apple-touch-icon.png' },
  { src: 'public/icon-maskable.svg', size: 512, file: 'public/icon-maskable-512.png' },
]

// PW_CHROMIUM lets a sandbox point at a browser Playwright did not
// install itself; everywhere else the default is right.
const br = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {})
for (const { src, size, file } of OUT) {
  const svg = readFileSync(src, 'utf8')
  const pg = await br.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
  await pg.setContent(`<body style="margin:0;width:${size}px;height:${size}px">${svg.replace(/width='?"?512"?'?/, `width="${size}"`).replace(/height='?"?512"?'?/, `height="${size}"`)}</body>`)
  await pg.waitForTimeout(150)
  writeFileSync(file, await pg.screenshot({ omitBackground: true }))
  await pg.close()
  console.log(file, size + 'px')
}
await br.close()
