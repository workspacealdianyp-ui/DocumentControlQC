import { useState } from 'react'
import { useApp, navigate } from '../App.jsx'
import { IconBoltz, IconHome, IconList, IconFile, IconGrid, IconGear, IconPanel, IconChevronD } from './Icons.jsx'

// Sub-items map to the `kategori` values that actually exist in the job
// list, so each one filters to a real set rather than a made-up label.
const JOB_CATEGORIES = [
  { label: 'Support Equipment', kat: 'SUPEQ' },
  { label: 'Trailer', kat: 'TRAILER' },
  { label: 'Non Trailer', kat: 'NON TRAILER' },
]

const NAV = [
  { id: 'home', label: 'Home', to: '/', icon: IconHome },
  { id: 'jobs', label: 'Jobs', to: '/jobs', icon: IconList, sub: JOB_CATEGORIES },
  { id: 'reports', label: 'Reports', to: '/reports', icon: IconFile },
  { id: 'monitor', label: 'Monitor', to: '/monitor', icon: IconGrid },
]

export default function Sidebar({ page, onToggle, collapsed }) {
  const { role, session } = useApp()
  const initials = session.name.split(' ').map((w) => w[0]).slice(0, 2).join('')
  const activeKat = new URLSearchParams(window.location.hash.split('?')[1] || '').get('kat')
  // Open the group when you are already inside it; otherwise remember
  // whatever the user last chose.
  const [openGroup, setOpenGroup] = useState(page === 'jobs' || page === 'job' || page === 'form')

  return (
    <nav className="sidebar" aria-label="Primary">
      {/* top: clicking the brand icon hides/shows the sidebar */}
      <div className="sidebar-top">
        <button className="sidebar-toggle" onClick={onToggle} aria-label="Hide or show sidebar" title="Hide / show menu">
          <span className="sidebar-logo"><IconBoltz size={17} /></span>
          <span className="brand-word">QC Boltz</span>
          <span className="sidebar-toggle-ico"><IconPanel size={16} /></span>
        </button>
      </div>

      {/* main navigation list */}
      <ul>
        {NAV.map((n) => {
          const active = page === n.id || (n.id === 'jobs' && (page === 'job' || page === 'form'))
          return (
            <li key={n.id}>
              {/* Two controls side by side, not one inside the other: go
                  to the section, or open its sub-items. The caret used to
                  be a role=button span nested in the nav button, which is
                  invalid and made the two hit areas fight. */}
              <div className={`nav-row${active ? ' active' : ''}`}>
                <button className={`nav-item${active ? ' active' : ''}`}
                  onClick={() => { navigate(n.to); if (n.sub) setOpenGroup(true) }}
                  aria-current={active ? 'page' : undefined} title={n.label}>
                  <span className="nav-ico"><n.icon size={18} /></span>
                  <span className="nav-label">{n.label}</span>
                </button>
                {n.sub && !collapsed && (
                  <button type="button"
                    className={`nav-caret${openGroup ? ' open' : ''}`}
                    aria-label={openGroup ? `Collapse ${n.label}` : `Expand ${n.label}`}
                    aria-expanded={openGroup}
                    onClick={() => setOpenGroup((v) => !v)}
                  ><IconChevronD size={13} /></button>
                )}
              </div>
              {n.sub && !collapsed && openGroup && (
                <ul className="nav-sub">
                  {n.sub.map((sItem) => {
                    const on = active && activeKat === sItem.kat
                    return (
                      <li key={sItem.kat}>
                        <button className={`nav-subitem${on ? ' active' : ''}`}
                          aria-current={on ? 'page' : undefined}
                          onClick={() => navigate(`/jobs?kat=${encodeURIComponent(sItem.kat)}`)}>
                          {sItem.label}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </li>
          )
        })}
      </ul>

      {/* footer group: settings + role, right above the profile */}
      <div className="sidebar-foot">
        {role.canManage && (
          <button className={`nav-item${page === 'settings' ? ' active' : ''}`} onClick={() => navigate('/settings')} title="Settings">
            <span className="nav-ico"><IconGear size={18} /></span>
            <span className="nav-label">Settings</span>
          </button>
        )}
        <button className="sidebar-profile" onClick={() => navigate('/profile')} title={session.name}>
          <span className="sidebar-avatar">{initials}</span>
          <span className="sidebar-profile-text">
            <strong>{session.name}</strong>
            <small>View profile</small>
          </span>
        </button>
      </div>
    </nav>
  )
}
