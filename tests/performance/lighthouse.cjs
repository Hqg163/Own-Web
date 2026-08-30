const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(process.cwd(), '.env') });
const lighthouse = require('lighthouse').default;
const chromeLauncher = require('chrome-launcher');

async function waitFor(url) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { if ((await fetch(url)).ok) return; } catch (_) { /* service starting */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`service did not start: ${url}`);
}

async function discoverArticleRoutes() {
  try {
    const response = await fetch('http://127.0.0.1:3301/api/public/posts?feed=latest&page=1');
    if (!response.ok) return [];
    const payload = await response.json();
    const items = Array.isArray(payload.items) ? payload.items : [];
    const pick = (predicate, fallbackIndex) => items.find(predicate) || items[fallbackIndex];
    const longArticle = pick((item) => String(item.title || '').length > 30, 0);
    const mathArticle = pick((item) => /adam|梯度|数学|math|公式/i.test(`${item.title || ''} ${item.slug || ''}`), 1);
    const commentArticle = pick((item) => Number(item.comment_count || 0) > 0, 0);
    const routes = [];
    for (const [label, item] of [['Long Article', longArticle], ['Math Article', mathArticle], ['Comment-heavy Article', commentArticle]]) {
      if (item?.slug) routes.push({ label, route: `/posts/${item.slug}` });
    }
    return routes;
  } catch (_) {
    return [];
  }
}

function responseCookie(response) {
  const values = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
  const value = values[0] || response.headers.get('set-cookie') || '';
  return value.split(';', 1)[0];
}

async function createPerformanceFixture() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `lighthouse-${suffix}@own-web.test`;
  const password = 'OwnWebLighthouseA1!';
  const headers = { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:5173' };
  const register = await fetch('http://127.0.0.1:3301/api/register', { method: 'POST', headers, body: JSON.stringify({ email, password }) });
  if (!register.ok) throw new Error(`performance fixture registration failed: ${register.status}`);
  const login = await fetch('http://127.0.0.1:3301/api/login', { method: 'POST', headers, body: JSON.stringify({ email, password }) });
  if (!login.ok) throw new Error(`performance fixture login failed: ${login.status}`);
  const cookie = responseCookie(login);
  const requestHeaders = { ...headers, Cookie: cookie };
  const content = [
    '# Lighthouse long math comment-heavy article',
    '',
    '用于本地性能采集的临时公开文章。',
    '',
    ...Array.from({ length: 32 }, (_, index) => [`## 性能章节 ${index + 1}`, '', `这一节撑开长文章布局并提供可观察的文章目录。`, '', `$$x_{${index + 1}}^2 + y_{${index + 1}}^2 = z_{${index + 1}}^2$$`, '', '这是一段包含足够文字的正文，用于观察阅读页、公式排版和评论区域。', ''].join('\n')),
  ].join('\n');
  const created = await fetch('http://127.0.0.1:3301/api/posts', { method: 'POST', headers: requestHeaders, body: JSON.stringify({ title: `Lighthouse fixture ${suffix}`, contentFormat: 'markdown', contentMarkdown: content }) });
  if (!created.ok) throw new Error(`performance fixture creation failed: ${created.status}`);
  const createdBody = await created.json();
  const post = createdBody.post;
  const published = await fetch(`http://127.0.0.1:3301/api/posts/${post.id}`, { method: 'PUT', headers: requestHeaders, body: JSON.stringify({ title: post.title, slug: post.slug, contentFormat: 'markdown', contentMarkdown: content, status: 'published', visibility: 'public' }) });
  if (!published.ok) throw new Error(`performance fixture publish failed: ${published.status}`);
  for (let index = 0; index < 8; index += 1) {
    await fetch(`http://127.0.0.1:3301/api/posts/${post.id}/comments`, { method: 'POST', headers: requestHeaders, body: JSON.stringify({ content: `Lighthouse comment ${index + 1}` }) });
  }
  return {
    route: `/posts/${post.slug}`,
    async cleanup() {
      try {
        // Published posts are intentionally not deletable through the normal
        // workspace endpoint. Move this automation-only fixture back to a
        // private draft before deleting it, so performance runs do not pollute
        // later access assertions.
        await fetch(`http://127.0.0.1:3301/api/posts/${post.id}`, {
          method: 'PUT',
          headers: requestHeaders,
          body: JSON.stringify({
            title: post.title,
            slug: post.slug,
            contentFormat: 'markdown',
            contentMarkdown: content,
            status: 'draft',
            visibility: 'private',
          }),
        });
        await fetch(`http://127.0.0.1:3301/api/posts/${post.id}`, { method: 'DELETE', headers: requestHeaders });
      } finally {
        const connection = await mysql.createConnection({
          host: process.env.DB_HOST || '127.0.0.1',
          port: Number(process.env.DB_PORT || 3306),
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          database: process.env.TEST_DB_NAME || 'own_web_test',
        });
        await connection.query('DELETE FROM users WHERE email=?', [email]);
        await connection.end();
      }
    },
  };
}

(async()=>{
  fs.mkdirSync(path.join(process.cwd(), 'audit-artifacts'), { recursive:true });
  const api = spawn(process.execPath, [path.join(process.cwd(), 'tests/support/start-test-server.cjs')], { stdio:'inherit' });
  const vite = spawn(process.execPath, [path.join(process.cwd(), 'tests/support/start-vite-preview.cjs')], { stdio:'inherit' });
  let chrome;
  let fixture;
  try {
    await waitFor('http://127.0.0.1:3301/api/health'); await waitFor('http://127.0.0.1:5174/');
    fixture = await createPerformanceFixture();
    chrome = await chromeLauncher.launch({ chromeFlags:['--headless','--no-sandbox'] });
    const discoveredArticles = await discoverArticleRoutes();
    const routeFor = (label, fallback) => discoveredArticles.find((route) => route.label === label)?.route || fallback;
    const routes = [
      { label: 'Home', route: '/' },
      { label: 'Explore', route: '/explore' },
      { label: 'Long Article', route: routeFor('Long Article', fixture.route) },
      { label: 'Math Article', route: routeFor('Math Article', fixture.route) },
      { label: 'Comment-heavy Article', route: routeFor('Comment-heavy Article', fixture.route) },
      { label: 'Editor', route: '/write' },
    ];
    const results = [];
    for (const { label, route } of routes) {
      const url = `http://127.0.0.1:5174${route}`;
      const result = await lighthouse(url, { port:chrome.port, output:'json', onlyCategories:['performance','accessibility'] });
      results.push({ label, url, lhr:result.lhr });
    }
    const outputPath = path.join(process.cwd(), 'audit-artifacts', 'lighthouse.json');
    fs.writeFileSync(outputPath, JSON.stringify({ generatedAt:new Date().toISOString(), results }, null, 2));
    console.log(`lighthouse results recorded at ${outputPath}`);
    console.log(JSON.stringify(results.map(({ label, url, lhr }) => ({ label, url, categories:lhr.categories })), null, 2));
  } finally {
    if (chrome) await chrome.kill();
    if (fixture) await fixture.cleanup().catch(() => {});
    api.kill('SIGTERM');
    vite.kill('SIGTERM');
  }
})().catch((error)=>{ console.error(error); process.exitCode=1 });
