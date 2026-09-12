# Own-Web AI/RAG v1 整改 Gap Audit

> 审计日期：2026-09-12。本文是整改 Goal 的恢复索引，不包含任何密钥、Cookie、内部端点或原始异常。状态以代码静态审计和已记录的本机检查为准；Mock 通过不等同于真实 Provider 或真实 RAG 通过。

## 审计基线

| 项目 | 已确认事实 |
| --- | --- |
| 分支与基线 | `codex/community-blog-v1`，整改起点为 `2ca95c4`。 |
| 用户工作区 | `.codex/HANDOFF.md` 已暂存，属于用户内容；任何 AI 提交均不得修改、取消暂存或包含它。 |
| 本地运行条件 | `.env` 存在且受 Git 忽略保护；仅做存在性检查后，AI/Qwen/DeepSeek/Qdrant 均未配置。Docker CLI 不可用，WSL 尚未可用。 |
| 内容与索引 | 本机 MySQL 有 4 篇已发布公开文章，`ai_index_chunks=0`、`ai_index_jobs=0`、索引版本为 0。 |
| 既有安全基础 | `api/lib/post-access.js` 已被博客/API/AI 路径复用；AI 路由在全局强制鉴权之前挂载，并自行做 optional auth、会话和配额处理。该基础必须保留。 |

## 需求—证据—整改矩阵

| # | 强制要求 | 当前代码/运行证据 | 状态 | 整改动作与验收证据 | 负责人 |
| --- | --- | --- | --- | --- | --- |
| 1 | 保持产品运行时为 Single Agent，Codex 开发采用 A–F 多 Agent；所有阶段可恢复、不可因外部依赖缺失而误报完成。 | `api/ai/agent/workflow.js` 已是单工作流；`docs/AI_V1_REMEDIATION_STATE.md` 已记录 Goal、外部阻塞与恢复命令。 | 部分完成 | 每 2 个 Phase 或 3–5 个大任务更新 state；完整矩阵、每阶段 commit、实测门与阻塞状态须对应。 | A、F |
| 2 | 全局入口始终可发现；disabled/unconfigured 也打开安全状态面板，且桌面/窄屏/极窄屏分别满足浮层、bottom sheet、全屏体验。 | `src/components/ai/AiPanel.vue` 用 `availability !== 'disabled'` 控制入口；`AiChatSurface.vue` 在不可用状态禁用输入。 | 未完成 | 移除入口隐藏条件，展示受控产品状态；按 1440px/390px、明暗模式和 reduced motion 做浏览器/视觉验收。 | B |
| 3 | `/ai` 必须是会话侧栏 + 对话主区，移动端历史使用抽屉；空状态、来源、fallback、流式状态、错误重试、Memory、确认删除均可用且无障碍。 | `src/components/views/AiPage.vue` 为基础网格；`AiChatSurface.vue` 有复制/反馈/停止/重生成与来源卡，但无完整 context chip、状态层级或对话侧栏抽屉。 | 部分完成 | 以现有 token、`AppIcon.vue`、dialog 为基础重构；检查 initial focus、focus trap、Esc、焦点恢复、axe 和移动端。 | B |
| 4 | 文章与选区 AI 必须传递受限 Context Chip；快捷动作受服务端枚举约束；客户端不得提交或信任文章标题、可见性、作者等事实。 | `api/ai/routes.js` 的 `pageContext` 仍接收 `title`；`src/services/ai.ts`/`PostDetail.vue` 已传文章 ID、选文、heading、anchor；服务端 Context Builder 会重新读文章。 | 部分完成 | 增加 `quickAction` 严格枚举，服务端映射意图；UI 增加查看/移除 context；不再由浏览器发送 `title`。覆盖选区弹层键盘、视口夹紧/翻转、移动端与锚点跳转。 | B、C |
| 5 | 安全 `GET /api/ai/status` 始终可用，固定 `disabled/unconfigured/degraded/ready`，只给出 feature/chat/RAG/index 就绪状态和安全说明。 | `api/ai/routes.js` 只有 `/models`、会话、Memory、反馈、chat；所有现有 AI API 先经 `aiAvailable`，不存在 `/status`。 | 未完成 | 新增不泄露 Key、Cookie、端点、原始异常的状态 endpoint；UI 只依赖该契约显示不可用/降级原因。单测 disabled、未配置、Qdrant 故障、可用和泄密回归。 | C、E |
| 6 | Chat 协议应支持受控 quick action、模型持久化；SSE 需转发 `start/status/delta/citation/tool_start/tool_end/usage/done/error`，且状态不得暴露推理。 | `chatSchema` 没有 `quickAction`；会话 PATCH 仅接受 `title`；`api/ai/routes.js:205–229` 缺 `status` SSE。 | 未完成 | 扩展严格 Zod schema、`selectedModel` PATCH/新建持久化与 client stream parser；只发“分析、检索、读取、调用工具、生成”等产品状态。验证 abort、错误顺序、会话 IDOR。 | C、B、E |
| 7 | Qwen/DeepSeek 真实 OpenAI-compatible Provider 必须支持非流式和流式 Function Calling；流式按 index 聚合 tool call delta，回填 `role: tool`。 | `api/ai/providers/chat-provider.js` 明确返回 `tools: false`，请求只含 model/messages/temperature/max tokens，SSE 只读取文本 delta。 | 未完成 | 定义统一 tool-capable Provider 契约，传递 `tools/tool_choice`，解析非流式及 stream `tool_calls`，按 ID/index 聚合 arguments，并将真实调用痕迹映射为 SSE tool 事件。 | C |
| 8 | Router 只选宏路径；由 LLM 决定是否调用受限只读 Skills。Skill 必须 allowlist、Zod、预编译 SQL、授权、超时、大小限制，最多 3 rounds。 | `workflow.js` 目前根据 Router 决策直接调用 `skills`；`skills.js` 已有注册表/Zod/授权的基础；`AI_MAX_TOOL_ROUNDS=3` 已配置。 | 部分完成 | 把 Site/Project/Series/Related/Article lookup 的选择交给真实模型 tool calls；保持 `ContextBuilder → Router → RAG/Tool → Gateway → Composer` 单 Agent；测试非法工具、非法参数、循环上限、模型未调用工具的路径。 | C、E |
| 9 | 拆分 Qwen Chat/Embedding/Rerank endpoint，兼容旧 `QWEN_BASE_URL`；Rerank 使用 `compatible-api/v1/reranks`；不对前端暴露端点。 | `api/ai/config.js` 只有 `qwen.baseUrl`；embedding 追加 `/embeddings`，reranker 追加错误的 `/rerank`；`.env.example` 没有 rerank override。 | 未完成 | 新增 Chat/Embedding/Rerank 明确配置与旧变量兼容优先级；修正 rerank 路径；presence-only 配置诊断和 endpoint contract tests。 | C、D |
| 10 | Registry 必须与真实能力一致：Qwen `qwen3.8-flash` 1M、Function Calling；DeepSeek `deepseek-v4-flash` 1M、标签 DeepSeek Flash，未配置隐藏/禁用；一次性回退 Qwen。 | `model-registry.js` 报 Qwen `supportsTools: true` 但 Provider 不支持，两个 context window 都是 32768；标签为“DeepSeek V4 Flash”。 | 未完成 | 修正 capability/metadata/显示标签；启动期验证 Registry 对应 Provider，禁止虚假能力；验证 DeepSeek 未配置、故障一次 fallback、UI 安全提示。 | C、B |
| 11 | 配额必须抗并发超卖；消息中断须取消上游、保存 aborted/估算 usage，日志仅含脱敏审计字段。 | `rate-limit.js` 已实现主体/IP/全局额度与并发概念；`routes.js` 已有 AbortController、aborted 消息和 usage 记录，但未确认 DB reservation 原子性。 | 部分完成 | 将 quota reservation/release/record 设计为 DB 事务或原子条件更新；并发测试防超卖；验证上游取消、真实/估算 usage、日志不含私密内容/密钥。 | C、E |
| 12 | Qdrant 1.19 应为 dense 1024 Cosine + BM25 IDF；ingest 与 query 统一 multilingual、无 stemmer、空 stopwords；连接/认证失败不能伪装 collection 缺失。 | `docker-compose.yml` 钉住 `qdrant/qdrant:v1.19.0` 并仅绑定 localhost；`qdrant.js`/indexer/retriever 已有 dense+BM25+RRF 基础，但当前 tokenizer 只有 multilingual，未见完整 stemmer/stopwords 契约；Docker 不可用。 | 部分完成 | 调整 schema/inference 参数和错误分类；真实 Compose smoke 验证 schema、认证、中文/英文/术语/路径查询。 | D |
| 13 | RAG 检索固定 Dense Top20 + BM25 Top20 + RRF + rerank Top5，MySQL 二次授权，LOW 拒答，每文最多 3 chunks；当前文章/选文优先与覆盖度应完整。 | `retriever.js` 已实现混合候选、RRF、rerank fallback、重新 hydration；`confidence.js` 有阈值。真实 Qdrant、embedding、rerank 未运行，当前索引为 0。 | 部分完成 | 以真实 4 篇文章回填并记录 chunk/point count；验证 current article、selection 邻块、密集/稀疏/RRF/rerank fallback、LOW 拒答、引用可跳转。 | D、E |
| 14 | 索引生命周期：创建、编辑、发布、定时发布、可见性变更只排队；删除前 tombstone 并异步删 point；作业应 action、lease/recovery、retry、同文合并；backfill 有准确统计。 | `api/scripts/ai-index.js` 仅支持 `backfill/post/retry`；`ai_index_jobs` 现有基础队列。删除可能在 DB cascade 后才处理，未见 tombstone/lease/scheduled 保障。 | 未完成 | 增加 action/tombstone/lease 字段和迁移；将所有文章生命周期挂钩为非阻塞 enqueue；覆盖删除、延迟发布、失败恢复、重复合并和统计。 | D、A |
| 15 | 所有 RAG、Skill、文章/选区路径都必须服务端重读并执行 public/private/followers/unlisted/share token 权限，绝不信任 UI。 | `api/lib/post-access.js` 已复用于 AI；`tests/unit/ai-security.test.ts` 已覆盖 Qdrant hydration 与注册 Skill 的权限再检验。 | 部分完成 | 扩展真实数据库与 live RAG 覆盖 A/B conversation/memory、draft、followers、unlisted 无 token/有效 token、删除后旧 point；保持现有博客响应不变。 | E、D、C |
| 16 | `ai:doctor` 必须脱敏诊断 migration、配置、Qdrant、schema/count、embedding、rerank、chat，并返回 PASS/FAIL、计数、request ID。 | `package.json` 只有 index/eval 命令，未发现 `ai:doctor`。 | 未完成 | 新增单独 CLI，不能输出变量值、完整 URL 或响应体；分别测试无 Docker、无 Key、故障 Qdrant、live configured 成功。 | D、C、E |
| 17 | 评估集需基于真实 4 篇文章，20–50 条 ground truth；必须有真实 Recall@K、citation correctness、answerable accuracy、hallucination、permission leakage、latency。 | `api/ai/evals/own-web-eval.json` 有 20 条，但 `expectedCitationSlugs` 均为空；`AI_EVALUATION.md` 说明多个 live 指标为 null。 | 未完成 | 用真实 slug/chunk 与人工答案标注重建 fixture；显式区分 mock contract、Qdrant integration、live provider、live RAG，未执行项保持 BLOCKED/FAIL，不填 PASS。 | D、E |
| 18 | 必须完成 Qwen chat/stream/tool calling/embedding/rerank/RAG/citation/LOW confidence、文章 Ask AI、Memory、模型切换的真实验收；DeepSeek 可选。 | `.env.example` 默认 `AI_ENABLED=false`、mock；state 记录 Qwen/DeepSeek/Qdrant 未配置，Docker CLI 不可用。 | BLOCKED_EXTERNAL | 用户完成 WSL2+Docker Desktop 与本机忽略 `.env` 的 Qwen 配置后，仅检查变量存在性；启动 Qdrant、backfill，再执行 live suite 与浏览器六流程。DeepSeek 无 Key 时列为 optional-blocked。 | D、C、B、F |
| 19 | 安全与回归：Prompt/Tool injection、XSS、IDOR、visibility、quota/concurrency、abort、fallback、status 不泄密；现有功能不得回归。 | `test:ai-security` 已存在，`tests/unit/ai-api.test.ts` 用 mock workflow；未见 status、真实 tool-call、DB reservation、live protected fixture 的端到端覆盖。 | 部分完成 | 补充 unit/API/E2E/security 用例；每 Phase 跑 targeted tests、typecheck、build、api check、diff check，最终跑 mock+Qdrant+live+API/E2E/visual/performance/test:all。 | E、F、B |
| 20 | 文档、部署和 Git 必须说明密钥、Qdrant 内网/API key、备份、健康检查、重建、额度、live tests，并逐主题提交；不得提交 secret 或 HANDOFF。 | 已有 `AI_SETUP.md`、`AI_SECURITY.md`、`AI_EVALUATION.md`、`AI_ARCHITECTURE.md`；它们仍描述通用 `QWEN_BASE_URL` 和 Mock/live opt-in，未覆盖本整改完整闭环；`.env.example` 默认安全。 | 部分完成 | 更新文档和 README；每个逻辑主题明确 stage 指定文件；`git diff --check` 后提交，持续核查 `.env` 与 `.codex/HANDOFF.md` 未进入提交。 | A、F |

## 有序依赖与恢复顺序

1. **Phase 0（当前）**：提交 state 与本文，冻结约束和 API 契约；在没有 Docker/Key 时只做可重复的 Mock/静态检查。
2. **Phase 1**：先实现 status、受控 quick action、会话模型持久化与客户端状态契约，再重做全局面板、`/ai`、文章选区交互；避免 UI 依赖猜测基础设施状态。
3. **Phase 2**：实现 endpoint 拆分、真实 Provider capabilities、Function Calling loop、SSE 状态、配额 reservation 与安全日志；Mock 回归必须仍稳定。
4. **Phase 3**：实现 Qdrant 1.19 参数、作业 tombstone/lease/recovery、doctor、真实 ground-truth 评估集；此阶段的真实检索验收依赖 Docker 和 Qwen embedding/rerank。
5. **外部恢复门**：用户按安全教程安装 WSL2/Docker Desktop，并在被忽略的本地 `.env` 或当前 shell 配置 Qwen；Codex 仅输出 configured/not configured，绝不读取或回显秘密。
6. **Phase 4**：启动 localhost Qdrant，backfill 真实文章，要求非零 chunks/points，再跑 chat、stream、LLM tool call、embedding、rerank、RAG、citation、LOW confidence 与六条浏览器流。
7. **Phase 5–6**：执行真实权限/注入/IDOR/配额安全验证、全量回归、文档、逐主题提交。任何必需 live gate 未通过时更新 state 为 `BLOCKED_EXTERNAL` 或 `FAIL`，不得结束 Goal。
