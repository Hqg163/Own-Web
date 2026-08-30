# Own-Web

Own-Web 是一个以个人写作、作品展示和长期积累为核心的个人网站。它同时保留一个公开博客、克制的社区互动和登录后的私人工作台：公开文章与项目面向访客，草稿、资料、媒体和账户数据仍由服务端权限保护。

## 产品范围

- **Public Blog**：首页、Explore、分类/标签、公开文章、公开作者主页、归档、Series、Projects、RSS 和 sitemap。
- **Creation**：Markdown 与 Visual Blocks 双模式、预览、自动保存、修订、封面、可见性、评论开关、定时发布和系列绑定。
- **Community**：Follow、Like、Bookmark、Comments、Replies、评论图片、Notifications、Reports 和 Admin Reports。
- **Private Workspace**：个人资料、学习资料、站内邮件、图片、视频、音乐和账户设置；旧 `/personal/*` 路由继续兼容。
- **Security**：HttpOnly 会话、服务端 ownership/visibility 检查、Origin/CSRF 防护、上传签名与尺寸校验、XSS/IDOR/限流回归。

营销、Newsletter、会员、收入、排行榜、徽章、积分、Notes、实时聊天、推荐 ML 和复杂 RBAC 属于 Deferred 范围。

## 架构与结构

Vue 3 + TypeScript + Vite 负责前端，Express 负责 API 与生产 SPA fallback，MySQL 保存用户、博客、项目、系列和工作台数据。`api/lib/content.js` 是 Markdown/Blocks 的安全内容契约；`src/services/http.ts` 统一携带会话 Cookie；`src/services/metadata.ts` 与 Express metadata service 共同维护页面 metadata。

```text
src/components/router  →  views/components  →  src/services/http.ts
                                                    ↓
                                    Express routes + MySQL migrations
```

生产环境下 Express 会在 SPA shell 返回前注入动态 title、description、canonical、OpenGraph、Twitter Card、JSON-LD 和 robots；未知公开文章、作者、项目、系列和未知路由返回真实 404。

## 本地运行

1. 复制 `.env.example` 为 `.env`，填写本地 MySQL 连接信息，并生成随机 `AUTH_SECRET`。
2. 安装依赖：

```bash
npm install
```

3. 启动 API（默认 `http://localhost:3000`）：

```bash
npm run api:dev
```

4. 另开终端启动 Vite（默认 `http://localhost:5173`）：

```bash
npm run dev
```

Vite 会代理 `/api` 和 `/uploads`。生产构建使用 `npm run build`，生产 API 使用 `npm run api:start`；生产 API 需要同目录下可用的 `dist/`。

## 关键环境变量

数据库、认证和跨域变量见 `.env.example`。与个人网站相关的配置为：

- `PUBLIC_SITE_URL`：公开网站的绝对 URL，用于 canonical、OpenGraph、RSS、sitemap、robots 和 JSON-LD。
- `SITE_OWNER_USER_ID`：站主用户的稳定数据库 ID。它与 `ADMIN_EMAILS` 完全分离。
- `ADMIN_EMAILS`：逗号分隔的举报审核管理员邮箱，只授予 Reports 审核能力，不授予站主 Projects/精选内容管理权。
- `CORS_ORIGIN`：允许的前端来源，可使用逗号分隔的多个来源。
- `TEST_DB_NAME` / `TEST_UPLOAD_ROOT`：自动化测试专用数据库和上传目录，禁止指向生产数据。

站主资料必须通过个人资料设置公开并填写后，首页、About、作者页和站主 API 才会展示；未配置或不可公开时使用空状态，不虚构姓名、经历、项目或系列。

## 常用质量门禁

```bash
npm run typecheck
npm run build
npm run api:check
npm run test:lrc
npm run test:unit
npm run test:api
npm run test:e2e
npm run test:security
npm run test:visual
npm run test:performance
npm run test:all
```

视觉测试覆盖 Light/Dark 的 1440、1280、1024、768、390 viewport；性能脚本分别验证 Long、Math、Comment-heavy fixtures，并记录 Lighthouse requested URL 与 final URL。真实部署没有凭据时，生产匿名/作者/第二账号验证必须标记为 `Needs Production Verification`，不能用测试数据库证据替代。

视频元数据读取依赖系统中的 FFmpeg/ffprobe。上传失败时请检查 FFmpeg 是否已安装并加入 PATH。

## 仓库约定

- 不提交 `.env`、数据库备份、`api/uploads/` 或本地媒体目录。
- 变更后运行 `git diff --check`，再按模块运行对应 focused test 和质量门禁。
- 保留既有博客、社区、认证、Reports 和私人工作台路由；迁移期间旧入口不得静默删除。
- 历史审计材料归档在 [`docs/history/`](docs/history/)，当前第五轮证据以 [`docs/fifth-pass-product-audit.md`](docs/fifth-pass-product-audit.md) 为准。
