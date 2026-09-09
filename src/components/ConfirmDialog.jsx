import { useEffect, useId, useRef, useState } from 'react'

/* One dialog for every decision that cannot be taken back.

   There were three ways of asking before this: window.confirm for
   deleting a report and for clearing the browser, and a hand-built
   backdrop for withdrawing an order. The native one cannot say what will
   happen, cannot carry a reason, cannot be styled, and blocks the tab
   while it is open; the hand-built one had no focus trap, no Escape, and
   did not put focus back where it found it.

   What a controlled record needs from this control:

   - the consequence stated in the dialog, not in the button label;
   - a reason, when the action is one an auditor would ask about;
   - the dangerous button never focused first, so Enter does not fire it;
   - Escape and the backdrop to mean "no";
   - focus returned to whatever opened it.

   `reason` turns the field on. `require` makes it mandatory, which is
   the default when a reason is asked for at all — an unexplained void is
   a hole in the record, not a shorter form. */
export default function ConfirmDialog({
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  reason = false,
  reasonLabel = 'Reason',
  reasonHint,
  require: required = true,
  confirmWord,
  onConfirm,
  onCancel,
}) {
  const [note, setNote] = useState('')
  const [word, setWord] = useState('')
  const [touched, setTouched] = useState(false)
  const box = useRef(null)
  const first = useRef(null)
  const opener = useRef(null)
  const titleId = useId()
  const bodyId = useId()

  // Where focus came from, so it can go back there when this closes.
  useEffect(() => {
    opener.current = document.activeElement
    first.current?.focus()
    return () => {
      const back = opener.current
      if (back && document.contains(back)) back.focus()
    }
  }, [])

  /* Escape closes, and Tab cannot leave. A dialog a screen reader can
     walk out of while the page behind it is inert is worse than no
     dialog. */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancel?.(); return }
      if (e.key !== 'Tab') return
      const focusable = box.current?.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')
      if (!focusable?.length) return
      const list = [...focusable]
      const edge = e.shiftKey ? list[0] : list[list.length - 1]
      if (document.activeElement === edge) {
        e.preventDefault()
        ;(e.shiftKey ? list[list.length - 1] : list[0]).focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onCancel])

  const noteMissing = reason && required && !note.trim()
  const wordMissing = confirmWord && word.trim().toUpperCase() !== confirmWord.toUpperCase()
  const blocked = noteMissing || wordMissing

  /* The confirm button is never disabled.

     It was aria-disabled while the reason was empty, which reads as
     "unavailable" to a screen reader and to anything driving the page —
     so the one control that would explain what is missing is the one
     nobody is invited to press. It stays live: pressing it with the
     reason empty marks the field, says why, and puts the cursor in it. */
  const go = () => {
    setTouched(true)
    if (blocked) {
      const field = box.current?.querySelector('[aria-invalid="true"], textarea, input')
      field?.focus()
      return
    }
    onConfirm?.(note.trim())
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel?.() }}>
      <div className="modal confirm-modal" ref={box} role="dialog" aria-modal="true"
        aria-labelledby={titleId} aria-describedby={bodyId}
        onMouseDown={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h3 id={titleId}>{title}</h3>
        <div className="confirm-body" id={bodyId}>{children}</div>

        {reason && (
          <label className="confirm-field">
            <span>{reasonLabel}{required ? '' : ' (optional)'}</span>
            <textarea rows={3} value={note} ref={first}
              onChange={(e) => setNote(e.target.value)}
              aria-invalid={touched && noteMissing ? 'true' : undefined}
              aria-describedby={`${bodyId}-hint`} />
            <small id={`${bodyId}-hint`} className={touched && noteMissing ? 'is-bad' : ''}>
              {touched && noteMissing
                ? 'This one is kept on the record, so it cannot be left empty.'
                : reasonHint || 'Kept on the record with your name and the time.'}
            </small>
          </label>
        )}

        {confirmWord && (
          <label className="confirm-field">
            <span>Type {confirmWord} to confirm</span>
            <input value={word} ref={reason ? undefined : first}
              onChange={(e) => setWord(e.target.value)}
              autoComplete="off" spellCheck="false"
              aria-invalid={touched && wordMissing ? 'true' : undefined} />
          </label>
        )}

        <div className="confirm-acts">
          <button type="button" className={`btn ${danger ? 'btn-secondary is-danger' : 'btn-primary'}`}
            onClick={go}>
            {confirmLabel}
          </button>
          {/* Cancel takes the initial focus when nothing has to be typed,
              so the first thing Enter can reach is the safe one. */}
          <button type="button" className="btn btn-ghost" onClick={() => onCancel?.()}
            ref={reason || confirmWord ? undefined : first}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
