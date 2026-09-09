import { optionsFor, methodsFor } from '../lib/instruments.js'
// The 7 inspection form templates — ported from the old app/ engine model
// (see memory: port-old-form-engine). Each form: { key, code, title, deliverable,
//   reportTitle(v), signRoles(v), formNo, headerExtra[], derive(key,val,v), sections[] }
//
// Section: { id, title, sub?, type?, lockable?, fields?[] , columns?, judgeKey, accValue, rejValue }
//   type: 'fields'(default) | 'recording' | 'results' | 'dft' | 'rt' | 'photos'
// Field type: text | number | date | select | segmented | toggle | choice | textarea
//   | computed | readonly | timer | sign | jobsearch | auto
//   modifiers: half, required, showIf(v), compute(v), default, unit, placeholder, hint, locks
import { MR } from '../lib/compute.js'

/* Shared first page: the job's identity, not a form.

   Everything here comes from the job order the QC head published, so
   nothing on it is typed. The one control is the job itself — pick a
   different job and every other line follows it, which is the only way
   these values can stay true to the master record. */
const headerSection = {
  id: 'header', title: 'Job Identity', subtitle: 'Taken from the job order — pick the job, everything else follows',
  // `group` splits the read-back into the two things page 1 states: who
  // filed this report, and which job it is against. They are different
  // questions and belong under different headings.
  fields: [
    { id: 'jobNo', label: 'Job', type: 'jobsearch', required: true },
    { id: 'reportId', label: 'Report ID', type: 'auto', group: 'report' },
    { id: 'inspector', label: 'Inspector Name', type: 'auto', group: 'report' },
    { id: 'inspDate', label: 'Inspection / Testing Date', type: 'auto', fmt: 'date', group: 'report' },
    { id: 'poNo', label: 'PO Number', type: 'auto', group: 'job' },
    { id: 'wbsNo', label: 'WBS Number', type: 'auto', group: 'job' },
    { id: 'jobDesc', label: 'Job Desc.', type: 'auto', group: 'job' },
    { id: 'sn', label: 'SN / MSN', type: 'auto', group: 'job' },
    { id: 'unit', label: 'Unit No.', type: 'auto', group: 'job' },
    { id: 'customer', label: 'Customer', type: 'auto', group: 'job' },
  ],
}

// The headings those groups sit under, in the order page 1 reads.
export const IDENT_GROUPS = [
  { id: 'report', title: 'Report detail', sub: 'Stamped when the report was raised' },
  { id: 'job', title: 'Job detail', sub: 'From the job order — the master record' },
]

const approvals = (roles) => ({
  id: 'approvals', title: 'Approvals',
  fields: roles.map((r, i) => ({
    id: i === 0 ? 'signInspector' : i === 1 ? 'signQc' : i === 2 ? 'signClient' : `sign${i}`,
    label: r, type: 'sign', req: i < 2 ? 'M' : 'O',
  })),
})

/* The shared header calls page 1's date "Inspection / Testing Date",
   which is what it is on a test report. Nothing was tested on that date
   on a document record — it is the day the document was filed here —
   and a printed sheet that says otherwise directly above the document's
   own issue date invites exactly the wrong reading in a data book. */
const recordHeader = {
  ...headerSection,
  fields: headerSection.fields.map((f) => (f.id === 'inspDate' ? { ...f, label: 'Date filed' } : f)),
}

export const FORM_SCHEMAS = {
  // ───────────────────────── HYDROTEST ─────────────────────────
  hydrotest: {
    key: 'hydrotest', code: 'LHT', title: 'Leak & Hydrostatic Test Report',
    deliverable: 'Leak & Hydro Test', formNo: 'F.380.WS-3.030',
    derive: (key, val) => key === 'testType' ? { testMedia: val === 'Leak Test' ? 'Air' : 'Water' } : {},
    sections: [
      headerSection,
      { id: 'general', title: 'General', fields: [
        { id: 'testType', label: 'Test Type', type: 'segmented', options: ['Hydrostatic Test', 'Leak Test'], default: 'Hydrostatic Test', req: 'M' },
        { id: 'testDesc', label: 'Object', type: 'segmented', options: ['Body', 'Tank', 'Pipe'], req: 'M' },
        { id: 'testMedia', label: 'Test Media', type: 'segmented', options: ['Water', 'Air'], default: 'Water', req: 'M', hint: 'Auto: Hydrostatic → Water, Leak Test → Air. Editable.' },
      ]},
      { id: 'setup', title: 'Test Setup', subtitle: 'Pick what this test uses — unused parts are hidden & left off the report', fields: [
        { id: 'pressureUnit', label: 'Pressure Unit', type: 'segmented', options: ['Bar', 'PsiG', 'kPa'], default: 'PsiG', req: 'M', hint: 'Used everywhere — spec, gauges & the recording table.' },
        { id: 'gauges', label: 'Pressure Gauges', type: 'toggle', options: ['1 Gauge', '2 Gauges'], default: '2 Gauges', hint: '2 gauges = top & bottom' },
        { id: 'useRecorder', label: 'Pressure Recorder (chart)', type: 'toggle', options: ['Used', 'Not used'], default: 'Used' },
        { id: 'useTemp', label: 'Temperature Recording', type: 'toggle', options: ['Used', 'Not used'], default: 'Used' },
        { id: 'thirdParty', label: 'Third Party Witness (LRQA)', type: 'toggle', options: ['Yes', 'No'], default: 'No', hint: 'Adds a 4th signature' },
      ]},
      { id: 'spec', title: 'Unit Specification', subtitle: 'Form F.380.WS-3.030', fields: [
        { id: 'standard', label: 'Standard', type: 'text', default: 'ASME Sect. VIII, Div. 1, 2019 Edition', req: 'M' },
        { id: 'material', label: 'Material', type: 'text', half: true },
        { id: 'surfaceCond', label: 'Surface Cond.', type: 'text', half: true },
        { id: 'designPressure', label: 'Design Pressure', type: 'text', half: true, unitFrom: 'pressureUnit' },
        { id: 'mawp', label: 'M.A.W.P.', type: 'text', half: true, unitFrom: 'pressureUnit' },
        { id: 'map', label: 'M.A.P.', type: 'text', half: true, unitFrom: 'pressureUnit', placeholder: '"-" if none' },
        { id: 'testPressure', label: 'Test Pressure', type: 'text', half: true, req: 'M', unitFrom: 'pressureUnit', hint: 'Range allowed, e.g. 250–500' },
        { id: 'holding', label: 'Holding Period', type: 'number', unit: 'min', half: true, req: 'M' },
      ]},
      { id: 'equip', title: 'Test Equipment', subtitle: 'Pick the calibrated instrument — locked once the test starts', lockable: true, fields: [
        { id: 'pg1', label: (v) => v.gauges === '2 Gauges' ? 'PG 1 (Top)' : 'Pressure Gauge', type: 'select', options: (v, keep) => optionsFor('pressureGauge', { on: v.inspDate, keep }), locks: true, req: 'M' },
        { id: 'pg2', label: 'PG 2 (Bottom)', type: 'select', options: (v, keep) => optionsFor('pressureGauge', { on: v.inspDate, keep }), locks: true, req: 'M', showIf: (v) => v.gauges === '2 Gauges' },
        { id: 'pressRecorder', label: 'Pressure Recorder', type: 'select', options: (v, keep) => optionsFor('barton', { on: v.inspDate, keep }), locks: true, showIf: (v) => v.useRecorder !== 'Not used' },
        { id: 'scale', label: 'Scale', type: 'text', placeholder: 'e.g. 1 div = 4 PsiG', half: true, showIf: (v) => v.useRecorder !== 'Not used' },
        { id: 'tempRecorder', label: 'Temp. Recorder (TR)', type: 'select', options: (v, keep) => optionsFor('thermometer', { on: v.inspDate, keep }), locks: true, showIf: (v) => v.useTemp !== 'Not used' },
        { id: 'tempGauge', label: 'Temp. Gauge (TG)', type: 'select', options: (v, keep) => optionsFor('tempGauge', { on: v.inspDate, keep }), locks: true, showIf: (v) => v.useTemp !== 'Not used' },
      ]},
      { id: 'recording', title: 'Recording Table', subtitle: 'Checkpoint readings — columns follow your test setup', type: 'recording' },
      { id: 'photos', title: 'Documentation', subtitle: 'Printed mid-page on the report', type: 'photos' },
      { id: 'result', title: 'Test Result', fields: [
        { id: 'leakage', label: 'Leakage Status', type: 'computed', compute: (v, rep) => recHasFail(rep) ? 'Leak' : 'No Leak' },
        { id: 'testResult', label: 'Test Result', type: 'segmented', options: ['Satisfactory', 'Unsatisfactory'], req: 'M' },
      ]},
      approvalsHydro(),
    ],
  },

  // ──────────────────── BLASTING & PAINTING ────────────────────
  blasting: {
    key: 'blasting', code: 'BPR', title: 'Blasting & Painting Report',
    deliverable: 'Painting', formNo: 'F.380.WS-3.041',
    sections: [
      headerSection,
      { id: 'prep', title: 'Surface Preparation', fields: [
        { id: 'blastDate', label: 'Blasting Date', type: 'date', req: 'M' },
        { id: 'surfacePrep', label: 'Surface Preparation', type: 'text', default: 'SA 2½', half: true },
        { id: 'sspc', label: 'SSPC SP', type: 'text', default: 'SP 10', half: true },
        { id: 'abrasive', label: 'Abrasive Type / Size', type: 'text', default: 'Steel Grit 40 Mesh' },
        { id: 'anchorProfile', label: 'Anchor Profile', type: 'text', default: 'N/A', half: true },
        { id: 'humidityStd', label: 'Humidity Std.', type: 'readonly', default: '≤ 85%', half: true },
      ]},
      { id: 'env', title: 'Environmental Check', subtitle: 'RH & dew point computed from dry/wet bulb', fields: [
        { id: 'dryTemp', label: 'Dry Temp', type: 'number', unit: '°C', req: 'M', half: true },
        { id: 'wetTemp', label: 'Wet Temp', type: 'number', unit: '°C', req: 'M', half: true, hint: 'Must be ≤ Dry Temp' },
        { id: 'matlTemp', label: 'Material Temp', type: 'number', unit: '°C', half: true, hint: 'Must be ≥ Dew Point + 3°C' },
        { id: 'humidityRH', label: 'Humidity RH', type: 'computed', half: true, compute: (v) => { const rh = MR.rh(v.dryTemp, v.wetTemp); return rh == null ? '–' : rh + '%' } },
        { id: 'dewPoint', label: 'Dew Point', type: 'computed', half: true, compute: (v) => { const dp = MR.dewPoint(v.dryTemp, v.wetTemp); return dp == null ? '–' : dp + ' °C' } },
        { id: 'prepResult', label: 'Surface Prep Result', type: 'segmented', options: ['Acc', 'Reject'], req: 'M' },
      ]},
      { id: 'coating', title: 'Coating Preparation', fields: [
        { id: 'coatingPrep', label: 'Coating Prep.', type: 'segmented', options: ['Primer', 'Second', 'Top'], req: 'M' },
        { id: 'paintDesc', label: 'Paint Desc.', type: 'text', placeholder: 'e.g. 2-pack epoxy primer', req: 'M' },
        { id: 'thinner', label: 'Thinner', type: 'text', placeholder: 'e.g. epoxy thinner' },
        { id: 'batchPaint', label: 'Batch — Paint', type: 'text', half: true },
        { id: 'batchThinner', label: 'Batch — Thinner', type: 'text', half: true },
      ]},
      { id: 'dft', title: 'DFT Record', subtitle: '5 sampling points per 1 m² — Avg & status computed', type: 'dft' },
      { id: 'photos', title: 'Photo Evidence', type: 'photos' },
      { id: 'result', title: 'Final Summary', fields: [
        { id: 'finalStatus', label: 'Final Coating Status', type: 'segmented', options: ['Accept', 'Reject'], req: 'M' },
        { id: 'ncr', label: 'Non-Conformance Notes (NCR)', type: 'textarea', reqIf: { field: 'finalStatus', eq: 'Reject' } },
      ]},
      approvals(['Inspector', 'QC Supervisor / Engineering']),
    ],
  },

  // ───────────────────────────── MT ─────────────────────────────
  // ─────────────────── DOCUMENT RECORDS ───────────────────
  itp: recordForm({
    key: 'itp', code: 'ITP', title: 'Inspection & Test Plan Record',
    deliverable: 'ITP', formNo: 'F.380.WS-3.001',
    refLabel: 'ITP number',
    issuerLabel: 'Approved by',
    issuerHint: 'Who agreed the plan — QC Engineering, the client, or both.',
    evidence: 'Scan or photograph every page of the signed plan. This is what the deliverable is closed on.',
  }),
  ptr: recordForm({
    key: 'ptr', code: 'PTR', title: 'Performance Test Record',
    deliverable: 'PTR', formNo: 'F.380.WS-3.070',
    refLabel: 'Test report number',
    issuerLabel: 'Tested by',
    issuerHint: 'The party that ran the test — this shop, the client, or a test house.',
    evidence: 'Scan or photograph the signed test report, including any chart or curve it refers to.',
    verdict: true,
  }),
  irn: recordForm({
    key: 'irn', code: 'IRN', title: 'Inspection Release Note Record',
    deliverable: 'IRN', formNo: 'F.380.WS-3.090',
    refLabel: 'Release note number',
    issuerLabel: 'Released by',
    issuerHint: 'Who signed the release — the client, their inspector, or a third party.',
    evidence: 'Scan or photograph the signed release note.',
  }),

  mt: ndeForm({
    key: 'mt', code: 'MT', title: 'Magnetic Particle Test (MT) Report', formNo: 'F.380.WS-3.052',
    acc: (v) => v.code === 'ASME Sec. V & VIII' ? 'ASME VIII Div.1 App. 6' : 'AWS D1.1 Clause 8',
    procedure: 'QCP-04-04 Rev 0',
    midSections: [
      { id: 'lighting', title: 'Lighting', fields: [
        { id: 'lightEquip', label: 'Lighting Equipment', type: 'text', placeholder: 'e.g. LED Floodlight 50W' },
        { id: 'lightmeter', label: 'Lightmeter', type: 'select', half: true, options: (v, keep) => optionsFor('lightmeter', { on: v.inspDate, keep }) },
        { id: 'lightIntensity', label: 'Light Intensity', type: 'number', unit: 'lux', half: true, req: 'M', hint: 'Min. 1000 lux' },
      ]},
      /* One control shape for every pick on this section.

         There were three: a segmented group, a row of loose chips, and
         free text — so Type of Particle and Surface Preparation looked
         like a different kind of question from MT Equipment directly
         above them, and a chip row with nothing chosen looked the same
         as one where the inspector had not reached it yet. They are all
         segmented groups now. Surface Preparation and Scope of Exam take
         more than one answer, which a chip row could never record.

         The three consumables are a thing and the batch it came from.
         They were one box each, so "Magnaflux 7HF 008A103" went in
         however the person felt that day and no data book could read it
         back. Two boxes now, joined into the same field id the report
         already prints. Particle Brand is gone with them: it was the
         first half of Particle Desc. under another name. */
      { id: 'equipment', title: 'Equipment & Technique', fields: [
        { id: 'mtEquipment', label: 'MT Equipment', type: 'segmented', options: (v) => methodsFor('mtEquipment', v.inspDate), req: 'M' },
        { id: 'equipId', label: 'Equipment ID / Serial No.', type: 'text', half: true },
        { id: 'currentType', label: 'Type of Current', type: 'segmented', options: ['AC', 'HWDC-HWAC', 'Other'], half: true },
        { id: 'particle', label: 'Type of Particle', type: 'segmented', options: ['Wet (WPC2/7HF)', 'Dry', 'Visible, Wet'] },
        { id: 'particleApp', label: 'Particle Application', type: 'segmented', options: ['Spray', 'Other'], half: true },
        { id: 'method', label: 'Method', type: 'segmented', options: ['Continuous', 'Residual', 'Other'], half: true },
        { id: 'particleDesc', label: 'Particle Desc. & Batch', type: 'pair', parts: [
          { id: 'particleType', label: 'Type / brand', placeholder: 'Magnaflux 7HF' },
          { id: 'particleBatch', label: 'Batch', placeholder: '008A103' },
        ]},
        { id: 'whiteContrast', label: 'White Contrast & Batch', type: 'pair', parts: [
          { id: 'whiteContrastType', label: 'Type / brand', placeholder: 'WCP-2' },
          { id: 'whiteContrastBatch', label: 'Batch', placeholder: '008A009' },
        ]},
        { id: 'cleanerBatch', label: 'Cleaner & Batch', type: 'pair', parts: [
          { id: 'cleanerType', label: 'Type / brand', placeholder: 'SKC-S' },
          { id: 'cleanerBatchNo', label: 'Batch', placeholder: '008A100' },
        ]},
        { id: 'magTechnique', label: 'Magnetizing Technique', type: 'text',
          default: 'Minimum twice in each area, right angle each other' },
        { id: 'surfacePreparation', label: 'Surface Preparation', type: 'multi',
          options: ['As Welded', 'Machining', 'As Grounded', 'Solvent Wipe'],
          hint: 'More than one may apply.' },
        { id: 'stage', label: 'Stage of Exam', type: 'segmented', options: ['After Welding', 'After Hydrostatic', 'Other'] },
        { id: 'weldingProcess', label: 'Welding Process', type: 'segmented', options: ['GTAW', 'SMAW', 'FCAW', 'Other'] },
        { id: 'scope', label: 'Scope of Exam.', type: 'multi',
          options: ['Base Metal', 'Edge Prep.', 'Weld Part', 'Back Chipping', 'Repair Weld', 'Other'],
          hint: 'More than one may apply.' },
      ]},
    ],
    columns: [
      /* Material is not here. It is Material Spec in General, one per
         report, and repeating it on every row of the result table asked
         the inspector for the same fact as many times as there were
         welds. */
      { id: 'partId', label: 'Part / Welding ID', type: 'text', req: 'M' },
      { id: 'weldNo', label: 'Weld No.', type: 'text', half: true },
      { id: 'thickness', label: 'Thickness', type: 'number', unit: 'mm', half: true },
      { id: 'judgement', label: 'Judgement', type: 'segmented', options: ['Acc', 'Reject'] },
      { id: 'discontinuity', label: 'Type of Discontinuity', type: 'text', rejOnly: true },
      { id: 'remark', label: 'Remark', type: 'text' },
    ],
  }),

  // ───────────────────────────── PT ─────────────────────────────
  pt: ndeForm({
    key: 'pt', code: 'PT', title: 'Liquid Penetrant Test (PT) Report', formNo: 'F.380.WS-3.053',
    acc: (v) => v.code === 'ASME Sec. V & VIII' ? 'ASME VIII Div.1 App. 8' : 'AWS D1.1 Clause 8',
    procedure: 'QCP-04-05 Rev 0',
    midSections: [
      { id: 'lighting', title: 'Lighting', fields: [
        { id: 'lightEquip', label: 'Lighting Equipment', type: 'text' },
        { id: 'lightmeter', label: 'Lightmeter', type: 'select', half: true, options: (v, keep) => optionsFor('lightmeter', { on: v.inspDate, keep }) },
        { id: 'lightIntensity', label: 'Light Intensity', type: 'number', unit: 'lux', half: true, req: 'M', hint: 'Min. 1000 lux' },
      ]},
      { id: 'system', title: 'Penetrant System', fields: [
        { id: 'penetrantMethod', label: 'Penetrant', type: 'choice', options: ['Water Washable', 'Post Emulsifier', 'Solvent Removeable (SKL-SP2)', 'Other'], req: 'M' },
        { id: 'penetrantType', label: 'Penetrant Type', type: 'segmented', options: ['Visible', 'Fluorescent'], half: true },
        { id: 'dwellTime', label: 'Dwell Time', type: 'timer', unit: 'min', default: '10', req: 'M', hint: 'Min. 10 minutes' },
        { id: 'applicationBy', label: 'Application by', type: 'segmented', options: ['Brushing', 'Other'], half: true },
        { id: 'appTemp', label: 'Application Temp.', type: 'number', unit: '°C', half: true, hint: 'Valid 5–52 °C (ASME V)' },
        { id: 'developer', label: 'Developer', type: 'readonly', default: 'SKD-S2', half: true },
        { id: 'developerType', label: 'Developer Type', type: 'segmented', options: ['Dry', 'Aqueous', 'Non Aqueous'] },
        { id: 'developingTime', label: 'Developing Time', type: 'number', unit: 'min', half: true, hint: 'Min. 10 min' },
        { id: 'interpretationTime', label: 'Interpretation Time', type: 'number', unit: 'min', half: true, hint: '10–30 min' },
        { id: 'cleaner', label: 'Cleaner', type: 'segmented', options: ['SKC-S', 'Other'], half: true },
        { id: 'stage', label: 'Stage of Exam', type: 'segmented', options: ['After Welding', 'After Hydrostatic', 'Other'] },
        { id: 'weldingProcess', label: 'Welding Process', type: 'segmented', options: ['GTAW', 'SMAW', 'FCAW', 'Other'] },
        { id: 'scope', label: 'Scope of Exam.', type: 'choice', options: ['Base Metal', 'Edge Prep.', 'Weld Part', 'Back Chipping', 'Repair Weld', 'Other'] },
      ]},
    ],
    columns: [
      { id: 'partId', label: 'Part / Welding ID', type: 'text', req: 'M' },
      { id: 'material', label: 'Material', type: 'text', half: true },
      { id: 'thickness', label: 'Thickness', type: 'number', unit: 'mm', half: true },
      { id: 'judgement', label: 'Judgement', type: 'segmented', options: ['Acc', 'Reject'] },
      { id: 'discontinuity', label: 'Type of Discontinuity', type: 'text', rejOnly: true },
      { id: 'remark', label: 'Remark', type: 'text' },
    ],
  }),

  // ───────────────────────────── UT ─────────────────────────────
  ut: ndeForm({
    key: 'ut', code: 'UT', title: 'Ultrasonic Test (UT) Report', formNo: 'F.380.WS-3.054',
    acc: (v) => v.code === 'ASME Sec. V & VIII' ? 'ASME VIII Div.1 App. 12' : 'AWS D1.1 Clause 8 (Table 8.2)',
    procedure: 'W.380.WS-3.009',
    midSections: [
      { id: 'instrument', title: 'UT Instrument', fields: [
        { id: 'instrument', label: 'UT Instrument', type: 'text', placeholder: 'e.g. Olympus EPOCH 650' },
        { id: 'model', label: 'Model', type: 'text', half: true },
        { id: 'serialNo', label: 'Serial No.', type: 'text', half: true },
        { id: 'cable', label: 'Cable Type & Length', type: 'text', half: true },
        { id: 'couplant', label: 'Couplant', type: 'text', default: 'Glycerin', half: true },
        { id: 'technique', label: 'Examination Technique', type: 'choice', options: ['Contact — Straight Beam', 'Contact — Angle Beam', 'Straight Beam', 'Angle Beam'] },
      ]},
      { id: 'scanning', title: 'Scanning', fields: [
        { id: 'scanSurface', label: 'Scanning Surface', type: 'choice', options: ['Both Side of Weld', 'One Side of Weld', 'From A', 'From B', 'From C'] },
        { id: 'scanTechnique', label: 'Scanning Technique', type: 'choice', options: ['Half to Full Skip Distance', 'Half Skip Distance', 'Other'] },
        { id: 'scanDirection', label: 'Scanning Direction', type: 'choice', options: ['Swivel', 'Right angle to weld axis', 'Essentially parallel to weld axis'] },
        { id: 'lengthInd', label: 'Length Indication', type: 'segmented', options: ['6 dB Drop', '14 dB Drop'], half: true },
        { id: 'heightInd', label: 'Height Indication', type: 'segmented', options: ['6 dB Drop', '14 dB Drop'], half: true },
      ]},
      { id: 'calibration', title: 'Calibration', fields: [
        { id: 'suAngle', label: 'Search Unit — Angle', type: 'segmented', options: ['0°', '45°', '60°', '70°'], half: true },
        { id: 'suSerial', label: 'Search Unit — Serial', type: 'text', half: true },
        { id: 'suFreq', label: 'Frequency', type: 'number', unit: 'MHz', half: true },
        { id: 'suSize', label: 'Size', type: 'text', half: true },
        { id: 'blockId', label: 'Block ID', type: 'segmented', options: ['V1', 'V2', 'BCB', 'Nozzle'], half: true },
        { id: 'hole', label: 'Hole', type: 'text', half: true },
        { id: 'amplitude', label: 'Amplitude', type: 'text', half: true },
        { id: 'refReflector', label: 'Reference Reflector', type: 'text', half: true },
        { id: 'refLevel', label: 'Reference Level', type: 'number', unit: 'dB', half: true },
        { id: 'scanLevel', label: 'Scanning Level', type: 'number', unit: 'dB', half: true, hint: 'Reference + min. 6 dB' },
        { id: 'testRange', label: 'Test Range', type: 'number', unit: 'mm', half: true },
      ]},
    ],
    columns: [
      { id: 'partId', label: 'Part / Welding ID', type: 'text', req: 'M' },
      { id: 'thickness', label: 'Thickness', type: 'number', unit: 'mm', half: true },
      { id: 'soundpath', label: 'Soundpath', type: 'number', unit: 'mm', half: true, rejOnly: true },
      { id: 'amplitude', label: 'Amplitude', type: 'text', unit: '%FSH', half: true, rejOnly: true },
      { id: 'length', label: 'Length', type: 'number', unit: 'mm', half: true, rejOnly: true },
      { id: 'depth', label: 'Depth', type: 'number', unit: 'mm', half: true, rejOnly: true },
      { id: 'judgement', label: 'Result', type: 'segmented', options: ['Acc', 'Rej'] },
      { id: 'discontinuity', label: 'Type of Discontinuity', type: 'text', rejOnly: true },
      { id: 'remark', label: 'Remark', type: 'text' },
    ],
    rejValue: 'Rej',
    extraSections: [
      { id: 'notes', title: 'Notes', fields: [{ id: 'notes', label: 'Notes', type: 'textarea', placeholder: 'General notes' }] },
    ],
  }),

  // ─────────────────────── VISUAL & GENBA ───────────────────────
  visual: {
    key: 'visual', code: 'VG', title: 'Visual & Genba Inspection Report',
    deliverable: 'Pre-Shipment', formNo: 'F.380.WS-3.060',
    sections: [
      headerSection,
      { id: 'general', title: 'General', fields: [
        { id: 'inspType', label: 'Inspection Type', type: 'segmented', options: ['Visual', 'Genba', 'Pre-Shipment'], default: 'Visual', req: 'M' },
        { id: 'standard', label: 'Reference / Standard', type: 'text', placeholder: 'e.g. drawing, checklist ref' },
      ]},
      { id: 'results', title: 'Inspection Points', subtitle: 'One row per point — defect type required on NG', type: 'results',
        judgeKey: 'judgement', accValue: 'OK', rejValue: 'NG',
        columns: [
          { id: 'point', label: 'Inspection Point', type: 'text', req: 'M', placeholder: 'e.g. Frame A, Weld Joint B-1' },
          { id: 'welderId', label: 'Welder ID', type: 'text', half: true },
          { id: 'description', label: 'Description', type: 'text' },
          { id: 'judgement', label: 'Result', type: 'segmented', options: ['OK', 'NG'] },
          { id: 'defectType', label: 'Defect Type', type: 'text', rejOnly: true },
          { id: 'remark', label: 'Note', type: 'text' },
        ]},
      { id: 'photos', title: 'Photo Evidence', subtitle: 'Min. 1 photo per inspection point', type: 'photos' },
      { id: 'result', title: 'Summary', fields: [
        { id: 'finalStatus', label: 'Final Inspection Status', type: 'computed', compute: (v, rep) => resultsHasRej(rep, 'NG') ? 'Reject' : 'Accept' },
        { id: 'ncr', label: 'Non-Conformance Notes (NCR)', type: 'textarea', reqIf: { field: 'finalStatus', eq: 'Reject' } },
      ]},
      approvals(['Inspector', 'QC Supervisor / Engineering']),
    ],
  },

  // ───────────────────────── DIMENSIONAL ─────────────────────────
  dimensional: {
    key: 'dimensional', code: 'DIM', title: 'Dimensional Inspection Report',
    deliverable: 'Dimension Report', formNo: 'F.380.WS-3.061',
    sections: [
      headerSection,
      /* The map the measurements were taken from.

         A dimensional report is a page of numbers against letters, and
         the letters mean nothing without the drawing they are balloon-ed
         on. That drawing lived on paper next to the inspector and never
         reached the report, so a reader years later had six numbers and
         no way to know where on the unit any of them was taken. It goes
         above the table, at the size it has to be read at, because it is
         what the table is read against. */
      { id: 'drawing', title: 'Measurement Point Map',
        subtitle: 'The marked-up drawing the table refers to — balloon each point A, B, C…',
        fields: [
          { id: 'drawingNo', label: 'Drawing No. / Rev', type: 'text', req: 'M', half: true },
          { id: 'viewName', label: 'View / area shown', type: 'text', half: true, placeholder: 'e.g. TOP CLOSURE' },
          { id: 'inspStage', label: 'Inspection stage', type: 'text', half: true, placeholder: 'e.g. AFTER WELDING' },
          { id: 'tagNumber', label: 'Tag number', type: 'text', half: true, placeholder: 'N/A if none' },
          { id: 'drawingFile', label: 'Point map', type: 'photos-inline',
            hint: 'Photograph or export the marked drawing. Each balloon letter is a row below.' },
        ]},
      { id: 'results', title: 'Measurement Grid', subtitle: 'Actual outside Min–Max is rejected automatically', type: 'results',
        judgeKey: 'rowStatus', accValue: 'Accept', rejValue: 'Reject', autoJudge: 'dim',
        columns: [
          /* The balloon letter leads: it is what ties the row to the map
             above it, and it is the first thing anybody reading the two
             together looks for. */
          { id: 'itemNo', label: 'Dim.', type: 'text', req: 'M', half: true, placeholder: 'A' },
          { id: 'description', label: 'Description', type: 'text', req: 'M', half: true, placeholder: 'e.g. Overall Length' },
          { id: 'nominal', label: 'Nominal', type: 'number', unit: 'mm', half: true },
          { id: 'min', label: 'Min', type: 'number', unit: 'mm', half: true, req: 'M', placeholder: 'lower limit' },
          { id: 'max', label: 'Max', type: 'number', unit: 'mm', half: true, req: 'M', placeholder: 'upper limit' },
          { id: 'actual', label: 'Actual', type: 'number', unit: 'mm', half: true, req: 'M' },
          { id: 'note', label: 'Note', type: 'text' },
        ]},
      { id: 'photos', title: 'Photo Evidence', type: 'photos' },
      { id: 'result', title: 'Summary', fields: [
        { id: 'finalStatus', label: 'Final Dimensional Status', type: 'computed', compute: (v, rep) => dimHasRej(rep) ? 'Reject' : 'Accept' },
        { id: 'ncr', label: 'Non-Conformance Notes (NCR)', type: 'textarea', reqIf: { field: 'finalStatus', eq: 'Reject' } },
      ]},
      approvals(['Inspector', 'QC Supervisor / Engineering']),
    ],
  },
}

// ── helpers used by computed fields (operate on the report object) ──
function recHasFail(rep) {
  return (rep?.readings || []).some((r) => /fail|leak|drop/i.test(r.remark || ''))
}
function resultsHasRej(rep, rejValue) {
  return (rep?.results || []).some((r) => r.judgement === rejValue)
}
function dimHasRej(rep) {
  return (rep?.results || []).some((r) => dimRowStatus(r) === 'Reject')
}
/* The measured limits of a dimension row.

   Min and max are the limits themselves, in millimetres, as the drawing
   states them — an inspector reads those off the drawing and does not
   have to do the ± arithmetic in their head. Reports written before this
   change carry a tolerance string around the nominal instead, so that
   shape is still resolved rather than left unjudged. */
export function dimLimits(row) {
  const lo = parseFloat(row.min), hi = parseFloat(row.max)
  if (!isNaN(lo) || !isNaN(hi)) return { lo: isNaN(lo) ? null : lo, hi: isNaN(hi) ? null : hi }
  const n = parseFloat(row.nominal)
  const tol = String(row.tolerance || '').trim()
  let m
  if (isNaN(n) || !tol) return { lo: null, hi: null }
  if ((m = tol.match(/^±?\s*(\d+(?:\.\d+)?)$/))) return { lo: n - +m[1], hi: n + +m[1] }
  if ((m = tol.match(/^\+\s*(\d+(?:\.\d+)?)\s*\/\s*-\s*(\d+(?:\.\d+)?)$/))) return { lo: n - +m[2], hi: n + +m[1] }
  return { lo: null, hi: null }
}

/* How far outside the limits the measurement fell, or null when it is
   inside them. Named rather than just flagged: "1.40 mm over max" is
   what an inspector has to write on the NCR anyway. */
export function dimBreach(row) {
  const a = parseFloat(row.actual)
  if (isNaN(a)) return null
  const { lo, hi } = dimLimits(row)
  if (lo != null && a < lo) return { side: 'min', limit: lo, by: +(lo - a).toFixed(3) }
  if (hi != null && a > hi) return { side: 'max', limit: hi, by: +(a - hi).toFixed(3) }
  return null
}

// Auto-judgement: a measurement outside its limits is rejected outright,
// with no one having to decide it.
export function dimRowStatus(row) {
  const a = parseFloat(row.actual)
  if (isNaN(a)) return ''
  const { lo, hi } = dimLimits(row)
  if (lo == null && hi == null) return ''
  return dimBreach(row) ? 'Reject' : 'Accept'
}
export function dimDeviation(row) {
  const n = parseFloat(row.nominal), a = parseFloat(row.actual)
  return isNaN(n) || isNaN(a) ? '' : (a - n).toFixed(2)
}

// Hydrotest approvals: inspector + QC + client, optional 4th third-party
function approvalsHydro() {
  return {
    id: 'approvals', title: 'Approvals',
    fields: [
      { id: 'signInspector', label: 'Inspector', type: 'sign', req: 'M' },
      { id: 'signQc', label: 'QC Supervisor / Engineering', type: 'sign', req: 'M' },
      { id: 'signClient', label: 'Client / Customer', type: 'sign', req: 'O' },
      { id: 'signThird', label: 'Third Party (LRQA)', type: 'sign', req: 'O', showIf: (v) => v.thirdParty === 'Yes' },
    ],
  }
}

/* Document records: ITP, PTR and IRN.

   These three deliverables are not inspections this app performs. An
   Inspection & Test Plan is agreed before the work, a Performance Test
   Report can come from a test house, an Inspection Release Note is
   signed off against the finished unit — the document exists, on paper,
   somewhere else.

   They used to carry `form: null`, which meant the register said
   "tracked manually" and the row could not be opened. The only way to
   close one was an admin override, and the status engine is explicit
   that an override is a deliberate statement rather than a document to
   bind. So two of every nine deliverables could only ever be closed on
   somebody's word.

   What closes one now is a record of the document: its number, the date
   it was issued, who issued it, and the signed pages themselves. That
   is a report like any other — same lifecycle, same second-person
   approval, same issue numbering, and it binds into the data book —
   which is why it is a schema here rather than a new store.

   `kind: 'record'` is what tells the rest of the app this is a document
   on file rather than a test we ran: no statement-of-result sheet is
   printed for it, and no verdict is claimed unless the document itself
   carries one. */
function recordForm({ key, code, title, deliverable, formNo, refLabel, issuerLabel, issuerHint, evidence, verdict = false }) {
  return {
    key, code, title, deliverable, formNo, kind: 'record', verdict,
    sections: [
      recordHeader,
      { id: 'document', title: 'The document', subtitle: 'What is being filed against this unit — taken off the document itself', fields: [
        { id: 'docRef', label: refLabel, type: 'text', req: 'M', placeholder: 'As printed on the document' },
        { id: 'issuedOn', label: 'Date issued', type: 'date', req: 'M', half: true },
        { id: 'rev', label: 'Revision', type: 'text', half: true, placeholder: 'Rev. 0 if none' },
        { id: 'issuedBy', label: issuerLabel, type: 'text', req: 'M', hint: issuerHint },
        { id: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Anything a reader of the data book would need — scope covered, exclusions, related NCR.' },
      ]},
      ...(verdict ? [{ id: 'result', title: 'Result', subtitle: 'What the document itself concludes — not a judgement made here', fields: [
        { id: 'finalStatus', label: 'Result recorded on the document', type: 'segmented', options: ['Accept', 'Reject'], req: 'M' },
        { id: 'ncr', label: 'Non-Conformance Notes (NCR)', type: 'textarea', reqIf: { field: 'finalStatus', eq: 'Reject' } },
      ]}] : []),
      /* Required, and that is the point of the whole change: without a
         page held here, the deliverable is closed on a reference number
         nobody can check. */
      { id: 'photos', title: 'The signed document', subtitle: evidence, type: 'photos', req: true },
      approvals(['Filed by', 'QC Supervisor / Engineering']),
    ],
  }
}

// NDE form factory (MT/PT/UT share the same skeleton)
function ndeForm({ key, code, title, formNo, acc, procedure, midSections, columns, rejValue = 'Reject', extraSections = [] }) {
  return {
    key, code, title, deliverable: 'NDE Report', formNo,
    sections: [
      headerSection,
      { id: 'general', title: 'General', fields: [
        { id: 'code', label: 'Applicable Code', type: 'toggle', options: ['AWS D1.1', 'ASME Sec. V & VIII'], default: 'AWS D1.1', req: 'M',
          hint: 'AWS D1.1 = structural welds. ASME = pressure parts. Only the acceptance reference changes.' },
        { id: 'acceptance', label: 'Acceptance Criteria', type: 'computed', compute: acc },
        { id: 'procedure', label: 'Procedure', type: 'readonly', default: procedure, half: true },
        { id: 'materialSpec', label: 'Material Spec', type: 'text', half: true },
        { id: 'ncrRef', label: 'NCR Ref No.', type: 'text', half: true, placeholder: 'N/A if none' },
      ]},
      ...midSections,
      /* The map the result table points at.

         A row saying "weld W-14, reject" is only findable on the unit if
         somebody can see where W-14 is. That drawing existed on paper
         and never reached the report, so the table named locations
         against nothing. It goes in front of the table, because it is
         what the table is read against. */
      { id: 'ndemap', title: 'NDE Map', subtitle: 'The marked-up drawing the result table refers to — photograph or export it', fields: [
        { id: 'ndeMapRef', label: 'Drawing / map reference', type: 'text', half: true, placeholder: 'e.g. DWG-IST-4131-R1 sheet 2' },
        { id: 'ndeMapNote', label: 'How the parts are numbered', type: 'text', half: true, placeholder: 'e.g. W-01 clockwise from manway' },
        { id: 'ndeMap', label: 'NDE map', type: 'photos-inline' },
      ]},
      { id: 'results', title: 'Result Table', subtitle: 'Part IDs refer to the NDE map above · evidence required on reject', type: 'results',
        judgeKey: 'judgement', accValue: 'Acc', rejValue, columns },
      ...extraSections,
      { id: 'photos', title: 'Photo Evidence', subtitle: 'Sketch of discontinuity required on reject', type: 'photos' },
      approvals(['Inspector', 'QC Supervisor / Engineering', 'Client / Customer']),
    ],
  }
}
