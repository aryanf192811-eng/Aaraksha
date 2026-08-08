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
})
