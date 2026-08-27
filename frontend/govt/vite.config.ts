/// <reference types="vitest/config" />
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
  server: { port: 5174, strictPort: true, host: true, allowedHosts: true },
  // maplibre-gl loads its DEM-decoding Web Worker as a separate chunk at
  // runtime — Vite's default dependency pre-bundling rewrites that
  // worker's import path in a way the browser can't resolve (a 404 on
  // maplibre-gl-worker.mjs), which silently stalls terrain processing.
  // Excluding it from pre-bundling serves the package as real, unbundled
  // ESM instead, which resolves the worker correctly.
  optimizeDeps: { exclude: ['maplibre-gl'] },
  test: { globals: true, environment: 'jsdom', env: { TZ: 'UTC' } },
})
