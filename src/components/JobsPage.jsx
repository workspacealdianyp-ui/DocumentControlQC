import { useMemo, useState } from 'react'
import { useApp, navigate } from '../App.jsx'
import { buildContext, jobProgress, fmtDate } from '../lib/status.js'
import { IconSearch } from './Icons.jsx'

export default function JobsPage({ kat }) {
  const { jobs, tick } = useApp()
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(80)
  const ctx = useMemo(() => buildContext(), [tick])

  const ql = q.trim().toLowerCase()
  // The sidebar's Jobs sub-items pass a `kategori` through the hash, so
  // the narrowed set is a real, linkable view rather than a UI-only mode.
  const scoped = kat ? jobs.filter((j) => j.kategori === kat) : jobs
  // Show the readable name, not the code the data stores it under.
  const KAT_LABEL = { SUPEQ: 'Support Equipment', TRAILER: 'Trailer', 'NON TRAILER': 'Non Trailer' }
  const katLabel = kat ? (KAT_LABEL[kat] || kat) : null
  const filtered = ql
    ? scoped.filter((j) => `${j.jobNo} ${j.wbsNo} ${j.arasSN} ${j.customerName} ${j.productDesc} ${j.type}`.toLowerCase().includes(ql))
    : scoped

  return (
    <div className="page">
      <div className="searchbar">
        <IconSearch size={16} />
        <input placeholder="Search jobs…" value={q} onChange={(e) => { setQ(e.target.value); setLimit(80) }} />
      </div>
      <p className="page-sub" style={{ marginBottom: 12 }}>{filtered.length} of {scoped.length} jobs{katLabel ? ` in ${katLabel}` : ''}. Tap a row for detail &amp; forms</p>

      <div className="card table-card table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Job No.</th><th>Category</th><th>Type</th><th>Product</th>
              <th>Customer</th><th>Date PB</th><th>PDI Release</th><th>Progress</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, limit).map((job) => {
              const p = jobProgress(job, ctx)
              const pct = p.applicable ? Math.round((p.done / p.applicable) * 100) : 0
              return (
                <tr key={job.jobNo} onClick={() => navigate(`/job/${job.jobNo}`)} tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/job/${job.jobNo}`)}>
                  <td><strong>{job.jobNo}</strong></td>
                  <td>{job.kategori}</td>
                  <td>{job.type}</td>
                  <td className="td-wide">{job.productDesc}</td>
                  <td>{job.customerName}</td>
                  <td className="num">{fmtDate(job.datePB)}</td>
                  <td className="num">{fmtDate(job.datePdiRelease)}</td>
                  <td>
                    <div className="jc-progress-row" style={{ minWidth: 110 }} title={`${p.done} of ${p.applicable} reports complete`}>
                      <div className="progress"><div className="progress-bar" style={{ width: `${pct}%` }} /></div>
                      <span className="progress-num">{p.done}/{p.applicable}</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="empty-state"><p><strong>No jobs found.</strong></p></div>
        )}
        {filtered.length > limit && (
          <div className="matrix-more">
            <span>Showing {limit} of {filtered.length}</span>
            <button className="btn btn-secondary" onClick={() => setLimit(limit + 150)}>Show more</button>
          </div>
        )}
      </div>
    </div>
  )
}
