import { defineConfig } from '@playwright/test'

const externalServer = process.env.PLAYWRIGHT_EXTERNAL_SERVER === '1'
const testApiPort = Number(process.env.TEST_API_PORT || 3301)
const testVitePort = Number(process.env.TEST_VITE_PORT || 5173)
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${testVitePort}`

const viewports = [
  ['desktop-1440', { width:1440, height:900 }],
  ['desktop-1280', { width:1280, height:800 }],
  ['desktop-1024', { width:1024, height:768 }],
  ['tablet-768', { width:768, height:1024 }],
  ['mobile-390', { width:390, height:844 }],
] as const

export default defineConfig({
  testDir:'./tests/e2e',
  testMatch:'visual.spec.ts',
  timeout:30_000,
  // Visual auth fixtures share the same isolated API/database process.
  workers:1,
  reporter:[['list'],['html',{ outputFolder:'audit-artifacts/visual-report', open:'never' }]],
  use:{ baseURL, trace:'retain-on-failure', screenshot:'only-on-failure' },
  projects:viewports.flatMap(([name, viewport]) => [
    { name, use:{ viewport, colorScheme:'light' } },
    { name:`${name}-dark`, use:{ viewport, colorScheme:'dark' } },
  ]),
  webServer: externalServer ? undefined : [
    { command:'node tests/support/start-test-server.cjs', url:`http://127.0.0.1:${testApiPort}/api/health`, reuseExistingServer:false, timeout:120_000 },
    { command:'node tests/support/start-vite.cjs', url:baseURL, reuseExistingServer:false, timeout:120_000 },
  ],
  globalTeardown: externalServer ? undefined : './tests/support/cleanup-test-db.cjs',
})
