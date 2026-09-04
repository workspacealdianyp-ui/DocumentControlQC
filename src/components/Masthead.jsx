import { IconBack } from './Icons.jsx'

/* The document's masthead.

   There used to be three headings stacked here: the top bar named the
   report, a back link under it named the report again, and a hero under
   that named it a third time. Three lines, one fact. Now the top bar
   says where you are — the job — and this band says what the document
   is, once, with the way back folded into it.

   The band is the report's plate: the form code cut into a poured stone
   ground, the way a shop stencils a code onto the thing it belongs to.
   The stone is drawn in src/assets/marble-*.svg, one per theme, so the
   type on it keeps its contrast when the lights go out. */

export default function Masthead({ schema, reportId, deliverable, job, onBack, backLabel = 'Back to job', children }) {
  return (
    <header className="masthead">
      <div className="masthead-stone" aria-hidden="true" />
      <div className="masthead-inner">
        <button type="button" className="masthead-back" onClick={onBack} aria-label={backLabel} title={backLabel}>
          <IconBack size={16} />
        </button>

        {/* The signature: the form code, stencilled. It is the one thing
            on this band set large, so everything else can stay quiet. */}
        <span className="masthead-mark" aria-hidden="true">{schema.code}</span>

        <div className="masthead-txt">
          <span className="masthead-eyebrow">{deliverable}{job ? <> · Job {job.jobNo}</> : null}</span>
          <h2>{schema.title}</h2>
          <span className="masthead-id">{reportId}{job?.productDesc ? <> · {job.productDesc}</> : null}</span>
        </div>

        <div className="masthead-side">{children}</div>
      </div>
    </header>
  )
}
