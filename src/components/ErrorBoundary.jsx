import { Component } from 'react'

/* The last thing between a thrown render and a white screen.

   There was nothing here, and one unguarded property read was enough to
   prove why: an unknown form key in the URL threw inside a render, React
   unmounted the whole tree, and every route after it painted nothing.
   The menu was still on screen and every item did nothing. Only a manual
   reload brought it back, and nothing on the page said so.

   A shop-floor tool cannot answer that with a blank page. The bug that
   caused it is fixed; this is here for the next one, which will not be
   the same bug and will not be found the same way.

   Deliberately a full-page state rather than an inline one: at the point
   this renders, the surrounding tree is already gone, and pretending
   otherwise gives a reader controls that no longer work. */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { err: null }
  }

  static getDerivedStateFromError(err) {
    return { err }
  }

  componentDidCatch(err, info) {
    /* Kept, because the alternative is a person describing a white
       screen over the phone. The console is the only recorder this app
       has — there is no backend to report to. */
    console.error('Unhandled render error:', err, info?.componentStack)
  }

  render() {
    if (!this.state.err) return this.props.children
    return (
      <div className="page crash-page" role="alert">
        <div className="card empty-state">
          <p><strong>This screen could not be drawn.</strong></p>
          <p>
            Nothing you have recorded is affected: every report is already saved in this
            browser, and reloading does not touch it.
          </p>
          <div className="crash-acts">
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload the app
            </button>
            {/* Back to a route known to work, then reload onto it, so a
                reader is not returned to the screen that just failed. */}
            <button className="btn btn-secondary" onClick={() => { window.location.hash = '#/'; window.location.reload() }}>
              Go to the dashboard
            </button>
          </div>
          <details className="crash-detail">
            <summary>What went wrong</summary>
            <code>{String(this.state.err?.message || this.state.err)}</code>
          </details>
        </div>
      </div>
    )
  }
}
