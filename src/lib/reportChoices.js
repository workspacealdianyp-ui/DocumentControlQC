import { FORM_SCHEMAS } from '../data/formSchemas.js'
import { jobStatuses } from './status.js'
import { currentIssues } from './verdict.js'

export const REPORT_CHOICES = [
  { id: 'hydrotest', group: 'Inspection', key: 'hydrotest', label: 'Leak & Hydro Test', deliverable: 'Leak & Hydro Test' },
  { id: 'blasting', group: 'Inspection', key: 'blasting', label: 'Blasting & Painting', deliverable: 'Painting' },
  { id: 'dimensional', group: 'Inspection', key: 'dimensional', label: 'Dimensional Inspection', deliverable: 'Dimension Report' },
  { id: 'mt', group: 'NDE', key: 'mt', label: 'Magnetic Particle Test', deliverable: 'NDE Report' },
  { id: 'pt', group: 'NDE', key: 'pt', label: 'Liquid Penetrant Test', deliverable: 'NDE Report' },
  { id: 'ut', group: 'NDE', key: 'ut', label: 'Ultrasonic Test', deliverable: 'NDE Report' },
  { id: 'visual', group: 'Final inspection', key: 'visual', label: 'Pre-Shipment Inspection', deliverable: 'Pre-Shipment' },
  { id: 'pdi', group: 'Final inspection', key: 'visual', label: 'Pre-Delivery Inspection (PDI)', deliverable: 'PDI' },
  { id: 'itp', group: 'Document record', key: 'itp', label: 'Inspection & Test Plan', deliverable: 'ITP' },
  { id: 'ptr', group: 'Document record', key: 'ptr', label: 'Performance Test', deliverable: 'PTR' },
  { id: 'irn', group: 'Document record', key: 'irn', label: 'Inspection Release Note', deliverable: 'IRN' },
]

export const reportCode = (choice) => choice.id === 'pdi' ? 'PDI' : FORM_SCHEMAS[choice.key]?.code || choice.id

export function canStartFor(job, choice, ctx) {
  if (!job || !choice) return false
  const state = jobStatuses(job, ctx)[choice.deliverable]?.status
  return !!state && state !== 'na'
}

export function existingFor(reports, jobNo, choice) {
  // Use the existing amendment controls instead of quietly minting a duplicate.
  return currentIssues(reports.filter((r) => String(r.jobNo) === String(jobNo)
    && r.formKey === choice.key && r.deliverable === choice.deliverable))
    .find((r) => r.status !== 'voided') || null
}
