import { useEffect, useMemo, useState, createContext, useContext } from 'react'
import joblist from './data/joblist.json'
import { allJobs } from './lib/jobOrders.js'
import { ROLES } from './lib/constants.js'
import { getSession, setSession, clearSession } from './lib/store.js'
import Login from './components/Login.jsx'
import LockScreen from './components/LockScreen.jsx'
import { hasLock, isOpen } from './lib/lock.js'
import Sidebar from './components/Sidebar.jsx'
import BottomNav from './components/BottomNav.jsx'
import Topbar from './components/Topbar.jsx'
import Help from './components/Help.jsx'
import { applyTheme, watchSystemTheme } from './lib/theme.js'
import { isPaletteChord } from './lib/keys.js'
import Home from './components/Home.jsx'
import Dashboard from './components/Dashboard.jsx'
import JobsPage from './components/JobsPage.jsx'
import JobDetail from './components/JobDetail.jsx'
import FormView from './components/FormView.jsx'
import Reports from './components/Reports.jsx'
import Settings from './components/Settings.jsx'
import NewJobOrder from './components/NewJobOrder.jsx'
import Profile from './components/Profile.jsx'

export const AppContext = createContext(null)
export const useApp = () => useContext(AppContext)

function parseHash() {
  const h = window.location.hash.replace(/^#\/?/, '')
  const [path, qs] = h.split('?')
  const parts = path.split('/').filter(Boolean)
  const query = Object.fromEntries(new URLSearchParams(qs || ''))
  if (parts.length === 0) return { page: 'home', query }
  if (parts[0] === 'monitor') return { page: 'monitor', query }
  if (parts[0] === 'jobs') {
    if (parts[1] === 'new') return { page: 'joborder', query }
    return { page: 'jobs', query }
  }
  if (parts[0] === 'reports') return { page: 'reports', query }
  if (parts[0] === 'settings') return { page: 'settings', query }
  if (parts[0] === 'help') return { page: 'help', query }
  if (parts[0] === 'profile') return { page: 'profile', query }
  if (parts[0] === 'job' && parts[1]) {
    if (parts[2] === 'form' && parts[3]) return { page: 'form', jobNo: parts[1], formKey: parts[3], query }
    return { page: 'job', jobNo: parts[1], query }
  }
  return { page: 'home', query }
}

export const navigate = (to) => { window.location.hash = to }

// Decorative fixed layer: white canvas, faint grid, soft color blobs.
// Sits behind everything so glassmorphism cards reveal it through their blur.
function AppBackground() {
  return (
    <div className="app-bg" aria-hidden="true">
      <div className="aurora aurora-1" />
      <div className="aurora aurora-2" />
      <div className="aurora aurora-3" />
      <div className="aurora aurora-4" />
    </div>
  )
}

export default function App() {
  const [route, setRoute] = useState(parseHash())
  const [session, setSess] = useState(getSession())
  const [locked, setLocked] = useState(() => hasLock() && !isOpen())
  const [tick, setTick] = useState(0) // bump to recompute statuses after store writes
  const [toast, setToast] = useState(null)
  const [sideMin, setSideMin] = useState(() => localStorage.getItem('qc.sideMin') === '1')
  // Search is opened from two places — the rail's field and the top bar's
  // icon — so the state that owns it sits above both.
  const [searchOpen, setSearchOpen] = useState(false)

  const toggleSidebar = () => {
    setSideMin((v) => {
      localStorage.setItem('qc.sideMin', v ? '0' : '1')
      return !v
    })
  }

  useEffect(() => {
    const onHash = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // The boot script in index.html sets the theme; this keeps it applied
  // across a hot reload and follows the machine while "Auto" is chosen.
  useEffect(() => {
    applyTheme()
    return watchSystemTheme(() => {})
  }, [])

  // The rail promises ⌘K, so it has to answer — and Escape closes it.
  useEffect(() => {
    const onKey = (e) => {
      // Ctrl+K everywhere, plus the Command key on a Mac and the Windows
      // key on a PC — the browser reports both as metaKey.
      if (isPaletteChord(e)) { e.preventDefault(); setSearchOpen((v) => !v) }
      else if (e.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // A route change is a new screen; a search sheet left open over it is
  // a leftover from the last one.
  useEffect(() => { setSearchOpen(false) }, [route.page, route.jobNo, route.formKey])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(t)
  }, [toast])

  // Jobs an admin created here, then the bundled sample list. tick
  // makes a freshly published order show up without a reload.
  const jobs = useMemo(() => allJobs(), [tick])
  const jobIndex = useMemo(() => {
    const m = new Map()
    for (const j of jobs) m.set(j.jobNo, j)
    return m
  }, [jobs])

  const ctxValue = useMemo(
    () => ({
      jobs,
      jobIndex,
      meta: { customers: joblist.customers, kategoris: joblist.kategoris, types: joblist.types },
      session,
      role: session ? ROLES[session.role] : null,
      tick,
      refresh: () => setTick((t) => t + 1),
      notify: (msg, kind = 'ok') => setToast({ msg, kind }),
      login: (user) => { setSession(user); setSess(user) },
      logout: () => { clearSession(); setSess(null); navigate('/') },
    }),
    [jobs, jobIndex, session, tick]
  )

  /* The device lock sits in front of everything, session included: a
     tablet left on the bench is already signed in, which is the case the
     passcode is for. */
  if (locked) {
    return (
      <AppContext.Provider value={ctxValue}>
        <AppBackground />
        <LockScreen onOpen={() => setLocked(false)} />
      </AppContext.Provider>
    )
  }

  if (!session) {
    return (
      <AppContext.Provider value={ctxValue}>
        <AppBackground />
        <Login />
      </AppContext.Provider>
    )
  }

  const job = route.jobNo ? jobIndex.get(route.jobNo) : null

  return (
    <AppContext.Provider value={ctxValue}>
      <AppBackground />
      <div className={`shell${sideMin ? ' side-min' : ''}`}>
        <Sidebar page={route.page} onToggle={toggleSidebar} collapsed={sideMin}
          onSearch={() => setSearchOpen(true)} />
        <div className="main">
          <Topbar route={route} job={job}
            searchOpen={searchOpen} onOpenSearch={() => setSearchOpen(true)}
            onCloseSearch={() => setSearchOpen(false)} />
          <main className="content" key={route.page + (route.jobNo || '') + (route.formKey || '')}>
            {route.page === 'home' && <Home />}
            {route.page === 'monitor' && <Dashboard />}
            {route.page === 'jobs' && <JobsPage kat={route.query.kat} />}
            {route.page === 'joborder' && <NewJobOrder />}
            {route.page === 'job' && <JobDetail job={job} />}
            {route.page === 'form' && <FormView job={job} formKey={route.formKey} query={route.query} />}
            {route.page === 'reports' && <Reports query={route.query} />}
            {route.page === 'settings' && <Settings section={route.query.s} />}
            {route.page === 'help' && <Help />}
            {route.page === 'profile' && <Profile />}
          </main>
        </div>
        <BottomNav page={route.page} />
        {toast && <div className={`toast toast-${toast.kind}`} role="alert">{toast.msg}</div>}
      </div>
    </AppContext.Provider>
  )
}
