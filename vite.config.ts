/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Project site: https://<user>.github.io/pinfall/
// The service worker can only control this path, so the manifest scope matches it.
const base = '/pinfall/'

export default defineConfig({
  base,
  build: {
    // iPhone Chrome is WebKit. Keep the bundle inside what iOS 15.6 can parse.
    target: ['es2022', 'safari15.6', 'ios15.6'],
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: {
        name: 'Pinfall',
        short_name: 'Pinfall',
        description: 'Live disc golf distances from your phone GPS. Pins stay on this device.',
        theme_color: '#101614',
        background_color: '#101614',
        display: 'standalone',
        start_url: base,
        scope: base,
        lang: 'en',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      scope: base,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2,webmanifest}'],
        globIgnores: ['**/sw.js', '**/workbox-*.js', '**/*.map'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 43123,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 43123,
    strictPort: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
