import { useState } from 'react'
import { useApp } from '../App.jsx'
import { ROLES } from '../lib/constants.js'
import { getAssets, setAssets } from '../lib/store.js'
import { IconPlus, IconTrash } from './Icons.jsx'

const CATS = [
  { key: 'pressureGauge', label: 'Pressure Gauges' },
  { key: 'barton', label: 'Barton Recorders' },
  { key: 'thermometer', label: 'Thermometers' },
  { key: 'hygrometer', label: 'Hygrometers / Ambient Meters' },
  { key: 'lightmeter', label: 'Lightmeters' },
]

export default function Settings() {
  const { role, notify } = useApp()
  const [assets, setLocal] = useState(getAssets())
  const [draft, setDraft] = useState({})

  if (!role.canManage) {
    return (
      <div className="page">
        <div className="empty-state"><p><strong>Settings is Admin-only.</strong></p></div>
      </div>
    )
  }

  const save = (next) => { setLocal(next); setAssets(next); }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>Settings</h2>
          <p className="page-sub">Asset / instrument register &amp; role reference (Admin)</p>
        </div>
      </div>

      <h3 className="section-title">Calibrated Instrument Register</h3>
      <div className="settings-grid">
        {CATS.map((c) => (
          <div className="card" key={c.key}>
            <h4>{c.label}</h4>
            <ul className="asset-list">
              {(assets[c.key] || []).map((a, i) => (
                <li key={i}>
                  <span>{a}</span>
                  <button className="btn btn-ghost btn-icon" aria-label="Remove"
                    onClick={() => {
                      const next = { ...assets, [c.key]: assets[c.key].filter((_, xi) => xi !== i) }
                      save(next); notify('Instrument removed')
                    }}><IconTrash size={12} /></button>
                </li>
              ))}
            </ul>
            <div className="asset-add">
              <input placeholder="ID · description · calibration date"
                value={draft[c.key] || ''}
                onChange={(e) => setDraft({ ...draft, [c.key]: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && draft[c.key]?.trim()) {
                    save({ ...assets, [c.key]: [...(assets[c.key] || []), draft[c.key].trim()] })
                    setDraft({ ...draft, [c.key]: '' }); notify('Instrument added')
                  }
                }} />
              <button className="btn btn-secondary btn-sm" disabled={!draft[c.key]?.trim()}
                onClick={() => {
                  save({ ...assets, [c.key]: [...(assets[c.key] || []), draft[c.key].trim()] })
                  setDraft({ ...draft, [c.key]: '' }); notify('Instrument added')
                }}><IconPlus size={12} /> Add</button>
            </div>
          </div>
        ))}
      </div>

      <h3 className="section-title">Roles</h3>
      <div className="card">
        {/* Four columns of prose do not fit a phone; let the table scroll
            inside its card rather than the whole page sideways. */}
        <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Role</th><th>Edit forms</th><th>Override status / locked fields</th><th>Manage (settings, delete)</th></tr></thead>
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
    </div>
  )
}
