/* Re-encodes the cut-out product art for the web.
     node scripts/gen-art.mjs

   The master that came out of the background remover is 1236x848 and
   1.2 MB of PNG. The masthead draws it about 330 CSS px wide, so even a
   2x display never asks for more than ~700. Shipping the master would
   put a megabyte on the first paint of every page that has a band —
   on a workshop tablet over site wifi, which is the connection this app
   is actually used on.

   Output is committed, so this only runs when the art changes. The
   master stays in the repo as the source to re-cut from. */
import { readFileSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const OUT = [
  { src: 'src/assets/Optiload Remove Background.png', width: 800, file: 'src/assets/product-optiload.webp' },
]

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const page = await browser.newPage()
for (const { src, width, file } of OUT) {
  const uri = `data:image/png;base64,${readFileSync(src).toString('base64')}`
  const data = await page.evaluate(async ({ uri, width }) => {
    const img = new Image()
    img.src = uri
    await img.decode()
    const c = document.createElement('canvas')
    c.width = width
    c.height = Math.round((img.naturalHeight / img.naturalWidth) * width)
    // The art is a cut-out, so the alpha edge is the whole quality of it:
    // a nearest-neighbour downscale leaves it ragged against the card.
    const ctx = c.getContext('2d')
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/webp', 0.9).split(',')[1]
  }, { uri, width })
  writeFileSync(file, Buffer.from(data, 'base64'))
  console.log(file, (readFileSync(file).length / 1024).toFixed(0) + ' KB')
}
await browser.close()
