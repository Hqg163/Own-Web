# Own-Web 管理员配置与举报审核

## 配置管理员

在服务器端 `.env` 设置管理员登录邮箱：

```env
ADMIN_EMAILS=your-account@example.com
```

多个管理员使用逗号分隔：

```env
ADMIN_EMAILS=admin1@example.com,admin2@example.com
```

邮箱必须与 Own-Web 实际账号的登录邮箱一致。配置修改后重启 Express API 才会生效。`.env` 及其中的账号信息不得提交 Git。

## 举报审核

管理员打开 `/admin/reports`，可以按待处理、审核中、已处理和驳回筛选举报。详情页提供举报类型、说明、证据图片、提交时 Snapshot、当前目标链接和时间线。

“开始审核”只更新审核状态；“确认违规”和“未发现违规/驳回”需要填写用户可见处理说明。`internal_note` 只对管理员可见，不会进入普通用户举报 API、通知或证据图片响应。

本轮举报工作台不自动删除文章、评论或封禁用户。此类不可逆 Moderation Action 需要后续独立的权限和审计设计。
