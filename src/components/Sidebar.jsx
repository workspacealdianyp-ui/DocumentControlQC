import { useApp, navigate } from '../App.jsx'
import { ROLES } from '../lib/constants.js'
import { BrandMark } from './BrandLogo.jsx'
import { IconHome, IconList, IconFile, IconGrid, IconGear, IconMenu } from './Icons.jsx'

const NAV = [
  { id: 'home', label: 'Home', to: '/', icon: IconHome },
  { id: 'jobs', label: 'Jobs', to: '/jobs', icon: IconList },
  { id: 'reports', label: 'Reports', to: '/reports', icon: IconFile },
  { id: 'monitor', label: 'Monitor', to: '/monitor', icon: IconGrid },
]

export default function Sidebar({ page, onToggle }) {
  const { role, session } = useApp()
  const initials = session.name.split(' ').map((w) => w[0]).slice(0, 2).join('')

  return (
    <nav className="sidebar" aria-label="Primary">
      {/* top: clicking the brand icon hides/shows the sidebar */}
      <div className="sidebar-top">
        <button className="sidebar-toggle" onClick={onToggle} aria-label="Hide or show sidebar" title="Hide / show menu">
          <span className="sidebar-logo"><BrandMark size={19} color="#fff" /></span>
          <span className="brand-word">Quality Control</span>
          <span className="sidebar-toggle-ico"><IconMenu size={16} /></span>
        </button>
      </div>

      {/* main navigation list */}
      <ul>
        {NAV.map((n) => {
          const active = page === n.id || (n.id === 'jobs' && (page === 'job' || page === 'form'))
          return (
            <li key={n.id}>
              <button className={`nav-item${active ? ' active' : ''}`} onClick={() => navigate(n.to)}
                aria-current={active ? 'page' : undefined} title={n.label}>
                <span className="nav-ico"><n.icon size={18} /></span>
                <span className="nav-label">{n.label}</span>
              </button>
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
        <div className="sidebar-role" title={ROLES[session.role].label}>
          <span className="nav-ico"><RoleDot /></span>
          <span className="nav-label">{ROLES[session.role].label}</span>
        </div>

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

function RoleDot() {
  return <span className="role-dot" aria-hidden="true" />
}
