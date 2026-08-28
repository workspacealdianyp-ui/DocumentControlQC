import { STATUS } from '../lib/constants.js'
import { STATUS_ICONS, STATE_META } from './Icons.jsx'

export default function StatusChip({ status, compact = false, title }) {
  const meta = STATUS[status] || STATUS.notstarted
  const Icon = STATUS_ICONS[status] || STATUS_ICONS.notstarted
  return (
    <span
      className={`chip chip-${meta.cls}${compact ? ' chip-compact' : ''}`}
      title={title || meta.label}
      role="status"
      aria-label={meta.label}
    >
      <Icon size={compact ? 11 : 13} />
      {!compact && <span>{meta.label}</span>}
    </span>
  )
}

/* The document's own lifecycle, as opposed to a deliverable's status.
   Same badge shape so the two read as one family, different glyphs
   because they answer different questions. */
export function StateBadge({ status, compact = false }) {
  const meta = STATE_META[status] || STATE_META.draft
  const Icon = meta.icon
  return (
    <span className={`report-state state-${status}`} role="status" aria-label={meta.label} title={meta.label}>
      <Icon size={compact ? 11 : 13} />
      {!compact && <span>{meta.label}</span>}
    </span>
  )
}
