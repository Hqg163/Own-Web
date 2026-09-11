const { spawn } = require('child_process');
const path = require('path');

const cli = path.join(process.cwd(), 'node_modules', '@playwright', 'test', 'cli.js');
const child = spawn(process.execPath, [cli, 'test', 'tests/e2e/ai.spec.ts'], {
  stdio: 'inherit',
  env: { ...process.env, AI_E2E_ENABLED: '1' }
});
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
