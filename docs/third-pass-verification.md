# Own-Web 第三轮严格验收证据矩阵

> 复核日期：2026-08-29。分支：`codex/community-blog-v1`。`START_HEAD=6a26d6edb8ce50b1455396f37d46762ec3a39903`。本轮实现提交：`521e95efb97853ac238b7858c14239fa06977f94`。最终文档提交后的 HEAD 以 `git log -1 --format=%H` 为准；文档不把自身 commit hash 写成自引用。本文只记录本轮实际取得的 Code、Unit、API、E2E、Visual、Manual 和本地公开访问证据。

## 证据边界

- `Automation Fixture`：由测试生命周期创建并清理的 `own_web_test` 用户、文章、媒体和评论；用于自动化，不代表生产数据。
- `Showcase Source`：`tests/fixtures/showcase/` 下的四篇源文件、manifest 和素材；用于驱动文章工作流。
- `Persistent Public Article`：作者会话在本地真实站点数据库中保留的公开文章；本轮没有重复创建或删除这些文章。
- `Local Public Verified`：在当前本地站点、现有作者会话中打开过公开 URL。它不等同于生产环境、匿名窗口或第二账号证据。
- `Needs Runtime Verification`：代码和自动化已覆盖，但当前环境缺少所需的独立生产会话、真实数据或完整路由矩阵。

## 最终证据矩阵

| Requirement | Code | Automated | Runtime / Visual | Status | Remaining gap |
| --- | --- | --- | --- | --- | --- |
| Architecture and route preservation | Vue/Vite、Express/MySQL、既有 public/private routes 保留 | `typecheck`、`build`、`api:check`、全量门禁 | 本地 API/Vite 可启动 | Confirmed | 未做生产多实例压测 |
| Math rendering | `api/lib/content.js` canonical `data-math`；`src/utils/math.ts` KaTeX `trust:false`、限制展开和危险命令 | `math-pipeline.test.ts`、content/parity unit、real-articles、TOC/Math E2E | Adam 本地文章存在 `.katex` DOM；light/dark 视觉路径通过 | Confirmed | 未对生产文章全集建立截图基线 |
| TOC and article reading | `src/utils/toc.ts` 稳定 ID、重复标题、hash、sticky offset、Scroll Spy；桌面 sticky / 移动 details | `toc.test.ts`、TOC/Math E2E、real-articles | 点击、hash、sticky offset、移动目录和文章阅读已在本地验证 | Confirmed | 未覆盖所有真实浏览器组合 |
| Explore/search state | URL applied state 与 draft state 分离；clear/feed/category/page reset；request sequence/AbortController；`preview_excerpt` | `explore-state.test.ts`、third-pass regressions、Explore E2E | `q=Vue`、清空后 hot、直接 URL、路由同步本地验证 | Confirmed | Following 需要真实关注关系的额外生产验证 |
| Content parity and showcase | Markdown/Blocks canonical pipeline；preview/published 共用安全语义；manifest-driven article test | content/parity unit、real-articles 4 篇 | 四篇作者会话文章为 `Local Public Verified`；测试库不冒充公开文章 | Confirmed | 匿名/第二账号和生产独立窗口未验证 |
| Threaded comments | root/reply-to/兼容 parent；root + flat replies；latest/oldest/hot、cursor、2 条首屏回复 | comments unit/API/E2E/security | 本地公开文章评论创建、回复、点赞、软删除通过 | Confirmed | 未在生产匿名/第二账号完成互动矩阵 |
| Comment media and moderation | `comment_media` 待绑定事务、PNG/JPEG/WebP/GIF 校验、大小/数量限制、权限 URL、举报/删除 | API/security、comments E2E、旧 media/blog smoke | 跨用户 pending media、公开媒体、删除后 404 已验证 | Confirmed | 未做云端清理任务和生产媒体破坏性测试 |
| Visibility and ownership | private/followers/unlisted/share token 通过服务端 `access`；评论、媒体和删除均做归属检查 | API/security/auth/study/media/blog smoke | 当前作者本地公开/私有边界可重现 | Confirmed | 匿名和第二账号需现成会话 |
| Draft lifecycle / Creation | meaningful-content threshold、autosave recovery、draft/scheduled delete owner check、确认 dialog、筛选/搜索/排序/分页 | draft lifecycle E2E、旧回归套件 | Creation、Editor、草稿删除本地通过 | Confirmed | 未做生产审计日志导出 |
| Navigation / Music / workspace regression | menu outside/Escape/route/focus restore；音乐 Light/Dark computed token；旧 personal routes 保留 | navigation、music-fullscreen、visual、旧 API smoke | 390px、Light/Dark、workspace 路由本地通过 | Confirmed | Music 全屏完整视觉矩阵仍可扩充 |
| Accessibility | aria labels、keyboard/Escape、focus restore、纯文本评论、bounds/overflow checks | E2E、Visual；Lighthouse accessibility | 本地关键场景通过；Lighthouse accessibility 为 1.00 | Partially Confirmed | 未完成全站人工 WCAG 审计 |
| Visual regression | tracked Playwright baselines、动态字段 mask、overflow/bounds | `test:visual` 20/20 | Home/Explore/Login/Register/Creation/Editor/Dashboard/Settings 及 workspace 基线通过；Music fullscreen 有专项截图 | Partially Confirmed | Technical/Math/Image article 和全部指定组合未全部建立 tracked baseline |
| Performance | 本地 Lighthouse 脚本记录 JSON，不虚构 LCP/CLS/INP | `test:performance` passed | Home performance 0.86/accessibility 1.00；Explore performance 0.77/accessibility 1.00 | Partially Confirmed | Long/Math/comment-heavy article、Editor 和生产 Lighthouse 未覆盖；存在 >500 kB chunk warning |
| CI | push/PR 核心 grep 门禁包含 Explore、Math、TOC、comments、menu、draft；visual/performance 保留手动/nightly | `quality.yml` 已检查 | 未在远程 CI 主机上执行 | Partially Confirmed | 需远程仓库实际 push/PR 运行证据 |

## 四个用户 Bug 的闭环证据

### Explore 搜索清空后切换 Feed

- 复现：打开 `/explore?q=Vue`，清空输入，再切换“热门”；旧实现可能通过旧 draft 或 query 拼装恢复 `q`。
- 根因：输入 draft、URL applied state 和请求响应没有统一，筛选切换也没有取消旧请求。
- 修复：`Explore.vue` 分离 draft/applied state；清空立即删除 `q`；Feed/category/tag/page 重置为 1；使用请求序号和 `AbortController`；前进/后退与直接 URL 重新同步输入和结果；卡片使用专用 `preview_excerpt`。
- 证据：`explore-state.test.ts`、third-pass regressions、Explore E2E；本地浏览器确认 `q=Vue`、清空后的 `/explore?feed=hot` 和结果同步。

### TOC 点击、hash、sticky offset 和重复标题

- 复现：文章含中文重复标题、公式和特殊字符时点击目录、直接打开 hash 或 Back/Forward，旧实现没有稳定 ID、显式滚动和 active 状态。
- 根因：目录只依赖普通 anchor，未集中管理 heading ID、sticky header 间距和 hash 恢复。
- 修复：`src/utils/toc.ts` 生成稳定 ID，重复标题为 `标题`、`标题-2`；`scrollToHeading()` 计算 `[data-sticky-header]` 与阅读间距；`PostDetail.vue` 接入 hash、Scroll Spy、桌面 sticky TOC、移动折叠目录和 `popstate`。
- 证据：`toc.test.ts`、TOC/Math E2E；本地文章点击后 hash 和滚动位置正确，标题不被 sticky header 遮挡。

### Math 没有真正生成 KaTeX

- 复现：Markdown/Blocks/Preview/Published 中旧实现只生成裸 `data-math` 或依赖 auto-render，页面可能显示原始 TeX。
- 根因：服务端没有把单行/多行 block math 规范化到统一节点，阅读页和编辑器预览也没有共享 enhancer。
- 修复：`api/lib/content.js` 规范化 `\\(...\\)`、`$$...$$` 和边界严格的 `$...$`；`src/utils/math.ts` 统一调用 KaTeX，设置 `trust:false`、`maxSize`、`maxExpand`、危险命令拒绝；`PostDetail.vue` 与 `PostEditor.vue` 共享增强流程；Mermaid 节点不进入代码增强。
- 证据：`math-pipeline.test.ts`、content/parity unit、real-articles、TOC/Math E2E；Adam 文章本地检查到 15 个 `.katex` 和对应 `data-math`，无 math error 节点。

### 评论系统从一级纯文本升级为闭环

- 复现：旧实现只有一级纯文本评论，缺少 thread replies、like、media、分页/排序、软删除占位和权限闭环。
- 根因：数据模型没有 root/reply、like、独立媒体待绑定状态，API 也未统一计数、访问和限流。
- 修复：新增 `root_comment_id`、`reply_to_comment_id`、兼容 `parent_id`、`comment_likes`、`comment_media`；评论创建/媒体绑定/计数使用事务；新增排序、游标、回复、点赞、软删除、举报、媒体授权 URL、按用户/IP 限流；组件拆为 `src/components/comments/`，保持纯文本渲染。
- 证据：comments unit/API/security/E2E；本地评论 E2E 覆盖 root、reply、like、author delete；安全回归覆盖跨用户删除、pending media、公开媒体、删除后媒体失效、CSRF、XSS、SQLi、伪造/损坏/polyglot 图片和限流。

## Showcase 与访问矩阵

manifest 驱动的四篇 Showcase Source 为：Technical Vue/Blocks、Adam/Markdown、京都/Blocks、知识网站/Markdown。`real-articles.spec.ts` 读取 manifest 和 fixture 文件，通过真实 Block UI 操作或 Markdown 编辑流程创建测试库文章，并对 Code、Table、Image、Gallery、Math、Callout、Details、Mermaid 等节点作内容断言。测试库文章是 `Automation Fixture`，不能被描述为持久公开文章。

当前作者会话打开过本地真实站点中保留的四个公开 URL，记录为 `Local Public Verified`。没有可用的生产匿名窗口或第二账号会话，本轮没有创建账号、伪造 cookie、登出作者或将作者会话冒充读者，因此以下项目保持 `Needs Runtime Verification`：

- Anonymous 独立窗口读取 public/unlisted/share-token 文章；
- Second Account 对 public/followers/private/unlisted 的读取和评论权限；
- 生产站点评论、图片 URL、举报和删除的完整矩阵。

## 全量门禁

最终代码提交前从头运行 `npm run test:all`，结果如下：

```text
npm run typecheck        passed
npm run build            passed（仅有 >500 kB chunk warning）
npm run api:check        passed
npm run test:lrc         passed
npm run test:unit        11 files / 30 tests passed
npm run test:api         passed（own_web_test）
npm run test:e2e         52 passed
npm run test:security    passed
npm run test:visual      20/20 passed
npm run test:performance passed；结果写入 audit-artifacts/lighthouse.json
auth-account smoke       passed
study-access smoke      passed
media-access smoke      passed
blog-access smoke       passed
git diff --check         passed
```

Lighthouse 脚本本轮只采集 Home 和 Explore 的 performance/accessibility 两类：Home `0.86 / 1.00`，Explore `0.77 / 1.00`。这些是当前本地测试服务上的实际结果，不是生产指标；没有采集的 category 和路线不作推断。

## 第一轮、第二轮、第三轮 Requirements Gap

| Round | 本轮重验后的结论 |
| --- | --- |
| 第一轮 | 既有博客/工作台基础路由、会话、visibility、媒体和编辑器能力保留；历史报告中的匿名、第二账号或生产结论只有在本矩阵有新证据时才可使用。 |
| 第二轮 | 空草稿、autosave/recovery、草稿删除、菜单、Music、Mermaid、上传安全、旧 workspace 和质量门禁已在本轮回归通过；旧报告中的测试数量和“Publicly Verified”措辞仅是历史快照，不能替代本轮证据。 |
| 第三轮 | Math、TOC、Explore、评论闭环和 manifest-driven Showcase 已完成本地 Code/Unit/API/E2E/Visual 覆盖；生产匿名/第二账号、全文章 Lighthouse、全指定文章视觉矩阵和远程 CI 执行仍是明确 gap。 |

## Deferred

- 生产匿名/第二账号验收、生产评论互动和真实私有媒体矩阵：`Needs Runtime Verification`。
- Long Article、Math Article、Comment-heavy Article、Editor 的 Lighthouse 采集，以及完整 LCP/CLS/INP 报告。
- Technical/Math/Image 文章与全部指定 1440/1280/1024/768/390 light/dark 组合的 tracked screenshot 扩展。
- KaTeX、Highlight、Mermaid、Music、Editor 的进一步动态拆包评估；当前 build warning 已记录，未虚构优化结果。
- `MusicZone.vue`、`PostDetail.vue` 的更细粒度拆分；当前只完成职责范围内的安全集成。
- email verification、password reset delivery、series、advanced analytics/recommendations、Elasticsearch、重型队列、云端媒体处理和多作者协作。

## 实际提交

| Commit | Message | Scope |
| --- | --- | --- |
| `521e95efb97853ac238b7858c14239fa06977f94` | `feat(blog): complete third-pass reading and comments hardening` | Math/TOC、Explore、评论后端与 UI、安全、Creation/Music/draft 回归、Showcase manifest 测试、视觉/性能/CI 门禁 |
| 文档提交 | `docs(audit): reconcile third-pass evidence` | 本矩阵、历史报告对账、评论基准 |

最终 clean 状态、最终 HEAD 和文档提交 hash 以交付时的 `git status --short`、`git log -2 --oneline --decorate` 输出为准。
