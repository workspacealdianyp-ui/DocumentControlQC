// Deliverable columns from JOBLIST (the 9 report types per PRD)
export const DELIVERABLES = [
  { key: 'ITP', label: 'ITP', short: 'ITP', form: 'itp' },
  { key: 'Dimension Report', label: 'Dimension Report', short: 'DIM', form: 'dimensional' },
  { key: 'NDE Report', label: 'NDE Report', short: 'NDE', form: 'nde' }, // nde => choose MT/PT/UT
  { key: 'Leak & Hydro Test', label: 'Leak & Hydro Test', short: 'L&H', form: 'hydrotest' },
  { key: 'Painting', label: 'Painting', short: 'PNT', form: 'blasting' },
  { key: 'PTR', label: 'Performance Test (PTR)', short: 'PTR', form: 'ptr' },
  { key: 'Pre-Shipment', label: 'Pre-Shipment Inspection', short: 'PSI', form: 'visual' },
  { key: 'IRN', label: 'Inspection Release Note', short: 'IRN', form: 'irn' },
  { key: 'PDI', label: 'Pre-Delivery Inspection', short: 'PDI', form: 'visual' },
]

export const NDE_FORMS = ['mt', 'pt', 'ut']

// Status tokens per PRD design system
/* Done means approved.

   It used to mean submitted-or-approved, which put an unsigned document
   waiting on a reviewer in the same green as one a QA lead had signed.
   Everything downstream inherited that: job completion, the dashboard
   percentage, the monitoring matrix, MDR readiness. A number that counts
   unreviewed work as finished is the number a customer is shown.

   So there are two states where there was one, and they answer two
   different questions: the inspection has been recorded, and the
   document has been approved. Only the second is done. */
export const STATUS = {
  done: { label: 'Done', cls: 'done' },
  awaiting: { label: 'Awaiting QA', cls: 'awaiting' },
  voided: { label: 'Voided', cls: 'voided' },
  inprogress: { label: 'In Progress', cls: 'inprogress' },
  notstarted: { label: 'Not Started', cls: 'notstarted' },
  overdue: { label: 'Overdue', cls: 'overdue' },
  na: { label: 'N/A', cls: 'na' },
}

/* The QC chain of command, and the reason it is written down here.

   A report is released by somebody above whoever recorded it. The app
   used to hold one approver and a rule that nobody may approve their own
   work — correct on its own, and between them a record the QA Lead
   recorded could never be released by anybody. `rank` is what settles
   it: an approver has to sit above the author.

   Technician Quality Control records. Quality Engineer and Spv Quality
   Control sit above and release that work; they are one tier, so neither
   releases the other's — that goes up. Dept Head Quality is above them
   both, and being the top of the chain is the one who may release their
   own: there is nobody left to ask, and a record that can never be
   approved is worse than one signed by the person answerable for it.

   The keys are unchanged on purpose. A session saved in somebody's
   browser carries a role key, and renaming `inspector` or `admin` would
   sign out every device holding one. What changed is what they are
   called and where they stand. */
export const ROLES = {
  viewer:     { label: 'Management / Viewer',        rank: 0, canEdit: false, canOverride: false, canManage: false },
  inspector:  { label: 'Technician Quality Control', rank: 1, canEdit: true,  canOverride: false, canManage: false },
  engineer:   { label: 'Quality Engineer',           rank: 2, canEdit: true,  canOverride: true,  canManage: false },
  supervisor: { label: 'Spv Quality Control',        rank: 2, canEdit: true,  canOverride: true,  canManage: true },
  admin:      { label: 'Dept Head Quality',          rank: 3, canEdit: true,  canOverride: true,  canManage: true },
}

// The top of the chain, read off the roles rather than written twice.
export const TOP_RANK = Math.max(...Object.values(ROLES).map((r) => r.rank))

// Demo accounts for the front-end-only login (no back-end, no passwords).
// The three original names stay: they are the recorded author or approver
// on every seeded document, and renaming them would orphan the lot.
export const USERS = [
  { name: 'QA Lead', role: 'admin' },
  { name: 'QC Supervisor', role: 'supervisor' },
  { name: 'Quality Engineer', role: 'engineer' },
  { name: 'Inspector One', role: 'inspector' },
  { name: 'Inspector Two', role: 'inspector' },
  { name: 'Management Viewer', role: 'viewer' },
]

/* Where a person stands, by the name a report records.

   A document carries the name of whoever recorded it, not their role, so
   the rank is looked up. A name that is not on the roster — imported
   records, somebody who has left — is read as a technician: the lowest
   rank, so their work still needs somebody above to release it, which is
   the safe way to be wrong. */
const sameName = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase()
export const rankOfName = (name) => {
  const user = USERS.find((u) => sameName(u.name, name))
  return user ? ROLES[user.role].rank : ROLES.inspector.rank
}

export const FORM_CODES = {
  hydrotest: 'LHT',
  blasting: 'BPR',
  mt: 'MT',
  pt: 'PT',
  ut: 'UT',
  visual: 'VG',
  dimensional: 'DIM',
}
