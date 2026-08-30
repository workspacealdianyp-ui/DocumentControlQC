# Implementation Plan: Close the job-order loop

## Overview

A QC head can raise a job order, and an inspector can fill the inspection
forms it asks for. Everything else the order can ask for is a dead end.
Three of the nine deliverables — **ITP**, **PTR (Performance Test)** and
**IRN (Inspection Release Note)** — have `form: null` in
`src/lib/constants.js`. Their row in the job detail is not tappable
(`JobDetail.jsx:140`, `const tappable = !!d.form && …`) and reads
"Document deliverable, tracked manually". There is no way to attach the
signed document, so:

- a job whose order requires an ITP can never honestly reach 100% — the
  only way to mark it done is an admin status override, which records a
  colour and no evidence;
- the Manufacturing Data Report cannot include it, because the book binds
  reports and nothing else;
- the phrase "tracked manually" is the app admitting it does not track it.

The order side has the same shape of hole from the other end.
`getOrders` and `deleteOrder` in `src/lib/jobOrders.js` have no callers:
an order can be created and never listed, corrected or withdrawn. A typo
in a PO number is permanent, and a unit added to the wrong order stays
there.

This plan closes both ends: an attached document becomes a first-class
piece of evidence, and a published order becomes something you can look
at and change.

## Architecture decisions

**An attached document is evidence, not an override.** Every screen in
this app reads job state through one function — `cellStatus(job, key, ctx)`
in `src/lib/status.js` — which layers order-required → admin override →
report → bundled Excel data → overdue. An attached document is a fourth
kind of record and belongs in that layer next to a report, so the
dashboard, monitoring matrix, job progress ring and KPIs all pick it up
from one change rather than nine. Using an override instead would mark
the cell green while recording no document, which is the problem we are
fixing.

**Its own store key, not a report with a null form.** Reusing the report
record would inherit the whole form engine — `values`, `results`,
`formKey`, sheets — for a record that is a file and a signature. It would
also be silently dropped from the data book, which now filters to reports
whose form template exists (`MdrReport.jsx`, `printable`). A separate
`qc.documents` key keeps the report record honest and makes the document
record explicit about what it is: which job, which deliverable, the file,
who attached it, when, and its reference number.

**Images bind into the book; PDFs are registered.** A photograph of a
signed ITP can be printed as an attachment sheet inside the MDR. A PDF
cannot be rasterised into the print DOM by the browser, so it is listed
in the register and the contents with its file name and size, marked as
supplied separately, exactly as an unavailable form template is today.
This is a real limit, not a preference — see Open Questions.

**Intake is shared and bounded.** Attachments make an existing risk
acute: `PhotoStrip` (`FormView.jsx:222`) stores whatever the camera
produced as a base64 data URL, and `write()` in `src/lib/store.js` calls
`localStorage.setItem` with no `try`, so a quota overflow throws mid-save.
One intake helper — downscale, cap, reject what will not fit, report why —
is used by both photos and attachments, and `write()` learns to fail
loudly rather than throw.

**Editing an order may not erase evidence.** An order can drop a report
from its required list only if nothing has been recorded against it. This
is the one rule that keeps `cellStatus`'s first branch (`job.required` →
everything else is N/A) from being able to hide finished work.

## Dependency graph

```
documents.js  (record + store)
    │
    ├── cellStatus  ──────────────► every screen that shows job progress
    │
    ├── fileIntake  ──────────────► PhotoStrip (existing) + attach sheet
    │       │
    │       └── JobDetail attach / view / replace / remove
    │               │
    │               ├── Documents list + Reports register
    │               │
    │               └── MDR: bind images, register PDFs
    │
jobOrders.js (already exists)
    │
    └── Orders screen ──► edit / delete with evidence guard
```

Phase 4 (orders) depends on nothing in phases 1–3 and can be built in
parallel by a second session if wanted; phases 1–3 are a chain.

## Task list

Tasks and checkpoints live in [`todo.md`](./todo.md).

### Phase 1: The record
- [ ] Task 1: The attached-document record and its store
- [ ] Task 2: `cellStatus` counts an attached document as evidence

### Phase 2: Attaching
- [ ] Task 3: Shared file intake — downscale, cap, quota guard
- [ ] Task 4: Manual deliverable rows become actionable

### Checkpoint A: A required ITP can be satisfied

### Phase 3: The loop closes
- [ ] Task 5: Attached documents appear wherever reports do
- [ ] Task 6: The MDR binds and registers attached documents

### Checkpoint B: The book is complete

### Phase 4: Orders are editable
- [ ] Task 7: Orders screen — list and detail
- [ ] Task 8: Edit and withdraw an order, guarded by evidence

### Checkpoint C: Complete

## Definition of Done

This repository has no `references/definition-of-done.md` and no test
runner (`package.json` has `dev`, `build`, `preview` only), so the
standing bar is written out here. Every task clears all of it:

- `npm run build` completes clean.
- The touched routes raise no console errors (font/CDN fetch failures in
  the sandbox do not count).
- No horizontal overflow at 1440 / 820 / 390 px on the touched routes.
- Behaviour checked for all three roles where the change is role-aware:
  admin (QA Lead), inspector, viewer.
- Comments explain why, not what, in the voice of the surrounding code.
- Committed to `main` with a message stating what changed and why.

Per-task acceptance criteria sit on top of this and answer the different
question: did we build the right thing?

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `localStorage` quota (~5 MB) — attachments are stored as base64 and will blow it far faster than reports do | High | Task 3: downscale images on intake, cap file size, guard `write()` so a full store reports instead of throwing, and show the space used in Settings → Storage. A back-end is the real answer (Open Questions). |
| A PDF cannot be inlined into the print DOM, so an MDR containing one is not fully self-contained | Medium | Register it in the contents and the register with its file name, marked supplied separately — the same treatment an unavailable form template already gets. Confirm this is acceptable for a customer-facing book. |
| Editing a published order can retroactively hide finished work, because `cellStatus` treats anything outside `job.required` as N/A | High | Task 8: a report or document already recorded against a deliverable blocks its removal from the required list; the UI says so rather than failing silently. |
| `cellStatus` is read by every screen — a fourth branch touches the dashboard, monitoring matrix, jobs list, KPIs and MDR at once | Medium | One branch in one function, then a route sweep at Checkpoint A that reads the same job through every screen and checks they agree. |
| No test runner, so every guarantee here is verified by hand or by a throwaway script | Medium | Accepted for this scope — the user deferred the test-suite work. Each task names a concrete browser check; the scripts are kept in `scripts/` rather than `/tmp` if they are worth re-running. |
| Attaching is offered to a role that should not have it | Low | Follow `role.canManage` for attaching (as for raising an order) unless Open Questions says otherwise; viewer stays read-only. |

## Open questions

1. **Who may attach a document?** Raising an order is `role.canManage`
   (admin / QA head). Is attaching a signed ITP the same authority, or
   may an inspector attach and an admin approve? Plan assumes
   `canManage` attaches; inspectors and viewers can open and read.
2. **Does an attached document need approving?** Reports go draft →
   submitted → approved. A document is either there or not. Plan assumes
   attaching is the act — no separate approval — but a customer-facing
   data book may want a signature on it.
3. **PDFs in the MDR.** Registered-only, as above, or should the book
   carry a placeholder sheet naming the file so the page count and the
   physical pack still line up?
4. **Withdrawing an order that has work against it.** Delete outright,
   or mark it withdrawn and keep the record? Plan assumes delete is
   blocked once any unit has evidence, offering withdrawal instead —
   confirm.
5. **Where does the file actually live, eventually?** Everything here is
   `localStorage` in one browser. Attachments make that ceiling much
   closer. Worth deciding now whether a back-end is coming, because it
   changes whether Task 1 stores the bytes or a reference.
