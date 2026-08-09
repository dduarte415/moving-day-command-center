import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // In dev, the frontend calls relative /api/* paths and Vite proxies them
    // to the local backend — no CORS issues, and it mirrors how a reverse
    // proxy could sit in front of both in production. In the deployed build,
    // VITE_API_BASE_URL points straight at the backend's Render URL instead.
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
