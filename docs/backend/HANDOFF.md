# 给小傅：双端 API 接入清单

当前按修订 3 交付 **API 2.0 有限两版**后端、合同与合成数据，**HR 与 Candidate 页面尚未接入**。不要把 API 客户端成功写成现场双端 UI 已跑通。后端实际计数/结果见 [TEST_RESULTS](TEST_RESULTS.md)，接口见 [API](API.md)，运行见 [README](../../app/backend/README.md)。

## 1. 最短接入顺序

1. 按 README 启动共享服务，确认 `http://127.0.0.1:8787/healthz`。
2. 两端各设公开配置 `VITE_API_BASE_URL=http://127.0.0.1:8787`；保留原前端端口 Candidate 5173/4173、HR 5186。API base 不是密钥。浏览器使用 `localhost` 时，服务端 ALLOWED_ORIGINS 也需逐项匹配。
3. 两端首次进入/刷新调用 GET，将 `data` 保存为**共享状态缓存**；草稿、路由、选中卡片等仍由原前端维护。
4. HR 发送→Candidate 重新 GET 接收；Candidate 正式提交 V1→HR 重新 GET 展示同一快照；HR 发分析/审核→两端重新 GET。V1 Confirm/Insufficient 直接结束；只有 V1 More 开放同任务 V2 草稿与一次补交，V2 最终只 Confirm/Insufficient。无需 WebSocket，提供明确刷新入口即可。
5. 首先跑通“V1 独特句原样出现在 HR”，再跑同会话 V1 More→V2 新独特句→独立分析/终局；最后接两版只读回看、引用、失败反馈，分别记录 UI 验收与真实模型实验。

后端不会发送通知或真实邮件；现有 GitHub Pages 仍是静态展示，不声称其已连共享 API。

## 2. 请求投影：只发送合同字段

基础绑定从当前 GET 构造，不使用生成例子的固定 UUID：

```js
const binding = {
  schemaVersion: data.schemaVersion,
  sessionId: data.sessionId,
  taskId: data.task.taskId,
  datasetVersion: data.datasetVersion,
};
// 先 GET；容量 remainingSubmissions 不代表提交已经开放。
if (!data.workflow.canSubmit || data.workflow.nextSubmissionVersion === null) {
  throw new Error('Refresh the shared state before submitting.');
}
const submissionVersion = data.workflow.nextSubmissionVersion;
const previous = submissionVersion === 2 ? data.versions[0]?.submission : null;
if (submissionVersion === 2 && (!data.workflow.canResubmit || !previous)) {
  throw new Error('A V2 submission requires its V1 review and binding.');
}
const publicWork = {
  ...binding,
  candidateId: data.candidate.id,
  submissionVersion,
  previousSubmissionId: previous?.submissionId ?? null,
  previousContentFingerprint: previous?.contentFingerprint ?? null,
  summary: draft.summary,
  findings: draft.findings.map(({ id, section, title, detail, source, confidence }) =>
    ({ id, section, title, detail, source, confidence })),
  processEvidence: draft.events.map(({ id, at, title, detail }) =>
    ({ id, at, title, ...(detail === undefined ? {} : { detail }) })),
};
```

- 草稿以 `sessionId/taskId/intendedSubmissionVersion` 隔离；V1 More 后可显式从 V1 复制公开作品到 V2 草稿，展示 HR 的具体缺证 comment；编辑不修改 V1，刷新可恢复各版本地草稿。只在点击正式补交后创建 V2。
- `draft.notes` 永远留在 Candidate 本地；不要 `JSON.stringify(state)` 或展开整个 state。嵌套 finding/event 也使用白名单。
- HR 的旧表单 `notes` 若代表公开审核理由，**映射成 `comment`**；它会在共享响应/报告中展示，与 Candidate 私人 notes 是两个概念。服务不接受请求字段 notes。
- `processEvidence` 对应原 Candidate `events`，后端标为 client_reported；脚本示例事件明确标为生成 fixture，不假装记录真人操作。
- 发任务：`{...binding,instructions}`；分析：`{...binding,submissionId,contentFingerprint}`；审核再加 `{requirementId,decision,comment}`。后两者只用当前正式版本的 ID/指纹，审核按钮来自 `workflow.allowedReviewDecisions`；历史选择不改写请求目标。
- 所有 POST 使用 application/json 和 Idempotency-Key。一项按钮动作生成并保留一个 UUID；网络不确定时用相同 key 与相同 body 重试，**不要每次重试生成新 key**。有意发起失败后的新分析才使用新 key。
- POST 成功后重新 GET。同会话旧 key 可返回 V1 历史收据，`meta.replayed:true` 不是最新页面状态；新 key 对旧 V1 分析/审核是 `STALE_SUBMISSION`。409 或 stale 错误也先 GET，不乐观覆盖共享对象。
- reset 是演示管理员脚本操作；别把控制令牌嵌入 Vite bundle 或普通候选人页面。新会话后丢弃旧绑定；可保留旧私人草稿作本地备份，但不自动提交到新任务。

完整可复制的 payload/response 在 [examples manifest](examples/manifest.json)，自动生成，不是另维护的接口定义。

## 3. 原前端状态映射

| 服务数据 | Candidate 显示 | HR 显示 / 按钮 |
| --- | --- | --- |
| `task.status=draft` | 预置申请已存在，等待真正收到任务 | 初始报告；允许发送一次 |
| `sent` | Task Received；本地编辑 V1；workflow 开放提交 | Task Sent；尚无正式作品 |
| `submitted`、currentSubmissionVersion=1 | V1 Submitted / In Review，显示快照 | V1 作品；允许分析与一次三分支审核 |
| `awaiting_revision` | V1 审核理由 + V2 本地草稿入口；只开放一次补交 | V1 只读；等待补证，不重新发任务或审核 V1 |
| `submitted`、currentSubmissionVersion=2 | V2 Submitted / In Review；保留 V1 回看 | V2 新作品、独立分析/审核；仅 Confirm/Insufficient |
| `reviewed + confirm`（V1/V2） | Review Complete；有限任务证据已人工确认 | 目标 verified，其他两项不变；终局 |
| `reviewed + evidence_still_insufficient`（V1/V2） | Review Complete / Evidence Still Insufficient | 目标 uncertain，保留 comment；终局 |

服务的顶层 `submission/analysis/review` 始终是当前正式版本；`versions` 用于最多两版的只读回看。V2 草稿存在时服务仍指 V1；V2 正式提交后才切换当前版本，analysis=not_started、review=null，不继承 V1 结论。`workflow.remainingSubmissions` 是容量：V1 终局还剩 1，但 canSubmit=false；前端以 canSubmit/canResubmit/nextSubmissionVersion/isTerminal 决定入口，不自行恢复 working。

**旧 Candidate `more → working` 仅在服务确认 V1 More 时适配为“V2 草稿”**，而非覆写 V1。V1 Confirm/Insufficient、V2 任一终局都关闭提交；V2 More、V3、HR REOPEN 与历史版重新审核不在合同中。原 LOAD_SUBMISSION、模拟审核/邮件等 Demo controls 不得覆盖 API 真状态；保留时只在清楚隔离的本地模拟区显示。

`analysis.status` 按版本单独显示：not_started / running / succeeded / failed。失败保留作品；当前未审版仍可人工审核，展示稳定 code，不显示假成功。人审先于分析完成时该版冻结为 failed/AI_REVIEW_CLOSED，旧请求晚到为 STALE_ANALYSIS；刷新当前状态，不将其写进 V2，也不显示为可继续重跑的历史版。result.mode：

- `manual_simulation` → “手工规则模拟 · 非模型运行”；观察只表明文本存在，不证明分析能力。
- `live` → “本次服务端模型提取”；仅首次请求完成响应。
- `replay` → “已保存的真实模型结果”；保留原模型、时间和指纹。

当前项目没有真实模型调用记录；日常本地演示默认 disabled，或显式 manual_simulation。`not_observed` 要有正式展示状态，不强行画成五项绿色成功。AI 分析完成不触发 Confirm；Confirm 也不是录用决定。

## 4. 页面数据和来源替换

唯一事实来源是 GET 的 `dataset`；详细逐文件/符号替换见 [DATA 第 4 节](DATA.md#4-小傅接入替换清单本轮未修改前端)，不要留下第二套前端事实数组。

- 固定人物/岗位不变：HarbourCart、Alex Chen、Junior Data Analyst；要求为 SQL、Data Analysis、Business Problem Solving。
- 时间窗统一 Previous 4 weeks / Last 4 weeks。总量 **1,000,000→1,180,000 sessions；34,000→30,680 orders；3.4%→2.6% CVR**。本期广告 AUD 48,000；涨幅显示 +15.00%；订单 −9.76%，CVR −0.8 个百分点。
- 两端 KPI、CSV、资源预览、下载、渠道表、图表和示例文案一起替换。Paid Search 426,000 sessions / 7,668 orders / 36.10% 流量份额；其 3.2%→1.8% 下滑仍只支持进一步调查。
- 任务 20 分钟，不强制截止。`dataset.trafficTrend` 是两个四周期间，不再是五个周 snapshot；X 轴用 label。
- `campaigns.csv` 是渠道比较，不是旧的广告系列逐项数据；`landing_pages.csv` 现在是 Paid Search 设备分区：1.4% mobile、约 2.752381% desktop，缺少具体页面、历史设备分组及 load times。删除旧 4.8s、Spring Sale 1.0%/2.7%、campaign 1.1%/3.1% 等本版本没有来源的事实。
- CSV 下载直接用资源 `content` 和 `mimeType`，大小由 `sizeBytes` 格式化。资源名同时是 source ID，不创建虚构下载 URL。
- Candidate `dataset.channels` 兼容 channel/traffic/growth/orders/conversion/previous/revenue；HR 可映射为自己的视图字段。不拿格式化后的百分数反算事实。
- 初始申请三来源（SQL 源码、计算表、resume 自述）和报告明确 preset/synthetic；不是实际上传或动态解析。SQL 代码存在不等于实际执行正确。

## 5. HR 作品与引用接线

- 当前作品只渲染 `data.submission.summary/findings/processEvidence`，不是 HR 原来的固定 workSections/timeline。历史回看选择 `data.versions[n]`，其 submission/analysis/review 成套展示；V2 存在后选择历史 V1 只影响本地视图，该历史版的所有写按钮关闭。
- 所选版的 `submissionId/contentFingerprint` 与该版 analysis 绑定核对后展示观察；V1 引文与 comment 留在 V1。忽略本地旧预置结果，不用当前 V2 的分析填充 V1。
- 初始材料点击 `application.sources`；任务数据点击 `dataset.resources`；AI 引文定位**所选版本** `submission.sources` 的 sourceId/location。DOM 定位可用 `submissionId + sourceId` 命名空间，避免两版同名 finding ID 串联。
- 引文高亮使用 UTF-16 `start/end`，end exclusive。`text.slice(start,end)` 必须等于 quote；source ID 或指纹不匹配就显示过期并刷新，不跳到另一个样例。React 作为纯文本展示，不使用危险 HTML 注入。历史引用按所选版校验，不因它并非当前版而误标损坏。
- `report.requirements[].displayStatus/displayLabel` 是一致的当前支持状态文案；`sourceRefs` 是初始来源、`submissionSourceRefs` 是本次作品位置。目标有 review 时为 `mode:human_reviewed`，summary 展示本次决定/理由，其余两项仍为 preset；`application.initialReport` 始终独立保留初始 before，当前人工结果读 review，历史人工结果读 versions[n].review。V2 未审时当前报告保持 uncertain，不继续使用 V1 More 摘要。
- 任意 Confirm 更新仅针对 BPS，仍显示 scope/uncertainty；不展示总分、排名、招聘决定或已证明的因果结论。

## 6. 双端 UI 联调检查表（待小傅接入后实际执行）

- [ ] HR/Candidate 两个浏览器页面 GET 到相同 session、task、datasetVersion。
- [ ] 发任务前 Candidate 不伪装已收到；发送一次后另一端刷新可见。
- [ ] Candidate 输入 `EB-UI-V1-UNIQUE-<当前时间>`，正式提交后 HR 与刷新页面逐字相同；V1 本地改动不覆盖服务快照。
- [ ] V1 More 后同一 session/task/dataset 显示具体缺证 comment，只开放 V2 草稿；加入 `EB-UI-V2-UNIQUE-<当前时间>` 并正式补交，HR 读取新 ID/指纹，analysis/review 不继承 V1。
- [ ] V1/V2 开发者工具 Network 检查：Candidate notes 及独特私人句未进入任何请求、导出、共享响应；HR comment 作为公开理由单独发送。
- [ ] 两版引文分别定位本版作品，emoji/中文偏移正确；V2 后 V1 原文、分析与审核逐字保持；历史选择无编辑/分析/审核按钮。
- [ ] V1/V2 Confirm 仅 BPS 变 verified，双方读到同一 comment；V1 More 为 awaiting_revision，V1 Insufficient 与 V2 两终局结束；V2 More/V3/重开均无入口。
- [ ] AI disabled/失败时原作品可审；manual/live/replay 标签诚实；not_observed 不展示成正面能力。
- [ ] 双击/网络超时同 key 重试不重复提交；旧 V1 收据重放后 GET 仍展示当前 V2；新 key 旧绑定报 stale，不误覆盖页面。
- [ ] 人审与运行中分析交错，显示 AI_REVIEW_CLOSED；迟到结果不改变人审历史或 V2。
- [ ] awaiting_revision、V2 待审、V2 终局各刷新/同库重启保留状态与两版引用；reset 后新会话可重演，两版历史都清除。
- [ ] schema 2.0 使用新的数据库路径；旧 1.0 文件原样保留，启动错误按 README 处理，不以删除库解决。
- [ ] KPI/表格/CSV/下载/任务时长/图表数值都来自同一 datasetVersion。
- [ ] 演示控制不混用旧 localStorage；GitHub Pages 与本机共享运行方式分别说明。

责任终点：后端本地实现与 API 验证由本任务负责；上述浏览器接线和双端 UI 验证由小傅继续。旧单轮测试不替代修订 3 的两版与竞态验证；计划见 [REVISION_PLAN](REVISION_PLAN.md)。全部本轮后端相应检查通过后可写：**“后端验收完成，双端 UI 联调待小傅接入。”** 真人试用、真实模型实验、推送/PR/发布不由本交接暗含执行。
