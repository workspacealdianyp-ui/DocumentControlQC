import { Fragment } from 'react'
import { COMPANY } from '../lib/company.js'
import { IconPrint } from './Icons.jsx'

/* `continuation` drops the identity table. Page 1 states what the record
   is; a sheet that continues it says so in the line under the letterhead
   and again in the footer, and a second copy of the report number, job,
   date and inspector on every page is four facts restated to say nothing
   new. The form number, revision and page count stay — those belong to
   the sheet rather than to the record. */
export function PrintHeader({ title, number, metadata, form, revision, from, to = from, total, subtitle = 'Inspection & test record', compact = false, continuation = false }) {
  const controls = [['Form no.', form || metadata.find(([label]) => label === 'Form')?.[1]], ['Revision', revision ?? metadata.find(([label]) => label === 'Revision')?.[1]], ['Page', from === to ? `${from} of ${total}` : `${from}–${to} of ${total}`]]
  const details = metadata.filter(([label]) => !['Form', 'Revision', 'Status'].includes(label))
  return <thead><tr><td className="ps-runcell">
    <div className={`ps-letterhead${compact ? ' is-attachment' : ''}${continuation ? ' is-continuation' : ''}`}>
      <table className="ps-brand"><tbody><tr>
        <td className="ps-brand-mark"><span className="ps-logo">{COMPANY.short}</span></td>
        <td className="ps-brand-company"><div className="ps-co-name">{COMPANY.legalName}</div><div className="ps-co-sub">{COMPANY.department || 'QA / QC Department'}</div></td>
        <td className="ps-form-control"><table><tbody>{controls.map(([label, value]) => <tr key={label}><th scope="row">{label}</th><td>{value ?? '—'}</td></tr>)}</tbody></table></td>
      </tr></tbody></table>
      <div className="ps-title-line"><h1>{title}</h1></div>
      {continuation ? null : (
        <table className="ps-control" aria-label={subtitle}><colgroup><col style={{ width: '26mm' }} /><col style={{ width: '69mm' }} /><col style={{ width: '26mm' }} /><col style={{ width: '69mm' }} /></colgroup><tbody>
          {Array.from({ length: Math.ceil((details.length + 1) / 2) }, (_, i) => [['Report no.', number], ...details].slice(i * 2, i * 2 + 2)).map((row, i) => <tr key={i}>{row.map(([label, value]) => <Fragment key={label}>
            <th scope="row">{label}</th><td className={label === 'Report no.' ? 'ps-number' : ''} colSpan={row.length === 1 ? 3 : 1}><strong>{value ?? '—'}</strong></td>
          </Fragment>)}</tr>)}
        </tbody></table>
      )}
    </div>
  </td></tr></thead>
}

export function PrintFooter({ number, form, jobNo, from, to = from, total }) {
  return <tfoot><tr><td className="ps-runcell"><div className="ps-footer">
    <span>{form || 'QC Inspection Monitor'}{jobNo ? ` · Job ${jobNo}` : ''}</span>
    <span>{number}</span><strong>Page {from === to ? from : `${from}–${to}`} of {total}</strong>
  </div></td></tr></tfoot>
}

export function PrintToolbar({ title, pages, onClose }) {
  return <div className="print-toolbar"><div className="print-toolbar-info"><strong>{title}</strong><span>A4 portrait · {pages} {pages === 1 ? 'page' : 'pages'}</span></div>
    <div className="print-toolbar-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>Close preview</button><button type="button" className="btn btn-primary" onClick={() => window.print()}><IconPrint size={15} /> Print / Save as PDF</button></div>
  </div>
}
