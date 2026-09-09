import { afterEach, beforeEach } from 'vitest'

/* Every test starts on an empty browser.

   The store installs a demo fixture on first read and remembers that it
   did, in a key separate from the reports themselves. A test that left
   either behind would hand the next one forty jobs it did not ask for,
   so both go. */
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
