# DocumentControlQC — Home screen design

**Direction:** QC Workbench  
**Status:** Proposed design specification; application changes are not implemented.  
**Prepared:** 9 September 2026  
**Source baseline:** [`main` at `0b3e3a0`](https://github.com/workspacealdianyp-ui/DocumentControlQC/commit/0b3e3a0c113ec9701070e92a9e39dc10069759b2)

> Put the job that needs a decision where the eye lands first. Make the next action clear, keep the evidence one step away, and make every number explainable.

## 1. The experience to build

The home screen should feel like a carefully arranged inspection desk: clear job identities, a short list of work needing attention, documents ready to continue, and an accurate view of customer progress. Its character comes from graphite typography, disciplined alignment, warm-white surfaces, and a deliberate safety-orange accent.

The memorable design decision is to give the **attention register** the dominant area currently occupied by the rotating unit showcase. A connected row of four readings sits above it; a narrower action column sits beside it. The screen has a clear silhouette and a clear purpose.

Within a few seconds, a person should be able to answer:

1. Which jobs need attention, and why?
2. Which report should I continue or review?
3. How much required documentation is complete?
4. Where do I start the next inspection record?

These are design targets to validate during implementation, not measured improvements.

### Users and assumptions

| User | Primary need | Home-screen emphasis |
|---|---|---|
| Inspector | Record accurate results and finish interrupted work | New report; own returned reports and drafts |
| Admin / QA Lead | Identify documentation gaps and review submitted records | Attention register; QA review queue |
| Management / Viewer | Understand progress and examine supporting records | Attention register; customer progress; read-only destinations |

Assume mixed desktop, tablet, and phone use, including time-pressured shop-floor work. Preserve the existing English interface, React/Vite stack, hash navigation, role rules, report evidence, and printing behavior. The current application stores records in the browser; this design does not imply a shared live service or cloud synchronization.

### Scope

This document specifies the home screen, the report picker opened from it, and the smallest destination-filter corrections needed for truthful navigation. It does not redesign inspection forms, approvals, Monitoring, the sidebar, or the bottom navigation. Changes to shared logic are limited to named consistency issues and must preserve the underlying record.

## 2. What the repository actually contains

This assessment comes from source inspection. The current application was not run or visually tested for this documentation task. Layout observations refer to JSX and CSS rules; implementation must confirm the rendered result.

| Current element or behavior | Source evidence | Design decision |
|---|---|---|
| Unit Spotlight occupies four of six desktop grid columns and two rows | `Home.jsx`, home section of `styles.css` | Replace its prominent space with the attention register |
| Featured job changes every 5.2 seconds | `Home.jsx`, `setInterval` | Keep operational content stationary while it is being read |
| Product descriptions map to four generic 3D archetypes, with a pressure-vessel fallback | `Home.jsx`, `unitKind` | Do not imply that a generic model represents a particular bucket, water truck, or unit |
| “Needs attention” appears after the showcase and report shortcuts | `Home.jsx` | Bring it into the first useful viewport |
| “Active jobs” uses essentially the full jobs count | `Home.jsx`, `metrics` | Count unfinished applicable jobs and label the result “Open jobs” |
| “Reports complete” counts job-deliverable cells, including admin overrides | `Home.jsx`, `cellStatus` | Label it “Deliverables complete”; show numerator, denominator, and override context |
| A 75% threshold produces “on track” without schedule evidence | `Home.jsx`, `pctDone` | Remove the unsupported interpretation |
| “In progress” merges draft/in-progress cells with awaiting-QA cells, then opens the Draft report tab | `Home.jsx` | Make the headline review metric a count of submitted report records matching its destination |
| “My documents” calls unscoped `docStats()` | `Home.jsx`, `status.js` | Rename the global section “Report register”; reserve “My” for genuinely personal records |
| Personal continuation shows drafts only | `Home.jsx`, `myDrafts` | Include the signed-in inspector’s returned reports before drafts |
| The home picker lists seven forms | `Home.jsx`, `FORM_ORDER` | Make the existing ITP, PTR, and IRN record forms discoverable too |
| The Visual form defaults to `Pre-Shipment`, while PDI also uses that form | `formSchemas.js`, `constants.js` | Carry an explicit deliverable choice so a PDI report is filed under PDI |
| QC Dashboard, NCR List, and QC Site point to `#` | `Home.jsx`, `QUICK_LINKS` | Hide unconfigured external links; retain configured destinations as quiet utility links |
| NCR totals are derived from current report issues with a Reject verdict | `ncrReports()`, `currentIssues()` | Call them “NCR reports”; do not imply one report equals one finding or a formal CAPA case |
| Recent activity is the latest state of each recently updated report | `recentActivity()` | Label it “Recent updates”; do not present it as an audit event history |

The existing flat palette is a strength. Although some old CSS comments still mention glassmorphism, the active glass tokens resolve to flat surfaces and blur is disabled. Build on the actual cascade instead of reintroducing retired effects.

`tasks/plan.md` is historical context: it still describes ITP/PTR/IRN forms and test infrastructure as missing. The current schemas and `package.json` show they exist. Use the source baseline above when implementing this design.

## 3. Information architecture and layout

### Desktop: 1440 px reference

Retain the existing 232 px sidebar and 60 px top bar. With the current 26 px horizontal content padding, a 1440 px window provides approximately **1156 px** of usable content. Use a 16 px gutter and a two-column body: approximately **760 px for work** and **380 px for actions**.

| Vertical position | Main area | Supporting area | Sizing intent |
|---|---|---|---|
| Existing top bar | Dashboard, existing search and profile controls | Existing utilities | Preserve shell |
| Compact action row | Greeting and local date | One role-specific primary action; one secondary action | About 52–64 px, allowed to wrap |
| Full-width readings strip | Open jobs · Deliverables complete · Awaiting QA · Overdue jobs | — | Four equal segments; about 104–120 px |
| Primary work row | **Needs attention**: filter counts and up to five job rows | **Your work / QA review / Overview** depending on role | Content-led height; roughly 380–440 px with five normal rows |
| Second work row | **Customer progress**: up to four customers | **Report register**: compact lifecycle totals | Roughly 240–300 px; no forced empty height |
| Full width | **Recent updates**: up to six records | — | Compact rows; follows operational work |
| Footer, only when configured | QC Dashboard · NCR List · QC Site | — | Quiet utility links |

At 1440 × 900, normal content should show the action row, all four readings, the attention list, and the main role-specific action panel without scrolling. At shorter heights, the first attention rows remain visible; do not shrink text to force the entire dashboard into view.

### Reading order

Use this DOM order: action row → readings → attention register → role panel → customer progress → report register → recent updates → configured links. The desktop grid may place neighboring sections side by side, but keyboard and screen-reader order must remain coherent. Avoid masonry, CSS columns, and arbitrary visual reordering.

### Tablet: 820 px reference

Use the existing bottom navigation and hide the desktop sidebar at the existing 1024 px shell breakpoint. Show the readings as a 2 × 2 strip, then stack attention, the role panel, customers, report totals, and recent updates. The role panel may arrange its internal shortcuts in two columns; the attention list keeps all meaningful identity fields.

### Phone: 390 px reference

Use a single column with approximately 14–16 px side padding. Keep the primary action visible in the compact action row and use two columns for the four readings. Each attention item becomes a structured card with:

1. Job number and explicit attention reason.
2. Product description and customer, allowed to wrap.
3. Target date and the specific outstanding deliverables.
4. A visible “Open job” destination.

Show the first three attention rows and a “View all” control; do not embed a horizontally scrolling desktop table. Keep personal returned reports and drafts directly after attention. The role panel’s compact shortcuts use two columns and retain full labels.

The primary action belongs in normal document flow. Do not add a floating action button above the existing raised Home control. Reserve bottom padding for `--bottomnav-h` plus the device safe area. At high text enlargement, sections expand vertically and the readings can become one column.

### Suggested layout skeleton

The class names below are proposed, home-scoped names. This is a layout guide, not a complete implementation patch.

```css
.home-dashboard {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
}

.home-dashboard > * { min-width: 0; }

@media (min-width: 1080px) {
  .home-dashboard {
    grid-template-columns: minmax(0, 2fr) minmax(20rem, 1fr);
    grid-template-areas:
      "actions actions"
      "readings readings"
      "attention work"
      "customers reports"
      "updates updates"
      "links links";
  }
  .home-actions   { grid-area: actions; }
  .home-readings  { grid-area: readings; }
  .home-attention { grid-area: attention; }
  .home-work      { grid-area: work; }
  .home-customers { grid-area: customers; }
  .home-reports   { grid-area: reports; }
  .home-updates   { grid-area: updates; }
  .home-links     { grid-area: links; }
}
```

## 4. The content contract

### A. Action row

Keep the greeting personal but small. The top bar already names the page; avoid another oversized “Dashboard” title or welcome banner.

| Role | Filled primary action | Secondary action | Supporting panel |
|---|---|---|---|
| Inspector | New report | Open monitoring | Your work: returned reports, drafts, form shortcuts |
| Admin / QA Lead | Review reports | New report | QA review: submitted reports, followed by compact own-work access |
| Viewer | Open monitoring | View reports | Overview: concise context and report shortcuts for reading |

Use one filled primary control per action row. Other links and row actions are neutral. “Review reports” remains an available destination when the submitted count is zero; its destination shows the true empty state. Do not change the primary action every time a count changes.

### B. Four readings, four precise meanings

Define `P(j) = jobProgress(j, ctx)` and use the same evaluated date across the page. Counts reflect records available in this browser, not an assumed company-wide live dataset.

| Label | Exact calculation | Supporting text | Destination |
|---|---|---|---|
| **Open jobs** | Jobs where `P(j).applicable > 0` and `P(j).done < P(j).applicable` | “{totalJobs} jobs in register” | `/monitoring?view=all&state=inprogress,overdue,notstarted` |
| **Deliverables complete** | Sum of `P(j).done` divided by sum of `P(j).applicable` | “{done} of {applicable} required” | A visible “Open monitoring” link to `/monitoring?view=all`; the reading itself need not imply an exact filtered list |
| **Awaiting QA** | `getReports().filter(r => r.status === 'submitted').length` | “Submitted reports” | `/reports?f=submitted` |
| **Overdue jobs** | Jobs where `P(j).overdue` is true | “{overdueCells} overdue deliverables” | `/monitoring?view=all&state=overdue` |

The first and fourth destinations use job state filters; the third uses report lifecycle state. These are different counting units and must stay explicit.

**Completion is a documentation measure.** An admin override can set a deliverable to `done` without an approved report. When such cells exist, add “Includes {count} admin overrides” to the completion reading or its adjacent explanation. Never relabel this percentage “Approved reports,” “Quality score,” “Release readiness,” or “Safe to dispatch.” An approved record with a Reject verdict may be complete as documentation while still needing attention.

**Overdue has a specific current meaning.** `cellStatus()` checks reports before deriving lateness. Consequently, an existing draft or submitted report can remain `inprogress` or `awaiting` after the target date. Explain the overdue reading as jobs with overdue deliverable gaps. Do not silently redefine it as every unfinished job past target. A broader schedule-risk measure would require one shared rule across Home and Monitoring in a separate change.

If there are no applicable deliverables, display **—** with “No required deliverables”; never show 0% as failure or 100% as success. If some jobs have no applicable scope, show their count as “No applicable deliverables” in the supporting overview, outside Open jobs.

Use an inline progress track only for completion. No decorative mini charts, fabricated trends, celebratory “on track” badges, or animated number counters.

### C. Needs attention: the dominant working surface

Combine the existing overdue spotlight with jobs referenced by `ncrReports()`. Show each known job once, even when it has several overdue deliverables and several NCR reports. Preserve all reasons on the row.

**Filter labels:** All attention · Overdue gaps · NCR reports. The filter counters count distinct known jobs in each view; the section heading should say “{count} jobs.” The report register separately counts NCR report records. These are not interchangeable totals.

**Ordering:**

1. Jobs with NCR reports.
2. Remaining jobs with overdue deliverable gaps.
3. Within each group, earliest valid target date first; missing dates last.
4. Resolve ties by job number for a stable, deterministic list.

This is a navigation priority, not an invented severity classification. Do not assign “Critical,” “High risk,” or customer priority without a recorded basis.

| Row field | Presentation | Reason |
|---|---|---|
| Job number | Strongest row text; native link | Traceable identity and large navigation target |
| Product and customer | Clear secondary lines | Distinguishes similar units and orders |
| Attention reason | Text such as “2 overdue deliverables” or “1 NCR report” | Explains the row’s presence |
| Outstanding documents | Codes or short names, such as `DIM · NDE` | Names what must be addressed |
| Target date | “Target 07 Sep 2026” | Provides schedule context without confusing actual release |
| Completion | Small fraction, such as “4/6 complete” | Keeps documentation progress visible |

Show up to three outstanding deliverable names plus “+{n} more” when needed. The job page carries the full list. Use `DELIVERABLES` for names and `jobStatuses()` for states. Never describe submitted reports as “missing”; they exist and await review.

On desktop, align identity, reason, target, and completion into consistent columns with hairline row separators. Use one muted status band or labeled status mark per reason, not a card full of competing colored pills. The row should feel selectable before hover; hover gently changes its surface and a thin edge rule. Important information and the destination remain visible on touch devices.

Use native `href="#/job/..."` links as the navigation foundation. If pointer clicks on the whole row are supported, preserve native link behavior, modified clicks, text selection, and a single understandable keyboard destination. Do not nest buttons inside links or create an extra tab stop for every decorative chevron.

“View all” expands the current attention filter in place, showing 20 jobs per page with explicit page controls. This proposed local UI state does not require a new persisted register. Provide separate links to all overdue jobs and all NCR reports for deeper work. A tab change resets the local page to one.

If an NCR report references a job unavailable in the current job register, keep it in the global NCR report count and show a secondary “{count} NCR reports have unavailable job records” link to `/reports?f=ncr`. Do not silently discard the record or create a broken job destination.

### D. Your work / QA review

**Inspector:** show the person’s returned reports first, then their drafts. Returned records sort by oldest `returnedAt` first; drafts sort by newest `updatedAt` first. Display up to four combined records with report number, form label, job, status, and last update. A returned record includes a short visible excerpt of `returnNote`; the full reason is available on opening the report. Use “Revise report” for returned work and “Continue” for a draft.

Personal ownership currently uses the report’s `inspector` name and `session.name`. Reuse that established comparison in the first implementation; do not invent assignment data or claim a complete team workload. Stable user IDs are a separate data-model improvement.

**QA Lead:** show up to four submitted reports, oldest submission first, using the stored submission timestamp and a clearly labeled last-update fallback if absent. Use “Review” to open the record. Own submissions remain visible with “Submitted by you”; they do not get an approval action. Home provides navigation into review, not approval without examining evidence.

The existing approval rule remains `role.canOverride` plus `canApprove(report, session.name)` in the applicable workflow. `canApprove()` alone is not a role authorization check.

**Viewer:** replace editing controls with an overview of the available register and links to Monitoring and Reports. Do not display disabled “New report” tiles or imply the viewer can continue a draft. Reading a report must retain the existing read-only behavior.

“View all my work” expands the personal list in place, ten records at a time, preserving returned-first ordering. Do not link a personal count to `/reports?f=draft` and imply that global destination is personal. A future author-filter URL is optional and must be implemented before it is advertised.

### E. Start or file a report

Move the current seven large colored tiles into a compact, neutral shortcut group beneath the role panel. Keep the existing seven shortcuts in their established order for familiarity; the main “New report” picker exposes every supported category below. Add a visible “All report types” text control so the three existing document-record forms are discoverable.

| Picker group | Visible choice | Existing form key | Deliverable context |
|---|---|---|---|
| Inspection | Leak & Hydro Test | `hydrotest` | `Leak & Hydro Test` |
| Inspection | Blasting & Painting | `blasting` | `Painting` |
| NDE | Magnetic Particle Test (MT) | `mt` | `NDE Report` |
| NDE | Liquid Penetrant Test (PT) | `pt` | `NDE Report` |
| NDE | Ultrasonic Test (UT) | `ut` | `NDE Report` |
| Inspection | Dimensional Inspection | `dimensional` | `Dimension Report` |
| Final inspection | Pre-Shipment Inspection | `visual` | `Pre-Shipment` |
| Final inspection | Pre-Delivery Inspection (PDI) | `visual` | `PDI` |
| Document record | Inspection & Test Plan | `itp` | `ITP` |
| Document record | Performance Test | `ptr` | `PTR` |
| Document record | Inspection Release Note | `irn` | `IRN` |

There are ten form templates and eleven explicit choices here because the Visual template serves two deliverables. Use schema codes and supported titles, with the labels above as clear picker wording.

The document-record group must say what it does: records the reference and evidence of the signed document. It must not imply that opening the ITP or IRN form automatically authors or approves the original document.

**Flow:** choose report type and deliverable → select job in the existing `JobPicker` → validate applicability → open the existing form. Show job number, WBS/serial where available, product, and customer during selection. Search stays inside the picker; reuse the existing global search elsewhere.

For a generic Visual shortcut, explicitly choose Pre-Shipment or PDI before creating the report. If only one is applicable to the selected job, preselect it and state the selection; if both apply, require a deliberate choice. Do not create a PDI record with `d=Pre-Shipment`.

Jobs that do not require the chosen deliverable remain identifiable but cannot start it; explain “Not required for this job.” Recheck when the user confirms, since an order may have changed. If a report already exists, show the applicable existing-record or revision path instead of creating a duplicate without context. Preserve the current report lifecycle controls.

On phones the picker may use the existing sheet presentation. Both picker steps need Escape dismissal, focus containment, initial focus on the heading or search as appropriate, visible Back/Cancel, and focus restoration to the trigger. These are implementation requirements; the current `role="dialog"` and Escape listener alone do not establish all of them.

### F. Customer progress

Preserve `byCustomer(jobs, ctx)` as the source and retain its existing unfinished-unit ordering. Show the first four customers with “View all customers” linking to `/monitoring`.

Each row shows customer name; order and unit counts; open units; overdue units; NCR report count where nonzero; and a labeled deliverable completion fraction. Keep the horizontal progress track secondary to the numbers. Draw a true zero-length track for 0%; the current minimum visible fill must not imply progress that does not exist.

Use “Open units” rather than an ambiguous “Open.” A customer with every document complete can still carry a Reject verdict; keep its NCR indication visible. Completion and conformance are separate facts.

At phone width, wrap the counts below the customer identity. Make the whole recognizable destination available through a native customer link; do not squeeze a miniature desktop chart into the row.

### G. Report register

Replace “My documents” with a compact list of global lifecycle totals: All reports, Draft, Awaiting QA, Sent back, Approved, and NCR reports. Each has a count and an existing Reports destination.

Keep the scope explicit: **“All reports on this device.”** Total records can include prior issues and voided records, while NCR uses the current-issue verdict selection. The lifecycle and NCR counts are not mutually exclusive slices of one total, and the listed lifecycle counts may not sum to All. Therefore use labeled rows, not a donut chart or stacked percentage bar.

NCR means a report with a Reject verdict under the existing helper; do not promise verified closure, a formal NCR register, or CAPA status. `currentIssues()` and `ncrReports()` do not explicitly exclude every lifecycle state. Confirm the treatment of voided latest issues in a shared domain change before calling this an “Open NCR” count. Until then, preserve count-to-list agreement and use “NCR reports.”

### H. Recent updates

Show six recently updated reports with report number, job, exact lifecycle status, and absolute update date/time. Use the heading “Recent updates.” Keep lifecycle status and actor attribution separate unless the corresponding actor field is present:

| Current record state | Safe wording |
|---|---|
| Draft | “Draft · updated {date/time}” |
| Submitted | “Awaiting QA · updated {date/time}” |
| Returned | “Sent back · updated {date/time}” |
| Approved | “Approved · updated {date/time}” |
| Voided | “Voided · updated {date/time}” |

Show “Inspector: {name}” when using `r.inspector`. Use `approvedBy` or `returnedBy` only for the corresponding lifecycle action. The current activity helper attributes its generic verb to the inspector and maps unrecognized states to “saved as draft”; replace that presentation with the exact state mapping above. Do not fabricate historical event rows.

### I. Product imagery and external tools

Remove the auto-rotating `Unit3D` showcase from Home’s render path. Retain the component for existing consumers; dependency removal is not part of this design. Home does not need a product image to be distinctive.

If product imagery is retained during implementation, limit it to a small verified matching asset beside a selected job’s identity, below the main work. Omit it when a match is unavailable. `artFor()` currently falls back to a house Optiload image for unmatched products, so it cannot by itself establish an exact match. Never attach that fallback to an unrelated unit as if it were evidence.

Show external tool links only when a real allowed destination is configured. Blank, whitespace-only, `#`, or unsupported-scheme values render no link and no empty panel. Use meaningful destination labels and an external-link indication. Preserve `noopener noreferrer` for new tabs. No fictional BI metrics or remote connection status belong on Home.

## 5. Visual system

### Palette and surfaces

Reuse semantic variables from `src/styles.css`; the values here document their roles at the reviewed baseline.

| Role | Existing tokens | Light / dark reference | Use |
|---|---|---|---|
| Canvas | `--paper` | `#f6f6f4` / `#0f0f12` | Quiet page ground |
| Main surface | `--surface` | `#ffffff` / `#17171b` | Work panels and readings |
| Secondary surface | `--surface-2` | `#f7f7f5` / `#1e1e23` | Hover and inset areas |
| Main text | `--text` | `#16161a` / `#ededf0` | Identity, values, controls |
| Secondary text | `--text-2` | `#6e6e76` / `#a5a5af` | Supporting labels |
| Accent | `--amber`, `--amber-ink` | Orange / contrast-adjusted orange | Current selection, primary accent detail |
| Borders | `--line`, `--line-2` | Existing theme values | Panel structure and row separators |
| Complete | `--done`, `--done-bg` | Green family | Explicit completed documentation |
| In progress | `--inprog`, `--inprog-bg` | Amber-brown family | Work still being prepared |
| Awaiting review | `--review`, `--review-bg` | Blue family | Submitted, unsigned work |
| Attention | `--overdue`, `--overdue-bg` | Red family | Explicit overdue or Reject reasons |

Keep the existing graphite primary button treatment, with safety orange identifying the active selection and a small structural accent. Do not use orange for every icon, progress bar, and button at once. Use the foreground token intended for readable orange text instead of placing small bright-orange text on white.

Use one shared outer surface for the readings strip, separated internally by hairlines. The attention register is the largest panel. Supporting sections use the same border language with less visual weight. Avoid a nested-card frame around every piece of metadata.

### Typography and spacing

| Element | Target | Treatment |
|---|---|---|
| Metric values | 28–32 px | Semibold, tabular figures, no counting animation |
| Primary panel heading | 18–20 px | Semibold, sentence case |
| Job identity and important row content | 16 px | Strongest row text |
| Buttons, filter labels, key dates, status | 14–16 px | Normal case, clear contrast |
| Secondary metadata | 12–13 px | Only information that is genuinely secondary |
| Main content line height | 1.4–1.5 | Allow wrapping and text enlargement |

Use `--sans` and the existing font fallback. `--mono` currently resolves to Inter too; do not introduce another font simply because a variable is named mono. Use `font-variant-numeric: tabular-nums` for aligned figures.

Use a 4 px spacing base, normally 8 px within compact groups, 12 px between related rows, 16 px between panels, and 20–24 px panel padding on desktop. On phones use 14–16 px panel padding. Reuse existing 6/8/12 px radius tokens and existing button styles. No oversized pill-shaped panels.

Attention rows should normally be about 72–88 px high on desktop, expanding for long content. Avoid fixed heights, line clamps that hide attention reasons, and tiny labels used to compensate for overcrowding. Use `--text-2`, rather than the lighter `--text-3`, for essential dates and states.

### Interaction finish

- Keep navigation destinations visible at rest. Hover changes surface/border subtly; focus has a clearly visible outline independent of hover.
- Use 120–160 ms color/border transitions only. Respect reduced motion and remove timed carousel changes entirely.
- Keep critical actions at least 44 × 44 px on touch/coarse-pointer devices, even at desktop widths. Width alone does not identify a mouse device.
- Pair every status color with text. Decorative icons and chevrons are hidden from assistive technology.
- Use one `h1` for the page identity within the shell’s heading structure and sequential section headings. Avoid turning every KPI into a competing headline.
- Aim for at least 4.5:1 normal-text contrast and 3:1 control/focus contrast on their actual backgrounds; measure both themes during implementation. These are acceptance targets, not a claim that the existing tokens have already passed.

## 6. Navigation and behavior map

The application uses hash routes. Paths below are arguments to `navigate()`; native anchors use the same path prefixed by `#`.

| Control | Target or behavior | Implementation note |
|---|---|---|
| Open monitoring / View all customers | `/monitoring` | Existing customer overview |
| Open jobs | `/monitoring?view=all&state=inprogress,overdue,notstarted` | Existing multi-state support |
| Overdue jobs | `/monitoring?view=all&state=overdue` | Count distinct jobs using the same shared status meaning |
| Completion context | `/monitoring?view=all` | Label link “Open monitoring”; do not promise an approved-report list |
| Awaiting QA / Review reports | `/reports?f=submitted` | Existing report tab |
| Report register: All / Draft / Sent back / Approved / NCR | `/reports?f=all`, `draft`, `returned`, `approved`, `ncr` respectively | Each value is the `f` parameter |
| Attention row | `/job/{jobNo}` | Existing job page; retain valid current job identifiers |
| Customer row | `/customer/{encodedCustomerName}` | URL-encode the segment |
| Existing report | `/job/{jobNo}/form/{formKey}?d={encodedDeliverable}&rid={encodedReportId}` | `rid` is the internal `r.id`, not the displayed `reportId` |
| New report | Existing form route with explicit `d` and no `rid` | Validate job, deliverable, and role first |
| View all attention | Expand current Home filter with local pagination | Proposed presentation state only |
| View all my work | Expand personal Home list | Avoid an unsupported author-filter URL |

**Destination consistency:** `JobsPage` restores search/category-related view state, and `Reports` can retain local search/form filters across same-page query changes. A clicked home count must not land on a smaller list hidden by an old filter. On a metric-driven navigation, reset unrelated destination filters or introduce a small explicit navigation contract and test it. Do not append an invented query parameter and assume the destination honors it. Use `/reports?f=all` when explicitly requesting All, because omission of `f` is not a guaranteed reset in the existing component.

## 7. Data and state rules

### One derivation path

Read the current job list, reports, and status context once per meaningful refresh. Derive the overview in one reusable selector if needed; do not create competing status logic in each panel. `status.js` owns deliverable state and date rules; `verdict.js` owns report verdict/current-issue selection; `rollup.js` owns customer aggregation; the store owns persistence.

Pass one consistent date into status calculations. Recompute when the page becomes visible and when the local calendar day changes, as well as on the existing store refresh signal. Merely changing the helper to read today is insufficient if the Home `useMemo` never reruns after midnight. Do not introduce polling or a “live” indicator without a real remote data source.

Keep these distinctions explicit:

- Job count, required-deliverable count, and report-record count are different units.
- Submitted means awaiting QA, never done.
- Done may include a recorded admin override; an override is not a report attachment.
- Documentation completion does not establish acceptance, NCR closure, or release authorization.
- NCR report selection must match the NCR register, including current-issue behavior.
- A personal work list reflects the signed-in name; global totals are labeled global.
- Report history and evidence remain stored and accessible after a Home filter changes.

### Empty, missing, and adverse states

| Condition | Required presentation and behavior |
|---|---|
| No jobs in register | “No jobs in the register.” Admin gets New job order; other roles get a short explanation that a job must be available first |
| No applicable scope | Completion is —; exclude these jobs from Open jobs; show a scope count in context |
| No attention items | “No overdue deliverable gaps or NCR reports for the available jobs.” Keep overview links; do not imply every inspection is complete |
| No personal drafts or returns | “No reports to continue.” Show the permitted New report action |
| No submitted reports | “No reports awaiting QA.” Keep the Reports destination available |
| No recent updates | “No report updates yet.” Avoid an oversized illustration or fake example feed |
| Missing/invalid target date | “Target date not set” or “Target date unavailable”; do not derive lateness from an invalid value |
| Missing serial/customer/product | Use a clear fallback; retain the job identity and usable destination |
| Long identifiers or descriptions | Wrap at useful boundaries; expose full identity without relying on hover-only tooltips |
| Returned report with a long reason | Show a readable excerpt and open the full report for the complete reason |
| Latest NCR issue is voided or superseded | Preserve the shared selector’s current behavior; resolve lifecycle semantics centrally before changing open/closed wording |
| Record disappears before click | Show “This record is no longer available” and a working register destination |
| Storage read fails and failure is detectable | Show “Could not read reports on this device” with retry; never render a failure as a verified zero |
| Offline | Keep available local records usable; do not claim a successful remote upload or synchronization |
| Viewer session | All visible destinations work read-only; creation, continuation, approval, and order-management actions are absent |

Do not add a loading skeleton to synchronous local reads merely for effect. If a later data source introduces a real loading boundary, reserve the reading/panel structure without displaying temporary zero counts.

## 8. Implementation plan

Treat the first application change as one coherent Home redesign. Preserve the existing dependencies, package scripts, and lockfile. Reuse the native/CSS component system; this task does not need a new chart library, UI kit, router, or font package.

| File or area | Intended work |
|---|---|
| `src/components/Home.jsx` | Replace spotlight-first layout; wire truthful readings, attention rows, role panel, report totals, recent updates, and real external links |
| `src/styles.css` | Replace the affected home rules in place; introduce home-scoped layout/type rules; preserve shared print and theme behavior |
| `src/components/JobPicker.jsx` | Extend selection with explicit applicability/context where needed; complete dialog focus behavior without changing unrelated consumers |
| `src/components/Reports.jsx` and `JobsPage.jsx` | Make metric navigation clear stale filters only through an explicit, bounded contract |
| `src/lib/status.js` | Reuse current helpers; add only shared derivations needed by Home or the exact recent-update mapping |
| `src/lib/rollup.js`, `verdict.js` | Reuse current customer/NCR definitions; avoid a Home-only version of them |
| Optional `src/lib/homeOverview.js` | Extract pure overview and attention selectors if Home becomes hard to follow; leave persistence in the existing store |
| Existing test directories | Add focused coverage for new calculations/navigation; preserve lifecycle and permission tests |

Suggested sequence:

1. Define the overview/attention calculation and correct the metric labels and routes.
2. Build the readings strip, attention register, and role panel using actual records.
3. Add the full report picker and explicit Pre-Shipment/PDI context; preserve existing report paths.
4. Recompose customer progress, report totals, and recent updates; remove Home’s carousel import/timer and unconfigured links.
5. Complete responsive states, keyboard/focus behavior, theme checks, and destination-filter consistency.
6. Validate against the acceptance criteria below and record the actual results.

Do not rewrite the entire shared stylesheet, change the data persistence architecture, or alter signed/printed report content as incidental cleanup. This document is the design deliverable; implementing it is a subsequent task.

## 9. Acceptance criteria for the future implementation

### Layout and usability

- At 1440 × 900, the readings and first attention rows are visible without scrolling; the review/continuation panel shares the first work row.
- At 820 and 390 px, the page fits without horizontal overflow and preserves job identity, reason, target, and an actionable destination.
- At 200% text enlargement, essential content wraps and remains operable; the page does not depend on fixed panel heights.
- All essential labels are readable in light and dark themes; status is never color-only.
- The job/report picker supports keyboard entry, Back, Cancel, Escape, focus containment, and trigger-focus restoration.
- Coarse-pointer devices retain 44 px touch targets regardless of screen width.
- Attention, draft, review, and customer destinations work by keyboard and touch, not just hover or tiny icons.
- There is no automatic slide rotation, decorative number animation, fake trend, dead `#` link, or prominent unmatched product image.

### Domain and navigation

- Open jobs excludes complete jobs and jobs with zero applicable deliverables.
- Submitted work contributes to Awaiting QA, never to completion through a Home-only rule.
- Completion matches the shared job statuses and explicitly acknowledges admin overrides when present.
- Overdue totals match the filtered Monitoring results under the current helper semantics.
- NCR reports match the existing Reports NCR selector; multiple reports for one job do not create duplicate attention job rows.
- A completed job with an NCR report remains visible in attention.
- No-data percentages, missing targets, unavailable job records, and stale destination filters behave as specified.
- ITP, PTR, and IRN existing record forms are available through All report types.
- Pre-Shipment and PDI open the Visual template with the correct explicit deliverable.
- Personal lists stay personal; global report counts are labeled global.
- Viewer navigation stays read-only; QA self-approval remains prohibited by the existing workflow.
- Returned and voided records are never mislabeled as newly saved drafts in Recent updates.

### Proof to collect

Use the repository’s current verification scripts: `npm run build`, relevant unit tests, and the full `npm run check` gate when preparing the implementation for merge. Record actual pass/fail output; do not mark a check complete from this specification alone.

Capture before/after Home screenshots at **1440, 820, and 390 px**, in light and dark themes. Exercise inspector, admin, and viewer behavior; include realistic long identifiers, no records, no applicable scope, returned reports, mixed NCR/overdue reasons, an own submitted report, and records past the target date in different lifecycle states. Check keyboard focus, horizontal overflow, console errors, and printed-report/MDR pagination if shared styles are touched.

Score the rendered result against the repository’s [taste rubric](.codex/skills/frontend-taste-grill/references/taste-rubric.md): target at least **16/20 with no zero**. Any unclear metric, broken role action, hidden evidence, or incorrect deliverable routing is a failure regardless of visual score.

## 10. Source map and verification status

| Source | Used for |
|---|---|
| [AGENTS.md](AGENTS.md) | Product priorities, brand, architecture, verification obligations |
| [Frontend Taste & Grill](.codex/skills/frontend-taste-grill/SKILL.md) | Design direction and quality rubric |
| [Home.jsx](src/components/Home.jsx) | Existing layout, labels, metrics, shortcuts, carousel, and interactions |
| [styles.css](src/styles.css) | Actual palette, theme values, dimensions, breakpoints, and cascade |
| [App.jsx](src/App.jsx) | Supported hash routes, session context, and refresh behavior |
| [constants.js](src/lib/constants.js) | Deliverable mappings, status names, and role capabilities |
| [formSchemas.js](src/data/formSchemas.js) | Available inspection templates and document-record forms |
| [status.js](src/lib/status.js) | Status precedence, deadline behavior, report totals, recent activity, NCR selection |
| [rollup.js](src/lib/rollup.js) and [verdict.js](src/lib/verdict.js) | Customer totals and current-issue verdict semantics |
| [store.js](src/lib/store.js) | Approval separation, returned-report fields, local record behavior |
| [Reports.jsx](src/components/Reports.jsx) and [JobsPage.jsx](src/components/JobsPage.jsx) | Existing filters, count units, navigation state, and review gates |
| [JobPicker.jsx](src/components/JobPicker.jsx) | Current selection flow and dialog behavior |
| [Sidebar.jsx](src/components/Sidebar.jsx), [BottomNav.jsx](src/components/BottomNav.jsx), [Topbar.jsx](src/components/Topbar.jsx) | Existing shell and navigation |
| [productArt.js](src/lib/productArt.js) | Product-match and fallback limitation |
| [package.json](package.json) and [historical plan](tasks/plan.md) | Current checks and earlier project context |

**This document’s verification:** source-grounded review and Markdown/source-reference validation. No application code changed; build, browser, role, performance, and screenshot verification have not been run for this design-only deliverable. The acceptance criteria above remain pending implementation.
