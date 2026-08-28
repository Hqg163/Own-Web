import { defineConfig } from '@playwright/test'

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
  reporter:[['list'],['html',{ outputFolder:'audit-artifacts/visual-report', open:'never' }]],
  use:{ baseURL:'http://127.0.0.1:5173', trace:'retain-on-failure', screenshot:'only-on-failure' },
  projects:viewports.flatMap(([name, viewport]) => [
    { name, use:{ viewport, colorScheme:'light' } },
    { name:`${name}-dark`, use:{ viewport, colorScheme:'dark' } },
  ]),
  webServer:[
    { command:'node tests/support/start-test-server.cjs', url:'http://127.0.0.1:3301/api/health', reuseExistingServer:true, timeout:120_000 },
    { command:'node tests/support/start-vite.cjs', url:'http://127.0.0.1:5173', reuseExistingServer:true, timeout:120_000 },
  ],
  globalTeardown:'./tests/support/cleanup-test-db.cjs',
})
