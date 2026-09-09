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

**The 46 keyboard-access findings.** Real, counted, and a design change
across a dozen screens.

**Phases 2–5** — inspector work queues, the QA approval inbox, MDR
completeness, the CSS split. These are product, not correctness, and
each is a piece of work in its own right.

---

## What to do next, in order

1. Keyboard access for every `div` acting as a button (46 findings, all
   listed by `npm run lint`).
2. The override history drawer, and the control that sets one.
3. Backup integrity: checksum, manifest, pre-import snapshot, import log.
4. Role-specific home queues (Phase 2 of the audit).
5. Split `src/styles.css` by responsibility, behind screenshot tests.
