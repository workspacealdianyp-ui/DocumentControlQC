import { useMemo, useState, useEffect } from 'react'
import { useApp, navigate } from '../App.jsx'
import { FORM_SCHEMAS } from '../data/formSchemas.js'
import { getReports, deleteReport, approveReport } from '../lib/store.js'
import { ncrReports, fmtDateTime } from '../lib/status.js'
import { reportResult } from './SummaryReport.jsx'
import { IconTrash, IconDownload, IconSearch, IconDoc, IconApprove, IconCloudUp, IconCloudOff, IconAlert } from './Icons.jsx'

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Draft' },
  { id: 'submitted', label: 'Submitted' },
  { id: 'approved', label: 'Approved' },
  { id: 'ncr', label: 'NCR' },
]

export default function Reports({ query }) {
  const { role, session, tick, refresh, notify } = useApp()
  const [tab, setTab] = useState(query?.f && TABS.some((t) => t.id === query.f) ? query.f : 'all')
  useEffect(() => {
    if (query?.f && TABS.some((t) => t.id === query.f)) setTab(query.f)
  }, [query?.f])
  const [q, setQ] = useState('')
  const [newestFirst, setNewestFirst] = useState(true)

  const all = useMemo(() => getReports(), [tick])
  const ncrs = useMemo(() => ncrReports(), [tick])

  const ql = q.trim().toLowerCase()
  const matchQ = (r) => !ql || `${r.reportId} ${r.jobNo} ${r.inspector} ${FORM_SCHEMAS[r.formKey]?.title}`.toLowerCase().includes(ql)

  const base = tab === 'ncr' ? ncrs : all.filter((r) => tab === 'all' || r.status === tab)
  const shown = base.filter(matchQ).slice().sort((a, b) => {
    const cmp = (b.updatedAt || '').localeCompare(a.updatedAt || '')
    return newestFirst ? cmp : -cmp
  })

  // Categorized by report type (Improve §5.3), ordered by date inside each group
  const groups = useMemo(() => {
    const m = new Map()
    for (const r of shown) {
      const key = FORM_SCHEMAS[r.formKey]?.title || r.formKey
      if (!m.has(key)) m.set(key, [])
      m.get(key).push(r)
    }
    return [...m.entries()]
  }, [shown])

  const onApprove = (e, r) => {
    e.stopPropagation()
    approveReport(r.id, session.name)
    refresh()
    notify(`${r.reportId} approved`)
  }
  const onDelete = (e, r) => {
    e.stopPropagation()
    if (confirm(`Delete report ${r.reportId}?`)) {
      deleteReport(r.id); refresh(); notify('Report deleted')
    }
  }

  const exportCsv = () => {
    const head = ['Report ID', 'Form', 'Job No', 'Deliverable', 'Inspector', 'Status', 'Result', 'Updated', 'Synced']
    const lines = [head.join(',')]
    for (const r of shown) {
      lines.push([r.reportId, FORM_SCHEMAS[r.formKey]?.title, r.jobNo, r.deliverable, r.inspector, r.status,
        reportResult(r), r.updatedAt?.slice(0, 16), r.synced ? r.syncedAt?.slice(0, 16) : 'offline']
        .map((x) => `"${x || ''}"`).join(','))
    }
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `qc-reports-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const openReport = (r) =>
    navigate(`/job/${r.jobNo}/form/${r.formKey}?d=${encodeURIComponent(r.deliverable)}&rid=${encodeURIComponent(r.id)}`)

  return (
    <div className="page">
      <div className="searchbar">
        <IconSearch size={16} />
        <input placeholder="Search report no, job, inspector…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="filters-row">
        {TABS.map((t) => (
          <button key={t.id} className={`mselect-btn${tab === t.id ? ' has-value' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
            {t.id === 'ncr' && ncrs.length > 0 && <span className="mselect-count" style={{ background: 'var(--overdue)' }}>{ncrs.length}</span>}
          </button>
        ))}
        <button className="mselect-btn" onClick={() => setNewestFirst(!newestFirst)} title="Toggle sort order">
          {newestFirst ? 'Newest ↓' : 'Oldest ↑'}
        </button>
        <button className="mselect-btn" onClick={exportCsv}><IconDownload size={13} /> CSV</button>
      </div>

      {shown.length === 0 ? (
        <div className="card empty-state">
          <p><strong>{tab === 'ncr' ? 'No NCR findings.' : 'No reports here yet.'}</strong></p>
          <p>{tab === 'ncr' ? 'Reports with non-conformance notes or rejected results will appear here.' : 'Create a report from the Home quick actions.'}</p>
          <button className="btn btn-secondary" onClick={() => navigate('/')}>Go to Home</button>
        </div>
      ) : tab === 'ncr' ? (
        <div className="card table-card deliv-list">
          {shown.map((r) => (
            <button key={r.id} className="deliv-row tappable" onClick={() => openReport(r)}>
              <span className="deliv-ico ncr-ico"><IconAlert size={17} /></span>
              <span className="deliv-main">
                <strong>{r.reportId} — {reportResult(r) === 'Reject' ? 'Rejected' : 'Finding'}</strong>
                <small>{(r.values?.ncr || 'Non-conforming result recorded').slice(0, 110)}</small>
                <small>{FORM_SCHEMAS[r.formKey]?.title} · Job {r.jobNo} · {r.inspector} · {fmtDateTime(r.updatedAt)}</small>
              </span>
              <span className={`report-state state-${r.status}`}>{r.status}</span>
            </button>
          ))}
        </div>
      ) : (
        groups.map(([groupName, reps]) => (
          <div key={groupName}>
            <h3 className="section-title">{groupName} <span className="group-count">{reps.length}</span></h3>
            <div className="card table-card deliv-list" style={{ marginBottom: 6 }}>
              {reps.map((r) => (
                <button key={r.id} className="deliv-row tappable" onClick={() => openReport(r)}>
                  <span className="deliv-ico"><IconDoc size={17} /></span>
                  <span className="deliv-main">
                    <strong>{r.reportId}</strong>
                    <small>Job {r.jobNo} · {r.inspector} · updated {fmtDateTime(r.updatedAt)}</small>
                    <small className={r.synced ? 'sync-tag up' : 'sync-tag'}>
                      {r.synced ? <><IconCloudUp size={10} /> uploaded {fmtDateTime(r.syncedAt)}</> : <><IconCloudOff size={10} /> stored offline</>}
                    </small>
                  </span>
                  <span className="deliv-end">
                    <span className={`report-state state-${r.status}`}>{r.status}</span>
                    {role.canOverride && r.status === 'submitted' && (
                      <span className="btn btn-primary btn-sm" role="button" onClick={(e) => onApprove(e, r)}>
                        <IconApprove size={13} /> Approve
                      </span>
                    )}
                    {role.canManage && (
                      <span className="btn btn-ghost btn-icon" role="button" aria-label="Delete report" onClick={(e) => onDelete(e, r)}>
                        <IconTrash size={13} />
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
