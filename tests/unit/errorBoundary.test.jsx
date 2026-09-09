import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import ErrorBoundary from '../../src/components/ErrorBoundary.jsx'

/* The point of this component is the failure nobody predicted, so the
   test throws one that does not exist anywhere in the app. */
function Explodes({ when = true }) {
  if (when) throw new Error('the sky fell in')
  return <p>rendered fine</p>
}

afterEach(cleanup)

describe('the last thing between a thrown render and a white screen', () => {
  it('shows a recovery screen instead of nothing', () => {
    // React logs a caught error; the test is about what the reader sees.
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary><Explodes /></ErrorBoundary>)

    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText(/could not be drawn/i)).toBeTruthy()
    // What a person needs to know first is whether their work survived.
    expect(screen.getByText(/Nothing you have recorded is affected/i)).toBeTruthy()
    quiet.mockRestore()
  })

  it('offers a way out rather than leaving the reader stuck', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    const reload = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { reload, hash: '#/job/1/form/broken' }, writable: true, configurable: true,
    })
    render(<ErrorBoundary><Explodes /></ErrorBoundary>)

    fireEvent.click(screen.getByRole('button', { name: /reload the app/i }))
    expect(reload).toHaveBeenCalledOnce()

    /* The dashboard button sets the hash before reloading: coming back
       up on the screen that just failed is not a way out of it. */
    fireEvent.click(screen.getByRole('button', { name: /dashboard/i }))
    expect(window.location.hash).toBe('#/')
    expect(reload).toHaveBeenCalledTimes(2)
    quiet.mockRestore()
  })

  it('records the failure, because a white screen leaves nothing to go on', () => {
    const logged = []
    const quiet = vi.spyOn(console, 'error').mockImplementation((...a) => logged.push(a))
    render(<ErrorBoundary><Explodes /></ErrorBoundary>)
    expect(logged.some((a) => String(a[0]).includes('Unhandled render error'))).toBe(true)
    expect(screen.getByText(/the sky fell in/)).toBeTruthy()
    quiet.mockRestore()
  })

  it('is out of the way when nothing is wrong', () => {
    render(<ErrorBoundary><Explodes when={false} /></ErrorBoundary>)
    expect(screen.getByText('rendered fine')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  /* App.jsx puts this inside <main>, whose key changes with the route.
     That is what lets a reader walk away from a broken screen instead of
     reloading, so the remount is part of the fix and is tested here. */
  it('clears when the route remounts it, so navigating away is enough', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { rerender } = render(
      <ErrorBoundary key="route-a"><Explodes /></ErrorBoundary>
    )
    expect(screen.getByRole('alert')).toBeTruthy()

    rerender(<ErrorBoundary key="route-b"><Explodes when={false} /></ErrorBoundary>)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('rendered fine')).toBeTruthy()
    quiet.mockRestore()
  })
})
