import { useMemo, useState, useEffect } from 'react'
import { useApp, navigate } from '../App.jsx'
import { FORM_SCHEMAS } from '../data/formSchemas.js'
import { getReports, deleteReport } from '../lib/store.js'
import { ncrReports, fmtDateTime } from '../lib/status.js'
import { reportResult } from '../lib/verdict.js'
import { StateBadge } from './StatusChip.jsx'
import { IconTrash, IconDownload, IconDoc, IconCloudUp, IconCloudOff, IconAlert, IconFilter, IconGroup } from './Icons.jsx'
import { SearchField, ToolButton, PopCheck, PopRadio, PopFooter } from './RegisterBar.jsx'

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Draft' },
  { id: 'submitted', label: 'Submitted' },
  { id: 'approved', label: 'Approved' },
  { id: 'ncr', label: 'NCR' },
]

// Same tools as the other two registers. Reports has always grouped by
// form type; that is the default now rather than the only option.
const GROUPS = [
  { id: 'form', label: 'Form', of: (r) => FORM_SCHEMAS[r.formKey]?.title || r.formKey },
  { id: 'job', label: 'Job', of: (r) => `Job ${r.jobNo}` },
  { id: 'inspector', label: 'Inspector', of: (r) => r.inspector || 'Unassigned' },
  { id: 'none', label: 'No grouping', of: null },
]

export default function Reports({ query }) {
  const { role, tick, refresh, notify } = useApp()
  const [tab, setTab] = useState(query?.f && TABS.some((t) => t.id === query.f) ? query.f : 'all')
  useEffect(() => {
    if (query?.f && TABS.some((t) => t.id === query.f)) setTab(query.f)
  }, [query?.f])
  const [q, setQ] = useState('')
  const [newestFirst, setNewestFirst] = useState(true)
  const [forms, setForms] = useState(() => new Set())
  const [group, setGroup] = useState('form')

  const all = useMemo(() => getReports(), [tick])
  const ncrs = useMemo(() => ncrReports(), [tick])

  const ql = q.trim().toLowerCase()
  const matchQ = (r) => !ql || `${r.reportId} ${r.jobNo} ${r.inspector} ${FORM_SCHEMAS[r.formKey]?.title}`.toLowerCase().includes(ql)

  const base = tab === 'ncr' ? ncrs : all.filter((r) => tab === 'all' || r.status === tab)
  // Tab and search, before the form filter: the counts in the filter
  // panel have to stay put as you tick boxes.
  const scoped = base.filter(matchQ)

  const counts = useMemo(() => ({
    all: all.length,
    draft: all.filter((r) => r.status === 'draft').length,
    submitted: all.filter((r) => r.status === 'submitted').length,
    approved: all.filter((r) => r.status === 'approved').length,
    ncr: ncrs.length,
  }), [all, ncrs])

  const formList = useMemo(() => {
    const m = new Map()
    for (const r of scoped) {
      const k = r.formKey
      m.set(k, { key: k, label: FORM_SCHEMAS[k]?.title || k, n: (m.get(k)?.n || 0) + 1 })
    }
    return [...m.values()].sort((a, b) => a.label.localeCompare(b.label))
  }, [scoped])

  const shown = scoped
    .filter((r) => !forms.size || forms.has(r.formKey))
    .slice()
    .sort((a, b) => {
      const cmp = (b.updatedAt || '').localeCompare(a.updatedAt || '')
      return newestFirst ? cmp : -cmp
    })

  const groups = useMemo(() => {
    const of = GROUPS.find((g) => g.id === group)?.of
    if (!of) return [[null, shown]]
    const m = new Map()
    for (const r of shown) {
      const key = of(r)
      if (!m.has(key)) m.set(key, [])
      m.get(key).push(r)
    }
    return [...m.entries()]
  }, [shown, group])

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
      <div className="mon-head">
        <h2>Reports</h2>
        <button className="btn btn-secondary btn-sm" onClick={exportCsv}>
          <IconDownload size={14} /> Export CSV
        </button>
      </div>

      <div className="mon-tabs" role="tablist" aria-label="Report status">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id}
            className={`mon-tab${tab === t.id ? ' on' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}<span className={`mon-tab-n${t.id === 'ncr' && counts.ncr ? ' is-alarm' : ''}`}>{counts[t.id]}</span>
          </button>
        ))}
      </div>

      <div className="rb-bar">
        <div className="rb-group">
          <SearchField value={q} onChange={setQ} label="Search reports"
            placeholder="Search report no, job, inspector…" />
          <ToolButton icon={IconFilter} label="Filter by form" count={forms.size}>
            {() => (
              <>
                {formList.map((f) => (
                  <PopCheck key={f.key} label={f.label} on={forms.has(f.key)} hint={f.n}
                    onChange={(on) => setForms((s0) => {
                      const n = new Set(s0); on ? n.add(f.key) : n.delete(f.key); return n
                    })} />
                ))}
                {!formList.length && <p className="rb-pop-empty">Nothing to filter here.</p>}
                <PopFooter>
                  <button className="btn btn-ghost btn-sm" disabled={!forms.size}
                    onClick={() => setForms(new Set())}>Clear</button>
                </PopFooter>
              </>
            )}
          </ToolButton>
          <ToolButton icon={IconGroup} label="Group and sort" count={group === 'form' ? 0 : 1}>
            {({ close }) => (
              <>
                {GROUPS.map((g) => (
                  <PopRadio key={g.id} label={g.label} on={group === g.id}
                    onChange={() => { setGroup(g.id); close() }} />
                ))}
                <div className="rb-pop-legend">Order</div>
                <PopRadio label="Newest first" on={newestFirst} onChange={() => setNewestFirst(true)} />
                <PopRadio label="Oldest first" on={!newestFirst} onChange={() => setNewestFirst(false)} />
              </>
            )}
          </ToolButton>
        </div>
        <span className="mon-count">{shown.length} report{shown.length === 1 ? '' : 's'}</span>
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
              <StateBadge status={r.status} />
            </button>
          ))}
        </div>
      ) : (
        groups.map(([groupName, reps]) => (
          <div key={groupName || 'all'}>
            {groupName && (
              <h3 className="section-title">{groupName} <span className="group-count">{reps.length}</span></h3>
            )}
            <div className="card table-card deliv-list" style={{ marginBottom: 6 }}>
              {reps.map((r) => (
                /* A div, not a button. It used to be a <button> with a
                   <span role="button"> inside it — invalid markup, and on
                   a phone the nested control was laid out over the report
                   number instead of beside it. Now the row carries the
                   open action and Delete is a real sibling button. */
                <div key={r.id} className="deliv-row tappable" role="button" tabIndex={0}
                  onClick={() => openReport(r)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openReport(r) } }}>
                  <span className="deliv-ico"><IconDoc size={17} /></span>
                  <span className="deliv-main">
                    <strong>{r.reportId}</strong>
                    <small>Job {r.jobNo} · {r.inspector} · updated {fmtDateTime(r.updatedAt)}</small>
                    <small className={r.synced ? 'sync-tag up' : 'sync-tag'}>
                      {r.synced ? <><IconCloudUp size={10} /> uploaded {fmtDateTime(r.syncedAt)}</> : <><IconCloudOff size={10} /> stored offline</>}
                    </small>
                  </span>
                  <span className="deliv-end">
                    <StateBadge status={r.status} />
                    {role.canManage && (
                      <button className="btn btn-ghost btn-icon" aria-label={`Delete ${r.reportId}`}
                        onClick={(e) => onDelete(e, r)}>
                        <IconTrash size={13} />
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
