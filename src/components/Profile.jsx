import { COMPANY } from '../lib/company.js'
import { useMemo } from 'react'
import { useApp, navigate } from '../App.jsx'
import { FORM_SCHEMAS } from '../data/formSchemas.js'
import { getReports, syncReports } from '../lib/store.js'
import { ncrReports, fmtDateTime } from '../lib/status.js'
import { IconBack, IconCloudUp, IconCloudOff, IconGear, IconLogout } from './Icons.jsx'

export default function Profile() {
  const { session, role, tick, refresh, notify, logout } = useApp()

  const mine = useMemo(() => getReports().filter((r) => r.inspector === session.name), [tick, session.name])
  const findings = useMemo(() => ncrReports().filter((r) => r.inspector === session.name), [tick, session.name])
  const offline = useMemo(() => getReports().filter((r) => !r.synced), [tick])
  const uploaded = useMemo(() => getReports().filter((r) => r.synced), [tick])

  const initials = session.name.split(' ').map((w) => w[0]).slice(0, 2).join('')
  const approvedMine = mine.filter((r) => r.status === 'approved').length

  const syncAll = () => {
    if (!offline.length) return
    syncReports(offline.map((r) => r.id))
    refresh()
    notify(`${offline.length} report${offline.length === 1 ? '' : 's'} uploaded`)
  }

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

  return (
    <div className="page form-page">
      <button className="btn btn-ghost back-btn btn-sm" onClick={() => navigate('/')}>
        <IconBack size={14} /> Home
      </button>

      {/* Modern profile card */}
      <div className="profile-card">
        <span className="profile-avatar">{initials}</span>
        <h2>{session.name}</h2>
        <span className={`role-badge role-${session.role}`}>{role.label}</span>
        <p className="profile-co">{COMPANY.name} · {COMPANY.department}</p>
        <div className="profile-stats">
          <div><strong>{mine.length}</strong><span>Documents</span></div>
          <div><strong>{approvedMine}</strong><span>Approved</span></div>
          <div><strong>{findings.length}</strong><span>Findings</span></div>
        </div>
      </div>

      {/* Sync status */}
      <div className="page-head" style={{ marginTop: 24, marginBottom: 10 }}>
        <h3 className="section-title" style={{ margin: 0 }}>Sync Status</h3>
        <button className="btn btn-primary btn-sm" onClick={syncAll} disabled={!offline.length}>
          <IconCloudUp size={14} /> Sync all ({offline.length})
        </button>
      </div>

      <div className="card table-card activity-list">
        {offline.length === 0 && uploaded.length === 0 ? (
          <div className="empty-state"><p><strong>No reports yet.</strong></p></div>
        ) : (
          <>
            {offline.length > 0 && <div className="sync-group">Stored offline — pending upload</div>}
            {offline.map((r) => <SyncRow key={r.id} r={r} isOffline />)}
            {uploaded.length > 0 && <div className="sync-group up">Uploaded</div>}
            {uploaded.map((r) => <SyncRow key={r.id} r={r} isOffline={false} />)}
          </>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
        {role.canManage && (
          <button className="btn btn-secondary" onClick={() => navigate('/settings')}>
            <IconGear size={15} /> Settings & instrument register
          </button>
        )}
        <button className="btn btn-secondary" style={{ color: 'var(--danger)' }} onClick={logout}>
          <IconLogout size={15} /> Sign out
        </button>
      </div>
    </div>
  )
}
