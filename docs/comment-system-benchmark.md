# 评论系统交互基准（第三轮设计依据）

> 记录日期：2026-08-29。本文是交互取舍记录，不是对任何平台全部功能的完整复刻，也不构成 Own-Web 生产行为的验证证据。引用页面由任务需求提供，结论只提炼通用模式。

本文件只提炼公开平台的通用交互模式，不复制品牌、颜色、Logo 或页面布局。Own-Web 采用自己的编辑型视觉系统。

## 观察到的通用模式

| 平台 | 可借鉴模式 | Own-Web 的取舍 |
| --- | --- | --- |
| 微博 | 评论可以按热度或时间查看；热度综合点赞、回复和时间等信号 | 提供最新、最早、热门；热门采用可解释的时间衰减，不永久按点赞数排序 |
| YouTube | Top/Newest 排序、线程回复、点赞、举报、作者管理和软删除反馈 | 采用 Root + Flat Reply Thread、评论点赞、More 菜单和作者删除权限 |
| 知乎 | 内容作者可控制开放/关闭等评论模式，评论是内容讨论的独立层 | 保留文章 `allow_comments`，把评论区作为文章阅读后的独立讨论区 |
| 小红书 | 评论是公开互动场景；作者可关闭评论；举报入口靠近具体评论 | 评论举报放在每条评论 More 菜单，关闭评论后保留历史内容和明确状态 |
| Bilibili | 普通用户可点赞、回复、举报，管理者拥有更高的删除/审核权限 | 普通用户只操作自己的内容；文章作者可管理文章下评论；不引入复杂后台 |
| GitHub Discussions | 评论支持编辑/删除，维护者可以治理、锁定或突出重要内容 | 本轮只实现必要的删除/举报/折叠/排序，不引入答案标记或讨论锁定 |

## 设计结论

- 评论元信息采用头像、用户名、作者 badge、相对时间和完整时间 title 的层级。
- Root 评论保持平面列表；回复限制为视觉两层，回复别人时记录 `reply_to_comment_id`，避免移动端无限右移。
- 评论主体保持纯文本；Emoji 是内容而不是 UI 图标，Emoji Picker 使用共享 `AppIcon` 作为入口。
- 图片作为独立受权限保护的媒体资源，发布前支持预览、删除和排序。
- 讨论量较大时 Root 分页，回复首屏折叠并按需加载；默认最新，另提供最早和热门。
- 删除保留占位，举报进入已有 reports 体系；所有写入和上传均受服务端授权、限流和安全校验保护。

## 与本轮接口的对应关系

| 交互决策 | Own-Web 实现证据 |
| --- | --- |
| Root + Flat Reply Thread | `comments.root_comment_id`、`reply_to_comment_id` 和兼容 `parent_id`；`GET /api/posts/:id/comments`、`GET /api/comments/:id/replies` |
| Latest / Oldest / Hot | 评论列表 `sort` 参数、游标分页、热门时间衰减；默认最新 |
| Like / Delete / Report | `comment_likes`、`POST/DELETE /api/comments/:id/like`、软删除、`/api/reports` |
| Image lifecycle | `comment_media` 待绑定记录、同事务绑定、最多 9 张/单张 5 MB/单评论 30 MB、权限媒体 URL |
| Safety boundary | 纯文本渲染；服务端 owner/visibility/share-token 校验；MIME、magic bytes、尺寸、SVG、脚本片段和 polyglot 校验；用户/IP 独立限流 |

本轮没有引入评论编辑、讨论锁定、答案标记或重量级图片编辑器；这些属于后续产品决策，不应在报告中写成已实现能力。

## 参考资料

- [微博客服：热门评论相关问题](https://kefu.weibo.com/faqdetail?id=21749)
- [YouTube Help：View, organize, or delete comments](https://support.google.com/youtube/answer/6000976?hl=en)
- [知乎机构号：评论管理与互动能力](https://www.zhihu.com/org-intro)
- [小红书社区帮助：互动与举报规范](https://pgy.xiaohongshu.com/help/detail?id=1eda0a065dd894063c2e029a49e8f6a1)
- [Bilibili 举报入口](https://message.bilibili.com/h5/app/report)
- [GitHub Docs：Moderating discussions](https://docs.github.com/en/discussions/managing-discussions-for-your-community/moderating-discussions)
