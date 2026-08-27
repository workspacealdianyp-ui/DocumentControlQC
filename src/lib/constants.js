// Deliverable columns from JOBLIST (the 9 report types per PRD)
export const DELIVERABLES = [
  { key: 'ITP', label: 'ITP', short: 'ITP', form: null },
  { key: 'Dimension Report', label: 'Dimension Report', short: 'DIM', form: 'dimensional' },
  { key: 'NDE Report', label: 'NDE Report', short: 'NDE', form: 'nde' }, // nde => choose MT/PT/UT
  { key: 'Leak & Hydro Test', label: 'Leak & Hydro Test', short: 'L&H', form: 'hydrotest' },
  { key: 'Painting', label: 'Painting', short: 'PNT', form: 'blasting' },
  { key: 'PTR', label: 'Performance Test (PTR)', short: 'PTR', form: null },
  { key: 'Pre-Shipment', label: 'Pre-Shipment Inspection', short: 'PSI', form: 'visual' },
  { key: 'IRN', label: 'Inspection Release Note', short: 'IRN', form: null },
  { key: 'PDI', label: 'Pre-Delivery Inspection', short: 'PDI', form: 'visual' },
]

export const NDE_FORMS = ['mt', 'pt', 'ut']

// Status tokens per PRD design system
export const STATUS = {
  done: { label: 'Done', cls: 'done' },
  inprogress: { label: 'In Progress', cls: 'inprogress' },
  notstarted: { label: 'Not Started', cls: 'notstarted' },
  overdue: { label: 'Overdue', cls: 'overdue' },
  na: { label: 'N/A', cls: 'na' },
}

export const ROLES = {
  inspector: { label: 'Inspector', canEdit: true, canOverride: false, canManage: false },
  admin: { label: 'Admin / QA Lead', canEdit: true, canOverride: true, canManage: true },
  viewer: { label: 'Management / Viewer', canEdit: false, canOverride: false, canManage: false },
}

// Demo accounts for the front-end-only login (no back-end, no passwords).
export const USERS = [
  { name: 'QA Lead', role: 'admin' },
  { name: 'Inspector One', role: 'inspector' },
  { name: 'Inspector Two', role: 'inspector' },
  { name: 'Management Viewer', role: 'viewer' },
]

export const FORM_CODES = {
  hydrotest: 'LHT',
  blasting: 'BPR',
  mt: 'MT',
  pt: 'PT',
  ut: 'UT',
  visual: 'VG',
  dimensional: 'DIM',
}
