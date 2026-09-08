import { IconBack } from './Icons.jsx'

/* The page's masthead.

   There used to be three headings stacked on a report: the top bar named
   it, a back link under it named it again, and a hero under that named
   it a third time. Now the top bar says where you are and this band says
   what the thing is, once, with the way back folded into it.

   The band is the document's plate: a mark set on a machined ground,
   the way a shop stencils a code onto the thing it belongs to. The
   ground is drawn in src/assets/banner-*.svg, one per theme, so the
   type on it keeps its contrast when the lights go out.

   `mark` takes anything — a three-letter code, a progress ring — and
   sits where the scrim is fully opaque, so it never has to fight the
   ground for contrast.

   Two slots, and the difference between them is what the thing in them
   is for. `reading` is a measurement of the record the band names — how
   much of it is signed off — so it sits under the title, in the column
   the title is read in, the way a figure sits under the heading it
   belongs to. `children` is the far-right slot for state and actions:
   a status badge, a PDF button. Putting a measurement out there made it
   read as another control. */

export default function Masthead({ mark, code, eyebrow, title, sub, onBack, backLabel = 'Back',
                                  wide = false, variant, art, reading, children }) {
  return (
    <header className={`masthead${variant ? ` is-${variant}` : ''}${art ? ' has-art' : ''}`}>
      <div className="masthead-plate" aria-hidden="true" />

      {/* Decoration, and marked as such. The band already names the
          customer, the job and the product in words, so a screen reader
          that announced the photograph too would be reading the same
          fact twice — and the picture is the one version of it that can
          be wrong. See src/lib/productArt.js. */}
      {art && <img className="masthead-art" src={art} alt="" aria-hidden="true" />}

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
          {(reading || sub) && (
            <div className="masthead-read">
              {reading}
              {sub && <span className="masthead-id">{sub}</span>}
            </div>
          )}
        </div>

        {children && <div className="masthead-side">{children}</div>}
      </div>
    </header>
  )
}
