import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

/* The service worker is what makes this installable and what lets it
   open in a yard with no signal. Registered after load so it never
   competes with the first paint, and only in a build — the dev server
   has no worker to serve and a stale one there is a debugging trap. */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch(() => { /* not fatal: the app runs, it just will not run offline */ })
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
