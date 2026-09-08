import { navigate } from '../App.jsx'
import { IconChevronR } from './Icons.jsx'

/* The units, unfinished first.

   One list, drawn the same on an order page and on a customer page, so a
   unit looks the same wherever it is found. The order page identifies a
   unit by its job and WBS; the customer page has to say which order it
   belongs to as well, because that is the thing two of their units do
   not share.

   State is named in words and drawn in a tone, never in a tone alone. */
export default function UnitList({ rows, showPo = false, className = '' }) {
  return (
    <div className={`unit-list po-units ${className}`}>
      {rows.map((r) => (
        <button key={r.job.jobNo} className={`unit-row${r.complete ? ' is-done' : ''}`}
          onClick={() => navigate(`/job/${r.job.jobNo}`)}>
          <span className="unit-id">
            <strong>{r.job.unitNo || r.job.arasSN || r.job.jobNo}</strong>
            <small>
              {showPo && r.job.poNo ? `${r.job.poNo} · ` : ''}
              Job {r.job.jobNo}{r.job.wbsNo ? ` · ${r.job.wbsNo}` : ''}
            </small>
          </span>
          <span className="unit-state">
            {r.complete
              ? <i className="u-done">Finished</i>
              : r.overdue
                ? <i className="u-late">Past release</i>
                : r.done ? <i className="u-work">In progress</i> : <i className="u-idle">Not started</i>}
            {r.ncr > 0 && <i className="u-ncr">NCR {r.ncr}</i>}
          </span>
          <span className="unit-count">{r.done}/{r.applicable}</span>
          <span className="unit-bar" aria-label={`${r.pct}% done`}>
            <i className={r.complete ? 'is-done' : ''} style={{ width: `${Math.max(2, r.pct)}%` }} />
          </span>
          <span className="unit-go" aria-hidden="true"><IconChevronR size={16} /></span>
        </button>
      ))}
    </div>
  )
}
