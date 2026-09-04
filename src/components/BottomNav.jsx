import { useApp, navigate } from '../App.jsx'
import { IconHome, IconList, IconFile, IconGrid, IconUser } from './Icons.jsx'

/* Two destinations, the way home, two more.

   Home used to be the first of four equal tabs, which put the thing you
   reach for most under the far left thumb and left the bar with no
   centre. It sits in the middle now, lifted clear of the rail as its own
   object, because it is not a peer of the registers: it is the way out
   of whatever you are in.

   Profile joins the rail to make the split even. It was reachable only
   from the avatar, which is a 30px target in the opposite corner from
   the hand holding the phone. */
const LEFT = [
  { id: 'jobs', label: 'Jobs', to: '/jobs', icon: IconList },
  { id: 'reports', label: 'Reports', to: '/reports', icon: IconFile },
]
const RIGHT = [
  { id: 'monitor', label: 'Monitor', to: '/monitor', icon: IconGrid },
  { id: 'profile', label: 'Profile', to: '/profile', icon: IconUser },
]

const isOn = (page, id) =>
  page === id || (id === 'jobs' && (page === 'job' || page === 'form' || page === 'joborder'))

function Tab({ t, page }) {
  const active = isOn(page, t.id)
  return (
    <button className={`bn-tab${active ? ' active' : ''}`} onClick={() => navigate(t.to)}
      aria-current={active ? 'page' : undefined}>
      <span className="bn-ico"><t.icon size={19} /></span>
      <span className="bn-label">{t.label}</span>
    </button>
  )
}

export default function BottomNav({ page }) {
  useApp()
  const home = page === 'home'
  return (
    <nav className="bottomnav" aria-label="Primary">
      <div className="bn-rail">
        <div className="bn-side">{LEFT.map((t) => <Tab key={t.id} t={t} page={page} />)}</div>

        {/* The notch is cut from the rail rather than drawn over it, so the
            disc reads as sitting in the bar rather than on top of it. */}
        <span className="bn-notch" aria-hidden="true" />

        <div className="bn-side">{RIGHT.map((t) => <Tab key={t.id} t={t} page={page} />)}</div>
      </div>

      <button className={`bn-home${home ? ' active' : ''}`} onClick={() => navigate('/')}
        aria-current={home ? 'page' : undefined} aria-label="Dashboard">
        <IconHome size={21} />
      </button>
    </nav>
  )
}
