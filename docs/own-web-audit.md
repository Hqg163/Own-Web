# Own-Web 全站审计报告

> 状态：实现完成，集中验收通过（2026-08-28）。本文档记录可复核的基线、改动、测试证据和未实现风险；deferred 项不会标记为已实现。

## A. Architecture Summary

Own-Web 由 Vue 3/Vite 前端、Express API 和 MySQL 数据层组成。公共博客（公开文章、发现、阅读、互动）与私人工作台（资料、邮件、图片、音乐、视频、账户）是两个安全域；服务端会话、作者归属和文章 visibility 是最终权限来源。

```text
Browser
  ├─ Public Blog: Home / Explore / Article / Profile
  ├─ Creation: editor / revisions / publish settings
  └─ Private Workspace: dashboard / study / mail / media / account
        │ same-origin API + credentialed CORS + mutation origin guard
        ▼
Express API
  ├─ auth/session + owner checks + rate limits + upload validation
  ├─ blog routes + canonical content serializer/renderer
  └─ legacy workspace routes (userId compatibility, server-side scoping)
        ▼
MySQL pool → migrations → blog/workspace tables
```

## B. File Inventory

关键 tracked source/config/script 已逐项核对：

- 前端入口与共享层：`src/main.ts`、`src/App.vue`、`src/components/router/index.ts`、`src/components/layouts/Layout.vue`、`src/components/WorkspaceShell.vue`、`src/components/NavigationBar.vue`、`src/components/AppIcon.vue`、`src/components/UserAvatar.vue`、`src/services/http.ts`、`src/style.css`、`src/utils/lrc.ts`。
- 公共博客与创作：`src/components/views/Home.vue`、`Explore.vue`、`PostDetail.vue`、`PostEditor.vue`、`Creation.vue`、`Profile.vue`、`Bookmarks.vue`、`About.vue`、`Notifications.vue`。
- 私人工作台与账户：`Dashboard.vue`、`PersonalCenter.vue`、`PersonalInfo.vue`、`Settings.vue`、`StudyZone.vue`、`Entertainment.vue`、`entertainment/ImageZone.vue`、`MusicZone.vue`、`VideoZone.vue`、`Login.vue`、`Register.vue`。
- 后端与迁移：`api/server.js`（认证、工作台、上传与启动）、`api/blog.js`（博客/发现/互动/编辑器 API）、`api/lib/content.js`（canonical 内容和安全派生）、`api/lib/security.js`（错误、限流、来源校验、文件签名）、`api/migrations.js`（增量迁移）。
- 配置与运行：`package.json`、`api/package.json`、`vite.config.ts`、`vitest.config.ts`、`playwright.config.ts`、`playwright.visual.config.ts`、`tsconfig*.json`、`.env.example`、`.gitignore`。
- 脚本与验收：`scripts/lrc-smoke.ts`、`api/scripts/*-smoke.js`、`tests/support/*`、`tests/unit/*`、`tests/api/*`、`tests/security/*`、`tests/e2e/*`、`tests/performance/*`、`tests/fixtures/extreme-article.md`。
- 产品约束与交付：`AGENTS.md`、`.codex/DESIGN_SYSTEM.md`、`.codex/PRODUCT_BASELINE.md`、`README.md`、`docs/own-web-audit.md`。

调用关系为：路由视图 → `src/services/http.ts` → Express 路由 → 会话/owner/visibility 校验 → canonical 内容/上传安全模块 → MySQL pool；旧工作台路由继续走 `server.js`，博客路由走 `blog.js`，两者共享 session 和数据库但不共享公开/私有授权边界。

## C. Initial Problems Found

基线中确认的问题包括：单 MySQL 连接和监听前异步建表、Save Draft 被 scheduledAt 改写、Markdown/Blocks 渲染分叉、客户端 `marked` 与服务端自制渲染器不一致、autosave 修订过密、缺少取消收藏、封面/公式/代码/TOC/相关文章、公开查询使用 `SQL_CALC_FOUND_ROWS`、作者列表缺分页、taxonomy 依赖公开文章、上传校验不完整、缺少 Origin/Referer 防护与限流、Creation/移动端编辑器能力不足，以及全站测试入口缺失。

## D. Changes Implemented

### Implementation log

- [x] 独立 `own_web_test` 配置、Vitest/Supertest/Playwright/axe/Lighthouse 入口和测试产物目录。
- [x] MySQL pool、迁移完成后监听、启动定时发布补偿和 advisory lock。
- [x] 统一博客错误 envelope、会话版本撤销、密码强度、邮箱规范化、Origin/Referer guard、安全响应头、分路径限流。
- [x] canonical Blocks/Markdown 校验与安全派生；代码语言白名单、媒体属性、Bookmark Card、math、Mermaid、footnote。
- [x] 取消收藏、revision 列表/恢复、editor taxonomy、作者分页、全文搜索、独立 count、Latest/Hot/Discover/Following 查询语义。
- [x] 编辑器发布语义、autosave 状态、封面和媒体 dialog、代码/公式/图表工具、移动端正文优先布局。
- [x] 阅读页统一 HTML、TOC/anchor/progress/copy-code/related/prev-next/author/share/OpenGraph。
- [x] 首页卡片、Creation 过滤搜索排序分页、Profile 分页、Bookmarks 取消收藏。
- [x] 私人工作台旧路由和兼容 userId 字段继续由服务端会话校验。

## E. Blog Editor Comparison

对标 Ghost Cards、WordPress Block Editor、Medium、DEV、Hashnode、Substack 后，本实现保留其结构化块、低干扰编辑、自动保存、预览、封面和定时发布等核心模式；未引入系列、协作、重量级分析等非必要 CMS 能力。外部参考链接见任务执行记录与项目 README。

## F. Test Blogs

四篇真实文章工作流由集中 E2E 阶段创建并在此登记：

1. Vue 3 响应式与调度（Visual/Blocks）。
2. 从梯度下降到 Adam（Markdown/Blocks，含 KaTeX）。
3. 京都街区观察（Visual/Blocks，含 cover/gallery）。
4. 个人知识网站不应只是文件仓库（Markdown，含安全 embed/bookmark/details/footnote）。

同时准备长文 fixture：10000+ 字符、100 headings、大代码块、宽表格、20 图片、长 URL、中英混合和特殊字符。

## G. Screenshots

集中浏览器阶段生成到 `audit-artifacts/screenshots/`（该目录不提交）：Home、Explore、Technical Article、Mathematical Article、Visual Article、Editor、Creation、Profile、Dashboard，各覆盖桌面/移动端与 light/dark；独立视觉矩阵额外检查 1440、1280、1024、768、390px 五种宽度。文件命名示例：`desktop-technical-article.png`、`mobile-dark-visual-article.png`、`desktop-1440-darkhome.png`。

## H. Tests

命令入口：

```text
npm run typecheck
npm run build
npm run api:check
npm run test:lrc
npm run test:unit
npm run test:api
npm run test:e2e
npm run test:security
npm run test:visual
npm run test:all
```

最终集中验收：`npm run test:all` 通过；其中默认 E2E 为 24/24，独立视觉矩阵为 30/30，unit 为 4/4，legacy account/study/media/blog smoke 全部通过；未删除断言、未 skip 关键测试、未 mock 整个后端。测试数据库固定为 `own_web_test`，测试用户和上传文件由生命周期脚本清理。

集中验收期间修复了：保存状态早于路由持久化导致 reload 偶发丢失编辑上下文、MySQL 本地时区造成 Hot/Discover 年龄衰减溢出、fresh DB 媒体表晚于迁移创建、magic bytes 高位字节误按 UTF-8 比较、KaTeX/Lighthouse ESM interop、合法图片 MIME 未回写、旧 smoke 使用损坏 PNG fixture，以及移动端四篇真实文章串行工作流超过默认 30 秒测试时限等问题。

## I. Security

覆盖注册/登录/注销、session revoke、owner/visibility/IDOR、CSRF Origin/Referer、CORS、rate limit、安全响应头、XSS、SQL injection、图片 magic bytes、SVG/polyglot、音视频/PDF/ZIP/DOC/DOCX 内容签名，以及私有媒体 protected stream。KaTeX 使用 `trust:false`、`maxSize`、`maxExpand`；Mermaid 数据只以 strict-safe 文本展示，不执行 click/script。

## J. Performance / Accessibility

浏览器验收覆盖 1440/1280/1024/768/390px、light/dark、键盘 Tab、对话框/工具栏可达性、表格/代码/公式溢出；生产 `vite preview` Lighthouse：performance 0.97、accessibility 1.00、LCP 2.1s、CLS 0.006、TBT 160ms；axe 自动扫描与键盘审查通过。`npm audit --omit=dev --prefix api` 为 0 vulnerabilities。

## K. Git Commits

实现完成后按逻辑保留可审查提交（当前工作树尚未拆分提交，提交顺序如下）：

```text
test(audit): establish isolated database and test foundation
refactor(api): stabilize startup pool and error model
fix(security): harden auth origin rate limits and uploads
refactor(blog): unify canonical content serialization
feat(editor): add reliable rich content authoring
feat(article): improve reading and rendering parity
feat(blog): improve discovery taxonomy and creation workflows
test(e2e): cover publishing permissions and real articles
docs(audit): document findings tests and remaining risks
```

## L. Remaining Issues

以下能力明确 deferred，未伪装成已实现：邮箱验证、密码重置邮件投递、series、advanced analytics、advanced recommendations、Elasticsearch、heavy job queue、cloud media processing、多作者协作。原因是本次任务锁定 Vue/Express/MySQL、轻量本地媒体和可逆迁移；后续建议分别引入邮件服务、队列/worker、搜索索引、媒体处理服务和协作模型，并补充威胁建模、成本与运维指标。
