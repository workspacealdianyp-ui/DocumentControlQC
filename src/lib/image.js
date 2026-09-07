/* Down-scaling for anything the app stores as an image.

   Everything here lives in localStorage, and a browser gives us on the
   order of 9-10 MB in total. A photo straight off a phone is 3-5 MB, and
   a data URL adds a third on top of that, so two or three untouched
   evidence photos fill the whole store and the next report cannot be
   saved at all. Scaling on the way in is what keeps a job's worth of
   records inside the budget.

   The long edge is what matters: an inspection photo has to show a weld,
   a gauge face, a tag number. 1600px keeps that legible and lands around
   250-400 KB, roughly a fifteenth of the original. */

export const EVIDENCE_PX = 1600   // site photos attached to a report
export const PORTRAIT_PX = 256    // profile pictures and signatures

export function shrink(file, max = EVIDENCE_PX, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onerror = () => reject(new Error(`${file.name || 'the file'} could not be read`))
    fr.onload = () => {
      const img = new Image()
      // A format the browser cannot decode (HEIC off an iPhone is the
      // usual one) fails here rather than silently storing nothing.
      img.onerror = () => reject(new Error(`${file.name || 'the file'} is not an image this browser can open`))
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const c = document.createElement('canvas')
        c.width = w; c.height = h
        const ctx = c.getContext('2d')
        // JPEG has no alpha; without a white ground a transparent PNG
        // comes out on black.
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)
        resolve(c.toDataURL('image/jpeg', quality))
      }
      img.src = fr.result
    }
    fr.readAsDataURL(file)
  })
}

// Roughly what a data URL costs in storage, for showing a budget.
export const dataUrlBytes = (s) => {
  if (typeof s !== 'string') return 0
  const i = s.indexOf(',')
  return i < 0 ? s.length : Math.round((s.length - i - 1) * 0.75)
}
