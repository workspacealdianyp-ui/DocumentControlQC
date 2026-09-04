import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp, navigate } from '../App.jsx'
import { FORM_SCHEMAS } from '../data/formSchemas.js'
import { getReports } from '../lib/store.js'
import { buildContext, jobProgress, fmtDate } from '../lib/status.js'
import { IS_MAC } from '../lib/keys.js'
import {
  IconSearch, IconBell, IconAlert, IconApprove, IconPen, IconMenu,
  IconList, IconFile, IconGrid, IconPlus, IconGear, IconClose,
} from './Icons.jsx'

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

  /* ── the palette ──────────────────────────────────────────────
     Empty, it offers what you were last working on and the handful of
     things people come here to start. Typing searches the register and
     the documents together, because "1000200002" is as likely to be a
     report you filed as a job you are looking for. */
  const inputRef = useRef(null)
  const [at, setAt] = useState(0)
  useEffect(() => { if (searchOpen) { setQ(''); setAt(0) } }, [searchOpen])

  const ql = q.trim().toLowerCase()

  const groups = useMemo(() => {
    if (!searchOpen) return []
    const reps = getReports()
    if (ql.length >= 2) {
      const jobHits = jobs
        .filter((j) => `${j.jobNo} ${j.wbsNo} ${j.arasSN} ${j.customerName} ${j.productDesc}`.toLowerCase().includes(ql))
        .slice(0, 6)
        .map((j) => ({
          key: 'j' + j.jobNo, icon: IconList, title: j.jobNo,
          sub: `${j.productDesc} · ${j.customerName}`, hint: 'Job',
          to: `/job/${j.jobNo}`,
        }))
      const repHits = reps
        .filter((r) => `${r.reportId} ${r.jobNo} ${r.deliverable} ${r.inspector}`.toLowerCase().includes(ql))
        .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
        .slice(0, 6)
        .map((r) => ({
          key: 'r' + r.id, icon: IconFile, title: r.reportId,
          sub: `${FORM_SCHEMAS[r.formKey]?.title || r.formKey} · Job ${r.jobNo}`,
          hint: r.status === 'approved' ? 'Approved' : r.status === 'submitted' ? 'Submitted' : 'Draft',
          to: `/job/${r.jobNo}/form/${r.formKey}?d=${encodeURIComponent(r.deliverable)}&rid=${encodeURIComponent(r.id)}`,
        }))
      return [
        jobHits.length && { label: 'Jobs', items: jobHits },
        repHits.length && { label: 'Reports', items: repHits },
      ].filter(Boolean)
    }
    // Recent means recently worked on, which the records already know.
    const recent = reps
      .slice()
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
      .slice(0, 3)
      .map((r) => ({
        key: 'r' + r.id, icon: IconFile, title: r.reportId,
        sub: `${FORM_SCHEMAS[r.formKey]?.title || r.formKey} · ${fmtDate(r.updatedAt)}`,
        to: `/job/${r.jobNo}/form/${r.formKey}?d=${encodeURIComponent(r.deliverable)}&rid=${encodeURIComponent(r.id)}`,
      }))
    const actions = [
      role.canManage && { key: 'a1', icon: IconPlus, title: 'Raise a job order', sub: 'PO, units and the reports each one needs', to: '/jobs/new' },
      { key: 'a2', icon: IconList, title: 'Open the job register', to: '/jobs' },
      { key: 'a3', icon: IconGrid, title: 'Open the monitoring matrix', to: '/monitor' },
      role.canManage && { key: 'a4', icon: IconGear, title: 'Settings', to: '/settings' },
    ].filter(Boolean)
    return [
      recent.length && { label: 'Recent', items: recent },
      { label: 'Common actions', items: actions },
    ].filter(Boolean)
  }, [searchOpen, ql, jobs, role, tick])

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups])

  const run = (it) => { onCloseSearch(); navigate(it.to) }

  const onKeys = (e) => {
    if (e.key === 'Escape') { onCloseSearch(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setAt((i) => (flat.length ? (i + 1) % flat.length : 0)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAt((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0)) }
    else if (e.key === 'Enter' && flat[at]) { e.preventDefault(); run(flat[at]) }
  }

  // Keep the highlighted row in view when the arrows walk past the fold.
  useEffect(() => {
    document.querySelector('.cmdk-row.on')?.scrollIntoView({ block: 'nearest' })
  }, [at, searchOpen])

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

      {searchOpen && createPortal(
        <div className="cmdk" role="dialog" aria-modal="true" aria-label="Search">
          {/* The page stays visible behind the panel but out of focus, so
              you can see you have not left it. */}
          <div className="cmdk-scrim" onClick={onCloseSearch} />
          <div className="cmdk-panel">
            <div className="cmdk-field">
              <IconSearch size={16} />
              <input ref={inputRef} autoFocus value={q} spellCheck={false}
                placeholder="Search jobs, reports, customers…"
                aria-label="Search" aria-controls="cmdk-list"
                onChange={(e) => { setQ(e.target.value); setAt(0) }}
                onKeyDown={onKeys} />
              {q
                ? <button className="cmdk-clear" aria-label="Clear" onClick={() => { setQ(''); setAt(0); inputRef.current?.focus() }}><IconClose size={14} /></button>
                : <kbd className="cmdk-esc">esc</kbd>}
            </div>

            <div className="cmdk-body" id="cmdk-list" role="listbox">
              {groups.map((g) => (
                <div className="cmdk-sec" key={g.label}>
                  <span className="cmdk-sec-label">{g.label}</span>
                  {g.items.map((it) => {
                    const i = flat.indexOf(it)
                    return (
                      <button key={it.key} role="option" aria-selected={i === at}
                        className={`cmdk-row${i === at ? ' on' : ''}`}
                        onMouseEnter={() => setAt(i)}
                        onClick={() => run(it)}>
                        <span className="cmdk-ico"><it.icon size={15} /></span>
                        <span className="cmdk-text">
                          <strong>{it.title}</strong>
                          {it.sub && <small>{it.sub}</small>}
                        </span>
                        {it.hint && <span className="cmdk-hint">{it.hint}</span>}
                      </button>
                    )
                  })}
                </div>
              ))}
              {!flat.length && (
                <div className="cmdk-empty">No job, report or customer matches “{q.trim()}”.</div>
              )}
            </div>

            <div className="cmdk-foot">
              <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
              <span><kbd>↵</kbd> open</span>
              <span><kbd>esc</kbd> close</span>
            </div>
          </div>
        </div>,
        document.body
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
