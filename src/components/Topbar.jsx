import { COMPANY } from '../lib/company.js'
import { useState, useEffect, useMemo } from 'react'
import { useApp, navigate } from '../App.jsx'
import { FORM_SCHEMAS } from '../data/formSchemas.js'
import { getReports } from '../lib/store.js'
import { buildContext, jobProgress } from '../lib/status.js'
import { IconSearch, IconBell, IconShield, IconAlert, IconApprove, IconPen, IconMenu } from './Icons.jsx'

const PAGE_TITLES = {
  monitor: ['Monitor', 'Job × report status matrix'],
  jobs: ['Jobs', 'JOBLIST register'],
  reports: ['Reports', 'Documents & NCR'],
  settings: ['Settings', 'Admin'],
  profile: ['Profile', 'Account & sync'],
}

export default function Topbar({ route, job, onToggleSidebar }) {
  const { jobs, session, role, tick } = useApp()
  const [searchOpen, setSearchOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [q, setQ] = useState('')

  useEffect(() => { setSearchOpen(false); setNotifOpen(false) }, [route.page, route.jobNo, route.formKey])

  const isHome = route.page === 'home'
  let [title, sub] = PAGE_TITLES[route.page] || ['', '']
  if (route.page === 'job' && job) { title = `Job ${job.jobNo}`; sub = job.customerName }
  if (route.page === 'form') { title = FORM_SCHEMAS[route.formKey]?.title || 'Form'; sub = job ? `Job ${job.jobNo}` : '' }

  const ql = q.trim().toLowerCase()
  const hits = ql.length >= 2
    ? jobs.filter((j) => `${j.jobNo} ${j.wbsNo} ${j.arasSN} ${j.customerName}`.toLowerCase().includes(ql)).slice(0, 8)
    : []

  // Notifications: overdue jobs, reports awaiting approval (admin), own drafts
  const notifs = useMemo(() => {
    if (!notifOpen) return []
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
  }, [notifOpen, jobs, role, session.name, tick])

  const initials = session.name.split(' ').map((w) => w[0]).slice(0, 2).join('')

  return (
    <>
      <header className="appbar">
        <button className="icon-btn menu-btn" onClick={onToggleSidebar} aria-label="Toggle sidebar">
          <IconMenu size={17} />
        </button>
        {isHome ? (
          <button className="brand-chip" onClick={() => navigate('/')} aria-label={COMPANY.name}>
            <span className="brand-logo"><IconShield size={15} /></span>
            <span className="brand-text">
              <strong>{COMPANY.name}</strong>
              <small>QC Inspection</small>
            </span>
          </button>
        ) : (
          <div className="appbar-title">
            <h1>{title}</h1>
            {sub && <small>{sub}</small>}
          </div>
        )}
        <div className="appbar-spacer" />
        <button className="icon-btn" onClick={() => setSearchOpen(true)} aria-label="Search">
          <IconSearch size={18} />
        </button>
        <button className="icon-btn notif-btn" onClick={() => setNotifOpen(true)} aria-label="Notifications">
          <IconBell size={18} />
        </button>
        <button className="avatar-btn" onClick={() => navigate('/profile')} aria-label="Profile">
          {initials}
        </button>
      </header>

      {searchOpen && (
        <>
          <div className="search-sheet-backdrop" onClick={() => setSearchOpen(false)} />
          <div className="search-sheet" role="dialog" aria-label="Global search">
            <div className="searchbar" style={{ marginBottom: 0 }}>
              <IconSearch size={16} />
              <input autoFocus placeholder="Job No, WBS, Serial No, Customer…"
                value={q} onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setSearchOpen(false)} />
            </div>
            <div className="search-results">
              {hits.map((j) => (
                <button key={j.jobNo} onClick={() => { navigate(`/job/${j.jobNo}`); setSearchOpen(false); setQ('') }}>
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
              <p className="page-sub" style={{ margin: 0 }}>All clear — nothing needs attention.</p>
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
