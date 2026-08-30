const fs = require('fs');
const path = require('path');

const siteUrl = () => String(process.env.PUBLIC_SITE_URL || 'http://localhost:5173').replace(/\/+$/, '');
const ownerId = () => {
  const value = Number(process.env.SITE_OWNER_USER_ID || 0);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
};
const absolute = (value) => {
  try { return new URL(String(value || ''), `${siteUrl()}/`).toString(); } catch (_) { return siteUrl(); }
};
const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const escapeXml = escapeHtml;
const plainText = (value, limit = 320) => String(value || '').replace(/```[\s\S]*?```/g, '').replace(/[#*_>`~\[\]()]/g, '').replace(/\s+/g, ' ').trim().slice(0, limit);
const slugFromPath = (pathname, prefix) => pathname.startsWith(prefix) ? decodeURIComponent(pathname.slice(prefix.length).split('/')[0]) : '';

function jsonLd(value) {
  return `<script type="application/ld+json" data-own-web-jsonld="true">${JSON.stringify(value).replace(/</g, '\\u003c')}</script>`;
}

function buildHead(template, { title, description, canonical, image, type = 'website', robots = 'index,follow', ld = [] }) {
  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<meta name="robots" content="${escapeHtml(robots)}">`,
    `<link rel="canonical" href="${escapeHtml(canonical)}">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:type" content="${escapeHtml(type)}">`,
    `<meta property="og:url" content="${escapeHtml(canonical)}">`,
    image ? `<meta property="og:image" content="${escapeHtml(image)}">` : '',
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">`,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    image ? `<meta name="twitter:image" content="${escapeHtml(image)}">` : '',
    ld.map(jsonLd).join('')
  ].filter(Boolean).join('');
  const cleanTemplate = template
    .replace(/<title>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\s+name=["']description["'][^>]*>\s*/gi, '')
    .replace(/<meta\s+name=["']robots["'][^>]*>\s*/gi, '')
    .replace(/<meta\s+property=["']og:[^"']+["'][^>]*>\s*/gi, '')
    .replace(/<meta\s+name=["']twitter:[^"']+["'][^>]*>\s*/gi, '')
    .replace(/<link\s+rel=["']canonical["'][^>]*>\s*/gi, '')
    .replace(/<script\s+type=["']application\/ld\+json["'][^>]*data-own-web-jsonld[^>]*>[\s\S]*?<\/script>\s*/gi, '');
  return cleanTemplate.replace('</head>', `${tags}</head>`);
}

function publicOwnerQuery() {
  return `SELECT id,username,blog_slug,bio,blog_title,avatar_path,social_links FROM users WHERE id=? AND profile_visibility='public' AND deleted_at IS NULL`;
}

function mountPublicWebRoutes(app, db, { clientDist }) {
  const query = db.promise().query.bind(db.promise());
  const readTemplate = () => fs.readFileSync(path.join(clientDist, 'index.html'), 'utf8');
  const owner = async () => {
    const id = ownerId(); if (!id) return null;
    const [rows] = await query(publicOwnerQuery(), [id]); return rows[0] || null;
  };
  const ownerLd = (row) => row ? { '@type':'Person', name:row.username || row.blog_title || 'Site Owner', url:row.blog_slug ? `${siteUrl()}/u/${encodeURIComponent(row.blog_slug)}` : siteUrl(), description:plainText(row.bio, 500), image:row.avatar_path ? absolute(`/api/public/avatars/${row.id}`) : undefined } : null;
  const render = async (req, res, status = 200) => {
    const pathname = req.path;
    const base = { title:'Own-Web | 个人网站与博客', description:'Own-Web 是一个以个人写作、作品展示和长期积累为核心的网站。', canonical:absolute(pathname), robots:'index,follow', type:'website', ld:[] };
    try {
      const siteOwner = await owner();
      if (pathname === '/') {
        base.ld = [{ '@context':'https://schema.org', '@type':'WebSite', name:'Own-Web', url:siteUrl(), description:base.description }, ownerLd(siteOwner)].filter(Boolean);
      } else if (pathname === '/about') {
        base.title = siteOwner?.blog_title ? `关于 ${siteOwner.blog_title} · Own-Web` : '关于站主 · Own-Web';
        base.description = plainText(siteOwner?.bio || '了解站主正在关注的领域、写作方向与个人网站。');
        base.ld = [{ '@context':'https://schema.org', '@type':'ProfilePage', mainEntity:ownerLd(siteOwner) || { '@type':'Person', name:'Own-Web 站主' } }];
      } else if (pathname === '/about/site') {
        base.title = '关于本站 · Own-Web'; base.description = '了解 Own-Web 的公开写作、私人工作台、权限边界与技术实现。';
      } else if (pathname === '/projects') {
        base.title = '作品 · Own-Web'; base.description = '站主公开展示的项目与作品。';
      } else if (pathname.startsWith('/projects/')) {
        const slug = slugFromPath(pathname, '/projects/');
        const id = ownerId();
        const [rows] = id ? await query("SELECT p.title,p.slug,p.summary,p.cover FROM projects p JOIN users u ON u.id=p.owner_id WHERE p.slug=? AND p.owner_id=? AND u.profile_visibility='public' AND u.deleted_at IS NULL", [slug, id]) : [[]];
        if (!rows[0]) return renderNotFound(req, res, '项目不存在');
        base.title = `${rows[0].title} · Own-Web`; base.description = plainText(rows[0].summary || rows[0].title); base.image = rows[0].cover ? absolute(rows[0].cover) : '';
      } else if (pathname.startsWith('/series/')) {
        const slug = slugFromPath(pathname, '/series/');
        const [rows] = await query("SELECT s.name,s.slug,s.description,s.cover FROM series s JOIN users u ON u.id=s.owner_id WHERE s.slug=? AND u.profile_visibility='public' AND u.deleted_at IS NULL", [slug]);
        if (!rows[0]) return renderNotFound(req, res, '专栏不存在');
        base.title = `${rows[0].name} · Own-Web`; base.description = plainText(rows[0].description || rows[0].name); base.image = rows[0].cover ? absolute(rows[0].cover) : '';
      } else if (pathname.startsWith('/posts/')) {
        const slug = slugFromPath(pathname, '/posts/');
        const [rows] = await query("SELECT p.title,p.slug,p.excerpt,p.cover_image,p.published_at,u.username,u.blog_slug,u.avatar_path FROM posts p JOIN users u ON u.id=p.author_id WHERE p.slug=? AND p.status='published' AND p.visibility='public' AND u.profile_visibility='public' AND u.deleted_at IS NULL", [slug]);
        if (!rows[0]) return renderNotFound(req, res, '文章不存在');
        const article = rows[0]; const canonical = absolute(`/posts/${encodeURIComponent(article.slug)}`);
        base.title = `${article.title} · Own-Web`; base.description = plainText(article.excerpt || article.title); base.canonical = canonical; base.type = 'article'; base.image = article.cover_image ? absolute(article.cover_image) : '';
        base.ld = [{ '@context':'https://schema.org', '@type':'BlogPosting', headline:article.title, description:base.description, url:canonical, datePublished:article.published_at ? new Date(article.published_at).toISOString() : undefined, author:{ '@type':'Person', name:article.username || 'Own-Web 站主', url:article.blog_slug ? absolute(`/u/${encodeURIComponent(article.blog_slug)}`) : siteUrl() }, image:base.image || undefined }];
      } else if (pathname.startsWith('/u/')) {
        const slug = slugFromPath(pathname, '/u/');
        const [rows] = await query(publicOwnerQuery().replace('id=?', 'blog_slug=?'), [slug]);
        if (!rows[0]) return renderNotFound(req, res, '用户不存在');
        const profile = rows[0]; base.title = `${profile.blog_title || profile.username || '个人主页'} · Own-Web`; base.description = plainText(profile.bio || `${profile.username || '站主'}的公开文章与个人主页。`); base.canonical = absolute(`/u/${encodeURIComponent(profile.blog_slug)}`); base.ld = [{ '@context':'https://schema.org', '@type':'ProfilePage', mainEntity:ownerLd(profile) }];
      } else if (!['/','/explore','/about','/about/site','/projects','/login','/register','/creation','/creation/projects','/creation/series','/write','/settings','/dashboard','/dashboard/notifications','/dashboard/reports','/dashboard/bookmarks','/personal','/personal/info','/personal/study','/personal/entertainment','/personal/entertainment/images','/personal/entertainment/videos','/personal/entertainment/music','/posts/new'].includes(pathname) && !/^\/posts\/\d+\/edit$/.test(pathname) && !/^\/dashboard\/reports\/\d+$/.test(pathname) && !/^\/admin\/reports(?:\/\d+)?$/.test(pathname) && !/^\/u\/[^/]+\/posts$/.test(pathname)) {
        return renderNotFound(req, res, '页面不存在');
      }
      const html = buildHead(readTemplate(), base);
      return res.status(status).send(html);
    } catch (error) {
      console.error('[public web] failed to render metadata', error);
      return res.status(500).send(readTemplate());
    }
  };
  const renderNotFound = async (_req, res, message) => {
    const html = buildHead(readTemplate(), { title:`${message} · Own-Web`, description:message, canonical:siteUrl(), robots:'noindex,follow', type:'website', ld:[] });
    return res.status(404).send(html);
  };

  app.get('/feed.xml', async (_req, res, next) => {
    try {
      const [rows] = await query("SELECT p.title,p.slug,p.excerpt,p.content_markdown,p.published_at,u.username FROM posts p JOIN users u ON u.id=p.author_id WHERE p.status='published' AND p.visibility='public' AND u.deleted_at IS NULL ORDER BY p.published_at DESC,p.id DESC LIMIT 100");
      const items = rows.map((row) => `<item><title>${escapeXml(row.title)}</title><link>${escapeXml(absolute(`/posts/${encodeURIComponent(row.slug)}`))}</link><guid isPermaLink="true">${escapeXml(absolute(`/posts/${encodeURIComponent(row.slug)}`))}</guid><pubDate>${escapeXml(new Date(row.published_at || Date.now()).toUTCString())}</pubDate><dc:creator>${escapeXml(row.username || 'Own-Web')}</dc:creator><description>${escapeXml(plainText(row.excerpt || row.content_markdown, 800))}</description><content:encoded><![CDATA[${String(row.content_markdown || row.excerpt || '').slice(0, 10000).replace(/]]>/g, ']]]]><![CDATA[>')}]]></content:encoded></item>`).join('');
      res.type('application/rss+xml').send(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>Own-Web</title><link>${escapeXml(siteUrl())}</link><description>${escapeXml('个人写作与博客')}</description><language>zh-CN</language>${items}</channel></rss>`);
    } catch (e) { next(e); }
  });
  app.get('/sitemap.xml', async (_req, res, next) => {
    try {
      const urls = new Set(['/', '/explore', '/about', '/about/site', '/projects']);
      const [profiles] = await query("SELECT blog_slug FROM users WHERE profile_visibility='public' AND deleted_at IS NULL AND blog_slug IS NOT NULL");
      profiles.forEach((row) => { urls.add(`/u/${encodeURIComponent(row.blog_slug)}`); urls.add(`/u/${encodeURIComponent(row.blog_slug)}/posts`); });
      const [posts] = await query("SELECT slug FROM posts WHERE status='published' AND visibility='public'"); posts.forEach((row) => urls.add(`/posts/${encodeURIComponent(row.slug)}`));
      const [projects] = ownerId() ? await query("SELECT p.slug FROM projects p JOIN users u ON u.id=p.owner_id WHERE p.owner_id=? AND u.profile_visibility='public' AND u.deleted_at IS NULL", [ownerId()]) : [[]]; projects.forEach((row) => urls.add(`/projects/${encodeURIComponent(row.slug)}`));
      const [series] = await query("SELECT s.slug FROM series s JOIN users u ON u.id=s.owner_id WHERE u.profile_visibility='public' AND u.deleted_at IS NULL"); series.forEach((row) => urls.add(`/series/${encodeURIComponent(row.slug)}`));
      const body = [...urls].map((url) => `<url><loc>${escapeXml(absolute(url))}</loc></url>`).join('');
      res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`);
    } catch (e) { next(e); }
  });
  app.get('/robots.txt', (_req, res) => res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /dashboard\nDisallow: /personal\nDisallow: /write\nDisallow: /creation\nDisallow: /admin\nDisallow: /settings\nDisallow: /login\nDisallow: /register\nSitemap: ${siteUrl()}/sitemap.xml\n`));
  app.get(/^(?!\/api\/).*/, (req, res) => render(req, res));
}

module.exports = { mountPublicWebRoutes };
