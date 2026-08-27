// Default calibrated-instrument register (editable in Settings, Admin only).
// Placeholder entries — replace the tag numbers, ranges and calibration
// dates with your own instrument register.
export const DEFAULT_ASSETS = {
  pressureGauge: [
    'PG-001 · Pressure Gauge 0-25 Bar · Cal 2026-01',
    'PG-002 · Pressure Gauge 0-25 Bar · Cal 2026-01',
    'PG-003 · Pressure Gauge 0-40 Bar · Cal 2026-03',
    'PG-004 · Pressure Gauge 0-60 Bar · Cal 2026-02',
  ],
  barton: [
    'BRT-001 · Chart Recorder · Cal 2026-02',
    'BRT-002 · Chart Recorder · Cal 2026-04',
  ],
  thermometer: [
    'TMP-001 · Digital Thermometer · Cal 2026-01',
    'TMP-002 · Digital Thermometer · Cal 2026-03',
  ],
  hygrometer: [
    'HYG-001 · Digital Hygrometer · Cal 2026-02',
    'HYG-002 · Digital Hygrometer · Cal 2026-05',
  ],
  lightmeter: [
    'LUX-001 · Digital Light Meter · Cal 2026-01',
    'LUX-002 · Digital Light Meter · Cal 2026-04',
  ],
  mtEquipment: {
    'Yoke': 'YK-2201 · AC Yoke · Cal 2026-03',
    'Prod': 'PR-1104 · Prod Unit · Cal 2026-02',
    'Coil': 'CL-0307 · Encircling Coil · Cal 2026-01',
  },
}
