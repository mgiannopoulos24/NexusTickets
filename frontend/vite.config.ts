import path from 'path';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import mkcert from 'vite-plugin-mkcert';

// Backend dev server (override with env e.g. `VITE_API_PROXY_TARGET=http://127.0.0.1:8080 bun run dev`).
const API_TARGET = process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:8080';
// Host port published to the browser (Docker: set to match FRONTEND_PORT mapping, e.g. 3000:5173 → 3000).
const HMR_CLIENT_PORT = Number(process.env.VITE_HMR_CLIENT_PORT || 5173);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), mkcert()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // Docker / --host 0.0.0.0: browser cannot open wss to 0.0.0.0; HMR must use a real hostname.
    // https://vite.dev/config/server-options.html#server-hmr
    hmr: {
      host: 'localhost',
      clientPort: HMR_CLIENT_PORT,
    },
    proxy: {
      // WebSocket proxy MUST come before the generic /api entry so the
      // upgrade handler is scoped to this path only — avoids hijacking
      // Vite's own HMR WebSocket at /.
      '/api/v1/ws': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
      },
      '/uploads/media': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
      },
      '/ping': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
