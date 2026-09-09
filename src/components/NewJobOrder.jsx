import { useMemo, useState } from 'react'
import { useApp, navigate } from '../App.jsx'
import { DELIVERABLES } from '../lib/constants.js'
import { FORM_SCHEMAS } from '../data/formSchemas.js'
import { saveOrder, deleteOrder, orderById, takenJobNos } from '../lib/jobOrders.js'
import { getReports } from '../lib/store.js'
import { fmtDate } from '../lib/status.js'
import { IconPlus, IconTrash, IconCheck, IconDoc, IconPen, IconCloudUp } from './Icons.jsx'
import Masthead from './Masthead.jsx'
import { artFor } from '../lib/productArt.js'

/* Creating a job order: the PO once, then a row per unit, then the
   reports every unit on the order has to produce. Publishing turns each
   unit into a job the inspectors can pick up. */

const blankUnit = () => ({ jobNo: '', wbsNo: '', unitNo: '', productDesc: '', type: '' })

/* Step the last run of digits in an identifier, keeping its width.

   1000200301 → 1000200302, WBS-26-0301 → WBS-26-0302, 200301-001 →
   200301-002. It is the last run rather than the first because every
   number in this shop is a prefix and a sequence: bumping WBS-26-0301
   at the 26 would change the year. Width is kept so 001 becomes 002 and
   not 2 — the zeros are part of how these read in a folder. */
export const bumpTail = (s = '') => {
  const m = String(s).match(/^(.*?)(\d+)(\D*)$/)
  if (!m) return String(s)
  const [, head, digits, tail] = m
  return head + String(Number(digits) + 1).padStart(digits.length, '0') + tail
}

/* Declared here, not inside the screen. A component defined in a render
   body is a brand-new component type on every render, so React unmounts
   the old subtree and mounts a fresh one — which threw away the <input>
   and its focus after every single keystroke. */
const F = ({ label, children, hint }) => (
  <label className="jo-field">
    <span>{label}</span>
    {children}
    {hint && <small>{hint}</small>}
  </label>
)

/* The deliverables split by what closing one actually involves.

   This used to split on whether a form existed at all — anything
   without one was "attached by hand", which meant nothing in the app.
   Every deliverable can be closed here now, so the line moved to the
   real difference: six are inspections this shop carries out and
   records as it goes, and three are documents issued elsewhere that
   this shop files. Both produce a report; only the first is a test.

   The inspections stay ticked by default, as they were. A document is
   the order's decision to ask for, not ours. */
const isRecord = (d) => FORM_SCHEMAS[d.form]?.kind === 'record'
const FILLABLE = DELIVERABLES.filter((d) => d.form && !isRecord(d))
const RECORDS = DELIVERABLES.filter((d) => isRecord(d))

const formName = (d) =>
  d.form === 'nde' ? 'MT / PT / UT' : FORM_SCHEMAS[d.form]?.title || ''

/* What is already filed against an order.

   An order is not a form somebody is still filling in: the moment it is
   published, inspectors record documents against its units. Which means
   revising one can destroy evidence without touching a single report —
   untick a deliverable and cellStatus returns n/a for it, so the
   document that answers it disappears from the register while sitting
   in storage; rename a unit's job number and every report keyed to the
   old number is orphaned; delete the unit and they are stranded.

   So the editor is built around this: it counts what is filed, per unit
   and per deliverable, and refuses the edits that would hide any of it.
   Counting once here rather than per row — outstandingBy walks every
   deliverable of every unit and this screen renders nine of them. */
function useFiled(order) {
  return useMemo(() => {
    if (!order) return { byJob: new Map(), byDeliv: new Map(), total: 0 }
    const jobNos = new Set((order.units || []).map((u) => String(u.jobNo)))
    const byJob = new Map()
    const byDeliv = new Map()
    let total = 0
    for (const r of getReports()) {
      if (!jobNos.has(String(r.jobNo))) continue
      total++
      byJob.set(String(r.jobNo), (byJob.get(String(r.jobNo)) || 0) + 1)
      if (r.deliverable) byDeliv.set(r.deliverable, (byDeliv.get(r.deliverable) || 0) + 1)
    }
    return { byJob, byDeliv, total }
  }, [order])
}

const docCount = (n) => `${n} document${n === 1 ? '' : 's'}`

export default function NewJobOrder({ orderId }) {
  const { role, session, meta, notify, refresh } = useApp()
  // Read once: the editor holds the order it opened with, so a later
  // save cannot be built on a copy that changed underneath it.
  const held = useMemo(() => (orderId ? orderById(orderId) : null), [orderId])
  const editing = !!held
  const filed = useFiled(held)

  const [po, setPo] = useState(() => ({
    poNo: held?.poNo || '', customerName: held?.customerName || '', customerId: held?.customerId || '',
    kategori: held?.kategori || 'SUPEQ', datePB: held?.datePB || '',
    // An order raised before the target field existed put its promise in
    // datePdiRelease, so editing one reads the date it was given rather
    // than opening with the field blank.
    dateTarget: held?.dateTarget || held?.datePdiRelease || '',
  }))
  const [units, setUnits] = useState(() => (held?.units?.length
    ? held.units.map((u) => ({ jobNo: u.jobNo || '', wbsNo: u.wbsNo || '', unitNo: u.unitNo || '', productDesc: u.productDesc || '', type: u.type || '' }))
    : [blankUnit()]))
  const [required, setRequired] = useState(() => new Set(held?.required || FILLABLE.map((d) => d.key)))
  const [touched, setTouched] = useState(false)
  const [ask, setAsk] = useState(null)   // 'withdraw'

  /* Above the early returns below, with the rest of the hooks. React
     calls these in order on every render, so one sitting after a
     conditional return is a bug waiting for the condition to change. */
  const taken = useMemo(() => takenJobNos(orderId), [orderId])

  // Every reason this order cannot be published yet, named rather than
  // just disabling the button.
  const problems = useMemo(() => {
    const out = []
    if (!po.poNo.trim()) out.push('PO number is missing.')
    if (!po.customerName.trim()) out.push('Customer is missing.')
    if (!units.length) out.push('Add at least one unit.')
    const nos = units.map((u) => u.jobNo.trim()).filter(Boolean)
    units.forEach((u, i) => {
      if (!u.jobNo.trim()) out.push(`Unit ${i + 1} has no job number.`)
      else if (taken.has(u.jobNo.trim())) out.push(`Job ${u.jobNo.trim()} already exists.`)
      if (!u.productDesc.trim()) out.push(`Unit ${i + 1} has no description.`)
    })
    if (new Set(nos).size !== nos.length) out.push('Two units share a job number.')
    if (!required.size) out.push('Choose at least one report.')
    /* The two edits that would hide a document. Blocked in the controls
       as well, so this is the backstop rather than the explanation —
       but an order that reached this state must not save. */
    if (editing) {
      for (const u of held.units || []) {
        const n = filed.byJob.get(String(u.jobNo)) || 0
        if (!n) continue
        if (!units.some((x) => x.jobNo.trim() === String(u.jobNo))) {
          out.push(`Unit ${u.jobNo} carries ${docCount(n)} and cannot be removed or renumbered.`)
        }
      }
      for (const [key, n] of filed.byDeliv) {
        if (!required.has(key)) out.push(`${key} has ${docCount(n)} filed against it and cannot be dropped from the order.`)
      }
    }
    return out
  }, [po, units, required, taken, editing, held, filed])

  if (!role.canManage) {
    return (
      <div className="page">
        <Masthead variant="job" eyebrow="Job order" title={editing ? 'Revise job order' : 'New job order'}
          art={artFor()} onBack={() => navigate('/monitoring')} backLabel="Back to monitoring" />
        <div className="card empty-state">
          <p><strong>Only QC head or admin can {editing ? 'revise a job order' : 'create a job order'}.</strong></p>
          <p>Ask an admin to raise the order; it will appear in your Jobs list once published.</p>
        </div>
      </div>
    )
  }

  // An id that no longer resolves is a stale link, not an empty form:
  // filling one in here would publish a second order for the same PO.
  if (orderId && !held) {
    return (
      <div className="page">
        <Masthead variant="job" eyebrow="Job order" title="Order not found"
          art={artFor()} onBack={() => navigate('/monitoring')} backLabel="Back to monitoring" />
        <div className="card empty-state">
          <p><strong>That order is no longer on file.</strong></p>
          <p>It may have been withdrawn. The register shows what is live.</p>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/monitoring')}>Open monitoring</button>
        </div>
      </div>
    )
  }

  // A unit that already carries documents cannot be renumbered or
  // removed: its reports are keyed to that job number.
  const filedOn = (jobNo) => filed.byJob.get(String((jobNo || '').trim())) || 0
  const lockedUnit = (u) => editing && filedOn(u.jobNo) > 0
  // Nor can a deliverable that answers to a document be made n/a.
  const filedFor = (key) => (editing ? filed.byDeliv.get(key) || 0 : 0)

  const setUnit = (i, patch) =>
    setUnits((us) => us.map((u, x) => (x === i ? { ...u, ...patch } : u)))

  const addUnit = () => setUnits((us) => [...us, blankUnit()])

  /* Six identical tanks on one PO is the ordinary case, and they are
     six consecutive numbers. Copying used to clear all three
     identifiers and leave them to be typed again, which on a ten-unit
     order is thirty numbers keyed by hand off the row above.

     So the copy steps them: job, WBS and unit number each take the next
     value, type and description carry over untouched. A job number that
     is already on the order or already in the register keeps stepping
     until it is free, so copying twice in a row cannot make a
     duplicate — the one thing that would stop the order publishing. */
  const duplicateLast = () => setUnits((us) => {
    const last = us[us.length - 1] || blankUnit()
    const used = new Set([...taken, ...us.map((u) => u.jobNo.trim()).filter(Boolean)])
    let jobNo = bumpTail(last.jobNo)
    // A number with no digits cannot step, and stepping it forever would
    // hang; leave it for the field to flag as missing instead.
    if (jobNo !== last.jobNo) {
      let guard = 0
      while (used.has(jobNo) && guard++ < 999) jobNo = bumpTail(jobNo)
    }
    return [...us, {
      ...last,
      jobNo: jobNo === last.jobNo ? '' : jobNo,
      wbsNo: bumpTail(last.wbsNo),
      unitNo: bumpTail(last.unitNo),
    }]
  })

  const removeUnit = (i) => setUnits((us) => {
    if (us.length === 1) return us
    const n = filedOn(us[i]?.jobNo)
    if (n > 0) {
      notify(`Unit ${us[i].jobNo} carries ${docCount(n)}. Removing it would strand them.`, 'err')
      return us
    }
    return us.filter((_, x) => x !== i)
  })

  const publish = () => {
    setTouched(true)
    if (problems.length) { notify('Fix the highlighted details first', 'err'); return }
    saveOrder({
      /* Revising keeps the order's identity — its id is what every unit
         it produced is stamped with, so a new one would fork the
         order and leave the documents pointing at the old half. */
      id: held?.id || `po-${Date.now()}`,
      poNo: po.poNo.trim(),
      customerName: po.customerName.trim(),
      customerId: po.customerId.trim(),
      kategori: po.kategori,
      datePB: po.datePB || null,
      dateTarget: po.dateTarget || null,
      required: DELIVERABLES.filter((d) => required.has(d.key)).map((d) => d.key),
      units: units.map((u) => ({
        jobNo: u.jobNo.trim(), wbsNo: u.wbsNo.trim(), unitNo: u.unitNo.trim(),
        productDesc: u.productDesc.trim(), type: u.type.trim(),
      })),
      createdBy: held?.createdBy || session?.name || 'QA Lead',
      createdAt: held?.createdAt || new Date().toISOString(),
      ...(editing ? { revisedBy: session?.name || 'QA Lead', revisedAt: new Date().toISOString() } : {}),
    })
    refresh()
    notify(editing
      ? `PO ${po.poNo.trim()} revised — ${units.length} job${units.length === 1 ? '' : 's'} on the order`
      : `PO ${po.poNo.trim()} published — ${units.length} job${units.length === 1 ? '' : 's'} ready to inspect`)
    navigate(editing ? `/po/${encodeURIComponent(po.poNo.trim())}` : '/monitoring')
  }

  /* Withdrawing an order deletes its units, and a unit is where a
     report is bound. So it is only ever offered while nothing is filed
     against any of them; past that the order has a history and the way
     to close it is the work, not the delete key. */
  const withdraw = () => {
    if (filed.total > 0) {
      notify(`${docCount(filed.total)} filed against this order. It cannot be withdrawn.`, 'err')
      return
    }
    deleteOrder(held.id)
    refresh()
    notify(`PO ${held.poNo} withdrawn — ${(held.units || []).length} job${(held.units || []).length === 1 ? '' : 's'} removed`)
    navigate('/monitoring')
  }

  const toggle = (key) => setRequired((s) => {
    const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n
  })

  return (
    <div className="page jo">
      <Masthead variant="job" eyebrow="Job order"
        title={editing ? `Revise ${held.poNo}` : 'New job order'}
        sub={editing
          ? [`Raised by ${held.createdBy || 'an admin'}`,
            held.revisedAt ? `revised ${fmtDate(held.revisedAt)}` : null,
            'the order, its units, and the reports they owe'].filter(Boolean).join(' · ')
          : 'The order, its units, and the reports they owe'}
        art={artFor(...(editing ? (held.units || []).map((u) => u.productDesc) : []))}
        onBack={() => navigate(editing ? `/po/${encodeURIComponent(held.poNo)}` : '/monitoring')}
        backLabel={editing ? `Back to ${held.poNo}` : 'Back to monitoring'} />

      <p className="page-sub jo-lede">
        {editing
          ? filed.total > 0
            ? <>{docCount(filed.total)} already filed against this order. Anything they answer to is held.</>
            : <>Nothing is filed against this order yet, so every part of it can still change.</>
          : <>Publishing puts these jobs in front of the inspectors.</>}
      </p>

      {/* ── 1. the order ── */}
      <section className="jo-step">
        <div className="jo-step-head"><span className="jo-num">1</span><h3>Purchase order</h3></div>
        <div className="card jo-card">
          <div className="jo-grid">
            <F label="PO number" hint="As raised by the customer.">
              <input value={po.poNo} onChange={(e) => setPo({ ...po, poNo: e.target.value })}
                placeholder="PO-2026-0142" />
            </F>
            <F label="Customer">
              <input value={po.customerName} onChange={(e) => setPo({ ...po, customerName: e.target.value })}
                placeholder="Customer name" list="jo-customers" />
              <datalist id="jo-customers">
                {(meta?.customers || []).map((c) => <option key={c} value={c} />)}
              </datalist>
            </F>
            <F label="Customer ID">
              <input value={po.customerId} onChange={(e) => setPo({ ...po, customerId: e.target.value })}
                placeholder="CUST-001" />
            </F>
            <F label="Category">
              <select value={po.kategori} onChange={(e) => setPo({ ...po, kategori: e.target.value })}>
                {(meta?.kategoris || ['SUPEQ', 'TRAILER', 'NON TRAILER']).map((k) =>
                  <option key={k} value={k}>{k}</option>)}
              </select>
            </F>
            <F label="Date PB">
              <input type="date" value={po.datePB || ''} onChange={(e) => setPo({ ...po, datePB: e.target.value })} />
            </F>
            {/* Not the PDI release date. That one is a fact about work
                that has not happened yet — it is stamped when the
                pre-delivery inspection is approved — and asking for it
                here made a plan and a record share a field. */}
            <F label="Target delivery" hint="When the unit is due out. Past it without its reports, a unit counts as overdue.">
              <input type="date" value={po.dateTarget || ''}
                onChange={(e) => setPo({ ...po, dateTarget: e.target.value })} />
            </F>
          </div>
        </div>
      </section>

      {/* ── 2. the units ── */}
      <section className="jo-step">
        <div className="jo-step-head">
          <span className="jo-num">2</span>
          <h3>Units on this PO</h3>
          <span className="jo-step-n">{units.length}</span>
        </div>
        <div className="card jo-card">
          <div className="jo-units">
            {units.map((u, i) => (
              <div className="jo-unit" key={i}>
                <span className="jo-unit-n">{i + 1}</span>
                <div className="jo-grid jo-grid-unit">
                  <F label="Job number"
                    hint={lockedUnit(u) ? `${docCount(filedOn(u.jobNo))} filed — this number is what they are keyed to` : undefined}>
                    <input value={u.jobNo} onChange={(e) => setUnit(i, { jobNo: e.target.value })}
                      placeholder="1000200301" readOnly={lockedUnit(u)}
                      className={touched && (!u.jobNo.trim() || taken.has(u.jobNo.trim())) ? 'is-bad' : ''} />
                  </F>
                  <F label="WBS number">
                    <input value={u.wbsNo} onChange={(e) => setUnit(i, { wbsNo: e.target.value })}
                      placeholder="WBS-26-0301" />
                  </F>
                  <F label="Unit number">
                    <input value={u.unitNo} onChange={(e) => setUnit(i, { unitNo: e.target.value })}
                      placeholder="200301-001" />
                  </F>
                  <F label="Type">
                    <input value={u.type} onChange={(e) => setUnit(i, { type: e.target.value })}
                      placeholder="WATER TRUCK" list="jo-types" />
                  </F>
                  <F label="Description">
                    <input value={u.productDesc} onChange={(e) => setUnit(i, { productDesc: e.target.value })}
                      placeholder="WATER TANK 20KL"
                      className={touched && !u.productDesc.trim() ? 'is-bad' : ''} />
                  </F>
                </div>
                <button className="btn btn-ghost btn-icon jo-unit-del" aria-label={`Remove unit ${i + 1}`}
                  disabled={units.length === 1 || lockedUnit(u)} onClick={() => removeUnit(i)}
                  title={lockedUnit(u) ? `${docCount(filedOn(u.jobNo))} filed against this unit` : 'Remove this unit'}>
                  <IconTrash size={13} />
                </button>
              </div>
            ))}
          </div>
          <datalist id="jo-types">
            {(meta?.types || []).map((t) => <option key={t} value={t} />)}
          </datalist>
          <div className="jo-unit-actions">
            <button className="btn btn-secondary btn-sm" onClick={addUnit}><IconPlus size={13} /> Add unit</button>
            <button className="btn btn-secondary btn-sm" onClick={duplicateLast}>
              <IconPlus size={13} /> Copy last unit
            </button>
            <span className="jo-hint">Six identical tanks on one PO: fill the first, then copy it — the numbers step up by one.</span>
          </div>
        </div>
      </section>

      {/* ── 3. the reports ── */}
      <section className="jo-step">
        <div className="jo-step-head">
          <span className="jo-num">3</span>
          <h3>Reports required</h3>
          <span className="jo-step-n">{required.size}</span>
        </div>
        <div className="card jo-card">
          <p className="jo-lede">
            Applies to every unit on this PO. An inspector opening one of these jobs sees only
            what is ticked here.
          </p>
          <p className="set-legend">Inspection reports — filled in the app</p>
          <div className="jo-picks">
            {FILLABLE.map((d) => {
              const n = filedFor(d.key)
              return (
                <label key={d.key} className={`jo-pick${required.has(d.key) ? ' on' : ''}${n ? ' is-held' : ''}`}>
                  <input type="checkbox" checked={required.has(d.key)} disabled={n > 0} onChange={() => toggle(d.key)} />
                  <span className="jo-pick-box" aria-hidden="true"><IconCheck size={11} /></span>
                  <span className="jo-pick-text">
                    <strong>{d.label}</strong>
                    {/* Dropping this would return every one of those
                        documents to n/a and hide it from the register
                        while it sat in storage. */}
                    <small>{n ? <>{docCount(n)} filed — held on the order</> : <><IconPen size={10} /> {formName(d)}</>}</small>
                  </span>
                </label>
              )
            })}
          </div>
          <p className="set-legend">Document deliverables — issued elsewhere, filed here with the signed pages</p>
          <div className="jo-picks">
            {RECORDS.map((d) => {
              const n = filedFor(d.key)
              return (
                <label key={d.key} className={`jo-pick${required.has(d.key) ? ' on' : ''}${n ? ' is-held' : ''}`}>
                  <input type="checkbox" checked={required.has(d.key)} disabled={n > 0} onChange={() => toggle(d.key)} />
                  <span className="jo-pick-box" aria-hidden="true"><IconCheck size={11} /></span>
                  <span className="jo-pick-text">
                    <strong>{d.label}</strong>
                    {/* Dropping this would return every one of those
                        documents to n/a and hide it from the register
                        while it sat in storage. */}
                    <small>{n ? <>{docCount(n)} filed — held on the order</> : <><IconDoc size={10} /> {formName(d)}</>}</small>
                  </span>
                </label>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── publish ── */}
      <div className="jo-publish">
        <div className="jo-summary">
          <strong>{units.length} job{units.length === 1 ? '' : 's'}</strong>
          <span>
            {required.size} report{required.size === 1 ? '' : 's'} each ·{' '}
            {units.length * required.size} inspection{units.length * required.size === 1 ? '' : 's'} in total
          </span>
        </div>
        <button className="btn btn-primary" onClick={publish}>
          <IconCloudUp size={15} /> {editing ? 'Save changes' : 'Publish job order'}
        </button>
      </div>
      {touched && problems.length > 0 && (
        <ul className="jo-problems" role="alert">
          {[...new Set(problems)].map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}

      {/* Withdrawing an order takes its units with it, and a unit is
          where a report is bound. Offered plainly while the order is
          still empty; once anything is filed the block is stated rather
          than the button being greyed out with no reason. */}
      {editing && (
        <section className="jo-withdraw">
          <div>
            <h4>Withdraw this order</h4>
            <p>
              {filed.total > 0
                ? <>Not possible: {docCount(filed.total)} {filed.total === 1 ? 'is' : 'are'} filed against
                  its units, and withdrawing the order would strand {filed.total === 1 ? 'it' : 'them'}. Close
                  the work out instead.</>
                : <>Removes the order and its {(held.units || []).length} unit{(held.units || []).length === 1 ? '' : 's'} from
                  the register. Nothing is filed against {(held.units || []).length === 1 ? 'it' : 'them'}, so nothing is lost.</>}
            </p>
          </div>
          <button className="btn btn-secondary is-danger" disabled={filed.total > 0}
            onClick={() => setAsk('withdraw')}>
            <IconTrash size={14} /> Withdraw order
          </button>
        </section>
      )}

      {ask === 'withdraw' && (
        <div className="modal-backdrop" onClick={() => setAsk(null)}>
          <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}
            role="dialog" aria-modal="true" aria-label={`Withdraw PO ${held.poNo}`}>
            <div className="sheet-handle" />
            <h3>Withdraw PO {held.poNo}?</h3>
            <p className="confirm-body">
              Its {(held.units || []).length} unit{(held.units || []).length === 1 ? '' : 's'}{' '}
              {(held.units || []).length === 1 ? 'leaves' : 'leave'} the register and the inspectors' lists. No
              document is filed against {(held.units || []).length === 1 ? 'it' : 'them'}, so this loses no
              evidence — but the order will have to be raised again to bring the work back.
            </p>
            <div className="confirm-acts">
              <button className="btn btn-secondary is-danger" onClick={() => { setAsk(null); withdraw() }}>
                Withdraw the order
              </button>
              <button className="btn btn-ghost" onClick={() => setAsk(null)}>Keep it</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
