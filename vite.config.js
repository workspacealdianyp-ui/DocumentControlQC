import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// On GitHub Actions, serve under /<repo>/ (project page). Locally & on Vercel, '/'.
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1]
const base = process.env.GITHUB_ACTIONS && repo ? `/${repo}/` : '/'

export default defineConfig({
  base,
  plugins: [react()],
  server: { port: 5173, open: false },
})
