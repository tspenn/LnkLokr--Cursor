import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * Native Vercel web-app build config. The Chrome extension multi-entry build
 * (popup/background/content) lives behind `npm run ext:build` so it doesn't
 * pollute the Vercel deployment with extension-only artifacts.
 */
const isExtensionBuild = process.env.BUILD_TARGET === 'extension'

export default defineConfig({
  plugins: [react()],
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
              content: path.resolve(__dirname, 'content.js'),
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
          // Vercel: single-page app build, fingerprinted assets, no extension
          // entry points.
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
