# Own-Web 第二轮复核证据矩阵

> 复核日期：2026-08-29。本文只记录本轮重新取得的代码、测试、运行时和真实站点证据，不继承上一轮结论。结论为“实现与集中门禁完成”，但第二账号独立阅读仍因没有现成会话而保持 Not Verified。

## 基线与范围

- Branch：`codex/community-blog-v1`
- Start HEAD：`a245cf542e47acfd7241d926c97a03ad36aef8b7`
- 集中验收前最后实现提交：`c21cfcf`
- Real site：`http://localhost:5173`
- 自动化数据库：`own_web_test`，由 API/E2E 生命周期创建并清理
- 真实 showcase：当前作者会话和真实站点数据库，文章保留，不 teardown
- 现有用户的 157、156、107 等草稿以及既有私人媒体未删除

证据等级：`Code Verified`、`Unit Tested`、`API Tested`、`E2E Tested`、`Visual Verified`、`Manually Verified`、`Publicly Verified`。

## Claim Verification Matrix

| Previous Claim | Code Evidence | Runtime Evidence | Test Evidence | Status | Gap |
|---|---|---|---|---|---|
| MySQL pool、迁移和启动流程稳定 | `api/server.js`、`api/migrations.js`、测试启动脚本 | API 启动成功并报告 `own_web_test` ready | `api:check`、`test:api`、旧 API smoke | Code/API Tested | 未做生产多实例压测 |
| 新编辑器空内容不创建草稿 | `src/utils/editorLifecycle.ts`、`PostEditor.vue` meaningful threshold | 新页面聚焦、输入单字符再删除后离开，未产生 POST | unit + draft lifecycle E2E（desktop/dark/mobile） | E2E Tested | 无 |
| 有意义内容 autosave 可恢复、失败不丢内容 | `PostEditor.vue` recovery、retry、route replacement | 保存后 reload/re-open 保留内容；失败时保留本地内容并显示 Failed | draft lifecycle E2E 4 projects | E2E Tested | 无 |
| 草稿删除只允许 owner 且限制状态 | `api/blog.js` DELETE owner/status checks；自定义确认 dialog | 自己未发布草稿可删除，发布文章不提供轻易删除 | API integration、draft lifecycle E2E | API/E2E Tested | 未发布文章的生产审计日志未单独导出 |
| 用户菜单 outside/Escape/路由/键盘行为正确 | `NavigationBar.vue` controlled popover and focus restoration | 作者会话实测可开关；菜单项跳转后关闭 | navigation-menu unit/E2E desktop/mobile/dark | E2E Tested | 无 |
| Music fullscreen 各状态保持主题对比度 | `MusicZone.vue` 使用共享 token，played 不降低 opacity | 3 首短/长/中英混合标题、歌词和状态 fixture 可读且不横溢 | music fullscreen E2E + visual baselines | Visual/E2E Tested | 未在真实私人音乐库改变数据 |
| Mermaid 是实际安全渲染而非只显示 source | `src/utils/mermaid.ts` 受限 flowchart SVG；`api/lib/content.js` 校验和 fallback | showcase 158 公共页出现安全 SVG；非法内容走 fallback | Mermaid unit、content parity、security regression | Publicly/Unit Tested | 不支持任意 Mermaid 语法是刻意限制 |
| Markdown/Blocks 保持 canonical source 和语义 parity | `api/lib/content.js`、客户端 preview、统一节点/协议契约 | 158/160 blocks、159/161 markdown 公共页可读 | content parity unit、real-articles UI workflow | E2E Tested | SVG 随机 id 不做逐字比较 |
| preview 与 published 使用同一安全语义 | server preview + client DOMPurify/enhance pipeline | 真实文章重开、预览、发布后检查 heading/code/table/math/media 等节点 | parity unit、real article E2E | E2E Tested | 未建立跨浏览器像素级 parity |
| 四篇深度文章已在真实站点保留 | `tests/fixtures/showcase/*`、`showcase-manifest.json` | 作者会话通过 `/write` 和 `/posts/:id/edit` 完成创建、autosave、保存、重载、预览、发布、重开、修改、再发布；真实 URL 均可打开 | real-articles E2E 是隔离测试库；真实站点另有手工记录 | Publicly/Manually Verified | 匿名独立窗口和第二账号窗口没有现成会话，保持 Not Verified |
| 上传验证覆盖 MIME/magic/尺寸/损坏/polyglot | `api/lib/security.js` | 无损坏图片或脚本片段通过校验 | security regression、media/blog access smoke | API Tested | 云端媒体处理未实现 |
| CSRF、CORS、headers、rate limit、XSS/SQL injection/IDOR 有防线 | `api/server.js`、`api/blog.js`、security helpers | API 在独立测试库启动并拒绝越权/危险输入 | `test:security`、`test:api`、旧 access smoke | API Tested | 未使用真实生产账号做破坏性安全测试 |
| 私人工作台旧边界仍保留 | `/personal/*` 路由、workspace API 和 owner scoping 未移除 | Study/Mail/Images/Videos/Music/Profile/Dashboard 页面可进入 | auth-account、study-access、media-access、E2E/visual | API/E2E Tested | 真实私人媒体内容不纳入截图提交 |
| 视觉质量门禁可重复 | `playwright.visual.config.ts`、tracked snapshots、bounds/overflow checks | 1440/1280/1024/768/390 与 light/dark 项目运行成功 | visual 20/20；real-site screenshots 写入 ignored `audit-artifacts` | Visual Verified | 截图基线集中覆盖核心 route，未为每一篇文章建立 tracked baseline |
| 性能门禁可执行 | `tests/performance/lighthouse.cjs` | Lighthouse 本地启动前端/API 并完成检查 | `test:performance` passed | Performance Tested | 本轮脚本只输出通过，不记录具体 LCP/CLS/INP 数值 |

## 真实站点 showcase 记录

以下 URL 是真实站点的公开 URL，不是 `own_web_test` URL；文章不删除。作者为当前已登录会话的 `用户69`。状态均为 `published`，visibility 均为 `public`。

| ID | 标题 | 模式 | 长度（content_markdown） | 实际节点/证据 | URL |
|---:|---|---|---:|---|---|
| 158 | Vue 3 响应式与调度：一次更新为什么不会立刻触发十次渲染 | Blocks | 2284 | H2/H3、code、table、blockquote、callout、details、Mermaid | [公开文章](http://localhost:5173/posts/vue-3-响应式与调度-一次更新为什么不会立刻触发十次渲染) |
| 159 | 从梯度下降到 Adam：优化器如何把不稳定的学习变成可控的步伐 | Markdown | 2516 | H2/H3、math 15 处、code、table、blockquote、footnote | [公开文章](http://localhost:5173/posts/未命名草稿-mtd5gy15) |
| 160 | 京都街区观察：在一条街的阴影里重新认识旅行 | Blocks | 1929 | cover、正文图片、gallery、figcaption、H2/H3、table、blockquote | [公开文章](http://localhost:5173/posts/京都街区观察-在一条街的阴影里重新认识旅行) |
| 161 | 个人知识网站不应只是文件仓库 | Markdown | 1847 | callout、details、bookmark card、safe embed、table、blockquote、footnote | [公开文章](http://localhost:5173/posts/个人知识网站不应只是文件仓库) |

源文件、研究说明和京都自有/生成素材：`tests/fixtures/showcase/`。重复执行应按 `showcase-manifest.json` 的 `matchTitle` 匹配同一作者既有 showcase；本轮没有通过直接 INSERT 创建文章，也没有删除已发布文章。

## 第二账号限制

当前浏览器只有作者会话，没有用户提供的第二账号会话。按照任务约束，本轮没有登出作者、创建账号、伪造 cookie 或把作者会话冒充第二读者。因此“第二账号独立读公开文章”和“匿名独立窗口读公开文章”均明确记录为 Not Verified；真实 URL 存在和作者会话打开公开页面记录为 Publicly/Manually Verified。

## 集中门禁

2026-08-29 从头运行 `npm run test:all`，结果全部通过：

```text
typecheck                         passed
build                             passed（仅有 >500 kB chunk warning）
api:check                         passed
test:lrc                          passed
test:unit                         7 files / 14 tests passed
test:api                          passed（own_web_test）
test:e2e                          36 passed
test:security                     passed
test:visual                       20 passed
test:performance                  Lighthouse checks passed
auth-account smoke                passed
study-access smoke                passed
media-access smoke                passed
blog-access smoke                 passed
git diff --check                  passed
```

另外，空草稿回归在修复后单独重跑 `test:e2e` 为 36/36；视觉真实站点截图位于被 `.gitignore` 排除的 `audit-artifacts/screenshots/`，提交的 Playwright baseline 位于 `tests/e2e/*-snapshots/`。
