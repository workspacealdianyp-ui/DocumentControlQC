import { useMemo, useState, useEffect, useRef } from 'react'
import { useApp, navigate } from '../App.jsx'
import { DELIVERABLES, STATUS } from '../lib/constants.js'
import { buildContext, computeKpis, filterJobs, jobStatuses, jobProgress, exportMatrixCsv, fmtDate } from '../lib/status.js'
import { getFilters, setFilters as persistFilters, setOverride } from '../lib/store.js'
import StatusChip from './StatusChip.jsx'
import { STATUS_ICONS, IconDownload, IconSearch, IconGrid, IconList, IconAlert } from './Icons.jsx'

const EMPTY_FILTERS = { search: '', customers: [], kategoris: [], types: [], statuses: [], dateFrom: '', dateTo: '' }

function MultiSelect({ label, options, value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])
  const toggle = (opt) =>
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt])
  return (
    <div className="mselect" ref={ref}>
      <button className={`mselect-btn${value.length ? ' has-value' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open}>
        {label}{value.length > 0 && <span className="mselect-count">{value.length}</span>}
      </button>
      {open && (
        <div className="mselect-pop">
          {options.map((opt) => (
            <label key={opt} className="mselect-opt">
              <input type="checkbox" checked={value.includes(opt)} onChange={() => toggle(opt)} />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

function CellPopover({ x, y, current, onPick, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [onClose])
  const vw = window.innerWidth
  const left = Math.min(x, vw - 200)
  return (
    <div className="cell-pop" style={{ left, top: y }} ref={ref} role="menu">
      <div className="cell-pop-title">Set status (Admin)</div>
      {Object.keys(STATUS).map((s) => {
        const Icon = STATUS_ICONS[s]
        return (
          <button key={s} className={`cell-pop-opt${current === s ? ' current' : ''}`} onClick={() => onPick(s)}>
            <Icon size={13} /> {STATUS[s].label}
          </button>
        )
      })}
      <button className="cell-pop-opt clear" onClick={() => onPick(null)}>Clear override</button>
    </div>
  )
}

function JobCard({ job, ctx, onOpen }) {
  const p = jobProgress(job, ctx)
  const pct = p.applicable ? Math.round((p.done / p.applicable) * 100) : 0
  return (
    <button className="job-card" onClick={onOpen}>
      <div className="job-card-top">
        <span className="jc-no">{job.jobNo}</span>
        {job.type && <span className="jc-type">{job.type}</span>}
        {p.overdue && (
          <span className="jc-flag chip chip-overdue" title="Has overdue reports">
            <IconAlert size={11} /> Overdue
          </span>
        )}
      </div>
      <span className="jc-desc">{job.productDesc}</span>
      <span className="jc-customer">{job.customerName}</span>
      <div className="jc-progress-row">
        <div className="progress"><div className="progress-bar" style={{ width: `${pct}%` }} /></div>
        <span className="progress-num">{p.done}/{p.applicable}</span>
      </div>
      <div className="deliv-strip" aria-label="Deliverable statuses">
        {DELIVERABLES.map((d) => {
          const s = p.statuses[d.key].status
          return (
            <span key={d.key} className={`dchip dchip-${s}`}
              title={`${d.label}: ${STATUS[s].label}`}>{d.short}</span>
          )
        })}
      </div>
    </button>
  )
}

export default function Dashboard() {
  const { jobs, meta, role, tick, refresh, notify } = useApp()
  const [filters, setF] = useState(() => ({ ...EMPTY_FILTERS, ...(getFilters() || {}) }))
  const [limit, setLimit] = useState(36)
  const [popover, setPopover] = useState(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState(() => (window.innerWidth >= 1024 ? 'matrix' : 'cards'))

  useEffect(() => { const t = setTimeout(() => setLoading(false), 300); return () => clearTimeout(t) }, [])
  useEffect(() => { persistFilters(filters) }, [filters])

  const ctx = useMemo(() => buildContext(), [tick])
  const filtered = useMemo(() => filterJobs(jobs, filters, ctx), [jobs, filters, ctx])
  const kpis = useMemo(() => computeKpis(filtered, ctx), [filtered, ctx])
  const visible = filtered.slice(0, limit)
  const hasFilter = filters.search || filters.customers.length || filters.kategoris.length ||
    filters.types.length || filters.statuses.length || filters.dateFrom || filters.dateTo

  const upd = (patch) => { setF((f) => ({ ...f, ...patch })); setLimit(36) }

  const onCell = (e, job, dKey, st) => {
    if (!role.canOverride) return
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setPopover({ jobNo: job.jobNo, dKey, current: st, x: rect.left, y: rect.bottom + 4 })
  }

  return (
    <div className="page">
      {/* KPI cards */}
      <div className="kpis">
        <div className="kpi kpi-blue"><span className="kpi-val">{kpis.totalJobs}</span><span className="kpi-label">Total Jobs</span></div>
        <div className="kpi kpi-green"><span className="kpi-val">{kpis.pctComplete}%</span><span className="kpi-label">Reports Complete</span></div>
        <div className="kpi kpi-amber"><span className="kpi-val">{kpis.jobsInProgress}</span><span className="kpi-label">Jobs In Progress</span></div>
        <div className="kpi kpi-red"><span className="kpi-val">{kpis.jobsOverdue}</span><span className="kpi-label">Jobs Overdue</span></div>
        <div className="kpi"><span className="kpi-val">{kpis.notStarted}</span><span className="kpi-label">Reports Not Started</span></div>
      </div>

      {/* Search */}
      <div className="searchbar">
        <IconSearch size={16} />
        <input
          placeholder="Search Job No, WBS, Serial No, Customer…"
          value={filters.search}
          onChange={(e) => upd({ search: e.target.value })}
          aria-label="Filter search"
        />
      </div>

      {/* Filter chips row */}
      <div className="filters-row">
        <MultiSelect label="Customer" options={meta.customers} value={filters.customers} onChange={(v) => upd({ customers: v })} />
        <MultiSelect label="Category" options={meta.kategoris} value={filters.kategoris} onChange={(v) => upd({ kategoris: v })} />
        <MultiSelect label="Type" options={meta.types} value={filters.types} onChange={(v) => upd({ types: v })} />
        <MultiSelect
          label="Status"
          options={Object.keys(STATUS).map((s) => STATUS[s].label)}
          value={filters.statuses.map((s) => STATUS[s].label)}
          onChange={(labels) => upd({ statuses: Object.keys(STATUS).filter((k) => labels.includes(STATUS[k].label)) })}
        />
        <div className="filter-dates">
          <input type="date" value={filters.dateFrom} onChange={(e) => upd({ dateFrom: e.target.value })} aria-label="Date PB from" />
          <span>–</span>
          <input type="date" value={filters.dateTo} onChange={(e) => upd({ dateTo: e.target.value })} aria-label="Date PB to" />
        </div>
        {hasFilter && <button className="clear-filters" onClick={() => setF({ ...EMPTY_FILTERS })}>Clear all</button>}
      </div>

      {/* View toggle + export (desktop) */}
      <div className="page-head" style={{ marginBottom: 12 }}>
        <p className="page-sub">{filtered.length} job{filtered.length === 1 ? '' : 's'}</p>
        <div className="page-head-actions">
          <div className="view-toggle" role="tablist" aria-label="View mode">
            <button className={view === 'cards' ? 'active' : ''} onClick={() => setView('cards')} role="tab" aria-selected={view === 'cards'}>
              <IconGrid size={14} /> Cards
            </button>
            <button className={view === 'matrix' ? 'active' : ''} onClick={() => setView('matrix')} role="tab" aria-selected={view === 'matrix'}>
              <IconList size={14} /> Matrix
            </button>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => exportMatrixCsv(filtered, ctx)}>
            <IconDownload size={14} /> CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="skeleton-block" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton-row" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card empty-state">
          <p><strong>No jobs match the current filters.</strong></p>
          <p>Try clearing a filter or changing the search terms.</p>
          <button className="btn btn-secondary" onClick={() => setF({ ...EMPTY_FILTERS })}>Clear filters</button>
        </div>
      ) : view === 'cards' ? (
        <>
          <div className="job-cards">
            {visible.map((job) => (
              <JobCard key={job.jobNo} job={job} ctx={ctx} onOpen={() => navigate(`/job/${job.jobNo}`)} />
            ))}
          </div>
          {filtered.length > limit && (
            <div className="matrix-more" style={{ border: 0, justifyContent: 'center' }}>
              <span>Showing {limit} of {filtered.length}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setLimit(limit + 60)}>Show more</button>
            </div>
          )}
        </>
      ) : (
        <div className="matrix-wrap">
          <table className="matrix" role="grid" aria-label="Job by report-type status matrix">
            <thead>
              <tr>
                <th className="sticky-col">Job</th>
                {DELIVERABLES.map((d) => (
                  <th key={d.key} title={d.label}><span className="col-short">{d.short}</span></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((job) => {
                const sts = jobStatuses(job, ctx)
                return (
                  <tr key={job.jobNo} onClick={() => navigate(`/job/${job.jobNo}`)} tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/job/${job.jobNo}`)}>
                    <td className="sticky-col">
                      <div className="job-cell">
                        <strong>{job.jobNo}</strong>
                        <span className="job-desc">{job.productDesc}</span>
                        <small>{job.customerName}</small>
                      </div>
                    </td>
                    {DELIVERABLES.map((d) => {
                      const cell = sts[d.key]
                      const tip = `${d.label}: ${STATUS[cell.status].label}` +
                        (cell.report ? `\nUpdated ${fmtDate(cell.report.updatedAt)} · ${cell.report.inspector}` : '') +
                        (cell.ref ? `\nRef: ${cell.ref}` : '') +
                        (role.canOverride ? '\nClick to override' : '')
                      return (
                        <td key={d.key} className={`cell cell-${cell.status}${role.canOverride ? ' editable' : ''}`}
                          onClick={(e) => onCell(e, job, d.key, cell.status)} title={tip}>
                          <StatusChip status={cell.status} compact title={tip} />
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length > limit && (
            <div className="matrix-more">
              <span>Showing {limit} of {filtered.length} jobs</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setLimit(limit + 100)}>Show more</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setLimit(filtered.length)}>Show all</button>
            </div>
          )}
        </div>
      )}

      {popover && (
        <CellPopover
          {...popover}
          onClose={() => setPopover(null)}
          onPick={(s) => {
            setOverride(popover.jobNo, popover.dKey, s)
            setPopover(null)
            refresh()
            notify(s ? `Status set to ${STATUS[s].label}` : 'Override cleared')
          }}
        />
      )}
    </div>
  )
}
