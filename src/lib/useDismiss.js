import { useEffect, useRef } from 'react'

/* Escape, and focus that starts inside the dialog and comes back out.

   ConfirmDialog has done this since it replaced window.confirm. The two
   pickers built by hand — Generate MDR and the NDE method choice — did
   not: Escape did nothing, focus stayed on the page behind, and neither
   carried aria-modal, so a screen reader could walk straight out of an
   open dialog into the page it was covering. Both had a Cancel button,
   so nobody was trapped; they were simply the only two overlays in the
   app that a keyboard could not dismiss the way every other one can.

   Returns a ref for the dialog box. Spread `dialogProps` onto it to get
   the role and aria-modal that make it a dialog to a screen reader as
   well as to the eye. */
export function useDismiss(onClose) {
  const box = useRef(null)
  const opener = useRef(null)

  useEffect(() => {
    opener.current = document.activeElement
    /* The first thing worth reaching, not the first thing in the DOM:
       an autofocused close button is a dialog that offers to shut
       itself before saying what it is for. */
    const first = box.current?.querySelector(
      'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])')
    first?.focus()
    return () => {
      const back = opener.current
      if (back && document.contains(back)) back.focus()
    }
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose?.(); return }
      if (e.key !== 'Tab') return
      const list = [...(box.current?.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])') || [])]
      if (!list.length) return
      const edge = e.shiftKey ? list[0] : list[list.length - 1]
      if (document.activeElement === edge) {
        e.preventDefault()
        ;(e.shiftKey ? list[list.length - 1] : list[0]).focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return { box, dialogProps: { role: 'dialog', 'aria-modal': 'true' } }
}
