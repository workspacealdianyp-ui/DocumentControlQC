import { useMemo, useState } from 'react'
import { useApp } from '../App.jsx'
import { FORM_SCHEMAS } from '../data/formSchemas.js'
import { getReportsChecked, getReport } from '../lib/store.js'
import { allJobs } from '../lib/jobOrders.js'
import { buildContext, fmtDate, fmtDateTime } from '../lib/status.js'
import { byCustomer } from '../lib/rollup.js'
import { homeOverview, reportPath, REPORT_LABELS } from '../lib/homeOverview.js'
import { REPORT_CHOICES, reportCode } from '../lib/reportChoices.js'
import { useCalendarDate } from '../lib/useCalendarDate.js'
import { IconAlert, IconApprove, IconChevronR, IconClock, IconGrid, IconPlus, IconList, IconDoc, IconPen } from './Icons.jsx'
import ReportLauncher from './ReportLauncher.jsx'
import './Home.css'

const SHORTCUTS = ['hydrotest', 'blasting', 'mt', 'pt', 'ut', 'visual', 'dimensional']
const REGISTER = [['all', 'All reports'], ['draft', 'Draft'], ['submitted', 'Awaiting QA'], ['returned', 'Sent back'], ['approved', 'Approved'], ['ncr', 'NCR reports']]
// Empty destinations stay absent. Configure real team resources here.
const QUICK_LINKS = [
  { label: 'QC Dashboard', href: '' }, { label: 'NCR List', href: '' }, { label: 'QC Site', href: '' },
]
const externalLinks = QUICK_LINKS.filter((link) => {
  try { return ['https:', 'http:'].includes(new URL(link.href.trim()).protocol) } catch { return false }
})
const plural = (n, noun) => `${n} ${noun}${n === 1 ? '' : 's'}`
const href = (path) => `#${path}`
const monitor = (state) => `/monitoring?view=all&from=home${state ? `&state=${state}` : ''}`
const at = (value) => value && !Number.isNaN(new Date(value).getTime()) ? fmtDateTime(value) : 'Date unavailable'

function Heading({ id, title, note, children }) {
  return <header className="home-panel-head">
    <div><h2 id={id}>{title}</h2>{note && <p>{note}</p>}</div>{children}
  </header>
}

function ReportRow({ report: r, review = false, onOpen, session }) {
  const state = REPORT_LABELS[r.status] || r.status
  return <a className="home-report-row" href={href(reportPath(r))} onClick={(e) => onOpen(e, r)} aria-label={`Open report ${r.reportId}`}>
    <span className={`home-form-code is-${r.status}`}>{FORM_SCHEMAS[r.formKey]?.code || 'DOC'}</span>
    <span className="home-report-copy">
      <strong>{r.reportId}</strong>
      <span>Job {r.jobNo} · {state}</span>
      {r.status === 'returned' && r.returnNote && <span className="home-return-note">{r.returnNote.length > 96 ? `${r.returnNote.slice(0, 96)}…` : r.returnNote}</span>}
      <small>{review && r.inspector === session.name ? 'Submitted by you · ' : ''}{review && r.submittedAt ? 'Submitted ' : 'Updated '}{at(review ? r.submittedAt || r.updatedAt : r.updatedAt)}</small>
    </span>
    <span className="home-row-action">{review ? 'Review' : r.status === 'returned' ? 'Revise' : 'Continue'}<IconChevronR size={14} /></span>
  </a>
}

function WorkPanel({ data, role, session, onOpen, onNew }) {
  const [mode, setMode] = useState('review')
  const [limit, setLimit] = useState(4)
  const review = role.canOverride && mode === 'review'
  const records = review ? data.submitted : data.mine
  if (!role.canEdit) return <section className="home-panel home-work" aria-labelledby="home-work-title">
    <Heading id="home-work-title" title="Overview" note="Read-only access" />
    <div className="home-overview">
      <IconGrid size={25} />
      <h3>Follow the work through its records.</h3>
      <p>Open a job to see its required documents, inspection results, and recorded evidence.</p>
      <a className="home-text-link" href={href(monitor())}>Browse all jobs <IconChevronR size={15} /></a>
      <a className="home-text-link" href="#/reports?f=all">View report register <IconChevronR size={15} /></a>
      {data.totals.noScope > 0 && <p>{plural(data.totals.noScope, 'job')} with no applicable deliverables.</p>}
    </div>
  </section>
  return <section className="home-panel home-work" aria-labelledby="home-work-title">
    <Heading id="home-work-title" title={review ? 'QA review' : 'Your work'} note={review ? 'Oldest submitted reports first' : 'Sent back first, then your latest drafts'}>
      <span className="home-count">{records.length}</span>
    </Heading>
    {role.canOverride && <div className="home-work-switch" role="group" aria-label="Choose work list">
      <button type="button" aria-pressed={review} onClick={() => { setMode('review'); setLimit(4) }}>Awaiting QA <span>{data.submitted.length}</span></button>
      <button type="button" aria-pressed={!review} onClick={() => { setMode('mine'); setLimit(4) }}>Your work <span>{data.mine.length}</span></button>
    </div>}
    <div className="home-work-list">
      {records.length ? records.slice(0, limit).map((r) => <ReportRow key={r.id} report={r} review={review} onOpen={onOpen} session={session} />)
        : <div className="home-empty home-work-empty"><IconPen size={24} /><strong>{review ? 'No reports awaiting QA.' : 'No reports to continue.'}</strong><p>{review ? 'Submitted reports will appear here for review.' : 'Start a report when your next inspection is ready.'}</p></div>}
    </div>
    {records.length > 4 && <div className="home-panel-footer">
      {review ? <a className="home-text-link" href="#/reports?f=submitted">View all {records.length} submitted reports <IconChevronR size={15} /></a>
        : <button type="button" className="home-text-link" onClick={() => setLimit((n) => n >= records.length ? 4 : n + 10)}>{limit >= records.length ? 'Show fewer' : `View more of your ${records.length} reports`} <IconChevronR size={15} /></button>}
    </div>}
    <details className="home-shortcuts">
      <summary>Report shortcuts <span>7 types</span></summary>
      <div className="home-shortcut-grid">{SHORTCUTS.map((id) => {
        const choice = REPORT_CHOICES.find((c) => c.id === id)
        return <button type="button" key={id} onClick={() => onNew(id === 'visual' ? 'final' : id)}>
          <b>{reportCode(choice)}</b><span>{id === 'visual' ? 'Final inspection' : choice.label}</span>
        </button>
      })}</div>
      <button type="button" className="home-text-link" onClick={() => onNew('all')}>All report types, including ITP, PTR & IRN <IconChevronR size={15} /></button>
    </details>
  </section>
}

export default function Home() {
  const { jobs, tick, role, session, notify, refresh } = useApp()
  const now = useCalendarDate()
  const [launcher, setLauncher] = useState(null)
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState(false)
  const [page, setPage] = useState(1)
  const snapshot = useMemo(() => {
    try {
      const reports = getReportsChecked()
      const ctx = buildContext(reports)
      return { data: homeOverview(jobs, reports, ctx, session.name, now), customers: byCustomer(jobs, ctx) }
    } catch { return { error: true } }
  }, [jobs, tick, session.name, now])

  const openReport = (e, r) => {
    if (!getReport(r.id) || !allJobs().some((j) => String(j.jobNo) === String(r.jobNo))) {
      e.preventDefault()
      notify('This record is no longer available. Open the report register to check its status.', 'err')
    }
  }
  const openJob = (e, jobNo) => {
    if (!allJobs().some((j) => String(j.jobNo) === String(jobNo))) {
      e.preventDefault(); notify('This job is no longer available in the register.', 'err')
    }
  }
  const newReport = (id = 'all') => { if (role.canEdit) setLauncher(id) }
  const first = session.name.trim().split(/\s+/)[0]
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  if (snapshot.error) return <div className="page home-page"><section className="home-panel home-empty" role="alert">
    <IconAlert size={28} /><h2>Could not read reports on this device.</h2>
    <p>Your records have not been changed. Retry or check the report storage.</p>
    <button type="button" className="btn btn-primary" onClick={refresh}>Retry</button>
    {role.canManage && <a className="home-text-link" href="#/settings?s=storage">Open storage settings</a>}
  </section></div>

  const { data, customers } = snapshot
  const { totals, counts } = data
  const filtered = data.attention.filter((r) => filter === 'all' || (filter === 'overdue' ? r.late.length : r.ncr))
  const totalPages = Math.max(1, Math.ceil(filtered.length / 20))
  const currentPage = Math.min(page, totalPages)
  const shown = expanded ? filtered.slice((currentPage - 1) * 20, currentPage * 20) : filtered.slice(0, 5)
  const attentionFilters = [['all', 'All attention', data.attention.length], ['overdue', 'Overdue jobs', totals.overdue], ['ncr', 'With NCR', data.attention.filter((r) => r.ncr).length]]

  return <div className="page home-page">
    <div className="home-dashboard">
      {/* The masthead this screen never had.

          Every other page in the app opens on a band — the job, the
          customer, the order. The dashboard, which is the one people
          actually land on, opened on a line of text and two buttons
          floating on the page's own grey. It gets a band too, and the
          band carries the yard the documents are all about. */}
      <header className="home-banner">
        <div className="home-banner-art" aria-hidden="true" />
        <div className="home-banner-body">
        <div className="home-welcome"><strong>{greeting}, {first}.</strong><span>{now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
        <div className="home-action-buttons">
          {role.canOverride ? <>
            <button type="button" className="btn btn-secondary" onClick={() => newReport()}><IconPlus size={16} /> New report</button>
            <a className="btn btn-primary" href="#/reports?f=submitted"><IconApprove size={16} /> Review reports</a>
          </> : role.canEdit ? <>
            <a className="btn btn-secondary" href="#/monitoring"><IconGrid size={16} /> Open monitoring</a>
            <button type="button" className="btn btn-primary" onClick={() => newReport()}><IconPlus size={16} /> New report</button>
          </> : <>
            <a className="btn btn-secondary" href="#/reports?f=all">View reports</a>
            <a className="btn btn-primary" href="#/monitoring"><IconGrid size={16} /> Open monitoring</a>
          </>}
        </div>
        </div>
      </header>

      <section className="home-readings" aria-label="QC overview">
        <a className="home-reading" href={href(monitor('inprogress,overdue,notstarted'))}>
          <span className="home-reading-label"><IconList size={16} /> Open jobs</span>
          <strong>{totals.open}</strong><span className="home-reading-note">{plural(totals.jobs, 'job')} in register</span>
        </a>
        <div className="home-reading home-reading-completion">
          <span className="home-reading-label"><IconApprove size={16} /> Deliverables complete</span>
          <strong>{data.pct === null ? '—' : <>{data.pct}<small>%</small></>}</strong>
          <span className="home-reading-note">{data.pct === null ? 'No required deliverables' : `${totals.done} of ${totals.applicable} required`}</span>
          <div className="home-progress" aria-hidden="true"><span style={{ width: `${data.pct || 0}%` }} /></div>
          {totals.overrides > 0 && <small className="home-override-note">Includes {plural(totals.overrides, 'admin override')}</small>}
          <a className="home-reading-link" href={href(monitor())}>Open monitoring</a>
        </div>
        <a className="home-reading" href="#/reports?f=submitted">
          <span className="home-reading-label"><IconClock size={16} /> Awaiting QA</span>
          <strong className={counts.submitted ? 'home-review-ink' : ''}>{counts.submitted}</strong><span className="home-reading-note">Submitted reports</span>
        </a>
        <a className={`home-reading${totals.overdue ? ' has-attention' : ''}`} href={href(monitor('overdue'))}>
          <span className="home-reading-label"><IconAlert size={16} /> Overdue jobs</span>
          <strong>{totals.overdue}</strong><span className="home-reading-note">{plural(totals.gaps, 'overdue deliverable')}</span>
        </a>
      </section>

      <section className="home-panel home-attention" aria-labelledby="home-attention-title">
        <Heading id="home-attention-title" title="Needs attention" note="Documentation gaps and non-conforming reports">
          <span className="home-count">{plural(data.attention.length, 'job')}</span>
        </Heading>
        <div className="home-filters" role="group" aria-label="Filter attention jobs">
          {attentionFilters.map(([key, label, count]) => <button type="button" key={key} aria-pressed={filter === key}
            onClick={() => { setFilter(key); setPage(1); setExpanded(false) }}>{label}<span>{count}</span></button>)}
        </div>
        {!jobs.length ? <div className="home-empty"><IconGrid size={28} /><strong>No jobs in the register.</strong><p>A job must be available before an inspection report can be started.</p>
          {role.canManage && <a className="btn btn-secondary" href="#/monitoring/new">New job order</a>}
        </div> : !filtered.length ? <div className="home-empty"><IconApprove size={28} /><strong>{filter === 'all' ? 'No jobs need attention here.' : 'No jobs in this view.'}</strong><p>{filter === 'all' ? 'No overdue deliverable gaps or NCR reports for the available jobs.' : 'Choose another filter to see the remaining work.'}</p><a className="home-text-link" href="#/monitoring">Open monitoring <IconChevronR size={14} /></a></div> : <>
          <div className="home-attention-columns" aria-hidden="true"><span>Job / product</span><span>Attention / target</span><span>Complete</span></div>
          <ol className={`home-attention-list${expanded ? ' is-expanded' : ''}`}>
            {shown.map(({ job, progress, late, pending, ncr, target }) => (
              <li key={job.jobNo}><a className="home-attention-row" href={href(`/job/${job.jobNo}`)} onClick={(e) => openJob(e, job.jobNo)} aria-label={`Open job ${job.jobNo}`}>
                <span className="home-job-id"><strong>{job.jobNo}</strong><span>{job.productDesc || 'Product not set'}</span><small>{job.customerName || 'Customer not set'}</small></span>
                <span className="home-job-reason">
                  {ncr > 0 && <span className="home-reason is-ncr"><IconAlert size={13} />{plural(ncr, 'NCR report')}</span>}
                  {late.length > 0 && <span className="home-reason is-late">{plural(late.length, 'overdue deliverable')}</span>}
                  <span className="home-due">{target ? `Target ${fmtDate(`${target}T00:00:00`)}` : 'Target date not set'}</span>
                  {pending.length > 0 && <small>{late.length ? 'Overdue: ' : 'Outstanding: '}{(late.length ? late : pending).slice(0, 3).map((d) => d.short).join(' · ')}{(late.length ? late : pending).length > 3 ? ` +${(late.length ? late : pending).length - 3} more` : ''}</small>}
                </span>
                <span className="home-job-completion"><strong>{progress.done}<small>/{progress.applicable}</small></strong><span className="home-open-job">Open job <IconChevronR size={14} /></span></span>
              </a></li>
            ))}
          </ol>
        </>}
        <footer className="home-panel-footer home-attention-footer">
          <span>{plural(filtered.length, 'job')} in this view</span>
          {filtered.length > 3 && <button type="button" className="home-text-link" onClick={() => { setExpanded(!expanded); setPage(1) }} aria-expanded={expanded}>{expanded ? 'Show fewer' : 'View all'} <IconChevronR size={14} /></button>}
        </footer>
        {expanded && totalPages > 1 && <nav className="home-pagination" aria-label="Attention pages">
          <button type="button" className="btn btn-secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button>
          <span>Page {currentPage} of {totalPages}</span>
          <button type="button" className="btn btn-secondary" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>Next</button>
        </nav>}
        {data.unavailableNcr > 0 && <p className="home-panel-note"><a href="#/reports?f=ncr">{plural(data.unavailableNcr, 'NCR report')} with unavailable job records</a></p>}
      </section>

      <WorkPanel data={data} role={role} session={session} onOpen={openReport} onNew={newReport} />

      <section className="home-panel home-customers" aria-labelledby="home-customers-title">
        <Heading id="home-customers-title" title="Customer progress" note="Ordered by unfinished units"><a className="home-text-link" href="#/monitoring">View all <IconChevronR size={14} /></a></Heading>
        {customers.length ? <div className="home-customer-list">{customers.slice(0, 4).map((c) => <a className="home-customer-row" key={c.name} href={href(`/customer/${encodeURIComponent(c.name)}`)}>
          <span className="home-customer-id"><strong>{c.name}</strong><small>{plural(c.orders, 'order')} · {plural(c.units, 'unit')}</small></span>
          <span className="home-customer-figs"><span><b>{c.open}</b> open units</span>{c.overdue > 0 && <span className="home-late-ink"><b>{c.overdue}</b> overdue</span>}{c.ncr > 0 && <span className="home-late-ink"><b>{c.ncr}</b> NCR reports</span>}</span>
          <span className="home-customer-progress"><strong>{c.applicable ? `${c.pct}%` : '—'}</strong><small>{c.done}/{c.applicable} complete</small><span className="home-progress" aria-hidden="true"><span style={{ width: `${c.pct}%` }} /></span></span>
        </a>)}</div> : <div className="home-empty"><p>No customer work on file yet.</p></div>}
      </section>

      <section className="home-panel home-reports" aria-labelledby="home-reports-title">
        <Heading id="home-reports-title" title="Report register" note="All reports on this device" />
        <dl className="home-register">{REGISTER.map(([key, label]) => <div key={key}><dt><a href={`#/reports?f=${key}`}>{label}<IconChevronR size={13} /></a></dt><dd className={key === 'ncr' && counts[key] ? 'home-late-ink' : ''}>{counts[key]}</dd></div>)}</dl>
        <p className="home-register-note">NCR is a report verdict and may overlap a lifecycle count.</p>
      </section>

      <section className="home-panel home-updates" aria-labelledby="home-updates-title">
        <Heading id="home-updates-title" title="Recent updates" note="Latest recorded state of each report"><a className="home-text-link" href="#/reports?f=all">View reports <IconChevronR size={14} /></a></Heading>
        {data.recent.length ? <div className="home-update-list">{data.recent.map((r) => <a key={r.id} className="home-update-row" href={href(reportPath(r))} onClick={(e) => openReport(e, r)}>
          <span className="home-update-code"><IconDoc size={17} /></span>
          <span className="home-update-id"><strong>{r.reportId}</strong><small>Job {r.jobNo} · Inspector: {r.inspector || 'Not recorded'}</small></span>
          <span className={`home-update-state is-${r.status}`}>{REPORT_LABELS[r.status] || r.status}</span>
          <span className="home-update-time">{at(r.updatedAt)}</span>
          <IconChevronR size={14} />
        </a>)}</div> : <div className="home-empty"><p>No report updates yet.</p></div>}
      </section>
      {externalLinks.length > 0 && <nav className="home-links" aria-label="Team resources">{externalLinks.map((link) => <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer">{link.label} <span aria-label="opens in a new tab">↗</span></a>)}</nav>}
    </div>
    {launcher && <ReportLauncher initial={launcher} onClose={() => setLauncher(null)} />}
  </div>
}
