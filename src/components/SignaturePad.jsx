import { useRef, useEffect, useState } from 'react'
import { IconPlus, IconTrash, IconPen } from './Icons.jsx'
import { getSavedSignature, saveSignatureFor } from '../lib/mockSign.js'

// Signature capture: use a saved signature, draw on canvas, OR upload a PNG/JPG.
// Returns { name, at, img } where img is a data URL.
export default function SignaturePad({ name, onSave, onClose }) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const last = useRef(null)
  const [hasInk, setHasInk] = useState(false)
  const [uploaded, setUploaded] = useState(null)

  useEffect(() => {
    const cv = canvasRef.current
    const ratio = window.devicePixelRatio || 1
    const w = cv.clientWidth, h = cv.clientHeight
    cv.width = w * ratio; cv.height = h * ratio
    const ctx = cv.getContext('2d')
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.strokeStyle = '#101828'
  }, [])

  const pos = (e) => {
    const cv = canvasRef.current
    const r = cv.getBoundingClientRect()
    const t = e.touches ? e.touches[0] : e
    return { x: t.clientX - r.left, y: t.clientY - r.top }
  }
  const start = (e) => { e.preventDefault(); drawing.current = true; last.current = pos(e) }
  const move = (e) => {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const p = pos(e)
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke()
    last.current = p; setHasInk(true)
  }
  const end = () => { drawing.current = false }

  const clearCanvas = () => {
    const cv = canvasRef.current
    cv.getContext('2d').clearRect(0, 0, cv.width, cv.height)
    setHasInk(false)
  }

  // upload an image and auto-knock-out the (light) background → transparent PNG
  const onUpload = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const c = document.createElement('canvas')
        c.width = img.naturalWidth; c.height = img.naturalHeight
        const ctx = c.getContext('2d')
        ctx.drawImage(img, 0, 0)
        try {
          const id = ctx.getImageData(0, 0, c.width, c.height)
          const d = id.data
          for (let i = 0; i < d.length; i += 4) {
            const lum = (d[i] + d[i + 1] + d[i + 2]) / 3
            if (lum > 205) d[i + 3] = 0                       // near-white → fully transparent
            else if (lum > 150) d[i + 3] = Math.round(((205 - lum) / 55) * d[i + 3]) // soft edge
          }
          ctx.putImageData(id, 0, 0)
          setUploaded(c.toDataURL('image/png'))
        } catch {
          setUploaded(reader.result) // cross-origin/taint fallback
        }
      }
      img.src = reader.result
    }
    reader.readAsDataURL(f)
  }

  const save = () => {
    let img = uploaded
    if (!img && hasInk) img = canvasRef.current.toDataURL('image/png')
    if (!img) return
    saveSignatureFor(name, img) // remember for next time
    onSave({ name, at: new Date().toISOString(), img })
  }

  const useSaved = () => {
    const img = getSavedSignature(name)
    onSave({ name, at: new Date().toISOString(), img })
  }

  const canSave = !!uploaded || hasInk

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal sign-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Add signature">
        <div className="sheet-handle" />
        <h3>Signature — {name}</h3>
        <p className="page-sub">Use your saved signature, draw below, or upload an image.</p>

        <button className="btn btn-secondary btn-block" style={{ marginTop: 6 }} onClick={useSaved}>
          <IconPen size={14} /> Use my saved signature
        </button>

        {uploaded ? (
          <div className="sign-uploaded">
            <img src={uploaded} alt="Uploaded signature" />
            <button className="btn btn-ghost btn-sm" onClick={() => setUploaded(null)}>
              <IconTrash size={13} /> Remove
            </button>
          </div>
        ) : (
          <div className="sign-canvas-wrap">
            <canvas
              ref={canvasRef} className="sign-canvas"
              onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
              onTouchStart={start} onTouchMove={move} onTouchEnd={end}
            />
            {!hasInk && <span className="sign-hint">✍️ Sign here</span>}
            <span className="sign-baseline" />
          </div>
        )}

        <div className="sign-actions">
          {!uploaded && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={clearCanvas} disabled={!hasInk}>Clear</button>
              <label className="btn btn-secondary btn-sm">
                <IconPlus size={13} /> Upload PNG
                <input type="file" accept="image/png,image/jpeg" hidden onChange={onUpload} />
              </label>
            </>
          )}
          <span style={{ flex: 1 }} />
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={!canSave}>Apply signature</button>
        </div>
      </div>
    </div>
  )
}
