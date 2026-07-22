/// <reference types="vitest/config" />
// Dev TLS certs in localhost.pem + localhost-key.pem (regenerate if missing/expired):
//   mkcert -cert-file frontend/localhost.pem -key-file frontend/localhost-key.pem localhost 127.0.0.1 ::1
import path from 'path';
import fs from 'fs';

import yaml from '@rollup/plugin-yaml';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Backend dev server (override with env e.g. `VITE_API_PROXY_TARGET=http://127.0.0.1:8080 bun run dev`).
const API_TARGET = process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:8080';
// Host port published to the browser (Docker: set to match FRONTEND_PORT mapping, e.g. 3000:5173 → 3000).
const HMR_CLIENT_PORT = Number(process.env.VITE_HMR_CLIENT_PORT || 5173);

// Dev HTTPS only when the mkcert files are present. Without this guard, running
// tests / CI / a container (no certs) crashes at config load. Local dev with
// certs still gets HTTPS as before.
const devHttps =
  fs.existsSync('localhost-key.pem') && fs.existsSync('localhost.pem')
    ? {
        key: fs.readFileSync('localhost-key.pem'),
        cert: fs.readFileSync('localhost.pem'),
      }
    : undefined;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), yaml()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  server: {
    https: devHttps,
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
