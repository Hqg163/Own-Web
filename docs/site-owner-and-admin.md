# 站主与管理员配置（Phase B）

站主身份和举报管理员是两条独立的权限边界：`SITE_OWNER_USER_ID` 决定谁可以管理公开个人网站内容（Projects、Series、精选文章等），`ADMIN_EMAILS` 只决定谁可以进入举报审核 API。把邮箱放进 `ADMIN_EMAILS` 不会自动成为站主。

## 获取当前账号的用户 ID

`GET /api/me` 需要当前登录会话，并返回当前会话对应的用户信息。不要从浏览器提交的 `userId`、URL 参数或前端状态推断站主 ID。

登录后可以检查：

```http
GET /api/me
```

响应中的 `user.id` 就是当前账号的数据库用户 ID：

```json
{
  "user": {
    "id": 123,
    "email": "owner@example.com"
  }
}
```

也可以在 Own-Web 使用的数据库中按登录邮箱查询：

```sql
SELECT id, email, username
FROM users
WHERE email = 'owner@example.com';
```

以数据库返回的 `id` 为准。生产环境应使用实际账号和数据库连接，不要把生产数据复制到测试库来验证配置。

## 设置服务器端环境变量

只在 Express 所在服务器的 `.env` 中设置：

```env
SITE_OWNER_USER_ID=123
ADMIN_EMAILS=admin@example.com,moderator@example.com
```

`SITE_OWNER_USER_ID` 必须是 `users.id` 的稳定值。未配置或站主资料未公开时，公开站主接口保持空状态（`{ "owner": null }`），不会虚构身份。

`ADMIN_EMAILS` 使用逗号分隔的登录邮箱。它只授予举报审核能力；Projects、Series 和站主精选内容仍要求已登录用户同时满足站主身份和数据所有权检查。邮箱比较以服务端规范化后的登录邮箱为准。

配置修改后必须重启 Express API 才会生效。例如在前台运行的进程中停止旧进程，再执行：

```bash
npm run api:start
```

如果由进程管理器托管，则重启对应的 Express 服务；仅刷新浏览器或重启 Vite 不会重新读取服务器端 `.env`。

## API smoke 接入

Phase B 的迁移回归测试位于 [`tests/api/sixth-pass-migration.ts`](../tests/api/sixth-pass-migration.ts)。它会创建带随机后缀的唯一临时数据库，启动正常 Express 初始化流程（由初始化流程调用 `api/migrations.js` 的 `runMigrations`），然后再次直接调用 `runMigrations` 检查幂等性。测试不手工创建 `projects`、`series` 或 `posts` 等业务表，只检查迁移后的表、字段、索引和外键，结束时只删除它自己创建的临时数据库，不使用 `TEST_DB_NAME`。

迁移 smoke 已接入 `npm run test:api`，也可以在仓库根目录单独运行：

```bash
npm run test:api
# 或仅运行迁移 smoke
npx tsx tests/api/sixth-pass-migration.ts
```

执行前需要服务器端 `.env` 中的 `DB_HOST`、`DB_PORT`、`DB_USER`、`DB_PASSWORD`，测试不会连接或清理现有 `TEST_DB_NAME`。

## 安全注意事项

- `.env` 包含数据库密码、认证密钥和权限配置，禁止提交 Git；`.gitignore` 应保持对 `.env` 的忽略。
- 只提交不含真实凭据的 `.env.example` 或文档示例。
- 生产配置变更后先重启 Express，再用登录账号请求 `GET /api/me` 和站主/管理员相关 API 验证结果；不要用隐藏前端按钮作为权限证明。
