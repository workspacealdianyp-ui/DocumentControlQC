import { useEffect, useRef } from 'react'

/* One sheet, one page.

   A QC form is a fixed-layout document: it is meant to be read as a whole
   sheet, and a table that spills three rows onto a second page with the
   letterhead repeated is how a controlled document starts looking like a
   printout. It also breaks the data book, whose contents page can only
   name the right page if it knows what each sheet costs.

   So a sheet that runs long is scaled down until it fits, the way a
   drawing office reduces a drawing to the paper it has. Nothing is
   dropped and nothing reflows across a boundary — the sheet just prints
   a little smaller. Past the floor the reduction would cost more than the
   break does, so the sheet is left to flow and its real page count is
   reported instead, which is what keeps the contents page true either
   way. */

const PAGE_CONTENT_MM = 271 // A4 height less the 12mm/14mm print margins
const MIN_ZOOM = 0.7

/* Measure at the width it will print at, not the width it happens to be
   shown at. The preview sheet is `210mm` but `max-width: 100%`, so in a
   narrow window it is drawn smaller, text wraps to more lines, and every
   sheet would be scaled down 15–30% more than the paper actually needs —
   including on the beforeprint pass, which sees that same screen layout. */
const MEASURING = 'pf-measuring'

export function fitSheets(root) {
  if (!root) return []
  root.classList.add(MEASURING)
  try {
    const probe = document.createElement('div')
    probe.style.cssText = 'position:absolute;visibility:hidden;width:10mm;height:100mm'
    root.appendChild(probe)
    const mm = probe.getBoundingClientRect().height / 100
    probe.remove()
    if (!mm) return []

    const usable = PAGE_CONTENT_MM * mm
    return [...root.querySelectorAll('.print-sheet')].map((sheet) => {
      sheet.style.zoom = ''
      const content = sheet.querySelector('.ps-doc, .ps-cover')
      if (!content) return { pages: 1, over: 1 }
      const height = () => content.getBoundingClientRect().height / (parseFloat(sheet.style.zoom) || 1)

      /* Reducing a sheet reflows it — a heading that took two lines may
         now take one — so the first ratio is only an estimate. Measure
         what the reduction actually produced and tighten until it really
         fits, which takes a pass or two and then stops. */
      let z = 1
      for (let pass = 0; pass < 4 && z > MIN_ZOOM; pass++) {
        const h = content.getBoundingClientRect().height
        if (!h || h <= usable) break
        z = Math.max(MIN_ZOOM, Math.floor(z * (usable / h) * 0.998 * 1000) / 1000)
        sheet.style.zoom = String(z)
      }

      if (content.getBoundingClientRect().height <= usable) return { pages: 1, over: 1 }

      /* Still over at the floor. Shrinking further would make it both
         unreadable and broken, so let it flow and count the pages it
         genuinely takes — the letterhead and footer repeat on each of
         them, which is what leaves room on the ones after the first.

         `over` is how much taller than a page it stayed. A document that
         can put fewer rows on a sheet uses it to do exactly that, which
         is the real fix: the sheet comes back at full size and the count
         stops being an estimate. */
      sheet.style.zoom = ''
      const full = height()
      const head = sheet.querySelector('thead')?.getBoundingClientRect().height || 0
      const foot = sheet.querySelector('tfoot')?.getBoundingClientRect().height || 0
      const after = Math.max(usable - head - foot, usable * 0.4)
      return { pages: 1 + Math.ceil((full - usable) / after), over: full / usable }
    })
  } finally {
    root.classList.remove(MEASURING)
  }
}

/* Per-sheet page counts → the page each sheet starts and ends on. A sheet
   that takes one page has from === to, which is the ordinary case. */
export function pageSpans(fit) {
  let n = 1
  const spans = (fit || []).map((f) => {
    const from = n
    n += Math.max(1, f?.pages || 1)
    return [from, n - 1]
  })
  return { spans, total: Math.max(n - 1, 1) }
}

export const oneEach = (n) => Array.from({ length: n }, () => ({ pages: 1, over: 1 }))

export const sameFit = (a, b) =>
  !!a && !!b && a.length === b.length && a.every((f, i) => f.pages === b[i].pages && Math.abs(f.over - b[i].over) < 0.005)

/* How much smaller this document's row chunks have to be for its sheets
   to fit at full size — one step, straight from how far over they were. */
export function tighten(current, fitSlice) {
  const worst = Math.max(1, ...fitSlice.map((f) => f?.over || 1))
  if (worst <= 1.005) return current
  return Math.max(0.25, (current || 1) / worst * 0.97)
}

/* Fits after layout has settled and again as images decode, since a photo
   that arrives late changes the height everything was measured at. Reports
   what each sheet cost so the document can number itself from what the
   paper actually did — and re-chunk if a sheet would not fit at all. */
export function useFitToPage(ref, deps = [], onFit) {
  // Held in a ref: the callback reports against the document as it is now,
  // not as it was on the render that started the effect.
  const cb = useRef(onFit)
  cb.current = onFit
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const run = () => {
      const fit = fitSheets(root)
      if (cb.current) cb.current(fit)
    }
    run()
    const t = setTimeout(run, 150)
    const imgs = [...root.querySelectorAll('img')].filter((i) => !i.complete)
    imgs.forEach((i) => i.addEventListener('load', run))
    window.addEventListener('beforeprint', run)
    return () => {
      clearTimeout(t)
      imgs.forEach((i) => i.removeEventListener('load', run))
      window.removeEventListener('beforeprint', run)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}


/* ── fitting the preview to the screen ────────────────────────────
   A sheet is 210mm wide and its tables are table-layout:fixed, so a
   phone cannot be given a narrower one: the columns do not reflow, they
   crush, and a header set in 8.5pt ends up breaking one letter per line.

   A print preview has one job, which is to show the page as it will
   print. So the page keeps its width and the preview scales, the way
   every real print preview does. `zoom` rather than a transform because
   zoom reflows the box: the scroll height shrinks with the page instead
   of leaving a screen of empty space under it.

   The zoom goes on a wrapper, never on .print-sheet, because fitSheets()
   above already owns that property for the page-fit reduction. */
const SHEET_MM = 210

export function useSheetZoom(ref) {
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const fit = () => {
      // Measure a millimetre rather than assuming 96dpi.
      const probe = document.createElement('div')
      probe.style.cssText = 'position:absolute;visibility:hidden;height:1px;width:100mm'
      root.appendChild(probe)
      const sheetPx = (probe.getBoundingClientRect().width / 100) * SHEET_MM
      probe.remove()
      if (!sheetPx) return
      const cs = getComputedStyle(root)
      const avail = root.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      // Never enlarge: a sheet shown bigger than A4 is not a preview.
      root.style.setProperty('--sheet-zoom', String(Math.min(1, avail / sheetPx)))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(root)
    return () => ro.disconnect()
  }, [ref])
}
