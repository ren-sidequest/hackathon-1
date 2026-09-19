> **修订5新增API3**：四人、rubric、名单见 [新版交接](R5_HANDOFF.md)。以下保留API2兼容资料；API2用 `npm run start:legacy`，默认 `npm start` 已切到独立API3新库。两端现有UI仍为API2，四人UI待接入。

# EvidenceBridge 后端接口合同 v2.0

固定 HarbourCart / Junior Data Analyst / Alex Chen；一个任务，V1 首次提交 + 最多一次 V2 补交，每版最多一次人工审核。仅 V1 的 Needs More Evidence 开放 V2；其余结果终结任务，无 V3。修订 3 范围与验收增量见 [REVISION_PLAN](REVISION_PLAN.md)。运行说明见 [README](../../app/backend/README.md)，完整机器合同见 [openapi.json](openapi.json)，实际测试见 [TEST_RESULTS](TEST_RESULTS.md)。

## 1. HTTP、响应与调用顺序

默认 base：`http://127.0.0.1:8787`。顺序：`GET → send → V1 submission → analysis（可失败）→ review → GET`。V1 Confirm/Insufficient 直接结束；V1 More 后可在**相同 session/task/dataset** 下 `V2 submission → analysis（可失败）→ terminal review → GET`。reset 是另一次演示，不是 V2 补交。模型失败不影响原作品和人工审核能力。

| 接口 | 必要请求内容 | 成功状态 / 行为 |
| --- | --- | --- |
| `GET /healthz` | 无 | 200 `{status:"ok",storage:"sqlite"}`；本地存储检查 |
| `GET /api/demo` | 无 | 200 当前完整共享状态 |
| `POST /api/demo/task/send` | 基础绑定 + `instructions` | 200，仅 draft 可发送 |
| `POST /api/demo/submission` | 基础绑定 + `candidateId,submissionVersion,previousSubmissionId,previousContentFingerprint,summary,findings,processEvidence` | 201，每版不可变正式快照 |
| `POST /api/demo/analysis` | 基础绑定 + `submissionId,contentFingerprint` | 200 成功；同键进行中重试可得 202；失败 502/503 |
| `POST /api/demo/review` | 分析请求字段 + `requirementId,decision,comment` | 200，当前版保存唯一人工决定；V2 只接受终局决定 |
| `POST /api/demo/reset` | `schemaVersion,sessionId` + 控制令牌头 | 200，全新会话及 taskId，清除两版提交/分析/审核 |

`/docs` 是 Swagger UI，`/docs/json` 和 `/docs/yaml` 是运行时文档；文档插件还提供静态资源与重定向路由。这些是辅助路由，不是新的业务能力。`OPTIONS` 处理预检。

除 health 与错误外，成功响应统一为：

```json
{"data":{"schemaVersion":"2.0","sessionId":"...","datasetVersion":"harbourcart-2026-09-v1","revision":0,"candidate":{},"job":{},"application":{},"dataset":{},"task":{},"currentSubmissionVersion":null,"submission":null,"analysis":{},"review":null,"versions":[],"workflow":{"maxSubmissions":2,"submissionsUsed":0,"remainingSubmissions":2,"canSubmit":false,"canResubmit":false,"nextSubmissionVersion":null,"allowedReviewDecisions":[],"isTerminal":false},"report":{}},"meta":{"replayed":false}}
```

上例省略展开字段；**可直接查看的完整响应**：[初始](examples/initial.response.json)、[已提交](examples/submission.response.json)、[手工模拟分析](examples/analysis.response.json)、[审核后 GET](examples/reviewed.response.json)。另见同会话补交场景：[V1 More](examples/revision-v1-more.response.json)、[等待 V2](examples/awaiting-revision.response.json)、[V2 请求](examples/revision-v2-submission.request.json)、[两版历史](examples/revision-history.response.json)。所有完整例子由真实内存 API 执行生成，`manifest.json` 标记 synthetic/manual fixture、零模型调用；直接 V1 与 V1/V2 是两个独立场景，不混用随机 ID、时间与指纹。

错误形状：

```json
{"error":{"code":"STALE_SESSION","message":"Demo was reset. Reload the current case.","requestId":"server-generated-id","retryable":false}}
```

前端先判断 HTTP 状态，再读取 `data` 或 `error`；错误响应没有成功 `data`。`requestId` 用于定位，不含原作品或提供者异常正文。不要用错误英文文案判断分支，使用 `code`。

## 2. 请求字段、限制与隐私

所有 POST：`Content-Type: application/json`；`Idempotency-Key` 必填，8–100 个 ASCII 字母、数字、`_` 或 `-`，建议 `crypto.randomUUID()`。reset 额外 `X-Demo-Admin-Token`；该令牌只保护 reset，正常读/发/提交/分析/审核没有账号认证。

基础绑定：`schemaVersion:"2.0", sessionId, taskId, datasetVersion`，从最新 GET 取得。`task.id` 是固定模板 ID，**不是**本次随机 `task.taskId`。ID 字段最长 80，正则 `^[A-Za-z0-9_-]+$`。提交、分析、审核都使用当前会话；reset 只需 schemaVersion/sessionId。

| 公开字段 | 约束 / 语义 |
| --- | --- |
| `instructions` | 非空白字符串，最长 4000 |
| `submissionVersion` | 必填整数 `1` 或 `2`，按当前 `workflow.nextSubmissionVersion` 构造；`3` 属 schema 错误 |
| `previousSubmissionId` / `previousContentFingerprint` | 必填；V1 两项均 `null`，V2 须精确绑定同任务 V1 的 ID 与指纹；不以 reset 建立补交关系 |
| `summary` | 非空白字符串，最长 8000；原文保存，不 trim |
| `findings` | 数组，0–40 条；不强制每个板块有卡片，薄弱作品可正式提交供审核 |
| finding | **仅** `id,section,title,detail,source,confidence`；id 在 findings 内唯一；title 非空白最长 300；detail 最长 4000，允许空 |
| `section` | `Key Findings / Hypotheses / Additional Evidence Needed / Recommended Next Steps` |
| `source` | 最长 80；空串表示未附来源；非空须匹配 `dataset.resources[].id`（本轮等于文件名） |
| `confidence` | `High / Medium / Low`，候选人自填标签，不是模型评分 |
| `processEvidence` | 数组，0–100 条；每条仅 `id,at,title,detail?`；id 在该数组内唯一；at 为 date-time；title 非空白最长 200；detail 最长 1000 |
| `contentFingerprint` | 服务端生成的 64 位小写十六进制 SHA-256；客户端原样传回 |
| `requirementId` | 只允许本任务目标 `business-problem-solving` |
| `decision` | V1：`confirm / needs_more_evidence / evidence_still_insufficient`；V2：仅 `confirm / evidence_still_insufficient`；按钮以 `workflow.allowedReviewDecisions` 为准 |
| `comment` | 共享人工审核理由；所有三分支必填，非空白最长 2000 |

请求 JSON 总大小上限 **128 KiB**。JSON schema 不做字符串/数字强制转换、不自动去除额外字段；额外字段返回 `INVALID_REQUEST`。所有公开对象白名单均排除私人 `notes`。Candidate 的 notes 留在本地；旧 HR 表单若把审核备注叫 notes，接入时只把公开理由投影为 `comment`，不要发送整个表单/state。

完整请求：[发送](examples/send.request.json)、[提交](examples/submission.request.json)、[分析](examples/analysis.request.json)、[审核](examples/review.request.json)、[reset](examples/reset.request.json)。实际操作替换为当前 GET 的 ID；请求头参见[示例 manifest](examples/manifest.json)。

## 3. 快照、来源与内容指纹

提交成功新增 `submissionId,submittedAt,contentFingerprint,processEvidenceProvenance:"client_reported",sources`。指纹使用基础绑定、candidateId、submissionVersion、两项 previous 绑定与公开作品的规范化 JSON：对象键排序，数组顺序与文本空白保留。它不是语义指纹。正式提交无 PATCH/覆盖端点；本地编辑不改变已提交版本。V2 创建新 submissionId、指纹、来源索引、空 analysis 和空 review，不覆盖 V1。相同 sourceId 可分别出现在两版，因此引用的外层提交绑定始终必需。

来源索引：

| sourceId | location | kind |
| --- | --- | --- |
| `summary` | `/summary` | `work_sample` |
| `finding:<id>:title` / `finding:<id>:detail` | `/findings/<index>/title` 或 `/detail` | `work_sample` |
| `event:<id>:title` / `event:<id>:detail` | `/processEvidence/<index>/title` 或 `/detail` | `client_reported_event` |

`location` 是提交内部 JSON pointer，事件 detail 未提供时没有该条来源。引用包含 `sourceId,location,quote,start,end`；偏移使用 JavaScript UTF-16 单元、end exclusive，须满足 `source.text.slice(start,end) === quote`。前端先校验**所选版本**的 `submissionId/contentFingerprint`，再在该版来源中定位并用纯文本渲染；来源不是 HTML 或代码执行指令。

固定申请的引用另走 `application.sources` 和 `initialReport.sourceRefs`；数据引用另走 `dataset.resources`；不要把这两类 preset 引用伪装成本次候选人实际作品。

## 4. 四层状态、版本与报告

| 字段 | 枚举 / 影响 |
| --- | --- |
| `task.status` | `draft → sent → submitted`；V1 More → `awaiting_revision` → V2 `submitted`；任一终局决定 → `reviewed` |
| `analysis.status` | 每版独立 `not_started / running / succeeded / failed`；只影响观察提取 |
| `review.decision` | 每版最多一次；V1 More 开放唯一补交，V1/V2 Confirm 或 Insufficient 结束任务；未审核时 `null` |
| `report.requirements[].status` | `supported / uncertain / verified`；`displayStatus/displayLabel` 是对应展示文案 |

`currentSubmissionVersion` 初始 null，之后为 1/2。`versions` 按 V1、V2 排列，最多两个 `{submission,analysis,review}`。顶层同名字段是**最新正式版本**投影；等待 V2 或编辑 V2 本地草稿时仍指 V1。历史只读；切换历史只改变本地选择，不改变当前版本、报告或服务状态。

| 当前状态 | canSubmit / canResubmit | nextSubmissionVersion | allowedReviewDecisions | isTerminal |
| --- | --- | --- | --- | --- |
| draft | false / false | null | [] | false |
| sent | true / false | 1 | [] | false |
| V1 submitted、未审核 | false / false | null | 三种决定 | false |
| awaiting_revision（V1 More） | true / true | 2 | [] | false |
| V2 submitted、未审核 | false / false | null | confirm、evidence_still_insufficient | false |
| reviewed（V1 或 V2 终局） | false / false | null | [] | true |

`workflow.maxSubmissions=2`；`submissionsUsed=versions.length`；`remainingSubmissions=2-submissionsUsed` **只是剩余额度，不是提交许可**。V1 终局后 remainingSubmissions 仍为 1，但 canSubmit=false。前端以 workflow 与当前版本渲染动作，不以剩余数字自行开放按钮。

仅 `confirm` 把目标要求改为 verified；SQL 和 Data Analysis 仍 supported。More 和 Insufficient 均保持目标 uncertain，但前者仅在 V1 等待补交，后者终局。提交或 AI 成功都不升级报告。人工审核不要求 AI 成功。当前版已审核时，目标报告 `mode:human_reviewed`，summary 含本次 decision/comment；V2 提交后当前 review 为空，不沿用 V1 人审结果。`application.initialReport` 始终保留初始 before。`report.isHiringDecision` 恒为 false；Confirm 是有限样本证据经人复核，不是录用。

`report.requirements[].sourceRefs` 保留初始材料引用；`submissionSourceRefs` 引用当前正式工作样本。V1 分析、审核理由及引用通过 versions 回看，不投射成 V2 结果。更新后的未知仍存在，不把有限作品扩展为真实工作绩效或因果证明。

## 5. 幂等、并发、重启和重置

- 按 `sessionId + path + Idempotency-Key` 保存请求摘要与响应；同键同体重放原收据，成功时 `meta.replayed:true`；同键异体 409 `IDEMPOTENCY_CONFLICT`。
- 同一会话中，V2 已存在时旧 key 的 V1 操作仍可重放其历史收据；它不是当前 GET。新 key 向 V1 发分析/审核则报 `STALE_SUBMISSION`。**每次写成功、历史重放或冲突后都重新 GET**，不直接用收据替换页面当前版本。
- 不同 key 的 send、同版 submission、同版 review 仍受状态/版本限制，不覆盖快照或人工决定。合法 V2 是新动作、新 key、前版精确绑定；失败普通写入不部分提交。
- 首次 analysis 请求等待本次完成。同 key 并发重试得 202 running 收据；完成后同 key 返回最终收据，不重复调用模型。不同 key 在 running 时为 409 `ANALYSIS_RUNNING`。
- 当前版已 succeeded，用新 key 读保存结果而不调用模型；failed 后可用新 key 显式重试，前提是该版仍为当前且未审核。已审核后不启动分析；既有成功结果保留。历史版仅通过 GET 或旧收据回看。
- 人审提交时若当前 analysis 正 running，原子冻结为 `failed/AI_REVIEW_CLOSED`，finishedAt 固定；该 attempt 的 202 收据转为 409/AI_REVIEW_CLOSED。既有成功输出原样保留，未完成输出不伪造。随后到达的原请求结果报 `STALE_ANALYSIS`，不改变该版历史或 V2。
- V2 新建 `not_started` analysis 与 null review；不会继承 V1 观察、决定或评论。新分析只使用 V2 公开快照与同一固定案例。
- GET/收据读回中已保存的真实 `live` 输出标为 `replay`，保留模型、时间、responseId；只有原首次完成响应显示 live。manual_simulation 永远保持该标签。
- 进程中断时，重启将当前 running 改为 `failed/AI_INTERRUPTED`，关联 202 收据转为 503。GET 后再决定是否以新 key 重试。awaiting_revision、两版快照、各自审核和既成结果从同库恢复。
- reset 原子清除两版提交/分析/审核和旧收据，生成新 session/task。旧一般写入返回 `STALE_SESSION`。仅**最近一次 reset 收据**保留供同键重试，重放不再清空随后新提交；再 reset 后更旧收据失效。
- reset 与模型交错时迟到结果为 `STALE_ANALYSIS`，不写入新会话。schema 2.0 默认用 `./var/evidencebridge-v2.sqlite`；旧 1.0 SQLite 启动检查停止加载并保留文件，显式选择新的 `DATABASE_PATH`，不迁移或自动清空。1.0 HTTP 请求为 400/INVALID_REQUEST。

## 6. AI 输出、配置及限制

五维固定：Problem Framing、Evidence Navigation、Hypothesis Formation、Evidence Seeking、Decision Making；每维 `{dimension,status,statement,citations,scope,uncertainty}`。`observed` 至少一条工作样本引用；`not_observed` 引用数组为空。仅客户端事件不足以构成能力观察。每维最多 5 引用，每条最长 2000 UTF-16 单元；陈述、范围与未知各为非空文本，最长 2000。

- `disabled` 为默认：不联网，分析 503/AI_DISABLED，作品仍可读。
- `manual_simulation`：显式手工规则只展示对应板块文本的存在和引文；不验证推理质量，不伪称模型已运行。
- `live`：仅服务端 OpenAI Responses，显式 key 和 model；输入含公开作品投影、6 个合成资源和固定观察规则。当前项目未有真实调用记录。
- 模型输入 JSON 默认上限 96000 UTF-8 bytes（含资源/来源投影；额外提示词和 schema 另占请求空间）；提供者响应流上限 64000 bytes；`max_output_tokens:4000`。超时默认 20 秒，env 可在 100–60000ms 内设置；429/5xx/网络最多重试一次，200ms 间隔，共用同一总超时。结构/引用错误不重试。
- 固定 HTTPS 提供者 endpoint，不跟随重定向；`store:false` 与严格 `text.format` schema。协议参见 [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) 与 [Responses 迁移](https://developers.openai.com/api/docs/guides/migrate-to-responses)；不把 store:false 解释成零保留承诺。
- AI 成功只证明输出结构和引用通过工程校验；真实引文不保证数字推理、因果判断或模型语义完全正确。三类 stub、提示隔离与反例测试不等于真实模型效果实验；配对薄弱 V1/补充可定位证据 V2 也只是工程夹具。每版结果保留各自绑定和模式，不要求同义改写机械地产生不同结论。

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
| 409 | `TASK_ALREADY_SENT`, `REVIEW_EXISTS` | 任务已发送或该版已审核；读当前状态，不重开 |
| 409 | `SUBMISSION_VERSION_MISMATCH`, `PREVIOUS_SUBMISSION_MISMATCH` | 按 workflow 构造版本号，并精确绑定 V1 ID/指纹 |
| 409 | `RESUBMISSION_NOT_ALLOWED`, `SUBMISSION_LIMIT_REACHED` | 仅 V1 More 开放 V2；两版已用尽后结束 |
| 409 | `REVIEW_LIMIT_REACHED` | V2 只接受 confirm 或 evidence_still_insufficient |
| 409 | `IDEMPOTENCY_CONFLICT` | 同键不同体；核对原动作，别盲目换键覆盖 |
| 409 | `ANALYSIS_RUNNING` | GET 观察状态，保留作品，不重复启动 |
| 409 | `AI_REVIEW_CLOSED` | 正运行分析已被该版人审冻结；读当前状态，不轮询旧 attempt |
| 409 | `STALE_ANALYSIS` | 模型结果所属会话/当前提交/attempt 已变化或已人审冻结；GET 当前案例 |
| 413 | `PAYLOAD_TOO_LARGE` | HTTP 请求超出 128 KiB |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | 使用 application/json |
| 500 | `INTERNAL_ERROR` | 通用内部/序列化错误；记录 requestId，数据未自动替换 |
| 503 | `RESET_DISABLED` | 服务端尚未设置 reset token |
| 503 | `AI_DISABLED`, `AI_NOT_CONFIGURED` | 检查模式及明确的服务端 key/model，或直接人审 |
| 503 | `AI_INTERRUPTED` | 重启后原进行中收据；GET 后用新 key 显式重试 |
| 502 | `AI_TIMEOUT`, `AI_PROVIDER_ERROR`, `AI_OUTPUT_INVALID`, `AI_OUTPUT_TOO_LARGE`, `AI_INPUT_INVALID`, `AI_INPUT_TOO_LARGE`, `AI_FAILED` | 原作品保留；GET 显示 failed/errorCode，检查配置/输入；新 key 才是新尝试 |

HTTP 层把模型/适配器失败映射为上表的 502/503；状态竞争使用上表 409。不使用适配器内部 413/422/504 作为 HTTP 合同。`AI_CONFIG_INVALID` 是启动配置检查错误，正常服务不启动；不是可依赖的常规业务响应。分析错误收据 `retryable:true` 意味作品可供后续处理，不保证立即重试会成功；未配置/错误结构需先修正原因。其它列出的业务错误默认为 retryable:false。

## 8. 本机访问边界

只监听 127.0.0.1。Host 必须是 `127.0.0.1:<实际端口>` 或 `localhost:<实际端口>`；默认前端允许 origin 为 5173/4173/5186 的 127.0.0.1，服务自己的同源 origin 也可访问。没有 Origin 的 CLI 可用；带 `Sec-Fetch-Site: cross-site` 而无 Origin 的请求被阻止。预检头仅 content-type、idempotency-key、x-demo-admin-token；不启用通配 CORS。

loopback/Origin 检查不是生产角色权限。没有账号、多租户、公网共享、任意上传、JD CRUD、通知、无限补交或历史版重新审核。前端 API 接入状态见 [HANDOFF](HANDOFF.md)。
