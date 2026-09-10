import { COMPANY } from '../lib/company.js'
import { Fragment, useEffect, useRef, useState } from 'react'
import { FORM_SCHEMAS } from '../data/formSchemas.js'
import { requiredFor } from '../lib/jobOrders.js'
import { fmtDate, buildContext, releasedAt } from '../lib/status.js'
import { reportResult } from '../lib/verdict.js'
import { ReportSheets, reportSheetCount } from './PrintReport.jsx'
import { useFitToPage, pageSpans, sameFit, oneEach, tighten, useSheetZoom } from '../lib/pagefit.js'
import { PrintHeader, PrintFooter, PrintToolbar } from './PrintDocument.jsx'
import MdrDivider from './MdrDivider.jsx'

/* The Manufacturing Data Report.

   Not a summary of the records — the records themselves, bound. A cover
   sheet naming the unit, a contents page that says which document is on
   which page, a register of everything included, and then every report
   reproduced in full, each starting on its own page. That is what a
   customer is handed at delivery, and what an auditor reads years later:
   a narrative paragraph is not evidence, the signed reports are. */

const reportDate = (r) => r.values?.inspDate || r.updatedAt || r.createdAt

export default function MdrReport({ job, reports, session, onClose }) {
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

  // Every section owns a divider as well as its content sheets. Keep
  // both indices in the same plan so adding a divider cannot offset the
  // report register or the page numbers printed inside the bound reports.
  const FRONT = 7
  const TOC = 2, REGISTER = 4, DISPOSITION = 6
  const sheetsPer = printable.map((r) => reportSheetCount(FORM_SCHEMAS[r.formKey], r, rowFit[r.id], job))
  const sheetTotal = FRONT + printable.length + sheetsPer.reduce((a, b) => a + b, 0)
  const { spans, total: totalPages } = pageSpans(fit && fit.length === sheetTotal ? fit : oneEach(sheetTotal))
  let cursor = FRONT
  const items = printable.map((r, i) => {
    const sheets = sheetsPer[i], dividerAt = cursor, at = cursor + 1
    cursor += sheets + 1
    const schema = FORM_SCHEMAS[r.formKey]
    const title = schema.key === 'visual' && r.deliverable === 'PDI' ? 'Pre-Delivery Inspection Report' : schema.title
    return { r, schema, title, sheets, at, dividerAt,
      map: spans.slice(at, at + sheets), page: spans[at]?.[0] ?? 0,
      dividerPage: spans[dividerAt]?.[0] ?? 0, sectionNo: i + 3 }
  })

  /* The contents page is only worth printing if its numbers are true, so
     they come from what the paper did rather than from a sheet count — and
     a report whose sheets would not fit is given fewer rows per sheet and
     measured again, rather than left to flow and be estimated. */
  useSheetZoom(wrap)
  useFitToPage(wrap, [job.jobNo, reports.length, sheetTotal, Object.values(rowFit).join(',')], (f) => {
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

  /* A data book is the whole set or it is a draft of one. Whichever
     documents were ticked, the question the customer's copy answers is
     whether every deliverable the order asks for is in here and
     approved — so it is asked against job.required, not against the
     selection. A report on a form this build cannot reproduce is not
     bound, so it does not cover its deliverable either.

     Short of that the book still prints, because seeing the shape of it
     mid-job is useful. It just may not pass for the finished article:
     it is watermarked, it says what is missing, and it never says
     RELEASED FOR SHIPMENT. */
  const bound = new Set(items.map((it) => it.r.deliverable))
  const missing = requiredFor(job).filter((key) => !bound.has(key))
  const preview = missing.length > 0

  const dates = printable.map(reportDate).filter(Boolean).sort()
  const span = dates.length
    ? (dates.length > 1 ? `${fmtDate(dates[0])} — ${fmtDate(dates[dates.length - 1])}` : fmtDate(dates[0]))
    : '—'

  const kop = (sheetIndex) => <PrintHeader title="Manufacturing Data Report" number={mdrNo}
    from={spans[sheetIndex]?.[0] ?? sheetIndex + 1} to={spans[sheetIndex]?.[1] ?? sheetIndex + 1} total={totalPages}
    subtitle={preview ? 'Preview — incomplete document set' : 'Final documentation package'} metadata={[
      ['Form', 'FM-QC-MDR'], ['Revision', '0'], ['Job', job.jobNo], ['Issue date', fmtDate(today.toISOString())]
    ]} />
  const foot = (sheetIndex) => {
    const [from, to] = spans[sheetIndex] || [sheetIndex + 1, sheetIndex + 1]
    return <PrintFooter number={mdrNo} form="FM-QC-MDR Rev.0" jobNo={job.jobNo} from={from} to={to} total={totalPages} />
  }

  const divider = (index, title) => <MdrDivider title={title} number={mdrNo} jobNo={job.jobNo}
    from={spans[index]?.[0] ?? index + 1} to={spans[index]?.[1] ?? index + 1} total={totalPages} />

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
      <PrintToolbar title={preview ? 'Manufacturing Data Report — preview' : 'Manufacturing Data Report'}
        pages={totalPages} onClose={onClose} />

      {/* The pages keep their 210mm; this wrapper is what shrinks. */}
      <div className={`print-scaler${preview ? ' is-preview' : ''}`}>

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
            <div className="ps-cover-sub">Inspection &amp; Test Records — {preview ? 'Preview, Incomplete Document Set' : 'Final Documentation Package'}</div>
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

          {/* Three states, and the order matters. An incomplete book
              cannot release a unit however clean its results are, so
              preview is read first — a cover that said RELEASED with two
              deliverables still open would be the single most damaging
              sentence this app could print. */}
          <div className={`ps-verdict ${preview ? 'draft' : pass ? '' : 'hold'} ps-cover-verdict`}>
            {preview
              ? `PREVIEW — NOT FOR ISSUE. ${missing.length} required document${missing.length === 1 ? '' : 's'} not yet approved.`
              : pass
                ? 'RELEASED FOR SHIPMENT — the unit conforms to the applicable requirements.'
                : 'ON HOLD — pending closure of outstanding non-conformances.'}
          </div>
          {/* Naming them turns the stamp into a worklist. */}
          {preview && (
            <div className="ps-cover-missing">
              <span>Outstanding</span>
              <strong>{missing.join(' · ')}</strong>
            </div>
          )}

          <div className="ps-cover-signs">{signRow}</div>

          <div className="ps-cover-foot">
            This data report and its attachments form one indivisible document. {mdrNo} · Revision 0 · {totalPages} pages.
          </div>
        </div>
      </div>

      {divider(TOC - 1, 'Table of Contents')}
      {/* ══════════ TABLE OF CONTENTS ══════════ */}
      <div className="print-sheet ps-sheet-break">
        <table className="ps-doc">
          {kop(TOC)}{foot(TOC)}
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
                  <td>{spans[REGISTER - 1]?.[0]}</td>
                </tr>
                <tr>
                  <td>2</td><td className="ps-left">Disposition &amp; Approvals</td>
                  <td className="ps-left">{mdrNo}</td><td>{fmtDate(today.toISOString())}</td>
                  <td className={pass ? 'ps-result-acc' : 'ps-result-rej'}>{pass ? 'ACCEPT' : 'HOLD'}</td>
                  <td>{spans[DISPOSITION - 1]?.[0]}</td>
                </tr>
                {items.map((it) => {
                  const res = reportResult(it.r)
                  return (
                    <tr key={it.r.id}>
                      <td>{it.sectionNo}</td>
                      <td className="ps-left">{it.title}</td>
                      <td className="ps-left">{it.r.reportId}</td>
                      <td>{fmtDate(reportDate(it.r))}</td>
                      <td className={res === 'Accept' ? 'ps-result-acc' : 'ps-result-rej'}>{res.toUpperCase()}</td>
                      <td>{it.dividerPage}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="ps-toc-note">
              Page references point to each section divider. The named document begins on the following page.
            </div>
          </td></tr></tbody>
        </table>
      </div>

      {divider(REGISTER - 1, 'Document Control & Inspection Register')}
      {/* ══════════ SECTION 1 — document control & register ══════════ */}
      <div className="print-sheet ps-sheet-break">
        <table className="ps-doc">
          {kop(REGISTER)}{foot(REGISTER)}
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
                        <td className="ps-left">{it.title}</td>
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

      {divider(DISPOSITION - 1, 'Disposition & Approvals')}
      <div className="print-sheet ps-sheet-break">
        <table className="ps-doc">
          {kop(DISPOSITION)}{foot(DISPOSITION)}
          <tbody><tr><td className="ps-runcell ps-body">
            <div className="ps-tab"><span className="ps-tab-no">Section 2</span><span className="ps-tab-title">Disposition &amp; Approvals</span></div>
            <div className="ps-mt-4">
              <table><tbody><tr><td className="ps-section-bar">2.1 · Disposition</td></tr></tbody></table>
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
                        Non-conforming results are recorded in: {rejected.map((it) => `${it.title} (${it.r.reportId}, Section ${it.sectionNo})`).join('; ')}.
                        Reference is made to the associated Non-Conformance Reports for disposition and corrective action.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="ps-mt-4">
              <table><tbody><tr><td className="ps-section-bar">2.2 · Certification &amp; Approvals</td></tr></tbody></table>
              {signRow}
            </div>
          </td></tr></tbody>
        </table>
      </div>

      {/* ══════════ the reports, in full ══════════ */}
      {items.map((it) => <Fragment key={it.r.id}>
        {divider(it.dividerAt, it.title)}
        <ReportSheets schema={it.schema} report={it.r} job={job}
          deliverable={it.r.deliverable} status={it.r.status} rowFit={rowFit[it.r.id]}
          pageMap={it.map} pageTotal={totalPages} sectionNo={it.sectionNo} breakFirst />
      </Fragment>)}
      </div>
    </div>
  )
}
