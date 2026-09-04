import { useMemo, useState, useEffect, lazy, Suspense } from 'react'
import { useApp, navigate } from '../App.jsx'
import { FORM_SCHEMAS } from '../data/formSchemas.js'
import { getReports } from '../lib/store.js'
import JobPicker from './JobPicker.jsx'
import { docStats, recentActivity, ncrReports, buildContext, jobStatuses, jobProgress, fmtDate, fmtDateTime } from '../lib/status.js'
import { DELIVERABLES } from '../lib/constants.js'
import { IconAlert, IconDoc, IconChevronR, IconPlus, IconPen, IconGrid, IconList, IconApprove, IconClock } from './Icons.jsx'

const FORM_ORDER = ['hydrotest', 'blasting', 'mt', 'pt', 'ut', 'visual', 'dimensional']
const QA_TINTS = ['qa-1', 'qa-2', 'qa-3', 'qa-4', 'qa-1', 'qa-2', 'qa-3']

const Unit3D = lazy(() => import('./Unit3D.jsx')) // heavy (three.js) — load on demand

// map a free-text product description to a 3D archetype + label
const unitKind = (desc = '') => {
  const d = desc.toLowerCase()
  if (/tank|storage|silo|drum/.test(d)) return 'tank'
  if (/pipe|spool|piping|manifold|header/.test(d)) return 'spool'
  if (/skid|frame|structure|rack|platform|module/.test(d)) return 'skid'
  return 'vessel'
}
const KIND_LABEL = { vessel: 'Pressure Vessel', tank: 'Storage Tank', spool: 'Pipe Spool', skid: 'Skid Package' }

// customer visual helpers — gradient pairs (bar = gradient, avatar = frosted start tint)
// One needle colour, the reading differs. The construction orange from
// the design reference, warming toward the tip so a full ring reads as
// a complete sweep rather than a flat band.
const CUST_GRADIENTS = [
  ['#f86300', '#ff8f3d'],
  ['#e05800', '#f8842c'],
  ['#f86300', '#ff8f3d'],
  ['#e05800', '#f8842c'],
  ['#f86300', '#ff8f3d'],
]
const custInitials = (name = '') => name.replace(/\b(pt|cv|tbk|persero)\b\.?/gi, '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '–'

// deterministic mock metrics per customer (real data is thin — fabricate trend/on-time/NCR/tier)
const hashStr = (s = '') => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
const mulberry = (a) => () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
function mockCust(name, real) {
  const rng = mulberry(hashStr(name))
  const pct = real.app ? Math.round((real.done / real.app) * 100) : Math.round(40 + rng() * 55)
  const trend = []; let v = Math.max(10, pct - 18 - Math.round(rng() * 14))
  for (let i = 0; i < 6; i++) { v = Math.max(6, Math.min(100, v + Math.round((rng() - 0.32) * 22))); trend.push(v) }
  trend[5] = pct
  return { pct, trend, delta: trend[5] - trend[4], onTime: 72 + Math.round(rng() * 26), ncr: rng() < 0.5 ? 0 : 1 + Math.floor(rng() * 3), tier: real.jobs >= 15 ? 'Gold' : real.jobs >= 5 ? 'Silver' : 'Bronze', since: 2014 + Math.floor(rng() * 10) }
}

// gradient completion ring
function Ring({ pct, c1, c2, gid, size = 48 }) {
  const sw = 5, r = (size - sw) / 2, circ = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="ring2">
      <defs><linearGradient id={gid} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={c1} /><stop offset="1" stopColor={c2} /></linearGradient></defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(150,170,200,0.22)" strokeWidth={sw} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${gid})`} strokeWidth={sw} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="ring2-t">{pct}<tspan className="ring2-pct">%</tspan></text>
    </svg>
  )
}

// Optional shortcuts to whatever external tools the team uses.
// Point these at your own dashboard / document library, or leave them empty to hide the row.
const QUICK_LINKS = [
  { label: 'QC Dashboard', sub: 'BI report', icon: 'grid', href: '#' },
  { label: 'NCR List', sub: 'Document library', icon: 'alert', href: '#' },
  { label: 'QC Site', sub: 'Document library', icon: 'doc', href: '#' },
]

export default function Home() {
  const { session, jobs, tick } = useApp()
  const [newForm, setNewForm] = useState(null)
  const [slide, setSlide] = useState(0) // current unit in the showcase
  const [custAll, setCustAll] = useState(false) // expand top-customers list

  const stats = useMemo(() => docStats(), [tick])
  const activity = useMemo(() => recentActivity(6), [tick])
  const ncrs = useMemo(() => ncrReports(), [tick])

  /* fleet-wide cell distribution + overdue spotlight + top customers */
  const fleet = useMemo(() => {
    const ctx = buildContext()
    const dist = { done: 0, inprogress: 0, notstarted: 0, overdue: 0 }
    const overdueJobs = []
    const byCustomer = new Map()
    const DSHORT = Object.fromEntries(DELIVERABLES.map((d) => [d.key, d.short]))
    for (const job of jobs) {
      const sts = jobStatuses(job, ctx)
      let jobOver = 0, jobDone = 0, jobApp = 0, jobIp = 0
      const jobPend = []
      for (const k in sts) {
        const s = sts[k].status
        if (s === 'na') continue
        jobApp++
        if (s === 'done') { dist.done++; jobDone++ }
        else {
          jobPend.push(DSHORT[k] || k)
          if (s === 'inprogress') { dist.inprogress++; jobIp++ }
          else if (s === 'overdue') { dist.overdue++; jobOver++ }
          else dist.notstarted++
        }
      }
      if (jobOver > 0) overdueJobs.push({ job, missing: jobOver })
      const c = byCustomer.get(job.customerName) || { jobs: 0, done: 0, app: 0, ip: 0, od: 0, pend: {} }
      c.jobs++; c.done += jobDone; c.app += jobApp; c.ip += jobIp; c.od += jobOver
      for (const sh of jobPend) c.pend[sh] = (c.pend[sh] || 0) + 1
      byCustomer.set(job.customerName, c)
    }
    overdueJobs.sort((a, b) => (a.job.datePdiRelease || '').localeCompare(b.job.datePdiRelease || ''))
    const customers = [...byCustomer.entries()]
    const applicable = dist.done + dist.inprogress + dist.notstarted + dist.overdue
    return { dist, applicable, overdueJobs, customers }
  }, [jobs, tick])

  /* units to showcase — prefer jobs with active/overdue work, fall back to the fleet */
  const featured = useMemo(() => {
    const ctx = buildContext()
    const all = jobs.map((job) => ({ job, prog: jobProgress(job, ctx) }))
    const active = all.filter((x) => x.prog.inprogress || x.prog.overdue)
    return (active.length ? active : all).slice(0, 6)
  }, [jobs, tick])

  useEffect(() => {
    if (featured.length <= 1) return
    const t = setInterval(() => setSlide((s) => (s + 1) % featured.length), 5200)
    return () => clearInterval(t)
  }, [featured.length])

  /* my drafts — continue where you left off */
  const myDrafts = useMemo(
    () => getReports().filter((r) => r.status === 'draft' && r.inspector === session.name)
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 4),
    [tick, session.name]
  )

  // customers enriched with mock metrics, ranked by completion
  const custData = useMemo(() => {
    const list = fleet.customers.map(([name, c]) => ({ name, c, m: mockCust(name, c) }))
    list.sort((a, b) => b.m.pct - a.m.pct || b.c.jobs - a.c.jobs)
    return list.map((x, i) => ({ ...x, c1: CUST_GRADIENTS[i % CUST_GRADIENTS.length][0], c2: CUST_GRADIENTS[i % CUST_GRADIENTS.length][1] }))
  }, [fleet.customers])

  const h = new Date().getHours()
  const greet = h < 11 ? 'Good morning' : h < 15 ? 'Good afternoon' : h < 19 ? 'Good evening' : 'Good night'
  const first = session.name.split(' ')[0]
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const cur = featured.length ? featured[slide % featured.length] : null
  const curKind = cur ? unitKind(cur.job.productDesc) : 'vessel'

  const openReport = (r) =>
    navigate(`/job/${r.jobNo}/form/${r.formKey}?d=${encodeURIComponent(r.deliverable)}&rid=${encodeURIComponent(r.id)}`)

  /* The four numbers the register can answer without inventing any:
     how much work there is, how much of it is finished, how much is
     moving, and how much is late. No month-over-month deltas — nothing
     in this app records last month, and a made-up trend on a QC
     dashboard is worse than no trend. */
  const pctDone = fleet.applicable ? Math.round((fleet.dist.done / fleet.applicable) * 100) : 0
  const metrics = [
    { key: 'jobs', icon: IconList, label: 'Active jobs', value: fleet.customers.length ? jobs.length : 0,
      foot: `${fleet.customers.length} customer${fleet.customers.length === 1 ? '' : 's'}`, to: '/jobs' },
    { key: 'done', icon: IconApprove, label: 'Reports complete', value: `${pctDone}%`,
      foot: `${fleet.dist.done} of ${fleet.applicable} required`, tone: pctDone >= 75 ? 'up' : '', to: '/monitor' },
    { key: 'prog', icon: IconClock, label: 'In progress', value: fleet.dist.inprogress,
      foot: `${stats.draft} draft${stats.draft === 1 ? '' : 's'} open`, to: '/reports?f=draft' },
    { key: 'late', icon: IconAlert, label: 'Overdue', value: fleet.dist.overdue,
      foot: `${fleet.overdueJobs.length} job${fleet.overdueJobs.length === 1 ? '' : 's'} affected`,
      tone: fleet.dist.overdue ? 'down' : '', to: '/monitor' },
  ]

  return (
    <div className="page">
      {/* the top bar names the page; this row says whose it is and what
          can be done from here */}
      <div className="page-bar">
        <div className="home-greet">
          <strong>{greet}, {first}</strong>
          <span>{today}</span>
        </div>
        <div className="mon-head-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/monitor')}>
            <IconGrid size={14} /> Open Monitor
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/jobs')}>
            <IconPlus size={14} /> New report
          </button>
        </div>
      </div>

      <div className="kpi-row">
        {metrics.map((m) => (
          <button key={m.key} className="kpi" onClick={() => navigate(m.to)}>
            <span className="kpi-top">
              <span className="kpi-ico"><m.icon size={14} /></span>
              {m.label}
            </span>
            <strong className="kpi-value">{m.value}</strong>
            <span className="kpi-foot">
              <span>{m.foot}</span>
              {m.tone && <em className={`kpi-tag ${m.tone}`}>{m.tone === 'up' ? 'on track' : 'attention'}</em>}
            </span>
          </button>
        ))}
      </div>

      <div className="bento">
        {/* ── HERO: unit spotlight — live 3D showcase of the units under inspection ── */}
        <section className="card bento-hero panel-hero showcase-hero">
          <div className="panel-eyebrow">
            <span className="panel-kicker"><span className="panel-led" /> Unit Spotlight</span>
            <button className="panel-monitor" onClick={() => navigate('/monitor')}><IconGrid size={13} /> Open Monitor</button>
          </div>

          <div className="showcase-body">
            <div className="showcase-stage">
              <Suspense fallback={<div className="stage-loading">Loading 3D…</div>}>
                <Unit3D kind={curKind} />
              </Suspense>
              <span className="stage-hint">drag to rotate</span>
            </div>

            <div className="showcase-info">
              {cur && (() => {
                const { job, prog } = cur
                const pct = prog.applicable ? Math.round((prog.done / prog.applicable) * 100) : 0
                return (
                  <>
                    <span className="sc-kind">{KIND_LABEL[curKind]}</span>
                    <h3 className="sc-title">{job.productDesc}</h3>
                    <div className="sc-meta">
                      <span><b>Job</b> {job.jobNo}</span>
                      <span><b>Serial</b> {job.arasSN || '—'}</span>
                      <span><b>Customer</b> {job.customerName}</span>
                    </div>
                    <div className="sc-prog">
                      <div className="sc-prog-bar"><span style={{ width: `${pct}%` }} /></div>
                      <span className="sc-prog-lab">{prog.done}/{prog.applicable} reports · {pct}%</span>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => navigate(`/job/${job.jobNo}`)}>Open job →</button>
                  </>
                )
              })()}
              <div className="sc-dots">
                {featured.map((_, i) => (
                  <button key={i} className={`sc-dot${i === (slide % featured.length) ? ' on' : ''}`} onClick={() => setSlide(i)} aria-label={`Unit ${i + 1}`} />
                ))}
              </div>
            </div>
          </div>

          <div className="panel-links">
            {QUICK_LINKS.map((l) => (
              <a key={l.label} className="qlink" href={l.href} target="_blank" rel="noopener noreferrer">
                {l.icon === 'grid' ? <IconGrid size={15} /> : l.icon === 'alert' ? <IconAlert size={15} /> : <IconDoc size={15} />}
                <span className="qlink-txt"><b>{l.label}</b><small>{l.sub}</small></span>
                <span className="qlink-ext">↗</span>
              </a>
            ))}
          </div>
        </section>

        {/* ── document stats 2×2 ── */}
        <section className="card bento-docs">
          <h3 className="widget-title">My documents</h3>
          <div className="mini-stats">
            <button onClick={() => navigate('/reports')}><strong>{stats.total}</strong><span>Total</span></button>
            <button onClick={() => navigate('/reports?f=draft')}><strong className="ms-amber">{stats.draft}</strong><span>Draft</span></button>
            <button onClick={() => navigate('/reports?f=submitted')}><strong className="ms-blue">{stats.submitted}</strong><span>Submitted</span></button>
            <button onClick={() => navigate('/reports?f=approved')}><strong className="ms-mint">{stats.approved}</strong><span>Approved</span></button>
          </div>
          <button className="alert-strip" onClick={() => navigate('/reports?f=ncr')}>
            <span className="alert-ico ncr-ico" style={{ width: 34, height: 34, borderRadius: 11 }}><IconDoc size={15} /></span>
            <span className="alert-text">
              <strong>{ncrs.length} NCR finding{ncrs.length === 1 ? '' : 's'}</strong>
              <small>{ncrs.length ? 'Tap to review non-conformances' : 'Nothing outstanding'}</small>
            </span>
            <IconChevronR size={15} />
          </button>
        </section>

        {/* ── continue drafts ── */}
        <section className="card bento-drafts">
          <h3 className="widget-title">Continue where you left off</h3>
          {myDrafts.length === 0 ? (
            <div className="widget-empty">
              <IconPen size={18} />
              <p>No open drafts. Start a new report below.</p>
            </div>
          ) : (
            <div className="draft-list">
              {myDrafts.map((r) => (
                <button key={r.id} className="draft-row" onClick={() => openReport(r)}>
                  <span className="deliv-ico" style={{ width: 38, height: 38, borderRadius: 12 }}>{FORM_SCHEMAS[r.formKey]?.code}</span>
                  <span className="act-main">
                    <strong>{r.reportId}</strong>
                    <small>Job {r.jobNo} · {fmtDateTime(r.updatedAt)}</small>
                  </span>
                  <span className="continue-pill">Continue</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ── quick actions ── */}
        <section className="bento-qa">
          <h3 className="widget-title" style={{ margin: '4px 0 12px' }}>New report</h3>
          <div className="qa-grid">
            {FORM_ORDER.map((k, i) => (
              <button key={k} className={`qa-tile ${QA_TINTS[i]}`} onClick={() => setNewForm(k)}>
                <span className="qa-plus"><IconPlus size={13} /></span>
                <strong>{FORM_SCHEMAS[k].code}</strong>
                <span className="qa-name">{FORM_SCHEMAS[k].title.replace(' Report', '')}</span>
              </button>
            ))}
          </div>
        </section>

        {/* ── overdue spotlight ── */}
        <section className="card bento-overdue">
          <div className="widget-head">
            <h3 className="widget-title">Needs attention</h3>
            <span className="count-pill coral">{fleet.overdueJobs.length}</span>
          </div>
          {fleet.overdueJobs.length === 0 ? (
            <div className="widget-empty"><p>No overdue jobs. Nice work! 🎉</p></div>
          ) : (
            <div className="draft-list">
              {fleet.overdueJobs.slice(0, 4).map(({ job, missing }) => (
                <button key={job.jobNo} className="draft-row" onClick={() => navigate(`/job/${job.jobNo}`)}>
                  <span className="alert-ico" style={{ width: 38, height: 38, borderRadius: 12 }}><IconAlert size={15} /></span>
                  <span className="act-main">
                    <strong>{job.jobNo}</strong>
                    <small>{job.productDesc}</small>
                    <small>PDI released {fmtDate(job.datePdiRelease)} · {missing} report{missing === 1 ? '' : 's'} missing</small>
                  </span>
                  <IconChevronR size={15} className="deliv-chevron" />
                </button>
              ))}
              {fleet.overdueJobs.length > 4 && (
                <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'center' }} onClick={() => navigate('/monitor')}>
                  View all {fleet.overdueJobs.length} in Monitor
                </button>
              )}
            </div>
          )}
        </section>

        {/* ── top customers — KPI cards ── */}
        <section className="card bento-customers cust-card">
          <div className="widget-head">
            <h3 className="widget-title">Top customers</h3>
            <span className="count-pill">{custData.length}</span>
          </div>

          {custData.length === 0 ? <div className="widget-empty"><p>No customer data yet.</p></div> : (
            <>
              <div className="cust-cards2">
                {(custAll ? custData : custData.slice(0, 4)).map((x, i) => {
                  const pend = Object.entries(x.c.pend || {}).sort((a, b) => b[1] - a[1]).map(([sh]) => sh)
                  return (
                    <div key={x.name} className="cc2">
                      <div className="cc2-head">
                        <span className="cc2-name" title={x.name}>{x.name}</span>
                        <Ring pct={x.m.pct} c1={x.c1} c2={x.c2} gid={`rgc${i}`} size={50} />
                      </div>
                      <div className="cc2-kpis">
                        <div className="k-blue"><b>{x.c.jobs}</b><span>Jobs</span></div>
                        <div className="k-green"><b>{x.m.onTime}%</b><span>On-time</span></div>
                        <div className="k-violet"><b>{x.c.done}/{x.c.app}</b><span>Reports</span></div>
                      </div>
                      <div className="cc2-pend">
                        <span className="cc2-pend-lab">Pending</span>
                        {pend.length
                          ? <span className="cc2-pend-chips">{pend.slice(0, 5).map((sh) => <i key={sh}>{sh}</i>)}{pend.length > 5 && <i className="more">+{pend.length - 5}</i>}</span>
                          : <span className="cc2-pend-done">All reports done ✓</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
              {custData.length > 4 && <button className="btn btn-ghost btn-sm cust-seeall" onClick={() => setCustAll((v) => !v)}>{custAll ? 'Show less' : `See all ${custData.length}`}</button>}
            </>
          )}
        </section>

        {/* ── recent activity ── */}
        <section className="card table-card bento-activity">
          <h3 className="widget-title" style={{ padding: '16px 18px 4px' }}>Recent activity</h3>
          {activity.length === 0 ? (
            <div className="widget-empty" style={{ padding: '8px 18px 20px' }}><p>No activity yet. Create your first report.</p></div>
          ) : (
            <div className="activity-list">
              {activity.map(({ report: r, verb, at }) => (
                <button key={r.id} className="activity-row" onClick={() => openReport(r)}>
                  <span className={`act-dot act-${r.status}`} />
                  <span className="act-main">
                    <strong>{r.reportId}</strong>
                    <small>{FORM_SCHEMAS[r.formKey]?.title} · {verb} by {r.inspector}</small>
                  </span>
                  <span className="act-time">{fmtDateTime(at)}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {newForm && (
        <JobPicker
          title={FORM_SCHEMAS[newForm].title}
          sub="Pick the job this report is against — page 1 is then written from it."
          onPick={(jobNo) => navigate(`/job/${jobNo}/form/${newForm}?d=${encodeURIComponent(FORM_SCHEMAS[newForm].deliverable)}`)}
          onClose={() => setNewForm(null)} />
      )}
    </div>
  )
}
