import { useEffect, useState } from 'react'
import { COMPANY } from '../lib/company.js'
import { useApp, navigate } from '../App.jsx'
import { storageUsage, fmtBytes } from '../lib/storage.js'
import {
  IconBoltz, IconHome, IconList, IconFile, IconGrid, IconGear, IconPanel,
  IconChevronD, IconSearch, IconPlus, IconDatabase, IconUser,
} from './Icons.jsx'

/* The rail, drawn to the supplied reference: a workspace header, a
   search field that opens on ⌘K, the destinations grouped under quiet
   labels, and — where the reference puts cloud storage — the number
   that actually governs this app, since every report, photo and
   signature lives in this browser's storage. */

// Sub-items map to the `kategori` values that actually exist in the job
// list, so each one filters to a real set rather than a made-up label.
const JOB_CATEGORIES = [
  { label: 'Support Equipment', kat: 'SUPEQ' },
  { label: 'Trailer', kat: 'TRAILER' },
  { label: 'Non Trailer', kat: 'NON TRAILER' },
]

const NAV = [
  { id: 'home', label: 'Dashboard', to: '/', icon: IconHome },
  { id: 'jobs', label: 'Jobs', to: '/jobs', icon: IconList, sub: JOB_CATEGORIES },
  { id: 'reports', label: 'Reports', to: '/reports', icon: IconFile },
  { id: 'monitor', label: 'Monitor', to: '/monitor', icon: IconGrid },
]

export default function Sidebar({ page, onToggle, collapsed, onSearch }) {
  const { role, session, tick } = useApp()
  const initials = session.name.split(' ').map((w) => w[0]).slice(0, 2).join('')
  const activeKat = new URLSearchParams(window.location.hash.split('?')[1] || '').get('kat')
  // Open the group when you are already inside it; otherwise remember
  // whatever the user last chose.
  const [openGroup, setOpenGroup] = useState(page === 'jobs' || page === 'job' || page === 'form')

  // Measured, not decorative: the fraction of this browser's storage the
  // app has actually used, re-read whenever anything is saved.
  const [used, setUsed] = useState(() => storageUsage())
  useEffect(() => { setUsed(storageUsage()) }, [tick])

  const manage = [
    role.canManage && { id: 'joborder', label: 'New job order', to: '/jobs/new', icon: IconPlus },
    role.canManage && { id: 'settings', label: 'Settings', to: '/settings', icon: IconGear },
    { id: 'profile', label: 'Profile', to: '/profile', icon: IconUser },
  ].filter(Boolean)

  const item = (n) => {
    const active = page === n.id || (n.id === 'jobs' && (page === 'job' || page === 'form'))
    return (
      <li key={n.id}>
        {/* Two controls side by side, not one inside the other: go to the
            section, or open its sub-items. */}
        <div className={`nav-row${active ? ' active' : ''}`}>
          <button className={`nav-item${active ? ' active' : ''}`}
            onClick={() => { navigate(n.to); if (n.sub) setOpenGroup(true) }}
            aria-current={active ? 'page' : undefined} title={n.label}>
            <span className="nav-ico"><n.icon size={17} /></span>
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
  }

  return (
    <nav className="sidebar" aria-label="Primary">
      {/* who you are working in, and the control that folds the rail away */}
      <div className="rail-head">
        <button className="rail-brand" onClick={() => navigate('/')} title={COMPANY.name}>
          <span className="rail-logo"><IconBoltz size={17} /></span>
          <span className="rail-brand-text">
            <strong>{COMPANY.name}</strong>
            <small>{role.label}</small>
          </span>
        </button>
        <button className="rail-fold" onClick={onToggle} aria-label="Hide or show sidebar" title="Hide / show menu">
          <IconPanel size={16} />
        </button>
      </div>

      {/* a field rather than an icon, so the shortcut has somewhere to live */}
      <button className="rail-search" onClick={onSearch} aria-label="Search jobs">
        <IconSearch size={15} />
        <span>Search</span>
        <kbd>⌘</kbd><kbd>K</kbd>
      </button>

      <div className="rail-scroll">
        <span className="rail-label">Main menu</span>
        <ul className="rail-list">{NAV.map(item)}</ul>

        <span className="rail-label">Manage</span>
        <ul className="rail-list">{manage.map(item)}</ul>
      </div>

      <div className="rail-foot">
        {/* Where the reference shows cloud storage, this shows the limit
            that actually binds: reports, photos and signatures all live in
            this browser, and there is no server behind them. */}
        <div className="rail-store">
          <div className="rail-store-head">
            <span><IconDatabase size={13} /> Local storage</span>
            <strong>{used.pct}%</strong>
          </div>
          <div className="rail-store-bar" role="img"
            aria-label={`${used.pct}% of local storage used`}>
            <span style={{ width: `${Math.min(100, used.pct)}%` }} className={used.pct >= 80 ? 'is-full' : ''} />
          </div>
          <small>{fmtBytes(used.bytes)} of {fmtBytes(used.budget)} used</small>
          {role.canManage && (
            <button className="rail-store-btn" onClick={() => navigate('/settings?s=storage')}>
              Manage storage
            </button>
          )}
        </div>

        <button className="rail-profile" onClick={() => navigate('/profile')} title={session.name}>
          <span className="rail-avatar">{initials}</span>
          <span className="rail-profile-text">
            <strong>{session.name}</strong>
            <small>View profile</small>
          </span>
        </button>
      </div>
    </nav>
  )
}
