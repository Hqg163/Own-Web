import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: '**/visual.spec.ts',
  timeout: 30_000,
  fullyParallel: true,
  // The E2E suite shares one isolated MySQL database and a single API process.
  // Serial workers keep auth throttles and fixture lifecycle deterministic.
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { outputFolder: 'audit-artifacts/playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], colorScheme: 'light' } },
    { name: 'desktop-dark', use: { ...devices['Desktop Chrome'], colorScheme: 'dark' } },
    { name: 'mobile', use: { ...devices['iPhone 13'], colorScheme: 'light' } },
    { name: 'mobile-dark', use: { ...devices['iPhone 13'], colorScheme: 'dark' } }
  ],
  webServer: [
    { command: 'node tests/support/start-test-server.cjs', url: 'http://127.0.0.1:3301/api/health', reuseExistingServer: false, timeout: 120_000 },
    { command: 'node tests/support/start-vite.cjs', url: 'http://127.0.0.1:5173', reuseExistingServer: false, timeout: 120_000 }
  ],
  globalTeardown: './tests/support/cleanup-test-db.cjs'
})
