import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // @ffmpeg/ffmpeg spins up an internal Web Worker via `new Worker(new
  // URL(...))`; Vite's esbuild-based dependency pre-bundler doesn't resolve
  // that correctly, so the worker silently fails to load and ffmpeg.load()
  // hangs forever with no error. Excluding it from pre-bundling (so it's
  // served from source instead) fixes that.
  //
  // Deliberately NOT setting COEP/COOP headers here: we're using the
  // single-threaded @ffmpeg/core build (not core-mt), which doesn't need
  // SharedArrayBuffer, and COEP:require-corp actively breaks things - it
  // blocks the cross-origin ffmpeg-core.js fetch from jsdelivr (and the
  // Tailwind CDN script) unless that origin sends matching CORP headers.
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
})
