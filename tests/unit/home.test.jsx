import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ROLES } from '../../src/lib/constants.js'

const model = vi.hoisted(() => ({ jobs: [], context: {}, navigate: vi.fn() }))
vi.mock('../../src/App.jsx', () => ({ useApp: () => model.context, navigate: model.navigate }))
vi.mock('../../src/lib/jobOrders.js', () => ({ allJobs: () => model.jobs }))
vi.mock('../../src/data/seedReports.js', () => ({ seedReports: () => [], SEED_COUNTERS: {}, SEED_STAMP: 'home-test' }))
vi.mock('../../src/lib/sticky.js', () => ({ useStuck: () => [{ current: null }, false] }))
import Home from '../../src/components/Home.jsx'
import JobsPage from '../../src/components/JobsPage.jsx'
import ReportLauncher from '../../src/components/ReportLauncher.jsx'
import Reports from '../../src/components/Reports.jsx'

const unit = (jobNo, required) => ({ jobNo, required, deliverables: {}, productDesc: 'Water truck', customerName: 'Customer A', dateTarget: '2099-12-01' })
const record = (id, status, extra = {}) => ({ id, reportId: `DIM/A/${id}`, jobNo: 'A', formKey: 'dimensional', deliverable: 'Dimension Report', inspector: 'Inspector One', values: {}, status, updatedAt: '2026-09-08T10:00:00Z', ...extra })
const seed = (records) => localStorage.setItem('qc.reports', JSON.stringify(records))
function setup(role = 'inspector', records = []) {
  model.jobs = [unit('A', ['PDI', 'Dimension Report']), unit('B', ['Pre-Shipment'])]
  const names = { admin: 'QA Lead', engineer: 'Quality Engineer', supervisor: 'QC Supervisor', viewer: 'Management Viewer', inspector: 'Inspector One' }
  model.context = { jobs: model.jobs, role: ROLES[role], session: { name: names[role], role }, tick: 0, notify: vi.fn(), refresh: vi.fn() }
  localStorage.setItem('qc.seeded.v3', '1')
  localStorage.setItem('qc.storeVersion', '4')
  localStorage.setItem('qc.seedStamp', 'home-test')
  seed(records)
}

beforeEach(() => {
  // jsdom does not implement the native dialog top layer. These shims
  // exercise our lifecycle/entry handlers, not browser focus containment.
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', '') } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open') } })
  setup()
})
afterEach(cleanup)

describe('Home working surface', () => {
  it('keeps viewer actions read-only while exposing the real registers', () => {
    setup('viewer', [record('01', 'draft')])
    render(<Home />)
    expect(screen.queryByRole('button', { name: 'New report' })).toBeNull()
    expect(screen.queryByText('Report shortcuts')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Job overview' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Approved reports' })).toBeTruthy()
    expect(screen.getAllByRole('link', { name: 'View reports', exact: true }).length).toBeGreaterThan(0)
  })

  it('shows own returned work before drafts and does not include another inspector’s work', () => {
    seed([record('01', 'draft'), record('02', 'returned', { returnNote: 'Add the drawing revision' }), record('03', 'returned', { inspector: 'Inspector Two' })])
    render(<Home />)
    const section = screen.getByRole('region', { name: 'Your work' })
    expect(within(section).getAllByRole('link', { name: /Open report/ }).map((a) => a.getAttribute('aria-label'))).toEqual(['Open report DIM/A/02', 'Open report DIM/A/01'])
    expect(within(section).getByText('Add the drawing revision')).toBeTruthy()
  })

  it('labels a lead’s own submission without offering approval on Home', () => {
    setup('admin', [record('01', 'submitted', { inspector: 'QA Lead' })])
    render(<Home />)
    expect(screen.getByText(/Submitted by you/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Approve', exact: true })).toBeNull()
    expect(screen.getByRole('link', { name: 'Review reports', exact: true }).getAttribute('href')).toBe('#/reports?f=submitted&scope=review')
  })

  it('shows a read failure instead of fabricated zero readings', () => {
    localStorage.setItem('qc.reports', '{broken json')
    localStorage.removeItem('qc.seeded.v3')
    render(<Home />)
    expect(screen.getByRole('alert').textContent).toContain('Could not read reports')
    expect(screen.queryByRole('region', { name: 'QC overview' })).toBeNull()
    expect(localStorage.getItem('qc.reports')).toBe('{broken json')
  })

  it('treats no applicable scope as a missing denominator', () => {
    setup('viewer')
    model.jobs = [unit('A', [])]; model.context.jobs = model.jobs
    render(<Home />)
    expect(screen.getByText('No required deliverables')).toBeTruthy()
    expect(screen.getByRole('region', { name: 'QC overview' }).textContent).toContain('—')
  })

  it('shows the exact returned and voided lifecycle labels in recent updates', () => {
    seed([record('01', 'returned'), record('02', 'voided')])
    render(<Home />)
    const recent = screen.getByRole('region', { name: 'Recent updates' })
    expect(within(recent).getByText(/Sent back/)).toBeTruthy()
    expect(within(recent).getByText(/Voided/)).toBeTruthy()
    expect(within(recent).queryByText('Draft')).toBeNull()
  })

  it('opens all form choices and restores focus to the initiating control on cancel', async () => {
    const user = userEvent.setup()
    render(<Home />)
    const trigger = screen.getByRole('button', { name: 'New report', exact: true })
    await user.click(trigger)
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('button', { name: /ITP Inspection & Test Plan/ })).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: /PTR Performance Test/ })).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: /IRN Inspection Release Note/ })).toBeTruthy()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('clears old search state when a home metric opens Monitoring', () => {
    sessionStorage.setItem('qc.jobs.view.v1', JSON.stringify({ q: 'does-not-exist', states: ['done'], page: 4 }))
    render(<JobsPage resetView state="inprogress,overdue,notstarted" />)
    expect(screen.getByRole('searchbox').value).toBe('')
    expect(screen.queryByText(/No job matches/)).toBeNull()
  })

  it.each(['engineer', 'supervisor'])('scopes the %s review queue to its actual approval authority', (role) => {
    setup(role, [record('tech', 'submitted'), record('peer', 'submitted', { inspector: role === 'engineer' ? 'QC Supervisor' : 'Quality Engineer' }), record('head', 'submitted', { inspector: 'QA Lead' })])
    render(<Home />)
    const queue = screen.getByRole('region', { name: role === 'engineer' ? 'Your review queue' : 'QC review queue' })
    expect(within(queue).getAllByRole('link', { name: /Open report/ }).map((a) => a.getAttribute('aria-label'))).toEqual(['Open report DIM/A/tech'])
    expect(screen.getByRole('link', { name: /For your review/ }).textContent).toContain('1')
  })

  it('caps the personal queue at five and links to the same scoped register', () => {
    seed(Array.from({ length: 8 }, (_, i) => record(String(i), 'draft')))
    render(<Home />)
    const queue = screen.getByRole('region', { name: 'Your work' })
    expect(within(queue).getAllByRole('link', { name: /Open report/ })).toHaveLength(5)
    expect(within(queue).getByRole('link', { name: 'View all your work' }).getAttribute('href')).toBe('#/reports?f=all&scope=work')
  })

  it('tracks only the inspector’s submitted and approved reports', () => {
    seed([record('mine', 'submitted'), record('approved', 'approved'), record('other', 'submitted', { inspector: 'Inspector Two' })])
    render(<Home />)
    const tracking = screen.getByRole('region', { name: 'Your submitted reports' })
    expect(within(tracking).getAllByRole('link', { name: /Open report/ }).map((a) => a.getAttribute('aria-label'))).toEqual(['Open report DIM/A/mine'])
    fireEvent.click(within(tracking).getByRole('button', { name: 'Approved' }))
    expect(within(tracking).getByRole('link', { name: 'Open report DIM/A/approved' })).toBeTruthy()
  })

  it('gives Head document readiness and Supervisor inspector workload', () => {
    setup('admin'); const view = render(<Home />)
    expect(screen.getByRole('heading', { name: 'Document readiness' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Inspector documents' })).toBeTruthy()
    setup('supervisor'); view.rerender(<Home />)
    expect(screen.queryByRole('heading', { name: 'Document readiness' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Inspector documents' })).toBeTruthy()
  })

  it('keeps personal report counts and CSV scope aligned at the destination', () => {
    seed([record('mine', 'returned'), record('other', 'returned', { inspector: 'Inspector Two' }), record('done', 'approved')])
    render(<Reports query={{ f: 'all', scope: 'work' }} />)
    expect(screen.getByRole('region', { name: 'Report scope' }).textContent).toContain('Your returned reports and drafts')
    expect(screen.getByRole('tab', { name: /^All/ }).textContent).toBe('All1')
    expect(screen.getByRole('button', { name: /DIM\/A\/mine/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /DIM\/A\/other/ })).toBeNull()
  })

  it('preserves review eligibility and submission order in the full register', () => {
    setup('engineer', [record('late', 'submitted', { submittedAt: '2026-09-09T00:00:00Z' }), record('old', 'submitted', { submittedAt: '2026-09-01T00:00:00Z' }), record('peer', 'submitted', { inspector: 'QC Supervisor' })])
    render(<Reports query={{ f: 'submitted', scope: 'review' }} />)
    expect(screen.getAllByRole('button', { name: /DIM\/A\/(old|late)/ }).map((r) => r.textContent.match(/DIM\/A\/(old|late)/)[0])).toEqual(['DIM/A/old', 'DIM/A/late'])
    expect(screen.queryByRole('button', { name: /DIM\/A\/peer/ })).toBeNull()
  })
})

describe('report launcher', () => {
  it('files a selected PDI under PDI and blocks a job requiring only Pre-Shipment', async () => {
    const user = userEvent.setup()
    render(<ReportLauncher initial="pdi" onClose={vi.fn()} />)
    const applicable = screen.getByRole('button', { name: /^A / })
    const inapplicable = screen.getByRole('button', { name: /^B / })
    expect(inapplicable.disabled).toBe(true)
    await user.click(applicable)
    expect(model.navigate).toHaveBeenCalledWith('/job/A/form/visual?d=PDI')
  })

  it('offers an existing approved record rather than creating a duplicate', async () => {
    seed([record('01', 'approved')])
    const user = userEvent.setup()
    render(<ReportLauncher initial="dimensional" onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /^A / }))
    expect(screen.getByRole('heading', { name: 'A report is already on file' })).toBeTruthy()
    expect(model.navigate).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Open existing report' }))
    expect(model.navigate).toHaveBeenCalledWith('/job/A/form/dimensional?d=Dimension%20Report&rid=01')
  })

  it('rechecks applicability if the order changes after the picker opens', async () => {
    const user = userEvent.setup()
    render(<ReportLauncher initial="pdi" onClose={vi.fn()} />)
    model.jobs = [unit('A', ['Pre-Shipment'])]
    await user.click(screen.getByRole('button', { name: /^A / }))
    expect(screen.getByRole('alert').textContent).toContain('no longer required')
    expect(model.navigate).not.toHaveBeenCalled()
  })

  it('shows both final-inspection contexts from the generic visual shortcut', () => {
    render(<ReportLauncher initial="final" onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Pre-Delivery Inspection/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Pre-Shipment Inspection/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Magnetic Particle/ })).toBeNull()
  })

  it('handles the native Escape cancellation event', () => {
    const onClose = vi.fn()
    render(<ReportLauncher onClose={onClose} />)
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: true, cancelable: true }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
