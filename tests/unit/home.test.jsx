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

const unit = (jobNo, required) => ({ jobNo, required, deliverables: {}, productDesc: 'Water truck', customerName: 'Customer A', dateTarget: '2099-12-01' })
const record = (id, status, extra = {}) => ({ id, reportId: `DIM/A/${id}`, jobNo: 'A', formKey: 'dimensional', deliverable: 'Dimension Report', inspector: 'Inspector One', values: {}, status, updatedAt: '2026-09-08T10:00:00Z', ...extra })
const seed = (records) => localStorage.setItem('qc.reports', JSON.stringify(records))
function setup(role = 'inspector', records = []) {
  model.jobs = [unit('A', ['PDI', 'Dimension Report']), unit('B', ['Pre-Shipment'])]
  model.context = { jobs: model.jobs, role: ROLES[role], session: { name: role === 'admin' ? 'QA Lead' : 'Inspector One', role }, tick: 0, notify: vi.fn(), refresh: vi.fn() }
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
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeTruthy()
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
    expect(screen.getByRole('link', { name: 'Review reports', exact: true }).getAttribute('href')).toBe('#/reports?f=submitted')
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
    model.jobs = [unit('A', [])]; model.context.jobs = model.jobs
    render(<Home />)
    expect(screen.getByText('No required deliverables')).toBeTruthy()
    expect(screen.getByRole('region', { name: 'QC overview' }).textContent).toContain('—')
  })

  it('shows the exact returned and voided lifecycle labels in recent updates', () => {
    seed([record('01', 'returned'), record('02', 'voided')])
    render(<Home />)
    const recent = screen.getByRole('region', { name: 'Recent updates' })
    expect(within(recent).getByText('Sent back')).toBeTruthy()
    expect(within(recent).getByText('Voided')).toBeTruthy()
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
