import { useState } from 'react'
import { BrandMark } from './BrandLogo.jsx'
import { COMPANY } from '../lib/company.js'
import { verify, markOpen } from '../lib/lock.js'

/* The gate the device passcode actually closes. Without this the control
   in Settings would be a field that stores a number and stops nothing. */
export default function LockScreen({ onOpen }) {
  const [code, setCode] = useState('')
  const [bad, setBad] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (busy || !code) return
    setBusy(true)
    const ok = await verify(code)
    setBusy(false)
    if (!ok) { setBad(true); setCode(''); return }
    markOpen(); onOpen()
  }

  return (
    <div className="login-wrap">
      <form className="login-card lock-card" onSubmit={submit}>
        <div className="login-brand">
          <div className="login-logo"><BrandMark size={30} color="#fff" /></div>
          <h1 className="brand-wordmark">Locked</h1>
          <p>{COMPANY.name} · enter the passcode set on this device</p>
        </div>

        <label className="lock-field">
          <span>Passcode</span>
          <input type="password" inputMode="numeric" autoFocus autoComplete="off"
            value={code} aria-invalid={bad || undefined}
            onChange={(e) => { setCode(e.target.value); setBad(false) }} />
        </label>

        {bad && <p className="lock-err" role="alert">That passcode does not match. Try again.</p>}

        <button className="btn btn-primary btn-block" type="submit" disabled={!code || busy}>
          {busy ? 'Checking' : 'Unlock'}
        </button>

        <p className="lock-note">
          The passcode is held on this device only. Forgotten it? Clearing this
          site's data in the browser removes the lock, and every report stored
          here with it.
        </p>
      </form>
    </div>
  )
}
