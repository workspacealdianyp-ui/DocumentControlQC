import { defineConfig } from 'vitest/config'

/* Its own config, not the app's.

   vite.config.js carries the PWA plugin, which writes a service worker
   and a manifest on every run. A test run has no business emitting
   either, and the plugin's base-path substitution needs an env the test
   runner does not set. */
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}', 'tests/unit/**/*.test.{js,jsx}'],
    setupFiles: ['tests/setup.js'],
    restoreMocks: true,
    clearMocks: true,
  },
})
