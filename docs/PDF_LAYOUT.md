# Industrial PDF layout

All ten report templates and the Manufacturing Data Record (MDR) use a compact controlled-form layout. The report leads with its identity, acceptance references and results; supporting equipment and technique details follow. White paper, graphite text and fine rules keep it industrial and readable.

![PDF layout examples](pdf-layout-preview.png)

## Page and typography

| Element | Specification |
| --- | --- |
| Paper | A4 portrait, 210 × 297 mm |
| Margins | 12 mm top, 10 mm sides, 14 mm bottom |
| Body | Arial / Helvetica; 8.5 pt detail values and 9 pt general text |
| Document title | Centered 13 pt band below the controlled header; 11 pt on evidence sheets |
| Table headings | 8 pt, pale gray fill, fine graphite rules |
| Field labels | 7.5 pt beside the value; two label/value pairs per row |
| Footer | 7 pt, report identity and Page x of y |
| Signature area | 13 mm of ink space, followed by name and date |
| Full-page evidence | 194 mm image frame; contain without cropping |

The header has three columns: logo, company name and three form-control lines (form number, revision and page). The report title spans the width below it. A small gap separates the header from report number, job, inspection date and lifecycle state. The form revision comes from `report.formRevision` or `schema.revision`; an unconfigured revision is shown as a dash. The revision of an attached ITP/PTR/IRN remains part of that document's details, separate from the form revision.

Detail fields use compact label/value pairs, with full-width values for long notes. Short sections stay together rather than leaving a single pair on the following sheet. Results appear before supporting equipment and technique sections, and a table starts with a useful group of rows rather than a token row at the foot of a page.

Dimensional results use two groups of four columns, read left to right and then down. Every point retains its description, nominal value, minimum and maximum, actual measurement, deviation, judgement and any note. An odd final point leaves the opposite half empty. Hydrotest tables reserve a wider remarks column so long observations do not force unexpected page breaks.

Signed records, dimensional maps, NDE maps and pressure charts retain dedicated evidence sheets; ordinary photos are paired. Empty attachment sections do not create blank pages.

## Content and pagination

`src/lib/printLayout.js` builds the page plan used by both rendering and page counts. Long field values continue without truncation. Result tables repeat their headings and retain row numbering across sheets. Statements stay with the approval section when space permits. Dimensional points are paginated as pairs, and short detail sections are kept intact. The print fitter can reduce content to 90% before asking for more pages, avoiding the previous deeply compressed output.

Each sheet identifies the report, job, form and lifecycle state. Submitted documents say “Awaiting QA”; returned and voided records retain their state watermark. Existing recorded signature images are printed, with space for a wet signature when an image is absent. A typed name is never substituted for a signature image.

The MDR uses the same report sheets and page plan. Its front matter includes a cover, contents, register, a dedicated disposition and approvals page, and an optional combined statement. Contents references account for all continuation and evidence sheets.

The implementation changes presentation and pagination. Stored reports, approval actions, and acceptance calculations keep their existing behavior. The hydrotest chart note describes the recorded pressure trend and refers readers to the acceptance decision rather than inferring absence of leakage from pressure alone.

## Verification

- `npm run check`: 181 tests passed across 15 files; lint had no errors; production build and bundle budgets passed.
- Fourteen offline PDF samples covered all ten templates, an MDR, a report with 60 result rows/long notes/five photos, 41 dimensional points with rejection notes, and 20 hydrotest checkpoints with long remarks. Planned page counts and printed page numbers matched the rendered PDFs.
- Rasterized pages were inspected for hierarchy, table wrapping, evidence size, signatures, continuation pages and MDR references. Tests also verify results on the first page for each of the seven inspection templates, odd dimensional-point counts, and matching header/footer numbering.
- These proofs use bundled demonstration records and are marked “DEMONSTRATION / DESIGN REVIEW”. They contain no live customer data.

Offline proofs use WeasyPrint. Browser print layout can differ; the actual browser print dialog and responsive preview still need the owner's review. Browser automation was not used for this verification.

## Measured change from the first PDF rebuild

The same bundled demonstration records produced these totals, including all evidence pages:

| Sample | Previous pages | Revised pages |
| --- | ---: | ---: |
| Dimensional | 4 | 3 |
| MT | 4 | 3 |
| PT | 4 | 3 |
| UT | 5 | 3 |
| Visual | 3 | 2 |
| Hydrotest | 5 | 4 |
| Blasting / painting | 4 | 3 |
| MDR | 23 | 20 |

The standard dimensional sample now holds all six measurements, details, statement and signatures on one main sheet; the other two sheets retain its map and photographic evidence. Long reports still continue when required for readable content.

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
