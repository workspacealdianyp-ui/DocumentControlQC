import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../App.jsx'
import { SearchField } from './RegisterBar.jsx'

/* Choosing the job, wherever the choice is made.

   Two places ask the same question — a report tile on the dashboard, and
   the job bar on page 1 of every form — so they ask it with the same
   control: the register's search field over a short table of the four
   things that identify a unit. Job number with its WBS under it, what
   the unit is, and whose it is. Nothing else fits on a line a person
   scans, and nothing else is needed to recognise the job. */

export default function JobPicker({ title, sub, current, onPick, onClose }) {
  const { jobs } = useApp()
  const [q, setQ] = useState('')

  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onClose])

  const ql = q.trim().toLowerCase()
  const hits = useMemo(() => (ql
    ? jobs.filter((j) => `${j.jobNo} ${j.wbsNo} ${j.arasSN} ${j.productDesc} ${j.customerName}`.toLowerCase().includes(ql))
    : jobs
  ).slice(0, 40), [jobs, ql])

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal jobpick" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-handle" />
        <h3>{title}</h3>
        {sub && <p className="page-sub">{sub}</p>}

        <div className="jobpick-search">
          <SearchField value={q} onChange={setQ} label="Search jobs"
            placeholder="Search job no, WBS, product, customer…" />
        </div>

        <div className="jobpick-scroll">
          {hits.length === 0 ? (
            <div className="empty-state" style={{ padding: 16 }}>No job matches “{q.trim()}”.</div>
          ) : (
            <table className="jobpick-table">
              <thead>
                <tr><th>Job</th><th>Product</th><th>Customer</th></tr>
              </thead>
              <tbody>
                {hits.map((j) => (
                  <tr key={j.jobNo} className={j.jobNo === current ? 'is-current' : undefined}
                    tabIndex={0} role="button"
                    onClick={() => onPick(j.jobNo)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(j.jobNo) } }}>
                    <td className="jp-job">
                      <strong>{j.jobNo}</strong>
                      <small>{j.wbsNo || 'no WBS'}</small>
                    </td>
                    <td className="jp-prod">{j.productDesc || '—'}</td>
                    <td className="jp-cust">{j.customerName || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <button className="btn btn-ghost btn-block" onClick={onClose}>Cancel</button>
      </div>
    </div>,
    document.body
  )
}
