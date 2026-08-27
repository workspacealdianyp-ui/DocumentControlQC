import { COMPANY } from '../lib/company.js'
import { useEffect } from 'react'
import { FORM_SCHEMAS, dimRowStatus } from '../data/formSchemas.js'
import { fmtDate } from '../lib/status.js'
import { IconPrint } from './Icons.jsx'

// Final verdict of an individual report (ported engine model: values + results/readings)
export const reportResult = (r) => {
  const v = r.values || {}
  if (v.testResult) return v.testResult === 'Unsatisfactory' ? 'Reject' : 'Accept'
  if (v.finalStatus) return v.finalStatus === 'Reject' ? 'Reject' : 'Accept'
  const results = r.results || []
  if (results.length) {
    if (r.formKey === 'dimensional') return results.some((row) => dimRowStatus(row) === 'Reject') ? 'Reject' : 'Accept'
    const rejVals = ['Reject', 'Rej', 'NG']
    return results.some((row) => rejVals.includes(row.judgement)) ? 'Reject' : 'Accept'
  }
  if ((r.readings || []).some((row) => /fail|leak|drop/i.test(row.remark || ''))) return 'Reject'
  return 'Accept'
}

function narrative(job, reports) {
  const dates = reports.map((r) => r.values?.inspDate || r.updatedAt?.slice(0, 10)).filter(Boolean).sort()
  const first = dates[0] ? fmtDate(dates[0]) : '—'
  const last = dates[dates.length - 1] ? fmtDate(dates[dates.length - 1]) : '—'
  const titles = reports.map((r) => FORM_SCHEMAS[r.formKey]?.title.replace(' Report', '')).join(', ')
  const rejected = reports.filter((r) => reportResult(r) === 'Reject')

  let p = `This summary consolidates the quality-control inspection records for the unit ${job.productDesc} ` +
    `(Job No. ${job.jobNo}; Serial No. ${job.arasSN || 'N/A'}; WBS ${job.wbsNo || 'N/A'}) manufactured for ${job.customerName}. ` +
    `${dates.length > 1 ? `Between ${first} and ${last}` : `On ${first}`}, the unit underwent ${reports.length} approved inspection${reports.length === 1 ? '' : 's'}: ${titles}. `

  if (rejected.length === 0) {
    p += `All inspections were completed in accordance with the applicable procedures and acceptance criteria, ` +
      `and all results were found acceptable with no outstanding non-conformances recorded against this unit.`
  } else {
    p += `The following inspection${rejected.length === 1 ? '' : 's'} recorded non-conforming results: ` +
      `${rejected.map((r) => `${FORM_SCHEMAS[r.formKey]?.title} (${r.reportId})`).join('; ')}. ` +
      `Reference is made to the associated Non-Conformance Reports for the disposition and corrective actions.`
  }
  return { text: p, pass: rejected.length === 0 }
}

export default function SummaryReport({ job, reports, session, onClose }) {
  useEffect(() => {
    document.body.classList.add('printing')
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.classList.remove('printing')
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const today = new Date()
  const sumNo = `${COMPANY.short}/SUM/${job.jobNo}/${String(today.getFullYear()).slice(2)}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
  const { text, pass } = narrative(job, reports)

  return (
    <div className="print-overlay">
      <div className="print-toolbar">
        <button className="btn btn-primary" onClick={() => window.print()}>
          <IconPrint size={15} /> Print / Save as PDF
        </button>
        <button className="btn btn-secondary" onClick={onClose}>Close preview</button>
      </div>

      <div className="print-sheet">
        {/* header */}
        <table className="ps-header">
          <tbody>
            <tr>
              <td className="ps-logo-cell"><span className="ps-logo">{COMPANY.short}</span></td>
              <td className="ps-company">
                <div className="ps-co-name">{COMPANY.legalName.toUpperCase()}</div>
                <div className="ps-co-sub">QA / QC DEPARTMENT — INSPECTION &amp; TEST RECORD</div>
                <div className="ps-doc-title">Inspection Summary Report</div>
              </td>
              <td className="ps-meta-cell">
                <table>
                  <tbody>
                    <tr><td className="ps-meta-label">Summary No.</td><td>{sumNo}</td></tr>
                    <tr><td className="ps-meta-label">Date</td><td>{fmtDate(today.toISOString())}</td></tr>
                    <tr><td className="ps-meta-label">Form Code</td><td>FM-QC-SUM Rev.0</td></tr>
                    <tr><td className="ps-meta-label">Documents</td><td>{reports.length} approved</td></tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        {/* 1 — job information */}
        <table><tbody><tr><td className="ps-section-bar">1 · Unit / Job Information</td></tr></tbody></table>
        <table>
          <tbody>
            <tr>
              <td className="ps-label">Job Number</td><td className="ps-value">{job.jobNo}</td>
              <td className="ps-label">WBS No.</td><td className="ps-value">{job.wbsNo || '—'}</td>
            </tr>
            <tr>
              <td className="ps-label">Product</td><td className="ps-value" colSpan={3}>{job.productDesc}</td>
            </tr>
            <tr>
              <td className="ps-label">Serial No.</td><td className="ps-value">{job.arasSN || '—'}</td>
              <td className="ps-label">Category / Type</td><td className="ps-value">{job.kategori} / {job.type}</td>
            </tr>
            <tr>
              <td className="ps-label">Customer</td><td className="ps-value">{job.customerName}</td>
              <td className="ps-label">PDI Release</td><td className="ps-value">{fmtDate(job.datePdiRelease)}</td>
            </tr>
          </tbody>
        </table>

        {/* 2 — inspections performed */}
        <div className="ps-mt-4">
          <table><tbody><tr><td className="ps-section-bar">2 · Inspections Performed (approved documents)</td></tr></tbody></table>
          <table className="ps-grid">
            <thead>
              <tr>
                <th style={{ width: '8mm' }}>No</th>
                <th>Report No.</th>
                <th>Inspection</th>
                <th style={{ width: '22mm' }}>Date</th>
                <th>Inspector</th>
                <th style={{ width: '18mm' }}>Result</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r, i) => {
                const res = reportResult(r)
                return (
                  <tr key={r.id}>
                    <td>{i + 1}</td>
                    <td className="ps-left">{r.reportId}</td>
                    <td className="ps-left">{FORM_SCHEMAS[r.formKey]?.title}</td>
                    <td>{fmtDate(r.values?.inspDate || r.updatedAt)}</td>
                    <td>{r.inspector}</td>
                    <td className={res === 'Accept' ? 'ps-result-acc' : 'ps-result-rej'}>{res.toUpperCase()}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* 3 — narrative */}
        <div className="ps-mt-4">
          <table><tbody><tr><td className="ps-section-bar">3 · Summary Narrative</td></tr></tbody></table>
          <table><tbody><tr><td style={{ textAlign: 'justify', padding: '6pt 8pt', lineHeight: 1.55 }}>{text}</td></tr></tbody></table>
        </div>

        {/* 4 — disposition */}
        <div className="ps-mt-4">
          <table><tbody><tr><td className="ps-section-bar">4 · Disposition</td></tr></tbody></table>
          <table>
            <tbody>
              <tr>
                <td className={`ps-verdict ${pass ? '' : 'hold'}`}>
                  {pass
                    ? 'RELEASED FOR SHIPMENT — the unit conforms to the applicable requirements.'
                    : 'ON HOLD — pending closure of outstanding non-conformances.'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 5 — approvals */}
        <div className="ps-mt-4">
          <table><tbody><tr><td className="ps-section-bar">5 · Approvals</td></tr></tbody></table>
          <table className="ps-sign-table">
            <tbody>
              <tr className="ps-sign-head">
                <td>Prepared by</td><td>QC Supervisor</td><td>Customer Representative</td>
              </tr>
              <tr>
                <td>
                  <div className="ps-sign-script">{session.name}</div>
                  <div className="ps-sign-name">{session.name}</div>
                  <div className="ps-sign-date">{today.toLocaleString()}</div>
                </td>
                <td>
                  <div style={{ height: '14mm' }} />
                  <div className="ps-sign-name">Name / Signature</div>
                  <div className="ps-sign-date">Date:</div>
                </td>
                <td>
                  <div style={{ height: '14mm' }} />
                  <div className="ps-sign-name">Name / Signature</div>
                  <div className="ps-sign-date">Date:</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="ps-footer">
          <span>FM-QC-SUM Rev.0 — Generated by QC Inspection Monitor</span>
          <span>Job {job.jobNo} · Page 1 of 1</span>
        </div>
      </div>
    </div>
  )
}
