import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import './print.css'
import { registerServiceWorker } from './lib/appUpdate.js'

/* The service worker is what makes this installable and what lets it
   open in a yard with no signal. Registered after load so it never
   competes with the first paint, and only in a build — the dev server
   has no worker to serve and a stale one there is a debugging trap.

   lib/appUpdate.js also watches for a new build and tells the app, so an
   installed tablet left open on a bench finds out a version shipped
   rather than waiting to be closed. */
if (import.meta.env.PROD) {
  window.addEventListener('load', () => registerServiceWorker(import.meta.env.BASE_URL))
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
