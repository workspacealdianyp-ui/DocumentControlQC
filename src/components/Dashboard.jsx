import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useApp, navigate } from '../App.jsx'
import { FORM_SCHEMAS } from '../data/formSchemas.js'
import { getReports, approveReport, deleteReport } from '../lib/store.js'
import { fmtDate } from '../lib/status.js'
import { reportResult } from './SummaryReport.jsx'
import { StateBadge } from './StatusChip.jsx'
import { IconChevronR, IconApprove, IconTrash, IconPrint, IconPlus, IconXCircle, IconFilter, IconGroup } from './Icons.jsx'
import { SearchField, ToolButton, PopCheck, PopRadio, PopFooter } from './RegisterBar.jsx'
import { useStuck } from '../lib/sticky.js'

/* Monitoring is a register of documents, so it is laid out as one: a
   status filter across the top, a table with a row per report, and
   pagination. Counts live on the tabs because "how many are still
   sitting in draft" is the question this screen exists to answer. */

const TABS = [
  { id: 'all', label: 'All reports' },
  { id: 'draft', label: 'Draft' },
  { id: 'submitted', label: 'Submitted' },
  { id: 'approved', label: 'Approved' },
  { id: 'reject', label: 'Rejected' },
]

const PAGE_SIZES = [10, 15, 25, 50]

const VERDICTS = [{ id: 'Accept', label: 'Accept' }, { id: 'Reject', label: 'Reject' }]

const GROUPS = [
  { id: 'none', label: 'No grouping', of: null },
  { id: 'job', label: 'Job', of: (r) => r.jobNo || '—' },
  { id: 'form', label: 'Form', of: (r) => FORM_SCHEMAS[r.formKey]?.title || '—' },
  { id: 'deliverable', label: 'Deliverable', of: (r) => r.deliverable || '—' },
]

const matchTab = (r, tab) =>
  tab === 'all' ? true
    : tab === 'reject' ? reportResult(r) === 'Reject'
      : r.status === tab

function RowMenu({ report, onOpen, onApprove, onDelete, canManage }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])
  return (
    <div className="rowmenu" ref={ref}>
      <button className="rowmenu-btn" aria-haspopup="menu" aria-expanded={open}
        aria-label={`Actions for ${report.reportId}`} onClick={() => setOpen((v) => !v)}>⋮</button>
      {open && (
        <div className="rowmenu-pop" role="menu">
          <button role="menuitem" onClick={() => { setOpen(false); onOpen() }}><IconPrint size={13} /> Open report</button>
          {canManage && report.status === 'submitted' && (
            <button role="menuitem" onClick={() => { setOpen(false); onApprove() }}><IconApprove size={13} /> Approve</button>
          )}
          {canManage && (
            <button role="menuitem" className="is-danger" onClick={() => { setOpen(false); onDelete() }}><IconTrash size={13} /> Delete</button>
          )}
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { jobs, role, tick, refresh, notify } = useApp()
  const [tab, setTab] = useState('all')
  const [q, setQ] = useState('')
  const [size, setSize] = useState(15)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState({ key: 'updatedAt', dir: 'desc' })
  const [picked, setPicked] = useState(() => new Set())
  const [forms, setForms] = useState(() => new Set())
  const [verdicts, setVerdicts] = useState(() => new Set())
  const [group, setGroup] = useState('none')
  const [sentinel, stuck] = useStuck()

  const reports = useMemo(() => getReports(), [tick])
  const jobIndex = useMemo(() => new Map(jobs.map((j) => [j.jobNo, j])), [jobs])

  const counts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t.id, reports.filter((r) => matchTab(r, t.id)).length])),
    [reports])

  // Tab and search, before the tool filters: the counts in the filter
  // panel have to stay put as you tick boxes.
  const scoped = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const base = reports.filter((r) => matchTab(r, tab))
    if (!ql) return base
    return base.filter((r) => {
      const job = jobIndex.get(r.jobNo)
      return `${r.reportId} ${r.jobNo} ${r.deliverable} ${job?.customerName || ''} ${job?.productDesc || ''}`
        .toLowerCase().includes(ql)
    })
  }, [reports, tab, q, jobIndex])

  const formList = useMemo(() => {
    const m = new Map()
    for (const r of scoped) {
      const k = r.formKey
      m.set(k, { key: k, label: FORM_SCHEMAS[k]?.title || k, n: (m.get(k)?.n || 0) + 1 })
    }
    return [...m.values()].sort((a, b) => a.label.localeCompare(b.label))
  }, [scoped])

  const verdictCounts = useMemo(() => {
    const m = { Accept: 0, Reject: 0 }
    for (const r of scoped) m[reportResult(r) === 'Reject' ? 'Reject' : 'Accept']++
    return m
  }, [scoped])

  const rows = useMemo(() => {
    let out = scoped
    if (forms.size) out = out.filter((r) => forms.has(r.formKey))
    if (verdicts.size) out = out.filter((r) => verdicts.has(reportResult(r) === 'Reject' ? 'Reject' : 'Accept'))
    const val = (r) => {
      if (sort.key === 'reportId') return r.reportId || ''
      if (sort.key === 'job') return r.jobNo || ''
      if (sort.key === 'form') return FORM_SCHEMAS[r.formKey]?.title || ''
      if (sort.key === 'status') return r.status || ''
      return r.updatedAt || ''
    }
    const of = GROUPS.find((g) => g.id === group)?.of
    return [...out].sort((a, b) => {
      // The group key outranks the sort, or a group ends up scattered
      // down the list by whatever column you sorted on.
      if (of) {
        const ga = of(a), gb = of(b)
        if (ga !== gb) return ga < gb ? -1 : 1
      }
      const x = val(a), y = val(b)
      return (x < y ? -1 : x > y ? 1 : 0) * (sort.dir === 'asc' ? 1 : -1)
    })
  }, [scoped, sort, forms, verdicts, group])

  const pages = Math.max(1, Math.ceil(rows.length / size))
  const at = Math.min(page, pages)
  const shown = rows.slice((at - 1) * size, at * size)

  // Any change to what is being listed sends you back to the first page,
  // otherwise you land on an empty page you did not ask for.
  useEffect(() => { setPage(1); setPicked(new Set()) }, [tab, q, size, forms, verdicts, group])

  const toggleSort = (key) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))
  const sortMark = (key) => (sort.key !== key ? '' : sort.dir === 'asc' ? ' ↑' : ' ↓')

  const allOnPage = shown.length > 0 && shown.every((r) => picked.has(r.id))
  const togglePage = () => setPicked((p) => {
    const n = new Set(p)
    shown.forEach((r) => (allOnPage ? n.delete(r.id) : n.add(r.id)))
    return n
  })

  const open = (r) => {
    const job = jobIndex.get(r.jobNo)
    if (!job) { notify(`Job ${r.jobNo} is no longer in the list`); return }
    navigate(`/job/${r.jobNo}/form/${r.formKey}?d=${encodeURIComponent(r.deliverable)}&rid=${r.id}`)
  }

  // Page numbers with an ellipsis once there are more than five.
  const pageList = () => {
    if (pages <= 5) return Array.from({ length: pages }, (_, i) => i + 1)
    if (at <= 3) return [1, 2, 3, '…', pages]
    if (at >= pages - 2) return [1, '…', pages - 2, pages - 1, pages]
    return [1, '…', at, '…', pages]
  }

  return (
    <div className="page mon">
      <div className="mon-head">
        <h2>Monitoring</h2>
        <button className="btn btn-primary btn-sm" onClick={() => navigate('/jobs')}>
          <IconPlus size={14} /> New report
        </button>
      </div>

      <div className="mon-tabs" role="tablist" aria-label="Report status">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id}
            className={`mon-tab${tab === t.id ? ' on' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}<span className="mon-tab-n">{counts[t.id]}</span>
          </button>
        ))}
      </div>

      <div className={`card mon-card${stuck ? ' is-stuck' : ''}`}>
        <div className="mon-bar">
          <div className="rb-group">
            <SearchField value={q} onChange={setQ} label="Search reports"
              placeholder="Search report, job, customer…" />
            <ToolButton icon={IconFilter} label="Filter" count={forms.size + verdicts.size}>
              {() => (
                <>
                  <div className="rb-pop-legend">Result</div>
                  {VERDICTS.map((v) => (
                    <PopCheck key={v.id} label={v.label} on={verdicts.has(v.id)} hint={verdictCounts[v.id]}
                      onChange={(on) => setVerdicts((s0) => {
                        const n = new Set(s0); on ? n.add(v.id) : n.delete(v.id); return n
                      })} />
                  ))}
                  <div className="rb-pop-legend">Form</div>
                  {formList.map((f) => (
                    <PopCheck key={f.key} label={f.label} on={forms.has(f.key)} hint={f.n}
                      onChange={(on) => setForms((s0) => {
                        const n = new Set(s0); on ? n.add(f.key) : n.delete(f.key); return n
                      })} />
                  ))}
                  <PopFooter>
                    <button className="btn btn-ghost btn-sm" disabled={!forms.size && !verdicts.size}
                      onClick={() => { setForms(new Set()); setVerdicts(new Set()) }}>Clear</button>
                  </PopFooter>
                </>
              )}
            </ToolButton>
            <ToolButton icon={IconGroup} label="Group rows" count={group === 'none' ? 0 : 1}>
              {({ close }) => GROUPS.map((g) => (
                <PopRadio key={g.id} label={g.label} on={group === g.id}
                  onChange={() => { setGroup(g.id); close() }} />
              ))}
            </ToolButton>
          </div>
          <div className="mon-showing">
            <label>Showing
              <select value={size} onChange={(e) => setSize(+e.target.value)} aria-label="Rows per page">
                {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <span>of {rows.length} results</span>
          </div>
        </div>

        {/* Sits at the table's own top edge, so the toolbar starts
            dissolving exactly as the column header lands rather than
            leaving a blank strip between the two. */}
        <div ref={sentinel} className="mon-sentinel" aria-hidden="true" />
        <div className="mon-tablewrap">
          <table className="mon-table">
            <thead>
              <tr>
                <th className="mon-check">
                  <input type="checkbox" checked={allOnPage} onChange={togglePage}
                    aria-label="Select all rows on this page" />
                </th>
                <th><button onClick={() => toggleSort('reportId')}>Report{sortMark('reportId')}</button></th>
                <th><button onClick={() => toggleSort('job')}>Job / Customer{sortMark('job')}</button></th>
                <th><button onClick={() => toggleSort('form')}>Form{sortMark('form')}</button></th>
                <th>Result</th>
                <th><button onClick={() => toggleSort('updatedAt')}>Updated{sortMark('updatedAt')}</button></th>
                <th><button onClick={() => toggleSort('status')}>Status{sortMark('status')}</button></th>
                <th className="mon-act">Action</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => {
                const job = jobIndex.get(r.jobNo)
                const verdict = reportResult(r)
                const of = GROUPS.find((g) => g.id === group)?.of
                const key = of ? of(r) : null
                const first = of && (i === 0 || of(shown[i - 1]) !== key)
                return (
                  <Fragment key={r.id}>
                  {first && (
                    <tr className="mon-grouprow">
                      <td colSpan={8}>
                        <span>{key}</span>
                        <small>{rows.filter((x) => of(x) === key).length}</small>
                      </td>
                    </tr>
                  )}
                  <tr onClick={() => open(r)} className={picked.has(r.id) ? 'is-picked' : ''}>
                    <td className="mon-check" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={picked.has(r.id)}
                        aria-label={`Select ${r.reportId}`}
                        onChange={() => setPicked((p) => {
                          const n = new Set(p); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n
                        })} />
                    </td>
                    <td>
                      <span className="mon-primary">{r.reportId}</span>
                      <span className="mon-sub">Inspected {fmtDate(r.values?.inspDate) || '—'}</span>
                    </td>
                    <td>
                      <span className="mon-primary">{r.jobNo}</span>
                      <span className="mon-sub">{job?.customerName || 'Job not in list'}</span>
                    </td>
                    <td>
                      <span className="mon-primary">{FORM_SCHEMAS[r.formKey]?.code || r.formKey}</span>
                      <span className="mon-sub">{r.deliverable}</span>
                    </td>
                    <td>
                      <span className={`chip chip-${verdict === 'Reject' ? 'overdue' : 'done'}`}>
                        {verdict === 'Reject' ? <IconXCircle size={13} /> : <IconApprove size={13} />}
                        {verdict === 'Reject' ? 'Reject' : 'Accept'}
                      </span>
                    </td>
                    <td className="num">{fmtDate(r.updatedAt)}</td>
                    <td>
                      <StateBadge status={r.status} />
                    </td>
                    <td className="mon-act" onClick={(e) => e.stopPropagation()}>
                      <RowMenu report={r} canManage={role.canOverride}
                        onOpen={() => open(r)}
                        onApprove={() => { approveReport(r.id, 'QA Lead'); refresh(); notify(`${r.reportId} approved`) }}
                        onDelete={() => { deleteReport(r.id); refresh(); notify(`${r.reportId} deleted`) }} />
                    </td>
                  </tr>
                  </Fragment>
                )
              })}
              {!shown.length && (
                <tr><td colSpan={8} className="mon-empty">
                  {q ? `No report matches “${q}”.`
                     : (forms.size || verdicts.size) ? 'Nothing matches that filter.'
                     : 'No report in this status yet.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <nav className="mon-pager" aria-label="Pagination">
            <button onClick={() => setPage(at - 1)} disabled={at === 1} aria-label="Previous page">
              <IconChevronR size={14} style={{ transform: 'rotate(180deg)' }} />
            </button>
            {pageList().map((n, i) => n === '…'
              ? <span key={`gap${i}`} className="mon-gap">…</span>
              : <button key={n} className={n === at ? 'on' : ''} aria-current={n === at ? 'page' : undefined}
                  onClick={() => setPage(n)}>{n}</button>)}
            <button onClick={() => setPage(at + 1)} disabled={at === pages} aria-label="Next page">
              <IconChevronR size={14} />
            </button>
          </nav>
        )}
      </div>
    </div>
  )
}
