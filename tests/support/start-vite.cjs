const { spawn } = require('child_process');
const path = require('path');
const child = spawn(process.execPath, [path.join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1'], { stdio:'inherit', env:{ ...process.env, VITE_API_PORT:'3301' } });
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
