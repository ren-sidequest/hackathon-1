# EvidenceBridge 后端接口合同 v1.0

固定 HarbourCart / Junior Data Analyst / Alex Chen；一个任务、一次正式提交、一次人工审核。运行说明见 [README](../../app/backend/README.md)，完整机器合同见 [openapi.json](openapi.json)，实际测试见 [TEST_RESULTS](TEST_RESULTS.md)。

## 1. HTTP、响应与调用顺序

默认 base：`http://127.0.0.1:8787`。顺序：`GET → send → submission → analysis（可失败）→ review → GET`。需要重演时单独 reset，再 GET 新绑定。模型失败不影响原作品和人工审核能力。

| 接口 | 必要请求内容 | 成功状态 / 行为 |
| --- | --- | --- |
| `GET /healthz` | 无 | 200 `{status:"ok",storage:"sqlite"}`；本地存储检查 |
| `GET /api/demo` | 无 | 200 当前完整共享状态 |
| `POST /api/demo/task/send` | 基础绑定 + `instructions` | 200，仅 draft 可发送 |
| `POST /api/demo/submission` | 基础绑定 + `candidateId,summary,findings,processEvidence` | 201，不可变正式快照 |
| `POST /api/demo/analysis` | 基础绑定 + `submissionId,contentFingerprint` | 200 成功；同键进行中重试可得 202；失败 502/503 |
| `POST /api/demo/review` | 分析请求字段 + `requirementId,decision,comment` | 200，保存唯一人工决定 |
| `POST /api/demo/reset` | `schemaVersion,sessionId` + 控制令牌头 | 200，全新会话及 taskId，清除当前提交/审核 |

`/docs` 是 Swagger UI，`/docs/json` 和 `/docs/yaml` 是运行时文档；文档插件还提供静态资源与重定向路由。这些是辅助路由，不是新的业务能力。`OPTIONS` 处理预检。

除 health 与错误外，成功响应统一为：

```json
{"data":{"schemaVersion":"1.0","sessionId":"...","datasetVersion":"harbourcart-2026-09-v1","revision":0,"candidate":{},"job":{},"application":{},"dataset":{},"task":{},"submission":null,"analysis":{},"review":null,"report":{}},"meta":{"replayed":false}}
```

上例省略展开字段；**可直接查看的完整响应**：[初始](examples/initial.response.json)、[已提交](examples/submission.response.json)、[手工模拟分析](examples/analysis.response.json)、[审核后 GET](examples/reviewed.response.json)。所有完整例子由真实内存 API 执行生成，`manifest.json` 标记 synthetic/manual fixture；里面的随机 ID 与时间只适用于那组例子。

错误形状：

```json
{"error":{"code":"STALE_SESSION","message":"Demo was reset. Reload the current case.","requestId":"server-generated-id","retryable":false}}
```

前端先判断 HTTP 状态，再读取 `data` 或 `error`；错误响应没有成功 `data`。`requestId` 用于定位，不含原作品或提供者异常正文。不要用错误英文文案判断分支，使用 `code`。

## 2. 请求字段、限制与隐私

所有 POST：`Content-Type: application/json`；`Idempotency-Key` 必填，8–100 个 ASCII 字母、数字、`_` 或 `-`，建议 `crypto.randomUUID()`。reset 额外 `X-Demo-Admin-Token`；该令牌只保护 reset，正常读/发/提交/分析/审核没有账号认证。

基础绑定：`schemaVersion:"1.0", sessionId, taskId, datasetVersion`，从最新 GET 取得。`task.id` 是固定模板 ID，**不是**本次随机 `task.taskId`。ID 字段最长 80，正则 `^[A-Za-z0-9_-]+$`。提交、分析、审核都使用当前会话；reset 只需 schemaVersion/sessionId。

| 公开字段 | 约束 / 语义 |
| --- | --- |
| `instructions` | 非空白字符串，最长 4000 |
| `summary` | 非空白字符串，最长 8000；原文保存，不 trim |
| `findings` | 数组，0–40 条；不强制每个板块有卡片，薄弱作品可正式提交供审核 |
| finding | **仅** `id,section,title,detail,source,confidence`；id 在 findings 内唯一；title 非空白最长 300；detail 最长 4000，允许空 |
| `section` | `Key Findings / Hypotheses / Additional Evidence Needed / Recommended Next Steps` |
| `source` | 最长 80；空串表示未附来源；非空须匹配 `dataset.resources[].id`（本轮等于文件名） |
| `confidence` | `High / Medium / Low`，候选人自填标签，不是模型评分 |
| `processEvidence` | 数组，0–100 条；每条仅 `id,at,title,detail?`；id 在该数组内唯一；at 为 date-time；title 非空白最长 200；detail 最长 1000 |
| `contentFingerprint` | 服务端生成的 64 位小写十六进制 SHA-256；客户端原样传回 |
| `requirementId` | 只允许本任务目标 `business-problem-solving` |
| `decision` | `confirm / needs_more_evidence / evidence_still_insufficient` |
| `comment` | 共享人工审核理由；所有三分支必填，非空白最长 2000 |

请求 JSON 总大小上限 **128 KiB**。JSON schema 不做字符串/数字强制转换、不自动去除额外字段；额外字段返回 `INVALID_REQUEST`。所有公开对象白名单均排除私人 `notes`。Candidate 的 notes 留在本地；旧 HR 表单若把审核备注叫 notes，接入时只把公开理由投影为 `comment`，不要发送整个表单/state。

完整请求：[发送](examples/send.request.json)、[提交](examples/submission.request.json)、[分析](examples/analysis.request.json)、[审核](examples/review.request.json)、[reset](examples/reset.request.json)。实际操作替换为当前 GET 的 ID；请求头参见[示例 manifest](examples/manifest.json)。

## 3. 快照、来源与内容指纹

提交成功新增 `submissionId,submittedAt,contentFingerprint,processEvidenceProvenance:"client_reported",sources`。指纹使用基础绑定、candidateId 与公开作品的规范化 JSON：对象键排序，数组顺序与文本空白保留。它不是语义指纹。正式提交无 PATCH/覆盖端点；本地编辑不改变已提交版本。

来源索引：

| sourceId | location | kind |
| --- | --- | --- |
| `summary` | `/summary` | `work_sample` |
| `finding:<id>:title` / `finding:<id>:detail` | `/findings/<index>/title` 或 `/detail` | `work_sample` |
| `event:<id>:title` / `event:<id>:detail` | `/processEvidence/<index>/title` 或 `/detail` | `client_reported_event` |

`location` 是提交内部 JSON pointer，事件 detail 未提供时没有该条来源。引用包含 `sourceId,location,quote,start,end`；偏移使用 JavaScript UTF-16 单元、end exclusive，须满足 `source.text.slice(start,end) === quote`。前端先校验当前 `submissionId/contentFingerprint`，再定位并用纯文本渲染；来源不是 HTML 或代码执行指令。

固定申请的引用另走 `application.sources` 和 `initialReport.sourceRefs`；数据引用另走 `dataset.resources`；不要把这两类 preset 引用伪装成本次候选人实际作品。

## 4. 四层状态与报告

| 字段 | 枚举 / 影响 |
| --- | --- |
| `task.status` | `draft → sent → submitted → reviewed`；工作中草稿不另存服务 |
| `analysis.status` | `not_started / running / succeeded / failed`；只影响观察提取 |
| `review.decision` | 三种结果都结束本轮；未审核时 `review:null` |
| `report.requirements[].status` | `supported / uncertain / verified`；读取 `displayLabel` 展示 |

仅 `confirm` 把目标要求改为 verified；SQL 和 Data Analysis 仍 supported。两个不足结果都保持 uncertain，任务仍 reviewed；**不重开、不重提、不恢复 working**。提交或 AI 成功都不升级报告。人工审核不要求 AI 成功；`comment` 和当前快照关联后由两端读取。`report.isHiringDecision` 恒为 false，Confirm 表示有限样本证据被人复核，不是录用。

`report.requirements[].sourceRefs` 保留初始材料引用；`submissionSourceRefs` 引用本次工作样本。更新后的未知仍存在，不把有限作品扩展为真实工作绩效或因果证明。

## 5. 幂等、并发、重启和重置

- 按 `sessionId + path + Idempotency-Key` 保存请求摘要与响应；同键同体重放原收据，成功时 `meta.replayed:true`；同键异体 409 `IDEMPOTENCY_CONFLICT`。
- 不同 key 重复 send/submission/review 仍受单次状态约束，返回 409；不会产生第二个正式提交或覆盖人工决定。失败的普通写入不会部分提交。
- 首次 analysis 请求等待本次完成。同 key 的并发重试得到 202 running 收据；完成后同 key 返回最终成功或失败收据，不重复调用模型。不同 key 在 running 时为 409 `ANALYSIS_RUNNING`。
- 已 succeeded 的 analysis 用新 key 读取保存结果，不重新调用模型；失败后新 key 可显式重试，前提是尚未完成人工审核。同旧 key 只会读到原错误。
- 已审核后不启动新分析；已有 succeeded 分析仍可读回。正在执行的分析完成只更新观察，不改变人工决定或证据状态。
- GET 和收据读回中，已保存的真实 `live` 输出标为 `replay`，保留模型、时间、responseId；只有原首次完成响应显示 live。manual_simulation 永远保持该标签。
- 进程中断时，重启将 running 改为 `failed/AI_INTERRUPTED`，关联 202 收据转为 503。客户端 GET 后决定是否以新 key 重试，不无限轮询旧收据。
- reset 原子清除当前提交、审核与旧收据，生成新 session/task。旧一般写入返回 `STALE_SESSION`。仅**最近一次 reset 收据**被保留用于同键重试，重放不会再清空随后新提交的数据；再一次 reset 后更旧收据失效。
- reset 与模型请求交错时，迟到结果返回 `STALE_ANALYSIS`，不写入新会话。不要把旧操作的历史成功收据直接覆盖当前页面；每次写成功/冲突后重新 GET。

## 6. AI 输出、配置及限制

五维固定：Problem Framing、Evidence Navigation、Hypothesis Formation、Evidence Seeking、Decision Making；每维 `{dimension,status,statement,citations,scope,uncertainty}`。`observed` 至少一条工作样本引用；`not_observed` 引用数组为空。仅客户端事件不足以构成能力观察。每维最多 5 引用，每条最长 2000 UTF-16 单元；陈述、范围与未知各为非空文本，最长 2000。

- `disabled` 为默认：不联网，分析 503/AI_DISABLED，作品仍可读。
- `manual_simulation`：显式手工规则只展示对应板块文本的存在和引文；不验证推理质量，不伪称模型已运行。
- `live`：仅服务端 OpenAI Responses，显式 key 和 model；输入含公开作品投影、6 个合成资源和固定观察规则。当前项目未有真实调用记录。
- 模型输入 JSON 默认上限 96000 UTF-8 bytes（含资源/来源投影；额外提示词和 schema 另占请求空间）；提供者响应流上限 64000 bytes；`max_output_tokens:4000`。超时默认 20 秒，env 可在 100–60000ms 内设置；429/5xx/网络最多重试一次，200ms 间隔，共用同一总超时。结构/引用错误不重试。
- 固定 HTTPS 提供者 endpoint，不跟随重定向；`store:false` 与严格 `text.format` schema。协议参见 [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) 与 [Responses 迁移](https://developers.openai.com/api/docs/guides/migrate-to-responses)；不把 store:false 解释成零保留承诺。
- AI 成功只证明输出结构和引用通过工程校验；真实引文不保证数字推理、因果判断或模型语义完全正确。三类 stub、提示隔离与反例测试不等于真实模型效果实验。

## 7. 全部业务错误代码

| HTTP | code | 处理 |
| --- | --- | --- |
| 400 | `INVALID_REQUEST` | JSON/schema/头字段不符、额外 notes、长度/枚举错误；修正白名单请求 |
| 400 | `DUPLICATE_ID`, `UNKNOWN_SOURCE` | 检查发现/事件 ID 唯一性、来源 ID |
| 403 | `HOST_NOT_ALLOWED`, `ORIGIN_NOT_ALLOWED`, `HEADER_NOT_ALLOWED` | 使用允许本机 Host/Origin/预检头 |
| 403 | `ADMIN_TOKEN_REQUIRED` | reset 控制令牌缺失或错误 |
| 404 | `NOT_FOUND` | 接口不存在，包括当前未定义的方法/路径 |
| 409 | `STALE_SESSION`, `STALE_TASK`, `DATASET_MISMATCH` | GET 最新绑定，不覆盖旧作品 |
| 409 | `SUBMISSION_REQUIRED`, `TASK_NOT_SENT` | 按发送→提交→分析/审核顺序执行 |
| 409 | `STALE_SUBMISSION`, `CONTENT_MISMATCH` | 使用当前不可变提交 ID 与指纹 |
| 409 | `CANDIDATE_MISMATCH`, `REQUIREMENT_MISMATCH` | 使用固定候选人和目标要求 ID |
| 409 | `TASK_ALREADY_SENT`, `SUBMISSION_EXISTS`, `REVIEW_EXISTS` | 该单次动作已完成；读当前状态，不重开 |
| 409 | `IDEMPOTENCY_CONFLICT` | 同键不同体；核对原动作，别盲目换键覆盖 |
| 409 | `ANALYSIS_RUNNING` | GET 观察状态，保留作品，不重复启动 |
| 409 | `STALE_ANALYSIS` | 模型结果属于重置前会话；GET 当前案例 |
| 413 | `PAYLOAD_TOO_LARGE` | HTTP 请求超出 128 KiB |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | 使用 application/json |
| 500 | `INTERNAL_ERROR` | 通用内部/序列化错误；记录 requestId，数据未自动替换 |
| 503 | `RESET_DISABLED` | 服务端尚未设置 reset token |
| 503 | `AI_DISABLED`, `AI_NOT_CONFIGURED` | 检查模式及明确的服务端 key/model，或直接人审 |
| 503 | `AI_INTERRUPTED` | 重启后原进行中收据；GET 后用新 key 显式重试 |
| 502 | `AI_TIMEOUT`, `AI_PROVIDER_ERROR`, `AI_OUTPUT_INVALID`, `AI_OUTPUT_TOO_LARGE`, `AI_INPUT_INVALID`, `AI_INPUT_TOO_LARGE`, `AI_FAILED` | 原作品保留；GET 显示 failed/errorCode，检查配置/输入；新 key 才是新尝试 |

HTTP 层把分析失败统一映射为上表的 502/503，不使用适配器内部 413/422/504 作为 HTTP 合同。`AI_CONFIG_INVALID` 是启动配置检查错误，正常服务不启动；不是可依赖的常规业务响应。分析错误收据 `retryable:true` 意味作品可供后续处理，不保证立即重试会成功；未配置/错误结构需先修正原因。其它列出的业务错误默认为 retryable:false。

## 8. 本机访问边界

只监听 127.0.0.1。Host 必须是 `127.0.0.1:<实际端口>` 或 `localhost:<实际端口>`；默认前端允许 origin 为 5173/4173/5186 的 127.0.0.1，服务自己的同源 origin 也可访问。没有 Origin 的 CLI 可用；带 `Sec-Fetch-Site: cross-site` 而无 Origin 的请求被阻止。预检头仅 content-type、idempotency-key、x-demo-admin-token；不启用通配 CORS。

loopback/Origin 检查不是生产角色权限。没有账号、多租户、公网共享、任意上传、JD CRUD、通知或多轮审核。前端 API 接入状态见 [HANDOFF](HANDOFF.md)。
