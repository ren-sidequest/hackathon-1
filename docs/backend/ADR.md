# EvidenceBridge 最小后端架构决策

日期：2026-09-19。范围：单机合成案例、单任务、单次正式提交、单次人工审核；决策用于本轮本地实现，非生产架构或真人团队审批记录。

依据：用户冻结的完整参赛方案修订 2，第 7、8、9、10、16 节，以及仓库[产品蓝图](../product/EvidenceBridge_PRODUCT_BLUEPRINT.md)与[交互基线](../product/EvidenceBridge_BASELINE.md)。本轮指示取代旧前端演示中的重新补交、重开审核行为；未引入上传、岗位 CRUD 或账号平台。

## ADR-01：TypeScript + Fastify + SQLite 单服务

**状态：用户已确认增强版 B。** 已比较 A：Node 原生 HTTP + SQLite、B：Node + Fastify + SQLite、C：FastAPI + SQLite、D：独立 Postgres。采用 TypeScript（strict）+ Fastify + SQLite，并由接口 schema 生成自动接口文档。框架 schema 和生命周期支持降低手写路由校验的维护成本，类型检查辅助保持合同一致。两个现有前端目录保持原样。业务接口维持六个，另加独立只读健康检查与自动文档入口。

**理由。** 当前前端已依赖 Node/npm；单案例、小请求量适合一个进程和一个本地数据库文件。SQLite 事务提供正式提交、审核及幂等记录的原子性，避免内存或浏览器存储被误称为跨端持久化；保持团队启动步骤与依赖面较小。

**代价。** 引入锁定的框架、文档插件和 TypeScript 开发依赖；运行前增加编译步骤。schema 承载请求合同，来源逐字核对、幂等、状态顺序仍由领域层处理并测试，避免误以为框架自动保证业务正确。同步 SQLite 只用于短事务。推荐 Node 24 LTS，最低版本和原生 SQLite 可用性由启动检查明确，突出与部分旧前端最低版本的差异。不增加 ORM、任务队列或独立数据库服务。

## ADR-02：不可变公开作品与四类独立状态

**决定。** 草稿及私人笔记保留在 Candidate 本地；共享服务只接收白名单公开作品：`summary`、`findings`、`processEvidence`，保留现有卡片与事件结构。服务端校验长度、枚举、唯一 ID、资源来源及字段集合，拒绝额外的 `notes` 字段。正文与嵌套字段均受同一白名单原则约束。

正式提交一次性保存快照和服务端时间，绑定 `taskId`、`submissionId`、`datasetVersion`、会话代次与内容指纹。指纹来自确定性序列化的公开作品；引文定位使用已保存文本本身，不对展示引文另行改写。后续请求不修改快照，重演走显式 reset，而非覆盖提交。

四类概念分开持久化：

| 概念 | 语义 | 关键约束 |
| --- | --- | --- |
| 任务进度 | 未发送、已发送、已提交、已审核 | 工作中草稿不等于正式提交 |
| AI 分析 | 未开始、运行中、成功、失败 | 成功只表示观察提取完成 |
| 人工审核结果 | Confirm / Needs More Evidence / Evidence Still Insufficient | 三者都是本次审核终点，不是录用结论 |
| 岗位证据支持 | Supported / Uncertain / Verified through targeted task | Confirm 仅更新 Business Problem Solving；另外两项保持初始支持情况 |

两种不足结果保留 `Uncertain`、审核备注和剩余未知；不重新开放提交。AI 失败仍保留作品供人审，人工审核可直接基于真实提交，不依赖模型成功。正式字段名与完整错误响应以后端接口合同和可执行 schema 为准，不在本文重复维护第二份合同。

## ADR-03：短事务、幂等与 reset 代次

**决定。** 每次业务写入绑定当前随机会话 ID；reset 原子替换为新会话。幂等键按会话、方法和路径隔离，并绑定规范化请求摘要：同键同请求返回原结果；同键异请求冲突。不同键重复提交或审核亦遵守单次约束，避免通过换键绕过业务顺序。任务状态、正式对象及幂等结果在同一事务内提交。

AI 外部调用放在事务外：短事务登记分析 attempt，再调用模型，返回后短事务核验会话、提交 ID、内容指纹和 attempt。reset 或旧请求返回后只丢弃失效结果，不写入新会话。运行中请求的重复行为必须有确定状态响应；失败允许显式新尝试，但不删除作品。进程启动将中断的分析标记为失败/可重试，而非永久停留在运行中。

**代价。** 这是单案例冲突控制，不是完整事件溯源、版本历史或分布式调度。数据库文件与 SQLite 辅助文件是本机运行状态，排除 Git；刷新和进程重启由相同文件恢复，reset 使用新会话让旧浏览器提交明确失效。

## ADR-04：可定位观察优先于模型“评价”

**决定。** 固定五维观察：Problem Framing、Evidence Navigation、Hypothesis Formation、Evidence Seeking、Decision Making。模型仅分析当前公开快照和明确标识的固定案例背景，作品中的指令作为材料处理；不加入私人笔记，不输出总分或录用决定。

每个有观察的维度须提供实际存在的来源 ID、字段定位、逐字引文、观察范围与剩余不确定性。服务端复核来源所属当前快照、引文确实出现在所指字段、schema 和五维唯一性；无依据的维度明确记为尚未观察到。过程事件只表示候选人提交的过程记录，打开文件本身不证明掌握能力。候选人提出的因果说法只是其文本主张，不因引用真实就被认证为正确。

模型适配层隔离提供者协议、服务端凭据、输入/输出大小、超时、有限重试与结构校验。模型失败返回稳定错误，保留快照，避免把网络、格式或引文错误伪装成成功观察。分析结果始终绑定提交与指纹，输入变化或重置后旧结果失效；同义改写不要求结论变化。

**展示与验证。** 实时模型、真实运行后保存的回放、手工模拟分别标注。测试 stub 只验证工程规则，三类材料（有依据、无依据、混淆因果）的确定性测试不等于模型效果实验。真实运行尚未完成时据实列为待验证，不虚构运行记录、人工核验或模型质量指标。若后续保存真实回放，应连同合成输入、提示词版本、模型标识、时间和核验记录成对留存；原始提供者响应不写通用日志。

**提供者协议。** 服务端适配器使用 OpenAI Responses 的 `text.format` 严格 JSON Schema；设置 `store: false`，从 `output` 内实际文本消息读取 JSON，不依赖 SDK 的便捷属性。协议依据为已查阅的 [OpenAI 结构化输出文档](https://developers.openai.com/api/docs/guides/structured-outputs)和 [Responses 迁移说明](https://developers.openai.com/api/docs/guides/migrate-to-responses)。`store: false` 不是零数据保留承诺。产品模型 ID 由服务端显式配置，不把开发代理的模型选择自动当作产品 API 配置。

## ADR-05：本机演示边界与交接

**决定。** 服务只绑定 loopback，显式校验 Host 和允许的前端 Origin；不启用通配 CORS。敏感写入尤其 reset 使用本机演示控制凭据，凭据从环境读取并留在服务端/操作端配置，不进入共享响应、仓库或模型输入。健康检查只展示必要运行状态；错误与日志记录请求 ID、稳定错误代码等元数据，不记录作品、笔记、密钥或提供者原始错误正文。

**边界。** loopback 和演示控制凭据不是多角色生产认证；同一电脑仍是受信任演示环境。GitHub Pages 继续是静态展示，跨公网调用、真实候选人数据、付费调用或部署另行决定。允许现有 Vite 开发/预览服务访问同一 API，暂不为减少端口而修改两端页面；交接明确端口、允许 Origin、请求顺序、reset 及重启恢复。

**验收。** API 测试客户端验证发送→唯一测试句提交→读取相同快照→引用定位→人工审核仅影响目标要求→重读→重置重演，以及顺序错误、重复请求、过期会话/提交、私有字段、模型失败、重启恢复。现有前端回归另行运行。阶段结论区分“后端验收完成”与“双端 UI 联调待小傅接入”，不以 API 成功替代 UI 已接通。

## 依赖来源核验（2026-09-19）

采用官方项目资料，不按 stars 单独判断质量。GitHub 只读核验时，[Fastify](https://github.com/fastify/fastify) 为 Fastify 组织维护、37,153 stars；[Swagger 插件](https://github.com/fastify/fastify-swagger) 同组织、1,095 stars；[TypeScript](https://github.com/microsoft/TypeScript) 为 Microsoft 维护、111,107 stars；这些仓库均未归档并有近期活动。也抽查了 Fastify 当前 Issue，空/缺失请求体属于需关注边界，本服务采用强制 JSON 与 body schema，并在测试覆盖该类错误，而非仅凭流行度假定正确。

[TypeBox 主仓](https://github.com/sinclairzx81/typebox) 当时为 6,962 stars；本项目锁定的是同维护者 [`@sinclair/typebox` 0.x LTS 分支](https://github.com/sinclairzx81/sinclair-typebox)，该分支拆分后的仓库只有 11 stars，README 明确标为 LTS，包声明 MIT。选它是为与 Fastify JSON Schema 配合并由同一 schema 推导 TypeScript 请求类型，未把主仓 stars 冒称为分支数据。所有直接依赖精确锁版，传递依赖与完整性摘要在 package-lock.json；查询时后端 npm audit 为 0，仍不是无漏洞保证。未安装外部 skill 或引入陌生代码模板。
