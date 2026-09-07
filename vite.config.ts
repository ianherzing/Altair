import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Strip console.log/warn/info from production bundle (errors retained).
  esbuild: {
    drop: ['console', 'debugger'],
  },
  // Dev only: forward /api/* to the local API server (npm run dev:api).
  server: {
    proxy: { '/api': 'http://localhost:3001' },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      exclude: ['node_modules/', 'src/test/', '**/*.d.ts', 'scripts/', 'api/'],
    },
  },
  build: {
    // Split vendor chunks for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'supabase': ['@supabase/supabase-js'],
        },
      },
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 600,
    // Default esbuild minifier — handles class getter/setter semantics
    // correctly (terser breaks @supabase/realtime-js's RealtimeClient).
    minify: 'esbuild',
    // Hidden source maps: available for error tracking services but not
    // served to browsers (prevents exposing original TypeScript source)
    sourcemap: 'hidden',
  },
})
