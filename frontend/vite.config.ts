/// <reference types="vitest/config" />
import path from 'path';
import fs from 'fs';

import yaml from '@rollup/plugin-yaml';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Dev TLS. The cert/key default to the mkcert files scripts/setup-certs.sh
// writes next to this config; Docker mounts docker/tls/local and points the
// env vars at it. HTTPS is on whenever both files exist (VITE_DEV_TLS=0 forces
// plain HTTP), so tests / CI / a bare container without certs still start.
const TLS_CERT = process.env.VITE_TLS_CERT_FILE ?? 'localhost.pem';
const TLS_KEY = process.env.VITE_TLS_KEY_FILE ?? 'localhost-key.pem';
const devHttps =
  process.env.VITE_DEV_TLS !== '0' && fs.existsSync(TLS_CERT) && fs.existsSync(TLS_KEY)
    ? { cert: fs.readFileSync(TLS_CERT), key: fs.readFileSync(TLS_KEY) }
    : undefined;

// Backend dev server. It serves TLS with the same local cert, so the default
// follows the page: https when we have certs, http otherwise. Override with
// VITE_API_PROXY_TARGET (Docker: https://backend:8080).
const API_TARGET =
  process.env.VITE_API_PROXY_TARGET ??
  (devHttps ? 'https://127.0.0.1:8080' : 'http://127.0.0.1:8080');
// Host port published to the browser (Docker: set to match FRONTEND_PORT mapping, e.g. 3000:5173 → 3000).
const HMR_CLIENT_PORT = Number(process.env.VITE_HMR_CLIENT_PORT || 5173);

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
    setupFiles: ['./src/tests/setup.ts'],
    // Every test lives under src/tests so the suite is one tree to read.
    include: ['src/tests/**/*.{test,spec}.{ts,tsx}'],
  },
  server: {
    https: devHttps,
    // Docker / --host 0.0.0.0: browser cannot open wss to 0.0.0.0; HMR must use a real hostname.
    // https://vite.dev/config/server-options.html#server-hmr
    // Because `proxy` is set, Vite serves HTTPS over HTTP/1.1 rather than
    // HTTP/2, which is what lets the WebSocket upgrades below go through.
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
