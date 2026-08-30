# Own-Web 第五轮产品成熟度审计与个人网站化改造

> 最后整理：2026-08-30。目标分支：`codex/community-blog-v1`。
> 本报告只记录当前仓库和本地测试数据库的可复核证据，不把本地结果写成生产验证。

## HEAD、工作树与证据边界

```text
START_HEAD=325407f2cbc4f11c318221d985cae8db060806cf
START_BRANCH=codex/community-blog-v1
START_WORKTREE_CLEAN=true
END_HEAD=6240032
```

`END_HEAD` 是功能实现和最终门禁完成时的代码 HEAD；随后仅提交本报告、README、历史归档和清理变更，最终仓库 HEAD 以 `git rev-parse HEAD` 为准。当前基线是 Vue 3 + TypeScript + Vite、Express + MySQL。公开博客和私人工作台仍是两个安全域：公开读接口执行 visibility，写接口执行会话和 ownership 校验。

没有真实部署 URL、站主配置和四类生产会话凭据，因此 Anonymous、Author、Second Account、Admin、HTTPS/Secure Cookie、反向代理、生产上传目录、多实例限流、生产 Lighthouse 和远程 CI 均为 `Needs Production Verification`。本地测试使用 `own_web_test`，不代表生产数据。

## 前四轮能力回归矩阵

| 场景 | 本轮证据 | 结果 | 边界 |
| --- | --- | --- | --- |
| Explore：搜索、latest/hot/trending feed、category、tag、清除筛选、暗色 listbox | `tests/e2e/fourth-pass-explore.spec.ts`、`tests/e2e/third-pass-regressions.spec.ts`、unit、visual | Local Verified | 生产流量待验证 |
| Music Light/Dark、音量 slider、fullscreen、长标题 | `fourth-pass-music-volume.spec.ts`、`music-fullscreen.spec.ts`、tracked snapshots | Local Verified | Firefox/生产媒体待验证 |
| User menu：outside click、Escape、route change、focus restore | `navigation-menu.spec.ts`、`navigation-menu.test.ts` | Local Verified | 生产浏览器组合待验证 |
| Draft、Creation：状态、搜索、排序、分页、删除草稿、重试 | `draft-lifecycle.spec.ts`、`real-articles.spec.ts`、visual | Local Verified | 生产会话待验证 |
| Revision、Schedule、Editor 保存与发布 | `draft-lifecycle.spec.ts`、`real-articles.spec.ts`、legacy API smoke | Local Verified | Editor Lighthouse 无认证 Cookie，见性能章节 |
| Markdown、Blocks、Cover、Images、Gallery、Code、Table、Math、Mermaid、Footnote | `content.test.ts`、`content-parity.test.ts`、`real-articles.spec.ts`、`phase1-reading.spec.ts` | Local Verified | 真实生产文章全集待验证 |
| TOC、Sticky TOC、标题 hash、移动端滚动 | `toc.test.ts`、`fourth-pass-toc.spec.ts`、`third-pass-regressions.spec.ts` | Local Verified | 生产内容长度待验证 |
| Like、Bookmark、Comments、Replies、评论图片、Emoji、Comment Likes | API/security、`comments-basic.spec.ts`、`phase1-reading.spec.ts`、comments unit | Local Verified | 真实账号组合待验证 |
| Reports、My Reports、Admin Reports、Report Dialog、通知入口 | `fourth-pass-reports-workspace.spec.ts`、`fourth-pass-report-api.ts`、security | Local Verified | 生产管理员和通知渠道待验证 |
| Visibility：public/followers/private/unlisted、share token | API/security、`fifth-pass-related-privacy.ts` | Local Verified | 生产第二账号矩阵待验证 |
| Authentication、Authorization、Uploads、CSRF、IDOR、XSS、Rate Limit | `security-regression.ts`、legacy auth/media/blog/study smoke、API checks | Local Verified | 生产 Cookie、代理和多实例待验证 |
| related metadata privacy | `api/blog.js` access gate、`fifth-pass-related-privacy.ts` | Local Verified | 无已知 P0/P1 泄露 |
| Visual、responsive、Light/Dark、CI | `test:visual` 20/20、Playwright baselines、GitHub workflow 静态检查 | Local Verified / CI static | 远程 CI 尚未运行 |

## 第五轮 Feature / Files / Reason / Tests / Screenshots

| Feature | 主要文件 | Reason | Tests | Screenshots |
| --- | --- | --- | --- | --- |
| 共享 ArticleTypography、标题正规化、媒体和窄屏滚动 | `src/styles/article.css`、`api/lib/content.js`、`PostDetail.vue`、`PostEditor.vue` | 发布页和 Preview 共享阅读契约；正文 Markdown `#` 不改源数据，只在渲染层显示为 h2 | 13 unit files/38 tests、phase1 reading、real articles、E2E 124/124 | Preview：`audit-artifacts/screenshots/desktop-preview-adam-optimizer.png`；Published：`audit-artifacts/screenshots/desktop-article-adam-optimizer.png` |
| 评论 text/media-only、预览、Escape、focus restore | `CommentComposer.vue`、`CommentItem.vue`、`CommentMedia.vue`、`api/lib/comments.js`、`PostDetail.vue` | 统一 `trimmedText.length > 0 || media.length > 0`，保留 MIME/尺寸/归属校验 | comments unit、phase1 reading、comments-basic、security | 同上文章截图；移动场景在 phase1 E2E |
| SEO metadata 和生产 shell 注入 | `src/services/metadata.ts`、`api/lib/public-web.js`、`api/server.js` | 统一 title/description/canonical/OG/Twitter/JSON-LD/robots，避免重复标签 | `fifth-pass-public-web.ts`、生产模式 HTTP 检查 | 文章与首页截图 |
| Site Owner 身份和公开资料 | `.env.example`、`api/lib/personal-site.js`、`Home.vue`、`About.vue`、`AboutSite.vue` | `SITE_OWNER_USER_ID` 与 `ADMIN_EMAILS` 分离；资料缺失时为空状态，不虚构身份 | `fifth-pass-personal-site.ts`、axe 32/32 | `audit-artifacts/fifth-pass-home-1440-light.png`、`audit-artifacts/fifth-pass-home-390-dark.png`、`audit-artifacts/fifth-pass-about-site-1440-light.png` |
| Projects / Series / Archive | `api/migrations.js`、`api/blog.js`、`api/lib/personal-site.js`、Projects/Series views and managers、`Profile.vue` | 增量迁移；公开文章只按 public visibility 输出；旧 Profile 路由继续可用 | personal-site API、API checks、visual、E2E smoke | `audit-artifacts/fifth-pass-projects-1440-light.png` |
| NotFound、Footer、person-first navigation | `NotFound.vue`、`Layout.vue`、`NavigationBar.vue`、router | 保留旧入口，同时未知公开文章/作者/项目/系列返回真实 404 | public web production check、axe 32/32、smoke | `audit-artifacts/fifth-pass-404-390-light.png` |
| Lighthouse 与独立大内容 fixture | `tests/performance/lighthouse.cjs`、`tests/fixtures/performance/` | 记录 requested/final URL；Editor 缺少 Cookie 时不伪造登录 | `test:performance` passed | `audit-artifacts/lighthouse.json` |
| 历史清理和产品文档 | `README.md`、`docs/history/`、`docs/own-web-audit.md` | 说明产品边界、运行方式和环境变量；归档旧输入；删除未引用 `public/vite.svg` | `rg` 引用检查、`git diff --check` | N/A |

## SEO、站主身份与内容路由

- `PUBLIC_SITE_URL` 是 canonical、OG、Twitter、JSON-LD、RSS、sitemap、robots 的绝对 URL 来源；未配置站主或资料不可公开时，站主接口返回 `{ owner: null }`，页面显示空状态。
- `/api/public/site-owner` 仅输出公开 username、blog title、bio、avatar URL 和通过 HTTPS 校验的 social links；Projects/Series 写入要求当前会话、所有权和站主边界。
- 生产 Express fallback 已注入主页 `WebSite/Person`、关于页 `ProfilePage/Person`、文章 `BlogPosting`、公开作者/项目/系列的动态 metadata，并清理模板中既有 managed tags，避免重复 canonical/description/JSON-LD。
- `/feed.xml` 仅查询 `published + public` 文章；`/sitemap.xml` 输出 Home、Explore、About、About Site、Projects、公开 Profile、公开 Article、公开 Series；`/robots.txt` 禁止工作台和管理路由。
- 本地生产模式事实：`/`、`/explore`、`/about`、`/about/site`、`/projects` 为 200；不存在的文章和未知路径为 404 + `noindex,follow`；RSS、sitemap、robots 为 200；元数据计数均为单份。

## 阅读、可访问性与性能

- 文章正文和 Editor Preview 均使用 `.article-typography`；代码使用系统等宽 fallback，数学使用 KaTeX 资源；图片增加 lazy/尺寸或 aspect-ratio；table、pre、Mermaid 使用局部滚动；全局减少 `prefers-reduced-motion` 动画。
- Visual Editor 仅保留 H2–H4，页面标题是唯一 H1；源 Markdown 一级标题以 `data-source-heading="h1"` 标记为正文 h2，TOC 排除该来源标记。
- axe + focus 门禁覆盖 Home、Explore、About、About Site、Projects、Project/Series empty state、404，在 desktop/light、desktop/dark、mobile/light、mobile/dark 共 32/32 通过；菜单、Explore listbox、评论图片、Report Dialog、TOC 和 Music 另有键盘专项。
- Lighthouse 独立 fixture：Long 为 34 headings/3 image placeholders/table/code；Math 为 36 formulas；Comment-heavy 为 50 root comments/150 replies/25 likes/1 image。Editor 因没有 `PERFORMANCE_EDITOR_COOKIE` 或 `EDITOR_AUTH_COOKIE`，明确记录 `Needs Runtime Verification`，没有把 `/login` 计入 Editor 分数。

| Scenario | Requested URL | Final URL | Performance | Accessibility |
| --- | --- | --- | ---: | ---: |
| Home | `http://127.0.0.1:5174/` | same | 0.97 | 1.00 |
| Explore | `http://127.0.0.1:5174/explore` | same | 0.90 | 1.00 |
| Long Article | `http://127.0.0.1:5174/posts/performance-fixture-long-article` | same | 0.82 | 1.00 |
| Math Article | `http://127.0.0.1:5174/posts/performance-fixture-math-article` | same | 0.83 | 1.00 |
| Comment-heavy Article | `http://127.0.0.1:5174/posts/performance-fixture-comment-heavy-article` | same | 0.88 | 0.95 |
| Editor | `http://127.0.0.1:5174/write` | not collected | Needs Runtime Verification | Needs Runtime Verification |

Build analysis found a Math chunk around 430KB and a PostEditor chunk around 504KB after minification. Because the route-level split already isolates these dependencies and no further change was proven beneficial in this run, the warning remains an explicit P2 follow-up rather than an arbitrary manual chunk change.

## 最终门禁

| Command | Result |
| --- | --- |
| `git diff --check` | Passed; only Git line-ending warnings |
| `npm run typecheck` | Passed (also included in build and test:all) |
| `npm run build` | Passed |
| `npm run api:check` | Passed; includes `api/lib/*` |
| `npm run test:lrc` | Passed |
| `npm run test:unit` | 13 files / 38 tests passed |
| `npm run test:api` | Passed; integration + fourth-pass + related privacy + personal-site + public-web |
| `npm run test:e2e` | 124/124 passed |
| `npm run test:security` | Passed; security regression + fourth-pass report security |
| `npm run test:visual` | 20/20 passed |
| `npm run test:performance` | Passed; report written to `audit-artifacts/lighthouse.json` |
| `npm run test:all` | Passed, including all commands above and auth/study/media/blog legacy access smoke |

## 风险分级与后续边界

### P0

无已知 P0。公开 related metadata 的 visibility 泄露已修复并有回归测试。

### P1

- 配置真实 `PUBLIC_SITE_URL`、`SITE_OWNER_USER_ID`，公开站主资料后，执行真实部署的 Anonymous、Author、Second Account、Admin 矩阵。
- 在 HTTPS、反向代理、Secure Cookie、生产上传目录和多实例限流环境中复核安全边界。
- 使用真实部署 URL 重新运行 Lighthouse，并为认证 Editor 提供真实 Cookie，确认 requested/final URL 仍为 `/write`。

### P2

- 远程 CI workflow 尚未在远程仓库执行。
- Firefox 以及更多真实媒体/文章组合尚未执行。
- Math/PostEditor chunk warning 需要基于真实 bundle 画像继续评估；当前不影响门禁。

### Deferred

Newsletter、营销、会员/付费订阅、收入、排行榜、徽章、等级、积分、活动、Notes、实时聊天、推荐 ML、增长分析、复杂 RBAC、tag moderator、trusted-user program 均保持 Deferred，未在本轮扩张产品范围。

### Needs Production Verification

真实部署匿名/作者/第二账号/管理员访问、站主公开资料、Projects/Series 真实数据、生产 SEO indexability、HTTPS/Secure Cookie、生产上传、代理 CSP/CORS、Firefox、远程 CI 和生产性能均保留此标记，不写 `Production Verified`。

## 本轮提交

| Commit | 内容 |
| --- | --- |
| `709ad1a` | `feat(site): add person-first public site and projects` |
| `fb3187e` | `test(fifth-pass): add reading accessibility and performance gates` |
| `dee87a1` | `test(content): cover normalized markdown heading output` |
| `97c1205` | `test(a11y): make empty-state focus checks deterministic` |
| `8940430` | `docs(audit): finalize fifth-pass report and archive history` |
| `6240032` | `test(evidence): capture preview screenshots` |
| `325407f` | 起始基线：`docs(audit): record fourth-pass evidence` |

最终仓库 commit SHA 以 `git log -1` 为准；截图证据提交后工作树应保持 clean。
