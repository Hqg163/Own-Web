# Own-Web

Own-Web 是一个基于 Vue 3 + TypeScript + Vite 的个人网站，后端使用 Express，数据存储使用 MySQL。当前包含首页、个人资料、学习区、站内邮件，以及图片、视频和音乐管理模块。

## 项目结构

```text
.
├─ src/
│  ├─ components/
│  │  ├─ layouts/              # 全局布局
│  │  ├─ views/                # 页面与个人中心子页面
│  │  └─ router/               # Vue Router 路由与登录守卫
│  └─ services/http.ts         # Axios 统一配置与 Cookie 请求入口
├─ api/server.js               # Express API、MySQL、认证与文件接口
├─ api/uploads/                # 本地上传文件，不进入 Git
├─ .env.example                # 环境变量模板
├─ package.json                # 前端与 api workspace 的统一入口
└─ package-lock.json           # 统一依赖锁文件
```

## 本地运行

1. 复制 `.env.example` 为 `.env`，填写本地 MySQL 连接信息和随机 `AUTH_SECRET`。`.env` 不应提交到 Git。
2. 安装依赖：

```bash
npm install
```

3. 启动后端：

```bash
npm run api:dev
```

4. 另开终端启动前端：

```bash
npm run dev
```

前端开发服务器默认运行在 `http://localhost:5173`，API 默认运行在 `http://localhost:3000`。Vite 会代理 `/api` 请求。

## 常用命令

```bash
npm run typecheck   # Vue/TypeScript 类型检查
npm run build       # 生产构建
npm run preview     # 预览生产构建
npm run api:check   # 后端语法检查
npm run api:start   # 生产方式启动后端
```

视频元数据读取依赖系统中的 FFmpeg/ffprobe。若视频上传后无法读取时长、帧率或帧数，需要确认 FFmpeg 已安装并加入 PATH。

## 认证与文件安全

- 登录成功后由后端写入 HttpOnly Cookie，前端 Axios 使用 `withCredentials` 携带会话。
- 除注册、登录和健康检查外，API 默认要求认证，并用服务端会话用户 ID 做资源归属校验。
- 上传文件通过受保护的流接口访问，不再依赖公开 `/uploads` 静态目录。
- Markdown 预览经过 DOMPurify 清理；邮件正文和文件名按纯文本渲染。
- 数据库密码、JWT 密钥和跨域来源通过环境变量配置。

当前认证迁移保留了部分旧的 `userId` 请求字段，以兼容已有页面；后端已不再信任它来决定数据归属。后续可以继续删除这些冗余字段，并补充数据库迁移、自动化测试和刷新令牌机制。

## Git 约定

- 不提交 `.env`、数据库备份、`api/uploads/` 和本地媒体目录。
- 每次只暂存本次主题相关文件，例如 `git add api/server.js package.json`，避免使用 `git add .` 把个人资源带入提交。
- 每个独立改动先运行对应验证，再提交清晰、可回滚的小提交。
- 推送前检查 `git status`、`git diff --check` 和 `git log --oneline`。

仓库历史曾经包含数据库连接密码的硬编码版本。即使当前代码已移除，也应先修改数据库密码，并在确认没有协作者依赖后，再评估使用 `git filter-repo` 等工具清理历史；历史重写前必须备份并通知所有协作者。
