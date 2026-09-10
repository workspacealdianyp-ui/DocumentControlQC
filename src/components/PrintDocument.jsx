import { COMPANY } from '../lib/company.js'
import { IconPrint } from './Icons.jsx'

export function PrintHeader({ title, number, metadata, form, revision, from, to = from, total, subtitle = 'Inspection & test record', compact = false }) {
  const controls = [['Form no.', form || metadata.find(([label]) => label === 'Form')?.[1]], ['Revision', revision ?? metadata.find(([label]) => label === 'Revision')?.[1]], ['Page', from === to ? `${from} of ${total}` : `${from}–${to} of ${total}`]]
  const details = metadata.filter(([label]) => !['Form', 'Revision'].includes(label))
  return <thead><tr><td className="ps-runcell">
    <div className={`ps-letterhead${compact ? ' is-attachment' : ''}`}>
      <table className="ps-brand"><tbody><tr>
        <td className="ps-brand-mark"><span className="ps-logo">{COMPANY.short}</span></td>
        <td className="ps-brand-company"><div className="ps-co-name">{COMPANY.legalName}</div><div className="ps-co-sub">{COMPANY.department || 'QA / QC Department'}</div></td>
        <td className="ps-form-control"><table><tbody>{controls.map(([label, value]) => <tr key={label}><th scope="row">{label}</th><td>{value ?? '—'}</td></tr>)}</tbody></table></td>
      </tr></tbody></table>
      <div className="ps-title-line"><h1>{title}</h1></div>
      <table className="ps-control" aria-label={subtitle}><tbody><tr><td className="ps-number"><span>Report no.</span><strong>{number || '—'}</strong></td>{details.map(([label, value]) => <td key={label}><span>{label}</span><strong>{value ?? '—'}</strong></td>)}</tr></tbody></table>
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
