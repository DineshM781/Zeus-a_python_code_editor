// ============================================================
// ZEUS — Vite Config (Tauri 2)
// ============================================================
// Replaces: electron.vite.config.ts
// No Electron-specific plugins. Pure Vite + React.
// ============================================================

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig(async () => ({
  plugins: [react()],

  // Vite options tailored for Tauri development:
  // prevent vite from obscuring rust errors
  clearScreen: false,

  server: {
    port: 5173,
    strictPort: true,
    // Tauri expects a fixed port; disable open to avoid browser popping up
    open: false,
    watch: {
      // Tell vite to ignore watching `src-tauri`
      ignored: ['**/src-tauri/**']
    }
  },

  envPrefix: ['VITE_', 'TAURI_'],

  build: {
    // Tauri uses Chromium on Windows and WebKit on macOS and Linux
    target: process.env.TAURI_ENV_PLATFORM == 'windows'
      ? 'chrome105'
      : 'safari13',
    // Don't minify for debug builds
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    // Produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    outDir: 'dist',
    emptyOutDir: true
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer/src'),
      '@renderer': resolve(__dirname, 'src/renderer/src'),
      '@shared': resolve(__dirname, 'src/shared')
    }
  },

  root: 'src/renderer',

  optimizeDeps: {
    include: ['monaco-editor']
  }
}))
