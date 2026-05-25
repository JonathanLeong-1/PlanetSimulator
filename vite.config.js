import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    open: false
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  test: {
    globals: true,
    environment: 'node',
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**', '**/*.spec.js']
  }
});
