import { useApp, navigate } from '../App.jsx'
import { IconHome, IconFile, IconGrid, IconGear, IconLock, IconAlertCircle } from './Icons.jsx'

/* Two destinations, the way home, two more.

   Home used to be the first of four equal tabs, which put the thing you
   reach for most under the far left thumb and left the bar with no
   centre. It sits in the middle now, lifted clear of the rail as its own
   object, because it is not a peer of the registers: it is the way out
   of whatever you are in.

   The three registers take three of the four slots. Profile is not one
   of them any more — it is one tap from the avatar in the top bar on
   every screen, and a tab that duplicates a control already on screen is
   a tab not spent on somewhere you cannot otherwise reach. The last slot
   goes to whichever of Settings or Help the signed-in role can use, so
   the position never moves under the thumb. */
const LEFT = [
  { id: 'jobs', label: 'Monitoring', to: '/monitoring', icon: IconGrid },
  { id: 'reports', label: 'Reports', to: '/reports', icon: IconFile },
]
const rightFor = (role) => [
  { id: 'vault', label: 'Vault', to: '/vault', icon: IconLock },
  role?.canManage
    ? { id: 'settings', label: 'Settings', to: '/settings', icon: IconGear }
    : { id: 'help', label: 'Help', to: '/help', icon: IconAlertCircle },
]

const JOB_PAGES = ['customers', 'jobs', 'job', 'form', 'joborder', 'customer', 'po']

const isOn = (page, id) => page === id || (id === 'jobs' && JOB_PAGES.includes(page))

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
  const { role } = useApp()
  const right = rightFor(role)
  const home = page === 'home'
  return (
    <nav className="bottomnav" aria-label="Primary">
      <div className="bn-rail">
        <div className="bn-side">{LEFT.map((t) => <Tab key={t.id} t={t} page={page} />)}</div>

        {/* The notch is cut from the rail rather than drawn over it, so the
            disc reads as sitting in the bar rather than on top of it. */}
        <span className="bn-notch" aria-hidden="true" />

        <div className="bn-side">{right.map((t) => <Tab key={t.id} t={t} page={page} />)}</div>
      </div>

      <button className={`bn-home${home ? ' active' : ''}`} onClick={() => navigate('/')}
        aria-current={home ? 'page' : undefined} aria-label="Dashboard">
        <IconHome size={21} />
      </button>
    </nav>
  )
}
