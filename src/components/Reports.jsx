import { useMemo, useState, useEffect } from 'react'
import { useApp, navigate } from '../App.jsx'
import { FORM_SCHEMAS } from '../data/formSchemas.js'
import {
  getReports, deleteReport, withdrawReport, voidReport, approveReport, canApprove, actionFor,
} from '../lib/store.js'
import ConfirmDialog from './ConfirmDialog.jsx'
import { ncrReports, fmtDateTime } from '../lib/status.js'
import { reportResult } from '../lib/verdict.js'
import { StateBadge } from './StatusChip.jsx'
import { IconTrash, IconDownload, IconCloudUp, IconCloudOff, IconFilter, IconGroup, IconApprove, IconXCircle } from './Icons.jsx'
import { SearchField, ToolButton, PopCheck, PopRadio, PopFooter } from './RegisterBar.jsx'
import { downloadCsv, stampToday } from '../lib/csv.js'

/* One register, not two.

   Monitor was a second list of exactly these reports — same five status
   tabs, same filter and grouping tools — drawn as a table instead of
   cards. Two screens answering one question means two places to look and
   two things to keep in step, so the table is gone and the one thing it
   could do that this could not came with it: approving a submitted
   report without opening it.

   Its row checkboxes did not come. They selected rows and no action ever
   read the selection. */
const TABS = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Draft' },
  { id: 'submitted', label: 'Submitted' },
  { id: 'returned', label: 'Sent back' },
  { id: 'approved', label: 'Approved' },
  { id: 'ncr', label: 'NCR' },
]

// Sorting came from the table's column headers. The columns are gone;
// the orders people actually used are not.
const ORDERS = [
  { id: 'new', label: 'Newest first', of: (a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '') },
  { id: 'old', label: 'Oldest first', of: (a, b) => (a.updatedAt || '').localeCompare(b.updatedAt || '') },
  { id: 'id', label: 'Report number', of: (a, b) => (a.reportId || '').localeCompare(b.reportId || '') },
  { id: 'job', label: 'Job number', of: (a, b) => String(a.jobNo).localeCompare(String(b.jobNo)) || (a.reportId || '').localeCompare(b.reportId || '') },
]

// 154 cards is a long way to scroll past to reach a filter you meant to
// change. The table paged; this asks for more when you want more.
const PAGE = 30

// Same tools as the other two registers. Reports has always grouped by
// form type; that is the default now rather than the only option.
const GROUPS = [
  { id: 'form', label: 'Form', of: (r) => FORM_SCHEMAS[r.formKey]?.title || r.formKey },
  { id: 'job', label: 'Job', of: (r) => `Job ${r.jobNo}` },
  { id: 'inspector', label: 'Inspector', of: (r) => r.inspector || 'Unassigned' },
  { id: 'none', label: 'No grouping', of: null },
]



/* A report number is one word to a browser, so a narrow card either cuts
   it or breaks it at whatever character happens to be at the edge. The
   slashes are its real joints: marking them lets the line break where a
   person would read a break. */
const idParts = (id = '') => String(id).split('/')
export const ReportId = ({ id }) => (
  <>{idParts(id).map((part, i, all) => (
    <span key={i}>{part}{i < all.length - 1 ? <>/<wbr /></> : null}</span>
  ))}</>
)
/* One report, as a card.

   The old row put five things on five bands of their own once the screen
   narrowed: an icon, a number, a meta line, a sync line, then a status
   pill and a bin sharing a fourth. Four reports filled a phone screen.

   This is the same five things on three lines, around one mark. The mark
   carries the form code rather than a document glyph — every report in
   this list is a document, so drawing one says nothing — and it is
   tinted by the report's state, which the badge beside it also names in
   words. Colour and text, so neither has to carry it alone. */
const ACT_WORD = { delete: 'Delete', withdraw: 'Withdraw', void: 'Void' }

function ReportCard({ r, tone, code, title, sub, foot, onOpen, onDelete, canDelete, onApprove, action }) {
  return (
    <div className={`rep-card tone-${tone}`} role="button" tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}>
      <span className="rep-code" aria-hidden="true">{code}</span>
      <strong className="rep-id">{title}</strong>
      <span className="rep-state"><StateBadge status={r.status} /></span>
      <small className="rep-sub">{sub}</small>
      <small className="rep-foot">{foot}</small>
      {onApprove && (
        <button className="rep-approve" onClick={(e) => { e.stopPropagation(); onApprove() }}>
          <IconApprove size={13} /> Approve
        </button>
      )}
      {canDelete && (
        // The label says which of the three this is, so a screen reader
        // is not told "delete" about a report that will be kept.
        <button className="rep-del" aria-label={`${ACT_WORD[action] || 'Delete'} ${r.reportId}`}
          title={`${ACT_WORD[action] || 'Delete'} ${r.reportId}`} onClick={onDelete}>
          {action === 'void' ? <IconXCircle size={14} /> : <IconTrash size={14} />}
        </button>
      )}
    </div>
  )
}

export default function Reports({ query }) {
  const { role, session, tick, refresh, notify } = useApp()
  const [tab, setTab] = useState(query?.f && TABS.some((t) => t.id === query.f) ? query.f : 'all')
  useEffect(() => {
    if (query?.f && TABS.some((t) => t.id === query.f)) setTab(query.f)
  }, [query?.f])
  const [q, setQ] = useState('')
  const [order, setOrder] = useState('new')
  const [forms, setForms] = useState(() => new Set())
  const [group, setGroup] = useState('form')
  const [limit, setLimit] = useState(PAGE)
  // The report a destructive action is being asked about, or null.
  const [ask, setAsk] = useState(null)

  const all = useMemo(() => getReports(), [tick])
  const ncrs = useMemo(() => ncrReports(), [tick])

  const ql = q.trim().toLowerCase()
  const matchQ = (r) => !ql || `${r.reportId} ${r.jobNo} ${r.inspector} ${FORM_SCHEMAS[r.formKey]?.title}`.toLowerCase().includes(ql)

  const base = tab === 'ncr' ? ncrs : all.filter((r) => tab === 'all' || r.status === tab)
  // Tab and search, before the form filter: the counts in the filter
  // panel have to stay put as you tick boxes.
  const scoped = base.filter(matchQ)

  const counts = useMemo(() => ({
    all: all.length,
    draft: all.filter((r) => r.status === 'draft').length,
    submitted: all.filter((r) => r.status === 'submitted').length,
    returned: all.filter((r) => r.status === 'returned').length,
    approved: all.filter((r) => r.status === 'approved').length,
    ncr: ncrs.length,
  }), [all, ncrs])

  const formList = useMemo(() => {
    const m = new Map()
    for (const r of scoped) {
      const k = r.formKey
      m.set(k, { key: k, label: FORM_SCHEMAS[k]?.title || k, n: (m.get(k)?.n || 0) + 1 })
    }
    return [...m.values()].sort((a, b) => a.label.localeCompare(b.label))
  }, [scoped])

  const matched = scoped
    .filter((r) => !forms.size || forms.has(r.formKey))
    .slice()
    .sort(ORDERS.find((o) => o.id === order)?.of)
  const shown = matched.slice(0, limit)

  // Anything that changes what is being listed starts the count again,
  // or you carry a scroll position from a list you are no longer in.
  useEffect(() => { setLimit(PAGE) }, [tab, q, order, forms, group])

  const groups = useMemo(() => {
    const of = GROUPS.find((g) => g.id === group)?.of
    if (!of) return [[null, shown]]
    const m = new Map()
    for (const r of shown) {
      const key = of(r)
      if (!m.has(key)) m.set(key, [])
      m.get(key).push(r)
    }
    return [...m.entries()]
  }, [shown, group])

  /* One button, three meanings, decided by where the report stands.

     A draft is deleted, a submitted report is withdrawn to draft, an
     approved one is voided and kept. The dialog says which of those is
     about to happen and takes the reason, because "deleted" with no
     explanation is the thing an auditor asks about first. */
  const act = ask && actionFor(ask)
  const doAct = (note) => {
    try {
      if (act === 'delete') { deleteReport(ask.id, session?.name, note); notify(`${ask.reportId} deleted`) }
      else if (act === 'withdraw') { withdrawReport(ask.id, session?.name, note); notify(`${ask.reportId} withdrawn — it is a draft again`) }
      else if (act === 'void') { voidReport(ask.id, session?.name, note); notify(`${ask.reportId} voided — it stays on the record`) }
      refresh()
    } catch (err) {
      notify(err.message, 'err')
    }
    setAsk(null)
  }

  // Quoting and formula-defusing live in lib/csv.js; this only decides
  // which columns go out.
  const exportCsv = () => downloadCsv(`qc-reports-${stampToday()}.csv`, [
    ['Report ID', 'Form', 'Job No', 'Deliverable', 'Inspector', 'Status', 'Result', 'Updated', 'Synced'],
    ...matched.map((r) => [
      r.reportId, FORM_SCHEMAS[r.formKey]?.title, r.jobNo, r.deliverable, r.inspector, r.status,
      reportResult(r), r.updatedAt?.slice(0, 16), r.synced ? r.syncedAt?.slice(0, 16) : 'offline',
    ]),
  ])

  const openReport = (r) =>
    navigate(`/job/${r.jobNo}/form/${r.formKey}?d=${encodeURIComponent(r.deliverable)}&rid=${encodeURIComponent(r.id)}`)

  return (
    <div className="page">
      <div className="page-bar">
        <div className="mon-tabs" role="tablist" aria-label="Report status">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id}
              className={`mon-tab${tab === t.id ? ' on' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}<span className={`mon-tab-n${t.id === 'ncr' && counts.ncr ? ' is-alarm' : ''}`}>{counts[t.id]}</span>
            </button>
          ))}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={exportCsv}>
          <IconDownload size={14} /> Export CSV
        </button>
      </div>

      <div className="rb-bar">
        <div className="rb-group">
          <SearchField value={q} onChange={setQ} label="Search reports"
            placeholder="Search report no, job, inspector…" />
          <ToolButton icon={IconFilter} label="Filter by form" count={forms.size}>
            {() => (
              <>
                {formList.map((f) => (
                  <PopCheck key={f.key} label={f.label} on={forms.has(f.key)} hint={f.n}
                    onChange={(on) => setForms((s0) => {
                      const n = new Set(s0); on ? n.add(f.key) : n.delete(f.key); return n
                    })} />
                ))}
                {!formList.length && <p className="rb-pop-empty">Nothing to filter here.</p>}
                <PopFooter>
                  <button className="btn btn-ghost btn-sm" disabled={!forms.size}
                    onClick={() => setForms(new Set())}>Clear</button>
                </PopFooter>
              </>
            )}
          </ToolButton>
          <ToolButton icon={IconGroup} label="Group and sort" count={group === 'form' ? 0 : 1}>
            {({ close }) => (
              <>
                {GROUPS.map((g) => (
                  <PopRadio key={g.id} label={g.label} on={group === g.id}
                    onChange={() => { setGroup(g.id); close() }} />
                ))}
                <div className="rb-pop-legend">Order</div>
                {ORDERS.map((o) => (
                  <PopRadio key={o.id} label={o.label} on={order === o.id} onChange={() => setOrder(o.id)} />
                ))}
              </>
            )}
          </ToolButton>
        </div>
        <span className="mon-count">
          {matched.length} report{matched.length === 1 ? '' : 's'}
          {matched.length > shown.length && <> · showing {shown.length}</>}
        </span>
      </div>

      {matched.length === 0 ? (
        <div className="card empty-state">
          <p><strong>{tab === 'ncr' ? 'No NCR findings.' : 'No reports here yet.'}</strong></p>
          <p>{tab === 'ncr' ? 'Reports with non-conformance notes or rejected results will appear here.' : 'Create a report from the Home quick actions.'}</p>
          <button className="btn btn-secondary" onClick={() => navigate('/')}>Go to Home</button>
        </div>
      ) : tab === 'ncr' ? (
        <div className="rep-list">
          {shown.map((r) => (
            <ReportCard key={r.id} r={r} tone="ncr" code={FORM_SCHEMAS[r.formKey]?.code || '—'}
              title={<><ReportId id={r.reportId} /> — {reportResult(r) === 'Reject' ? 'Rejected' : 'Finding'}</>}
              sub={(r.values?.ncr || 'Non-conforming result recorded').slice(0, 110)}
              foot={<>Job {r.jobNo}{r.inspector ? ` · ${r.inspector}` : ''} · {fmtDateTime(r.updatedAt)}</>}
              onOpen={() => openReport(r)} canDelete={false} />
          ))}
        </div>
      ) : (
        groups.map(([groupName, reps]) => (
          <div key={groupName || 'all'}>
            {groupName && (
              <h3 className="section-title">{groupName} <span className="group-count">{reps.length}</span></h3>
            )}
            <div className="rep-list">
              {reps.map((r) => (
                <ReportCard key={r.id} r={r} tone={r.status}
                  code={FORM_SCHEMAS[r.formKey]?.code || '—'}
                  title={<ReportId id={r.reportId} />}
                  sub={<>Job {r.jobNo}{r.inspector ? ` · ${r.inspector}` : ''}</>}
                  foot={<>
                    <span className={r.synced ? 'sync-tag up' : 'sync-tag'}>
                      {r.synced ? <><IconCloudUp size={10} /> Uploaded</> : <><IconCloudOff size={10} /> Offline</>}
                    </span>
                    <span className="rep-dot" aria-hidden="true">·</span>
                    {fmtDateTime(r.updatedAt)}
                  </>}
                  onOpen={() => openReport(r)}
                  onDelete={(e) => { e.stopPropagation(); setAsk(r) }}
                  canDelete={role.canManage && !!actionFor(r)}
                  action={actionFor(r)}
                  onApprove={role.canOverride && r.status === 'submitted' && canApprove(r, session.name)
                    ? () => {
                        try { approveReport(r.id, session.name); refresh(); notify(`${r.reportId} approved`) }
                        catch (err) { notify(err.message, 'err') }
                      }
                    : null} />
              ))}
            </div>
          </div>
        ))
      )}

      {ask && (
        <ConfirmDialog
          title={`${ACT_WORD[act]} ${ask.reportId}?`}
          confirmLabel={act === 'delete' ? 'Delete the draft' : act === 'withdraw' ? 'Withdraw it' : 'Void it'}
          cancelLabel="Keep it as it is"
          danger
          reason
          reasonLabel={act === 'delete' ? 'Why is it being deleted?' : act === 'withdraw' ? 'Why is it coming back?' : 'Why is it being voided?'}
          onCancel={() => setAsk(null)}
          onConfirm={doAct}>
          {act === 'delete' && (
            <p>
              It is a draft, so nothing has been claimed by it and it goes for good. Its report
              number stays spent — the next report on this job takes the following one.
            </p>
          )}
          {act === 'withdraw' && (
            <p>
              It goes back to being your draft and leaves the reviewer's queue. Nothing is lost:
              the readings, photographs and signatures stay as they are, and the record keeps
              the fact that it was submitted and pulled back.
            </p>
          )}
          {act === 'void' && (
            <>
              <p>
                An approved report is not deleted. It stays in the record with its number, its
                readings and its signatures, marked void, and stops counting towards this job's
                completed work.
              </p>
              <p>
                If the inspection has to be recorded again, open the report and raise the next
                issue — that one supersedes this.
              </p>
            </>
          )}
        </ConfirmDialog>
      )}

      {matched.length > shown.length && (
        <div className="rep-more">
          <button className="btn btn-secondary btn-sm" onClick={() => setLimit((n) => n + PAGE)}>
            Show {Math.min(PAGE, matched.length - shown.length)} more
          </button>
          <small>{shown.length} of {matched.length}</small>
        </div>
      )}
    </div>
  )
}
