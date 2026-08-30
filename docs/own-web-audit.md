# Own-Web 全站第二轮审计与交付报告（历史记录）

> 第四轮对账（2026-08-30）：本文仅是历史快照；当前验收、提交和未验证边界请以 [fourth-pass-verification.md](./fourth-pass-verification.md) 为准。

> 第三轮对账（2026-08-29）：本文保留第二轮的原始背景、实现清单和测试快照，已不再作为当前验收基线。当前基线是 [third-pass-verification.md](./third-pass-verification.md)，其中的 `Local Public Verified`、`Needs Runtime Verification` 和最终测试数量优先于本文。本文中的“真实站点”“Publicly Verified”和第二轮测试数量只表示当时作者会话/本地环境取得的历史证据，不表示生产匿名访问或第二账号验证。

> 复核日期：2026-08-29。Branch：`codex/community-blog-v1`。Start HEAD：`a245cf542e47acfd7241d926c97a03ad36aef8b7`。End HEAD 以包含本报告的最后一个 commit 为准（可由 `git log -1 --format=%H` 复现）。实现、集中质量门禁和真实作者站点发布已经完成；独立匿名/第二账号阅读因当前环境没有第二会话而明确保持 Not Verified。本报告不把测试数据库或代码存在写成第二账号证据。

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

API 在基础表/migrations 和 pool 初始化完成后才监听端口；测试 API 使用独立 `own_web_test`。真实文章使用当前已登录作者会话和真实站点数据库，不使用测试库替代。

## B. File Inventory

起始基线 `a245cf542e47acfd7241d926c97a03ad36aef8b7` 的完整 tracked-file inventory 共 95 项，来自 `git ls-files`：

```text
.codex/DESIGN_SYSTEM.md
.codex/PRODUCT_BASELINE.md
.codex/skills/own-web-feature-safety/SKILL.md
.codex/skills/own-web-ui-consistency/SKILL.md
.env.example
.gitignore
.vscode/extensions.json
AGENTS.md
README.md
api/blog.js
api/lib/content.js
api/lib/security.js
api/migrations.js
api/package-lock.json
api/package.json
api/scripts/auth-account-smoke.js
api/scripts/blog-access-smoke.js
api/scripts/ensure-test-db.js
api/scripts/media-access-smoke.js
api/scripts/study-access-smoke.js
api/server.js
docs/history/code.txt
docs/blog-editor-benchmark.md
docs/own-web-audit.md
docs/second-pass-verification.md
index.html
package-lock.json
package.json
playwright.config.ts
playwright.visual.config.ts
docs/history/prompt.txt
public/favicon.svg
scripts/lrc-smoke.ts
src/App.vue
src/assets/vue.svg
src/components/AppIcon.vue
src/components/HelloWorld.vue
src/components/NavigationBar.vue
src/components/UserAvatar.vue
src/components/WorkspaceShell.vue
src/components/layouts/Layout.vue
src/components/router/index.ts
src/components/views/About.vue
src/components/views/Bookmarks.vue
src/components/views/Creation.vue
src/components/views/Dashboard.vue
src/components/views/Entertainment.vue
src/components/views/Explore.vue
src/components/views/Home.vue
src/components/views/Login.vue
src/components/views/Notifications.vue
src/components/views/PersonalCenter.vue
src/components/views/PersonalInfo.vue
src/components/views/PostDetail.vue
src/components/views/PostEditor.vue
src/components/views/Profile.vue
src/components/views/Register.vue
src/components/views/Settings.vue
src/components/views/StudyZone.vue
src/components/views/entertainment/ImageZone.vue
src/components/views/entertainment/MusicZone.vue
src/components/views/entertainment/VideoZone.vue
src/katex.d.ts
src/main.ts
src/services/http.ts
src/style.css
src/utils/editorLifecycle.ts
src/utils/lrc.ts
src/utils/mermaid.ts
src/vite-env.d.ts
tests/api/run-api-tests.ts
tests/e2e/navigation-menu.spec.ts
tests/e2e/real-articles.spec.ts
tests/e2e/smoke.spec.ts
tests/e2e/visual.spec.ts
tests/fixtures/extreme-article.md
tests/performance/lighthouse.cjs
tests/security/security-regression.ts
tests/support/cleanup-test-db.cjs
tests/support/start-test-server.cjs
tests/support/start-vite-preview.cjs
tests/support/start-vite.cjs
tests/support/test-db.cjs
tests/unit/content-parity.test.ts
tests/unit/content.test.ts
tests/unit/editor-lifecycle.test.ts
tests/unit/extreme-fixture.test.ts
tests/unit/mermaid.test.ts
tests/unit/navigation-menu.test.ts
tsconfig.app.json
tsconfig.json
tsconfig.node.json
vite.config.ts
vitest.config.ts
```

本轮新增 tracked 交付物包括 `.github/workflows/quality.yml`、draft/music E2E、security unit、Playwright snapshot、showcase fixtures/assets/manifest；最终清单可由 `git ls-files` 重现。主要调用关系为：路由 → views/components → `src/services/http.ts` → Express blog/workspace/auth routes → MySQL pool；preview 和 published 都经过内容契约、协议 allowlist、DOM sanitization 和 Mermaid safe renderer。

## C. Initial Problems Found

本轮重新复现：空编辑器短暂输入/删除仍可能把 `dirty` 当持久化依据；autosave 新文章路由替换与失败 recovery 不完整；草稿删除缺 owner/status 和可访问确认；用户菜单缺 outside/Escape/路由/焦点闭环；Music fullscreen 浅色子元素对比度错误；Mermaid 需要安全渲染/fallback；Blocks/Markdown 扩展语义需要 parity；图片损坏/polyglot 覆盖不足；Study 390px 横向溢出；上一轮把测试数据库短文章夸大为四篇真实富文本文章。

## D. Changes Implemented

- meaningful-content threshold（标题、摘要或正文任一项至少两个 Unicode 字符）；空编辑器不创建数据库行，已有文章继续 autosave，失败保留 recovery 并显示重试状态。
- DELETE API 补齐 owner/status 校验；draft/scheduled 可删除，published 返回不可删除；删除、离开、恢复、模式切换使用可访问确认 dialog。
- 用户菜单受控管理，处理 outside click、Escape 焦点恢复、路由和移动主导航互斥。
- Music fullscreen 使用设计 token 覆盖浅色/深色播放状态、歌词、进度和 controls；长标题 ellipsis，移动端保留 fullscreen 入口。
- Mermaid 采用受限 flowchart SVG：节点/边/文本/尺寸/时间限制，拒绝 click/script/HTML/危险链接，非法内容显示安全 source fallback。
- 保持 Markdown/Blocks 双 canonical source；统一 callout/details/embed/bookmark/math/footnote/Mermaid 契约，preview/published 均走 sanitization 和安全媒体规则。
- 上传校验补齐 MIME、magic bytes、尺寸、结束标记、脚本片段、polyglot/corrupt fixtures；保留 owner/visibility、CSRF、CORS、headers 和限流。
- Study 移动布局补齐 `min-width: 0` 等约束；增加 unit/API/security/E2E/visual/performance、隔离库生命周期、tracked baselines 和 CI。
- 四篇文章只通过真实 `/write`、`/posts/:id/edit` UI 创建/编辑/发布，文章保留；source、研究说明和摄影素材进入 `tests/fixtures/showcase/`。

## E. Blog Editor Comparison

对照 Ghost Cards、WordPress Block Editor、Medium Story Editor、Hashnode Editor 和 DEV Editor 官方资料后，保留结构化 blocks、Markdown canonical mode、低干扰写作、autosave、preview、cover、schedule；改善移动端、代码/媒体、revision 和视觉基线；安全实现 math、diagram、bookmark/embed；Deferred 系列、协作、重量级分析与搜索。详细决策见 [blog-editor-benchmark.md](./blog-editor-benchmark.md)。

## F. Test Blogs

四篇真实站点文章均由当前作者 `用户69` 发布，状态 `published`、visibility `public`，不删除：

| ID | 标题 | 模式 | content_markdown 长度 | 实际节点 | URL |
|---:|---|---|---:|---|---|
| 158 | Vue 3 响应式与调度：一次更新为什么不会立刻触发十次渲染 | Blocks | 2284 | H2/H3、代码、表格、引用、Callout、Details、Mermaid | [URL](http://localhost:5173/posts/vue-3-响应式与调度-一次更新为什么不会立刻触发十次渲染) |
| 159 | 从梯度下降到 Adam：优化器如何把不稳定的学习变成可控的步伐 | Markdown | 2516 | H2/H3、inline/block math 15 处、代码、表格、引用、footnote | [URL](http://localhost:5173/posts/未命名草稿-mtd5gy15) |
| 160 | 京都街区观察：在一条街的阴影里重新认识旅行 | Blocks | 1929 | cover、4 个正文图片、gallery、figcaption、H2/H3、表格、引用 | [URL](http://localhost:5173/posts/京都街区观察-在一条街的阴影里重新认识旅行) |
| 161 | 个人知识网站不应只是文件仓库 | Markdown | 1847 | Callout、Details、Bookmark Card、Safe Embed、表格、footnote、引用、列表 | [URL](http://localhost:5173/posts/个人知识网站不应只是文件仓库) |

每篇都完成 Create → Autosave → Save Draft → Reload → Continue → Preview → Publish → Re-open Editor → Modify → Republish；作者会话打开了四个真实公开 URL，并检查了 158 的 Mermaid、159 的 KaTeX、160 的 cover/gallery、161 的 bookmark/embed。自动化 `real-articles.spec.ts` 使用 `own_web_test`，不冒充真实站点证据。159 的 slug 保留首次 autosave 生成的 `未命名草稿-mtd5gy15`，列为 P2 内容质量问题。

匿名独立窗口和用户提供的第二账号会话不存在；没有创建账号、登出作者或伪造会话，所以两项读者验收为 Not Verified。按第三轮统一口径，作者会话下的 localhost 公开页应标记为 `Local Public Verified`，不能升级为匿名、第二账号或生产 `Publicly Verified`。

额外压力 fixture `tests/fixtures/extreme-article.md` 为 57,141 bytes、106 headings、2 个 code fences、20 个图片引用，覆盖长 URL、中英混合和特殊字符。

## G. Screenshots

真实作者站点截图写入本机 ignored 目录 `audit-artifacts/screenshots/`：`home-real.png`、`explore-real.png`、`technical-article-real.png`、`mathematical-article-real.png`、`visual-article-real.png`、`knowledge-article-real.png`、`editor-real.png`、`creation-real.png`、`profile-real.png`、`dashboard-real.png`。可提交、可重复的 Playwright baselines 位于 `tests/e2e/visual.spec.ts-snapshots/`，覆盖 Home、Explore、Login、Register、Creation、Editor、Settings、Dashboard 的 1440/1280/1024/768/390 和 light/dark；Music fullscreen baselines 位于 `tests/e2e/music-fullscreen.spec.ts-snapshots/`。视觉测试检查 bounds、横向溢出、动态字段 mask、dialog/toolbar 可见性。

## H. Tests

本段是第二轮历史快照：当时记录了 unit 7 files/14 tests、E2E 36 和 Lighthouse checks。第三轮重新从当前 `START_HEAD` 执行的 11 files/30 tests、E2E 52、Visual 20/20 及实际 Lighthouse 分数，以 [third-pass-verification.md](./third-pass-verification.md) 为准；不要把本段数字当作最终门禁结果。

覆盖空编辑器 A–I、autosave/recovery、草稿删除/IDOR、菜单 outside/Escape/keyboard/mobile、音乐三首混合标题与歌词状态、Preview/Published parity、Markdown/Blocks 节点、math/Mermaid/code/table/gallery/embed、auth/visibility/bookmark/like/comment/follow/report、XSS/SQL injection/CSRF/CORS/rate limit/headers/upload attacks，以及 Study、Mail、Images、Videos、Music、LRC、Profile、Dashboard 和旧 `/personal/*` 路由。测试数据与上传由生命周期清理；真实 showcase 不清理。

## I. Security

服务端继续以 session、owner、visibility 和资源归属为准；旧 `userId` 仅作兼容输入并被服务端忽略/校验。已检查 session revoke、密码强度/邮箱规范化、CSRF Origin/Referer、CORS、响应头、分路径限流、XSS、SQL injection、IDOR、私有媒体流、SVG、magic bytes、尺寸、损坏文件和 polyglot。Embed 只允许 HTTPS provider allowlist，不抓取远端、不执行任意 HTML/JS；KaTeX `trust:false`；Mermaid 不启用 click/script。安全脚本、API 权限矩阵和旧 access smoke 均通过，未对生产用户库或私人媒体做破坏性测试。

## J. Performance / Accessibility

Playwright 的 20 个视觉用例包含 overflow/bounds 检查，E2E 覆盖键盘焦点、Escape、dialog focus、移动布局和菜单关闭；Lighthouse 本地检查通过。脚本只报告 gate pass，没有生成可审计的 LCP/CLS/INP 数值，因此不虚构具体指标。PostEditor、Mermaid 等 bundle 的 >500 kB warning 列为 P2。

## K. Git Commits

本轮实际提交：

| Hash | Message | Purpose |
|---|---|---|
| `9481d61` | `fix(editor): harden draft lifecycle and Mermaid content` | 空草稿、recovery、内容契约和 Mermaid fallback |
| `9d04c57` | `fix(security): harden uploads and test isolation` | 图片完整性、测试隔离和 API fixtures |
| `340e029` | `fix(music): restore fullscreen playlist contrast` | 全屏播放列表主题 token、状态和移动入口 |
| `209fc96` | `fix(workspace): prevent study mobile overflow` | Study 390px bounds 修复 |
| `dfcc6bb` | `test(e2e): cover second-pass interaction regressions` | draft/menu/music E2E、视觉 baselines、安全 unit |
| `9f418fd` | `feat(blog): publish persistent showcase fixtures` | 文章源文件、研究/素材 manifest；真实文章由 UI 发布并保留 |
| `c21cfcf` | `ci: add reproducible quality gates` | PR/push 静态与集成门禁、nightly/dispatch 视觉性能任务 |
| 当前报告 commit（由 `git log -1 --format=%H` 取得） | `docs(audit): correct second-pass verification results` | 最终审计证据、真实 URL、限制和 remaining issues |

最终报告提交 hash 由 `git log -1 --format=%H` 取得；它是包含本文件的最后一个 `docs(audit)` 提交，避免在提交自身内容中伪造自引用 hash。

## L. Remaining Issues

P0/P1 本轮范围内的空草稿、autosave、草稿删除、菜单、音乐对比度、Mermaid、parity、上传安全、旧工作台和质量门禁已通过。剩余项：

- P1 验收限制：没有第二账号会话，第二账号公开权限和匿名独立窗口阅读保持 Not Verified；提供现成第二会话后按四个 URL 重跑，不创建新文章。
- P2：文章 159 的 `未命名草稿-mtd5gy15` slug；PostEditor/Mermaid >500 kB warning；逐篇 pixel baseline 和真实私有媒体视觉回归仍可扩展。
- Deferred 且未实现：email verification、password reset email delivery、series、advanced analytics、advanced recommendations、Elasticsearch、heavy job queue、cloud media processing、多作者协作。

Deferred 项目没有伪装成已实现能力；本轮也没有引入 Elasticsearch、重量级消息队列、云端媒体处理或破坏性数据库操作。
