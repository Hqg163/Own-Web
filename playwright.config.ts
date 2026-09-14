import { defineConfig, devices } from '@playwright/test'

const externalServer = process.env.PLAYWRIGHT_EXTERNAL_SERVER === '1'
const testApiPort = Number(process.env.TEST_API_PORT || 3301)
const testVitePort = Number(process.env.TEST_VITE_PORT || 5173)
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${testVitePort}`

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
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], colorScheme: 'light' } },
    { name: 'desktop-dark', use: { ...devices['Desktop Chrome'], colorScheme: 'dark' } },
    { name: 'mobile', use: { ...devices['iPhone 13'], colorScheme: 'light' } },
    { name: 'mobile-dark', use: { ...devices['iPhone 13'], colorScheme: 'dark' } }
  ],
  webServer: externalServer ? undefined : [
    { command: 'node tests/support/start-test-server.cjs', url: `http://127.0.0.1:${testApiPort}/api/health`, reuseExistingServer: false, timeout: 120_000 },
    { command: 'node tests/support/start-vite.cjs', url: baseURL, reuseExistingServer: false, timeout: 120_000 }
  ],
  globalTeardown: externalServer
    ? (process.env.PLAYWRIGHT_EXTERNAL_CLEANUP === '1' ? './tests/support/cleanup-test-db.cjs' : undefined)
    : './tests/support/cleanup-test-db.cjs'
})
