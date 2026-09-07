/* Calibrated-instrument register (editable in Settings, Admin only).

   Placeholder entries — replace the tags, ranges and dates with your own
   register before using this for real work.

   `due` is the date the instrument's calibration expires. It is a real
   field rather than something derived from `cal`, because a calibration
   interval is a decision the lab makes, not a constant this app is
   entitled to assume. An instrument with no `due` recorded is flagged
   rather than guessed at.

   The dates below are deliberately mixed — some current, some expired —
   so the control is visible in the shipped sample rather than only
   showing up the first time a real gauge goes out of date. */
export const DEFAULT_ASSETS = {
  pressureGauge: [
    { tag: 'PG-001', desc: 'Pressure Gauge 0–25 Bar', cal: '2026-01-14', due: '2027-01-14' },
    { tag: 'PG-002', desc: 'Pressure Gauge 0–25 Bar', cal: '2026-01-14', due: '2027-01-14' },
    { tag: 'PG-003', desc: 'Pressure Gauge 0–40 Bar', cal: '2026-03-02', due: '2027-03-02' },
    { tag: 'PG-004', desc: 'Pressure Gauge 0–60 Bar', cal: '2025-02-20', due: '2026-02-20' },
  ],
  barton: [
    { tag: 'BRT-001', desc: 'Chart Recorder', cal: '2026-02-11', due: '2027-02-11' },
    { tag: 'BRT-002', desc: 'Chart Recorder', cal: '2026-04-08', due: '2027-04-08' },
  ],
  thermometer: [
    { tag: 'TMP-001', desc: 'Digital Thermometer', cal: '2026-01-20', due: '2027-01-20' },
    { tag: 'TMP-002', desc: 'Digital Thermometer', cal: '2025-03-05', due: '2026-03-05' },
  ],
  tempGauge: [
    { tag: 'TG-011', desc: 'Dial Temperature Gauge', cal: '2026-05-19', due: '2027-05-19' },
    { tag: 'TG-012', desc: 'Dial Temperature Gauge', cal: '2026-06-02', due: '2027-06-02' },
  ],
  hygrometer: [
    { tag: 'HYG-001', desc: 'Digital Hygrometer', cal: '2026-02-17', due: '2027-02-17' },
    { tag: 'HYG-002', desc: 'Digital Hygrometer', cal: '2026-05-06', due: '2027-05-06' },
  ],
  lightmeter: [
    { tag: 'LUX-001', desc: 'Digital Light Meter', cal: '2026-01-09', due: '2027-01-09' },
    { tag: 'LUX-002', desc: 'Digital Light Meter', cal: '2026-04-23', due: '2027-04-23' },
  ],
  mtEquipment: [
    { tag: 'YK-2201', desc: 'AC Yoke', cal: '2026-03-12', due: '2027-03-12', method: 'Yoke' },
    { tag: 'PR-1104', desc: 'Prod Unit', cal: '2026-02-04', due: '2027-02-04', method: 'Prod.' },
    { tag: 'CL-0307', desc: 'Encircling Coil', cal: '2026-01-27', due: '2027-01-27', method: 'Coil' },
  ],
}

// What each list is called on screen, and which report fields draw on it.
export const INSTRUMENT_KINDS = {
  pressureGauge: 'Pressure gauges',
  barton: 'Pressure recorders',
  thermometer: 'Thermometers / temp. recorders',
  tempGauge: 'Temperature gauges',
  hygrometer: 'Hygrometers',
  lightmeter: 'Light meters',
  mtEquipment: 'MT equipment',
}
