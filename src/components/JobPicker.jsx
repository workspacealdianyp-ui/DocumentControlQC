import { useMemo, useState } from 'react'
import { useApp } from '../App.jsx'
import { SearchField } from './RegisterBar.jsx'
import PickerDialog from './PickerDialog.jsx'

export function JobChoices({ current, onPick, unavailable }) {
  const { jobs } = useApp()
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(40)
  const matches = useMemo(() => {
    const term = q.trim().toLowerCase()
    return jobs.filter((j) => !term || `${j.jobNo} ${j.wbsNo} ${j.arasSN} ${j.productDesc} ${j.customerName}`.toLowerCase().includes(term))
  }, [jobs, q])
  return <>
    {/* Wrapped so the field can be pinned to the top of the scrolling
        body: the list moves under it, the search does not go with it. */}
    <div className="picker-search">
      <SearchField value={q} onChange={(value) => { setQ(value); setLimit(40) }} label="Search jobs"
        placeholder="Job, WBS, serial, product, customer…" />
      <span className="picker-tally">{matches.length === jobs.length ? `${jobs.length} jobs` : `${matches.length} of ${jobs.length} jobs`}</span>
    </div>
    {matches.length === 0 ? <p className="picker-empty">{jobs.length ? `No job matches “${q.trim()}”.` : 'No jobs in the register.'}</p> : (
      <ul className="picker-jobs">
        {matches.slice(0, limit).map((j) => {
          const reason = unavailable?.(j)
          return <li key={j.jobNo}>
            <button type="button" className={`picker-job${j.jobNo === current ? ' is-current' : ''}`}
              aria-label={`${j.jobNo} · ${j.productDesc || 'Product not set'} · ${j.customerName || 'Customer not set'} · ${j.arasSN || j.wbsNo || 'Serial / WBS not set'}${reason ? ` · ${reason}` : ''}`}
              disabled={!!reason} onClick={() => onPick(j.jobNo)}>
              <span><strong>{j.jobNo}</strong><small>{j.arasSN || j.wbsNo || 'Serial / WBS not set'}</small></span>
              <span><strong>{j.productDesc || 'Product not set'}</strong><small>{j.customerName || 'Customer not set'}</small>
                {reason && <small className="picker-unavailable">{reason}</small>}
              </span>
            </button>
          </li>
        })}
      </ul>
    )}
    {matches.length > limit && <button type="button" className="btn btn-secondary picker-more" onClick={() => setLimit((n) => n + 40)}>Show more jobs ({matches.length - limit} remaining)</button>}
  </>
}

export default function JobPicker({ title, sub, current, onPick, onClose, onBack }) {
  return <PickerDialog title={title} sub={sub} onClose={onClose} onBack={onBack} step="job">
    <JobChoices current={current} onPick={onPick} />
  </PickerDialog>
}
