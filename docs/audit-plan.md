# Frontend audit — plan and state

Every finding from the audit, what was done about it, and where the code
is. Nothing here is marked done on the strength of an intention: each
one names the test that holds it.

Run the gate with `npm run check` (lint, unit tests, build, bundle
budget) and the browser journeys with `npm run e2e`.

---

## Phase 1 — trust and record safety

### P0 · Evidence could be destroyed

**1. Any report could be deleted, approved ones included.** — **done**

The register offered a bin on every record and `deleteReport` removed
whatever it was given. What may be done now depends on where the report
stands, and the rule lives in one place, `REPORT_ACTIONS` in
`src/lib/store.js`:

| state | action | what happens |
| --- | --- | --- |
| draft, returned, new | delete | it goes; its report number stays spent |
| submitted | withdraw | back to draft, with the reason kept |
| approved | void | kept, marked, stops counting; a new issue supersedes it |
| voided | — | nothing further |

Withdraw and void both require a reason and write an entry to the
report's own `audit` array, which is only ever appended to. Voiding is
refused for the person who wrote the report — the same second-person
rule as approval.

`tests/unit/store.lifecycle.test.js` (13 tests), and the browser journey
proves an approved report survives the action: 154 records before, 154
after, one of them marked void.

**2. The migration deleted reports whose job had gone.** — **done**

`ensureSeed` filtered stored reports against the current job list and
wrote back only the matches. A job number can come back — an order is
re-published, a backup restored, a unit renumbered — and a record
deleted on Tuesday cannot.

Nothing is deleted now. `markOrphans` flags them, `getReports()` keeps
them out of the registers, `getAllReports()` and every backup still
carry them, and Settings → Storage lists them with a control to attach
one to a job (`adoptReport`, which records where it came from). A
snapshot of the store is taken before a migration runs, and each
migration appends to `qc.migrations` with counts.

`tests/unit/store.migration.test.js` (13 tests).

**3. A job order could report success when nothing was saved.** — **done**

`jobOrders.write()` caught every storage error and returned the value as
though it had been written; the screen then said "published — 4 jobs
ready to inspect" and navigated away. It throws `StorageFullError` now,
and `saveOrder` reads the order back before returning — a write the
browser accepts and then does not store (private mode) fails as
`OrderNotSavedError`. The form keeps every entry on screen, names the
failure in place rather than in a toast, and offers the storage panel.

`tests/unit/jobOrders.test.js`, including a mocked `QuotaExceededError`
and a truncated write.

**4. Admin-only fields were not enforced.** — **done**

The engine asked `locked || (f.adminOnly && false)`, which is `locked` —
the second half is a constant. The call site's conditional returned the
same value from both branches. Both are replaced by one exported
`fieldLocked({ field, sectionLocked, role })` in `FormView.jsx`.

No schema uses `adminOnly` today, so nothing was exploitable; the
enforcement simply was not there for the first field that did.
`tests/unit/permissions.test.js` covers all three roles, a locked
section, a missing role, and a role object with the label but not the
right. `no-constant-binary-expression` is an error in the lint config so
this class of defect fails the build.

### P1

**5. "Done" meant submitted or approved.** — **done**

An unsigned document waiting on a reviewer was the same green as one a
QA lead had signed, and everything downstream inherited it. There are
two states now, and `jobProgress` returns both numbers:

- `done` — approved; the releasable count, and what completion is built on
- `awaiting` — recorded and unsigned
- `recorded` — the two together: what the shop has physically inspected

A voided report counts as neither. `tests/unit/status.test.js`.

**6. Overrides had no trace.** — **done**

An override was a status string under a job and deliverable key: no
actor, time, reason, previous value or evidence. `setOverride` now
requires a reason, appends an immutable event
(`from → to`, actor, `createdAt`, `evidenceRef`) to `qc.overrideEvents`,
and clearing one is an event too. `overrideHistory(jobNo, deliverable)`
reads it back.

`tests/unit/overrides.test.js`. **No screen sets an override today** —
the inline matrix edit went with the Monitor page — so this is the rule
waiting for the control, not a history drawer you can open. The drawer
is listed under Phase 3.

**7. Overdue was measured against page-load time.** — **done**

`const TODAY = new Date()` at module scope meant an installed PWA left
open overnight kept measuring against the day it was opened.
`cellStatus`, `jobStatuses` and `jobProgress` take `now` as their last
argument, defaulting to the current time, and compare from the start of
the day — so a unit due today is not overdue until tomorrow.
`tests/unit/status.test.js` walks the boundary.

**8. No automated quality gate.** — **done**

`npm run check` = ESLint, 80 unit tests (Vitest + jsdom), a build, and a
bundle budget. `npm run e2e` drives Chromium through 25 checks: every
route under all three roles at 1440 and 390, the permission boundary,
and the void flow including Escape and the required reason.
`.github/workflows/check.yml` runs all of it on push and pull request.

The lint config is opinionated about the class of defect this app
actually shipped — constant conditions, unused branches, dead names, no
native dialogs — and files the 46 keyboard-access findings as warnings
rather than turning them off. Those are Phase 2.

**9. CSV exports could be read as formulas.** — **done**

Both exporters wrapped values in quotes without doubling embedded ones,
and neither guarded a value starting with `=`, `+`, `-` or `@`. One
utility now: `src/lib/csv.js`, RFC 4180 quoting, a tab in front of a
formula-like value, normalised line endings, a BOM, and an object URL
revoked on a timer rather than in the same tick.
`tests/unit/csv.test.js` round-trips through a strict parser.

**10. Native `window.confirm`.** — **done**

Replaced by `ConfirmDialog`: focus trap, Escape, focus restored to
whatever opened it, a required reason where one is needed, and a typed
word for clearing the browser. The confirm button is never disabled —
pressing it is how you find out the reason is required.

---

## After the audit — what the forms and the book changed

**The dimensional report prints its point map.** — **done**

A dimensional report is letters against numbers, and the letters were
meaningless: the marked drawing lived on paper beside the inspector and
never reached the sheet, so a reader had six measurements and no way to
know where on the unit any of them was taken. The form now asks for the
map, the view it shows and the inspection stage, and the sheet puts the
map above the table at the size a balloon letter can be read at. The
readings run two columns wide underneath, the way the shop's own form
sets them, so twelve dimensions do not leave half a page white.

`tests/unit/print.test.js` holds the sheet counts, the row judgement and
the schema's shape.

**One statement for a data book, or one per report.** — **done**

Every report printed its own Statement of Result. Bound into a book that
is nine of them, one after another, about the same unit, on the same day,
over the same signature — the declaration nine times and the evidence
once. Generate MDR now asks where the declaration is made: a Statement of
Inspection at the front, listing every inspection carried out and
declaring the unit on all of them, or the per-report statement kept as
it prints on its own. Measured on a nine-document book: 23 sheets
against 27.

**A device seeded once and never again.** — **done**

Jobs are read from the bundle on every load; the documents under them
live in the browser's storage and were put there once, on a device's
first visit. So every unit added to the fixture after that was half
invisible: the order appeared in the register with an empty document
list beneath it, and no amount of reloading fixed it. Reported from a
phone as "no document on customer 2".

The fixture now carries a stamp of itself. When the store sees one it
has not taken in, it adds the reports whose ids it has never held and
leaves everything else exactly as it is — a record somebody made, an
edit to a seeded one, a deletion, a void. `tests/unit/store.migration.test.js`
holds all three: the new reports arrive, held work is untouched, and it
runs once per fixture rather than once per read.

**The demo fixture stopped weighing on the bundle.** — **done**

Every picture in the fixture was carried expanded: four signature hands
written out four hundred times, the same drawing paper forty-six times.
`src/data/plates.js` draws them once and the fixture holds the recipe —
which plate, what caption — built when the store seeds, which happens
once on a device. 1.23 MB to 396 KB, with 54 more reports in it than
before.

---

## The whole-app audit — routes, features, permissions, records

Every route the hash parser can produce, driven under all three roles at
1440 and 390, including deliberate nonsense: `<script>` in a path,
`../../etc/passwd`, `"><img onerror>`, `'; DROP TABLE--`, zero-width
characters, empty segments. Five holes, all fixed.

**1. One URL took the whole app down.** — **fixed**

`#/job/<any>/form/<unknown-key>` threw. `FormView` looks up the schema
and guards it with `schema?.` in two places; a third read `schema.code`
inside a `useState` initializer, which runs during the first render — so
the guard that already existed further down the same component was
unreachable. A form key comes off the URL, so a stale bookmark or a
renamed template was enough.

**2. Nothing caught it, and one throw blanked every screen.** — **fixed**

There was no error boundary. React unmounted the tree, the rail and the
bottom bar stayed on screen with every item doing nothing, and only a
manual reload recovered — which nothing on the page said. Measured:
3404 characters on the register, 0 after the bad URL, 0 on each of four
routes after that, 1646 after a reload.

`ErrorBoundary` sits inside `<main>`, whose key already changes with the
route, so walking to any other page remounts it and clears the failure
without a reload at all. It states that saved work is untouched, offers
a reload and a way to the dashboard, and logs to the console — the only
recorder an app with no backend has.
`tests/unit/errorBoundary.test.jsx`.

**3. The storage gauge was wrong by 2×.** — **fixed**

`storage.js` measured against 5 MB. Filling localStorage in Chromium
until it refused took 9.5 MB, so 2.3 MB read as 45% when it was 24%. The
remedy offered beside the gauge is "export and clear records", so
reading high is the direction that costs evidence. 10 MB now, with the
write failing loudly (`StorageFullError`) as the thing that actually
protects a record. `tests/unit/storage.test.js`.

**4. Two overlays a keyboard could not dismiss.** — **fixed**

See the entry above on the lint count.

**5. Four elements drawing nothing on every page.** — **fixed**

`AppBackground` rendered four `.aurora` divs for glassmorphism cards to
blur. There is no glassmorphism in this app and the CSS was
`display: none`.

### What the audit found sound

Not assumed — measured, and worth keeping that way:

- **Permissions.** A viewer reaching an inspection form by direct URL
  gets no editable field, no Submit, no Approve, and no record actions.
  An admin opening their own submitted report is offered no Approve: the
  second-person rule holds even for the role that overrides everything.
- **The records.** 226 of them against seven invariants, zero
  violations: no duplicate report number, no approval without an
  approver, no self-approval, no approved-before-created, no
  non-conforming result without its NCR note.
- **No injection surface.** No `dangerouslySetInnerHTML`, no `eval`, no
  outbound request anywhere in `src/`.
- **Offline works**, and a full backup round trip comes back
  byte-identical.

---

## Not done, and why

**Backup hardening** (checksums, per-record schema validation, a
pre-import snapshot, a conflict review, an import log). The merge rules
are sound and the rollback works; what is missing is verification and
reporting, which is a self-contained piece of work. Orphans are already
carried in the export.

**Route-level code splitting.** The entry bundle is 178 KB gzipped and
under budget; the three.js viewer is already lazy. The budget script
fails the build if either grows, which is the guard the audit wanted.
Splitting the rest is worth doing and is not worth doing in the same
change as the record-safety work.

**The "46 keyboard-access findings" were mostly not that.** — **audited,
and the real ones fixed**

The number came from a lint count and it did not survive being checked.
Driving nine screens and asking what a keyboard can actually reach found
nothing mouse-only: what the rule was flagging is overwhelmingly modal
backdrops (`onClick={onClose}`, whose keyboard equivalent is Escape) and
the `stopPropagation` handler on the box inside them, which is event
plumbing rather than an interaction at all.

Behind them were two real defects, and they are fixed: the Generate MDR
picker and the NDE method picker answered neither Escape nor a screen
reader, because they were built by hand rather than through
ConfirmDialog. Both wear a shared shell now (`src/lib/useDismiss.js`) —
Escape, `aria-modal`, focus into the dialog on open and back to the
opener on close. `tests/unit/errorBoundary.test.jsx` and the browser
checks hold it.

The lint warnings stay on, because the rule cannot tell a backdrop from
a control and the next static `div` with a click handler should still be
questioned.

**Phases 2–5** — inspector work queues, the QA approval inbox, MDR
completeness, the CSS split. These are product, not correctness, and
each is a piece of work in its own right.

---

## What to do next, in order

1. The override history drawer, and the control that sets one.
2. Backup integrity: checksum, manifest, pre-import snapshot, import log.
3. Role-specific home queues (Phase 2 of the audit).
4. Split `src/styles.css` by responsibility, behind screenshot tests.
