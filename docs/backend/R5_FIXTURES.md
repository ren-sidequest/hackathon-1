# 修订 5：合成申请材料、rubric 与确定性求分

## 范围和真实状态

本模块实现 B02/B05 所需的四份独立材料、十项 rubric、逐项来源标注、三种固定任务模板与纯算术求分。四人共用的服务、HTTP DTO、持久化和名单由 R5 服务层另行接入；本文件不把模块测试当作完整双端或真实模型验证。

固定版本：

- `jobId = junior-data-analyst`
- `fixtureVersion = harbourcart-applications-v1`
- `rubricVersion = harbourcart-rubric-v1`
- 任务数据仍为 `harbourcart-2026-09-v1`；全部模板沿用现有 `createSeed().dataset.resources`，没有新增或替换业务数值。

公司为合成的 HarbourCart Pty Ltd，悉尼配饰、手提袋、文具零售商，约 25 人，部分履约外包。运营经理招聘、创始人批预算、没有专职招聘团队。岗位目标顺序为核对报表、调查分组变化、提出可验证且有优先级的行动；不是自动录用或能力百分位模型。

## 公共导出与调用约定

`app/backend/src/r5/rubric.ts`：

- `RUBRIC_VERSION`、`REQUIREMENT_IDS`、`CRITERION_IDS`、`CRITERIA`、`RUBRIC`。
- 类型 `RequirementId`、`CriterionId`、`Mark`、`Criterion`。
- 十项均有 4／2／0 详细锚点，SQL/DA/BPS 权重 30/30/40，每项 10 分。3 和 1 在档位说明中定义。锚点依据总方案修订 5 §5.7；运行时深冻结，调用方修改会失败。

`app/backend/src/r5/scoring.ts`：

- `calculateScores(items, options?)` 和 `isMark(value)`。
- 类型 `ScoreItem`、`ScoreOptions`、`CriterionScore`、`SkillScore`、`Scores`。
- 默认要求恰好十项；`targetRequirementId` 要求恰好该技能的 3 或 4 项，其他项目明确保持待评；`allowPartial: true` 可用于尚未完成的评估快照。
- 拒绝重复、未知、非目标 criterion、非整数或越界 Mark；默认完整组缺项也失败。错误为 `RangeError`，HTTP 错误映射由服务层负责。
- 该函数只计算，不验证引用。写入评分前应先调用下面的材料校验，并由公开 DTO 拒绝自报总分。

`app/backend/src/r5/fixtures.ts`：

- `CANDIDATE_IDS`、`CANDIDATES`、`COMPANY`、`JOB`、`FIXTURE_VERSION`、`TASK_TEMPLATES`、`B3_EXPLANATION`。
- `getApplication(candidateId)` 返回可独立处理的深复制；未知／缺省 ID 报错，不默认选择 Alex。
- `validateSourceRef(snapshot, ref): boolean`。
- `validateAssessmentItems(snapshot, items, expectedCriterionIds?): void`；适用于 application、work_sample 和 client_reported_event 来源。服务层仍负责候选人与任务归属、评估阶段、当前版本与持久化原子性。
- 类型 `CandidateId`、`Candidate`、`EvidenceSource`、`EvidenceSnapshot`、`SourceRef`、`AssessmentItem`、`PresetReport`、`ApplicationBaseline`、`ApplicationSnapshot`、`TaskTemplate`。
- `ApplicationSnapshot` 的 `baseline.items`、`baseline.score` 和材料绑定可供服务层包装为 assessment record；`initialReport` 是独立预置的定性材料观察，不从分数或 Mark 自动推导 Supported/Verified。
- `TASK_TEMPLATES[requirementId]` 暴露 `templateId/title/instructions/targetRequirementId/timeboxMinutes/resourceIds/observationDimensions` 等字段。三模板均为建议 20 分钟、不强制计时，也不按姓名限制可用性。SQL 观察为 S1–S3，DA 为 D1–D3，BPS 保留既有五维观察名称。

## 源材料先于评分

| 人物 | 实际材料 | 仍有的限制 |
| --- | --- | --- |
| Alex Chen | 保留原 SQL、月度计算表与 CV；本 fixture 版本新增独立 `business_memo.md` | SQL 没有检查证据；B3 只有具体请求，缺少区分方法；B4 缺少行动材料 |
| Maya Patel | 独有 CV、明确缺少查询的 SQL 自述、文具促销计算与业务报告 | SQL 三项均 NE；自述和正确计算不冒充可审查询 |
| Leo Zhang | 合作商店项目的 CV、日粒度查询、检查方法和业务报告 | 静态审阅，不声称查询运行、独立完成或生产能力；行动阈值仍待明确 |
| Sam Taylor | 筹款项目 CV、SQL 与检查说明、存在推理问题的业务报告 | B2 单因果断言、B3 循环验证、B4 与自身判断冲突，有实际引文支持 0 分 |

材料常量在标注定义之前完成；引文从已定义的对应个人文本生成。Alex 的月度练习与 HarbourCart 任务数据明确分开，新增 memo 说明其为本版申请附件，而非未来 V1/V2。其他人的独立项目数值也不冒充 HarbourCart 任务数据。共用 `analysis.md`、`query.sql` 文件名允许存在，归属由完整来源命名空间隔离。

每项固定包含 `criterionId/mark/rationale/support/gaps/uncertainty/nextStep/checkedSourceIds/sourceRefs`，其中解释字段均为非空字符串。数值项至少一处引用；NE 可以没有正向引文，但保留已检查范围和缺失解释。没有引文的数值 0 同样校验失败。

### 来源指纹与定位

申请指纹采用现有 canonical JSON SHA-256 工具，输入仅为：

```text
{ candidateId, jobId, fixtureVersion, materialVersion, evidenceSnapshotId, sources }
```

基准标注和计算结果不进入材料指纹，避免循环依赖。每个引用绑定 `candidateId + evidenceSnapshotId + fingerprint + sourceId + location`，`start/end` 为 JavaScript UTF-16、左闭右开：`text.slice(start, end) === quote`。校验拒绝跨人、旧快照、旧指纹、错误位置、非整数边界与伪造引文。服务层应传入自己持有的可信只读快照，而非请求方自报的来源文本。

## B3 的实际展示链

`B3_EXPLANATION` 对应 Alex 的真实申请附件，不是脱离材料的评分示意：

- 公司要求：在进一步增加广告预算前，明确应优先调查什么。
- 标准：B3 有区分力的补证计划。
- 来源：`alex-chen / alex-chen-application-v1 / business_memo.md / /sources/3/text`。
- 指纹：`3c27e97e76517e67e56e2b706400ffa61d397e444e7a0de81b55ed5e846bac0e`。
- UTF-16 区间 `[757, 813)`，引文如下，含中文、emoji、真实换行：

```text
🔎 补证想法
我会请求两个期间的 campaign × device 明细，以及各步 checkout 事件。
```

请求具体，但没有说明比较方法及结果如何改变判断，因此 2/4，贡献 `2 / 4 × 10 = 5`。追问为“你将怎样解释不同结果，哪些结果会改变你的判断？”，没有把另一份完整参考答案作为候选人的补交提示。

## 分数状态

- `mark: null`／criterion `pending`：尚未评，不是 NE。
- `mark: 'NE'`／`needs_evidence`：本项已审但材料不足，贡献为空，不写成 0。
- `assessmentComplete`：整组十项都已评，包括 NE。
- `complete`：十项都有数值；只有此时 `overallScore/overallPercentage` 有值。
- `coveragePercent`：十项已审时为数值项目数除以 10；未完成时为空。
- `accruedScore`：仅已评数值贡献之和，永远不包装成完整综合百分比。
- 技能全为数值时才有该技能 `score/percentage`，不对缺项技能重新加权。
- 计算不先舍入技能百分比；显示层使用一位小数。固定 100 分的综合百分比直接等于总分，避免无必要的浮点除乘。
- 没有姓名输入、自动通过线、自动录用、按个人背景打破并列或 AI 自由总分。

算术向量 A–D 只存在测试里，未绑定四人。当前材料标注的核对值为：

| 人物 | S1/S2/S3 | D1/D2/D3 | B1/B2/B3/B4 | 覆盖率 | 已评累计 | 综合 |
| --- | --- | --- | --- | ---: | ---: | ---: |
| Alex | 3/2/NE | 4/2/3 | 3/3/2/NE | 80% | 55 | 空 |
| Maya | NE/NE/NE | 4/4/3 | 4/3/3/3 | 70% | 60 | 空 |
| Leo | 4/4/4 | 4/4/4 | 4/4/4/3 | 100% | 97.5 | 97.5 |
| Sam | 4/3/4 | 4/4/2 | 2/0/0/0 | 100% | 57.5 | 57.5 |

这些是合成材料内的示范判断，不是标准化考试、真实能力常模或外部效度证明。

## 标注方式与复核记录

统一显示“合成案例·预置人工评估”，`annotationMode = preset_human` 仅为产品中的基准 fixture 类别。实际制作由 AI agent 完成；另一独立 QA agent 已核对 40 项标注、35 条数值项引文、来源归属、UTF-16 和小规模算术。数据内同时公开 `actualAnnotation = ai_agent_authored_fixture`、`actualReview = ai_agent_review`、`humanCalibration = pending`、`externalExpertValidation = false`，不将 AI 自查或双 agent 复核称为外部专家或真人审批。

2026-09-19 独立 QA 记录：申请材料与任务数据边界、原文与理由、Sam 的反向证据均已核对，未发现必须修改的内容缺陷；为进一步减少来源歧义，Alex 新 memo 中“task brief”调整为“published synthetic scenario brief”。实际两名团队成员的独立标注、分歧讨论与雇主／岗位专家校准仍待执行。

## 本地验证

在独立 fixture worktree、Node 22.23.2、既有锁文件依赖下执行，无新增依赖：

```sh
npm ci --prefix app/backend --ignore-scripts
npm run typecheck --prefix app/backend
npm run build --prefix app/backend
node --test app/backend/test/r5-scoring.test.mjs
npm test --prefix app/backend
```

专项测试覆盖 A–D、所有固定 100 分增量总分、NE/0/待评、定向子集、越界/重复、不可变 fixture、40 项绑定、中文/emoji/换行、同名文件跨人、旧指纹、原资源一致性。完整后端测试另保留旧 API 与有限两版回归；主任务集成后的 HTTP/存储/前端结果由其验证记录负责。

### 2026-09-19 实测结果与旧 API 2.0 浏览器回归

独立 fixture worktree 的服务入口仍为保留的 API 2.0；新增模块已纳入构建与单测，未把未集成的 API 3.0 当作这里的浏览器验证对象。

| 实际命令 | 结果 |
| --- | --- |
| `npm run typecheck --prefix app/backend` | 通过 |
| `npm run build --prefix app/backend` | 通过 |
| `node --test app/backend/test/r5-scoring.test.mjs` | 15/15 通过 |
| `npm test --prefix app/backend` | 160/160 通过 |
| `npm run build --prefix app/candidate` | 通过，含共享 API 客户端与 HR ApiApp 的 TypeScript 检查 |
| `npm test --prefix app/candidate` | 3 个测试文件、27/27 通过 |
| `npm run build --prefix app/hr` | 通过 |
| `npm test --prefix app/hr` | 8/8 通过 |
| `npm run test:api --prefix app/candidate` | 11/11 通过，46.5 秒，1 worker，未重试 |

浏览器由既有 Playwright 配置启动独立 `8789` 内存后端、`5373` Candidate、`5386` HR，`reuseExistingServer: false`；没有写入正式数据库。验证涵盖跨端唯一文本、V1→More→V2→Confirm、两种终局、中文/emoji 引文、私有笔记隔离、断网幂等恢复、迟到分析隔离、reset 隔离、统一资源下载、主题/窄屏，以及 Candidate 读取当前 V2 意见。这里的 AI 是标明的 manual simulation，不是付费模型质量实验。

本机临时日志：`/tmp/evidencebridge-r5-fixtures-test.log`、`/tmp/evidencebridge-r5-candidate-build.log`、`/tmp/evidencebridge-r5-candidate-unit.log`、`/tmp/evidencebridge-r5-hr-build.log`、`/tmp/evidencebridge-r5-hr-unit.log`、`/tmp/evidencebridge-r5-api2-browser.log`。截图位于本 worktree 忽略目录 `.ci-results/api-ui/`，未提交。

**继承的依赖风险：**按锁文件安装时，HR 的 Vite 7.1.7 被 npm audit 报告为 1 个 high 直接依赖风险，包含开发服务器文件访问相关公告；详情保存在 `/tmp/evidencebridge-r5-hr-audit.json`。本次没有升级锁文件、执行自动 audit fix 或改变 UI。Candidate/backend 安装审计未报告漏洞；这是当时安装输出，不是永久的依赖保证。前端维护者应另行安排依赖更新与回归。
