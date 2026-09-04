import { useEffect, useState } from 'react'
import { COMPANY } from '../lib/company.js'
import { useApp, navigate } from '../App.jsx'
import { storageUsage, fmtBytes } from '../lib/storage.js'
import { getThemePref, resolveTheme, setThemePref, watchSystemTheme } from '../lib/theme.js'
import { CMD_LABEL } from '../lib/keys.js'
import {
  IconBoltz, IconHome, IconList, IconFile, IconGrid, IconGear, IconPanel,
  IconChevronD, IconSearch, IconPlus, IconDatabase, IconUser, IconAlertCircle, IconTheme,
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
  const { role, tick } = useApp()
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
    { id: 'profile', label: 'Profile', to: '/profile', icon: IconUser },
  ].filter(Boolean)

  /* Light or dark. The switch shows what is on screen right now, and
     following the machine is a third state rather than a hidden default,
     so a person can see which of the three they are in. */
  const [themePref, setPref] = useState(getThemePref)
  const [mode, setMode] = useState(() => resolveTheme())
  useEffect(() => watchSystemTheme(setMode), [])
  const chooseTheme = (pref) => { setPref(pref); setMode(setThemePref(pref)) }

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
        {/* Folded, the fold control has nowhere to sit, so the mark takes
            the job: it is the only thing left to click. Open, it is the
            way home. */}
        <button className="rail-brand" title={collapsed ? 'Show menu' : COMPANY.name}
          aria-label={collapsed ? 'Show menu' : COMPANY.name}
          onClick={() => (collapsed ? onToggle() : navigate('/'))}>
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
      <button className="rail-search" onClick={onSearch} aria-label="Search jobs and reports">
        <span className="rail-ico"><IconSearch size={16} /></span>
        <span className="rail-search-label">Search</span>
        <kbd>{CMD_LABEL}</kbd><kbd>K</kbd>
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
            <span><span className="rail-ico"><IconDatabase size={14} /></span> Local storage</span>
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

        <ul className="rail-list rail-util">
          {role.canManage && (
            <li>
              <button className={`nav-item${page === 'settings' ? ' active' : ''}`}
                onClick={() => navigate('/settings')} title="Settings"
                aria-current={page === 'settings' ? 'page' : undefined}>
                <span className="nav-ico"><IconGear size={17} /></span>
                <span className="nav-label">Settings</span>
              </button>
            </li>
          )}
          <li>
            <button className={`nav-item${page === 'help' ? ' active' : ''}`}
              onClick={() => navigate('/help')} title="Help & support"
              aria-current={page === 'help' ? 'page' : undefined}>
              <span className="nav-ico"><IconAlertCircle size={17} /></span>
              <span className="nav-label">Help &amp; support</span>
            </button>
          </li>
        </ul>

        <div className="rail-theme" role="group" aria-label="Appearance">
          {/* Folded, the track has no room and no label to explain it, so
              the glyph is the control. Open, it is also the control — one
              behaviour, two sizes. */}
          <button type="button" className="rail-theme-ico"
            aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={mode === 'dark' ? 'Dark mode' : 'Light mode'}
            onClick={() => chooseTheme(mode === 'dark' ? 'light' : 'dark')}>
            <IconTheme mode={mode} size={16} />
          </button>
          <span className="rail-theme-label">{mode === 'dark' ? 'Dark mode' : 'Light mode'}</span>
          <button type="button" role="switch" aria-checked={mode === 'dark'}
            aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className={`rail-switch${mode === 'dark' ? ' on' : ''}`}
            onClick={() => chooseTheme(mode === 'dark' ? 'light' : 'dark')}>
            <span />
          </button>
          <button type="button"
            className={`rail-theme-sys${themePref === 'system' ? ' on' : ''}`}
            aria-pressed={themePref === 'system'}
            title="Follow the system setting"
            onClick={() => chooseTheme(themePref === 'system' ? mode : 'system')}>
            Auto
          </button>
        </div>

      </div>
    </nav>
  )
}
