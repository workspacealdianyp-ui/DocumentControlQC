import { STATUS } from '../lib/constants.js'
import { STATUS_ICONS } from './Icons.jsx'

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
