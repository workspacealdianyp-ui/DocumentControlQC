import { useEffect, useMemo, useState } from 'react'
import { useApp, navigate } from '../App.jsx'
import { buildContext, jobProgress, fmtDate, exportMatrixCsv } from '../lib/status.js'
import { IconSearch, IconChevronR, IconDownload } from './Icons.jsx'
import { useStuck } from '../lib/sticky.js'

/* Jobs is a register, laid out like Monitoring so the app has one table
   pattern rather than two. The category tabs mirror the sidebar
   sub-items and travel through the hash, so a narrowed view stays
   linkable and survives a reload. */

const KATS = [
  { kat: null, label: 'All jobs' },
  { kat: 'SUPEQ', label: 'Support Equipment' },
  { kat: 'TRAILER', label: 'Trailer' },
  { kat: 'NON TRAILER', label: 'Non Trailer' },
]

const PAGE_SIZES = [10, 15, 25, 50]

// The type column used to repeat the product description on nearly
// every row ("BULL BAR" over "BULL BAR"). Show the qualifier only when
// it actually qualifies.
const qualifier = (job) => {
  const t = (job.type || '').trim()
  const d = (job.productDesc || '').trim()
  if (!t) return ''
  return t.toUpperCase() === d.toUpperCase() || d.toUpperCase().startsWith(t.toUpperCase()) ? '' : t
}

// One derived state per job, so the row says where the job stands
// without the reader adding up nine deliverables themselves.
function jobState(p) {
  if (!p.applicable) return { id: 'na', label: 'N/A' }
  if (p.done === p.applicable) return { id: 'done', label: 'Complete' }
  if (p.overdue) return { id: 'overdue', label: 'Overdue' }
  if (p.done || p.inprogress) return { id: 'inprogress', label: 'In progress' }
  return { id: 'notstarted', label: 'Not started' }
}

export default function JobsPage({ kat }) {
  const { jobs, tick } = useApp()
  const [q, setQ] = useState('')
  const [size, setSize] = useState(15)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState({ key: 'jobNo', dir: 'asc' })
  const [sentinel, stuck] = useStuck()

  const ctx = useMemo(() => buildContext(), [tick])
  const progress = useMemo(
    () => new Map(jobs.map((j) => [j.jobNo, jobProgress(j, ctx)])), [jobs, ctx])

  const counts = useMemo(() => Object.fromEntries(
    KATS.map((k) => [k.kat || 'all', k.kat ? jobs.filter((j) => j.kategori === k.kat).length : jobs.length])
  ), [jobs])

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    let out = kat ? jobs.filter((j) => j.kategori === kat) : jobs
    if (ql) {
      out = out.filter((j) => `${j.jobNo} ${j.wbsNo} ${j.arasSN} ${j.customerName} ${j.productDesc} ${j.type}`
        .toLowerCase().includes(ql))
    }
    const val = (j) => {
      if (sort.key === 'product') return j.productDesc || ''
      if (sort.key === 'customer') return j.customerName || ''
      if (sort.key === 'datePB') return j.datePB || ''
      if (sort.key === 'pdi') return j.datePdiRelease || ''
      if (sort.key === 'progress') {
        const p = progress.get(j.jobNo)
        return p?.applicable ? p.done / p.applicable : -1
      }
      return j.jobNo || ''
    }
    return [...out].sort((a, b) => {
      const x = val(a), y = val(b)
      return (x < y ? -1 : x > y ? 1 : 0) * (sort.dir === 'asc' ? 1 : -1)
    })
  }, [jobs, kat, q, sort, progress])

  const pages = Math.max(1, Math.ceil(rows.length / size))
  const at = Math.min(page, pages)
  const shown = rows.slice((at - 1) * size, at * size)

  useEffect(() => { setPage(1) }, [kat, q, size])

  const toggleSort = (key) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))
  const sortMark = (key) => (sort.key !== key ? '' : sort.dir === 'asc' ? ' ↑' : ' ↓')

  const pageList = () => {
    if (pages <= 5) return Array.from({ length: pages }, (_, i) => i + 1)
    if (at <= 3) return [1, 2, 3, '…', pages]
    if (at >= pages - 2) return [1, '…', pages - 2, pages - 1, pages]
    return [1, '…', at, '…', pages]
  }

  return (
    <div className="page mon">
      <div className="mon-head">
        <h2>Jobs</h2>
        <button className="btn btn-secondary btn-sm" onClick={() => exportMatrixCsv(rows, ctx)}>
          <IconDownload size={14} /> Export CSV
        </button>
      </div>

      <div className="mon-tabs" role="tablist" aria-label="Job category">
        {KATS.map((k) => (
          <button key={k.kat || 'all'} role="tab" aria-selected={(kat || null) === k.kat}
            className={`mon-tab${(kat || null) === k.kat ? ' on' : ''}`}
            onClick={() => navigate(k.kat ? `/jobs?kat=${encodeURIComponent(k.kat)}` : '/jobs')}>
            {k.label}<span className="mon-tab-n">{counts[k.kat || 'all']}</span>
          </button>
        ))}
      </div>

      <div className={`card mon-card${stuck ? ' is-stuck' : ''}`}>
        <div className="mon-bar">
          <div className="mon-search">
            <IconSearch size={15} />
            <input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search job, WBS, serial, customer…" aria-label="Search jobs" />
          </div>
          <div className="mon-showing">
            <label>Showing
              <select value={size} onChange={(e) => setSize(+e.target.value)} aria-label="Rows per page">
                {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <span>of {rows.length} jobs</span>
          </div>
        </div>

        {/* Sits at the table's own top edge, so the toolbar starts
            dissolving exactly as the column header lands rather than
            leaving a blank strip between the two. */}
        <div ref={sentinel} className="mon-sentinel" aria-hidden="true" />
        <div className="mon-tablewrap">
          <table className="mon-table jobs-table">
            <thead>
              <tr>
                <th><button onClick={() => toggleSort('jobNo')}>Job{sortMark('jobNo')}</button></th>
                <th><button onClick={() => toggleSort('product')}>Product{sortMark('product')}</button></th>
                <th><button onClick={() => toggleSort('customer')}>Customer{sortMark('customer')}</button></th>
                <th><button onClick={() => toggleSort('datePB')}>Date PB{sortMark('datePB')}</button></th>
                <th><button onClick={() => toggleSort('pdi')}>PDI release{sortMark('pdi')}</button></th>
                <th><button onClick={() => toggleSort('progress')}>Reports{sortMark('progress')}</button></th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((job) => {
                const p = progress.get(job.jobNo)
                const pct = p.applicable ? Math.round((p.done / p.applicable) * 100) : 0
                const st = jobState(p)
                return (
                  <tr key={job.jobNo} tabIndex={0}
                    onClick={() => navigate(`/job/${job.jobNo}`)}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/job/${job.jobNo}`)}>
                    <td>
                      <span className="mon-primary">{job.jobNo}</span>
                      <span className="mon-sub">{job.wbsNo || '—'}</span>
                    </td>
                    <td className="jobs-product">
                      <span className="jobs-desc">{job.productDesc}</span>
                      {qualifier(job) && <span className="mon-sub">{qualifier(job)}</span>}
                    </td>
                    <td>
                      <span className="jobs-cust">{job.customerName}</span>
                      <span className="mon-sub">{job.arasSN || '—'}</span>
                    </td>
                    <td className="num">{fmtDate(job.datePB)}</td>
                    <td className="num">{fmtDate(job.datePdiRelease) || '—'}</td>
                    <td>
                      <div className="jobs-prog" title={`${p.done} of ${p.applicable} reports complete`}>
                        <div className="jobs-prog-bar"><span style={{ width: `${pct}%` }} /></div>
                        <span className="jobs-prog-n">{p.done}/{p.applicable}</span>
                      </div>
                    </td>
                    <td><span className={`chip chip-${st.id}`}>{st.label}</span></td>
                  </tr>
                )
              })}
              {!shown.length && (
                <tr><td colSpan={7} className="mon-empty">
                  {q ? `No job matches “${q}”.` : 'No job in this category.'}
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
