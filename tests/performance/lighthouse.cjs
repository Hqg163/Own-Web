const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const lighthouse = require('lighthouse').default;
const chromeLauncher = require('chrome-launcher');

async function waitFor(url) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { if ((await fetch(url)).ok) return; } catch (_) { /* service starting */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`service did not start: ${url}`);
}

(async()=>{
  fs.mkdirSync(path.join(process.cwd(), 'audit-artifacts'), { recursive:true });
  const api = spawn(process.execPath, [path.join(process.cwd(), 'tests/support/start-test-server.cjs')], { stdio:'inherit' });
  const vite = spawn(process.execPath, [path.join(process.cwd(), 'tests/support/start-vite-preview.cjs')], { stdio:'inherit' });
  await waitFor('http://127.0.0.1:3301/api/health'); await waitFor('http://127.0.0.1:5173/');
  const chrome = await chromeLauncher.launch({ chromeFlags:['--headless','--no-sandbox'] });
  try {
    const result = await lighthouse('http://127.0.0.1:5173/', { port:chrome.port, output:'json', onlyCategories:['performance','accessibility'] });
    fs.writeFileSync(path.join(process.cwd(), 'audit-artifacts', 'lighthouse.json'), JSON.stringify(result.lhr, null, 2));
    const scores = result.lhr.categories;
    for (const category of ['performance','accessibility']) if ((scores[category]?.score || 0) < 0.7) throw new Error(`${category} score below 0.7`);
    console.log('lighthouse checks passed');
  } finally { await chrome.kill(); api.kill('SIGTERM'); vite.kill('SIGTERM'); }
})().catch((error)=>{ console.error(error); process.exitCode=1 });
