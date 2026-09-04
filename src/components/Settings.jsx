import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useApp, navigate } from '../App.jsx'
import { ROLES, DELIVERABLES } from '../lib/constants.js'
import { COMPANY } from '../lib/company.js'
import { getAssets, setAssets } from '../lib/store.js'
import { getSettings, setSettings, resetSettings, UNITS, DEFAULT_SETTINGS } from '../lib/settings.js'
import { storageUsage, fmtBytes } from '../lib/storage.js'
import {
  IconPlus, IconTrash, IconUser, IconBell, IconRuler, IconGauge, IconBuilding,
  IconShield, IconDatabase, IconMail, IconLock, IconPen, IconCheck, IconDoc,
  IconCloudUp, IconAlert, IconEye, IconDownload, IconSearch, IconClose,
} from './Icons.jsx'

/* Settings is a two-column screen: a rail of sections on the left, one
   panel on the right. The section travels through the hash
   (#/settings?s=measurement) so a panel is linkable and survives a
   reload, the same way the job categories work. */

const SECTIONS = [
  { group: 'Account', items: [
    { id: 'profile', label: 'Profile', icon: IconUser },
    { id: 'notifications', label: 'Notifications', icon: IconBell },
  ] },
  // Measurement is its own section, above the instrument register: one
  // sets the units every form is read in, the other lists the hardware.
  { group: 'Inspection', items: [
    { id: 'measurement', label: 'Measurement', icon: IconRuler },
    { id: 'tools', label: 'Measurement Tools', icon: IconGauge, admin: true },
  ] },
  { group: 'Organisation', items: [
    { id: 'company', label: 'Company', icon: IconBuilding, admin: true },
    { id: 'roles', label: 'Roles & access', icon: IconShield, admin: true },
  ] },
  { group: 'Data', items: [
    { id: 'storage', label: 'Storage & reset', icon: IconDatabase, admin: true },
  ] },
]

const ALL = SECTIONS.flatMap((g) => g.items)

/* What each panel actually contains, so the search can answer "where do
   I change the pressure unit" rather than only matching section names.
   Written by hand against the controls below, because a control's label
   lives in JSX and an index generated from the DOM would only know about
   the panel already on screen. */
const INDEX = {
  profile: ['your name', 'email', 'role', 'timezone', 'date format', 'language', 'signature name'],
  notifications: ['report submitted', 'report approved', 'rejected line', 'push to mobile',
    'daily overdue digest', 'auto-delete old drafts', 'keep signatures private', 'which deliverables notify'],
  measurement: ['pressure unit', 'temperature unit', 'length unit', 'coating thickness unit',
    'light intensity unit', 'decimal places', 'warn out of tolerance', 'compute deviation', 'show units'],
  tools: ['pressure gauges', 'barton recorders', 'thermometers', 'hygrometers', 'lightmeters',
    'calibration', 'instrument register', 'add instrument'],
  company: ['company name', 'legal name', 'short code', 'report number prefix', 'department', 'tagline'],
  roles: ['inspector', 'admin', 'qa lead', 'viewer', 'permissions', 'who can approve', 'who can edit'],
  storage: ['local storage', 'export settings', 'reset settings', 'clear all data', 'how much space'],
}

/* Which panels hold a value you can actually change, and how to count
   the ones that differ from the shipped default. A settings screen that
   cannot tell you what you have altered makes you open every panel. */
const CFG_PANEL = { profile: 'profile', notifications: 'notify', measurement: 'measurement' }
function changedCount(cfg, id) {
  const key = CFG_PANEL[id]
  if (!key) return 0
  const def = DEFAULT_SETTINGS[key], now = cfg[key]
  let n = 0
  for (const k of Object.keys(def)) {
    if (k === 'watch') {
      for (const w of Object.keys(def.watch)) if (def.watch[w] !== now.watch?.[w]) n++
    } else if (def[k] !== now[k]) n++
  }
  return n
}

/* An instrument is registered as free text, and the last thing on the
   line is normally its calibration date. Read it when it is there and
   say nothing when it is not: guessing a date would be worse than
   admitting none was recorded. */
/* Three shapes turn up in a real register: a full ISO date, a day-first
   date, and a year-month, which is how a certificate that only names the
   month gets written down. A year-month is read as the end of that
   month, which is when it actually lapses. */
const DATE_RE = /(\d{4}-\d{2}-\d{2})|(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4})|(\d{4}-\d{2})\s*$/
function calStatus(text) {
  const m = String(text).match(DATE_RE)
  if (!m) return { state: 'none', label: 'No date' }
  let d
  if (m[1]) d = new Date(m[1] + 'T00:00:00')
  else if (m[2]) {
    const [a, b, c] = m[2].split(/[\/.-]/).map(Number)
    d = new Date(c, b - 1, a)
  } else {
    const [y, mo] = m[3].split('-').map(Number)
    d = new Date(y, mo, 0)   // day 0 of the next month is the last of this one
  }
  if (isNaN(d)) return { state: 'none', label: 'No date' }
  const days = Math.round((d - new Date()) / 86400000)
  if (days < 0) return { state: 'over', label: days > -400 ? `Expired ${Math.abs(days)}d ago` : 'Expired' }
  if (days <= 30) return { state: 'soon', label: `Due in ${days}d` }
  if (days <= 365) return { state: 'ok', label: `Due in ${Math.round(days / 30)} mo` }
  return { state: 'ok', label: 'In date' }
}

const TOOL_CATS = [
  { key: 'pressureGauge', label: 'Pressure Gauges' },
  { key: 'barton', label: 'Barton Recorders' },
  { key: 'thermometer', label: 'Thermometers' },
  { key: 'hygrometer', label: 'Hygrometers / Ambient Meters' },
  { key: 'lightmeter', label: 'Lightmeters' },
]

/* ── Row primitives ──────────────────────────────────────────────── */

// Icon, title, one line of explanation, switch. The explanation is the
// point: a settings row that only says "Auto sync" makes the reader guess.
function ToggleRow({ icon: Icon, title, desc, on, onChange, disabled }) {
  return (
    <div className={`set-row${disabled ? ' is-disabled' : ''}`}>
      <span className="set-row-ico"><Icon size={15} /></span>
      <span className="set-row-text">
        <strong>{title}</strong>
        <small>{desc}</small>
      </span>
      <button type="button" role="switch" aria-checked={on} aria-label={title}
        className={`set-switch${on ? ' on' : ''}`} disabled={disabled}
        onClick={() => onChange(!on)}>
        <span className="set-knob" />
      </button>
    </div>
  )
}

function CheckRow({ icon: Icon, label, on, onChange }) {
  return (
    <label className={`set-check${on ? ' on' : ''}`}>
      <span className="set-check-ico"><Icon size={15} /></span>
      <span className="set-check-label">{label}</span>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span className="set-box" aria-hidden="true"><IconCheck size={11} /></span>
    </label>
  )
}

// Label on the left, control on the right, hint under the control.
function Field({ label, hint, children, locked }) {
  return (
    <div className="set-field">
      <span className="set-field-label">{label}</span>
      <div className="set-field-ctrl">
        {children}
        {locked && <span className="set-field-lock" title="Set by this build"><IconLock size={13} /></span>}
        {hint && <small className="set-field-hint">{hint}</small>}
      </div>
    </div>
  )
}

function Panel({ title, desc, children }) {
  return (
    <section className="set-panel">
      <h3>{title}</h3>
      {desc && <p className="set-panel-desc">{desc}</p>}
      {children}
    </section>
  )
}

const Legend = ({ children }) => <p className="set-legend">{children}</p>

/* ── Screen ──────────────────────────────────────────────────────── */

export default function Settings({ section }) {
  const { role, session, notify } = useApp()
  const [cfg, setCfg] = useState(getSettings)
  const [assets, setLocalAssets] = useState(getAssets)
  const [draft, setDraft] = useState({})
  const [q, setQ] = useState('')
  const used = storageUsage()

  /* Search answers "where do I change X", which is the question people
     actually arrive with. It matches the panel name and everything on
     it, and each hit says which control it found. */
  const ql = q.trim().toLowerCase()
  const hits = ql
    ? ALL.filter((i) => !i.admin || role.canManage)
        .map((i) => ({
          item: i,
          matches: (i.label.toLowerCase().includes(ql) ? ['this section'] : [])
            .concat((INDEX[i.id] || []).filter((t) => t.includes(ql))),
        }))
        .filter((h) => h.matches.length)
    : null

  const wanted = ALL.find((s) => s.id === section)
  const at = wanted && (!wanted.admin || role.canManage) ? wanted : ALL[0]

  // A stale link to an admin panel should not leave the rail pointing at
  // one thing and the body showing another.
  useEffect(() => {
    if (section && at.id !== section) navigate(`/settings?s=${at.id}`)
  }, [section, at.id])

  /* The marker is placed from the live position of the active link, not
     from an index, so it stays correct when a group is hidden from a
     role or the rail wraps. */
  const navRef = useRef(null)
  const [mark, setMark] = useState(null)
  useLayoutEffect(() => {
    const nav = navRef.current
    const el = nav?.querySelector('.set-link.on')
    if (!nav || !el) { setMark(null); return }
    // offsetTop/offsetLeft are relative to the nav and unaffected by its
    // horizontal scroll, which the phone rail has and a bounding rect
    // would have to be re-measured for.
    const place = () => setMark({
      transform: `translate3d(${el.offsetLeft}px, ${el.offsetTop}px, 0)`,
      width: el.offsetWidth, height: el.offsetHeight,
    })
    place()
    const ro = new ResizeObserver(place)
    ro.observe(nav)
    return () => ro.disconnect()
  }, [at.id, role.canManage])

  const patch = (panel, key, value) => {
    const next = { ...cfg, [panel]: { ...cfg[panel], [key]: value } }
    setCfg(setSettings(next))
  }
  const patchWatch = (key, value) => {
    const next = { ...cfg, notify: { ...cfg.notify, watch: { ...cfg.notify.watch, [key]: value } } }
    setCfg(setSettings(next))
  }
  const saveAssets = (next) => { setLocalAssets(next); setAssets(next) }

  const m = cfg.measurement
  const n = cfg.notify

  return (
    <div className="page set">
      <div className="set-shell">
        <aside className="set-rail">
          {/* the top bar already names this page */}
          <p className="set-rail-sub">{COMPANY.name}<span>{role.label}</span></p>

          <div className={`set-find${q ? ' has-value' : ''}`}>
            <IconSearch size={14} />
            <input value={q} onChange={(e) => setQ(e.target.value)} type="search"
              placeholder="Find a setting" aria-label="Find a setting" spellCheck={false} />
            {q && (
              <button type="button" aria-label="Clear" onClick={() => setQ('')}><IconClose size={13} /></button>
            )}
          </div>

          <nav className="set-nav" ref={navRef}>
            {/* One marker that travels between sections rather than a
                border that appears on one item and vanishes from another.
                The selection is a single object, so it should read as one
                object moving. */}
            <span className="set-mark" style={mark} aria-hidden="true" />
          {SECTIONS.map((g) => {
            const items = g.items.filter((i) => !i.admin || role.canManage)
            if (!items.length) return null
            return (
              <div className="set-group" key={g.group}>
                <span className="set-group-label">{g.group}</span>
                <ul>
                  {items.map((i) => (
                    <li key={i.id}>
                      <button className={`set-link${at.id === i.id ? ' on' : ''}`}
                        aria-current={at.id === i.id ? 'page' : undefined}
                        onClick={() => navigate(`/settings?s=${i.id}`)}>
                        <span>{i.label}</span>
                        {/* How many choices on that panel are no longer the
                            shipped default. Without it you have to open
                            every panel to find what you changed. */}
                        {changedCount(cfg, i.id) > 0 && (
                          <em className="set-changed"
                            title={`${changedCount(cfg, i.id)} changed from default`}>
                            {changedCount(cfg, i.id)}
                          </em>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
          </nav>
        </aside>

        {/* Keyed on the section, so moving between panels remounts the
            body and the staggered entrance replays. It is the only thing
            that tells you the right-hand side changed when two panels
            happen to start with a similar row. */}
        {hits ? (
          <div className="set-body">
            <section className="set-panel">
              <h3>{hits.length ? `${hits.length} section${hits.length === 1 ? '' : 's'} match${hits.length === 1 ? 'es' : ''} “${q.trim()}”` : `Nothing matches “${q.trim()}”`}</h3>
              <p className="set-panel-desc">
                {hits.length
                  ? 'Open a section to change it. The search covers every control on this screen, not just the section names.'
                  : 'Try a word from the control itself: “pressure”, “timezone”, “calibration”, “storage”.'}
              </p>
              <div className="set-hits">
                {hits.map(({ item, matches }) => (
                  <button key={item.id} className="set-hit"
                    onClick={() => { setQ(''); navigate(`/settings?s=${item.id}`) }}>
                    <span className="set-hit-ico"><item.icon size={15} /></span>
                    <span className="set-hit-txt">
                      <strong>{item.label}</strong>
                      <small>{matches.slice(0, 4).join(', ')}{matches.length > 4 ? ` and ${matches.length - 4} more` : ''}</small>
                    </span>
                    {changedCount(cfg, item.id) > 0 && <em className="set-changed">{changedCount(cfg, item.id)}</em>}
                  </button>
                ))}
              </div>
            </section>
          </div>
        ) : (
        <div className="set-body" key={at.id}>
          {at.id === 'profile' && (
            <Panel title="Profile"
              desc="How you are identified on the inspection forms you sign. This app has no back-end, so these details stay in this browser and are never sent anywhere.">
              <div className="set-fields">
                <Field label="Your name">
                  <input value={cfg.profile.name || session?.name || ''}
                    onChange={(e) => patch('profile', 'name', e.target.value)}
                    placeholder={session?.name || 'Inspector name'} />
                </Field>
                <Field label="Email" hint="Used on the report letterhead only.">
                  <div className="set-input-icon">
                    <input type="email" value={cfg.profile.email}
                      onChange={(e) => patch('profile', 'email', e.target.value)}
                      placeholder="name@example.com" />
                    <IconPen size={13} />
                  </div>
                </Field>
                <Field label="Role" locked hint="Set at sign-in. Change it by signing in as another role.">
                  <input value={role.label} readOnly />
                </Field>
                <Field label="Timezone" hint="Stamps every submission and approval time.">
                  <select value={cfg.profile.timezone} onChange={(e) => patch('profile', 'timezone', e.target.value)}>
                    <option value="Asia/Jakarta">(UTC+07:00) Asia / Jakarta</option>
                    <option value="Asia/Makassar">(UTC+08:00) Asia / Makassar</option>
                    <option value="Asia/Jayapura">(UTC+09:00) Asia / Jayapura</option>
                    <option value="Asia/Singapore">(UTC+08:00) Asia / Singapore</option>
                    <option value="Europe/London">(UTC+00:00) Europe / London</option>
                  </select>
                </Field>
                <Field label="Date format">
                  <select value={cfg.profile.locale} onChange={(e) => patch('profile', 'locale', e.target.value)}>
                    <option value="en-GB">28 Aug 2026 (day first)</option>
                    <option value="en-US">Aug 28, 2026 (month first)</option>
                    <option value="iso">2026-08-28 (ISO 8601)</option>
                  </select>
                </Field>
                <Field label="Language" hint="Only English is bundled in this build.">
                  <select value={cfg.profile.language} onChange={(e) => patch('profile', 'language', e.target.value)}>
                    <option value="en-GB">English (United Kingdom)</option>
                  </select>
                </Field>
              </div>
            </Panel>
          )}

          {at.id === 'notifications' && (
            <Panel title="Notification settings"
              desc="What the bell tells you about. Notifications are raised in this browser as reports move through draft, submitted and approved.">
              <div className="set-two">
                <div>
                  <Legend>Primary settings</Legend>
                  <div className="set-rows">
                    <ToggleRow icon={IconCloudUp} title="Report submitted"
                      desc="An inspector sends a report for approval"
                      on={n.onSubmit} onChange={(v) => patch('notify', 'onSubmit', v)} />
                    <ToggleRow icon={IconCheck} title="Report approved"
                      desc="A QA Lead signs off a report you filed"
                      on={n.onApprove} onChange={(v) => patch('notify', 'onApprove', v)} />
                    <ToggleRow icon={IconAlert} title="Rejected line raised"
                      desc="A result row fails and an NCR is opened"
                      on={n.onReject} onChange={(v) => patch('notify', 'onReject', v)} />
                    <ToggleRow icon={IconMail} title="Push to mobile" disabled
                      desc="Needs a server; this build is front-end only"
                      on={n.push} onChange={() => {}} />
                  </div>

                  <Legend>Secondary options</Legend>
                  <div className="set-rows">
                    <ToggleRow icon={IconDoc} title="Daily overdue digest"
                      desc="One summary of jobs past their PDI release date"
                      on={n.overdueDigest} onChange={(v) => patch('notify', 'overdueDigest', v)} />
                    <ToggleRow icon={IconTrash} title="Auto-delete old drafts"
                      desc="Clear drafts untouched for more than 90 days"
                      on={n.autoPurgeDrafts} onChange={(v) => patch('notify', 'autoPurgeDrafts', v)} />
                    <ToggleRow icon={IconEye} title="Keep signatures private"
                      desc="Hide drawn signatures outside the printed report"
                      on={n.privateSignatures} onChange={(v) => patch('notify', 'privateSignatures', v)} />
                  </div>
                </div>

                <div>
                  <Legend>Document deliverables</Legend>
                  <div className="set-rows">
                    {DELIVERABLES.filter((d) => !d.form).map((d) => (
                      <CheckRow key={d.key} icon={IconDoc} label={d.label}
                        on={!!n.watch[d.key]} onChange={(v) => patchWatch(d.key, v)} />
                    ))}
                  </div>

                  <Legend>Inspection reports</Legend>
                  <div className="set-rows">
                    {DELIVERABLES.filter((d) => d.form).map((d) => (
                      <CheckRow key={d.key} icon={IconPen} label={d.label}
                        on={!!n.watch[d.key]} onChange={(v) => patchWatch(d.key, v)} />
                    ))}
                  </div>
                </div>
              </div>
            </Panel>
          )}

          {at.id === 'measurement' && (
            <Panel title="Measurement"
              desc="The units every inspection form is read and printed in. Changing one here sets the default on new reports; reports already filed keep the unit they were recorded in.">
              <div className="set-two">
                <div>
                  <Legend>Units</Legend>
                  <div className="set-fields">
                    <Field label="Pressure" hint="Hydro and leak tests: spec, gauges and the recording table.">
                      <Segmented options={UNITS.pressure} value={m.pressure}
                        onChange={(v) => patch('measurement', 'pressure', v)} />
                    </Field>
                    <Field label="Temperature" hint="Ambient, dry bulb, wet bulb and material temperature.">
                      <Segmented options={UNITS.temperature} value={m.temperature}
                        onChange={(v) => patch('measurement', 'temperature', v)} />
                    </Field>
                    <Field label="Length" hint="Dimensional reports and material thickness.">
                      <Segmented options={UNITS.length} value={m.length}
                        onChange={(v) => patch('measurement', 'length', v)} />
                    </Field>
                    <Field label="Coating thickness" hint="Dry film thickness on the painting report.">
                      <Segmented options={UNITS.coating} value={m.coating}
                        onChange={(v) => patch('measurement', 'coating', v)} />
                    </Field>
                    <Field label="Light intensity" hint="Surface illumination during visual and NDE work.">
                      <Segmented options={UNITS.light} value={m.light}
                        onChange={(v) => patch('measurement', 'light', v)} />
                    </Field>
                    <Field label="Decimal places" hint="Applied when a reading is displayed, not when it is stored.">
                      <select value={m.decimals} onChange={(e) => patch('measurement', 'decimals', +e.target.value)}>
                        {[0, 1, 2, 3].map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </Field>
                  </div>
                </div>

                <div>
                  <Legend>Reading behaviour</Legend>
                  <div className="set-rows">
                    <ToggleRow icon={IconAlert} title="Warn out of tolerance"
                      desc="Mark a reading red the moment it leaves the band"
                      on={m.warnOutOfTolerance} onChange={(v) => patch('measurement', 'warnOutOfTolerance', v)} />
                    <ToggleRow icon={IconRuler} title="Compute deviation"
                      desc="Fill deviation and judgement from nominal and actual"
                      on={m.autoDeviation} onChange={(v) => patch('measurement', 'autoDeviation', v)} />
                    <ToggleRow icon={IconGauge} title="Show units beside values"
                      desc="Print the unit after every reading, not just in the header"
                      on={m.showUnits} onChange={(v) => patch('measurement', 'showUnits', v)} />
                  </div>

                  <div className="set-note">
                    <strong>Current defaults</strong>
                    <p>
                      Pressure in <b>{m.pressure}</b>, temperature in <b>{m.temperature}</b>,
                      length in <b>{m.length}</b>, coating in <b>{m.coating}</b>,
                      to <b>{m.decimals}</b> decimal {m.decimals === 1 ? 'place' : 'places'}.
                    </p>
                  </div>
                </div>
              </div>
            </Panel>
          )}

          {at.id === 'tools' && (
            <Panel title="Measurement Tools"
              desc="The calibrated instruments an inspector can pick on a form. Type the ID, what it is, and the calibration date; the date is read back and checked against today.">
              {(() => {
                const every = TOOL_CATS.flatMap((c) => assets[c.key] || [])
                const over = every.filter((a) => calStatus(a).state === 'over').length
                const soon = every.filter((a) => calStatus(a).state === 'soon').length
                const none = every.filter((a) => calStatus(a).state === 'none').length
                return (
                  <div className="set-note set-cal-summary">
                    <strong>{every.length} instrument{every.length === 1 ? '' : 's'} registered</strong>
                    <p>
                      {over > 0 && <>{over} past calibration and still selectable. </>}
                      {soon > 0 && <>{soon} due within 30 days. </>}
                      {none > 0 && <>{none} with no date recorded. </>}
                      {!over && !soon && !none && every.length > 0 && <>Every one is in date. </>}
                      {every.length === 0 && <>Nothing registered yet, so no instrument can be picked on a form. </>}
                    </p>
                  </div>
                )
              })()}
              <div className="set-tools">
                {TOOL_CATS.map((c) => (
                  <div className="set-tool" key={c.key}>
                    <div className="set-tool-head">
                      <h4>{c.label}</h4>
                      <span className="set-tool-n">{(assets[c.key] || []).length}</span>
                    </div>
                    <ul className="asset-list">
                      {(assets[c.key] || []).map((a, i) => {
                        const cal = calStatus(a)
                        return (
                        <li key={i} className={`cal-${cal.state}`}>
                          <span>{a}</span>
                          {/* An instrument past its calibration date must
                              not be picked on a form, so the list says so
                              rather than leaving it to be read off the
                              end of a free-text line. */}
                          <em className="asset-cal">{cal.label}</em>
                          <button className="btn btn-ghost btn-icon" aria-label={`Remove ${a}`}
                            onClick={() => {
                              saveAssets({ ...assets, [c.key]: assets[c.key].filter((_, xi) => xi !== i) })
                              notify('Instrument removed')
                            }}><IconTrash size={12} /></button>
                        </li>
                      )})}
                      {!(assets[c.key] || []).length && <li className="asset-empty">Nothing registered yet.</li>}
                    </ul>
                    <div className="asset-add">
                      <input placeholder="ID · description · calibration date"
                        value={draft[c.key] || ''}
                        onChange={(e) => setDraft({ ...draft, [c.key]: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && draft[c.key]?.trim()) {
                            saveAssets({ ...assets, [c.key]: [...(assets[c.key] || []), draft[c.key].trim()] })
                            setDraft({ ...draft, [c.key]: '' }); notify('Instrument added')
                          }
                        }} />
                      <button className="btn btn-secondary btn-sm" disabled={!draft[c.key]?.trim()}
                        onClick={() => {
                          saveAssets({ ...assets, [c.key]: [...(assets[c.key] || []), draft[c.key].trim()] })
                          setDraft({ ...draft, [c.key]: '' }); notify('Instrument added')
                        }}><IconPlus size={12} /> Add</button>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {at.id === 'company' && (
            <Panel title="Company"
              desc="Identity on every screen and printed report letterhead. These come from src/lib/company.js, so they are set once at build time rather than per browser.">
              <div className="set-fields">
                <Field label="Name" locked><input value={COMPANY.name} readOnly /></Field>
                <Field label="Legal name" locked><input value={COMPANY.legalName} readOnly /></Field>
                <Field label="Short code" locked hint="Prefixes every report number, e.g. MFG/LHT/1000200002/01.">
                  <input value={COMPANY.short} readOnly />
                </Field>
                <Field label="Department" locked><input value={COMPANY.department} readOnly /></Field>
                <Field label="Tagline" locked><input value={COMPANY.tagline} readOnly /></Field>
              </div>
            </Panel>
          )}

          {at.id === 'roles' && (
            <Panel title="Roles & access"
              desc="What each role may do. Roles are fixed in this build; a person picks one at sign-in.">
              <div className="card">
                {/* Four columns of prose do not fit a phone; let the table
                    scroll inside its card rather than the whole page. */}
                <div className="table-scroll">
                  <table className="data-table">
                    <thead><tr><th>Role</th><th>Edit forms</th><th>Override status</th><th>Manage settings</th></tr></thead>
                    <tbody>
                      {Object.entries(ROLES).map(([k, r]) => (
                        <tr key={k}>
                          <td><strong>{r.label}</strong></td>
                          <td>{r.canEdit ? 'Yes' : 'No'}</td>
                          <td>{r.canOverride ? 'Yes' : 'No'}</td>
                          <td>{r.canManage ? 'Yes' : 'No'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Panel>
          )}

          {at.id === 'storage' && (
            <Panel title="Storage & reset"
              desc="Everything this app holds lives in this browser. Clearing it cannot be undone and does not touch anyone else's copy.">
              {/* This panel is where the rail's storage card sends you, so
                  it should open on the number that card was showing. */}
              <div className="pf-meter set-meter">
                <div className="pf-meter-top">
                  <span><IconDatabase size={14} /> Local storage</span>
                  <strong>{used.pct}%</strong>
                </div>
                <div className="pf-meter-bar" role="img" aria-label={`${used.pct}% of local storage used`}>
                  <span style={{ width: `${Math.max(1, Math.min(100, used.pct))}%` }} />
                </div>
                <small>{fmtBytes(used.bytes)} of {fmtBytes(used.budget)} used by reports, photos, signatures and job orders</small>
              </div>
              <div className="set-rows set-actions">
                <div className="set-row">
                  <span className="set-row-ico"><IconDownload size={15} /></span>
                  <span className="set-row-text">
                    <strong>Export settings</strong>
                    <small>Download this panel's choices as JSON</small>
                  </span>
                  <button className="btn btn-secondary btn-sm" onClick={() => {
                    const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' })
                    const a = document.createElement('a')
                    a.href = URL.createObjectURL(blob)
                    a.download = 'qc-settings.json'
                    a.click()
                    URL.revokeObjectURL(a.href)
                  }}>Export</button>
                </div>
                <div className="set-row">
                  <span className="set-row-ico"><IconRuler size={15} /></span>
                  <span className="set-row-text">
                    <strong>Reset settings</strong>
                    <small>Put every choice on this screen back to its default</small>
                  </span>
                  <button className="btn btn-secondary btn-sm" onClick={() => {
                    setCfg(resetSettings()); notify('Settings reset to defaults')
                  }}>Reset</button>
                </div>
                <div className="set-row is-danger">
                  <span className="set-row-ico"><IconAlert size={15} /></span>
                  <span className="set-row-text">
                    <strong>Clear all local data</strong>
                    <small>Removes every report, override and setting in this browser</small>
                  </span>
                  <button className="btn btn-secondary btn-sm set-danger-btn" onClick={() => {
                    if (!window.confirm('Delete every report, override and setting stored in this browser? This cannot be undone.')) return
                    for (const k of Object.keys(localStorage)) {
                      if (k.startsWith('qc.')) localStorage.removeItem(k)
                    }
                    notify('Local data cleared. Reloading…')
                    setTimeout(() => window.location.reload(), 700)
                  }}>Clear</button>
                </div>
              </div>
            </Panel>
          )}
        </div>
        )}
      </div>
    </div>
  )
}

function Segmented({ options, value, onChange }) {
  return (
    <div className="set-seg" role="group">
      {options.map((o) => (
        <button key={o} type="button" className={value === o ? 'on' : ''}
          aria-pressed={value === o} onClick={() => onChange(o)}>{o}</button>
      ))}
    </div>
  )
}
