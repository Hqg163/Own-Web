const { spawn } = require('child_process');
const path = require('path');
const { ensureDatabase, databaseName } = require('./test-db.cjs');

(async () => {
  await ensureDatabase();
  const child = spawn(process.execPath, [path.join(__dirname, '..', '..', 'api', 'server.js')], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      TEST_AUTH_RATE_LIMIT_SCALE: '10',
      DB_NAME: databaseName,
      PORT: '3301',
      TEST_UPLOAD_ROOT: 'api/test-uploads',
      CORS_ORIGIN: 'http://127.0.0.1:5173',
      // The normal application suite retains the disabled baseline. The focused
      // AI UI runner opts in to the deterministic Mock provider explicitly.
      AI_ENABLED: process.env.AI_E2E_ENABLED === '1' ? 'true' : 'false',
      AI_PROVIDER_MODE: 'mock'
    }
  });
  child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
})();
