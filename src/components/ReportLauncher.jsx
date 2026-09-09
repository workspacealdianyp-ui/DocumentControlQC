import { useState } from 'react'
import { useApp, navigate } from '../App.jsx'
import { allJobs } from '../lib/jobOrders.js'
import { getReports } from '../lib/store.js'
import { buildContext } from '../lib/status.js'
import { REPORT_CHOICES, reportCode, canStartFor, existingFor } from '../lib/reportChoices.js'
import { reportPath, REPORT_LABELS } from '../lib/homeOverview.js'
import PickerDialog from './PickerDialog.jsx'
import { JobChoices } from './JobPicker.jsx'

const GROUPS = ['Inspection', 'NDE', 'Final inspection', 'Document record']

export default function ReportLauncher({ initial, onClose }) {
  const { role } = useApp()
  const [choice, setChoice] = useState(() => REPORT_CHOICES.find((c) => c.id === initial) || null)
  const [finalOnly, setFinalOnly] = useState(initial === 'final')
  const [existing, setExisting] = useState(null)
  const [error, setError] = useState('')
  const ctx = buildContext()
  if (!role.canEdit) return null

  const selectJob = (jobNo) => {
    const job = allJobs().find((j) => String(j.jobNo) === String(jobNo))
    const reports = getReports()
    if (!canStartFor(job, choice, buildContext(reports))) {
      setError(job ? 'This deliverable is no longer required for this job.' : 'This job is no longer available.')
      return
    }
    const held = existingFor(reports, jobNo, choice)
    if (held) { setExisting(held); setError(''); return }
    onClose()
    navigate(`/job/${jobNo}/form/${choice.key}?d=${encodeURIComponent(choice.deliverable)}`)
  }
  const openExisting = () => {
    const reports = getReports()
    const current = existingFor(reports, existing.jobNo, choice)
    const job = allJobs().find((j) => String(j.jobNo) === String(existing.jobNo))
    if (!job || !current) { setError('This record is no longer available. Choose the job again.'); return }
    onClose()
    navigate(reportPath(current))
  }
  const back = () => { setError(''); if (existing) setExisting(null); else if (choice) setChoice(null); else setFinalOnly(false) }
  return <PickerDialog title={existing ? 'A report is already on file' : choice ? 'Choose the job' : finalOnly ? 'Choose the final inspection' : 'New report'}
    sub={existing ? `${choice.label} · Job ${existing.jobNo}` : choice ? `${choice.label} · ${choice.deliverable}` : 'Choose what you are recording. Select the job next.'}
    onClose={onClose} onBack={choice || finalOnly ? back : undefined} step={existing ? 'existing' : choice?.id || (finalOnly ? 'final' : 'types')}>
    {error && <p role="alert" className="picker-error">{error}</p>}
    {existing ? <div className="picker-existing">
      <strong>{existing.reportId}</strong>
      <p>{REPORT_LABELS[existing.status] || existing.status}</p>
      <p>{existing.status === 'approved' ? 'Open the approved record to view its evidence or raise an amendment through the existing review controls.' : 'Continue with the existing record to keep its history together.'}</p>
      <button type="button" className="btn btn-primary" onClick={openExisting}>Open existing report</button>
    </div> : choice ? <JobChoices onPick={selectJob} unavailable={(job) => canStartFor(job, choice, ctx) ? null : 'Not required for this job'} /> : (
      (finalOnly ? ['Final inspection'] : GROUPS).map((group) => <section className="picker-group" key={group}>
        <h3>{group}</h3>
        {group === 'Document record' && <p>File the reference and evidence of a signed document.</p>}
        <div className="picker-types">{REPORT_CHOICES.filter((c) => c.group === group).map((c) => (
          <button type="button" key={c.id} className="picker-type" aria-label={`${reportCode(c)} ${c.label}`} onClick={() => setChoice(c)}>
            <b>{reportCode(c)}</b><span>{c.label}</span>
          </button>
        ))}</div>
      </section>)
    )}
  </PickerDialog>
}
