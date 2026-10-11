import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end journeys against a running stack (see docs/setup.md). They talk to
 * the real backend and create their own users and events, so point them at a
 * development or throwaway database, never production.
 *
 *   E2E_BASE_URL        the frontend, default https://localhost:5173
 *   E2E_ADMIN_USERNAME  the built-in admin, default admin
 *   E2E_ADMIN_PASSWORD  default ChangeMe123! (as in .env.example)
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'https://localhost:5173',
    ignoreHTTPSErrors: true,
    locale: 'el-GR',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
