import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
    },
  },
  // Fixed per-portal port (tourist 5173, govt 5174, guardian 5175).
  // host:true + allowedHosts:true so the dev server is reachable through a
  // cloudflared/ngrok tunnel (or over LAN) for real-device demo testing.
  server: { port: 5175, strictPort: true, host: true, allowedHosts: true },
})
