/* The readings the register and the pages under it share.

   A figure, a meter, a bar and a ribbon. They were duplicated across the
   customer, order and register screens with small drifts between them —
   the same percentage drawn three ways — so the same number now reads
   the same wherever it is shown.

   The rule they all keep: progress is ink, not colour. Density says how
   much is done, which inverts correctly in the dark and leaves the one
   colour on these screens for the two states that need somebody today —
   past its release date, and a non-conformance. */

/* A single counted fact. Given `href` it becomes a way into the list it
   counts, which is the difference between a number and an answer. */
export function Figure({ value, label, tone, href, sub }) {
  const cls = `fig${tone ? ` fig-${tone}` : ''}${href ? ' fig-link' : ''}`
  const body = (
    <>
      <b>{value}</b>
      <span>{label}</span>
      {sub && <small>{sub}</small>}
    </>
  )
  return href ? <a className={cls} href={href}>{body}</a> : <div className={cls}>{body}</div>
}

/* A bar, not a ring. A ring reads as one unit's progress, and these are
   sums across many; the bar says "this much of the whole" without
   implying it belongs to a single object. */
export function Meter({ done, total, className = '' }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <div className={`meter ${className}`}>
      <div className="meter-top">
        <strong>{pct}<i>%</i></strong>
        <small>{done} of {total} reports</small>
      </div>
      <div className="meter-track" role="img" aria-label={`${pct}% of the reports on this work are done`}>
        <span className={done === total && total ? 'is-done' : ''} style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
    </div>
  )
}

// The same reading at row scale: ink on a hairline, no label of its own.
export function InkBar({ done, total, className = '' }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <span className={`ink-bar ${className}`} role="img" aria-label={`${pct}% done, ${done} of ${total} reports`}>
      <i style={{ width: `${Math.max(2, pct)}%` }} />
    </span>
  )
}

export const Pct = ({ done, total }) => (
  <span className="ink-pct">{total ? Math.round((done / total) * 100) : 0}<i>%</i></span>
)

/* Where a customer's units stand, as one bar.

   A percentage of reports is a fair summary and a poor instruction: 64%
   is the same number whether eight units are half-inspected or six are
   finished and two have never been touched. The ribbon splits the unit
   count into the four states it can be in, so the shape of the work is
   visible before any figure is read — and the segments are labelled
   underneath, so the states are never carried by shade alone.

   Ordered finished → in progress → not started → past release: left to
   right is how much is behind you, and the one segment drawn in colour
   sits at the end where the eye lands last and stays. */
const SEGMENTS = [
  { id: 'done', key: 'complete', label: 'finished' },
  { id: 'work', key: 'inprogress', label: 'in progress' },
  { id: 'idle', key: 'notstarted', label: 'not started' },
  { id: 'late', key: 'overdue', label: 'past release' },
]

export function Ribbon({ mix, ncr = 0, className = '' }) {
  const parts = SEGMENTS.map((s) => ({ ...s, n: mix[s.key] || 0 })).filter((s) => s.n > 0)
  if (!mix.units) return null
  const share = (n) => (n / mix.units) * 100
  return (
    <div className={`ribbon ${className}`}>
      {/* The key underneath states the same counts in words, so the bar
          is decoration to a screen reader rather than a second reading
          of the same fact in different language. */}
      <span className="ribbon-track" aria-hidden="true">
        {parts.map((s) => <i key={s.id} className={`rib-${s.id}`} style={{ width: `${share(s.n)}%` }} />)}
      </span>
      <p className="ribbon-key">
        {parts.map((s) => (
          /* Count and label in one text node so a screen reader reads
             "6 finished" rather than running the two together. */
          <span key={s.id} className={`rib-key rib-${s.id}`}>
            <i aria-hidden="true" /><span><b>{s.n}</b> {s.label}</span>
          </span>
        ))}
        {ncr > 0 && (
          <span className="rib-key rib-ncr"><b>{ncr}</b> non-conformance{ncr === 1 ? '' : 's'}</span>
        )}
      </p>
    </div>
  )
}

/* What the work is waiting on: one line per deliverable still owed, the
   bar showing how much of the whole that document type accounts for.

   Empty is a real answer here and is written as one — a panel that goes
   blank when a customer finishes reads as broken, not as finished. */
export function Outstanding({ rows, units, limit = 5, done, applicable }) {
  if (!rows.length) {
    // An order can ask for no reports at all. Saying "every report is
    // complete" about work that needs none is a different statement, and
    // the wrong one.
    return applicable === 0 ? (
      <p className="wait-clear">
        <b>No reports required.</b> This work asks for no inspection documents.
      </p>
    ) : (
      <p className="wait-clear">
        <b>Nothing outstanding.</b> Every report {units ? `on these ${units} units ` : ''}is complete.
      </p>
    )
  }
  const top = rows.slice(0, limit)
  const most = Math.max(...rows.map((r) => r.units))
  return (
    <>
      <ul className="wait-list">
        {top.map((r) => (
          <li key={r.key} className={r.late ? 'is-late' : undefined}>
            <span className="wait-name">{r.label}</span>
            <span className="wait-track" aria-hidden="true">
              <i style={{ width: `${Math.max(4, (r.units / most) * 100)}%` }} />
            </span>
            <span className="wait-n">{r.units} <small>{r.units === 1 ? 'unit' : 'units'}</small></span>
            {r.late > 0 && <span className="wait-late">{r.late} late</span>}
          </li>
        ))}
      </ul>
      {rows.length > top.length && (
        <p className="wait-more">and {rows.length - top.length} more document type{rows.length - top.length === 1 ? '' : 's'}</p>
      )}
      {done > 0 && <p className="wait-more">{done} report{done === 1 ? '' : 's'} already signed off.</p>}
    </>
  )
}
