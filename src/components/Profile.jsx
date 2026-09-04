import { useEffect, useMemo, useState } from 'react'
import { COMPANY } from '../lib/company.js'
import { useApp, navigate } from '../App.jsx'
import { FORM_SCHEMAS } from '../data/formSchemas.js'
import { getReports, syncReports } from '../lib/store.js'
import { ncrReports, fmtDate, fmtDateTime } from '../lib/status.js'
import { storageUsage, fmtBytes } from '../lib/storage.js'
import { getThemePref, resolveTheme, setThemePref, watchSystemTheme } from '../lib/theme.js'
import {
  IconCloudUp, IconCloudOff, IconGear, IconLogout, IconAlertCircle,
  IconCheck, IconClose, IconDatabase, IconFile, IconList, IconBack,
} from './Icons.jsx'

/* Module scope, not the render body: a component declared inside a render
   is a new component type every time, so React throws away the old subtree
   and mounts a fresh one on each keystroke or tick. */
const SyncRow = ({ r, isOffline }) => (
  <div className="sync-row">
    <span className={`sync-ico ${isOffline ? 'off' : 'up'}`}>
      {isOffline ? <IconCloudOff size={15} /> : <IconCloudUp size={15} />}
    </span>
    <span className="act-main">
      <strong>{r.reportId}</strong>
      <small>{FORM_SCHEMAS[r.formKey]?.title} · Job {r.jobNo} · {r.status}</small>
    </span>
    <span className="act-time">{isOffline ? 'offline' : fmtDateTime(r.syncedAt)}</span>
  </div>
)

// A measured figure. No box around it: at this density hairlines and
// space separate the numbers better than eight more card borders would.
const Figure = ({ value, label, note }) => {
  // A date or an "n/a" set at the size a count wants is a headline made
  // of a non-answer, so words step down to reading size.
  const numeric = /^[\d.,]+%?$/.test(String(value))
  return (
    <div className={`pf-fig${numeric ? '' : ' is-words'}`}>
      <strong>{value}</strong>
      <span>{label}</span>
      {note && <small>{note}</small>}
    </div>
  )
}

// What this role may do, answered rather than implied. Every screen in
// the app enforces these three flags and none of them ever said so.
const Grant = ({ on, title, body }) => (
  <div className={`pf-grant${on ? ' is-on' : ''}`}>
    <span className="pf-grant-mark" aria-hidden="true">
      {on ? <IconCheck size={13} /> : <IconClose size={13} />}
    </span>
    <span className="pf-grant-txt">
      <strong>{title}</strong>
      <small>{body}</small>
    </span>
    <span className="pf-grant-state">{on ? 'Allowed' : 'Not allowed'}</span>
  </div>
)

// A heading that says what the section is for, in place of the uppercase
// micro-label the rest of the app uses. This page has seven sections and
// seven identical labels would be a rhythm, not information.
const Head = ({ title, sub, aside }) => (
  <div className="pf-head">
    <div>
      <h3>{title}</h3>
      {sub && <p>{sub}</p>}
    </div>
    {aside}
  </div>
)

export default function Profile() {
  const { session, role, jobs, tick, refresh, notify, logout } = useApp()

  const all = useMemo(() => getReports(), [tick])
  const mine = useMemo(() => all.filter((r) => r.inspector === session.name), [all, session.name])
  const findings = useMemo(() => ncrReports().filter((r) => r.inspector === session.name), [tick, session.name])
  const offline = useMemo(() => all.filter((r) => !r.synced), [all])
  const uploaded = useMemo(() => all.filter((r) => r.synced), [all])
  const used = useMemo(() => storageUsage(), [tick])
  // The five most recent uploads stand for the rest; the register holds them all.
  const recentUploads = useMemo(
    () => uploaded.slice().sort((a, b) => (b.syncedAt || '').localeCompare(a.syncedAt || '')).slice(0, 5),
    [uploaded]
  )

  /* Everything below is counted from the records in this browser. None of
     it is illustrative: an inspection app that invents its own figures is
     the last place a number should be decorative. */
  const standing = useMemo(() => {
    const approved = mine.filter((r) => r.status === 'approved').length
    const submitted = mine.filter((r) => r.status === 'submitted').length
    const drafts = mine.filter((r) => r.status === 'draft').length
    const filed = approved + submitted
    const jobsTouched = new Set(mine.map((r) => r.jobNo)).size
    const last = mine.reduce((a, r) => ((r.updatedAt || '') > a ? r.updatedAt : a), '')
    return {
      approved, submitted, drafts, filed, jobsTouched, last,
      // Of everything sent for approval, how much came back approved.
      passRate: filed ? Math.round((approved / filed) * 100) : null,
    }
  }, [mine])

  const initials = session.name.split(' ').map((w) => w[0]).slice(0, 2).join('')

  // The rail carries this on a desktop, and there is no rail on a phone.
  const [themePref, setPref] = useState(getThemePref)
  const [mode, setMode] = useState(() => resolveTheme())
  useEffect(() => watchSystemTheme(setMode), [])
  const chooseTheme = (pref) => { setPref(pref); setMode(setThemePref(pref)) }

  const syncAll = () => {
    if (!offline.length) return
    syncReports(offline.map((r) => r.id))
    refresh()
    notify(`${offline.length} report${offline.length === 1 ? '' : 's'} uploaded`)
  }

  return (
    <div className="page pf">
      {/* ── who ──────────────────────────────────────────────────
          This is the page's header as well as its identity card, so the
          way back lives on it and there is no second band above.

          The surface is drawn and animated in CSS: brushed steel with
          two sheens drifting across it at different rates and a slow
          fall of light down the face. It moves because a plate under a
          shop light does. Nothing written on it moves. */}
      <section className="pf-banner">
        <div className="pf-metal" aria-hidden="true">
          <span className="pf-sheen-a" />
          <span className="pf-sheen-b" />
          <span className="pf-fall" />
          <span className="pf-grain" />
        </div>

        <button className="pf-back" onClick={() => navigate('/')}
          aria-label="Back to dashboard" title="Back to dashboard">
          <IconBack size={16} />
        </button>

        <div className="pf-banner-in">
          <span className="pf-plate">{initials}</span>
          <div className="pf-who">
            <h2>{session.name}</h2>
            <p className="pf-who-role">{role.label}</p>
            <p className="pf-who-co">{COMPANY.name} · {COMPANY.department}</p>
          </div>
          <dl className="pf-engraved">
            <div><dt>Signed in as</dt><dd>{session.role}</dd></div>
            <div><dt>Reports filed</dt><dd>{standing.filed}</dd></div>
            <div><dt>Records held</dt><dd>{fmtBytes(used.bytes)}</dd></div>
          </dl>
        </div>
      </section>

      {/* ── standing ── */}
      <Head title="Your record"
        sub={mine.length ? 'Counted from the reports filed under your name in this browser.' : 'Nothing filed under your name yet.'} />
      <div className="pf-figs">
        <Figure value={mine.length} label="Documents" note={`${standing.drafts} still in draft`} />
        <Figure value={standing.approved} label="Approved" note={`${standing.submitted} awaiting approval`} />
        <Figure value={standing.passRate === null ? 'n/a' : `${standing.passRate}%`} label="Approved on review"
          note={standing.filed ? `of ${standing.filed} sent` : 'nothing sent yet'} />
        <Figure value={findings.length} label="Findings raised" note="non-conformances you recorded" />
        <Figure value={standing.jobsTouched} label="Jobs worked" note={`of ${jobs.length} in the register`} />
        <Figure value={standing.last ? fmtDate(standing.last) : 'None yet'} label="Last filed"
          note={standing.last ? 'most recent edit' : 'nothing filed on this device'} />
      </div>

      {/* ── permissions ── */}
      <Head title="What this role can do"
        sub="Every screen enforces these three. They decide what you see and what stays read-only." />
      <div className="pf-grants">
        <Grant on={role.canEdit} title="Fill and submit reports"
          body="Open an inspection form, record readings, sign it and send it for approval." />
        <Grant on={role.canOverride} title="Approve and reopen"
          body="Approve a submitted report, or reopen one that has already been signed." />
        <Grant on={role.canManage} title="Raise job orders and settings"
          body="Publish a purchase order, manage the instrument register and clear stored data." />
      </div>

      {/* ── where the data is ── */}
      <Head title="Where this work is kept"
        sub="There is no server behind this build. Every report, photo and signature is in this browser." />
      <div className="pf-store">
        <div className="pf-meter">
          <div className="pf-meter-top">
            <span><IconDatabase size={14} /> Local storage</span>
            <strong>{used.pct}%</strong>
          </div>
          <div className="pf-meter-bar" role="img" aria-label={`${used.pct}% of local storage used`}>
            <span style={{ width: `${Math.max(1, Math.min(100, used.pct))}%` }} />
          </div>
          <small>{fmtBytes(used.bytes)} of {fmtBytes(used.budget)} used</small>
        </div>
        <dl className="pf-store-facts">
          <div><dt><IconFile size={13} /> Reports</dt><dd>{all.length}</dd></div>
          <div><dt><IconList size={13} /> Jobs</dt><dd>{jobs.length}</dd></div>
          <div><dt><IconCloudOff size={13} /> Not uploaded</dt><dd>{offline.length}</dd></div>
        </dl>
      </div>

      {/* ── sync ── */}
      <Head title="Upload status"
        sub={offline.length
          ? `${offline.length} report${offline.length === 1 ? '' : 's'} exist only on this device.`
          : 'Everything on this device has been uploaded.'}
        aside={
          <button className="btn btn-secondary btn-sm" onClick={syncAll} disabled={!offline.length}>
            <IconCloudUp size={14} /> Upload {offline.length ? `(${offline.length})` : 'all'}
          </button>
        } />
      {/* Everything pending is listed, because each row is a thing still
          to do. The uploaded side is settled, so it shows its most recent
          few and points at the register for the rest. */}
      <div className="card table-card activity-list">
        {all.length === 0 ? (
          <div className="empty-state">
            <p><strong>No reports on this device.</strong></p>
            <p>Reports you fill in appear here with their upload state.</p>
          </div>
        ) : (
          <>
            {offline.length > 0 && <div className="sync-group">Stored offline, pending upload</div>}
            {offline.map((r) => <SyncRow key={r.id} r={r} isOffline />)}
            {uploaded.length > 0 && <div className="sync-group up">Uploaded</div>}
            {recentUploads.map((r) => <SyncRow key={r.id} r={r} isOffline={false} />)}
            {uploaded.length > recentUploads.length && (
              <div className="pf-more">
                <span>{uploaded.length - recentUploads.length} more uploaded earlier</span>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/reports')}>
                  Open the report register
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── appearance ── */}
      <Head title="Appearance"
        sub={themePref === 'system' ? 'Following this device.' : 'Chosen for this browser, and remembered.'}
        aside={
          <div className="set-seg" role="group" aria-label="Appearance">
            {[['light', 'Light'], ['dark', 'Dark'], ['system', 'Auto']].map(([v, label]) => (
              <button key={v} className={themePref === v ? 'on' : ''} aria-pressed={themePref === v}
                onClick={() => chooseTheme(v)}>{label}</button>
            ))}
          </div>
        } />

      <div className="pf-actions">
        {role.canManage && (
          <button className="btn btn-secondary" onClick={() => navigate('/settings')}>
            <IconGear size={15} /> Settings and instrument register
          </button>
        )}
        <button className="btn btn-secondary" onClick={() => navigate('/help')}>
          <IconAlertCircle size={15} /> Help and support
        </button>
        <button className="btn btn-secondary pf-signout" onClick={logout}>
          <IconLogout size={15} /> Sign out
        </button>
      </div>
    </div>
  )
}
