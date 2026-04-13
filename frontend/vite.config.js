import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In Docker, Vite proxies to the `api` service; locally, use 127.0.0.1.
const proxyTarget =
  process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:8000';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
      },
    },
  },
});
