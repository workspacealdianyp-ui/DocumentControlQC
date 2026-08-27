import { useApp, navigate } from '../App.jsx'
import { IconHome, IconList, IconFile, IconGrid } from './Icons.jsx'

// Profile is intentionally NOT here — it opens from the avatar (per Improve §5.5)
const TABS = [
  { id: 'home', label: 'Home', to: '/', icon: IconHome },
  { id: 'jobs', label: 'Jobs', to: '/jobs', icon: IconList },
  { id: 'reports', label: 'Reports', to: '/reports', icon: IconFile },
  { id: 'monitor', label: 'Monitor', to: '/monitor', icon: IconGrid },
]

export default function BottomNav({ page }) {
  useApp()
  return (
    <nav className="bottomnav" aria-label="Primary">
      {TABS.map((t) => {
        const active = page === t.id || (t.id === 'jobs' && (page === 'job' || page === 'form'))
        return (
          <button key={t.id} className={active ? 'active' : ''} onClick={() => navigate(t.to)}
            aria-current={active ? 'page' : undefined}>
            <span className="bn-pill"><t.icon size={19} /></span>
            <span>{t.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
