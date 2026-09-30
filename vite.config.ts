import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json}'],
        navigateFallback: 'index.html',
      },
      manifest: {
        name: 'SBF See Captain Trainer',
        short_name: 'SBF Captain',
        description: 'Bilingual SBF-See study trainer — Crew Edition',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#07131f',
        theme_color: '#07131f',
        icons: [],
      },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: true,
  },
})
