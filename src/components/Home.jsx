import { useMemo, useState } from 'react'
import { useApp } from '../App.jsx'
import { FORM_SCHEMAS } from '../data/formSchemas.js'
import miningArt from '../assets/home-mining.webp'
import { COMPANY } from '../lib/company.js'
import { getReportsChecked, getReport } from '../lib/store.js'
import { allJobs } from '../lib/jobOrders.js'
import { buildContext, fmtDate, fmtDateTime } from '../lib/status.js'
import { byCustomer } from '../lib/rollup.js'
import { homeOverview, reportPath, REPORT_LABELS } from '../lib/homeOverview.js'
import { scopeReports, sortReview } from '../lib/reportScope.js'
import { REPORT_CHOICES, reportCode } from '../lib/reportChoices.js'
import { useCalendarDate } from '../lib/useCalendarDate.js'
import { IconPlus, IconChevronR } from './Icons.jsx'
import ReportLauncher from './ReportLauncher.jsx'
import './Home.css'

const href = (path) => `#${path}`
const register = (f = 'all', scope = '') => `#/reports?f=${f}${scope ? `&scope=${scope}` : ''}`
const monitor = (state = '') => `#/monitoring?view=all&from=home${state ? `&state=${state}` : ''}`
const at = (value) => value && !Number.isNaN(new Date(value).getTime()) ? fmtDateTime(value) : 'Date unavailable'
const plural = (n, noun) => `${n} ${noun}${n === 1 ? '' : 's'}`
const recentFirst = (a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')

function Panel({ id, title, note, count, tools, footer, children }) {
  return <section className="home-panel" aria-labelledby={id}>
    <header className="home-panel-head"><div><h2 id={id}>{title}</h2>{note && <p>{note}</p>}</div>{count !== undefined && <span className="home-count">{count}</span>}</header>
    {tools && <div className="home-panel-tools">{tools}</div>}
    <div className="home-panel-content">{children}</div>
    {footer && <footer className="home-panel-footer">{footer}</footer>}
  </section>
}

function ReportRows({ records, review, onOpen, session, empty }) {
  if (!records.length) return <p className="home-empty">{empty}</p>
  return <ul className="home-records">{records.slice(0, 5).map((r) => <li key={r.id}>
    <a className="home-report-row" href={href(reportPath(r))} onClick={(e) => onOpen(e, r)} aria-label={`Open report ${r.reportId}`}>
      <span className={`home-form-code is-${r.status}`}>{FORM_SCHEMAS[r.formKey]?.code || 'DOC'}</span>
      <span className="home-report-copy"><strong>{r.reportId}</strong>
        <span>Job {r.jobNo} · {REPORT_LABELS[r.status] || r.status}</span>
        {r.status === 'returned' && r.returnNote && <span className="home-return-note">{r.returnNote}</span>}
        <small>{review && r.inspector === session.name ? 'Submitted by you · ' : review ? `${r.inspector || 'Inspector not recorded'} · ` : ''}{at(review ? r.submittedAt || r.updatedAt : r.updatedAt)}</small>
      </span>
      <span className="home-row-action">{review ? 'Review' : r.status === 'returned' ? 'Revise' : r.status === 'draft' ? 'Continue' : 'View'}<IconChevronR size={13} /></span>
    </a>
  </li>)}</ul>
}

function JobPanel({ data, role, onJob, overview = false }) {
  const [filter, setFilter] = useState('all')
  const source = overview ? data.units : data.attention
  const rows = source.filter((r) => filter === 'all' || (filter === 'overdue' ? r.late.length : r.ncr))
  return <Panel id="home-jobs-title" title={overview ? 'Job overview' : 'Needs attention'} note={overview ? 'Required documents and recorded progress' : 'Overdue documents and NCR reports'} count={rows.length}
    tools={<div className="home-tabs" role="group" aria-label="Filter attention jobs">{[['all', overview ? 'All jobs' : 'All attention'], ['overdue', 'Overdue'], ['ncr', 'NCR']].map(([id, label]) => <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div>}
    footer={<><span>Showing {Math.min(5, rows.length)} of {rows.length}</span><a href={filter === 'ncr' ? register('ncr') : monitor(filter === 'overdue' ? 'overdue' : '')}>{filter === 'ncr' ? 'Open NCR reports' : 'Open monitoring'}</a></>}>
    {rows.length ? <ul className="home-records">{rows.slice(0, 5).map(({ job, progress, late, ncr, target }) => <li key={job.jobNo}>
      <a className="home-job-row" href={href(`/job/${job.jobNo}`)} onClick={(e) => onJob(e, job.jobNo)} aria-label={`Open job ${job.jobNo}`}>
        <span className="home-job-copy"><strong>{job.jobNo}</strong><span>{job.productDesc || 'Product not set'} · {job.customerName || 'Customer not set'}</span>
          <small className={ncr || late.length ? 'home-alert-text' : ''}>{ncr ? `${plural(ncr, 'NCR report')} · ` : ''}{late.length ? `${plural(late.length, 'overdue document')} · ` : ''}{target ? `Target ${fmtDate(`${target}T00:00:00`)}` : 'Target date not set'}</small>
        </span><span className="home-progress-read"><strong>{progress.done}/{progress.applicable}</strong><small>complete</small><span className="home-progress"><span style={{ width: `${progress.applicable ? progress.done / progress.applicable * 100 : 0}%` }} /></span></span>
      </a>
    </li>)}</ul> : <div className="home-empty"><p>{data.units.length ? 'No jobs match this view. Choose another filter or open monitoring.' : 'No jobs have been registered yet.'}</p>{!data.units.length && role.canManage && <a href="#/monitoring/new">New job order</a>}</div>}
    {data.unavailableNcr > 0 && <p className="home-panel-note"><a href={register('ncr')}>{plural(data.unavailableNcr, 'NCR report')} with unavailable jobs</a></p>}
  </Panel>
}

function CustomerPanel({ customers }) {
  return <Panel id="home-customers-title" title="Customer progress" note="Most unfinished units first" footer={<a href={monitor()}>Browse customers and jobs</a>}>
    {customers.length ? <ul className="home-records">{customers.slice(0, 4).map((c) => <li key={c.name}><a className="home-summary-row" href={href(`/customer/${encodeURIComponent(c.name)}`)}>
      <span><strong>{c.name}</strong><small>{plural(c.open, 'open unit')}{c.overdue ? ` · ${c.overdue} overdue` : ''}</small></span><span className="home-summary-number">{c.applicable ? `${c.pct}%` : '—'}<small>{c.done}/{c.applicable}</small></span>
    </a></li>)}</ul> : <p className="home-empty">Customer progress appears when a job is registered.</p>}
  </Panel>
}

function WorkloadPanel({ records }) {
  const counts = new Map()
  for (const r of records.filter((r) => ['draft', 'returned', 'submitted'].includes(r.status))) {
    const name = r.inspector || 'Not recorded'
    const row = counts.get(name) || { name, draft: 0, returned: 0, submitted: 0, total: 0 }
    row[r.status]++; row.total++; counts.set(name, row)
  }
  const rows = [...counts.values()].sort((a, b) => b.returned - a.returned || b.total - a.total || a.name.localeCompare(b.name))
  return <Panel id="home-workload-title" title="Inspector documents" note="Open records, not assigned inspections" footer={<a href={register('all', 'unfinished')}>All unfinished reports</a>}>
    {rows.length ? <table className="home-workload"><thead><tr><th>Inspector</th><th>Draft</th><th>Back</th><th>QA</th></tr></thead><tbody>{rows.slice(0, 4).map((r) => <tr key={r.name}><th>{r.name === 'Not recorded' ? r.name : <a href={`${register('all', 'unfinished')}&author=${encodeURIComponent(r.name)}`}>{r.name}</a>}</th><td>{r.draft}</td><td className={r.returned ? 'home-alert-text' : ''}>{r.returned}</td><td>{r.submitted}</td></tr>)}</tbody></table> : <p className="home-empty">No draft, returned or submitted reports on file.</p>}
  </Panel>
}

function ReadinessPanel({ data, onJob }) {
  const units = data.units.filter((r) => r.progress.applicable).sort((a, b) => (a.progress.applicable - a.progress.done) - (b.progress.applicable - b.progress.done) || String(a.job.jobNo).localeCompare(String(b.job.jobNo)))
  return <Panel id="home-readiness-title" title="Document readiness" note="Check the required set before compiling MDR" footer={<a href={monitor()}>Check all job documents</a>}>
    {units.length ? <ul className="home-records">{units.slice(0, 4).map(({ job, progress, ncr }) => <li key={job.jobNo}><a className="home-summary-row" href={href(`/job/${job.jobNo}`)} onClick={(e) => onJob(e, job.jobNo)}>
      <span><strong>{job.jobNo}</strong><small>{ncr ? `${plural(ncr, 'NCR report')} to check` : progress.done === progress.applicable ? 'Check evidence and release status' : `${progress.applicable - progress.done} documents outstanding`}</small></span><span className="home-summary-number">{progress.done}/{progress.applicable}</span>
    </a></li>)}</ul> : <p className="home-empty">No jobs with required documents. Define the job scope before compiling an MDR.</p>}
  </Panel>
}

export function HomeDashboard({ data, customers, records, role, session, now, onOpen, onJob, onNew }) {
  const [ownWork, setOwnWork] = useState(false)
  const [tracking, setTracking] = useState('submitted')
  const mine = scopeReports(records, 'mine', session, role)
  const review = scopeReports(data.submitted, 'review', session, role).sort(sortReview)
  const technician = role.canEdit && !role.canOverride
  const viewer = !role.canEdit
  const head = session.role === 'admin'
  const queue = role.canOverride && !ownWork ? review : data.mine
  const reviewing = role.canOverride && !ownWork
  const reviewTitle = head ? 'Head review queue' : session.role === 'supervisor' ? 'QC review queue' : 'Your review queue'
  const personal = (status) => mine.filter((r) => r.status === status).length
  const summary = viewer || head ? [
    ['Deliverables complete', data.pct === null ? '—' : `${data.pct}%`, data.pct === null ? 'No required deliverables' : `${data.totals.done}/${data.totals.applicable} documents`, monitor()],
    ['Open jobs', data.totals.open, `of ${data.totals.jobs} jobs`, monitor('inprogress,overdue,notstarted')],
    [head ? 'For your review' : 'Awaiting QA', head ? review.length : data.counts.submitted, head ? 'Within your authority' : 'Submitted reports', register('submitted', head ? 'review' : '')],
    ['Overdue jobs', data.totals.overdue, plural(data.totals.gaps, 'overdue document'), monitor('overdue')],
  ] : technician ? [
    ['Sent back to you', personal('returned'), 'Needs revision', register('returned', 'mine')],
    ['Your drafts', personal('draft'), 'Continue recording', register('draft', 'mine')],
    ['Your awaiting QA', personal('submitted'), 'Submitted for review', register('submitted', 'mine')],
    ['Your approved', personal('approved'), 'Approved records', register('approved', 'mine')],
  ] : [
    ['For your review', review.length, 'Within your authority', register('submitted', 'review')],
    ['Your work', data.mine.length, 'Returned reports and drafts', register('all', 'work')],
    ['NCR reports', data.counts.ncr, 'Current reject verdicts', register('ncr')],
    ['Overdue jobs', data.totals.overdue, plural(data.totals.gaps, 'overdue document'), monitor('overdue')],
  ]
  const recent = [...(technician ? mine : records)].sort(recentFirst).slice(0, 3)
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening'
  let sharepoint = null
  try { const url = new URL(COMPANY.sharepointUrl); if (url.protocol === 'https:') sharepoint = url.href } catch { /* An unconfigured resource must not become a dead link. */ }
  return <div className="page home-page"><div className="home-dashboard">
    <header className="home-toolbar"><img src={miningArt} alt="" aria-hidden="true" />
      <div className="home-welcome"><span className="home-kicker">Fabrication &amp; Plant Cikupa</span><h1>{greeting},<br />{session.name}.</h1><p>{role.label} · {now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p><span className="home-banner-note">{viewer ? 'Follow each job through its inspection records.' : reviewing ? 'Review the evidence. Keep every release traceable.' : 'Record the inspection. Keep the work moving.'}</span></div>
      <div className="home-actions">{role.canOverride ? <><button className="btn btn-secondary" onClick={onNew}>New report</button><a className="btn btn-primary" href={register('submitted', 'review')}>Review reports</a></> : technician ? <button className="btn btn-primary" onClick={onNew}><IconPlus size={16} />New report</button> : <a className="btn btn-primary" href={monitor()}>Open monitoring</a>}</div>
    </header>
    <div className="home-overview-row"><section className="home-readings" aria-label="QC overview">{summary.map(([label, value, note, link]) => <a key={label} href={link}><span>{label}</span><strong>{value}</strong><small>{note}</small></a>)}</section>
      <nav className="home-resources" aria-label="QC resources"><a href={monitor()}>Dashboard</a><a href={register('ncr')}>NCR</a>{sharepoint ? <a href={sharepoint} target="_blank" rel="noopener noreferrer">SharePoint ↗</a> : <span aria-disabled="true">SharePoint<small>Not linked</small></span>}</nav>
    </div>
    {data.pct === null && !viewer && !head && <p className="home-context-note">No required deliverables</p>}
    {data.totals.overrides > 0 && <p className="home-context-note">Job completion includes {plural(data.totals.overrides, 'admin override')}. Confirm the evidence before release.</p>}
    <div className="home-row home-main-row">
      {viewer ? <JobPanel data={data} role={role} onJob={onJob} overview /> : <Panel id="home-work-title" title={reviewing ? reviewTitle : 'Your work'} count={queue.length} note={reviewing ? 'Oldest submission first; within your approval authority' : 'Sent back first, then your latest drafts'}
        tools={role.canOverride && <div className="home-tabs" role="group" aria-label="Choose work list"><button aria-pressed={!ownWork} onClick={() => setOwnWork(false)}>For review {review.length}</button><button aria-pressed={ownWork} onClick={() => setOwnWork(true)}>Your work {data.mine.length}</button></div>}
        footer={<><span>Showing {Math.min(5, queue.length)} of {queue.length}</span><a href={register(reviewing ? 'submitted' : 'all', reviewing ? 'review' : 'work')}>{reviewing ? 'View all for review' : 'View all your work'}</a></>}>
        <ReportRows records={queue} review={reviewing} onOpen={onOpen} session={session} empty={reviewing ? 'No reports awaiting your review. Your own drafts are available under Your work.' : 'No returned reports or drafts. Start a report when your next inspection is ready.'} />
      </Panel>}
      {technician || viewer ? <Panel id="home-tracking-title" title={viewer ? 'Approved reports' : 'Your submitted reports'} note={viewer ? 'Latest approved records' : 'Track review outcomes without opening each job'}
        tools={!viewer && <div className="home-tabs" role="group" aria-label="Track your reports"><button aria-pressed={tracking === 'submitted'} onClick={() => setTracking('submitted')}>Awaiting QA</button><button aria-pressed={tracking === 'approved'} onClick={() => setTracking('approved')}>Approved</button></div>}
        footer={<a href={register(viewer ? 'approved' : tracking, viewer ? '' : 'mine')}>View {viewer ? 'approved' : 'your'} reports</a>}>
        <ReportRows records={(viewer ? records : mine).filter((r) => r.status === (viewer ? 'approved' : tracking)).sort(recentFirst)} onOpen={onOpen} session={session} empty={viewer ? 'Approved reports will appear here once reviewed.' : `You have no ${tracking === 'submitted' ? 'reports awaiting QA' : 'approved reports'}.`} />
      </Panel> : <JobPanel data={data} role={role} onJob={onJob} />}
    </div>
    <div className={`home-row home-support-row${head ? ' has-three' : ''}`}>
      {technician ? <JobPanel data={data} role={role} onJob={onJob} /> : <CustomerPanel customers={customers} />}
      {technician ? <Panel id="home-shortcuts-title" title="Start an inspection" note="Choose a report type, then its job" footer={<button className="home-text-button" onClick={onNew}>All report types</button>}>
        <div className="home-shortcuts">{REPORT_CHOICES.map((choice) => <button key={choice.id} onClick={() => onNew(choice.id)}><b>{reportCode(choice)}</b><span>{choice.label}</span></button>)}</div>
      </Panel> : role.canManage ? <WorkloadPanel records={records} /> : viewer ? <ReadinessPanel data={data} onJob={onJob} /> : <Panel id="home-register-title" title="Report register" note="All reports on this device" footer={<a href={register()}>Open report register</a>}>
        <dl className="home-register">{[['draft', 'Draft'], ['returned', 'Sent back'], ['submitted', 'Awaiting QA'], ['approved', 'Approved'], ['ncr', 'NCR reports']].map(([key, label]) => <div key={key}><dt><a href={register(key)}>{label}</a></dt><dd>{data.counts[key]}</dd></div>)}</dl><p className="home-panel-note">NCR verdicts may overlap lifecycle counts.</p>
      </Panel>}
      {head && <ReadinessPanel data={data} onJob={onJob} />}
    </div>
    <Panel id="home-updates-title" title="Recent updates" note={technician ? 'Latest state of your reports' : 'Latest recorded state of each report'} footer={<a href={register('all', technician ? 'mine' : '')}>View reports</a>}>
      {recent.length ? <div className="home-updates">{recent.map((r) => <a key={r.id} href={href(reportPath(r))} onClick={(e) => onOpen(e, r)}><strong>{r.reportId}</strong><span>Job {r.jobNo} · {REPORT_LABELS[r.status] || r.status}</span><small>{at(r.updatedAt)}</small></a>)}</div> : <p className="home-empty">No report updates yet.</p>}
    </Panel>
  </div></div>
}

export default function Home() {
  const { jobs, tick, role, session, notify, refresh } = useApp()
  const now = useCalendarDate()
  const [launcher, setLauncher] = useState(null)
  const snapshot = useMemo(() => {
    try {
      const records = getReportsChecked(), ctx = buildContext(records)
      return { records, data: homeOverview(jobs, records, ctx, session.name, now), customers: byCustomer(jobs, ctx) }
    } catch { return { error: true } }
  }, [jobs, tick, session.name, now])
  const onOpen = (e, r) => {
    if (!getReport(r.id) || !allJobs().some((j) => String(j.jobNo) === String(r.jobNo))) {
      e.preventDefault(); notify('This record is no longer available. Open the report register to check its status.', 'err')
    }
  }
  const onJob = (e, jobNo) => {
    if (!allJobs().some((j) => String(j.jobNo) === String(jobNo))) { e.preventDefault(); notify('This job is no longer available in the register.', 'err') }
  }
  const onNew = (id) => { if (role.canEdit) setLauncher(typeof id === 'string' ? id : 'all') }
  if (snapshot.error) return <div className="page home-page"><section className="home-panel home-empty" role="alert"><h2>Could not read reports on this device.</h2><p>Your records have not been changed. Retry or check the report storage.</p><button className="btn btn-primary" onClick={refresh}>Retry</button>{role.canManage && <a href="#/settings?s=storage">Open storage settings</a>}</section></div>
  return <><HomeDashboard key={`${session.role}:${session.name}`} {...snapshot} role={role} session={session} now={now} onOpen={onOpen} onJob={onJob} onNew={onNew} />{launcher && <ReportLauncher initial={launcher} onClose={() => setLauncher(null)} />}</>
}
