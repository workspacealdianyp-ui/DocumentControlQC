import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp, navigate } from '../App.jsx'
import { ROLES, DELIVERABLES } from '../lib/constants.js'
import { getAssets, setAssets } from '../lib/store.js'
import { getSettings, setSettings, resetSettings, UNITS, DEFAULT_SETTINGS } from '../lib/settings.js'
import { storageUsage, fmtBytes } from '../lib/storage.js'
import { hasLock, setLock, clearLock, verify } from '../lib/lock.js'
import SignaturePad from './SignaturePad.jsx'
import {
  IconPlus, IconTrash, IconUser, IconBell, IconRuler, IconGauge,
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
  // Company had a panel of its own and not one editable field in it:
  // the name, short code and department are compiled in from
  // src/lib/company.js and already appear on the sidebar and every
  // printed letterhead. A panel that cannot set anything is not a
  // setting, so it is gone.
  { group: 'Organisation', items: [
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
  profile: ['your name', 'email', 'role', 'timezone', 'date format', 'language',
    'profile photo', 'avatar', 'signature', 'sign', 'passcode', 'password', 'lock this device'],
  notifications: ['report submitted', 'report approved', 'rejected line', 'push to mobile',
    'daily overdue digest', 'auto-delete old drafts', 'keep signatures private', 'which deliverables notify'],
  measurement: ['pressure unit', 'temperature unit', 'length unit', 'coating thickness unit',
    'light intensity unit', 'decimal places', 'warn out of tolerance', 'compute deviation', 'show units'],
  tools: ['pressure gauges', 'barton recorders', 'thermometers', 'hygrometers', 'lightmeters',
    'calibration', 'instrument register', 'add instrument'],
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


/* A photo off a phone camera is two to four megabytes, and localStorage
   gives this origin about five in total. Scale it down and re-encode it
   before it is ever saved, so a profile picture cannot eat the space the
   reports need. */
function shrink(file, max) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onerror = reject
    fr.onload = () => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale)
        const c = document.createElement('canvas')
        c.width = w; c.height = h
        c.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(c.toDataURL('image/jpeg', 0.82))
      }
      img.src = fr.result
    }
    fr.readAsDataURL(file)
  })
}

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
  const [signing, setSigning] = useState(false)
  const [locked, setLocked] = useState(hasLock)
  const [pin, setPin] = useState(null)      // { mode: 'set' | 'change' | 'remove' }
  const [pinErr, setPinErr] = useState('')
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

                {/* Your face, wherever the app draws an avatar. Held as a
                    data URI in this browser, so it counts against the
                    storage budget: a 2 MB camera photo would eat half of
                    it, and it is scaled down before it is saved. */}
                <Field label="Photo" hint="Replaces your initials in the top bar and on your profile.">
                  <div className="set-photo">
                    <span className="set-photo-view">
                      {cfg.profile.photo
                        ? <img src={cfg.profile.photo} alt="" />
                        : <em>{(cfg.profile.name || session?.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('')}</em>}
                    </span>
                    <div className="set-photo-acts">
                      <label className="btn btn-secondary btn-sm">
                        {cfg.profile.photo ? 'Replace' : 'Choose a photo'}
                        <input type="file" accept="image/*" hidden onChange={(e) => {
                          const file = e.target.files?.[0]; e.target.value = ''
                          if (!file) return
                          shrink(file, 256).then((url) => { patch('profile', 'photo', url); notify('Photo saved to this browser') })
                        }} />
                      </label>
                      {cfg.profile.photo && (
                        <button className="btn btn-ghost btn-sm"
                          onClick={() => { patch('profile', 'photo', ''); notify('Photo removed') }}>Remove</button>
                      )}
                    </div>
                  </div>
                </Field>

                {/* The signature a form offers when it asks you to sign,
                    so an inspector filing six reports draws it once. */}
                <Field label="Signature" hint="Offered as the default when a report asks the inspector to sign.">
                  <div className="set-sign">
                    {cfg.profile.signature
                      ? <img className="set-sign-view" src={cfg.profile.signature} alt="Your saved signature" />
                      : <span className="set-sign-empty">Nothing saved yet</span>}
                    <div className="set-photo-acts">
                      <button className="btn btn-secondary btn-sm" onClick={() => setSigning(true)}>
                        <IconPen size={13} /> {cfg.profile.signature ? 'Draw again' : 'Draw signature'}
                      </button>
                      {cfg.profile.signature && (
                        <button className="btn btn-ghost btn-sm"
                          onClick={() => { patch('profile', 'signature', ''); notify('Signature removed') }}>Remove</button>
                      )}
                    </div>
                  </div>
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
                {/* Signing in picks a role and checks no credential, so
                    there is no account password to change. What a shared
                    tablet actually needs is a lock on the device, and
                    this one closes a real gate in front of the app. */}
                <Field label="Device passcode"
                  hint={locked
                    ? 'Set on this device. The app asks for it when the tab is opened.'
                    : 'Not set. Anyone opening this browser goes straight in, already signed in.'}>
                  <div className="set-lock">
                    <span className={`set-lock-state${locked ? ' is-on' : ''}`}>
                      <IconLock size={13} /> {locked ? 'Locked' : 'Open'}
                    </span>
                    <button className="btn btn-secondary btn-sm" onClick={() => { setPin({ mode: locked ? 'change' : 'set' }); setPinErr('') }}>
                      {locked ? 'Change passcode' : 'Set a passcode'}
                    </button>
                    {locked && (
                      <button className="btn btn-ghost btn-sm" onClick={() => { setPin({ mode: 'remove' }); setPinErr('') }}>
                        Remove
                      </button>
                    )}
                  </div>
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

      {signing && createPortal(
        <SignaturePad name={cfg.profile.name || session?.name || 'Inspector'}
          onClose={() => setSigning(false)}
          onSave={(sig) => {
            patch('profile', 'signature', sig?.img || '')
            setSigning(false)
            notify('Signature saved to this browser')
          }} />,
        document.body
      )}

      {pin && createPortal(<PinDialog mode={pin.mode} err={pinErr}
        onClose={() => { setPin(null); setPinErr('') }}
        onSubmit={async ({ current, next }) => {
          if (pin.mode !== 'set' && !(await verify(current))) { setPinErr('That passcode does not match.'); return }
          if (pin.mode === 'remove') {
            await clearLock(current); setLocked(false); notify('Passcode removed from this device')
          } else {
            await setLock(next); setLocked(true)
            notify(pin.mode === 'change' ? 'Passcode changed' : 'Passcode set for this device')
          }
          setPin(null); setPinErr('')
        }} />, document.body)}
    </div>
  )
}

/* Setting, changing and removing all ask for the same two things at
   most, so they are one dialog rather than three that look alike. */
function PinDialog({ mode, err, onClose, onSubmit }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)

  const needsCurrent = mode !== 'set'
  const needsNew = mode !== 'remove'
  const short = needsNew && next.length > 0 && next.length < 4
  const mismatch = needsNew && again.length > 0 && next !== again
  const ready = (!needsCurrent || current) && (!needsNew || (next.length >= 4 && next === again)) && !busy

  const title = mode === 'set' ? 'Set a device passcode'
    : mode === 'change' ? 'Change the device passcode' : 'Remove the device passcode'

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal pin-modal" onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => { e.preventDefault(); if (!ready) return; setBusy(true); await onSubmit({ current, next }); setBusy(false) }}>
        <div className="sheet-handle" />
        <h3>{title}</h3>
        <p className="page-sub">
          {mode === 'remove'
            ? 'The app will open without asking for anything on this device.'
            : 'Asked for when this browser opens the app. It is kept as a hash on this device and never leaves it.'}
        </p>

        <div className="pin-fields">
          {needsCurrent && (
            <label><span>Current passcode</span>
              <input type="password" inputMode="numeric" autoFocus autoComplete="off"
                value={current} onChange={(e) => setCurrent(e.target.value)} /></label>
          )}
          {needsNew && (
            <>
              <label><span>New passcode</span>
                <input type="password" inputMode="numeric" autoFocus={!needsCurrent} autoComplete="new-password"
                  value={next} onChange={(e) => setNext(e.target.value)} />
                <small>At least four characters.</small></label>
              <label><span>Repeat it</span>
                <input type="password" inputMode="numeric" autoComplete="new-password"
                  value={again} onChange={(e) => setAgain(e.target.value)} /></label>
            </>
          )}
        </div>

        {(err || short || mismatch) && (
          <p className="pin-err" role="alert">
            {err || (short ? 'Use at least four characters.' : 'The two entries do not match.')}
          </p>
        )}

        {mode !== 'remove' && (
          <p className="pin-note">
            Forgotten it? Clearing this site's data in the browser removes the
            lock, and every report stored here with it.
          </p>
        )}

        <div className="pin-acts">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={!ready}>
            {mode === 'remove' ? 'Remove passcode' : 'Save passcode'}
          </button>
        </div>
      </form>
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
