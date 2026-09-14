const { spawn } = require('child_process');
const path = require('path');
const apiPort = String(process.env.TEST_API_PORT || '3301');
const vitePort = String(process.env.TEST_VITE_PORT || '5173');
const child = spawn(process.execPath, [path.join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', vitePort, '--strictPort'], { stdio:'inherit', env:{ ...process.env, VITE_API_PORT:apiPort } });
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
