import { useEffect, useMemo, useState, createContext, useContext } from 'react'
import joblist from './data/joblist.json'
import { ROLES } from './lib/constants.js'
import { getSession, setSession, clearSession } from './lib/store.js'
import Login from './components/Login.jsx'
import Sidebar from './components/Sidebar.jsx'
import BottomNav from './components/BottomNav.jsx'
import FloatingActions from './components/FloatingActions.jsx'
import Home from './components/Home.jsx'
import Dashboard from './components/Dashboard.jsx'
import JobsPage from './components/JobsPage.jsx'
import JobDetail from './components/JobDetail.jsx'
import FormView from './components/FormView.jsx'
import Reports from './components/Reports.jsx'
import Settings from './components/Settings.jsx'
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
  if (parts[0] === 'jobs') return { page: 'jobs', query }
  if (parts[0] === 'reports') return { page: 'reports', query }
  if (parts[0] === 'settings') return { page: 'settings', query }
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
  const [tick, setTick] = useState(0) // bump to recompute statuses after store writes
  const [toast, setToast] = useState(null)
  const [sideMin, setSideMin] = useState(() => localStorage.getItem('qc.sideMin') === '1')

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

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(t)
  }, [toast])

  const jobs = joblist.jobs
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
        <Sidebar page={route.page} onToggle={toggleSidebar} collapsed={sideMin} />
        <div className="main">
          <FloatingActions route={route} />
          <main className="content" key={route.page + (route.jobNo || '') + (route.formKey || '')}>
            {route.page === 'home' && <Home />}
            {route.page === 'monitor' && <Dashboard />}
            {route.page === 'jobs' && <JobsPage kat={route.query.kat} />}
            {route.page === 'job' && <JobDetail job={job} />}
            {route.page === 'form' && <FormView job={job} formKey={route.formKey} query={route.query} />}
            {route.page === 'reports' && <Reports query={route.query} />}
            {route.page === 'settings' && <Settings section={route.query.s} />}
            {route.page === 'profile' && <Profile />}
          </main>
        </div>
        <BottomNav page={route.page} />
        {toast && <div className={`toast toast-${toast.kind}`} role="alert">{toast.msg}</div>}
      </div>
    </AppContext.Provider>
  )
}
