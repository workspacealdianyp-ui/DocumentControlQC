import { useMemo, useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useApp, navigate } from '../App.jsx'
import { FORM_SCHEMAS, dimRowStatus, dimDeviation } from '../data/formSchemas.js'
import { getReport, saveReport, nextReportId, approveReport } from '../lib/store.js'
import { MR } from '../lib/compute.js'
import { fmtDate } from '../lib/status.js'
import { buildResume } from '../lib/resume.js'
import PrintReport from './PrintReport.jsx'
import ReportDetail from './ReportDetail.jsx'
import SignaturePad from './SignaturePad.jsx'
import { IconBack, IconPlus, IconTrash, IconPrint, IconPen, IconCheck, IconClock, IconAlert } from './Icons.jsx'

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

// ───────────────────────── one field ─────────────────────────
function EngineField({ f, values, report, set, locked, invalid, onRequestSign, signLocked, session, jobs, onJobChange }) {
  const v = values
  const disabled = locked || (f.adminOnly && false)
  const required = isReq(f, v)
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
        return (
          <div key={i} className={`rowcard${isRej ? ' rej' : ''}`}>
            <div className="rowcard-head">
              <span className="rec-cp">#{i + 1}</span>
              {isRej && <span className="chip chip-overdue" style={{ padding: '2px 9px' }}><IconAlert size={11} /> {sec.rejValue}. Evidence required</span>}
              {sec.autoJudge === 'dim' && judged && <span className={`chip ${judged === 'Accept' ? 'chip-done' : 'chip-overdue'}`} style={{ padding: '2px 9px' }}>{judged}</span>}
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
                    {/* dimensional auto deviation hint */}
                    {sec.autoJudge === 'dim' && c.id === 'actual' && dimDeviation(row) !== '' && (
                      <small className="field-desc">Deviation: {dimDeviation(row)} mm</small>
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
      if (job) {
        e.values.jobNo = e.values.jobNo || job.jobNo
        e.values.jobDesc = e.values.jobDesc || job.productDesc
        e.values.sn = e.values.sn || job.arasSN
        e.values.customer = e.values.customer || job.customerName
      }
      return e
    }
    const values = {}
    for (const sec of schema?.sections || []) {
      for (const f of sec.fields || []) if (f.default !== undefined) values[f.id] = f.default
    }
    if (job) {
      Object.assign(values, {
        reportId: nextReportId(schema.code, job.jobNo),
        inspDate: new Date().toISOString().slice(0, 10),
        inspector: session.name, jobNo: job.jobNo, jobDesc: job.productDesc, sn: job.arasSN, customer: job.customerName,
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

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }) }, [step])

  if (!schema || !job) {
    return <div className="page"><div className="card empty-state"><p><strong>{!schema ? 'Unknown form template.' : 'Job not found.'}</strong></p><button className="btn btn-secondary" onClick={() => navigate('/')}>Back</button></div></div>
  }

  const reportStatus = report.status
  const submitted = reportStatus === 'submitted' || reportStatus === 'approved'
  const readOnly = !role.canEdit || (submitted && !role.canOverride)
  const v = report.values

  // a submitted/approved report opens as a read-only DETAIL view, not the edit form
  if (submitted && !forceEdit) {
    return (
      <>
        <ReportDetail
          schema={schema} report={report} job={job} deliverable={deliverable} status={reportStatus} role={role}
          onBack={() => navigate(`/job/${job.jobNo}`)}
          onPdf={() => setShowPdf(true)}
          onApprove={() => { approveReport(report.id, session.name); setReport((r) => ({ ...r, status: 'approved' })); refresh(); notify(`${report.values.reportId} approved`) }}
          onEdit={() => setForceEdit(true)}
        />
        {showPdf && createPortal(<PrintReport schema={schema} report={report} job={job} deliverable={deliverable} status={reportStatus} onClose={() => setShowPdf(false)} />, document.body)}
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
  const onJobChange = (jobNo) => {
    const j = jobs.find((x) => x.jobNo === jobNo)
    setReport((r) => ({ ...r, jobNo, values: { ...r.values, jobNo, jobDesc: j?.productDesc || '', sn: j?.arasSN || '', customer: j?.customerName || '' } }))
  }

  // equipment lock: a lockable section freezes once the test has started
  const sectionLocked = (sec) => readOnly || (sec.lockable && !!v.testStarted)

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
          const judged = sec.autoJudge === 'dim' ? dimRowStatus(row) : row[sec.judgeKey]
          if (judged === sec.rejValue && !row.discontinuity && !row.defectType && !row.remark) errs[`${sec.id}.${i}.evid`] = true
        })
      } else if (sec.type === 'dft') {
        ;(report.coats || []).forEach((c, i) => { if (!c.area) errs[`dft.${i}.area`] = true; if (!c.std) errs[`dft.${i}.std`] = true })
      } else if (sec.fields) {
        for (const f of sec.fields) {
          if (!showField(f, v)) continue
          if (['computed', 'auto', 'readonly', 'photos', 'photos-inline'].includes(f.type)) continue
          // signatures: only the Inspector is mandatory at submit — QC/SPV signs at approval
          if (f.type === 'sign') { if (f.id === 'signInspector' && !v[f.id]) errs[f.id] = true; continue }
          if (isReq(f, v) && (v[f.id] === undefined || v[f.id] === '')) errs[f.id] = true
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
        return isReq(f, v) && (v[f.id] === undefined || v[f.id] === '')
      })
    }
    return false
  }

  const sectionHasErr = (sec, e) => e[sec.id] || (sec.fields || []).some((f) => e[f.id]) ||
    Object.keys(e).some((k) => k.startsWith(`${sec.id}.`)) ||
    (sec.id === 'approvals' && (sec.fields || []).some((f) => e[f.id]))

  const persist = (status) => {
    const rep = { ...report, id: report.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, reportId: v.reportId, formKey, jobNo: job.jobNo, deliverable, inspector: v.inspector || session.name, status, createdAt: report.createdAt || new Date().toISOString(), synced: false }
    saveReport(rep); setReport(rep); refresh(); return rep
  }
  const onDraft = () => { persist('draft'); notify('Draft saved — status In Progress') }
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
    persist('submitted'); notify('Report submitted — deliverable marked Done'); setTimeout(() => navigate(`/job/${job.jobNo}`), 600)
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
  // a section shows red if it's been visited/passed and is still incomplete
  const stepperState = (s, i) => {
    const passed = touched.has(i) || i < step
    if (sectionHasErr(s, errors) || (passed && i !== step && sectionIncomplete(s))) return 'err'
    if (i === step) return 'active'
    if (i < step) return 'done'
    return 'todo'
  }

  const sec = schema.sections[step]
  const secLocked = sectionLocked(sec)

  const renderBody = () => {
    if (sec.id === 'approvals' || sec.fields) {
      return (
        <>
          <div className="fields-grid">
            {(sec.fields || []).filter((f) => showField(f, v)).map((f) => {
              const signLocked = f.type === 'sign' && f.id !== 'signInspector' && !v.signInspector
              const invalid = errors[f.id]
              return (
                <EngineField key={f.id} f={f} values={v} report={report} set={setValue} locked={f.adminOnly && !role.canOverride && f.id !== 'jobNo' ? secLocked : secLocked}
                  invalid={invalid} onRequestSign={setSignField} signLocked={signLocked} session={session} jobs={jobs} onJobChange={onJobChange} />
              )
            })}
          </div>
          {/* formal Berita Acara appears automatically on the Test Result section */}
          {sec.id === 'result' && <BeritaAcara schema={schema} report={report} job={job} inspector={v.inspector || session.name} />}
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
      <button className="btn btn-ghost back-btn btn-sm" onClick={() => navigate(`/job/${job.jobNo}`)}><IconBack size={14} /> Job {job.jobNo}</button>

      <div className="form-hero">
        <div>
          <h2>{schema.title}</h2>
          <p>{v.reportId} · {deliverable} · {job.jobNo} · {job.productDesc}</p>
        </div>
        <div className="form-hero-right">
          <span className={`report-state state-${reportStatus}`}>{reportStatus === 'new' ? 'New' : reportStatus === 'draft' ? 'Draft' : reportStatus === 'approved' ? 'Approved' : 'Submitted'}</span>
          {role.canOverride && reportStatus === 'submitted' && existing && (
            <button className="btn btn-primary btn-sm" onClick={() => { approveReport(report.id, session.name); setReport((r) => ({ ...r, status: 'approved' })); refresh(); notify(`${v.reportId} approved`) }}>Approve</button>
          )}
          {reportStatus !== 'new' && <button className="btn btn-secondary btn-sm" onClick={() => setShowPdf(true)}><IconPrint size={13} /> PDF Report</button>}
        </div>
      </div>

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

          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => goStep(step - 1)} disabled={step === 0}>Back</button>
            {!readOnly && <button className="btn btn-secondary" onClick={onDraft}>Save Draft</button>}
            {/* preview the PDF straight from the last step */}
            {step === schema.sections.length - 1 && <button className="btn btn-secondary" onClick={() => setShowPdf(true)}><IconPrint size={14} /> Preview PDF</button>}
            {step < schema.sections.length - 1
              ? <button className="btn btn-primary" onClick={() => goStep(step + 1)}>Next</button>
              : !readOnly ? <button className="btn btn-accent" onClick={onSubmit}>Submit Report</button>
                : <button className="btn btn-primary" onClick={() => navigate(`/job/${job.jobNo}`)}>Done</button>}
          </div>
        </div>

        <aside className="form-stepper card">
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
        </aside>
      </div>

      {showPdf && createPortal(<PrintReport schema={schema} report={report} job={job} deliverable={deliverable} status={reportStatus} onClose={() => setShowPdf(false)} />, document.body)}
      {signField && createPortal(
        <SignaturePad name={signField === 'signInspector' ? (v.inspector || session.name) : session.name} onClose={() => setSignField(null)} onSave={(sig) => { setValue(signField, sig); setSignField(null) }} />,
        document.body
      )}
    </div>
  )
}
