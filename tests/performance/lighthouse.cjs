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
  let chrome;
  try {
    await waitFor('http://127.0.0.1:3301/api/health'); await waitFor('http://127.0.0.1:5174/');
    chrome = await chromeLauncher.launch({ chromeFlags:['--headless','--no-sandbox'] });
    const urls = ['/', '/explore'];
    const results = [];
    for (const route of urls) {
      const url = `http://127.0.0.1:5174${route}`;
      const result = await lighthouse(url, { port:chrome.port, output:'json', onlyCategories:['performance','accessibility'] });
      results.push({ url, lhr:result.lhr });
    }
    const outputPath = path.join(process.cwd(), 'audit-artifacts', 'lighthouse.json');
    fs.writeFileSync(outputPath, JSON.stringify({ generatedAt:new Date().toISOString(), results }, null, 2));
    console.log(`lighthouse results recorded at ${outputPath}`);
    console.log(JSON.stringify(results.map(({ url, lhr }) => ({ url, categories:lhr.categories })), null, 2));
  } finally {
    if (chrome) await chrome.kill();
    api.kill('SIGTERM');
    vite.kill('SIGTERM');
  }
})().catch((error)=>{ console.error(error); process.exitCode=1 });
