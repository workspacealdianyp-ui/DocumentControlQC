import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconSearch, IconClose, IconCheck } from './Icons.jsx'

/* The toolbar both registers share: a search field with the action
   inside it, and rounded-square tool buttons beside it.

   The field is drawn from the supplied reference — a soft inset ground
   with the button seated at its right edge, so the control reads as one
   object rather than an input that happens to sit next to a button. */

export function SearchField({ value, onChange, placeholder, label }) {
  const ref = useRef(null)
  return (
    <div className={`rb-search${value ? ' has-value' : ''}`}>
      <input ref={ref} type="search" value={value} aria-label={label}
        placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {/* Clearing is the action a filled field actually needs; searching
          is already live. The button swaps rather than doubling up. */}
      {value ? (
        <button type="button" className="rb-search-btn" aria-label="Clear search"
          onClick={() => { onChange(''); ref.current?.focus() }}>
          <IconClose size={15} />
        </button>
      ) : (
        <button type="button" className="rb-search-btn" aria-label={label} tabIndex={-1}
          onClick={() => ref.current?.focus()}>
          <IconSearch size={15} />
        </button>
      )}
    </div>
  )
}

/* A rounded square that opens a panel under itself. The count badge is
   the point: a filter you cannot see is a filter you forget you set.

   The panel is a portal on fixed coordinates rather than a child of the
   button. It has to be: the card it sits in uses overflow:clip to keep
   the sticky header working, and a panel inside that box gets sliced
   off the moment the table is shorter than the panel. */
export function ToolButton({ icon: Icon, label, count = 0, children }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const ref = useRef(null)
  const popRef = useRef(null)

  const place = useCallback(() => {
    const b = ref.current?.getBoundingClientRect()
    if (!b) return
    const h = popRef.current?.offsetHeight || 300
    const w = popRef.current?.offsetWidth || 220
    const below = window.innerHeight - b.bottom - 12
    // Flip above when there is not enough room below, and never let the
    // panel run off the left edge on a narrow screen.
    const up = below < h && b.top > below
    setPos({
      top: up ? Math.max(8, b.top - h - 7) : b.bottom + 7,
      left: Math.max(8, Math.min(b.right - w, window.innerWidth - w - 8)),
      max: up ? b.top - 16 : below,
    })
  }, [])

  useLayoutEffect(() => { if (open) place() }, [open, place])

  useEffect(() => {
    if (!open) return
    const away = (e) => {
      if (ref.current?.contains(e.target) || popRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const esc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, place])

  return (
    <div className="rb-tool" ref={ref}>
      <button type="button" className={`rb-btn${count ? ' is-on' : ''}${open ? ' is-open' : ''}`}
        aria-haspopup="dialog" aria-expanded={open} aria-label={label} title={label}
        onClick={() => setOpen((v) => !v)}>
        <Icon size={16} />
        {count > 0 && <span className="rb-count">{count}</span>}
      </button>
      {open && createPortal(
        <div ref={popRef} className="rb-pop" role="dialog" aria-label={label}
          style={pos ? { top: pos.top, left: pos.left, maxHeight: Math.max(160, pos.max) } : { visibility: 'hidden' }}>
          <div className="rb-pop-head">{label}</div>
          {children({ close: () => setOpen(false) })}
        </div>,
        document.body
      )}
    </div>
  )
}

// A checkable line inside a tool panel.
export function PopCheck({ label, on, onChange, hint }) {
  return (
    <label className={`rb-opt${on ? ' on' : ''}`}>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span className="rb-opt-box" aria-hidden="true"><IconCheck size={11} /></span>
      <span className="rb-opt-label">{label}</span>
      {hint != null && <span className="rb-opt-hint">{hint}</span>}
    </label>
  )
}

// A single-choice line, for grouping.
export function PopRadio({ label, on, onChange }) {
  return (
    <label className={`rb-opt is-radio${on ? ' on' : ''}`}>
      <input type="radio" checked={on} onChange={() => onChange()} />
      <span className="rb-opt-dot" aria-hidden="true" />
      <span className="rb-opt-label">{label}</span>
    </label>
  )
}

export function PopFooter({ children }) {
  return <div className="rb-pop-foot">{children}</div>
}
