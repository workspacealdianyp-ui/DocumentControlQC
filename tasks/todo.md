# Tasks: Close the job-order loop

Plan and rationale: [`plan.md`](./plan.md). Every task also clears the
project Definition of Done recorded there.

There is no `npm test` in this repository. "Verification" below means the
build plus the named check driven in a real browser (Chromium is at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, Playwright is
configured), against `npm run build && npx vite preview --port 4178`.

---

## Phase 1: The record

### Task 1: The attached-document record and its store

**Description:** Add `src/lib/documents.js` — the record for a document
that was signed on paper and attached, rather than filled in the app: which
job and deliverable it belongs to, the file (name, type, size, data URL),
a reference number, who attached it and when. Store it under a new
`qc.documents` key with the same read/merge/guard shape as
`src/lib/jobOrders.js`. No screen uses it yet.

**Acceptance criteria:**
- [ ] `getDocuments()`, `documentsFor(jobNo, deliverable?)`, `saveDocument(doc)`, `deleteDocument(id)` exported; save replaces by `id` and stamps `updatedAt`.
- [ ] A malformed or absent `qc.documents` reads as `[]` rather than throwing (private mode included).
- [ ] `nextDocumentId(jobNo, deliverable)` produces a reference in the house format (`MFG/ITP/1000200002/01`), counting existing documents the way `nextReportId` counts reports.

**Verification:**
- [ ] Build succeeds: `npm run build`
- [ ] Manual check: in the console, save two documents against one job and read them back after a reload; delete one and confirm the other survives.

**Dependencies:** None

**Files likely touched:**
- `src/lib/documents.js`

**Estimated scope:** Small (1 file)

---

### Task 2: `cellStatus` counts an attached document as evidence

**Description:** Teach `cellStatus` in `src/lib/status.js` that a
deliverable with a document attached is done. It goes below the admin
override and beside the report branch — an override still wins, because
an override is a deliberate human statement — and it must carry its
source so a screen can say *what* satisfied the cell. `buildContext()`
gains a document index alongside `reportIndex`.

**Acceptance criteria:**
- [ ] A deliverable with an attached document reports `{ status: 'done', source: 'document', document }`.
- [ ] Order-required and admin-override branches still take precedence, in that order.
- [ ] `jobProgress`, `computeKpis` and the monitoring matrix pick it up with no change of their own — the ring, the counts and the matrix cell all move together.

**Verification:**
- [ ] Build succeeds: `npm run build`
- [ ] Manual check: seed one document for a job requiring ITP; the job detail ring, the jobs list "Reports" column, the monitoring cell and the dashboard KPI all count it, and all four agree.

**Dependencies:** Task 1

**Files likely touched:**
- `src/lib/status.js`

**Estimated scope:** Small (1 file)

---

## Phase 2: Attaching

### Task 3: Shared file intake — downscale, cap, quota guard

**Description:** One helper for taking a file from a user, used by the new
attach flow and by the existing `PhotoStrip` in `FormView.jsx:222`, which
currently stores whatever the camera produced at full size. Downscale
images to a sane long edge, cap the accepted size, and make
`write()` in `src/lib/store.js` fail loudly instead of throwing: it calls
`localStorage.setItem` with no `try`, so a full store currently breaks a
save mid-flight.

**Acceptance criteria:**
- [ ] `readFile(file)` returns `{ name, type, size, dataUrl }`, downscaling images past a long-edge limit and re-encoding them, leaving non-images untouched.
- [ ] A file that cannot be stored is refused with a reason the user can act on ("PDF is 8.4 MB; the limit is 4 MB"), not a thrown error.
- [ ] `write()` reports a full store to the caller; a save that cannot complete tells the user rather than appearing to succeed.
- [ ] `PhotoStrip` uses the same helper — a 4 MB phone photo lands smaller than it does today.

**Verification:**
- [ ] Build succeeds: `npm run build`
- [ ] Manual check: attach a large photo to an inspection report and compare the stored `qc.reports` size before and after; then fill the store deliberately and confirm the save reports the failure instead of throwing.

**Dependencies:** None (parallel with Tasks 1–2)

**Files likely touched:**
- `src/lib/fileIntake.js`
- `src/lib/store.js`
- `src/components/FormView.jsx`

**Estimated scope:** Small–Medium (3 files)

---

### Task 4: Manual deliverable rows become actionable

**Description:** In `JobDetail.jsx`, a deliverable with no form
(`ITP`, `PTR`, `IRN`) currently renders as a dead `div` reading "Document
deliverable, tracked manually" (`JobDetail.jsx:140–155`). It becomes a
row you can open, leading to a sheet that attaches the signed document,
shows what is attached, and lets it be replaced or removed. The row's
sub-line names the attached file instead of the apology.

**Acceptance criteria:**
- [ ] A no-form deliverable the order requires is tappable and opens an attach sheet; attaching turns the row Done with the file name, reference and date on it.
- [ ] The attached document can be viewed full-size (image) or downloaded (PDF), replaced, and removed; removing returns the row to Not started.
- [ ] Permission follows the answer to Open Question 1 (plan assumes `role.canManage` attaches; everyone else opens and reads).
- [ ] Nothing about the form-backed deliverables changes.

**Verification:**
- [ ] Build succeeds: `npm run build`
- [ ] Manual check: on a job whose order requires ITP, attach a photo as QA Lead, confirm the ring moves; reload as inspector and confirm it can be opened but not changed.

**Dependencies:** Tasks 1, 2, 3

**Files likely touched:**
- `src/components/JobDetail.jsx`
- `src/components/DocumentSheet.jsx`
- `src/styles.css`

**Estimated scope:** Medium (3 files)

---

## Checkpoint A: A required ITP can be satisfied

- [ ] `npm run build` clean; no console errors on `/jobs`, `/job/:no`, `/monitoring`, `/reports`, `/`
- [ ] No horizontal overflow at 1440 / 820 / 390 px on those routes
- [ ] One job carrying an attached ITP reads the same in the job ring, the jobs list, the monitoring matrix and the dashboard KPI
- [ ] The three roles behave as intended on the attach sheet
- [ ] Review with human before proceeding

---

## Phase 3: The loop closes

### Task 5: Attached documents appear wherever reports do

**Description:** The job's Documents list and the Reports register both
read `getReports()` and so show nothing for an attached document, even
though it is one of the job's documents. Both learn to include them,
marked as attached rather than filled, with the search, filter and
grouping in `RegisterBar` treating them as first-class rows.

**Acceptance criteria:**
- [ ] The job's Documents section lists attached documents alongside reports, sorted by the same date rule, badged so the two kinds are distinguishable at a glance.
- [ ] The Reports register lists them, and search / filter / group behave (an attached ITP is findable by job number, deliverable and file name).
- [ ] Opening an attached row opens the document, not a form.

**Verification:**
- [ ] Build succeeds: `npm run build`
- [ ] Manual check: with one attached ITP and six reports on a job, both registers show seven rows; filtering by deliverable finds the ITP; opening it shows the file.

**Dependencies:** Task 4

**Files likely touched:**
- `src/components/JobDetail.jsx`
- `src/components/Reports.jsx`
- `src/lib/documents.js`

**Estimated scope:** Medium (3 files)

---

### Task 6: The MDR binds and registers attached documents

**Description:** The data book currently binds reports only. An attached
document belongs in it: an image as a printed attachment sheet behind its
own section tab, a PDF as a register entry marked supplied separately —
the treatment `MdrReport.jsx` already gives a report whose form template
is unavailable. The picker offers them for selection.

**Acceptance criteria:**
- [ ] The MDR picker lists attached documents; selecting one includes it.
- [ ] An attached image prints as a full attachment sheet with the section tab, the job identity block and its reference — one sheet, one page, like every other sheet.
- [ ] An attached PDF appears in the contents and the register with its file name, no page number, and the note that it is supplied separately.
- [ ] The contents page still names the page each section actually starts on, and the claimed page total still equals the printed PDF's page count.

**Verification:**
- [ ] Build succeeds: `npm run build`
- [ ] Manual check: generate a book containing an image attachment and a PDF attachment, print it to PDF, and confirm claimed pages == PDF pages and every section tab lands on the page the contents names.

**Dependencies:** Task 5

**Files likely touched:**
- `src/components/MdrReport.jsx`
- `src/components/PrintReport.jsx`
- `src/components/JobDetail.jsx`
- `src/styles.css`

**Estimated scope:** Medium (4 files)

---

## Checkpoint B: The book is complete

- [ ] A job whose order requires ITP, PTR and IRN can reach 100% with evidence behind every row
- [ ] Its MDR contains or accounts for every one of them
- [ ] Claimed page count equals printed page count for a book with attachments
- [ ] `npm run build` clean, no console errors, no overflow at the three widths
- [ ] Review with human before proceeding

---

## Phase 4: Orders are editable

### Task 7: Orders screen — list and detail

**Description:** `getOrders()` has no caller, so a published order cannot
be seen again. Add a screen that lists them — PO number, customer, units,
required reports, when and by whom — and opens one to show its units and
their live progress. Route and sidebar entry alongside Jobs.

**Acceptance criteria:**
- [ ] `#/orders` lists every published order, newest first, with unit count and how many of its units are complete.
- [ ] Opening an order shows its units, each linking to that unit's job, and the reports the order requires.
- [ ] Visible to `role.canManage`; the entry is not offered to roles that cannot use it.
- [ ] Empty state explains how an order comes to exist.

**Verification:**
- [ ] Build succeeds: `npm run build`
- [ ] Manual check: publish an order of three units, find it in the list, open it, and reach one of its jobs from there.

**Dependencies:** None (parallel with Phases 1–3)

**Files likely touched:**
- `src/components/Orders.jsx`
- `src/App.jsx`
- `src/components/Sidebar.jsx`
- `src/styles.css`

**Estimated scope:** Medium (4 files)

---

### Task 8: Edit and withdraw an order, guarded by evidence

**Description:** Let a published order be corrected — PO details, units,
required reports — by reusing the `NewJobOrder` screen in an edit mode,
and let one be withdrawn. The guard is the point: `cellStatus` treats
anything outside `job.required` as N/A, so removing a required report
would hide finished work. Removing a report that already has a report or
document against it is refused and says why; the same rule governs
removing a unit and deleting the order.

**Acceptance criteria:**
- [ ] An order opens for edit with its values populated; saving updates it in place, and its units' jobs follow (`orderJobs` re-derives).
- [ ] A required report with evidence recorded against any unit cannot be removed; the UI names the unit and the evidence rather than silently refusing.
- [ ] A unit with evidence cannot be removed; an order with any evidence cannot be deleted — per Open Question 4, offer withdrawal instead.
- [ ] A job number edited to collide with an existing job is rejected, as at creation (`takenJobNos`).

**Verification:**
- [ ] Build succeeds: `npm run build`
- [ ] Manual check: publish an order, submit a report against unit 1, then try to remove that report from the order's required list, remove unit 1, and delete the order — all three refuse with a reason; correcting the PO number succeeds and shows through on the unit's job.

**Dependencies:** Task 7 (and Task 2, for what counts as evidence)

**Files likely touched:**
- `src/components/NewJobOrder.jsx`
- `src/components/Orders.jsx`
- `src/lib/jobOrders.js`
- `src/App.jsx`

**Estimated scope:** Medium (4 files)

---

## Checkpoint C: Complete

- [ ] Every acceptance criterion above met
- [ ] An order can be raised, corrected, worked against, and delivered as an MDR without touching an admin override to fake a green cell
- [ ] Full route sweep at 1440 / 820 / 390 px: no overflow, no console errors
- [ ] Open Questions 1–5 in `plan.md` answered, and the plan updated where an answer changed the design
- [ ] Ready for review
