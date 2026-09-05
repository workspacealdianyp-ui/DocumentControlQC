import { IconBack } from './Icons.jsx'

/* The page's masthead.

   There used to be three headings stacked on a report: the top bar named
   it, a back link under it named it again, and a hero under that named
   it a third time. Now the top bar says where you are and this band says
   what the thing is, once, with the way back folded into it.

   The band is the document's plate: a mark cut into a poured stone
   ground, the way a shop stencils a code onto the thing it belongs to.
   The stone is drawn in src/assets/marble-*.svg, one per theme, so the
   type on it keeps its contrast when the lights go out.

   `mark` takes anything — a three-letter code, a progress ring — and
   sits where the scrim is fully opaque, so it never has to fight the
   pour for contrast. */

export default function Masthead({ mark, code, eyebrow, title, sub, onBack, backLabel = 'Back', wide = false, variant, children }) {
  return (
    <header className={`masthead${variant ? ` is-${variant}` : ''}`}>
      <div className="masthead-stone" aria-hidden="true" />
      <div className="masthead-inner">
        {onBack && (
          <button type="button" className="masthead-back" onClick={onBack} aria-label={backLabel} title={backLabel}>
            <IconBack size={16} />
          </button>
        )}

        {mark
          ? <span className={`masthead-mark is-free${wide ? ' is-wide' : ''}`}>{mark}</span>
          : code ? <span className="masthead-mark" aria-hidden="true">{code}</span> : null}

        <div className="masthead-txt">
          {eyebrow && <span className="masthead-eyebrow">{eyebrow}</span>}
          <h2>{title}</h2>
          {sub && <span className="masthead-id">{sub}</span>}
        </div>

        {children && <div className="masthead-side">{children}</div>}
      </div>
    </header>
  )
}
