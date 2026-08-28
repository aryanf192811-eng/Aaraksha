/// <reference types="vitest/config" />
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Aaraksha — Smart Tourism Safety',
        short_name: 'Aaraksha',
        description: 'Smart Tourism · Safe Journey — Plan trips, activate SOS, and stay safe in Northeast India',
        theme_color: '#f59e0b',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        // SVG placeholders — swap for generated PNGs (via the installed
        // @vite-pwa/assets-generator devDependency) before a real store/demo
        // release; iOS home-screen icons in particular need a PNG fallback.
        icons: [
          { src: 'pwa-icon.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: 'pwa-icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Falls back to the cached shell for any non-precached route on a
        // fully offline cold load (e.g. deep-linking into /trips/:id while
        // offline) — without this a route Workbox hasn't precached the HTML
        // for can fail outright instead of rendering the app at all.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'osm-tiles', expiration: { maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 } },
          },
          {
            urlPattern: /\/api\/(trips|destinations|dms\/active)/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-cache', networkTimeoutSeconds: 5, expiration: { maxEntries: 100, maxAgeSeconds: 5 * 60 } },
          },
          {
            // A POST /api/sos that fails while offline gets queued by
            // Workbox's own Background Sync (via the browser's Background
            // Sync API) and automatically retried the moment the OS reports
            // real connectivity — even if the tab was closed in the
            // meantime. This is the real, achievable version of "send
            // automatically once back online"; useOfflineSync's 'online'
            // event listener stays as a same-tab fallback for browsers
            // without Background Sync support (e.g. Safari).
            urlPattern: /\/api\/sos$/i,
            method: 'POST',
            handler: 'NetworkOnly',
            options: {
              backgroundSync: { name: 'sos-post-queue', options: { maxRetentionTime: 24 * 60 } },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
    },
  },
  // Fixed per-portal ports (tourist 5173, govt 5174, guardian 5175) — the
  // Guardian tracking link is built from this origin, so it can't be left to
  // Vite's auto-increment, which depends on start order across portals.
  // host:true + allowedHosts:true so the dev server is reachable through a
  // cloudflared/ngrok tunnel (or over LAN) for real-device demo testing —
  // Vite otherwise rejects requests whose Host header isn't localhost.
  server: { port: 5173, strictPort: true, host: true, allowedHosts: true },
  // maplibre-gl loads its vector-tile decoding Web Worker as a separate
  // chunk at runtime — Vite's default dependency pre-bundling rewrites that
  // worker's import path in a way the browser can't resolve (a 404 on
  // maplibre-gl-worker.mjs), which silently leaves the map blank. Excluding
  // it from pre-bundling serves the package as real, unbundled ESM instead,
  // which resolves the worker correctly (same fix as frontend/govt).
  optimizeDeps: { exclude: ['maplibre-gl'] },
  // Mirrors backend/vitest.config.js: globals so tests don't need to import
  // describe/it/expect, TZ pinned so date-formatting tests are deterministic
  // regardless of the machine/CI runner's local timezone.
  test: { globals: true, environment: 'jsdom', env: { TZ: 'UTC' } },
})
