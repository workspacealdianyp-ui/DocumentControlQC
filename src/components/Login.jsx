import { useState } from 'react'
import { USERS, ROLES } from '../lib/constants.js'
import { useApp } from '../App.jsx'
import { BrandMark } from './BrandLogo.jsx'

const initials = (name) => name.split(' ').map((w) => w[0]).slice(0, 2).join('')

export default function Login() {
  const { login } = useApp()
  const [selected, setSelected] = useState(USERS[0])

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo brand-load"><BrandMark size={30} color="#fff" /></div>
          <h1 className="brand-wordmark">Quality Control</h1>
          <p>QC Inspection Monitor · QA/QC field forms &amp; report monitoring</p>
        </div>

        <div className="login-users" role="radiogroup" aria-label="Select user">
          {USERS.map((u) => (
            <button
              key={u.name}
              className={`login-user${selected.name === u.name ? ' active' : ''}`}
              onClick={() => setSelected(u)}
              role="radio"
              aria-checked={selected.name === u.name}
            >
              <span className="avatar">{initials(u.name)}</span>
              <span className="login-user-text">
                <strong>{u.name}</strong>
                <small>{ROLES[u.role].label}</small>
              </span>
            </button>
          ))}
        </div>

        <button className="btn btn-primary btn-block" onClick={() => login(selected)}>
          Sign in as {selected.name.split(' ')[0]}
        </button>
        <p className="login-note">Front-end demo — no authentication back-end (PRD v1 scope).</p>
      </div>
    </div>
  )
}
