# API 2.0 前端交接

本轮以 `origin/main` 的 `b5b3604` 为基线，对照后端提交 `269615f`、仓库 [后端交接](backend/HANDOFF.md)、OpenAPI 与实际 Fastify / SQLite 实现完成接入。前端默认连接共享后端，HR 与 Candidate 仍分别使用自己的 React / Vite 和锁文件，未增加前端依赖。数字评分仍未实现。

## 与最新总方案修订 5 的关系

PR #7 是修订 5 继续复用的 **API 2.0 单案例接入基础**，不是新版完整交付。四人统一流程、公开 rubric、人工 Mark／NE 与规则百分比、同技能比较和人工保留名单已经获准实施，属于后续增量，不再是“评分暂缓／产品待决定”。

- 保留本 PR 的接入、V1/V2、版本引用、隐私、重试和测试；后续在这些基础上扩展，不重复开发。
- 后端由项目负责人完成四人归属合同、三类固定模板、评分／评估修订及名单持久化；小傅完成 HR／Candidate 两端页面、交互和浏览器验收，继续按双方已确认的修订 5 实施清单推进。
- 当前实际服务仍是单 Alex、API 2.0；新版功能尚未交付，不向旧 schema 发送尚未约定的字段，不把单人测试记作四人验收。
- 先修复并验证本 PR，再按明确指示合并；四人、评分和名单在后续 PR 实现。本次不部署、不迁移演示数据库，不更改两份实施清单的范围。

## 启动

建议 Node.js 24。从仓库根目录安装三端已有依赖：

```sh
npm ci --prefix app/backend
npm ci --prefix app/candidate
npm ci --prefix app/hr
```

分别在三个终端运行：

```sh
npm run dev --prefix app/backend
npm run dev --prefix app/candidate
npm run dev --prefix app/hr
```

后端 `http://127.0.0.1:8787`，Candidate `http://127.0.0.1:5173`，HR `http://127.0.0.1:5186`。同一后端才是同一个共享案例。使用默认地址无需前端 `.env`；如调整地址，参考各端 `.env.example` 的 `VITE_API_BASE_URL`，同时调整后端 `ALLOWED_ORIGINS`，重启 Vite。Vite 配置是构建时配置，发布后不能仅修改 `.env` 改变已有静态包。

后端默认禁用 AI。可以在 `app/backend/.env` 明确配置 `ANALYSIS_MODE=manual_simulation` 使用规则演示；界面会如实标注不是模型调用。真实模型按后端说明配置，密钥只能放后端。本轮未调用付费服务或验证真实模型质量。复位使用后端 `npm run reset --prefix app/backend`，需自行配置管理员令牌；前端没有管理员密钥或复位按钮。

旧版独立演示保留用于回归。需要时在各前端 `.env.local` 设置 `VITE_APP_MODE=standalone` 后重启或重新构建，页面明确标注独立模拟。旧演示的上传、模拟审核和本地数据不代表共享后端能力，也不会自动转换到新版本。默认连接失败会显示错误，不自动切换模拟。

## 对齐范围

| 前端行为 | 后端合同与约束 | 本轮落实 |
| --- | --- | --- |
| 初始化、跨端刷新 | `GET /api/demo` | 所有共享内容来自服务端；挂载、窗口聚焦、页面切换及手动刷新读取；分析运行时每 2 秒轮询 |
| HR 发送题目 | `POST /api/demo/task/send` | 仅草稿时编辑 instructions；发送后只读，不声称 AI 出题、上传或邮件发送 |
| Candidate 调查工作台 | `dataset`、`task` | 图表、指标、资源预览和下载使用真实响应；标注四周区间和 20 分钟建议；SQL/Python 仅展示示例 |
| 正式提交 | `POST /api/demo/submission` | 绑定 session/task/dataset/candidate/version；仅提交公开 summary/findings/processEvidence；允许较弱答案 |
| 补证 | `workflow`、`versions` | 只有 V1 的 needs_more_evidence 开放 V2；可从空白开始或主动复制 V1；使用前版 ID 与指纹；无 V3 |
| 快照历史 | `versions[]` | 每版工作样本、过程、分析、引用和审核配对，历史只读；V2 草稿不修改 V1 |
| AI 辅助观察 | `POST /api/demo/analysis` | 显示 not_started/running/succeeded/failed、真实模式、观察范围及不确定性；不把 observed 转为评分或 HR 确认 |
| 引用回溯 | `sources` + UTF-16 start/end | 根据选中版本的提交 ID / 指纹核验，并校验截取文字；无效引用显示错误，不换用别版样本 |
| 人工审核 | `POST /api/demo/review` | 只显示 allowedReviewDecisions；公开理由必填、最多 2,000 字符；AI 失败仍可审核；仅更新目标证据要求 |
| 最终状态 | `isTerminal`、`canSubmit` | 不用 remainingSubmissions 推断权限；V1 直接结束及 V2 结束均无后续提交入口 |
| 断网及并发 | Idempotency-Key、错误码 | 不确定请求保留原键原 body，支持同标签页刷新后重试；POST 后重新 GET，不用历史幂等回执覆盖当前状态 |
| 隐私 | 严格公开字段白名单 | notes 仅存本浏览器、当前 session/task/version 草稿；请求、公开草稿导出和已提交快照均不包含私人笔记 |
| 外观 | 既有共享 UI | 保留 HR 蓝色、Candidate 绿色、侧栏主题开关、折叠和手机抽屉；修复延迟加载时跨标签主题变更遗漏 |

所有合成数据都标注其来源。过程时间线是客户端报告，不是独立验证的能力或真实用时。草稿依赖本浏览器，跨设备同步、账号权限和多候选人列表不在现有合同范围。

## 仍需后端能力或产品决定

1. 实际材料上传、动态解析、任务生成/重新生成没有接口；连接版提供预设来源阅读与题目说明编辑。
2. 多用户认证、角色权限、多岗位/候选人、跨设备草稿、通知/邮件、真实 SQL/Python 沙箱均未提供。当前是本机共享合成案例，不能视为生产招聘系统。
3. 修订 5 已确定四候选人、十项 rubric、Mark 0–4／NE、确定性百分比、同技能比较与独立人工保留；本 PR 尚未新增这些接口或控件，按上述分工后续实施，不再作为待决定范围。
4. 模型是否可用由后端配置决定。规则模拟和真实模型输出必须分别说明；比赛演示方式是否符合现场要求仍由团队与 mentor 确认。

## 数据流与文件

`ApiApp / ApiWorkspace → use-api → ApiClient → Fastify DemoService → SQLite Store → GET /api/demo → 版本组件`。AI 仅从服务端访问配置的模型，浏览器不直连模型。候选人本地草稿走 `draftKey / readDraft / localStorage`；公开字段经 `publicWork / submissionPayload` 白名单后才进入请求。未确认请求保存在 sessionStorage，敏感配置不进入前端。

主要文件：

- `app/shared/api-types.ts`：由 OpenAPI 生成的浏览器合同类型；生成脚本 `scripts/frontend-types.py`。
- `app/shared/api.ts`、`use-api.ts`：校验、草稿隔离、HTTP、幂等重试、刷新和并发状态。
- `app/shared/api-ui.tsx`、`connected.css`：资源、版本、引用、快照、审核说明和连接版布局。
- `app/candidate/src/ApiApp.tsx`、`ApiWorkspace.tsx`：Candidate 的服务端任务和本地调查草稿。
- `app/hr/src/ApiApp.tsx`：HR 发送、报告和版本审核；`LocalDemo.jsx` 保留原独立演示实现。
- 两端入口、环境示例、Candidate TypeScript 配置、测试脚本与 CI；`app/shared/ui.tsx` 补齐主题挂载同步。

## 验证与故障定位

```sh
python scripts/frontend-types.py
npm test --prefix app/candidate
npm run build --prefix app/candidate
npm test --prefix app/hr
npm run build --prefix app/hr
npm test --prefix app/backend
npm run test:e2e --prefix app/candidate
npm run test:ui --prefix app/candidate
npm run test:api --prefix app/candidate
python scripts/check_repository.py
git diff --check
```

浏览器测试需安装 Candidate 既有 Playwright Chromium。`test:e2e` 在 5473 跑旧版独立演示；`test:ui` 在 5573 / 5586 回归共享外观；`test:api` 启动真实后端 HTTP、独立内存 SQLite 和 5373 / 5386 两个连接版前端，API 使用 8789。均不复用正在演示的服务。后者使用合成资料与测试专用规则分析器，不接触现有数据库、管理员配置或模型凭据。

API 测试覆盖完整双版本闭环、终止分支、私人笔记不外传、UTF-16 引用、响应丢失后重试、分析与人工审核竞争、重置后旧会话和真实资源下载。失败截图与 trace 位于 `.ci-results/api-ui/`，外观回归位于 `.ci-results/shared-ui/`，独立 Candidate 回归位于 `app/candidate/test-results/`。

常见故障：

1. 停止后端或填错允许来源：页面显示连接错误、旧数据只读；看浏览器 Network / Console 和后端终端，核对地址、端口、CORS。恢复后点 Refresh shared case。
2. 提交后断开响应或两个页面同时写同一案例：查看页面错误码及 Request ID，原请求使用 Retry original action；不要手动创建新键重放旧内容。测试 trace 可复现，后端日志只记录路由、状态和请求 ID。
3. 分析未配置、失败或被审核关闭：页面显示 AI_DISABLED / AI_REVIEW_CLOSED 等状态，仍可阅读样本和人工审核；查看后端终端、Network 中 analysis 响应和该版本快照，禁止以另一版分析填充。

构建成功仅证明可编译，规则联调不等于真实模型质量或比赛合规已验证。合并以当前明确指示、相符提交的检查和审阅结果为准；本次不部署。


## 本轮实测结果（2026-09-19，Windows / Node 24.15）

| 命令 | 实际结果 |
| --- | --- |
| `npm test --prefix app/candidate` | 27/27 通过，含 6 项 API 边界单元测试 |
| `npm test --prefix app/hr` | 8/8 通过（保留的独立演示逻辑） |
| `npm test --prefix app/backend` | 144 通过、1 跳过、0 失败；跳过的是仅 POSIX 适用的文件权限检查 |
| 两端 `npm run build --prefix app/...` | 均通过；Candidate 同时严格检查共享类型与 HR 连接版 TSX |
| `npm run test:e2e --prefix app/candidate` | 9/9 通过，旧独立演示回归 |
| `npm run test:ui --prefix app/candidate` | 10/10 通过，主题、侧栏和跨标签偏好 |
| `npm run test:api --prefix app/candidate` | 9/9 通过，真实 Fastify HTTP + 内存 SQLite + 两个浏览器页面 |
| `python scripts/check_repository.py` | 18 份文档及本地链接通过 |
| `git diff --check` | 通过 |

已查看连接版 Candidate 工作台与 HR 最终报告截图；无实际模型调用或 AI Eval。GitHub Actions 的结果以 PR 对应最新提交为准。

## PR #7 收尾修复复测（2026-09-19，macOS / Node 22.23.2）

修复 Candidate 的 My Tasks 页固定显示 V1 审核的问题：按当前 submissionId 选择对应版本的审核，不依赖数组首项。V1 补证意见继续服务于 V2 准备和历史查看；V2 终局显示其自己的结果与 comment，不改变正式作品、状态机或后端合同。

新增两项真实 HTTP 浏览器回归，分别覆盖 V2 Confirm／Insufficient、任务页刷新恢复、V2 待审不展示旧意见、终局无新提交入口，以及 V1/V2 历史意见分别保留。先在旧渲染逻辑上运行，两项均在缺少 V2 结果处失败；修复后完整测试通过。

| 本次实际命令 | 结果 |
| --- | --- |
| `npm test --prefix app/candidate` | 27/27 通过 |
| `npm test --prefix app/hr` | 8/8 通过 |
| `npm test --prefix app/backend` | 145/145 通过，无跳过 |
| 两端 `npm run build --prefix app/...` | 均通过 |
| `npm run test:api --prefix app/candidate` | 11/11 通过，真实 HTTP＋隔离内存 SQLite，包含新增两项 |
| `npm run test:e2e --prefix app/candidate` | 9/9 通过 |
| `npm run test:ui --prefix app/candidate` | 10/10 通过 |
| `python3 scripts/frontend-types.py` | 重新生成后类型文件无差异，合同未变 |
| `python3 scripts/check_repository.py`、`git diff --check` | 18 份文档及本地链接、差异检查通过 |

已查看两种 V2 终局的任务页截图。截图与 trace 保留在本地忽略的测试输出目录，不进入源码。以上是本次本地实测；CI 另以最新 PR 提交为准。没有真实模型实验、演示数据库迁移或部署，也未实现后续四人／评分／名单功能。

## 压缩包

提交后执行 `python scripts/package_frontend.py --output <目标zip路径>`。包只读取 Git 已提交内容，包含完整 Candidate、HR、shared、锁文件、测试和文档，附带未修改的匹配后端以便联调；不包含依赖目录、构建输出、数据库、运行日志和本机环境。`DELIVERY.json` 记录提交及逐文件 SHA-256，便于核对 PR 版本。解压后按本文件启动即可，不需要原电脑目录或链接。
