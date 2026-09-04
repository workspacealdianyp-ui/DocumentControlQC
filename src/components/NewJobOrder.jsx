import { useMemo, useState } from 'react'
import { useApp, navigate } from '../App.jsx'
import { DELIVERABLES } from '../lib/constants.js'
import { FORM_SCHEMAS } from '../data/formSchemas.js'
import { saveOrder, takenJobNos } from '../lib/jobOrders.js'
import { IconPlus, IconTrash, IconCheck, IconDoc, IconPen, IconCloudUp } from './Icons.jsx'
import Masthead from './Masthead.jsx'

/* Creating a job order: the PO once, then a row per unit, then the
   reports every unit on the order has to produce. Publishing turns each
   unit into a job the inspectors can pick up. */

const blankUnit = () => ({ jobNo: '', wbsNo: '', unitNo: '', productDesc: '', type: '' })

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

// The deliverables split by whether this build can actually fill them
// in. Only the fillable ones are on by default, because those are the
// forms we have; the rest are documents someone attaches by hand.
const FILLABLE = DELIVERABLES.filter((d) => d.form)
const MANUAL = DELIVERABLES.filter((d) => !d.form)

const formName = (d) =>
  d.form === 'nde' ? 'MT / PT / UT' : FORM_SCHEMAS[d.form]?.title || ''

export default function NewJobOrder() {
  const { role, session, meta, notify, refresh } = useApp()
  const [po, setPo] = useState({
    poNo: '', customerName: '', customerId: '', kategori: 'SUPEQ',
    datePB: '', datePdiRelease: '',
  })
  const [units, setUnits] = useState([blankUnit()])
  const [required, setRequired] = useState(() => new Set(FILLABLE.map((d) => d.key)))
  const [touched, setTouched] = useState(false)

  if (!role.canManage) {
    return (
      <div className="page">
        <Masthead code="PO" eyebrow="Job order" title="New job order"
          onBack={() => navigate('/jobs')} backLabel="Back to jobs" />
        <div className="card empty-state">
          <p><strong>Only QC head or admin can create a job order.</strong></p>
          <p>Ask an admin to raise the order; it will appear in your Jobs list once published.</p>
        </div>
      </div>
    )
  }

  const taken = useMemo(() => takenJobNos(), [])

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
    return out
  }, [po, units, required, taken])

  const setUnit = (i, patch) =>
    setUnits((us) => us.map((u, x) => (x === i ? { ...u, ...patch } : u)))

  const addUnit = () => setUnits((us) => [...us, blankUnit()])

  // Six identical tanks on one PO is the ordinary case, so copying the
  // last row and only changing its numbers is the fast path.
  const duplicateLast = () => setUnits((us) => {
    const last = us[us.length - 1] || blankUnit()
    return [...us, { ...last, jobNo: '', wbsNo: '', unitNo: '' }]
  })

  const removeUnit = (i) => setUnits((us) => (us.length === 1 ? us : us.filter((_, x) => x !== i)))

  const publish = () => {
    setTouched(true)
    if (problems.length) { notify('Fix the highlighted details first', 'err'); return }
    saveOrder({
      id: `po-${Date.now()}`,
      poNo: po.poNo.trim(),
      customerName: po.customerName.trim(),
      customerId: po.customerId.trim(),
      kategori: po.kategori,
      datePB: po.datePB || null,
      datePdiRelease: po.datePdiRelease || null,
      required: DELIVERABLES.filter((d) => required.has(d.key)).map((d) => d.key),
      units: units.map((u) => ({
        jobNo: u.jobNo.trim(), wbsNo: u.wbsNo.trim(), unitNo: u.unitNo.trim(),
        productDesc: u.productDesc.trim(), type: u.type.trim(),
      })),
      createdBy: session?.name || 'QA Lead',
      createdAt: new Date().toISOString(),
    })
    refresh()
    notify(`PO ${po.poNo.trim()} published — ${units.length} job${units.length === 1 ? '' : 's'} ready to inspect`)
    navigate('/jobs')
  }

  const toggle = (key) => setRequired((s) => {
    const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n
  })

  return (
    <div className="page jo">
      <Masthead code="PO" eyebrow="Job order" title="New job order"
        sub="The order, its units, and the reports they owe"
        onBack={() => navigate('/jobs')} backLabel="Back to jobs" />

      <p className="page-sub jo-lede">
        Publishing puts these jobs in front of the inspectors.
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
            <F label="PDI release" hint="A unit past this date without its reports counts as overdue.">
              <input type="date" value={po.datePdiRelease || ''}
                onChange={(e) => setPo({ ...po, datePdiRelease: e.target.value })} />
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
                  <F label="Job number">
                    <input value={u.jobNo} onChange={(e) => setUnit(i, { jobNo: e.target.value })}
                      placeholder="1000200301"
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
                  disabled={units.length === 1} onClick={() => removeUnit(i)}>
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
            <span className="jo-hint">Six identical tanks on one PO: fill the first, then copy it.</span>
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
            {FILLABLE.map((d) => (
              <label key={d.key} className={`jo-pick${required.has(d.key) ? ' on' : ''}`}>
                <input type="checkbox" checked={required.has(d.key)} onChange={() => toggle(d.key)} />
                <span className="jo-pick-box" aria-hidden="true"><IconCheck size={11} /></span>
                <span className="jo-pick-text">
                  <strong>{d.label}</strong>
                  <small><IconPen size={10} /> {formName(d)}</small>
                </span>
              </label>
            ))}
          </div>
          <p className="set-legend">Document deliverables — attached by hand</p>
          <div className="jo-picks">
            {MANUAL.map((d) => (
              <label key={d.key} className={`jo-pick${required.has(d.key) ? ' on' : ''}`}>
                <input type="checkbox" checked={required.has(d.key)} onChange={() => toggle(d.key)} />
                <span className="jo-pick-box" aria-hidden="true"><IconCheck size={11} /></span>
                <span className="jo-pick-text">
                  <strong>{d.label}</strong>
                  <small><IconDoc size={10} /> tracked manually</small>
                </span>
              </label>
            ))}
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
          <IconCloudUp size={15} /> Publish job order
        </button>
      </div>
      {touched && problems.length > 0 && (
        <ul className="jo-problems" role="alert">
          {[...new Set(problems)].map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}
    </div>
  )
}
