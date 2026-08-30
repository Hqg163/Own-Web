# Own-Web 第四轮验收证据矩阵

> 复核日期：2026-08-30。分支：`codex/community-blog-v1`。起始 HEAD：`5b1d21837db00a8e034e9a85b219846d409e9177`。本文件从代码、专项测试和本地运行结果重新建立，不把前三轮报告、测试库数据或代码存在当作生产验证。

## 证据边界

- `Code`：当前提交中的实现、路由、迁移和配置。
- `Unit/API`：函数、数据库、服务端权限和安全脚本的自动化结果。
- `E2E`：Playwright 真实页面交互和 API 流程；不把 fixture 文章冒充持久公开文章。
- `Visual`：运行中页面在指定主题、viewport 和交互状态下的截图/断言。
- `Runtime`：本地站点、作者会话、匿名或第二账号的实际访问结果。
- 本轮没有生产匿名会话或第二账号会话，因此生产公开性只能记为 `Needs Runtime Verification`；本地作者会话不等于公开性证据。

## Phase 1：HEAD / 前三轮 Requirements 对账与复现

初始检查结果：

```text
branch: codex/community-blog-v1
START_HEAD: 5b1d21837db00a8e034e9a85b219846d409e9177
initial worktree: clean
initial typecheck: passed
initial unit: 11 files / 30 tests passed
```

起始代码的三个 P0 复现：

1. Explore 使用 Native `select`；暗色主题展开 `<option>` 的 computed background 为透明，项目 CSS 不能稳定控制不同浏览器/OS 的原生 popup，导致文字与背景对比度不足。
2. Music 音量条只使用浅色 `surface-raised`/border 轨道，没有明确已填充进度、thumb、hover/focus 和 muted 状态。
3. 长文章中 `.toc` 承担 sticky，但父级 wrapper 高度只包住目录内容；滚动到文章中部时 sticky 范围结束，TOC 离开视口。

起始缺口还包括：举报仅提交固定“其他”原因；没有统一举报 Dialog、证据媒体、举报快照、我的举报或管理员审核工作台；通知没有 `report_update`；前三轮的匿名/第二账号和远程 CI 仍无本环境证据。

## 初始矩阵

| Requirement | Code | Unit/API | E2E | Visual | Runtime | Status | Gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Explore 分类控件 Light/Dark 展开对比度 | 起始为 Native `select` | 无展开状态断言 | 无本轮状态回归 | 旧基线未覆盖 popup | 已复现 | Regression | 需要稳定的展开、键盘和主题对比度 |
| Music 音量 Slider | 起始为原生 range，无进度轨道 | 无 0/50/100 断言 | 旧 fullscreen 未覆盖音量 | 未覆盖主/全屏交互状态 | 已复现 | Regression | 需要填充轨道、thumb、Light/Dark |
| Desktop Article TOC Sticky | sticky 层级在 `.toc` | 既有 jump/hash/spy | 无长文中部证据 | 未覆盖长文 sticky | 已复现 | Partially Confirmed | sticky 应放到 `.toc-wrap`，并限制高度 |
| Report schema/API/security | legacy reports 字段和简单路径 | 只有旧基础 API | 只有旧路径 | 未覆盖 | 已复核 | Partially Confirmed | 缺结构化原因、快照、媒体、审核状态和隔离 |
| Report Dialog / user reports | 一键 POST | 无 | 无 | 无 | 未验证 | Not Completed | 缺完整用户流程 |
| Admin report workspace | 简单 admin API | 基础权限存在 | 无 | 无 | 未验证 | Partially Confirmed | 缺详情、筛选、审查与公开反馈 |
| Report review notification | 无 `report_update` | 无 | 无 | 无 | 未验证 | Not Completed | 缺审核结果通知 |
| Previous-round requirements | 部分功能已经存在 | 历史门禁存在 | 需本轮回归 | 需风险矩阵 | 生产身份不可用 | Partially Confirmed | 当前环境可完成项需补齐，其余准确标边界 |

## Phase 2：Explore 暗色分类控件

- 失败回归先确认 Native option popup 的透明背景问题。
- 修复：将不可跨 OS 可靠主题化的 Native select 替换为轻量 Accessible Listbox；保留筛选 URL 语义，不引入 UI framework。
- 交互：Arrow Up/Down、Enter/Space、Escape、outside click、焦点恢复、`aria-expanded`、`aria-selected`、disabled/loading 均有实现。
- 测试：`tests/e2e/fourth-pass-explore.spec.ts`，4/4 通过（desktop、desktop-dark、mobile、mobile-dark）；既有 Explore visual baseline 同步更新后全量视觉通过。
- 运行时：浏览器检查 Light/Dark 展开态 computed colors；暗色选项为 `rgb(36, 41, 39)`/`rgb(237, 240, 235)`（All 选中项为 `rgb(46, 62, 75)`/`rgb(178, 202, 224)`），浅色选项为 `rgb(255, 254, 250)`/`rgb(32, 37, 35)`。这不是生产证据。
- 结论：`Confirmed`（本地 Chrome/Playwright）；Firefox/OS 原生 popup 差异不再影响本控件，因为已使用自绘 listbox。

## Phase 2b：Music 音量条

- 失败回归覆盖主播放器与 fullscreen 的 Light/Dark 0%、50%、100%、muted、hover 和 keyboard focus。
- 修复：原生 range 保留可访问性，使用 `--volume-percent`/`--volume-track`/`--volume-fill`/`--volume-thumb`；补齐 WebKit track/thumb、Firefox range-track/progress/thumb，移动端保留 fullscreen 控件并隐藏不适合窄屏的 mini 控件。
- 测试：`tests/e2e/fourth-pass-music-volume.spec.ts` 4/4 通过；既有 `music-fullscreen.spec.ts` 更新后的 4 个合法视觉基线回归通过。
- 限制：当前环境没有 Firefox binary；Firefox 专用 CSS 规则已静态检查，未声称 Firefox 浏览器运行通过。
- 结论：`Confirmed`（Chrome/Playwright，Light/Dark）；Firefox runtime 为 `Needs Runtime Verification`。

## Phase 3：文章 TOC Sticky

- 修复：`.toc-wrap` 本身承担 `position: sticky`，`top: 88px`，`max-height: calc(100vh - 112px)`，`overflow-y: auto`，内部 `.toc` 不再重复承担 sticky；移动端恢复当前折叠目录的 static 行为。
- Active heading 离开目录可视区域时只滚动目录内部，不推动正文；既有 hash、Back/Forward、直接 hash、重复标题、sticky header offset 和 Scroll Spy 保留。
- 测试：`tests/e2e/fourth-pass-toc.spec.ts` 8/8 通过，覆盖 desktop/mobile 与 Light/Dark；包含中部 sticky、目录内部滚动、跳转、hash、前进后退和 Report Dialog 回归。
- 视觉证据：`audit-artifacts/screenshots/desktop[-dark]-sticky-toc-{1024,1280,1440}.png`；Report Dialog 证据为 `desktop[-dark]-report-dialog.png` 与 mobile 对应文件。
- 本地浏览器复核：文章滚动约 `scrollY=1600` 时 wrapper top 约 88、bottom 约 351，仍在 viewport 内；超长目录内部滚动。
- 结论：`Confirmed`（Chrome/Playwright，本地运行时）；移动端保持非 sticky。

## Phase 4-7：举报闭环

### Schema 与 API

添加 additive migration `20260830_reports_v2`，保留 legacy 字段和路径，同时增加：

- `reason_code`、`details`、`status`（`pending`/`reviewing`/`resolved`/`dismissed`）。
- `reviewed_by`、`reviewed_at`、`resolved_at`、`public_response`、`internal_note`、短 `target_snapshot`。
- `report_media`，保存资源归属、report、排序、尺寸、MIME 和过期状态；不把 Base64 放入数据库。
- `notifications.report_id` 和 `report_update` 类型；必要的唯一/状态/目标索引与 SET NULL 关联。

接口兼容并扩展为：

```text
POST   /api/reports/media              上传 0-3 张证据图
DELETE /api/report-media/:id           删除待绑定证据
POST   /api/reports                    创建结构化举报
GET    /api/reports                    当前用户的举报
GET    /api/reports/:id                当前用户的举报详情
GET    /api/public/report-media/:id    受授权保护的证据读取
GET    /api/admin/reports              管理员筛选列表
GET    /api/admin/reports/:id          管理员详情
PUT    /api/admin/reports/:id          开始审核/处理
```

文章与评论共享同一个 `ReportDialog.vue` 和同一套 reason code。`other` 必须填写 2000 字以内的纯文本说明；其它原因说明可选。服务端再次校验目标可见性、作者关系、CSRF/Origin、原因、长度、媒体归属和状态。

证据图限制为 PNG/JPEG/WebP、单张不超过 5 MB、每条举报最多 3 张；复用 magic bytes、MIME、尺寸、脚本片段和 polyglot 检查，拒绝 SVG、伪造 PNG 和超限文件。待绑定媒体在举报创建事务中绑定，失败/过期资源可清理。媒体 URL 不是静态公开目录，并再次执行 owner/admin 授权。

重复防刷：同一用户对同一目标已有 `pending`/`reviewing` 时返回 `409 DUPLICATE_REPORT`；举报创建和媒体上传分别有用户/IP 限流。状态进入 `resolved`/`dismissed` 时，在同一处理流程中创建 `report_update` 通知。

### 用户流程

- 文章操作区与评论 More 菜单均打开统一 Dialog。
- 用户可选择类型、填写说明、拖入/粘贴/选择 0-3 张证据、预览/删除，然后看到 submitting/success/failure 状态。
- `/dashboard/reports` 显示对象、类型、提交时间、状态、公开回复和处理时间；详情页不返回 `internal_note`、管理员敏感信息或无权目标内容。
- Navigation/Account 入口提供“我的举报”。

### 管理员流程

- `/admin/reports` 仅后端 `ADMIN_EMAILS` 判断通过的用户可访问；普通用户为 403/安全拒绝，伪造前端 `isAdmin` 无效。
- 工作台支持待处理、审核中、已处理、驳回筛选；详情显示 reason、说明、证据、举报时 snapshot、当前内容链接和时间线。
- 管理员可开始审核，或以公开说明处理为“确认违规”/“未发现违规（驳回）”，并单独填写仅管理员可见的内部备注。
- 本轮不绑定自动删除文章、删除评论或封禁用户等不可逆处罚。

### 安全证据

`tests/api/fourth-pass-report-api.ts` 和 `tests/security/fourth-pass-report-security.ts` 均通过，覆盖：普通用户访问 Admin API、伪造 isAdmin、跨用户举报/证据读取、IDOR、CSRF/Origin、XSS details、SQL injection、伪造 PNG、SVG、超大文件、重复举报、rate limit 和 internal note 隔离。

## Phase 8：前三轮剩余 Gap 与全站回归

- Creation、Navigation、Music、Draft、Showcase 与 real-articles 保留旧能力并加入回归；没有重复创建、删除持久 Showcase 文章或把测试库文章当作公开证据。
- Lighthouse fixture 清理改为先回收发布状态再删除测试用户/文章，避免污染 `blog-access`；清理使用精确 fixture 邮箱匹配。
- CI 保留静态检查、integration、scheduled/manual 分层；push/PR 集成 grep 已覆盖 fourth-pass/report 核心回归。远程 GitHub Actions 本轮没有实际运行凭据，记为 `Partially Confirmed`。
- 交互对比度审查覆盖 select/listbox、option、range、popover、dialog、tooltip、disabled、hover、focus、selected 的 Light/Dark 状态；只修复本轮实际问题，没有替换全站视觉语言。

## Phase 9：Visual / Accessibility / Performance

风险导向截图覆盖 Home、Explore、Login、Register、Creation、Editor、Technical/Math/Image Article、Profile、Dashboard、Settings、Bookmarks、Notifications、Music、Fullscreen Music，以及本轮 Report Dialog、Admin Reports、Sticky TOC、Explore listbox、Music volume。

当前 `npm run test:visual` 为 20 个场景通过；Playwright 稳定场景使用 `toHaveScreenshot()`，保留 overflow/bounds 检查和动态内容 mask。新增运行时截图位于 `audit-artifacts/screenshots/`，测试基线位于 `tests/e2e/*-snapshots/`。

Lighthouse 使用本地合成 fixture；Long Article、Math Article、Comment-heavy Article 当前指向同一个清理后的合成长文章路由，不代表四个生产 Showcase 文章。最后一次已记录结果：

| Route scenario | Performance | Accessibility |
| --- | ---: | ---: |
| Home | 0.83 | 1.00 |
| Explore | 0.80 | 1.00 |
| Long Article (synthetic fixture) | 0.79 | 0.95 |
| Math Article (synthetic fixture route) | 0.78 | 0.95 |
| Comment-heavy Article (synthetic fixture route) | 0.78 | 0.95 |
| Editor | 0.93 | 1.00 |

Build 仍有既有单个 `>500 kB` chunk warning；本轮只记录并保留现有路由懒加载，没有为了消除 warning 进行无目的拆包。KaTeX/编辑器/音乐等进一步拆包仍可作为后续优化。

## Phase 10：最终门禁

最终执行结果写入本文件的 `test:all` 行，命令不得用 skip/only 或整体 mock API：

```text
npm run typecheck        passed
npm run build            passed（有既有 >500 kB chunk warning）
npm run api:check        passed
npm run test:lrc         passed
npm run test:unit        12 files / 34 tests passed
npm run test:api         passed
npm run test:e2e         84 passed
npm run test:security    passed
npm run test:visual      20 passed
npm run test:performance passed；结果写入 audit-artifacts/lighthouse.json
npm run test:all         passed（84 E2E、20 Visual、Lighthouse、四组 API access smoke）
git diff --check         passed
```

## 最终矩阵

| Requirement | Code | Unit/API | E2E | Visual | Runtime | Status | Gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Explore 分类下拉框 | `Explore.vue` Accessible Listbox，保留 URL 筛选语义 | Explore state unit | 4/4 fourth-pass | Light/Dark 展开基线与 bounds | 本地 Chrome computed color | Confirmed | Firefox/OS 组合未单独运行 |
| Music 音量 Slider | 原生 range + theme-aware filled track/thumb | 既有 Music 回归 | 4/4 fourth-pass；旧 fullscreen 回归 | Light/Dark、主/全屏、移动布局 | 本地 Chrome | Confirmed | Firefox binary unavailable |
| Article TOC Sticky | `.toc-wrap` sticky、内部滚动、移动 static | TOC unit | 8/8 fourth-pass | 1024/1280/1440 Light/Dark | 本地 Chrome scroll geometry | Confirmed | 生产长文需继续观察 |
| Structured reports | additive migration、snapshot、reason_code、media、状态流转 | report API passed | report workspace 12/12 | Dialog/Admin/证据截图 | 本地作者/测试会话 | Confirmed | 生产投递与跨账号未验证 |
| Report security | owner/admin checks、CSRF、file validation、duplicate/rate limit | API + security passed | basic report paths included | 不适用 | 本地测试 DB | Confirmed | 生产部署配置需复核 |
| My Reports / Admin Reports | user/admin routes and backend authorization | report API passed | 12/12 fourth-pass workspace | report/admin screenshots | 本地会话 | Confirmed | 远程身份矩阵未验证 |
| Report review notification | terminal update creates `report_update` | API flow passed | notification link covered | Notifications risk route | 本地测试会话 | Confirmed | 邮件/生产推送 Deferred |
| Previous-round preservation | existing routes, visibility, fixture cleanup retained | full API/security smoke | 84/84 | 20/20 | local only | Partially Confirmed | Public/anonymous/second account and remote CI need verification |

## Requirements Gap 重列

| Round | Confirmed | Partially Confirmed | Not Completed / Deferred | Needs Runtime Verification |
| --- | --- | --- | --- | --- |
| 第一轮 | 当前已有的基础路由、所有权和 visibility 保护按现有专项回归 | 部分视觉/性能仅有本地证据 | 未被当前四轮范围覆盖的产品扩展 | 生产匿名、第二账号、远程 CI |
| 第二轮 | 其代码与本地门禁在本轮继续回归 | 历史“Publicly Verified”需按作者会话重新解释 | 未提供独立跨账号证据的结论不升级 | 生产公开性和真实多身份矩阵 |
| 第三轮 | Math/TOC/Explore/评论基础与 Showcase 回归已进入当前代码门禁 | Lighthouse 仍使用 synthetic fixture，Firefox 未运行 | 进一步大型拆分、完整生产内容矩阵 | 生产匿名/第二账号、远程 workflow |
| 第四轮 | Explore listbox、Music volume、TOC sticky、结构化举报闭环、用户/管理员流程、通知和安全脚本 | Firefox range runtime、远程 CI | 自动处罚、复杂 RBAC、生产邮件/通知投递、全量跨浏览器视觉 | Production Public、Anonymous、Second Account、Firefox runtime |

## 明确 Deferred / Not Completed

- 没有生产环境匿名账号或第二账号，因此不能写 `Publicly Verified`。
- 没有远程 GitHub Actions 运行结果；仅确认 workflow 配置和本地对应命令。
- 当前机器未安装 Firefox binary；Firefox range pseudo-element 只做代码静态核对。
- 没有引入复杂 RBAC、自动处罚、邮件投递或不可逆封禁。
- Lighthouse 的文章和评论密集场景是合成 fixture，不能替代生产长文/真实评论量测量。

## Git 证据

| Commit | Message |
| --- | --- |
| `829aefe` | `fix(ui): close fourth-pass reading regressions` |
| `3547f4b` | `feat(report): add structured moderation workflow` |
| `70a7b77` | `feat(report): add user and admin review surfaces` |
| `c00b174` | `perf(frontend): record focused audit routes` |
| this document | `docs(audit): record fourth-pass evidence` |

实现提交后的代码 HEAD 为 `c00b174`；全量门禁已通过。本文件的文档提交和最终 HEAD 以交付前最后的 `git log`、`git status` 为准。
