import { useEffect, useRef, useState } from 'react'

/* How much of this job is signed off.

   Drawn as a dial rather than a donut, because a donut is a chart and
   this trade reads instruments: the people opening this screen spend
   their day on pressure gauges, Barton recorders and lightmeters. So it
   takes their conventions — a fine track, ticks cut at the quarters, and
   a value arc with a square end, since no needle on a real instrument
   is rounded off.

   It settles rather than appears. The arc sweeps from zero and the
   figure counts with it, which is what a gauge does when the line is
   opened, and it is the only thing on this plate that moves. */

const R = 34
const C = 2 * Math.PI * R
const TICKS = [0, 90, 180, 270]

export default function CompletionDial({ done, total, size = 88 }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  const [shown, setShown] = useState(() => (prefersStill() ? pct : 0))
  const raf = useRef(0)

  useEffect(() => {
    if (prefersStill()) { setShown(pct); return }
    const from = 0, span = 900, t0 = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / span)
      // Decelerating: fast off the stop, easing into the reading.
      const e = 1 - Math.pow(1 - t, 3)
      setShown(Math.round(from + (pct - from) * e))
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [pct])

  const full = pct >= 100
  return (
    <div className={`dial${full ? ' is-full' : ''}`} style={{ width: size, height: size }}
      role="img" aria-label={`${pct}% of the required reports are done — ${done} of ${total}`}>
      <svg viewBox="0 0 80 80" width={size} height={size} aria-hidden="true">
        <g transform="rotate(-90 40 40)">
          <circle className="dial-track" cx="40" cy="40" r={R} fill="none" strokeWidth="3" />
          <circle className="dial-value" cx="40" cy="40" r={R} fill="none" strokeWidth="3"
            strokeLinecap="butt" strokeDasharray={C}
            strokeDashoffset={C * (1 - shown / 100)} />
        </g>
        {/* Quarters, cut into the track rather than drawn over it, so the
            dial reads as one machined part. */}
        {TICKS.map((deg) => (
          <line key={deg} className="dial-tick" x1="40" y1="3.5" x2="40" y2="8"
            transform={`rotate(${deg} 40 40)`} strokeWidth="2" strokeLinecap="round" />
        ))}
      </svg>
      <span className="dial-read">
        <strong>{shown}</strong><small>%</small>
      </span>
    </div>
  )
}

const prefersStill = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
