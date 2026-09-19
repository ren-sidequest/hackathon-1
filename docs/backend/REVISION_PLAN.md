# 修订 3 实施计划：同一任务最多 V1 / V2

状态：用户已确认有限两版范围；本文件在代码实施前先记录合同与验收。当前已完成本地代码、测试与文档更新，具体执行证据见 [TEST_RESULTS](TEST_RESULTS.md)；双端 UI 接入与真实模型实验仍待验证。旧 `6fb19a9` / schema `1.0` 的测试结果仅作历史基线。新功能的完成情况以本轮实际测试记录为准。

依据：2026-09-19《EvidenceBridge 黑客松完整参赛方案》修订 3，第 1、7.2、7.3、7.5、9、10、17 节。本文取代本任务此前“所有三种决定都终结单轮”的结论，不改动库外规划文件。

## 1. 范围与分工

- 仍是 HarbourCart / Junior Data Analyst / Alex Chen、三个岗位要求、Business Problem Solving 一个目标缺口、同一任务及同一数据版本。
- 首次提交 V1；仅 V1 的 Needs More Evidence 开放一次补交 V2。V1 可直接 Confirm 或 Evidence Still Insufficient 结束；V2 只允许上述两个终局决定。
- 保留最多两份不可变作品及各自真实产生的分析状态/结果、人工意见；历史只读。不是无限重提、版本 diff、通用历史检索、新题或上传平台。
- 主代理负责 schema/service/store；架构角色负责客户端脚本与生成合同/样例；QA 负责测试、实际结果与安全复核；本文件作者负责产品/接口/交接文档。互不覆盖文件所有权。
- 本轮终点为本地实现、测试、审查和交接；不执行远端写入、提交、PR、合并或部署。前端接入仍归小傅。

## 2. 状态转换

| 当前状态 | 允许动作 | 下一状态 / 证据结果 |
| --- | --- | --- |
| draft | 发送原任务 | sent；尚无正式作品 |
| sent | 提交 V1 | submitted / currentSubmissionVersion=1；AI not_started，review=null |
| V1 submitted | 分析；一次审核 | 分析不自动改变要求支持 |
| V1 Confirm | 无后续补交 | reviewed；目标 verified |
| V1 Evidence Still Insufficient | 无后续补交 | reviewed；目标 uncertain |
| V1 Needs More Evidence | 阅读具体意见、编辑本地补充草稿 | awaiting_revision；目标 uncertain，V1 快照/分析/审核留存 |
| awaiting_revision | 同 session/task/dataset 提交 V2 | submitted / currentSubmissionVersion=2；新 submissionId/指纹，V2 AI not_started、review=null |
| V2 Confirm | 结束 | reviewed；仅目标 verified |
| V2 Evidence Still Insufficient | 结束 | reviewed；目标 uncertain |
| V2 Needs More Evidence / V3 / 终局后补交 | 明确规则错误 | 不增生版本、不修改既有状态 |

每版至多一次有效人工审核；同请求重试不是追加审核。剩余提交次数只是数量，V1 已终局即使还有一次余量也不代表可补交。

## 3. 数据和接口合同增量

- `schemaVersion` 升为 `2.0`。原六个业务端点继续复用；不增加岗位、上传、动态出题或历史编辑端点。
- `POST /api/demo/submission` 新增必填：`submissionVersion: 1 | 2`、`previousSubmissionId: null | string`、`previousContentFingerprint: null | string`。V1 的前版字段必须为 null；V2 必须准确绑定同会话 V1 的 ID 与指纹。
- GET 保留 `submission / analysis / review` 当前投影，新增 `currentSubmissionVersion: null | 1 | 2` 与按 V1、V2 排列的 `versions: [{ submission, analysis, review }]`，最多两项。历史记录与当前投影一致且引用各自版本，不拿 V1 的结果填入 V2。
- GET 新增 `workflow`：`maxSubmissions:2`、`submissionsUsed`、`remainingSubmissions`、`canSubmit`、`canResubmit`、`nextSubmissionVersion:null|1|2`、`allowedReviewDecisions`、`isTerminal`。前端按可用动作字段驱动，不从剩余额度或颜色推断权限；无当前可审核提交时决定列表为空。
- `task.status` 新增 `awaiting_revision`；`sessionId` 是演示会话，`datasetVersion` 是固定资源版本，`submissionVersion` 是正式作品编号，`revision` 是共享状态修订计数，各自独立。
- 分析/审核继续绑定当前 `submissionId / contentFingerprint`。旧 key 可重放该请求的历史收据，标记 `meta.replayed=true` 后客户端必须重新 GET；用新 key 操作历史作品返回 `STALE_SUBMISSION`。
- 审核落盘时若该版分析仍运行，冻结为 `failed / AI_REVIEW_CLOSED`，不制造分析结果；迟到响应不覆盖已审核记录或 V2。审核前已产生的结果原样保留在所属版本。
- 公开 payload 继续使用白名单；Candidate 私人 notes 排除，HR `comment` 仍为共享人工意见。补充草稿按 session/task/拟提交版本由前端隔离。

## 4. 持久化与运行边界

- 沿用 TypeScript + Fastify + SQLite，以及同机三服务与 Origin 白名单。
- 默认新库为 `var/evidencebridge-v2.sqlite`。旧 schema 1.0 文件不迁移、不清空；启动检测报告兼容性错误，要求显式选择新的 DATABASE_PATH；旧库文件留存。
- 重启恢复 V1、等待补交、V2 和各版分析/审核；重置清除当前演示两版记录并创建新 session，旧引用失效。
- AI disabled/manual_simulation/live/真实回放标签继续区分。真实模型实验与两端浏览器联调分别记录，既有单轮测试不作为两版已完成的证据。

## 5. 本轮增量验收矩阵

| ID | 场景 | 应观察到的结果 |
| --- | --- | --- |
| R3-01 | V1 直接 Confirm / Insufficient | 保留直接终结主线；不开放 V2，SQL/Data Analysis 不变 |
| R3-02 | V1 More + 具体意见 | awaiting_revision、目标 uncertain，workflow 精确开放一次补交 |
| R3-03 | 编辑补充草稿 | V1 作品、已有分析与人工意见不变；私人 notes 未分享 |
| R3-04 | 同会话提交带第二个独特句的 V2 | 新 ID/指纹、前版绑定准确；两版公开原文分别可读 |
| R3-05 | V2 初始及分析后 | 初始 AI not_started/review=null；新观察只引 V2，V1 历史保留 |
| R3-06 | V2 Confirm / Insufficient | 终局；目标分别 verified / uncertain；无 V3 |
| R3-07 | 未经 V1 More 抢交 V2、错前版、错编号、V2 More | 明确错误且存储无部分写入 |
| R3-08 | 重试及并发补交、旧 key / 新 key 的历史请求 | 重放规则确定；最多两份快照、每版至多一份审核；旧请求不改 V2 |
| R3-09 | V1 分析运行时审核 More，再提交 V2，旧分析迟到 | V1 冻结为真实失败状态；V2 与其分析状态不被覆盖 |
| R3-10 | V1/V2 引文、来源 ID、指纹及输入大小边界 | 各版独立校验；无来源/虚构引文按现有规则失败 |
| R3-11 | 等待补交或 V2 审核后同库重启 | 当前投影及两版记录一致恢复；中断状态如实记录 |
| R3-12 | reset 后新案例、旧会话再写 | 两版均清除；旧引用失败；重试 reset 不误清新作品 |
| R3-13 | 用旧 1.0 SQLite 启动新版 | 启动明确失败，原文件记录保持；新路径可独立启动 |
| R3-14 | 文档/OpenAPI/生成样例/客户端脚本 | 2.0 字段、允许决定、状态及默认库一致；旧 1.0 客户端得到显式合同错误 |
| R3-15 | V1 薄弱 → 明确缺证意见 → V2 补充的成对合成样本 | 分版证据与剩余不确定性可核验；stub 与真实模型实验区分 |
| R3-16 | 小傅后续两端浏览器验收 | 实际意见、按版草稿、来源点击、只读回看、终局/上限反馈与共享服务一致 |

执行结果统一写入 TEST_RESULTS；本计划不预填通过数字。后端 API 验证、实际 HTTP 客户端验证、真实模型实验及 UI 联调四项分开汇报。
