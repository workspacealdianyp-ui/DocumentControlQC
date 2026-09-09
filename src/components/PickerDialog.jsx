import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import './PickerDialog.css'

export default function PickerDialog({ title, sub, onClose, onBack, step, children }) {
  const ref = useRef(null)
  const heading = useRef(null)
  const titleId = useId()
  const subId = useId()
  useEffect(() => {
    const opener = document.activeElement
    const dialog = ref.current
    dialog.showModal()
    return () => {
      dialog.close()
      if (opener?.isConnected) opener.focus()
    }
  }, [])
  useEffect(() => { heading.current?.focus() }, [step])
  return createPortal(
    <dialog ref={ref} className="picker-dialog" aria-labelledby={titleId}
      aria-describedby={sub ? subId : undefined}
      onCancel={(e) => { e.preventDefault(); onClose() }}>
      <header className="picker-heading">
        {onBack && <button type="button" className="picker-back" onClick={onBack}>← Back</button>}
        <h2 id={titleId} ref={heading} tabIndex={-1}>{title}</h2>
        {sub && <p id={subId}>{sub}</p>}
      </header>
      <div className="picker-body">{children}</div>
      <footer className="picker-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button></footer>
    </dialog>, document.body
  )
}
