import { useEffect, useState } from 'react'
import { COMPANY } from '../lib/company.js'
import { useApp, navigate } from '../App.jsx'
import { ROLES } from '../lib/constants.js'
import { storageUsage, fmtBytes } from '../lib/storage.js'
import { IconList, IconFile, IconGrid, IconDatabase, IconLock, IconPrint } from './Icons.jsx'

/* Help that answers what this build actually does, rather than a page of
   links to a support desk that does not exist. Three things a new
   inspector or auditor asks: where do I do the work, what am I allowed
   to do, and where does any of this live. */

const SCREENS = [
  { icon: IconList, name: 'Jobs', to: '/jobs',
    what: 'The register of units under inspection. A job comes from a job order: one purchase order covering one or more units, each with its own job number, WBS and description.' },
  { icon: IconFile, name: 'Reports', to: '/reports',
    what: 'Every inspection document, filled or attached, with its verdict. Opening one shows the record; approving happens inside the document, not from the list.' },
  { icon: IconGrid, name: 'Monitor', to: '/monitor',
    what: 'The job × report matrix. One row per job, one cell per required report — the fastest way to see what is missing before a delivery date.' },
]

const STEPS = [
  ['Raise the job order', 'QC head or admin enters the PO, the units it covers, and which reports every unit has to produce.'],
  ['Inspect', 'An inspector opens a unit and fills only the reports that order asked for. Page 1 of every form is the job identity, quoted from the order and not editable.'],
  ['Submit and approve', 'A submitted report becomes read-only. An admin opens it and approves it there, where the evidence is.'],
  ['Issue the data book', 'Generate MDR binds the approved documents behind a cover, a contents page and a register — each report in full, on its own page.'],
]

export default function Help() {
  const { role, tick } = useApp()
  const [used, setUsed] = useState(() => storageUsage())
  useEffect(() => { setUsed(storageUsage()) }, [tick])

  return (
    <div className="page help">
      <p className="page-sub help-lede">
        {COMPANY.name} · QA/QC inspection records. This build runs entirely in your
        browser — there is no server behind it — which shapes most of the answers below.
      </p>

      <section className="help-sec">
        <h3>Where the work happens</h3>
        <div className="help-cards">
          {SCREENS.map((s) => (
            <button key={s.name} className="help-card" onClick={() => navigate(s.to)}>
              <span className="help-card-ico"><s.icon size={16} /></span>
              <strong>{s.name}</strong>
              <span>{s.what}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="help-sec">
        <h3>How a report gets issued</h3>
        <ol className="help-steps">
          {STEPS.map(([t, d], i) => (
            <li key={t}>
              <span className="help-step-n">{i + 1}</span>
              <span className="help-step-text"><strong>{t}</strong><small>{d}</small></span>
            </li>
          ))}
        </ol>
      </section>

      <section className="help-sec">
        <h3>What your role can do</h3>
        <div className="card help-roles">
          <table className="detail-table">
            <thead>
              <tr><th className="detail-left">Role</th><th>Fill forms</th><th>Approve &amp; override</th><th>Raise job orders</th></tr>
            </thead>
            <tbody>
              {Object.entries(ROLES).map(([key, r]) => (
                <tr key={key} className={r.label === role.label ? 'is-you' : ''}>
                  <td className="detail-left">
                    {r.label}{r.label === role.label && <span className="help-you">you</span>}
                  </td>
                  <td>{r.canEdit ? 'Yes' : '—'}</td>
                  <td>{r.canOverride ? 'Yes' : '—'}</td>
                  <td>{r.canManage ? 'Yes' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="help-sec">
        <h3>Good to know</h3>
        <div className="help-notes">
          <div className="help-note">
            <span className="help-note-ico"><IconDatabase size={15} /></span>
            <div>
              <strong>Everything is stored in this browser</strong>
              <p>
                Reports, photos and signatures live in this browser's storage — currently
                {' '}{fmtBytes(used.bytes)} of about {fmtBytes(used.budget)} ({used.pct}%). Clearing site data
                erases them, and they do not follow you to another machine. Export the CSV or
                the PDF for anything you need to keep.
              </p>
            </div>
          </div>
          <div className="help-note">
            <span className="help-note-ico"><IconPrint size={15} /></span>
            <div>
              <strong>PDFs come from the browser's print dialog</strong>
              <p>
                Both the single report and the data book open a preview; “Print / Save as PDF”
                hands it to your browser. Choose A4 and leave scaling at 100% — the pages are
                sized to fit, and the contents page counts on it.
              </p>
            </div>
          </div>
          <div className="help-note">
            <span className="help-note-ico"><IconLock size={15} /></span>
            <div>
              <strong>Keyboard</strong>
              <p><kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>K</kbd> searches jobs from anywhere. <kbd>Esc</kbd> closes any panel.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="help-sec">
        <h3>Something looks wrong</h3>
        <p className="page-sub">
          Note the report number and what you expected to see, then tell whoever maintains this
          build for {COMPANY.name}. If a screen is stuck, reloading is safe: nothing is held in
          memory that is not already saved.
          {role.canManage && ' Storage & reset in Settings can clear the local data if a record is beyond repair.'}
        </p>
        {role.canManage && (
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/settings?s=storage')}>
            Open Storage &amp; reset
          </button>
        )}
      </section>
    </div>
  )
}
