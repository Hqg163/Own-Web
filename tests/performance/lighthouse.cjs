const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(process.cwd(), '.env') });

const lighthouse = require('lighthouse').default;
const chromeLauncher = require('chrome-launcher');
const { chromium } = require('@playwright/test');

const APP_ORIGIN = process.env.PERFORMANCE_APP_ORIGIN || 'http://127.0.0.1:5174';
const API_ORIGIN = process.env.PERFORMANCE_API_ORIGIN || 'http://127.0.0.1:3301';
const MUTATION_ORIGIN = process.env.PERFORMANCE_MUTATION_ORIGIN || 'http://127.0.0.1:5173';
const TEST_DB_NAME = process.env.TEST_DB_NAME || 'own_web_test';
const UPLOAD_ROOT = path.resolve(process.env.TEST_UPLOAD_ROOT || path.join('api', 'test-uploads'));
const PERFORMANCE_FIXTURE_ROOT = path.join(process.cwd(), 'tests', 'fixtures', 'performance');
const SOURCE_IMAGE = path.join(process.cwd(), 'tests', 'fixtures', 'showcase', 'images', 'kyoto-door.png');
const ARTIFACT_ROOT = path.join(process.cwd(), 'audit-artifacts');
const EDITOR_COOKIE = normalizeCookieHeader(process.env.PERFORMANCE_EDITOR_COOKIE || process.env.EDITOR_AUTH_COOKIE || '');

const fixtureSpecs = [
  {
    key: 'long',
    label: 'Long Article',
    file: 'long-article.md',
    title: 'Performance fixture · long article',
    minHeadings: 30,
    minImages: 2,
    // The existing extreme fixture covers very large corpus limits. This
    // fixture deliberately stays focused on long-form reading composition.
    minChars: 4_000,
  },
  {
    key: 'math',
    label: 'Math Article',
    file: 'math-article.md',
    title: 'Performance fixture · math article',
    minFormulas: 30,
    minChars: 2_000,
  },
  {
    key: 'comment-heavy',
    label: 'Comment-heavy Article',
    file: 'comment-heavy-article.md',
    title: 'Performance fixture · comment-heavy article',
    minChars: 400,
    roots: 50,
    repliesPerRoot: 3,
  },
];

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitFor(url) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (_) {
      // The local service may still be starting.
    }
    await sleep(500);
  }
  throw new Error(`service did not start: ${url}`);
}

function normalizeCookieHeader(value) {
  return String(value || '')
    .replace(/^\s*Cookie:\s*/i, '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.includes('=') && !/^Path=|^Domain=|^Expires=|^Max-Age=|^SameSite=|^Secure$/i.test(part))
    .join('; ');
}

function cookieEntries(cookieHeader) {
  return String(cookieHeader || '')
    .split(';')
    .map((part) => {
      const separator = part.indexOf('=');
      if (separator < 1) return null;
      const name = part.slice(0, separator).trim();
      const value = part.slice(separator + 1).trim();
      return name && value ? { name, value, url: `${APP_ORIGIN}/` } : null;
    })
    .filter(Boolean);
}

function responseCookie(response) {
  const values = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
  const value = values[0] || response.headers.get('set-cookie') || '';
  return normalizeCookieHeader(value.split(';', 1)[0]);
}

function fixturePath(spec) {
  return path.join(PERFORMANCE_FIXTURE_ROOT, spec.file);
}

function readFixture(spec) {
  return fs.readFileSync(fixturePath(spec), 'utf8');
}

function fixtureStats(content) {
  return {
    characters: content.length,
    headings: (content.match(/^#{1,6}\s+/gm) || []).length,
    imagePlaceholders: (content.match(/\{\{IMAGE_URL\}\}/g) || []).length,
    formulas: (content.match(/\$\$[\s\S]*?\$\$/g) || []).length,
    hasTable: /^\|.+\|\s*$/m.test(content) && /^\|\s*:?-{3,}/m.test(content),
    hasCodeBlock: /```[\s\S]*?```/.test(content),
  };
}

function validateFixtureContracts() {
  const stats = {};
  for (const spec of fixtureSpecs) {
    const content = readFixture(spec);
    const current = fixtureStats(content);
    stats[spec.key] = { file: path.relative(process.cwd(), fixturePath(spec)), ...current };
    if (current.characters < spec.minChars) throw new Error(`${spec.file} is too short for its fixture contract`);
    if (spec.minHeadings && current.headings < spec.minHeadings) throw new Error(`${spec.file} needs at least ${spec.minHeadings} headings`);
    if (spec.minImages && current.imagePlaceholders < spec.minImages) throw new Error(`${spec.file} needs at least ${spec.minImages} image placeholders`);
    if (spec.minFormulas && current.formulas < spec.minFormulas) throw new Error(`${spec.file} needs at least ${spec.minFormulas} block formulas`);
  }
  if (stats.long.file === stats.math.file || stats.long.file === stats['comment-heavy'].file || stats.math.file === stats['comment-heavy'].file) {
    throw new Error('performance fixtures must be separate files');
  }
  return stats;
}

function dbConfig() {
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: TEST_DB_NAME,
  };
}

async function apiJson(pathname, options = {}) {
  const response = await fetch(`${API_ORIGIN}${pathname}`, options);
  let body = null;
  try {
    body = await response.json();
  } catch (_) {
    body = null;
  }
  return { response, body };
}

async function deleteFixtureUser(email) {
  if (!email) return;
  const connection = await mysql.createConnection(dbConfig());
  try {
    await connection.execute('DELETE FROM users WHERE email=?', [email]);
  } finally {
    await connection.end();
  }
}

function jsonHeaders(cookie) {
  return {
    'Content-Type': 'application/json',
    Origin: MUTATION_ORIGIN,
    ...(cookie ? { Cookie: cookie } : {}),
  };
}

function requireOk(result, action) {
  if (!result.response.ok) {
    const detail = result.body?.error?.message || result.body?.error || result.response.statusText;
    throw new Error(`${action} failed: ${result.response.status} ${detail}`);
  }
  return result.body;
}

async function registerAndLogin(spec, runId) {
  const email = `lighthouse-${spec.key}-${runId}@own-web.test`;
  const password = 'OwnWebLighthouseA1!';
  try {
    const registration = await apiJson('/api/register', {
      method: 'POST',
      headers: jsonHeaders(''),
      body: JSON.stringify({ email, password }),
    });
    requireOk(registration, `${spec.label} fixture registration`);
    const loginResponse = await fetch(`${API_ORIGIN}/api/login`, {
      method: 'POST',
      headers: jsonHeaders(''),
      body: JSON.stringify({ email, password }),
    });
    const loginBody = await loginResponse.json().catch(() => null);
    if (!loginResponse.ok) throw new Error(`${spec.label} fixture login failed: ${loginResponse.status}`);
    const cookie = responseCookie(loginResponse);
    const ownerId = Number(loginBody?.user?.id);
    if (!cookie || !Number.isSafeInteger(ownerId) || ownerId < 1) throw new Error(`${spec.label} fixture login did not return a usable session`);
    return { email, cookie, ownerId };
  } catch (error) {
    await deleteFixtureUser(email).catch(() => {});
    throw error;
  }
}

function copyFixtureImage(runDirectory, filename) {
  fs.mkdirSync(runDirectory, { recursive: true });
  const target = path.join(runDirectory, filename);
  fs.copyFileSync(SOURCE_IMAGE, target);
  const relative = path.relative(path.dirname(UPLOAD_ROOT), target).replace(/\\/g, '/');
  return { target, relative, size: fs.statSync(target).size };
}

async function insertPostMedia(connection, fixture, runDirectory, filename) {
  const image = copyFixtureImage(runDirectory, filename);
  const [result] = await connection.execute(
    'INSERT INTO post_media (owner_id,post_id,file_path,mime_type,alt_text,media_kind) VALUES (?,?,?,?,?,?)',
    [fixture.ownerId, fixture.postId, image.relative, 'image/png', `${fixture.spec.label} performance image`, 'image'],
  );
  return { ...image, id: Number(result.insertId), url: `/api/public/media/${result.insertId}` };
}

async function insertCommentMedia(connection, fixture, runDirectory, commentId) {
  const image = copyFixtureImage(runDirectory, 'comment-image.png');
  const [result] = await connection.execute(
    'INSERT INTO comment_media (owner_id,comment_id,file_path,mime_type,file_size,alt_text) VALUES (?,?,?,?,?,?)',
    [fixture.ownerId, commentId, image.relative, 'image/png', image.size, '评论压力 fixture 图片'],
  );
  return { ...image, id: Number(result.insertId), url: `/api/public/comment-media/${result.insertId}` };
}

async function seedCommentHeavyFixture(connection, fixture, runDirectory) {
  const roots = [];
  for (let index = 0; index < fixture.spec.roots; index += 1) {
    const [inserted] = await connection.execute(
      'INSERT INTO comments (post_id,author_id,parent_id,root_comment_id,reply_to_comment_id,content) VALUES (?,?,NULL,NULL,NULL,?)',
      [fixture.postId, fixture.ownerId, `性能根评论 ${index + 1}`],
    );
    const rootId = Number(inserted.insertId);
    await connection.execute('UPDATE comments SET root_comment_id=? WHERE id=?', [rootId, rootId]);
    roots.push(rootId);
  }

  let replyCount = 0;
  for (const rootId of roots) {
    for (let index = 0; index < fixture.spec.repliesPerRoot; index += 1) {
      await connection.execute(
        'INSERT INTO comments (post_id,author_id,parent_id,root_comment_id,reply_to_comment_id,content) VALUES (?,?,?,?,?,?)',
        [fixture.postId, fixture.ownerId, rootId, rootId, rootId, `性能回复 ${rootId}-${index + 1}`],
      );
      replyCount += 1;
    }
  }

  for (const rootId of roots.slice(0, 25)) {
    await connection.execute('INSERT INTO comment_likes (comment_id,user_id) VALUES (?,?)', [rootId, fixture.ownerId]);
  }
  const media = await insertCommentMedia(connection, fixture, runDirectory, roots[0]);
  await connection.execute(
    'UPDATE comments c SET like_count=(SELECT COUNT(*) FROM comment_likes l WHERE l.comment_id=c.id) WHERE c.post_id=?',
    [fixture.postId],
  );
  await connection.execute('UPDATE posts SET comment_count=? WHERE id=?', [roots.length + replyCount, fixture.postId]);
  return { roots: roots.length, replies: replyCount, likes: 25, media: 1, mediaPath: media.target };
}

async function createPerformanceFixture(spec, runId, runDirectory) {
  const account = await registerAndLogin(spec, runId);
  const fixture = { spec, ...account, runDirectory, postId: null, mediaPaths: [] };
  try {
    const source = readFixture(spec);
    const initialContent = source.replaceAll('{{IMAGE_URL}}', '');
    const created = requireOk(await apiJson('/api/posts', {
      method: 'POST',
      headers: jsonHeaders(account.cookie),
      body: JSON.stringify({ title: spec.title, contentFormat: 'markdown', contentMarkdown: initialContent }),
    }), `${spec.label} fixture draft creation`);
    fixture.postId = Number(created.post?.id);
    fixture.slug = created.post?.slug;
    if (!fixture.postId || !fixture.slug) throw new Error(`${spec.label} fixture creation returned no post`);

    const connection = await mysql.createConnection(dbConfig());
    try {
      let content = source;
      if (source.includes('{{IMAGE_URL}}')) {
        const media = await insertPostMedia(connection, fixture, runDirectory, `${spec.key}-image.png`);
        fixture.mediaPaths.push(media.target);
        content = source.replaceAll('{{IMAGE_URL}}', media.url);
      }
      const published = requireOk(await apiJson(`/api/posts/${fixture.postId}`, {
        method: 'PUT',
        headers: jsonHeaders(account.cookie),
        body: JSON.stringify({
          title: spec.title,
          slug: fixture.slug,
          contentFormat: 'markdown',
          contentMarkdown: content,
          status: 'published',
          visibility: 'public',
        }),
      }), `${spec.label} fixture publish`);
      fixture.route = `/posts/${published.slug || fixture.slug}`;
      if (spec.key === 'comment-heavy') fixture.commentStats = await seedCommentHeavyFixture(connection, fixture, runDirectory);
    } finally {
      await connection.end();
    }
    return fixture;
  } catch (error) {
    await cleanupFixtureAccount(fixture).catch(() => {});
    throw error;
  }
}

async function cleanupFixtureAccount(fixture) {
  if (!fixture?.email) return;
  await deleteFixtureUser(fixture.email);
  if (fixture.runDirectory && fs.existsSync(fixture.runDirectory)) fs.rmSync(fixture.runDirectory, { recursive: true, force: true });
}

async function checkEditorSession() {
  const requestedUrl = `${APP_ORIGIN}/write`;
  if (!EDITOR_COOKIE) {
    return {
      status: 'Needs Runtime Verification',
      requestedUrl,
      finalUrl: null,
      editorVisible: false,
      reason: 'PERFORMANCE_EDITOR_COOKIE/EDITOR_AUTH_COOKIE is not set; no login is fabricated by this test.',
    };
  }

  const me = await fetch(`${API_ORIGIN}/api/me`, { headers: { Cookie: EDITOR_COOKIE } }).catch(() => null);
  if (!me?.ok) {
    return {
      status: 'Needs Runtime Verification',
      requestedUrl,
      finalUrl: null,
      editorVisible: false,
      reason: `Provided Editor Cookie was rejected by /api/me (${me ? me.status : 'request failed'}).`,
    };
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    await context.addCookies(cookieEntries(EDITOR_COOKIE));
    const page = await context.newPage();
    await page.goto(requestedUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    const finalUrl = page.url();
    const editorVisible = await page.locator('.editor-page').first().isVisible().catch(() => false);
    if (!finalUrl.includes('/write') || !editorVisible) {
      return {
        status: 'Needs Runtime Verification',
        requestedUrl,
        finalUrl,
        editorVisible,
        reason: 'The real Cookie did not reach an authenticated visible Editor route.',
      };
    }
    return { status: 'ready', requestedUrl, finalUrl, editorVisible: true };
  } finally {
    await browser.close();
  }
}

async function runLighthouse(chromePort, label, route, extraHeaders = undefined) {
  const requestedUrl = new URL(route, APP_ORIGIN).href;
  const result = await lighthouse(requestedUrl, {
    port: chromePort,
    output: 'json',
    onlyCategories: ['performance', 'accessibility'],
    extraHeaders,
  });
  const lhr = result.lhr;
  return {
    label,
    requestedUrl: lhr.requestedUrl || requestedUrl,
    finalUrl: lhr.finalUrl || null,
    categories: lhr.categories,
    lhr,
  };
}

async function main() {
  const fixtureStatsByKey = validateFixtureContracts();
  if (process.env.PERFORMANCE_CHECK_ONLY === '1') {
    console.log(JSON.stringify({
      status: 'fixture-contracts-ok',
      fixtures: fixtureStatsByKey,
      editor: EDITOR_COOKIE
        ? { status: 'cookie-configured', requestedUrl: `${APP_ORIGIN}/write`, finalUrl: null, editorVisible: null }
        : { status: 'Needs Runtime Verification', requestedUrl: `${APP_ORIGIN}/write`, finalUrl: null, editorVisible: false, reason: 'No real Editor Cookie supplied; runtime Editor verification is intentionally not fabricated.' },
    }, null, 2));
    return;
  }

  fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const runDirectory = path.join(UPLOAD_ROOT, 'performance', `run-${runId}`);
  const api = spawn(process.execPath, [path.join(process.cwd(), 'tests', 'support', 'start-test-server.cjs')], { stdio: 'inherit' });
  const vite = spawn(process.execPath, [path.join(process.cwd(), 'tests', 'support', 'start-vite-preview.cjs')], { stdio: 'inherit' });
  const fixtures = [];
  let chrome;
  try {
    await waitFor(`${API_ORIGIN}/api/health`);
    await waitFor(`${APP_ORIGIN}/`);
    for (const spec of fixtureSpecs) fixtures.push(await createPerformanceFixture(spec, runId, runDirectory));

    const editor = await checkEditorSession();
    chrome = await chromeLauncher.launch({ chromeFlags: ['--headless', '--no-sandbox'] });
    const results = [];
    for (const route of [
      { label: 'Home', route: '/' },
      { label: 'Explore', route: '/explore' },
      ...fixtures.map((fixture) => ({ label: fixture.spec.label, route: fixture.route })),
    ]) {
      results.push(await runLighthouse(chrome.port, route.label, route.route));
    }

    if (editor.status === 'ready') {
      const editorResult = await runLighthouse(chrome.port, 'Editor', '/write', { Cookie: EDITOR_COOKIE });
      if (!editorResult.finalUrl?.includes('/write')) throw new Error(`Editor Lighthouse final URL escaped /write: ${editorResult.finalUrl || 'missing'}`);
      editorResult.editorVisible = editor.editorVisible;
      editorResult.authStatus = editor.status;
      results.push(editorResult);
    } else {
      results.push({ label: 'Editor', ...editor });
    }

    const output = {
      generatedAt: new Date().toISOString(),
      appOrigin: APP_ORIGIN,
      apiOrigin: API_ORIGIN,
      editor,
      fixtures: fixtures.map((fixture) => ({
        key: fixture.spec.key,
        label: fixture.spec.label,
        file: path.relative(process.cwd(), fixturePath(fixture.spec)),
        route: fixture.route,
        postId: fixture.postId,
        ownerId: fixture.ownerId,
        commentStats: fixture.commentStats || null,
      })),
      fixtureContracts: fixtureStatsByKey,
      results,
    };
    const outputPath = path.join(ARTIFACT_ROOT, 'lighthouse.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`lighthouse results recorded at ${outputPath}`);
    console.log(JSON.stringify({
      generatedAt: output.generatedAt,
      fixtures: output.fixtures,
      results: results.map(({ label, requestedUrl, finalUrl, categories, status, editorVisible, reason }) => ({ label, requestedUrl, finalUrl, status, editorVisible, reason, categories })),
    }, null, 2));
  } finally {
    if (chrome) await chrome.kill();
    for (const fixture of fixtures.reverse()) await cleanupFixtureAccount(fixture).catch((error) => console.error(`[performance] fixture cleanup failed: ${error.message}`));
    if (fs.existsSync(runDirectory)) fs.rmSync(runDirectory, { recursive: true, force: true });
    api.kill('SIGTERM');
    vite.kill('SIGTERM');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
