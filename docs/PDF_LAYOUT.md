# Industrial PDF layout

All ten report templates and the Manufacturing Data Record (MDR) use one document system: white paper, graphite text, fine rules, clear section headings, and generous space for evidence and signatures.

![PDF layout examples](pdf-layout-preview.png)

## Page and typography

| Element | Specification |
| --- | --- |
| Paper | A4 portrait, 210 × 297 mm |
| Margins | 12 mm top, 10 mm sides, 14 mm bottom |
| Body | Arial / Helvetica, 9 pt, approximately 1.4 line height |
| Document title | 17 pt; compact 11 pt title on evidence sheets |
| Table headings | 8 pt, pale gray fill, fine graphite rules |
| Field labels | 7.2 pt above the value |
| Footer | 7 pt, report identity and Page x of y |
| Signature area | 16 mm of ink space, followed by name and date |
| Full-page evidence | 194 mm image frame; contain without cropping |

Fields use two columns with labels above their values. Long notes span the full width. Dimensional results combine nominal values and limits into one column, leaving room for actual readings and remarks. Signed records, dimensional maps, NDE maps, and pressure charts receive individual evidence sheets; ordinary photos are paired. Empty attachment sections do not create blank pages.

## Content and pagination

`src/lib/printLayout.js` builds the page plan used by both rendering and page counts. Long field values continue without truncation. Result tables repeat their headings and retain row numbering across sheets. Statements stay with the approval section when space permits. The print fitter can reduce content to 90% before asking for more pages, avoiding the previous deeply compressed output.

Each sheet identifies the report, job, form and lifecycle state. Submitted documents say “Awaiting QA”; returned and voided records retain their state watermark. Existing recorded signature images are printed, with space for a wet signature when an image is absent. A typed name is never substituted for a signature image.

The MDR uses the same report sheets and page plan. Its front matter includes a cover, contents, register, a dedicated disposition and approvals page, and an optional combined statement. Contents references account for all continuation and evidence sheets.

The implementation changes presentation and pagination. Stored reports, approval actions, and acceptance calculations keep their existing behavior. The hydrotest chart note describes the recorded pressure trend and refers readers to the acceptance decision rather than inferring absence of leakage from pressure alone.

## Verification

- `npm run check`: 153 tests passed across 13 files; lint had no errors; production build and bundle budgets passed.
- Twelve offline PDF samples covered all ten templates, an MDR and a long report with 60 result rows, long notes and five photos. Planned page counts and printed page numbers matched the rendered PDFs.
- Rasterized pages were inspected for hierarchy, table wrapping, evidence size, signatures, continuation pages and MDR references.
- These proofs use bundled demonstration records and are marked “DEMONSTRATION / DESIGN REVIEW”. They contain no live customer data.

Offline proofs use WeasyPrint. Browser print layout can differ; the actual browser print dialog and responsive preview still need the owner's review. Browser automation was not used for this verification.

## Reproduce the offline proof

Generate static HTML from the actual React components with the existing project dependencies:

```sh
node scripts/render-print-samples.mjs tmp/print-review
```

The output includes one HTML file per sample and a manifest with planned page counts. With WeasyPrint installed separately for local review, convert a sample and rasterize it with Poppler:

```sh
weasyprint tmp/print-review/mt.html tmp/print-review/mt.pdf
pdftoppm -f 1 -l 1 -scale-to 1400 -png -singlefile tmp/print-review/mt.pdf tmp/print-review/mt-page-1
```

WeasyPrint is an optional review tool, not an application dependency. Final browser review should check A4 portrait output at 100% scale, long reports, a signed record and a complete MDR, including the page references in its contents.
