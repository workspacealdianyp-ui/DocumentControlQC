import { useMemo, useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useApp, navigate } from '../App.jsx'
import { FORM_SCHEMAS, IDENT_GROUPS, dimRowStatus, dimDeviation, dimBreach } from '../data/formSchemas.js'
import { getReport, saveReport, nextReportId, approveReport } from '../lib/store.js'
import { MR } from '../lib/compute.js'
import { fmtDate } from '../lib/status.js'
import { buildResume } from '../lib/resume.js'
import { jobIdentity } from '../lib/jobOrders.js'
import { getSettings } from '../lib/settings.js'
import PrintReport from './PrintReport.jsx'
import ReportDetail from './ReportDetail.jsx'
import SignaturePad from './SignaturePad.jsx'
import JobPicker from './JobPicker.jsx'
import Masthead from './Masthead.jsx'
import { IconPlus, IconTrash, IconPrint, IconPen, IconCheck, IconClock, IconAlert, IconSearch, IconChevronD } from './Icons.jsx'

// resolve a field label that may be a function of values
const lbl = (f, v) => (typeof f.label === 'function' ? f.label(v) : f.label)
const showField = (f, v) => (typeof f.showIf === 'function' ? f.showIf(v) : true)
const isReq = (f, v) => f.req === 'M' || (f.reqIf && v[f.reqIf.field] === f.reqIf.eq)

// ───────────────────────── primitive inputs ─────────────────────────
function Segmented({ value, options, onChange, disabled, invalid }) {
  return (
    <div className={`seg${invalid ? ' invalid' : ''}`} role="radiogroup">
      {options.map((o) => (
        <button key={o} type="button" disabled={disabled} role="radio" aria-checked={value === o}
          className={`seg-btn${value === o ? ' active' : ''}`} onClick={() => onChange(o)}>{o}</button>
      ))}
    </div>
  )
}

function Choice({ value, options, onChange, disabled, invalid }) {
  return (
    <div className={`choice-wrap${invalid ? ' invalid' : ''}`}>
      {options.map((o) => (
        <button key={o} type="button" disabled={disabled}
          className={`choice-chip${value === o ? ' active' : ''}`} onClick={() => onChange(value === o ? '' : o)}>{o}</button>
      ))}
    </div>
  )
}

function NumberInput({ value, onChange, unit, disabled, invalid, placeholder }) {
  return (
    <div className="num-wrap">
      <input type="number" step="any" inputMode="decimal" value={value ?? ''} disabled={disabled}
        className={invalid ? 'invalid' : undefined} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} />
      {unit && <span className="unit">{unit}</span>}
    </div>
  )
}

// PT dwell timer — live mm:ss, writes minutes, min 10
function DwellTimer({ value, onChange, disabled }) {
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(t)
  }, [running])
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')
  const ok = parseFloat(value || 0) >= 10
  return (
    <>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <NumberInput value={value} unit="min" disabled={disabled} invalid={value !== '' && !ok} onChange={onChange} />
        </div>
        <button type="button" disabled={disabled} className={`btn btn-sm ${running ? 'btn-primary' : 'btn-secondary'}`} style={{ minWidth: 104 }}
          onClick={() => { if (running) { setRunning(false); onChange(String(Math.max(parseFloat(value || 0), Math.ceil(elapsed / 60)))) } else { setElapsed(0); setRunning(true) } }}>
          <IconClock size={14} /> {running ? `${mm}:${ss}` : 'Timer'}
        </button>
      </div>
      {value !== '' && !ok && <div className="fld-err">Dwell time must be at least 10 minutes.</div>}
    </>
  )
}


/* One dialog for both decisions the form can put to you. The body says
   what happens rather than asking you to be sure: "are you sure" tells a
   person nothing they did not already know. */
function Confirm({ title, body, confirm, onConfirm, danger, onDanger, onClose }) {
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onClose])
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-handle" />
        <h3>{title}</h3>
        <p className="confirm-body">{body}</p>
        <div className="confirm-acts">
          <button className="btn btn-primary" autoFocus onClick={onConfirm}>{confirm}</button>
          {danger && <button className="btn btn-secondary is-danger" onClick={onDanger}>{danger}</button>}
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ───────────────────────── one field ─────────────────────────
function EngineField({ f, values, reqValues, report, set, locked, invalid, onRequestSign, signLocked, session, jobs, onJobChange }) {
  const v = values
  const disabled = locked || (f.adminOnly && false)
  // Required-ness is answered against the computed values too: "NCR notes
  // when the status is Reject" has to see a status nothing typed.
  const required = isReq(f, reqValues || v)
  const label = lbl(f, v)
  const half = f.half
  const unit = f.unitFrom ? (v[f.unitFrom] || '') : f.unit // unit can follow another field (e.g. pressureUnit)
  const full = !half && (f.type === 'textarea' || f.type === 'sign' || f.type === 'choice' || f.type === 'photos-inline')

  let control
  switch (f.type) {
    case 'segmented':
      control = <Segmented value={v[f.id] || ''} options={f.options} disabled={disabled} invalid={invalid} onChange={(x) => set(f.id, x)} />
      break
    case 'toggle':
      control = <Segmented value={v[f.id] || ''} options={f.options} disabled={disabled} invalid={invalid} onChange={(x) => set(f.id, x)} />
      break
    case 'choice':
      control = <Choice value={v[f.id] || ''} options={f.options} disabled={disabled} invalid={invalid} onChange={(x) => set(f.id, x)} />
      break
    case 'select':
      control = (
        <select value={v[f.id] || ''} disabled={disabled} className={invalid ? 'invalid' : undefined} onChange={(e) => set(f.id, e.target.value)}>
          <option value="">Select</option>
          {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )
      break
    case 'number':
      control = <NumberInput value={v[f.id]} unit={unit} disabled={disabled} invalid={invalid} placeholder={f.placeholder} onChange={(x) => set(f.id, x)} />
      break
    case 'date':
      control = <input type="date" value={v[f.id] || ''} disabled={disabled} className={invalid ? 'invalid' : undefined} onChange={(e) => set(f.id, e.target.value)} />
      break
    case 'textarea':
      control = <textarea rows={3} value={v[f.id] || ''} disabled={disabled} placeholder={f.placeholder} onChange={(e) => set(f.id, e.target.value)} />
      break
    case 'readonly':
      control = <input value={f.default || v[f.id] || ''} readOnly className="auto-field" />
      break
    case 'auto':
      control = <input value={v[f.id] || ''} readOnly className="auto-field" />
      break
    case 'computed': {
      const out = f.compute ? f.compute(v, report) : ''
      const bad = out === 'Reject' || out === 'Leak'
      control = <span className={`calc-field${bad ? ' calc-bad' : out === 'Accept' || out === 'No Leak' ? ' calc-good' : ''}`}>{out || '–'}</span>
      break
    }
    case 'timer':
      control = <DwellTimer value={v[f.id] ?? f.default ?? ''} disabled={disabled} onChange={(x) => set(f.id, x)} />
      break
    case 'user':
      control = <input value={v[f.id] || session.name} disabled={disabled} onChange={(e) => set(f.id, e.target.value)} />
      break
    case 'jobsearch':
      control = (
        <select value={v.jobNo || ''} disabled={locked} onChange={(e) => onJobChange(e.target.value)}>
          {jobs.map((j) => <option key={j.jobNo} value={j.jobNo}>{j.jobNo} · {j.productDesc?.slice(0, 48)}</option>)}
        </select>
      )
      break
    case 'sign':
      control = v[f.id] ? (
        <div className="sign-block signed">
          {v[f.id].img && <img className="sign-img" src={v[f.id].img} alt="signature" />}
          <span className="sign-meta"><span className="sign-name-label">{v[f.id].name}</span><small>{new Date(v[f.id].at).toLocaleString()}</small></span>
          {!locked && <button type="button" className="btn btn-ghost btn-sm" onClick={() => set(f.id, null)}>Clear</button>}
        </div>
      ) : signLocked ? (
        <div className="sign-block sign-locked">🔒 Inspector must sign first</div>
      ) : (
        <button type="button" className={`sign-block sign-empty${invalid ? ' invalid' : ''}`} disabled={locked} onClick={() => onRequestSign(f.id)}>
          <IconPen size={13} /> Tap to sign
        </button>
      )
      break
    case 'photos-inline':
      control = <PhotoStrip photos={v[f.id] || []} disabled={locked} onChange={(p) => set(f.id, p)} />
      break
    default:
      control = <input value={v[f.id] || ''} disabled={disabled} placeholder={f.placeholder} onChange={(e) => set(f.id, e.target.value)} />
  }

  return (
    <div className={`field${invalid ? ' field-err' : ''}${full ? ' field-full' : ''}`}>
      <label>{label}{required && <span className="req">*</span>}
        {unit && f.type !== 'number' && f.type !== 'timer' ? <span className="lbl-unit"> ({unit})</span> : null}
      </label>
      {control}
      {f.hint && <small className="field-desc">{f.hint}</small>}
    </div>
  )
}

/* ───────────────────────── job identity (page 1) ─────────────────────────

   Page 1 is a statement of which job this report belongs to, so it is
   read, not filled. The only control is the job picker: change it and
   every line under it is rewritten from that job. Anything an inspector
   could type here would be a second, unverified copy of the job order. */
function IdentitySection({ sec, values, job, locked, onJobChange }) {
  const [pick, setPick] = useState(false)
  const jobField = sec.fields.find((f) => f.type === 'jobsearch')
  const show = (f) => {
    const raw = values[f.id]
    if (raw === undefined || raw === null || raw === '') return '—'
    return f.fmt === 'date' ? fmtDate(raw) : String(raw)
  }
  const groups = IDENT_GROUPS
    .map((g) => ({ ...g, fields: sec.fields.filter((f) => f.group === g.id) }))
    .filter((g) => g.fields.length)
  // Anything the schema forgot to group still has to appear, or a field
  // would go silently missing from page 1.
  const loose = sec.fields.filter((f) => f.type !== 'jobsearch' && !f.group)

  return (
    <div className="ident">
      {/* The same picker the dashboard uses, behind a bar the width of
          the page: one question, one control, asked the same way twice. */}
      <div className="ident-pick">
        <label htmlFor="ident-job">{lbl(jobField, values)}</label>
        <button type="button" id="ident-job" className="ident-jobbtn" disabled={locked}
          aria-haspopup="dialog" onClick={() => setPick(true)}>
          <span className="ident-jobbtn-ico"><IconSearch size={15} /></span>
          <span className="ident-jobbtn-txt">
            <strong>{values.jobNo || 'Choose a job'}</strong>
            <small>{job ? `${job.wbsNo || 'no WBS'} · ${job.productDesc || '—'} · ${job.customerName || '—'}` : 'Search the register'}</small>
          </span>
          {!locked && <IconChevronD size={14} />}
        </button>
        <small>{locked ? 'The job is fixed once the report is submitted.' : 'Every field below is taken from this job and cannot be edited.'}</small>
      </div>

      {groups.map((g) => (
        <section className={`ident-group ident-group-${g.id}`} key={g.id}>
          <header className="ident-group-head">
            <h4>{g.title}</h4>
            {g.sub && <small>{g.sub}</small>}
          </header>
          <dl className="ident-grid">
            {g.fields.map((f) => (
              <div className="ident-item" key={f.id}>
                <dt>{lbl(f, values)}</dt>
                <dd>{show(f)}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      {loose.length > 0 && (
        <dl className="ident-grid">
          {loose.map((f) => (
            <div className="ident-item" key={f.id}>
              <dt>{lbl(f, values)}</dt>
              <dd>{show(f)}</dd>
            </div>
          ))}
        </dl>
      )}

      {pick && (
        <JobPicker title="Choose the job" current={values.jobNo}
          sub="Everything on this page is rewritten from the job you pick."
          onPick={(jobNo) => { onJobChange(jobNo); setPick(false) }}
          onClose={() => setPick(false)} />
      )}
    </div>
  )
}

// ───────────────────────── photo strip ─────────────────────────
function PhotoStrip({ photos, disabled, onChange }) {
  const [zoom, setZoom] = useState(null)
  const add = (e) => {
    const files = Array.from(e.target.files || [])
    Promise.all(files.map((file) => new Promise((res) => {
      const r = new FileReader(); r.onload = () => res({ id: 'p' + Date.now() + Math.random(), img: r.result, label: '' }); r.readAsDataURL(file)
    }))).then((imgs) => onChange([...photos, ...imgs]))
    e.target.value = ''
  }
  return (
    <div className="photo-strip">
      {photos.map((p, i) => (
        <div key={p.id} className="photo-item">
          {p.img && <button type="button" className="photo-thumb" onClick={() => setZoom(p)} aria-label="View full image"><img src={p.img} alt={p.label || 'evidence'} /><span className="photo-zoom">⤢</span></button>}
          <input placeholder="caption…" value={p.label} disabled={disabled}
            onChange={(e) => onChange(photos.map((x, xi) => xi === i ? { ...x, label: e.target.value } : x))} />
          {!disabled && <button type="button" className="photo-x" onClick={() => onChange(photos.filter((_, xi) => xi !== i))} aria-label="Remove"><IconTrash size={13} /></button>}
        </div>
      ))}
      {!disabled && (
        <label className="photo-add">
          <IconPlus size={18} /><span>Add photo</span>
          <input type="file" accept="image/*" multiple capture="environment" hidden onChange={add} />
        </label>
      )}
      {zoom && createPortal(
        <div className="photo-lightbox" onClick={() => setZoom(null)}>
          <img src={zoom.img} alt={zoom.label || 'evidence'} />
          {zoom.label && <span className="photo-lightbox-cap">{zoom.label}</span>}
          <button type="button" className="photo-lightbox-x" onClick={() => setZoom(null)} aria-label="Close">✕</button>
        </div>, document.body
      )}
    </div>
  )
}

// ───────────────────────── recording (checkpoint timeline) ─────────────────────────
function RecordingSection({ report, update, setValue, locked }) {
  const rows = report.readings || []
  const v = report.values || {}
  const started = !!v.testStarted
  const setRow = (i, key, val) => update({ readings: rows.map((r, j) => j === i ? { ...r, [key]: val } : r) })
  const twoG = v.gauges !== '1 Gauge'
  const useRec = v.useRecorder !== 'Not used'
  const useTemp = v.useTemp !== 'Not used'
  const punit = v.pressureUnit || 'PsiG'
  const pressCols = [['pg1', twoG ? 'PG 1 (Top)' : 'Gauge']]
  if (twoG) pressCols.push(['pg2', 'PG 2 (Bottom)'])
  if (useRec) pressCols.push(['rec', 'Press. Rec.'])
  const tempCols = useTemp ? [['water', 'Water'], ['ambient', 'Ambient']] : []

  const pts = rows.map((r) => parseFloat(r.pg1)).filter((n) => !isNaN(n))
  const maxP = Math.max(...pts, 1), minP = Math.min(...pts, 0)

  return (
    <div className="rec-section">
      {!started && !locked && (
        <div className="rec-start">
          <div className="field-desc" style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            🔒 Starting the test locks the equipment IDs above and stamps checkpoint #1 (duration 0).
          </div>
          <button type="button" className="btn btn-primary" onClick={() => {
            update({ readings: [{ time: MR.nowTime(), pg1: '0', pg2: '0', rec: '0', water: '', ambient: '', remark: `Start — 0 ${punit}` }] })
            setValue('testStarted', true)
          }}>▶ Start Test</button>
        </div>
      )}
      {started && (
        <div className="rec-locked-note">Equipment locked. Test in progress.</div>
      )}

      {rows.map((row, i) => {
        const dur = i === 0 ? 0 : MR.minutesBetween(rows[i - 1].time, row.time)
        return (
          <div key={i} className="rec-row">
            <div className="rec-rail"><span className="rr-dot" />{i < rows.length - 1 && <span className="rr-line" />}</div>
            <div className="rec-card">
              <div className="rec-card-head">
                <span className="rec-cp">CP {i + 1}</span>
                <span className="rec-dur">Δ {dur >= 0 ? dur : '?'} min</span>
                {!locked && i === rows.length - 1 && i > 0 && (
                  <button type="button" className="row-x" onClick={() => update({ readings: rows.filter((_, j) => j !== i) })} aria-label="Delete checkpoint"><IconTrash size={14} /></button>
                )}
              </div>
              <div className="rec-grid">
                <div className="field"><label>Time</label>
                  <input type="time" value={row.time || ''} disabled={locked} onChange={(e) => setRow(i, 'time', e.target.value)} /></div>
                <div className="field"><label>Duration</label>
                  <span className="calc-field">Δ {dur >= 0 ? dur : '?'} min</span></div>
              </div>
              <div className="rec-group">
                <span className="rec-group-label">Pressure <em>· {punit}</em></span>
                <div className="rec-group-grid">
                  {pressCols.map(([k, l]) => (
                    <div className="field" key={k}><label>{l}</label>
                      <NumberInput value={row[k]} disabled={locked} onChange={(x) => setRow(i, k, x)} /></div>
                  ))}
                </div>
              </div>
              {tempCols.length > 0 && (
                <div className="rec-group rec-group-temp">
                  <span className="rec-group-label">Temperature <em>· °C</em></span>
                  <div className="rec-group-grid">
                    {tempCols.map(([k, l]) => (
                      <div className="field" key={k}><label>{l}</label>
                        <NumberInput value={row[k]} disabled={locked} onChange={(x) => setRow(i, k, x)} /></div>
                    ))}
                  </div>
                </div>
              )}
              <div className="field" style={{ marginTop: 12 }}><label>Remark</label>
                <input value={row.remark || ''} disabled={locked} placeholder="e.g. Holding — no drop" onChange={(e) => setRow(i, 'remark', e.target.value)} /></div>
            </div>
          </div>
        )
      })}

      {started && !locked && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={() =>
          update({ readings: [...rows, { time: MR.nowTime(), pg1: '', pg2: '', rec: '', water: '', ambient: '', remark: '' }] })}>
          <IconPlus size={15} /> Checkpoint
        </button>
      )}

      {pts.length >= 2 && (
        <div className="rec-chart-wrap">
          <div className="chart-title">Pressure sanity check · {punit}</div>
          <svg viewBox="0 0 560 130" className="chart" role="img" aria-label="Pressure vs checkpoint">
            <line x1="30" y1="104" x2="540" y2="104" className="chart-axis" />
            <polyline className="chart-line" points={rows.map((r, i) => {
              const x = 30 + (i * 510) / Math.max(rows.length - 1, 1)
              const y = 104 - (((parseFloat(r.pg1) || 0) - minP) / (maxP - minP || 1)) * 84
              return `${x},${y}`
            }).join(' ')} />
            {rows.map((r, i) => {
              const x = 30 + (i * 510) / Math.max(rows.length - 1, 1)
              const y = 104 - (((parseFloat(r.pg1) || 0) - minP) / (maxP - minP || 1)) * 84
              return <g key={i}><circle cx={x} cy={y} r="3" className="chart-dot" /><text x={x} y="118" className="chart-tick" textAnchor="middle">CP{i + 1}</text></g>
            })}
          </svg>
        </div>
      )}
    </div>
  )
}

// ───────────────────────── results table (reject-only cols) ─────────────────────────
function ResultsSection({ sec, report, update, locked, showErrors }) {
  const rows = report.results || []
  const v = report.values || {}
  const setRow = (i, key, val) => update({ results: rows.map((r, j) => j === i ? { ...r, [key]: val } : r) })
  const newRow = () => {
    const r = {}
    sec.columns.forEach((c) => { if (c.default) r[c.id] = c.default })
    update({ results: [...rows, r] })
  }
  return (
    <div className="results-section">
      {rows.map((row, i) => {
        const judged = sec.autoJudge === 'dim' ? dimRowStatus(row) : row[sec.judgeKey]
        const isRej = judged === sec.rejValue
        const breach = sec.autoJudge === 'dim' ? dimBreach(row) : null
        return (
          <div key={i} className={`rowcard${isRej ? ' rej' : ''}`}>
            <div className="rowcard-head">
              <span className="rec-cp">#{i + 1}</span>
              {/* A dimension judges itself: outside its limits is a reject,
                  stated with the amount rather than just a colour. */}
              {sec.autoJudge === 'dim' && judged && (
                <span className={`chip ${judged === 'Accept' ? 'chip-done' : 'chip-overdue'}`} style={{ padding: '2px 9px' }}>
                  {judged === 'Reject' ? <><IconAlert size={11} /> Auto-reject{breach ? ` · ${breach.by} mm over ${breach.side}` : ''}</> : 'Auto-accept'}
                </span>
              )}
              {isRej && sec.autoJudge !== 'dim' && <span className="chip chip-overdue" style={{ padding: '2px 9px' }}><IconAlert size={11} /> {sec.rejValue}. Evidence required</span>}
              {!locked && <button type="button" className="row-x" onClick={() => update({ results: rows.filter((_, j) => j !== i) })} aria-label="Delete row"><IconTrash size={14} /></button>}
            </div>
            <div className="rowcard-body">
              {sec.columns.filter((c) => showField(c, v)).map((c) => {
                if (c.rejOnly && !isRej) return null
                const missing = showErrors && isRej && c.rejOnly && !row[c.id] && (c.id === 'discontinuity' || c.id === 'remark' || c.id === 'defectType')
                const req = c.req === 'M' || (c.rejOnly && isRej && (c.id === 'discontinuity' || c.id === 'defectType'))
                return (
                  <div key={c.id} className={`field${c.half ? '' : ' field-full'}${missing ? ' field-err' : ''}`}>
                    <label>{c.label}{req && <span className="req">*</span>}{c.unit ? <span className="lbl-unit"> ({c.unit})</span> : null}</label>
                    {c.type === 'segmented'
                      ? <Segmented value={row[c.id] || ''} options={c.options} disabled={locked} onChange={(x) => setRow(i, c.id, x)} />
                      : c.type === 'number'
                        ? <NumberInput value={row[c.id]} disabled={locked} invalid={missing} onChange={(x) => setRow(i, c.id, x)} />
                        : <input value={row[c.id] || ''} disabled={locked} className={missing ? 'invalid' : undefined} placeholder={c.placeholder} onChange={(e) => setRow(i, c.id, e.target.value)} />}
                    {/* what the measurement means, next to the measurement */}
                    {sec.autoJudge === 'dim' && c.id === 'actual' && (dimDeviation(row) !== '' || breach) && (
                      <small className={breach ? 'fld-err' : 'field-desc'}>
                        {breach
                          ? `${breach.by} mm ${breach.side === 'max' ? 'above max' : 'below min'} ${breach.limit} — rejected`
                          : `Deviation ${dimDeviation(row)} mm · within limits`}
                      </small>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
      {!locked && <button type="button" className="btn btn-secondary btn-sm" onClick={newRow}><IconPlus size={15} /> Add row</button>}
    </div>
  )
}

// ───────────────────────── DFT section ─────────────────────────
function DftSection({ report, update, locked, showErrors }) {
  const coats = report.coats || []
  const setCoat = (i, patch) => update({ coats: coats.map((c, j) => j === i ? { ...c, ...patch } : c) })
  return (
    <div className="results-section">
      {coats.map((c, i) => {
        const avg = MR.dftAvg(c.pts)
        const std = parseFloat(c.std)
        const status = avg == null || isNaN(std) ? null : avg >= std ? 'ACC.' : 'REJ.'
        return (
          <div key={i} className={`rowcard${status === 'REJ.' ? ' rej' : ''}`}>
            <div className="rowcard-head">
              <span className="rec-cp">{c.coat} coat</span>
              {status && <span className={`chip ${status === 'ACC.' ? 'chip-done' : 'chip-overdue'}`} style={{ padding: '2px 9px' }}>{status}</span>}
              {!locked && <button type="button" className="row-x" onClick={() => update({ coats: coats.filter((_, j) => j !== i) })} aria-label="Delete coat"><IconTrash size={14} /></button>}
            </div>
            <div className="rowcard-body">
              <div className="field field-full"><label>Identification Area<span className="req">*</span></label>
                <input value={c.area || ''} disabled={locked} className={showErrors && !c.area ? 'invalid' : undefined} placeholder="e.g. Shell External — Zone A" onChange={(e) => setCoat(i, { area: e.target.value })} /></div>
              <div className="field field-full"><label>Sampling points, 5 per 1 m² <span className="lbl-unit">(µm)</span></label>
                <div className="dft-pts">
                  {[0, 1, 2, 3, 4].map((j) => (
                    <input key={j} inputMode="decimal" placeholder={`T${j + 1}`} value={(c.pts && c.pts[j]) != null ? c.pts[j] : ''} disabled={locked}
                      onChange={(e) => { const pts = [...(c.pts || ['', '', '', '', ''])]; pts[j] = e.target.value; setCoat(i, { pts }) }} />
                  ))}
                </div></div>
              <div className="field"><label>Avg DFT</label><span className={`calc-field${status === 'REJ.' ? ' calc-bad' : ''}`}>{avg == null ? '–' : avg + ' µm'}</span></div>
              <div className="field"><label>Std. DFT <span className="lbl-unit">(µm)</span><span className="req">*</span></label>
                <NumberInput value={c.std} disabled={locked} invalid={showErrors && !c.std} onChange={(x) => setCoat(i, { std: x })} /></div>
              <div className="field field-full"><label>Status</label>
                <span className={`calc-field${status === 'REJ.' ? ' calc-bad' : status === 'ACC.' ? ' calc-good' : ''}`}>{status || '–'} {status ? (status === 'ACC.' ? '· Avg ≥ Std' : '· Avg < Std') : ''}</span></div>
            </div>
          </div>
        )
      })}
      {!locked && (
        <div style={{ display: 'flex', gap: 8 }}>
          {['Primer', 'Second', 'Top'].map((coat) => (
            <button key={coat} type="button" className="btn btn-secondary btn-sm" style={{ flex: 1 }} disabled={coats.some((c) => c.coat === coat)}
              onClick={() => update({ coats: [...coats, { coat, area: coats.length ? coats[coats.length - 1].area : '', pts: ['', '', '', '', ''], std: '' }] })}>
              <IconPlus size={14} /> {coat}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── formal "Berita Acara" minutes, auto-generated once a result exists ──
function BeritaAcara({ schema, report, job, inspector }) {
  const r = buildResume(schema, report, job)
  const v = report.values || {}
  const dateStr = v.inspDate ? new Date(v.inspDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'
  return (
    <div className={`berita ${r.released ? 'ba-ok' : 'ba-bad'}`}>
      <div className="ba-head">
        <span className="ba-eyebrow">Auto-generated · Official Test Minutes (Berita Acara)</span>
        <h4>{schema.title}</h4>
      </div>
      <div className="ba-grid">
        <div><span>Report No.</span><strong>{v.reportId || '—'}</strong></div>
        <div><span>Date</span><strong>{dateStr}</strong></div>
        <div><span>Job / Serial</span><strong>{job.jobNo} · {job.arasSN || '—'}</strong></div>
        <div><span>Unit</span><strong>{job.productDesc}</strong></div>
        <div><span>Customer</span><strong>{job.customerName}</strong></div>
        <div><span>Inspector</span><strong>{inspector}</strong></div>
      </div>
      <p className="ba-text">{r.paragraph}</p>
      <div className={`ba-verdict ${r.released ? '' : 'hold'}`}>
        {r.released ? 'RESULT: ACCEPTED — the unit conforms to the applicable requirements.'
          : 'RESULT: REJECTED — corrective action required before acceptance.'}
      </div>
    </div>
  )
}

// ───────────────────────── main FormView ─────────────────────────
export default function FormView({ job, formKey, query }) {
  const { session, role, refresh, notify, jobs } = useApp()
  const schema = FORM_SCHEMAS[formKey]
  const existing = query.rid ? getReport(query.rid) : null
  const deliverable = query.d || schema?.deliverable

  const [report, setReport] = useState(() => {
    if (existing) {
      // defensive load — migrate older/partial reports so they always open
      const e = JSON.parse(JSON.stringify(existing))
      e.values = e.values || e.data || {}
      e.readings = e.readings || []
      e.results = e.results || []
      e.coats = e.coats || []
      e.photos = e.photos || []
      if (!e.values.reportId) e.values.reportId = e.reportId
      if (!e.values.inspector) e.values.inspector = e.inspector || session.name
      if (!e.values.inspDate) e.values.inspDate = (e.createdAt || new Date().toISOString()).slice(0, 10)
      // The identity is the job order's to state, so it is re-read on
      // every open rather than trusted from the saved copy.
      if (job) Object.assign(e.values, jobIdentity(job))
      return e
    }
    const values = {}
    for (const sec of schema?.sections || []) {
      for (const f of sec.fields || []) if (f.default !== undefined) values[f.id] = f.default
    }
    if (job) {
      Object.assign(values, jobIdentity(job), {
        reportId: nextReportId(schema.code, job.jobNo),
        inspDate: new Date().toISOString().slice(0, 10),
        inspector: session.name,
      })
    }
    return { id: null, reportId: values.reportId, formKey, jobNo: job?.jobNo, deliverable, status: 'new', values, readings: [], results: [], coats: [], photos: [] }
  })
  const [errors, setErrors] = useState({})
  const [step, setStep] = useState(0)
  const [touched, setTouched] = useState(() => new Set())
  const [showPdf, setShowPdf] = useState(false)
  const [signField, setSignField] = useState(null)
  const [forceEdit, setForceEdit] = useState(false) // override roles can switch the detail view into edit mode
  const [ask, setAsk] = useState(null)   // 'draft' | 'leave'

  /* What the form looked like before anyone touched it. Leaving a report
     that holds nothing but its own defaults should not stop to ask
     whether to keep it; leaving one with readings in it must. */
  const pristine = useRef(null)
  if (pristine.current === null) pristine.current = JSON.stringify({
    values: report.values, readings: report.readings, results: report.results,
    coats: report.coats, photos: report.photos,
  })
  const touchedAnything = JSON.stringify({
    values: report.values, readings: report.readings, results: report.results,
    coats: report.coats, photos: report.photos,
  }) !== pristine.current

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }) }, [step])
  // A section counts as visited the moment it is on screen, however you
  // got there — so walking back from the last step does not un-visit the
  // ones behind you.
  useEffect(() => { setTouched((t) => (t.has(step) ? t : new Set(t).add(step))) }, [step])

  if (!schema || !job) {
    return <div className="page"><div className="card empty-state"><p><strong>{!schema ? 'Unknown form template.' : 'Job not found.'}</strong></p><button className="btn btn-secondary" onClick={() => navigate('/')}>Back</button></div></div>
  }

  const reportStatus = report.status
  const submitted = reportStatus === 'submitted' || reportStatus === 'approved'
  const readOnly = !role.canEdit || (submitted && !role.canOverride)
  const v = report.values

  /* The job this report is actually against. The route says which job it
     was opened from; page 1 can point it at another one, and from that
     moment the picked job is the job — where it saves, what it prints,
     and where Back goes. */
  const cur = jobs.find((j) => j.jobNo === v.jobNo) || job

  // a submitted/approved report opens as a read-only DETAIL view, not the edit form
  if (submitted && !forceEdit) {
    return (
      <>
        <ReportDetail
          schema={schema} report={report} job={cur} deliverable={deliverable} status={reportStatus} role={role}
          onBack={() => navigate(`/job/${cur.jobNo}`)}
          onPdf={() => setShowPdf(true)}
          onApprove={() => { approveReport(report.id, session.name); setReport((r) => ({ ...r, status: 'approved' })); refresh(); notify(`${report.values.reportId} approved`) }}
          onEdit={() => setForceEdit(true)}
        />
      {showPdf && createPortal(<PrintReport schema={schema} report={report} job={cur} deliverable={deliverable} status={reportStatus} onClose={() => setShowPdf(false)} />, document.body)}
      </>
    )
  }

  const update = (patch) => setReport((r) => ({ ...r, ...patch }))
  const setValue = (id, val) => setReport((r) => {
    const next = { ...r.values, [id]: val }
    // derive (e.g. testType → testMedia)
    if (schema.derive) Object.assign(next, schema.derive(id, val, next) || {})
    return { ...r, values: next }
  })
  // Picking a different job re-states the whole first page, report ID
  // included — the old number belongs to the job it was raised against.
  const onJobChange = (jobNo) => {
    const j = jobs.find((x) => x.jobNo === jobNo)
    if (!j) return
    setReport((r) => ({
      ...r, jobNo,
      values: { ...r.values, ...jobIdentity(j), reportId: r.id ? r.values.reportId : nextReportId(schema.code, jobNo) },
    }))
  }

  // equipment lock: a lockable section freezes once the test has started
  const sectionLocked = (sec) => readOnly || (sec.lockable && !!v.testStarted)

  /* Values as the form actually reads them: what was entered, plus what
     the form works out for itself. A computed field is never stored, so
     a rule written against one — NCR notes are required once the status
     reads Reject — could not see it before. */
  const vAll = (() => {
    const out = { ...v }
    for (const s of schema.sections) {
      for (const f of s.fields || []) if (f.type === 'computed' && f.compute) out[f.id] = f.compute(v, report)
    }
    return out
  })()

  // ── validation ──
  const validate = () => {
    const errs = {}
    for (const sec of schema.sections) {
      if (sec.type === 'recording') {
        if ((report.readings || []).length < 1) errs[sec.id] = 'Press “Start Test” to record checkpoint #1.'
      } else if (sec.type === 'results') {
        if (!(report.results || []).length) errs[sec.id] = 'Add at least one row.'
        ;(report.results || []).forEach((row, i) => {
          sec.columns.forEach((c) => {
            const req = c.req === 'M'
            if (req && !row[c.id]) errs[`${sec.id}.${i}.${c.id}`] = true
          })
          if (sec.autoJudge === 'dim') {
            const lo = parseFloat(row.min), hi = parseFloat(row.max)
            if (!isNaN(lo) && !isNaN(hi) && lo > hi) errs[`${sec.id}.${i}.max`] = true
          }
          const judged = sec.autoJudge === 'dim' ? dimRowStatus(row) : row[sec.judgeKey]
          if (judged === sec.rejValue && !row.discontinuity && !row.defectType && !row.remark && !row.note) errs[`${sec.id}.${i}.evid`] = true
        })
      } else if (sec.type === 'dft') {
        ;(report.coats || []).forEach((c, i) => { if (!c.area) errs[`dft.${i}.area`] = true; if (!c.std) errs[`dft.${i}.std`] = true })
      } else if (sec.fields) {
        for (const f of sec.fields) {
          if (!showField(f, v)) continue
          if (['computed', 'auto', 'readonly', 'photos', 'photos-inline'].includes(f.type)) continue
          // signatures: only the Inspector is mandatory at submit — QC/SPV signs at approval
          if (f.type === 'sign') { if (f.id === 'signInspector' && !v[f.id]) errs[f.id] = true; continue }
          if (isReq(f, vAll) && (v[f.id] === undefined || v[f.id] === '')) errs[f.id] = true
        }
      }
    }
    setErrors(errs)
    return errs
  }

  // live completeness check for a single section (for the stepper red state)
  const sectionIncomplete = (sec) => {
    if (sec.type === 'recording') return (report.readings || []).length < 1
    if (sec.type === 'results') {
      const rows = report.results || []
      if (!rows.length) return true
      return rows.some((row) => sec.columns.some((c) => c.req === 'M' && !row[c.id]))
    }
    if (sec.type === 'dft') return (report.coats || []).some((c) => !c.area || !c.std)
    if (sec.fields) {
      return sec.fields.some((f) => {
        if (!showField(f, v)) return false
        if (['computed', 'auto', 'readonly', 'photos', 'photos-inline'].includes(f.type)) return false
        if (f.type === 'sign') return f.id === 'signInspector' ? !v[f.id] : false
        return isReq(f, vAll) && (v[f.id] === undefined || v[f.id] === '')
      })
    }
    return false
  }

  const sectionHasErr = (sec, e) => e[sec.id] || (sec.fields || []).some((f) => e[f.id]) ||
    Object.keys(e).some((k) => k.startsWith(`${sec.id}.`)) ||
    (sec.id === 'approvals' && (sec.fields || []).some((f) => e[f.id]))

  const persist = (status) => {
    const rep = { ...report, id: report.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, reportId: v.reportId, formKey, jobNo: cur.jobNo, deliverable, inspector: v.inspector || session.name, status, createdAt: report.createdAt || new Date().toISOString(), synced: false }
    saveReport(rep); setReport(rep); refresh(); return rep
  }
  const onDraft = () => { persist('draft'); notify('Draft saved — status In Progress') }
  const leave = () => navigate(`/job/${cur.jobNo}`)
  /* An untouched form has nothing to lose, so back is just back. Once
     there are readings in it, going back is a decision and the form says
     so rather than dropping the work silently. */
  const onBack = () => {
    if (readOnly || !touchedAnything) { leave(); return }
    setAsk('leave')
  }
  const onSubmit = () => {
    const errs = validate()
    const n = Object.keys(errs).length
    if (n) {
      notify(`${n} item${n > 1 ? 's' : ''} need attention — highlighted`, 'err')
      const es = schema.sections.findIndex((s) => sectionHasErr(s, errs))
      if (es >= 0 && es !== step) setStep(es)
      setTimeout(() => document.querySelector('.invalid,[aria-invalid="true"],.field-err')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120)
      return
    }
    persist('submitted'); notify('Report submitted — deliverable marked Done'); setTimeout(() => navigate(`/job/${cur.jobNo}`), 600)
  }

  // navigate between sections, flagging any incomplete section left behind
  const goStep = (target) => {
    if (target > step) {
      const next = new Set(touched)
      let firstBad = -1
      for (let i = step; i < target; i++) {
        next.add(i)
        if (firstBad < 0 && sectionIncomplete(schema.sections[i])) firstBad = i
      }
      setTouched(next)
      if (firstBad >= 0) notify(`“${schema.sections[firstBad].title}” still has required fields empty`, 'err')
    }
    setStep(target)
  }
  /* What the stepper reports is the section's own state, not how far
     along the list you have walked. Complete is complete whether it sits
     before or after where you are standing, so coming back to page 1
     from the last step still shows every filled section green — and every
     section you left empty red, which is the whole point of looking. */
  const stepperState = (s, i) => {
    if (i === step) return 'active'
    // A section you have never opened is not "missing" yet — it is just
    // ahead of you. Attempting to submit ends that grace, because at
    // that point every section has been asked for.
    const seen = touched.has(i) || Object.keys(errors).length > 0
    if (!seen) return 'todo'
    return sectionHasErr(s, errors) || sectionIncomplete(s) ? 'err' : 'done'
  }

  const sec = schema.sections[step]
  const secLocked = sectionLocked(sec)

  const renderBody = () => {
    if (sec.id === 'header') {
      return <IdentitySection sec={sec} values={v} job={cur} locked={readOnly} onJobChange={onJobChange} />
    }
    if (sec.id === 'approvals' || sec.fields) {
      return (
        <>
          <div className="fields-grid">
            {(sec.fields || []).filter((f) => showField(f, v)).map((f) => {
              const signLocked = f.type === 'sign' && f.id !== 'signInspector' && !v.signInspector
              const invalid = errors[f.id]
              return (
                <EngineField key={f.id} f={f} values={v} reqValues={vAll} report={report} set={setValue} locked={f.adminOnly && !role.canOverride && f.id !== 'jobNo' ? secLocked : secLocked}
                  invalid={invalid} onRequestSign={setSignField} signLocked={signLocked} session={session} jobs={jobs} onJobChange={onJobChange} />
              )
            })}
          </div>
          {/* formal Berita Acara appears automatically on the Test Result section */}
          {sec.id === 'result' && <BeritaAcara schema={schema} report={report} job={cur} inspector={v.inspector || session.name} />}
        </>
      )
    }
    if (sec.type === 'recording') return <RecordingSection report={report} update={update} setValue={setValue} locked={readOnly} />
    if (sec.type === 'results') return <>{errors[sec.id] && <div className="grid-err">{errors[sec.id]}</div>}<ResultsSection sec={sec} report={report} update={update} locked={readOnly} showErrors={Object.keys(errors).length > 0} /></>
    if (sec.type === 'dft') return <DftSection report={report} update={update} locked={readOnly} showErrors={Object.keys(errors).length > 0} />
    if (sec.type === 'photos') return <PhotoStrip photos={report.photos || []} disabled={readOnly} onChange={(p) => update({ photos: p })} />
    return null
  }

  return (
    <div className="page form-page form-page-pad">
      {/* State only. Every action lives in the rail on the right, so
          there is one place to look for something to press. */}
      <Masthead code={schema.code} title={schema.title} backLabel="Back to job"
        eyebrow={<>{deliverable}{cur ? <> · Job {cur.jobNo}</> : null}</>}
        sub={<>{v.reportId}{cur?.productDesc ? <> · {cur.productDesc}</> : null}</>}
        onBack={onBack}>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowPdf(true)}>
          <IconPrint size={13} /> PDF
        </button>
        <span className={`report-state state-${reportStatus}`}>{reportStatus === 'new' ? 'New' : reportStatus === 'draft' ? 'Draft' : reportStatus === 'approved' ? 'Approved' : 'Submitted'}</span>
      </Masthead>

      {readOnly && <div className="readonly-note">Read-only{submitted ? '. This report has been submitted' : '. Your role cannot edit reports'}.</div>}

      <div className="form-body">
        <div className="form-main">
          <section className="card form-section">
            <header className="form-section-head">
              <div><h3>{sec.title}</h3>{sec.subtitle && <small>{sec.subtitle}</small>}</div>
              <span className="step-count">{step + 1} / {schema.sections.length}</span>
            </header>
            {renderBody()}
          </section>
        </div>

        <aside className="form-rail">
          <div className="form-stepper card">
          <span className="stepper-title">Sections</span>
          <ol className="stepper-list">
            {schema.sections.map((s, i) => {
              const state = stepperState(s, i)
              return (
                <li key={s.id}>
                  <button className={`stepper-item is-${state}`} onClick={() => goStep(i)} aria-current={i === step ? 'step' : undefined}
                    title={state === 'err' ? 'Required fields missing' : s.title}>
                    <span className="stepper-dot">{state === 'done' ? <IconCheck size={13} /> : state === 'err' ? '!' : i + 1}</span>
                    <span className="stepper-text"><strong>{s.title}</strong>{s.subtitle && <small>{s.subtitle}</small>}</span>
                  </button>
                </li>
              )
            })}
          </ol>
          </div>

          {/* Paging, saving, printing, submitting: one column, in the
              order they are reached. On a phone this same block is the
              fixed bar at the bottom of the screen, where a thumb is. */}
          {/* Two things you can do to the form itself: carry on, or keep
              what is here. Going back is a step, so it lives on the
              stepper and on the masthead; the PDF is a view of the form
              rather than a change to it, so it sits with the state. */}
          <div className="form-actions">
            {step < schema.sections.length - 1
              ? <button className="btn btn-primary" onClick={() => goStep(step + 1)}>Next</button>
              : !readOnly ? <button className="btn btn-accent" onClick={onSubmit}>Submit Report</button>
                : <button className="btn btn-primary" onClick={leave}>Done</button>}
            {!readOnly && (
              <button className="btn btn-secondary" onClick={() => setAsk('draft')}>Save Draft</button>
            )}
            {role.canOverride && reportStatus === 'submitted' && existing && (
              <button className="btn btn-primary" onClick={() => { approveReport(report.id, session.name); setReport((r) => ({ ...r, status: 'approved' })); refresh(); notify(`${v.reportId} approved`) }}>Approve</button>
            )}
          </div>
        </aside>
      </div>

      {ask === 'draft' && createPortal(
        <Confirm title="Save this as a draft?"
          body={<>The report keeps its number and stays on job {cur.jobNo} with the status In Progress. You can open it again and carry on from the section you are in.</>}
          confirm="Save draft" onConfirm={() => { setAsk(null); onDraft() }}
          onClose={() => setAsk(null)} />, document.body)}

      {ask === 'leave' && createPortal(
        /* Two ways out, named by what each one does to the work. Discard
           is the destructive one and is styled as such; it is never the
           button under the thumb by default. */
        <Confirm title="Leave this report?"
          body={<>There are entries on this form that have not been saved. Keep them as a draft you can return to, or discard the form and leave nothing behind.</>}
          confirm="Save as draft and leave"
          onConfirm={() => { setAsk(null); onDraft(); setTimeout(leave, 350) }}
          danger="Discard" onDanger={() => { setAsk(null); leave() }}
          onClose={() => setAsk(null)} />, document.body)}

      {showPdf && createPortal(<PrintReport schema={schema} report={report} job={cur} deliverable={deliverable} status={reportStatus} onClose={() => setShowPdf(false)} />, document.body)}
      {signField && createPortal(
        /* An inspector filing six reports in a shift should draw their
           name once. The signature saved in Settings is offered here as
           the starting point; the pad still lets them draw a fresh one. */
        <SignaturePad name={signField === 'signInspector' ? (v.inspector || session.name) : session.name}
          saved={signField === 'signInspector' ? getSettings().profile.signature : ''}
          onClose={() => setSignField(null)} onSave={(sig) => { setValue(signField, sig); setSignField(null) }} />,
        document.body
      )}
    </div>
  )
}
