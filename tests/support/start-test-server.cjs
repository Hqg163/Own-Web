const { spawn } = require('child_process');
const path = require('path');
const { ensureDatabase, databaseName } = require('./test-db.cjs');

(async () => {
  await ensureDatabase();
  const child = spawn(process.execPath, [path.join(__dirname, '..', '..', 'api', 'server.js')], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test', TEST_AUTH_RATE_LIMIT_SCALE: '10', DB_NAME: databaseName, PORT: '3301', TEST_UPLOAD_ROOT: 'api/test-uploads', CORS_ORIGIN: 'http://127.0.0.1:5173' }
  });
  child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
})();
