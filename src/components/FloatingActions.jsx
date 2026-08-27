import { useState, useEffect, useMemo } from 'react'
import { useApp, navigate } from '../App.jsx'
import { getReports } from '../lib/store.js'
import { buildContext, jobProgress } from '../lib/status.js'
import { IconBell, IconAlert, IconApprove, IconPen } from './Icons.jsx'

// Floating notification button (top-right). Search & profile live in the sidebar.
export default function FloatingActions({ route }) {
  const { jobs, session, role, tick } = useApp()
  const [notifOpen, setNotifOpen] = useState(false)

  useEffect(() => { setNotifOpen(false) }, [route.page, route.jobNo, route.formKey])

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

  return (
    <>
      <div className="float-actions">
        <button className="icon-btn" onClick={() => setNotifOpen(true)} aria-label="Notifications">
          <IconBell size={18} />
          {notifs.length > 0 && <span className="float-badge">{notifs.length}</span>}
        </button>
      </div>

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
