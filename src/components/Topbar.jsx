import { useEffect, useMemo, useState } from 'react'
import { useApp, navigate } from '../App.jsx'
import { FORM_SCHEMAS } from '../data/formSchemas.js'
import { getReports } from '../lib/store.js'
import { buildContext, jobProgress } from '../lib/status.js'
import { IconSearch, IconBell, IconAlert, IconApprove, IconPen, IconMenu } from './Icons.jsx'

/* The bar across the top of the work area: where you are on the left,
   what you can do about it on the right. It replaces the notification
   button that used to float over the page, so there is one place to
   look for the state of things rather than a control hovering over the
   content it refers to. */

const PAGE_TITLES = {
  home: ['Dashboard', ''],
  monitor: ['Monitor', 'Job × report status matrix'],
  jobs: ['Jobs', 'Job register'],
  joborder: ['New job order', 'Purchase order, units, reports'],
  reports: ['Reports', 'Documents & NCR'],
  settings: ['Settings', ''],
  help: ['Help & support', 'How this build works'],
  profile: ['Profile', 'Account & sync'],
}

export default function Topbar({ route, job, onToggleSidebar, searchOpen, onOpenSearch, onCloseSearch }) {
  const { jobs, session, role, tick } = useApp()
  const [notifOpen, setNotifOpen] = useState(false)
  const [q, setQ] = useState('')

  useEffect(() => { setNotifOpen(false) }, [route.page, route.jobNo, route.formKey])

  let [title, sub] = PAGE_TITLES[route.page] || ['', '']
  if (route.page === 'job' && job) { title = `Job ${job.jobNo}`; sub = job.customerName }
  if (route.page === 'form') { title = FORM_SCHEMAS[route.formKey]?.title || 'Form'; sub = job ? `Job ${job.jobNo}` : '' }

  const ql = q.trim().toLowerCase()
  const hits = ql.length >= 2
    ? jobs.filter((j) => `${j.jobNo} ${j.wbsNo} ${j.arasSN} ${j.customerName}`.toLowerCase().includes(ql)).slice(0, 8)
    : []

  // Notifications: overdue jobs, reports awaiting approval (admin), own drafts
  const notifs = useMemo(() => {
    const out = []
    const ctx = buildContext()
    const overdue = jobs.reduce((n, j) => n + (jobProgress(j, ctx).overdue ? 1 : 0), 0)
    if (overdue > 0) out.push({
      icon: IconAlert, cls: 'n-red',
      text: `${overdue} job${overdue === 1 ? '' : 's'} with overdue reports`,
      sub: 'PDI released but deliverables incomplete', to: '/monitor',
    })
    const reps = getReports()
    const pending = reps.filter((r) => r.status === 'submitted')
    if (role.canOverride && pending.length > 0) out.push({
      icon: IconApprove, cls: 'n-blue',
      text: `${pending.length} report${pending.length === 1 ? '' : 's'} awaiting approval`,
      sub: pending.slice(0, 2).map((r) => r.reportId).join(' · '), to: '/reports?f=submitted',
    })
    const drafts = reps.filter((r) => r.status === 'draft' && r.inspector === session.name)
    if (drafts.length > 0) out.push({
      icon: IconPen, cls: 'n-amber',
      text: `${drafts.length} draft${drafts.length === 1 ? '' : 's'} pending submission`,
      sub: drafts.slice(0, 2).map((r) => r.reportId).join(' · '), to: '/reports?f=draft',
    })
    return out
  }, [jobs, role, session.name, tick])

  const initials = session.name.split(' ').map((w) => w[0]).slice(0, 2).join('')

  return (
    <>
      <header className="topbar">
        <button className="topbar-menu" onClick={onToggleSidebar} aria-label="Toggle sidebar">
          <IconMenu size={17} />
        </button>
        <div className="topbar-title">
          <h1>{title}</h1>
          {sub && <small>{sub}</small>}
        </div>

        <div className="topbar-actions">
          {/* the rail carries the search field on desktop; on a narrow
              screen there is no rail, so the icon stands in for it */}
          <button className="tb-btn tb-search" onClick={onOpenSearch} aria-label="Search jobs">
            <IconSearch size={17} />
          </button>
          <button className="tb-btn" onClick={() => setNotifOpen((v) => !v)}
            aria-label="Notifications" aria-expanded={notifOpen}>
            <IconBell size={17} />
            {notifs.length > 0 && <span className="tb-badge">{notifs.length}</span>}
          </button>
          <button className="tb-avatar" onClick={() => navigate('/profile')} aria-label="Profile" title={session.name}>
            {initials}
          </button>
        </div>
      </header>

      {searchOpen && (
        <>
          <div className="search-sheet-backdrop" onClick={onCloseSearch} />
          <div className="search-sheet" role="dialog" aria-label="Global search">
            <div className="searchbar" style={{ marginBottom: 0 }}>
              <IconSearch size={16} />
              <input autoFocus placeholder="Job No, WBS, Serial No, Customer…"
                value={q} onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && onCloseSearch()} />
            </div>
            <div className="search-results">
              {hits.map((j) => (
                <button key={j.jobNo} onClick={() => { navigate(`/job/${j.jobNo}`); onCloseSearch(); setQ('') }}>
                  <strong>{j.jobNo}</strong>
                  <span>{j.productDesc}</span>
                  <small>{j.customerName} · {j.arasSN}</small>
                </button>
              ))}
              {ql.length >= 2 && hits.length === 0 && (
                <div className="empty-state" style={{ padding: '18px' }}>No matching jobs.</div>
              )}
            </div>
          </div>
        </>
      )}

      {notifOpen && (
        <>
          <div className="usermenu-backdrop" onClick={() => setNotifOpen(false)} />
          <div className="usermenu notif-sheet" role="dialog" aria-label="Notifications">
            <div className="um-name" style={{ marginBottom: 10 }}>Notifications</div>
            {notifs.length === 0 ? (
              <p className="page-sub" style={{ margin: 0 }}>All clear. Nothing needs attention.</p>
            ) : (
              notifs.map((n, i) => (
                <button key={i} className="notif-row" onClick={() => { navigate(n.to); setNotifOpen(false) }}>
                  <span className={`notif-ico ${n.cls}`}><n.icon size={15} /></span>
                  <span className="act-main">
                    <strong>{n.text}</strong>
                    <small>{n.sub}</small>
                  </span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </>
  )
}
