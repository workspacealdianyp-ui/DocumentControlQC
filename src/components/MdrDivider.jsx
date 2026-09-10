import { PrintFooter } from './PrintDocument.jsx'

// Vector geometry stays crisp on paper without adding an image asset.
// Color is limited to the dividers; inspection evidence remains neutral.
export default function MdrDivider({ title, number, jobNo, from, to, total }) {
  return <div className="print-sheet ps-sheet-break ps-divider-sheet" data-divider-title={title}>
    <table className="ps-doc"><PrintFooter number={number} form="FM-QC-MDR Rev.0" jobNo={jobNo} from={from} to={to} total={total} />
      <tbody><tr><td className="ps-runcell">
        <div className="ps-divider">
          <svg className="ps-divider-art" viewBox="0 0 760 980" aria-hidden="true" focusable="false">
            <rect width="760" height="980" fill="#f3f5f4" />
            <path d="M0 0H208L0 208Z" fill="#dbe5e8" />
            <path d="M760 980H538L760 758Z" fill="#e6ae82" />
            <g fill="none" stroke="#bccdd1" strokeWidth="1.3">
              <path d="M30 120H280V30M30 150H310V30M730 840H480V950M730 810H450V950" />
              <circle cx="680" cy="155" r="74" /><circle cx="680" cy="155" r="52" />
              <path d="M680 60V250M585 155H760M0 805H170V975M0 835H140V975" />
            </g>
            <path d="M332 405H428" stroke="#b96732" strokeWidth="4" />
          </svg>
          <div className="ps-divider-title"><h1>{title}</h1></div>
        </div>
      </td></tr></tbody>
    </table>
  </div>
}
