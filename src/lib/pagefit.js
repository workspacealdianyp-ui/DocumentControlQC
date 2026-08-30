import { useEffect } from 'react'

/* One sheet, one page.

   A QC form is a fixed-layout document: it is meant to be read as a whole
   sheet, and a table that spills three rows onto a second page with the
   letterhead repeated is how a controlled document starts looking like a
   printout. It also breaks the data book, whose contents page can only
   name the right page if a sheet occupies exactly one.

   So a sheet that runs long is scaled down until it fits, the way a
   drawing office reduces a drawing to the paper it has. Nothing is
   dropped and nothing reflows across a boundary — the sheet just prints
   a little smaller, and the page numbers stay true. Below the floor the
   reduction would cost legibility, so the sheet is left to break
   naturally instead. */

const PAGE_CONTENT_MM = 271 // A4 height less the 12mm/14mm print margins
const MIN_ZOOM = 0.7

export function fitSheets(root) {
  if (!root) return
  const probe = document.createElement('div')
  probe.style.cssText = 'position:absolute;visibility:hidden;width:10mm;height:100mm'
  root.appendChild(probe)
  const mm = probe.getBoundingClientRect().height / 100
  probe.remove()
  if (!mm) return

  const usable = PAGE_CONTENT_MM * mm
  for (const sheet of root.querySelectorAll('.print-sheet')) {
    sheet.style.zoom = ''
    const content = sheet.querySelector('.ps-doc, .ps-cover')
    if (!content) continue
    /* Reducing a sheet reflows it — a heading that took two lines may now
       take one — so the first ratio is an estimate. Measure what the
       reduction actually produced and tighten until it really fits, which
       takes a pass or two and then stops. */
    let z = 1
    for (let pass = 0; pass < 4; pass++) {
      const h = content.getBoundingClientRect().height
      if (!h || h <= usable) break
      z = Math.max(MIN_ZOOM, Math.floor(z * (usable / h) * 0.998 * 1000) / 1000)
      sheet.style.zoom = String(z)
      if (z === MIN_ZOOM) break
    }
  }
}

// Re-fits once the layout has settled and again as images decode, since a
// photo that arrives late changes the height it was measured at.
export function useFitToPage(ref, deps = []) {
  useEffect(() => {
    const root = ref.current
    if (!root) return
    fitSheets(root)
    const again = () => fitSheets(root)
    const t = setTimeout(again, 150)
    const imgs = [...root.querySelectorAll('img')].filter((i) => !i.complete)
    imgs.forEach((i) => i.addEventListener('load', again))
    window.addEventListener('beforeprint', again)
    return () => {
      clearTimeout(t)
      imgs.forEach((i) => i.removeEventListener('load', again))
      window.removeEventListener('beforeprint', again)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
