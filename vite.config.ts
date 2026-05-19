import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { copyFileSync, existsSync, readdirSync, unlinkSync } from 'fs'

/**
 * Native Vercel web-app build config. The Chrome extension multi-entry build
 * (popup/background/content) lives behind `npm run ext:build` so it doesn't
 * pollute the Vercel deployment with extension-only artifacts.
 */
const isExtensionBuild = process.env.BUILD_TARGET === 'extension'

export default defineConfig({
  plugins: [
    react(),
    !isExtensionBuild &&
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icons/lokr-extension-144.png', 'icons/Lokr.png'],
        manifest: {
          name: 'LnkLokr - Your Link Manager',
          short_name: 'LnkLokr',
          description: 'Save, organize, and sync your links across all devices',
          theme_color: '#0ea5e9',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait-primary',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: '/icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/icons/icon-192-maskable.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: '/icons/icon-512-maskable.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          categories: ['productivity'],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
        },
      }),
    {
      name: 'copy-extension-assets',
      closeBundle() {
        if (process.env.BUILD_TARGET !== 'extension') return

        const dist = path.resolve(__dirname, 'dist')
        copyFileSync(path.resolve(__dirname, 'content.js'), path.join(dist, 'content.js'))
        copyFileSync(path.resolve(__dirname, 'manifest.json'), path.join(dist, 'manifest.json'))

        // Remove PWA artifacts from web builds — Chrome needs manifest.json only.
        for (const file of readdirSync(dist)) {
          if (
            file === 'sw.js' ||
            file === 'registerSW.js' ||
            file === 'manifest.webmanifest' ||
            file.startsWith('workbox-')
          ) {
            unlinkSync(path.join(dist, file))
          }
        }
      },
    },
  ].filter(Boolean),
  base: '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    ...(isExtensionBuild
      ? {
          rollupOptions: {
            input: {
              popup: path.resolve(__dirname, 'popup.html'),
              main: path.resolve(__dirname, 'index.html'),
              background: path.resolve(__dirname, 'background.js'),
            },
            output: {
              dir: 'dist',
              entryFileNames: '[name].js',
              chunkFileNames: '[name].js',
              assetFileNames: 'assets/[name].[ext]',
            },
          },
          copyPublicDir: true,
        }
      : {
          rollupOptions: {
            input: {
              main: path.resolve(__dirname, 'index.html'),
            },
          },
        }),
  },
  server: {
    port: 5173,
  },
})
