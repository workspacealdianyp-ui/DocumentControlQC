import { COMPANY } from '../lib/company.js'
import { useEffect, useRef, useState } from 'react'
import { FORM_SCHEMAS } from '../data/formSchemas.js'
import { fmtDate, buildContext, releasedAt } from '../lib/status.js'
import { reportResult } from '../lib/verdict.js'
import { ReportSheets, reportSheetCount } from './PrintReport.jsx'
import { useFitToPage, pageSpans, sameFit, oneEach, tighten, useSheetZoom } from '../lib/pagefit.js'
import { PrintHeader, PrintFooter, PrintToolbar } from './PrintDocument.jsx'

/* The Manufacturing Data Report.

   Not a summary of the records — the records themselves, bound. A cover
   sheet naming the unit, a contents page that says which document is on
   which page, a register of everything included, and then every report
   reproduced in full, each starting on its own page. That is what a
   customer is handed at delivery, and what an auditor reads years later:
   a narrative paragraph is not evidence, the signed reports are. */

const reportDate = (r) => r.values?.inspDate || r.updatedAt || r.createdAt

/* Where the declaration is made.

   Every report used to print its own Statement of Result — a page
   saying, in a formal voice, that this shop carried out that inspection
   and hereby accepts the object. Bound into a data book that is nine of
   them, one after another, about the same unit, on the same day, over
   the same signature. A reader gets the declaration nine times and the
   evidence once.

   So the book can make it once instead, at the front, listing what was
   carried out and declaring the unit on the strength of all of it. Both
   are legitimate: a customer who takes delivery of the reports
   separately needs each to stand alone, and one who takes the book
   needs it to say something the loose pages cannot. The choice is made
   when the book is compiled, because that is when it is known. */
export default function MdrReport({ job, reports, session, onClose, statements = 'book' }) {
  const oneStatement = statements === 'book'
  const wrap = useRef(null)
  useEffect(() => {
    document.body.classList.add('printing')
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.classList.remove('printing')
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])
  const [fit, setFit] = useState(null)
  // Result rows and paired dimensional points have different heights;
  // the shared page planner adjusts each report to its measured content.
  const [rowFit, setRowFit] = useState({})

  const today = new Date()
  const stamp = `${String(today.getFullYear()).slice(2)}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
  const mdrNo = `${COMPANY.short}/MDR/${job.jobNo}/${stamp}`

  /* Only a document this build can reproduce can be bound into the book.
     A report on a form template that is no longer installed still exists
     and still belongs in the register, but it cannot be given a section
     or a page it does not occupy — that would point the contents page at
     the next document. */
  const printable = reports.filter((r) => FORM_SCHEMAS[r.formKey])
  const omitted = reports.filter((r) => !FORM_SCHEMAS[r.formKey])

  /* Paginate the book before drawing it. The front matter includes the
     cover, contents, register, approvals and optional statement; each report contributes its
     own; the measured counts replace this assumption as soon as the
     first layout pass reports back. */
  const FRONT = oneStatement ? 5 : 4
  const sheetsPer = printable.map((r) => reportSheetCount(FORM_SCHEMAS[r.formKey], r, rowFit[r.id], oneStatement, job))
  const sheetTotal = FRONT + sheetsPer.reduce((a, b) => a + b, 0)
  const { spans, total: totalPages } = pageSpans(
    fit && fit.length === sheetTotal ? fit : oneEach(sheetTotal)
  )
  const REGISTER_PAGE = spans[2]?.[0] ?? 3
  const DISPOSITION_PAGE = spans[3]?.[0] ?? 4
  const STATEMENT_PAGE = spans[4]?.[0] ?? 5
  // Section 1 is the register; the statement, when the book makes one,
  // is Section 2 and the documents start after it.
  const FIRST_DOC_SECTION = oneStatement ? 3 : 2

  let cursor = FRONT
  const items = printable.map((r, i) => {
    const sheets = sheetsPer[i]
    const at = cursor
    cursor += sheets
    return {
      r, schema: FORM_SCHEMAS[r.formKey], sheets, at,
      map: spans.slice(at, at + sheets),
      page: spans[at]?.[0] ?? 0,
      sectionNo: i + FIRST_DOC_SECTION,
    }
  })

  /* The contents page is only worth printing if its numbers are true, so
     they come from what the paper did rather than from a sheet count — and
     a report whose sheets would not fit is given fewer rows per sheet and
     measured again, rather than left to flow and be estimated. */
  useSheetZoom(wrap)
  useFitToPage(wrap, [job.jobNo, reports.length, sheetTotal, statements, Object.values(rowFit).join(',')], (f) => {
    setFit((p) => (sameFit(p, f) ? p : f))
    if (f.length !== sheetTotal) return
    setRowFit((prev) => {
      const next = { ...prev }
      let changed = false
      for (const it of items) {
        const tighter = tighten(prev[it.r.id] || 1, f.slice(it.at, it.at + it.sheets))
        if (tighter !== (prev[it.r.id] || 1)) { next[it.r.id] = tighter; changed = true }
      }
      return changed ? next : prev
    })
  })
  const rejected = items.filter((it) => reportResult(it.r) === 'Reject')
  const pass = rejected.length === 0

  const dates = printable.map(reportDate).filter(Boolean).sort()
  const span = dates.length
    ? (dates.length > 1 ? `${fmtDate(dates[0])} — ${fmtDate(dates[dates.length - 1])}` : fmtDate(dates[0]))
    : '—'

  const kop = (sheetIndex) => <PrintHeader title="Manufacturing Data Report" number={mdrNo}
    from={spans[sheetIndex]?.[0] ?? sheetIndex + 1} to={spans[sheetIndex]?.[1] ?? sheetIndex + 1} total={totalPages} subtitle="Final documentation package" metadata={[
      ['Form', 'FM-QC-MDR'], ['Revision', '0'], ['Job', job.jobNo], ['Issue date', fmtDate(today.toISOString())]
    ]} />
  const foot = (sheetIndex) => {
    const [from, to] = spans[sheetIndex] || [sheetIndex + 1, sheetIndex + 1]
    return <PrintFooter number={mdrNo} form="FM-QC-MDR Rev.0" jobNo={job.jobNo} from={from} to={to} total={totalPages} />
  }

  const signRow = (
    <table className="ps-sign-table">
      <tbody>
        <tr className="ps-sign-head">
          <td>Compiled by — QA/QC</td><td>Reviewed by — QC Supervisor</td><td>Accepted by — Customer</td>
        </tr>
        <tr>
          {/* Compiling the book is not signing it. The name and date are
              the record of who assembled it; the space above stays clear
              for their actual signature, the way the other two columns
              do. It used to carry the name in a script face, which put a
              signature on the cover that nobody had made. */}
          <td>
            <div className="ps-sign-space" />
            <div className="ps-sign-name">{session.name}</div>
            <div className="ps-sign-date">{fmtDate(today.toISOString())}</div>
          </td>
          <td>
            <div className="ps-sign-space" />
            <div className="ps-sign-name">Name / Signature</div>
            <div className="ps-sign-date">Date:</div>
          </td>
          <td>
            <div className="ps-sign-space" />
            <div className="ps-sign-name">Name / Signature</div>
            <div className="ps-sign-date">Date:</div>
          </td>
        </tr>
      </tbody>
    </table>
  )

  return (
    <div className="print-overlay" ref={wrap}>
      <PrintToolbar title="Manufacturing Data Report" pages={totalPages} onClose={onClose} />

      {/* The pages keep their 210mm; this wrapper is what shrinks. */}
      <div className="print-scaler">

      {/* ══════════ COVER ══════════ */}
      <div className="print-sheet">
        <div className="ps-cover">
          <div className="ps-cover-top">
            <span className="ps-logo ps-cover-logo">{COMPANY.short}</span>
            <div className="ps-cover-co">{COMPANY.legalName.toUpperCase()}</div>
            <div className="ps-cover-dept">QA / QC DEPARTMENT</div>
          </div>

          <div className="ps-cover-mid">
            <div className="ps-cover-kicker">Document Type</div>
            <h1 className="ps-cover-title">Manufacturing<br />Data Report</h1>
            <div className="ps-cover-sub">Inspection &amp; Test Records — Final Documentation Package</div>
          </div>

          <table className="ps-cover-id"><tbody>
            <tr><td className="ps-label">Customer</td><td className="ps-value" colSpan={3}>{job.customerName}</td></tr>
            <tr>
              <td className="ps-label">PO No.</td><td className="ps-value">{job.poNo || '—'}</td>
              <td className="ps-label">Job No.</td><td className="ps-value">{job.jobNo}</td>
            </tr>
            <tr>
              <td className="ps-label">WBS No.</td><td className="ps-value">{job.wbsNo || '—'}</td>
              <td className="ps-label">Serial No.</td><td className="ps-value">{job.arasSN || job.unitNo || '—'}</td>
            </tr>
            <tr><td className="ps-label">Unit</td><td className="ps-value" colSpan={3}>{job.productDesc}</td></tr>
            <tr>
              <td className="ps-label">Category / Type</td><td className="ps-value">{[job.kategori, job.type].filter(Boolean).join(' / ') || '—'}</td>
              <td className="ps-label">Inspection Period</td><td className="ps-value">{span}</td>
            </tr>
            {/* the document number gets the full width: it is long, and a
                number broken across two lines is not a number */}
            <tr><td className="ps-label">MDR No.</td><td className="ps-value ps-docno" colSpan={3}>{mdrNo}</td></tr>
            <tr>
              <td className="ps-label">Revision</td><td className="ps-value">0</td>
              <td className="ps-label">Issue Date</td><td className="ps-value">{fmtDate(today.toISOString())}</td>
            </tr>
            <tr><td className="ps-label">Contents</td><td className="ps-value" colSpan={3}>{printable.length} document{printable.length === 1 ? '' : 's'} · {totalPages} pages</td></tr>
          </tbody></table>

          <div className={`ps-verdict ${pass ? '' : 'hold'} ps-cover-verdict`}>
            {pass
              ? 'RELEASED FOR SHIPMENT — the unit conforms to the applicable requirements.'
              : 'ON HOLD — pending closure of outstanding non-conformances.'}
          </div>

          <div className="ps-cover-signs">{signRow}</div>

          <div className="ps-cover-foot">
            This data report and its attachments form one indivisible document. {mdrNo} · Revision 0 · {totalPages} pages.
          </div>
        </div>
      </div>

      {/* ══════════ TABLE OF CONTENTS ══════════ */}
      <div className="print-sheet ps-sheet-break">
        <table className="ps-doc">
          {kop(1)}{foot(1)}
          <tbody><tr><td className="ps-runcell ps-body">
            <table><tbody><tr><td className="ps-section-bar">Table of Contents</td></tr></tbody></table>
            <table className="ps-grid ps-toc">
              <thead>
                <tr>
                  <th style={{ width: '16mm' }}>Section</th>
                  <th>Document</th>
                  <th style={{ width: '42mm' }}>Document No.</th>
                  <th style={{ width: '24mm' }}>Date</th>
                  <th style={{ width: '18mm' }}>Result</th>
                  <th style={{ width: '14mm' }}>Page</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1</td>
                  <td className="ps-left">Document Control &amp; Inspection Register</td>
                  <td className="ps-left">{mdrNo}</td>
                  <td>{fmtDate(today.toISOString())}</td>
                  <td>—</td>
                  <td>{REGISTER_PAGE}–{DISPOSITION_PAGE}</td>
                </tr>
                {oneStatement && (
                  <tr>
                    <td>2</td>
                    <td className="ps-left">Statement of Inspection</td>
                    <td className="ps-left">{mdrNo}</td>
                    <td>{fmtDate(today.toISOString())}</td>
                    <td className={pass ? 'ps-result-acc' : 'ps-result-rej'}>{pass ? 'ACCEPT' : 'HOLD'}</td>
                    <td>{STATEMENT_PAGE}</td>
                  </tr>
                )}
                {items.map((it) => {
                  const res = reportResult(it.r)
                  return (
                    <tr key={it.r.id}>
                      <td>{it.sectionNo}</td>
                      <td className="ps-left">{it.schema?.title || it.r.formKey}</td>
                      <td className="ps-left">{it.r.reportId}</td>
                      <td>{fmtDate(reportDate(it.r))}</td>
                      <td className={res === 'Accept' ? 'ps-result-acc' : 'ps-result-rej'}>{res.toUpperCase()}</td>
                      <td>{it.page}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="ps-toc-note">
              Each section begins on a new page. Page numbers refer to the pagination of this data report.
            </div>
          </td></tr></tbody>
        </table>
      </div>

      {/* ══════════ SECTION 1 — document control & register ══════════ */}
      <div className="print-sheet ps-sheet-break">
        <table className="ps-doc">
          {kop(2)}{foot(2)}
          <tbody><tr><td className="ps-runcell ps-body">
            <div className="ps-tab">
              <span className="ps-tab-no">Section 1</span>
              <span className="ps-tab-title">Document Control &amp; Inspection Register</span>
            </div>

            <table><tbody><tr><td className="ps-section-bar">1.1 · Unit / Job Identification</td></tr></tbody></table>
            <table>
              <tbody>
                <tr>
                  <td className="ps-label">Job Number</td><td className="ps-value">{job.jobNo}</td>
                  <td className="ps-label">WBS No.</td><td className="ps-value">{job.wbsNo || '—'}</td>
                </tr>
                <tr>
                  <td className="ps-label">PO No.</td><td className="ps-value">{job.poNo || '—'}</td>
                  <td className="ps-label">Serial No.</td><td className="ps-value">{job.arasSN || job.unitNo || '—'}</td>
                </tr>
                <tr><td className="ps-label">Product</td><td className="ps-value" colSpan={3}>{job.productDesc}</td></tr>
                <tr>
                  <td className="ps-label">Category / Type</td><td className="ps-value">{[job.kategori, job.type].filter(Boolean).join(' / ') || '—'}</td>
                  <td className="ps-label">Customer</td><td className="ps-value">{job.customerName}</td>
                </tr>
                <tr>
                  <td className="ps-label">Inspection Period</td><td className="ps-value">{span}</td>
                  <td className="ps-label">PDI Release</td><td className="ps-value">{fmtDate(releasedAt(job, buildContext()))}</td>
                </tr>
              </tbody>
            </table>

            <div className="ps-mt-4">
              <table><tbody><tr><td className="ps-section-bar">1.2 · Register of Inspection Documents</td></tr></tbody></table>
              <table className="ps-grid">
                <thead>
                  <tr>
                    <th style={{ width: '8mm' }}>No</th>
                    <th>Report No.</th>
                    <th>Inspection</th>
                    <th style={{ width: '22mm' }}>Date</th>
                    <th>Inspector</th>
                    <th style={{ width: '18mm' }}>Result</th>
                    <th style={{ width: '14mm' }}>Page</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => {
                    const res = reportResult(it.r)
                    return (
                      <tr key={it.r.id}>
                        <td>{i + 1}</td>
                        <td className="ps-left">{it.r.reportId}</td>
                        <td className="ps-left">{it.schema?.title || it.r.formKey}</td>
                        <td>{fmtDate(reportDate(it.r))}</td>
                        <td>{it.r.inspector}</td>
                        <td className={res === 'Accept' ? 'ps-result-acc' : 'ps-result-rej'}>{res.toUpperCase()}</td>
                        <td>{it.page}</td>
                      </tr>
                    )
                  })}
                  {/* An approved document the build cannot reproduce is
                      still part of the record: it is named here, without a
                      page, rather than quietly left out of the book. */}
                  {omitted.map((r, i) => (
                    <tr key={r.id}>
                      <td>{items.length + i + 1}</td>
                      <td className="ps-left">{r.reportId}</td>
                      <td className="ps-left">{r.deliverable || r.formKey}</td>
                      <td>{fmtDate(reportDate(r))}</td>
                      <td>{r.inspector}</td>
                      <td>—</td>
                      <td>—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {omitted.length > 0 && (
                <div className="ps-toc-note">
                  {omitted.length} document{omitted.length === 1 ? '' : 's'} listed above {omitted.length === 1 ? 'is' : 'are'} recorded
                  against this unit but {omitted.length === 1 ? 'is' : 'are'} not reproduced in this data report:
                  the form template is not available in this issue. {omitted.length === 1 ? 'It' : 'They'} must be attached separately.
                </div>
              )}
            </div>

          </td></tr></tbody>
        </table>
      </div>

      <div className="print-sheet ps-sheet-break">
        <table className="ps-doc">
          {kop(3)}{foot(3)}
          <tbody><tr><td className="ps-runcell ps-body">
            <div className="ps-tab"><span className="ps-tab-no">Section 1</span><span className="ps-tab-title">Disposition &amp; Approvals</span></div>
            <div className="ps-mt-4">
              <table><tbody><tr><td className="ps-section-bar">1.3 · Disposition</td></tr></tbody></table>
              <table>
                <tbody>
                  <tr>
                    <td className={`ps-verdict ${pass ? '' : 'hold'}`}>
                      {pass
                        ? 'RELEASED FOR SHIPMENT — the unit conforms to the applicable requirements.'
                        : 'ON HOLD — pending closure of outstanding non-conformances.'}
                    </td>
                  </tr>
                  {!pass && (
                    <tr>
                      <td className="ps-hold-list">
                        Non-conforming results are recorded in: {rejected.map((it) => `${it.schema?.title} (${it.r.reportId}, Section ${it.sectionNo})`).join('; ')}.
                        Reference is made to the associated Non-Conformance Reports for disposition and corrective action.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="ps-mt-4">
              <table><tbody><tr><td className="ps-section-bar">1.4 · Certification &amp; Approvals</td></tr></tbody></table>
              {signRow}
            </div>
          </td></tr></tbody>
        </table>
      </div>

      {/* ══════════ SECTION 2 — the one statement ══════════

          Made once, for the unit, on the strength of everything bound
          behind it — rather than nine times, once per report, about the
          same object over the same signature on the same day. */}
      {oneStatement && (
        <div className="print-sheet ps-sheet-break">
          <table className="ps-doc">
            {kop(4)}{foot(4)}
            <tbody><tr><td className="ps-runcell ps-body">
              <div className="ps-tab">
                <span className="ps-tab-no">Section 2</span>
                <span className="ps-tab-title">Statement of Inspection</span>
              </div>

              <div className="ps-letter">
                <div className="ps-letter-title">Statement of Inspection</div>
                <div className="ps-letter-meta">{mdrNo} · Revision 0</div>

                <p>
                  {COMPANY.legalName} ({COMPANY.department}) states that the inspections and tests
                  listed below were carried out on the product identified as follows, and that the
                  signed records of each are reproduced in full in this data report.
                </p>

                <table className="ps-letter-id"><tbody>
                  <tr><td>Job No.</td><td>: {job.jobNo}{job.wbsNo ? `  (WBS ${job.wbsNo})` : ''}</td></tr>
                  <tr><td>Product</td><td>: {job.productDesc}</td></tr>
                  <tr><td>Serial No.</td><td>: {job.arasSN || job.unitNo || '—'}</td></tr>
                  <tr><td>Customer</td><td>: {job.customerName}{job.poNo ? `  (PO ${job.poNo})` : ''}</td></tr>
                  <tr><td>Period</td><td>: {span}</td></tr>
                </tbody></table>

                {/* What was actually done — the list the statement is
                    made on, so the declaration below is checkable
                    against it without turning a page. */}
                <table className="ps-grid ps-mt-3">
                  <thead><tr>
                    <th style={{ width: '10mm' }}>No</th>
                    <th className="ps-left">Inspection carried out</th>
                    <th style={{ width: '44mm' }}>Record No.</th>
                    <th style={{ width: '24mm' }}>Date</th>
                    <th style={{ width: '20mm' }}>Result</th>
                  </tr></thead>
                  <tbody>
                    {items.map((it, i) => {
                      const res = reportResult(it.r)
                      return (
                        <tr key={it.r.id}>
                          <td>{i + 1}</td>
                          <td className="ps-left">{it.schema?.title || it.r.formKey}</td>
                          <td className="ps-left ps-refno">{it.r.reportId}</td>
                          <td>{fmtDate(reportDate(it.r))}</td>
                          <td className={res === 'Accept' ? 'ps-result-acc' : 'ps-result-rej'}>{res.toUpperCase()}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                <p className="ps-mt-3">
                  On the results recorded above, the unit identified in this statement is declared{' '}
                  <strong className={pass ? 'ps-result-acc' : 'ps-result-rej'}>
                    {pass ? 'ACCEPTED' : 'ON HOLD'}
                  </strong>
                  {pass
                    ? ' and released for shipment in accordance with the applicable requirements.'
                    : ' pending closure of the non-conformances recorded against it.'}
                </p>

                {!pass && (
                  <p>
                    Non-conforming results are recorded in{' '}
                    {rejected.map((it) => `${it.schema?.title} (${it.r.reportId}, Section ${it.sectionNo})`).join('; ')}.
                    Reference is made to the associated Non-Conformance Reports for disposition and
                    corrective action.
                  </p>
                )}

                <p className="ps-letter-close">
                  This statement is issued by and on behalf of {COMPANY.legalName}, and is made
                  truthfully to be used as required. It covers every document bound in this data
                  report; the individual records carry no separate statement of result.
                </p>

                {signRow}
              </div>
            </td></tr></tbody>
          </table>
        </div>
      )}

      {/* ══════════ the reports, in full ══════════ */}
      {items.map((it) => (
        <ReportSheets key={it.r.id} schema={it.schema} report={it.r} job={job}
          deliverable={it.r.deliverable} status={it.r.status} rowFit={rowFit[it.r.id]}
          pageMap={it.map} pageTotal={totalPages} sectionNo={it.sectionNo} breakFirst
          noStatement={oneStatement} />
      ))}
      </div>
    </div>
  )
}
