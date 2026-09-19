# API 3.0 — 四人、rubric 与人工名单合同

状态：本地实际实现；新版 UI 待小傅接入。API 2.0 前端保持原样，通过独立兼容入口运行。权威机器合同：[OpenAPI](r5/openapi.json)、[实际执行样例索引](r5/examples/manifest.json)。没有 mock 端点或默认 Alex。

## 1. 运行与版本边界

```sh
# 从仓库根目录；使用现有锁文件
npm ci --prefix app/backend
npm run build --prefix app/backend
cd app/backend
# 默认 3.0；新路径，不自动读取旧库
npm start
# 已合并 API 2.0 双端继续使用此独立入口
npm run start:legacy
# 或 DEMO_CONTRACT=2.0 npm start（默认路径随合同变为 v2）
```

Node 最低 22.23，推荐 24 LTS。两入口都仅监听 `127.0.0.1:8787`，不可同时占同一端口。API3 默认 `var/evidencebridge-v3.sqlite`；API2 默认 `var/evidencebridge-v2.sqlite`。`.env` 中的 `DATABASE_PATH` 优先，因此切换合同时必须核对路径；格式不匹配即启动失败，保留原库。旧 `dist/server.js` 只用于明确的 API2 兼容；新入口 `dist/r5/server.js` 接受 `DEMO_CONTRACT=3.0|2.0`。

默认允许 Origin：`http://127.0.0.1:5173`、`:4173`、`:5186`。其他开发端口（例如 5273/5286）须显式加入 `ALLOWED_ORIGINS`；仅精确本机 HTTP Origin，没有通配符。Pages、跨电脑、身份认证和部署不是本合同能力。

版本独立：schema `3.0`；dataset `harbourcart-2026-09-v1`；fixture `harbourcart-applications-v1`；rubric `harbourcart-rubric-v1`。改变材料须改变 fixture/快照/指纹，不悄悄改既有基准。迁移见 [R5_MIGRATION](R5_MIGRATION.md)。

迁移后的外层仍为 API3，但历史 `submission` / `review` 可以保留原始 `schemaVersion:2.0`（OpenAPI 明确给出 union），以保留原 ID、字节含义和指纹；旧分析保留原 promptVersion 并重新验证引文。新写入统一使用顶层3.0绑定，不直接展开历史快照作为新请求。允许旧V1 More后以新合同提交一次V2；不会再开放额外次数。旧申请原文与旧报告保留在迁移归档/sourceMap，新申请 fixture 与旧版本区别显式记录，不把旧分析自动转换为新分数。

## 2. 路由与绑定

候选人 ID：`alex-chen`、`maya-patel`、`leo-zhang`、`sam-taylor`。岗位 `junior-data-analyst`。三个目标：`sql`、`data-analysis`、`business-problem-solving`。四人使用同一规则，姓名不参与评分，也不限制模板。

| 方法 / 路径 | 请求及返回 |
|---|---|
| GET `/healthz` | 存储健康，API3 含 `schemaVersion:3.0`；不调用模型 |
| GET `/api/demo?candidateId=…` | 必选且只允许该 query；返回该人完整数据 |
| GET `/api/demo/comparison` | 无 query；四人申请评估主比较、各人任务评估另列 |
| POST `/api/demo/task/send` | 基础绑定＋taskId＋targetRequirementId＋templateId＋instructions＋gapReason；200 |
| POST `/api/demo/submission` | 任务绑定＋submissionVersion＋前版 ID/指纹或 null＋公开作品；201 |
| POST `/api/demo/analysis` | 任务绑定＋submissionId＋contentFingerprint；200、重试运行中收据 202 或错误 |
| POST `/api/demo/review` | 分析绑定＋decision＋comment；200 |
| POST `/api/demo/assessment` | 基础绑定＋stage＋材料绑定＋rubric＋并发修订号＋整组 items＋显式复用＋operatorLabel；201 |
| POST `/api/demo/shortlist` | 基础绑定＋action/reason＋stage/快照/评估/rubric 依据＋并发名单修订号＋operatorLabel；200 |
| POST `/api/demo/reset` | schemaVersion/sessionId＋管理员请求头；200，返回全体 comparison |

基础绑定：`schemaVersion,sessionId,candidateId,jobId,datasetVersion`。任务绑定再加 `taskId,targetRequirementId`。所有字段从服务端当前响应取值，不硬编码 session/task/submission。

所有 POST 必须 `Content-Type: application/json` 与 `Idempotency-Key`（8–100 个英数、下划线或连字符）。整体请求 ≤128 KiB；多余字段拒绝。公开作品：非空 summary ≤8000 字符；findings 0–40；processEvidence ≤100；comment 必填 ≤2000；instructions ≤4000。更细限制以 OpenAPI 为准。禁止发送页面整体 state；嵌套 notes 同样被拒绝。备注写进公开 summary/comment 就属于正式公开材料，后端无法识别人主动粘入公开字段的私密语义。

## 3. 读取、历史与状态

`{data,meta:{replayed}}` 是成功外层。`data` 含 company/job/rubric、candidate/application、dataset、task、按 requirement 键组织的 `taskTemplates`、`versions`、当前 `submission/analysis/review` 别名、workflow、capabilities、assessment、shortlist、report。

- task 初始 draft、target null。HR 发送时固定目标，最多一个任务；充分材料可以跳过。
- V1 三种决定：confirm、needs_more_evidence、evidence_still_insufficient。仅 More 开一次 V2；其余终局。
- V2 必须链接 V1 ID 与指纹，只允许 confirm / evidence_still_insufficient；无 V3、无重开旧 review。
- `remainingSubmissions` 只是容量。以 `canSubmit/canResubmit/nextSubmissionVersion/allowedReviewDecisions` 判断动作。
- `versions` 最多两条；旧快照、review 和已完成 analysis 不被新版本覆盖。旧版本只读。历史分析 live 结果读取时标 replay。
- `report` 是证据状态，不是分数或名单。未审核项取 initialReport；当前目标 review 更新 supported/uncertain 为 verified/uncertain。目标报告明确绑定当前材料快照/指纹，原申请报告留在 application.initialReport；不把旧申请引文冒充任务审核引文。

### 分析模式

capabilities 提供 `analysisMode,analysisAvailable,analysisUnavailableReason`。disabled 对应 AI_DISABLED；live 缺服务端 key/model 对应 AI_NOT_CONFIGURED。manual_simulation 是确定性规则演示，不是模型理解；live 的第一次成功响应是 live，同一结果后续读取/重试是 replay。`preset_human` 另指预置评估，实际标注来源见 provenance，真人校准仍为 pending。

SQL 观察 S1/S2/S3；DA 观察 D1/D2/D3；BPS 沿用五维。SQL 仅静态文本审阅，绝不执行 SQL。模型只提取带原文引用的观察，不输出 rubric Mark、录用决定或排名。外部模型失败后可继续人工审核。analysis 完成前重核 session/person/task/submission/hash/attempt；审核或 reset 后迟到结果失效。重启把运行中状态结算为 AI_INTERRUPTED，使用**新键**发起新尝试。

## 4. Assessment：先材料，再分项，再规则计算

stage：`application_review | task_v1 | task_v2`。每个候选人每个 stage 独立 `assessmentRevision`。初始 application revision=1、预置基准不可变；改评追加 revision2 等。未评分的 task stage 读取为 null（待评），不是 NE。评估独立于证据 review：终局后仍可修订当前版评分，但不重开 review，不改旧任务版评分。

请求另含 `evidenceSnapshotId,fingerprint,submissionId,contentFingerprint,rubricVersion,expectedAssessmentRevision,items,reuseApplication,operatorLabel`。申请阶段两个 submission 字段必须 null；任务必须匹配当前正式版本。不存在的 stage 与历史任务新增评估返回冲突。

`items` 必须整组：申请十项；任务仅目标技能三/四项。每项包括 `criterionId,mark,rationale,support,gaps,uncertainty,nextStep,checkedSourceIds,sourceRefs`，文本需非空。Mark 为整数 0–4 或字符串 NE；数值（含 0）必须有真实材料引文。NE 可无正向引文，但必须有检查过的来源和缺口说明。先全组校验，后单事务写入，任何一项失败都不部分保存。

`sourceRef = {candidateId,evidenceSnapshotId,fingerprint,sourceId,location,start,end,quote}`。身份、材料版本、位置与指纹全部匹配，且 JavaScript UTF-16 `text.slice(start,end)===quote`，end 不包含末尾。中文、换行、emoji 示例可从 [Alex 初始响应](r5/examples/initial-alex-chen.response.json) 中 B3 引文复核；例如 emoji 占两个 UTF-16 code units，Python 默认字符下标不可直接当协议下标。同名 cv.md 分属不同人，没有跨人引用特权。

非目标技能默认待评。`reuseApplication:null` 不复用；显式对象必须引用**保存时最新**申请评估的 revision/快照/指纹。响应记录 reusedItems 和来源，不使用先前任务分数。新 V2 task_v2 始终从 null 开始。历史复用继续保持原依据，非实时重新算分；查看旧任务综合数值须同时展示其 stage 与原申请修订，不能混入主比较。

Mark/4×10；SQL/DA/BPS 上限30/30/40。任一 NE 综合为空；待评和 NE 独立。完整技能保留自身百分比；不把缺项重新归一化。coveragePercent 只有完整逐项评估后才有值；accruedScore 只是已有贡献，不是完整综合分。后端返回 criteria、skills、status、assessmentComplete、complete、overallScore/Percentage。前端自报 total/score 被拒绝。计算不舍入，显示一位小数。

## 5. 比较与名单

comparison 永远主列 application_review，四人全返回；taskAssessments 独立列，目标由同人的 task.targetRequirementId 给出。无自动排序、通过线、默认末位、按姓名破同分或自动录用。不同申请项目难度不标准化，字段 sortPolicy/limitations 必须保留可见语义。

shortlist action：retain/remove/reconfirm。所有动作需理由和查看时 basis；expectedShortlistRevision 乐观锁。retain 适用于尚未保留或已移出；reconfirm/remove 要有原保留记录。基于未评分的任务可以 assessmentRevision:null。保留/重新确认时依据必须匹配当时最新评估。remove 可记录正在查看的本人的历史依据，不要求先修复旧评分才能移出；身份、来源、存在性与名单修订锁仍校验。

读取状态：not_retained / retained / needs_reconfirmation。任何新正式作品或**原依据 stage** 的评估修订使保留变为待重新确认；保留旧理由、旧依据及全历史，不自动移除。任务评估显式复用的申请修订也是依赖：该申请评估改变，同样待重新确认，须先更新任务评估的复用依据。更改没有依赖关系的 stage 不算依据变动。review Confirm 不自动 retain，Insufficient 不自动 remove；名单不改分数/审核。

## 6. 幂等、冲突与错误

收据全局键 `(session,path,key)` 另存 owner。相同请求/同人重试返回原收据（meta.replayed=true）；跨人重用同键返回 IDEMPOTENCY_OWNER_MISMATCH，不泄露另一人快照；改请求复用键为 IDEMPOTENCY_CONFLICT。写入完成后 GET 当前状态，避免旧收据覆盖较新屏幕。assessment/shortlist 另有 expected revision 防 lost update。网络失败保留原键重试；明确失败后修正内容/新操作用新键。

错误 `{error:{code,message,requestId,retryable}}`；不返回请求原文、私密 header 或模型正文。主要分类：

| 状态 | 代码示例 / 前端处理 |
|---|---|
| 400 | INVALID_REQUEST、INVALID_ASSESSMENT；修正 DTO/来源，保留草稿 |
| 403 | HOST_NOT_ALLOWED、ORIGIN_NOT_ALLOWED、ADMIN_TOKEN_REQUIRED |
| 409 | STALE_SESSION、TASK_MISMATCH、REQUIREMENT_MISMATCH、CONTENT_MISMATCH、EVIDENCE_MISMATCH、ASSESSMENT_CONFLICT、SHORTLIST_CONFLICT、STALE_REUSE、IDEMPOTENCY_*、STALE_ANALYSIS；刷新后由人确认，不盲目覆盖 |
| 409 | TASK_ALREADY_SENT、RESUBMISSION_NOT_ALLOWED、SUBMISSION_LIMIT_REACHED、REVIEW_EXISTS、REVIEW_LIMIT_REACHED；遵从有限状态机 |
| 413/415 | PAYLOAD_TOO_LARGE / UNSUPPORTED_MEDIA_TYPE |
| 502/503/504 | AI_*；展示真实失败、允许人审；disabled/缺配置不暗中模拟 |
| 500 | INTERNAL_ERROR；日志只有请求ID/路由/状态/安全错误码，数据留存 |

reset 要 `X-Demo-Admin-Token`（服务端24–256字符），不能置于 VITE 变量。整体四人进入新 session；正式材料、动态评估/名单/收据清理，恢复固定基准。旧请求和迟到分析失效，浏览器草稿需按 session/candidate/task 分区并主动处理过期。reset 幂等重试只确认同一次已完成操作，不当作继续补交。


## 2026-09-19 双端本地整合补充

基于PR9前端与本地修订5后端新增真实API3模式，保留原页面成果。默认 `api3-connected` 匹配后端默认3.0；显式 `connected` 仍用于旧API2，`revision5-preview` 仍是独立本地模拟。旧段落中的“新版待接入”是此前阶段记录，当前行为以[API3整合交接](../FRONTEND_API3_INTEGRATION.md)为准。新检查 `python3 scripts/frontend-types-v3.py --check` 与 `npm run test:api3 --prefix app/candidate`；各命令从仓库根执行。API3浏览器用独立端口与临时SQLite，普通页面不持有reset令牌。此轮未提交、推送、合并或部署；实际验收状态以本轮报告为准。
