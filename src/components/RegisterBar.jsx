import { useEffect, useRef, useState } from 'react'
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
   the point: a filter you cannot see is a filter you forget you set. */
export function ToolButton({ icon: Icon, label, count = 0, children, align = 'right' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const esc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [open])
  return (
    <div className="rb-tool" ref={ref}>
      <button type="button" className={`rb-btn${count ? ' is-on' : ''}${open ? ' is-open' : ''}`}
        aria-haspopup="dialog" aria-expanded={open} aria-label={label} title={label}
        onClick={() => setOpen((v) => !v)}>
        <Icon size={16} />
        {count > 0 && <span className="rb-count">{count}</span>}
      </button>
      {open && (
        <div className={`rb-pop rb-pop-${align}`} role="dialog" aria-label={label}>
          <div className="rb-pop-head">{label}</div>
          {children({ close: () => setOpen(false) })}
        </div>
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
