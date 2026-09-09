import { COMPANY } from '../lib/company.js'
import { IconPrint } from './Icons.jsx'

export function PrintHeader({ title, number, metadata, subtitle = 'Inspection & test record', compact = false }) {
  return <thead><tr><td className="ps-runcell">
    <div className={`ps-letterhead${compact ? ' is-attachment' : ''}`}>
      <table className="ps-brand"><tbody><tr>
        <td className="ps-brand-mark"><span className="ps-logo">{COMPANY.short}</span></td>
        <td><div className="ps-co-name">{COMPANY.legalName}</div><div className="ps-co-sub">{COMPANY.department || 'QA / QC Department'} · {subtitle}</div></td>
      </tr></tbody></table>
      <div className="ps-title-line"><h1>{title}</h1><div className="ps-number"><span>Document no.</span><strong>{number || '—'}</strong></div></div>
      <table className="ps-control"><tbody><tr>{metadata.map(([label, value]) => <td key={label}><span>{label}</span><strong>{value || '—'}</strong></td>)}</tr></tbody></table>
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
