# EvidenceBridge 后端验证记录

日期：2026-09-19（Australia/Sydney）。单元/API/前端回归由独立 QA 角色 AI agent 执行；实际 HTTP 客户端复现另由架构/交付角色 AI agent 执行并核对日志。均不是外部用户试用、真人批准或比赛现场验证。

## 0. 修订 3 / schema 2.0：本轮有限两版验收

**当前结果：后端验收完成，双端 UI 联调待小傅接入。** 本轮实现 V1 + 最多一次获准 V2 补交；schema 2.0 的结果见本节。下方第 1–4 节保留 schema 1.0 / 提交 `6fb19a9` 的历史记录，其 116 项及 10 项结果不冒充两版验证。上述验收发生在原分支本地工作区，该验收阶段未执行提交、推送或部署；后续发布状态以 GitHub PR 为准，旧 PR/CI 结果不替代新版检查。

### 0.1 执行环境与实际结果

Node.js `v22.23.2`、npm `10.9.8`、macOS arm64；沿用依赖与案例 `harbourcart-2026-09-v1`。本轮日志在仓库外目录 `revisions-qa-20260919`，下文记为 `$REVISION_QA_ROOT`；配置这个变量为自己的绝对路径，不上传原始日志、DB、token 或本机路径。

| 检查 | 本轮实际结果 | 记录 |
| --- | --- | --- |
| `npm test`（含 strict TypeScript 构建） | **145/145 通过，18.285 秒**，无失败/跳过 | `backend-tests.log` |
| `npm run test:coverage`（重新构建） | **145/145 通过，27.102 秒** | `backend-coverage.log` |
| 测试文件构成 | analysis 56、原 API 31、安全/持久化 23、种子 7、两版专项 28 | 保留并适配旧 116 项，新增 29 项 |
| `npm run typecheck` | 主代理本轮复跑通过 | 与最终两版源码对应 |
| 仓库文档/补丁检查 | **17 份文档与本地链接通过**，`git diff --check` 通过 | 新增 REVISION_PLAN；旧阶段 16 份留在历史记录 |
| 真实 HTTP / CLI / 独立进程 | 两版补交流程及防护 **42/42 通过**，最终构建后再次全通过，单独计数 | 最终 `run-4ZVSvP/report.json`；首轮 `run-j9YDK2/report.json` 保留 |
| 原前端必要回归 | Candidate 单测 21、E2E 9、共享 UI 10；HR 单测 8；两端 build 通过 | 主代理独立执行；`frontend-regression.log` |
| 前端文件边界 | `git diff -- app/candidate app/hr app/shared` 为空 | 旧页面回归共 48 项，不是新版 API 联调 |

从后端目录复现 `npm test`、`npm run test:coverage`；从仓库根使用相应的 `--prefix app/backend`。本轮没有调用真实模型或引入新增依赖。原前端的 HR Vite 公告与 Candidate chunk 提示仍属于既存限制，没有靠改前端代码绕过回归。

首轮 **141/142**：种子仍暴露 `schemaVersion: "1.0"`，与新 2.0 合同不符；根代理将其改为共用 `SCHEMA_VERSION`，未改变 datasetVersion。失败原日志保留为 `first-tests-before-seed-fix.log`。修复后先 144 项通过，再补当前 V2 分析中断恢复，形成最终 145 项；没有删除失败断言。

### 0.2 两版行为与负向覆盖

专项测试：[versions.test.mjs](../../app/backend/test/versions.test.mjs)。现有 API/安全测试也已按 schema 2.0 及 `state.versions[]` 适配。

- **主线与状态**：V1 直接 Confirm / Evidence Still Insufficient 终局；仅 V1 Needs More Evidence 保存具体意见并进入 awaiting_revision。`remainingSubmissions = 2 − submissionsUsed` 表示物理余量，V1 终局仍可为 1，但许可为 false、nextSubmissionVersion 为 null。
- **真实同会话补交**：先提交薄弱 V1，读取具体审核意见，编辑客户端草稿，再在同一 session/task/dataset 创建 V2；不以 reset 或加载中间状态冒充补交。草稿不修改 V1；V2 拥有新 ID/指纹及 V1 前链，初始分析 not_started、review null，不继承旧结果。
- **三类材料**：有依据、漂亮但无依据、把相关性当因果；两版配对分别保留当前原文、逐字引文、模式及人审结果。manual_simulation 和 TEST-STUB 模型只验证工程合同；不声称模型实际判断了答案优劣。提交或分析成功始终不自动升级证据。
- **次数与输入**：三个新增字段必填；版号/前版 ID/指纹校验；V1 未获准和终局后拒绝 V2；V2 拒绝再请求补证及第三份作品。显式 `submissionVersion: 3` 为 400 INVALID_REQUEST；已有两版再发 schema 内的 1/2 为 409 SUBMISSION_LIMIT_REACHED。
- **并发/幂等**：同 key 同体 V2 重放，竞争不同 key 只创建一份 V2；历史 key 同体返回对应历史收据并标 replayed，而历史 ID + 新 key 返回 STALE_SUBMISSION；旧 session 在业务收据重放前拒绝。Reset 保留其特殊重试防误清规则。
- **分析与人审竞态**：人审仅把 running 变成 failed / AI_REVIEW_CLOSED，并把该 attempt 的 202 收据改为 409；未运行保持未运行、已成功保持原结果。V1 晚到成功/失败均 STALE_ANALYSIS，不改冻结的 V1 或 V2；冻结 V2 也不覆盖 V1 已完成收据。
- **分版 provenance**：TEST-STUB 的首次分析响应只对刚生成的版标 live；GET/重试的顶层及历史数组均标 replay。sourceId 可在两版重复，但逐字引文和输出绑定各自 submissionId/fingerprint，不串版。
- **隐私**：V2 根对象、finding、event 中的私人 notes 都拒绝；共享历史、当前响应、模型输入没有该字段的秘密哨兵。此前 headers/query/异常/日志脱敏及访问边界回归继续通过。
- **持久化**：awaiting_revision、V2 submitted、V2 final 均关闭并重启恢复相同历史。实际 SIGKILL 用例继续覆盖进程锁和 V1 中断；新增 V2 running 故障注入恢复为 AI_INTERRUPTED，旧收据 503，新键仅重跑 V2，V1 真实失败记录原样保留。
- **损坏与旧库**：历史 ID 重复、顺序颠倒、V1 错误终局但存在 V2、V2 审核旧 ID、旧结果充当当前结果均 fail closed 并保留记录。旧 user_version 0/1 的已有库在写 PRAGMA/DDL 前拒绝且文件字节不变；2 格式缺表也不静默补建。新库 user_version 2，默认文件 `var/evidencebridge-v2.sqlite`。

### 0.3 当前代码覆盖率

| 编译后业务模块 | 行覆盖率 | 分支覆盖率 |
| --- | ---: | ---: |
| analysis.js | 98.93% | 96.28% |
| app.js | 99.21% | 89.23% |
| config.js | 100% | 100% |
| service.js | 100% | 96.70% |
| store.js | 100% | 92.98% |
| seed.js / schema.js / response-schema.js | 100% | 100% |

all files 为 95.73% 行 / 95.81% 分支，含测试及部分 CLI，不作为纯业务覆盖率。server 启动与完整 CLI 路径由独立 HTTP/进程验证补充，而不是宣称均已被 instrumentation 覆盖。

### 0.4 真实 HTTP 与仍待完成的验证

架构/交付代理的 `verify-revisions.mjs` 启动独立服务器进程和临时 SQLite，分别验证 V2 Confirm / Insufficient、三个持久化阶段重启、错误前链/旧 ID/上限、reset、CLI 入口、disabled AI 和日志凭据排除。QA 已读取首轮及最终构建后的复跑原始报告：最终 `$REVISION_QA_ROOT/run-4ZVSvP/report.json` 为 **42/42 passed**，`modelCalls: 0`、`temporaryServicesStopped: true`、`temporaryDatabasesRemoved: true`。同目录保留服务/CLI 日志及六份合成快照；无真实候选人数据。

根代理另用现有 GitNexus CLI 在本项目独立环境执行前后 `index-only` 与变更影响检查，没有使用另一个旧副本的索引或改全局配置。最终已跟踪差异报告 39 files / 234 symbols / 30 flows，工具标记 critical 表示合同/恢复核心改动影响范围大，不是发现某个具体漏洞；未跟踪的新测试不计入该静态统计，也不据此宣称全覆盖。实际正确性仍以本节 API、持久化与回归结果为据。

本轮原前端回归来自独立、干净的 `31edc53` clone：E2E 9 项 12.0 秒、shared UI 10 项 9.0 秒；这是既有页面没有损坏的证据。**小傅仍需接入 schema 2.0，完成 V1→意见→V2 的双端 UI/API 联调；真实模型实验、真人评估、公网部署及新版远端 CI 均不由当前本地测试宣称完成。**

---

**以下第 1–4 节是 schema 1.0 历史验证记录，仅供追溯。**

## 1. 环境与改动边界

为避免公开本机用户名，本文将实际独立 QA 目录记为 `$QA_ROOT`（目录名 `backend-qa-20260919`，位于仓库外）。复现前将此环境变量设为自己的绝对路径；原始日志保留在本机，不随源码上传。

- 开发副本：当前 `hackathon-1` 仓库，分支 `codex/evidencebridge-backend`，起始基线 `8b0231e9592052223e1512125387b14188fcda26`；最终核验远端后快进到 `31edc5319ee40b1d5d6e9e658a1526d7a3ab2f35`（主题/侧栏 #5），完整保留本轮后端改动。
- 旧前端回归使用新建独立 clone：`$QA_ROOT/repo`，先验证 `8b0231e`，再 fetch 并 fast-forward 到同一最终 `31edc53` 重新验证。未复用或修改历史审查副本。
- Node.js `v22.23.2`，npm `10.9.8`；macOS arm64。两端及 shared 前端跟踪文件无本轮后端修改，QA 副本仅快进已合并上游变化；两个前端锁文件跨基线不变，复用依赖。安装、构建、浏览器缓存和回归产物位于独立 QA 副本/目录。
- 用户暂停期间没有继续工作；恢复时核对无遗留 npm/测试进程，独立 clone 工作区干净。

## 2. 前端回归（两次基线分别验证）

### 2.1 起始基线 8b0231e

以下验证现有两端模拟应用未损坏，不证明新后端已接入两端 UI。

| 检查 | 实际结果 |
| --- | --- |
| Candidate `npm ci` | 通过；92 packages，audit 0 vulnerabilities |
| Candidate `npm test` | **18/18 通过**；现有 Vitest 状态/数据单测 |
| Candidate `npm run build` | 通过；TypeScript + Vite 8.3.0 |
| Candidate `npx playwright install chromium` | 通过；浏览器下载到独立 QA artifacts，未写全局浏览器缓存 |
| Candidate `npm run test:e2e` | **9/9 通过，14.1 秒**；Chromium 153.0.8010.12，4 workers，`CI=1` |
| HR `npm ci` | 通过；17 packages；现有锁定 Vite 的 audit 警告见下 |
| HR `npm test` | **8/8 通过**；现有 Node workflow tests |
| HR `npm run build` | 通过；Vite 7.1.7 |
| QA 副本 `git status --short` | 输出为空；前端跟踪文件没有变化 |

前端复现命令（从独立 clone 对应应用目录执行）：

```sh
npm ci
npm test
npm run build
# Candidate 另执行；该目录为本次 QA 专用缓存。
PLAYWRIGHT_BROWSERS_PATH="$QA_ROOT/browsers" npx playwright install chromium
CI=1 PLAYWRIGHT_BROWSERS_PATH="$QA_ROOT/browsers" npm run test:e2e
```

实际日志目录：`$QA_ROOT`，包含 `candidate-npm-ci.log`、`candidate-test.log`、`candidate-build.log`、`candidate-browser-install.log`、`candidate-e2e.log`、对应 HR 日志及 `hr-audit.json`。日志与浏览器产物不入库。

已发现的旧前端事项：

1. Candidate 构建产物主 JS 为 681.08 kB（gzip 200.57 kB），触发既有 500 kB chunk 警告；构建退出码为 0。本轮保护前端，未实施拆包。
2. HR `npm audit --json` 报一个 high 级直接依赖：已锁定 `vite@7.1.7`，含 6 条 advisory，包括 [GHSA-v2wj-q39q-566r](https://github.com/advisories/GHSA-v2wj-q39q-566r)、[GHSA-p9ff-h696-f583](https://github.com/advisories/GHSA-p9ff-h696-f583)、[GHSA-fx2h-pf6j-xcff](https://github.com/advisories/GHSA-fx2h-pf6j-xcff)。未擅自改前端依赖/锁文件；交小傅单独评估更新。此项不是后端新增依赖问题。
3. 旧 Candidate 单测/E2E 明确覆盖 Needs More Evidence 后重开/重提，HR 单测覆盖 REOPEN；这些是旧模拟行为，本轮 API 为单轮终态。旧回归通过不表示该旧行为符合新的 API 接入要求。

### 2.2 最终基线 31edc53：重新执行，不沿用旧绿灯

远端变化仅涉及共享日夜主题/侧栏及相关回归。按新 AGENTS 的命令执行，复用同一套锁定依赖与独立 Chromium 缓存。

| 检查 | 最终实际结果 |
| --- | --- |
| Candidate `npm test` | **21/21 通过**，2 个测试文件 |
| Candidate `npm run build` | 通过；主 JS 686.57 kB / gzip 202.24 kB，仍有原 chunk 提示 |
| Candidate `npm run test:e2e` | **9/9 通过，18.2 秒** |
| Candidate `npm run test:ui` | **10/10 通过，15.8 秒**；自动启动 Candidate 5273 / HR 5286 |
| HR `npm test` | **8/8 通过** |
| HR `npm run build` | 通过 |
| QA 副本 `git status --short` | 空；没有改写前端或锁文件 |
| 主开发副本 `git diff -- app/candidate app/hr app/shared` | 空；后端工作未修改前端 |

新增共享 UI 命令在 Candidate 目录执行：

```sh
CI=1 PLAYWRIGHT_BROWSERS_PATH="$QA_ROOT/browsers" npm run test:ui
```

最终前端日志：`final-31ed-candidate-checks.log`、`final-31ed-hr-checks.log`、`final-31ed-candidate-e2e.log`、`final-31ed-shared-ui.log`；原 `8b0231e` 回归日志保留。共享 UI 测试证明既有主题与侧栏交互回归通过，不代表新业务 API 已接入 UI。

## 3. 后端独立 API 测试

测试文件：[api.test.mjs](../../app/backend/test/api.test.mjs)，使用编译后的 `createApp()`、Fastify `inject()` 与独立内存/临时 SQLite，测试不走前端 localStorage。

实际结果：API 独立测试 **31/31 通过**；最终 `31edc53` 后端全套 **116/116 通过**（AI 适配/引用 55、API 31、安全/持久化 23、种子数据 7）。所有测试均使用合成材料、内存或临时 SQLite；无真实模型网络调用。

| 后端检查 | 实际结果 |
| --- | --- |
| 首轮 `node --test test/api.test.mjs` | 22/22 通过，5.21 秒 |
| 最终 `npm test`（主代理独立复跑） | **116/116 通过，6.277 秒**；日志 `root-final-tests-31ed-passed.log` |
| 最终 `npm ci` 与 `npm run typecheck` | 主代理锁定依赖重装与 TypeScript strict 均通过；QA 独立 typecheck 亦通过 |
| 最终 `npm run test:coverage` | **116/116 通过，8.79 秒**；包含重新构建及所有 node:test；无失败/跳过 |
| `npm audit --json` | 0 vulnerabilities |
| `npm run docs:generate`（主代理） | 连续两次成功；OpenAPI JSON 的 SHA-256 前后一致 |
| `git diff --check` | 通过 |
| `python3 scripts/check_repository.py` | 最终 **16 份文档与本地链接检查通过**；交接文档未落盘时的临时断链已随文件完成消除 |

测试入口从 `app/backend` 执行；仓库根没有 package.json，从根调用应使用 `npm test --prefix app/backend`。本轮一次在根执行未加 prefix 得到 ENOENT，随后按正确目录完成上述检查；没有删除检查或改依赖规避错误。

```sh
npm test
npm run typecheck
npm run test:coverage
npm audit --json
```

后端日志在同一独立 QA artifacts 目录：`backend-api-first-run.log`、`backend-all-tests.log`、`backend-typecheck.log`、`backend-coverage.log`、`backend-audit.json`；最终覆盖率完整日志为 `final-31ed-backend-coverage.log`。OpenAPI 重复生成核验见 `openapi-before.sha` / `openapi-after.sha`，两次均为 `0202327b3684f03db02863e8f153a3d70f92b6b889472efbefd2278a0c8973a0`。以上测试执行时，源代码处于本轮提交前工作区；这些是本地结果。发布后另在 PR 中核对当前提交的 CI，不沿用此记录推定远端状态。

覆盖率按编译后的业务模块分别报告（Node coverage）：

| 模块 | 行覆盖率 | 分支覆盖率 |
| --- | ---: | ---: |
| analysis.js | 98.93% | 96.28% |
| app.js | 99.21% | 87.50% |
| config.js | 100% | 100% |
| service.js | 100% | 96.43% |
| store.js | 97.32% | 88.64% |
| seed.js | 100% | 100% |

报告的 all files 96.20% 包含测试文件及部分 CLI 路径，不当作纯业务覆盖率。server 入口与前端不属于这份 instrumented coverage；demo/reset CLI 的实操流程另有下一节的真实 HTTP 验证，未冒称 instrumentation 已覆盖所有启动路径。覆盖率不证明招聘效度、模型事实准确性或两端 UI 联通。当前 Node 的 SQLite ExperimentalWarning 是运行时提示，测试通过；首轮 Fastify 日志选项弃用提示已随主代理修订消除。

验证修正记录：新增“审核后摘要更新”断言最初误要求 summary 完全等于 comment，实际合同允许 `Human evidence review: confirm.` 前缀，导致一次 115/116。已改为同时核对决定前缀、完整原 comment、已验证 displayStatus/displayLabel、human_reviewed mode，并确保摘要不再等于旧缺口描述；业务代码未为此回退，最终 116/116。原失败日志保留为 `final-31ed-summary-assertion-before-correction.log`（主代理独立同类失败见 `root-final-tests-31ed.log`）。

覆盖范围：

- 独立读写请求的任务发送、独特测试句、不可变快照、来源/引文、Confirm 仅更新目标要求。
- Needs More Evidence 与 Evidence Still Insufficient 保留 Uncertain；本轮结束，无重开或重提。
- 先后顺序、旧 session/task/submission/数据版本/指纹、审核错误目标、重复及并发幂等键。
- notes 在根对象/发现卡/过程事件中均为非合同字段；畸形 JSON、类型、空白、长度、重复 ID、未知资源。
- Host/Origin、重置令牌、超长请求；重置重放不清空新作品。
- 分析关闭/异常/虚构引文/错误来源/错误指纹/缺少维度；原作品保留且可人工审核。
- 运行中的分析遇到 reset，迟到结果不写入新 session。
- SQLite 关闭重开后读取同一提交与决定；同数据库第二实例被阻止；存储状态损坏时启动失败并保留原记录；处理中断的分析恢复为 AI_INTERRUPTED，旧 202 收据更新为 503，新 key 可重试。
- 有依据、无依据、混淆因果三类作品经过手工模拟 API；只证明模式标签、引用与状态边界，不把规则模拟当成真实模型效果。
- 注入 test-only 输出验证 live → GET/retry replay 的模式合同；测试模型名明确为 TEST-STUB-NOT-A-REAL-MODEL，不是真实模型运行或真实回放记录。
- 严格本地配置边界、正确 CORS 预检，以及日志不包含请求体/查询值/任意头/模型异常正文。

### 3.1 实际 HTTP / CLI / 进程重启验收：另计 10/10

架构/交付角色 AI agent 启动独立 `node dist/server.js`、使用临时文件 SQLite，并实际执行 `scripts/demo.mjs` 与 `scripts/reset.mjs`。QA 已读取原始结果日志，**10/10 通过**，不加进 116 项 node:test 计数：

1. 真实 HTTP 发送、独特句快照、引文检查、Confirm 与独立两次读取。
2. 结束真实服务进程并新启进程，同一 SQLite 恢复相同提交和审核。
3. 重复运行 demo CLI 保留已有案例，不隐式重置。
4. 错误 reset token 保留状态，token 不进入输出。
5. 显式 reset 使用当前 session 并建立新案例。
6. Needs More Evidence 保持 Uncertain 且本轮结束。
7. Evidence Still Insufficient 保持 Uncertain 且本轮结束。
8. CLI 在请求前排除远程凭据目的地。
9. disabled AI 的错误保留作品，测试客户端人工审核仍完成。
10. 捕获的服务与 CLI 日志无 reset 凭据。

日志：仓库外 QA artifacts 中的 `backend-client-qa-20260919/client-checks.log`。临时服务已结束、临时数据库已清理。无真实模型调用，无前端 UI/API 联调声明。

## 4. 必须独立记录的未完成验证

- 真实模型调用实验、原始结果和人工效果评价：另行以实际运行证据填写；确定性 stub 与 manual_simulation 都不计作真实实验。
- 双端 UI API 联调：待小傅接入；浏览器里的私人 notes 请求排除、点击引用定位、跨端刷新与三分支演示需届时检查。
- 真人试用、评委演示、公网部署：本记录未执行；远端 CI 的后续状态独立见对应 PR。

schema 1.0 当时的 API/确定性验证结论为“后端验收完成，双端 UI 联调待小傅接入”；本次 schema 2.0 的最新结果与未验证事项以第 0 节为准。
