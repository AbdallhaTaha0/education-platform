import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// M1: the browser calls same-origin /api/* (Nginx proxies to the backend),
// so no dev-time backend URL is baked into the bundle.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env['VITE_DEV_API_PROXY'] ?? 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
