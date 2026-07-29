import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Chemins relatifs : le build fonctionne à la racine d'un domaine comme dans un
// sous-dossier (ex. GitHub Pages) ou depuis Electron (protocole file://).
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Coloriage par numéros',
        short_name: 'Coloriage',
        description: 'Coloriage par numéros : illustrations, mandalas et scènes détaillées.',
        lang: 'fr',
        theme_color: '#6a75ff',
        background_color: '#f4f6fb',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
