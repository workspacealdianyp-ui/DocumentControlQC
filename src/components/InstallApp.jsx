import { useEffect, useState } from 'react'
import { IconPlus, IconCheck } from './Icons.jsx'

/* Installing to the home screen, offered inside the app.

   Buried in a browser menu — three dots, then "Add to Home screen" — this
   is a thing most people never find. Chrome hands us the prompt it would
   have shown, so the app can ask at a moment that makes sense.

   iOS gives no such event. Safari can only be told what to do, so on
   iPhone this becomes the instruction rather than a button that would do
   nothing. Saying which two taps beats saying "install this app". */
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const installed = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true

export default function InstallApp() {
  const [prompt, setPrompt] = useState(null)
  const [done, setDone] = useState(installed)

  useEffect(() => {
    const grab = (e) => { e.preventDefault(); setPrompt(e) }
    const ok = () => { setDone(true); setPrompt(null) }
    window.addEventListener('beforeinstallprompt', grab)
    window.addEventListener('appinstalled', ok)
    return () => {
      window.removeEventListener('beforeinstallprompt', grab)
      window.removeEventListener('appinstalled', ok)
    }
  }, [])

  if (done) {
    return (
      <div className="install-card is-done">
        <span className="install-ico"><IconCheck size={15} /></span>
        <span className="install-text">
          <strong>Running as an installed app</strong>
          <small>Full screen, its own icon, and it opens without a signal.</small>
        </span>
      </div>
    )
  }

  // Safari will not offer a prompt, so it gets the two taps instead.
  if (isIOS()) {
    return (
      <div className="install-card">
        <span className="install-ico"><IconPlus size={15} /></span>
        <span className="install-text">
          <strong>Add to your home screen</strong>
          <small>Share, then <b>Add to Home Screen</b>. It opens full screen and works without a signal.</small>
        </span>
      </div>
    )
  }

  if (!prompt) return null

  return (
    <div className="install-card">
      <span className="install-ico"><IconPlus size={15} /></span>
      <span className="install-text">
        <strong>Install on this device</strong>
        <small>Full screen, its own icon, and it opens without a signal.</small>
      </span>
      <button className="btn btn-primary btn-sm" onClick={async () => {
        prompt.prompt()
        const { outcome } = await prompt.userChoice
        if (outcome === 'accepted') setDone(true)
        setPrompt(null)
      }}>Install</button>
    </div>
  )
}
