import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
  
  // Development server configuration
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    hmr: {
      port: 3001
    }
  },

  // Preview server configuration
  preview: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true
  },

  // Build configuration
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['svelte', '@sveltejs/kit'],
          ui: ['lucide-svelte'],
          charts: ['chart.js', 'chartjs-adapter-date-fns'],
          utils: ['date-fns', 'zod']
        }
      }
    }
  },

  // Optimization configuration
  optimizeDeps: {
    include: [
      'axios',
      'socket.io-client',
      'chart.js',
      'date-fns',
      'zod',
      'zustand'
    ]
  },

  // Test configuration
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts']
  },

  // Define global constants
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString())
  }
});
