# 项目开发与修改准则

适用于本仓库的 AI 编程助手和协作者。项目方向见 [PROJECT_PLAN.md](PROJECT_PLAN.md)，入口见 [README.md](README.md)。本文件直接承载开发准则，不另建一份重复的规则文档，也不依赖任何人的个人 Skill。

## 1. 开工：先识别项目，再核对规则

- 先确认实际目录、Git remote、当前分支、提交和未提交／未跟踪改动；保护已有工作。
- 本规则仅适用于 `ren-sidequest/hackathon-1` 及其工作副本。配置、索引和新增规则只写入当前项目；不得修改全局 Codex/GitNexus 配置或其他项目，也不得沿用其他仓库的业务、部署或凭据配置。
- 读取本文件及工作目录适用的规则，按任务需要查看总方案和相关模块资料，不每次全仓库审计。
- 对照实际代码、依赖清单、锁文件和 CI 核对文档；发现过时、冲突或缺失时说明具体差异，仅询问影响执行的关键问题。
- 默认只明确用户自己这次做什么、改什么、预期效果是什么。不要求汇报朋友正在做什么；接手同分支、改动重叠或共用接口受影响时再协调。
- 产品方向已确定为 EvidenceBridge，产品依据见第 11 节；Candidate 已批准采用 React + TypeScript + Vite，HR 使用 React 19 + Vite 7。业务编码前先确定相关需求与技术选择，不把占位项当成已批准的方案。新增加的真实启动／测试命令及时补入本文件。
- 识别本次执行终点：只审阅、本地修改并测试，或提交／推送并创建 PR。明确授权的步骤不反复询问；范围不清时先做已明确的部分，抵达下一项未授权操作前确认。

## 2. 分支与改动保护

- 新任务获取远端最新状态，从最新 `origin/main` 建独立分支或 worktree；默认分支前缀 `codex/`，用户指定名称时遵从。
- 继续已有任务时先核对原分支及未完成工作，不为套流程把改动重新搬到新分支。只读审阅不强制建分支。
- 不直接向 main 推业务改动；不强推，不用 reset --hard、clean 或整文件覆盖解决冲突，不擅自 stash 他人改动。
- 仅修改本次需求相关代码；新增依赖、改变共用接口、数据库结构或扩大组件范围前，说明必要性、影响和验证方法并确认。
- 避免无关重构、批量格式化和锁文件升级。确认后的改动遵循项目现有框架、约定和锁文件。
- 冲突逐段理解后处理；不因自己的版本更顺眼而覆盖朋友的实现。

## 3. 当前目录与项目命令

| 路径 | 职责 |
| --- | --- |
| PROJECT_PLAN.md | 实施计划、技术决策、阶段与验收 |
| docs/product/EvidenceBridge_PRODUCT_BLUEPRINT.md | 产品定位、角色流程、功能范围与演示闭环 |
| docs/product/EvidenceBridge_BASELINE.md | UI、交互、共享状态和演示场景基线 |
| docs/product/assets/ | 两张原始概念图，仅作设计参考 |
| AGENTS.md | 开发、验证和协作规则 |
| .github/pull_request_template.md | 固定 PR 说明 |
| .github/workflows/repository-checks.yml | 仓库基础检查，不运行应用或部署 |
| scripts/check_repository.py | 文档存在性和本地链接检查 |
| app/hr/ | HR 独立 React + Vite 应用、演示数据与工作流测试 |
| app/shared/ | 两端主题、侧栏和 UI 偏好；不包含业务状态 |
| app/candidate/ | Candidate 独立 React / TypeScript / Vite 应用，含演示数据与测试 |
| .github/workflows/candidate-checks.yml | Candidate 单元测试、构建与 Chromium 浏览器测试 |
| .github/workflows/hr-checks.yml | HR 工作流测试与构建 |

从仓库根目录执行：

```sh
python3 scripts/check_repository.py
git diff --check
```

Candidate 使用 Node.js 24 LTS（最低 22.12）、npm；以下命令在 `app/candidate` 执行，依赖和锁文件只属于本端：

```sh
npm ci
npm run dev
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run preview -- --port 4173 --strictPort
```

开发服务为 `http://127.0.0.1:5173`，构建预览为 `http://127.0.0.1:4173`；仅本机访问。CI 使用 Node.js 24，安装 Chromium 后运行测试。演示操作、存储边界及日志位置见 [Candidate README](app/candidate/README.md)。根目录没有统一 Node 构建。

HR 端使用 Node.js 22.12+ / npm、React 19 + Vite 7，依赖锁定在 `app/hr/package-lock.json`。从仓库根目录执行：

```sh
npm ci --prefix app/hr
npm run dev --prefix app/hr
npm test --prefix app/hr
npm run build --prefix app/hr
npm run preview --prefix app/hr
```

开发与构建预览均使用 `http://127.0.0.1:5186`，不能同时占用该端口。HR 的 Node 工作流测试与构建接入 `.github/workflows/hr-checks.yml`；演示步骤和边界见 [HR README](app/hr/README.md)。两端默认通过 API 2.0 共享案例；旧独立模拟需显式 VITE_APP_MODE=standalone。

Windows 若 `python3` 不可用，使用 `python scripts/check_repository.py`；两者执行同一检查脚本。

双端共享 UI 回归复用 Candidate 的 Playwright（两端依赖均需按各自锁文件安装）：

```sh
npm run test:ui --prefix app/candidate
```

自动启动 Candidate `5273` / HR `5286`，截图与失败 trace 见 `.ci-results/shared-ui/`。主题、侧栏接口和存储边界见 [共享 UI 说明](app/shared/README.md)。

### 共享后端（2026-09-19 修订 3：有限两版）

目录 `app/backend/`：TypeScript + Fastify + SQLite，锁定依赖及独立构建；接口 schema 同时生成 OpenAPI 文档。Node.js 最低 22.23.0，推荐 24 LTS；当前 Node 22 的 `node:sqlite` 有实验性提示。只监听本机 `127.0.0.1:8787`。运行说明见 [后端 README](app/backend/README.md)，状态/请求合同见 [API](docs/backend/API.md)。本轮只改后端及其合同/产品依据；双端 UI API 接入由小傅另行完成。批准 V1 + 最多一次 V2：仅 V1 More 开放补交、每版一次审核、V2 终局；不沿用无限重提或重开原审核。先读[修订 3 计划](docs/backend/REVISION_PLAN.md)与验收矩阵。

```sh
npm ci --prefix app/backend
npm run build --prefix app/backend
npm run typecheck --prefix app/backend
npm test --prefix app/backend
npm run test:coverage --prefix app/backend
npm run docs:generate --prefix app/backend
# .env 与相对 DATABASE_PATH 以 app/backend 为工作目录
cd app/backend
npm start
# 另一个终端（同目录）
npm run demo
# 完整两版客户端需要初始案例；确认要清空演示时先显式 reset
npm run reset
npm run demo -- --resubmit
# 临时库与独立进程的两版客户端验证
node scripts/verify-revisions.mjs
```

`.env.example` 只作配置示例。默认分析 disabled，manual_simulation 明确为手工规则，live 需要单独的项目模型配置和服务端密钥。reset 要求至少 24 字符的本机管理员令牌。schemaVersion 为 2.0，默认新库 `var/evidencebridge-v2.sqlite`；旧 1.0 库不迁移、不自动清空，启动检测后要求新路径并保留旧文件。数据库/锁/日志不提交；一个数据库只由一个本机进程持有。配置、失败行为、端口冲突与恢复步骤见 README。自动文档在本机 `/docs/`，健康检查 `/healthz`；这不构成公网部署或 UI 已接入的证明。

## 4. 开发与验证

- 开始前简要说明本次修改范围和验证办法；完成后按实际修改和测试汇报。
- 修复问题时尽量补充可复现的回归测试；功能变更检查成功、失败及相关边界情况。
- 提交审阅前先运行相关本地测试、自查 diff，再推送。新增或变化的测试入口与行为说明随同一 PR 更新。
- 自动测试优先使用合成数据、隔离环境和可控模拟。真实账号、收费接口、设备动作或影响他人的外部写入需单独明确范围。
- 如实区分通过、失败、未执行、环境阻塞和 CI 待完成；构建成功不等于功能正确，模拟通过不等于真实环境通过。
- 仓库基础检查仅验证文档；HR 与 Candidate 另有各自的应用检查，通过基础检查不代表应用测试、演示或部署通过。现有检查失败时先查原因，不删除校验或伪造成功。

## 5. 提交与 PR：固定说明区域

- 各自使用自己的 GitHub 账号；提交前核对 Git 作者信息，不使用朋友的账号、凭据或署名。凭据不写入仓库或 PR。
- 一个独立需求保持一个聚焦 PR，只提交本次文件；提交说明使用中文或能清楚表达改动的简短文字。
- 用户要求“做到创建 PR 为止”时，包含本次修改的提交、推送和创建 PR，但不包含批准评审、合并或部署。
- 使用 [PR 模板](.github/pull_request_template.md)，在 PR 描述区写清五项：**目的、方案、实际改动、验证结果、审阅重点**。以实际执行证据填写，不上传整段聊天记录。
- 界面改动必要时附截图，先排除私密信息；临时截图和报告不直接提交源码目录。复杂方案按需要单独写仓库文档，并在 PR 中链接。
- 修订持续更新同一个 PR 描述，保留他人相关补充；重要修订另加评论说明变化和复测结果。未获推送或发布授权时只提供说明草稿。
- 只有与 PR 最新提交相符的 Actions 和审阅结果才作为合并依据；检查完成仍要人工看 diff。

## 6. 审阅与接手朋友的分支

- “只审阅”先报告问题位置、影响和建议，不修改代码、不自动发布评论或批准 PR。区分合并前必修项与一般建议。
- 接手原分支时，确认已协调、PR 的 head 仓库／分支以及推送权限。用户已说明协调完成时不重复要求确认。
- 在干净副本或独立 worktree 中跟踪原分支，获取最新代码，以本人身份追加提交；推送前再次检查远端有无朋友新增提交。
- 有并行改动时先整合并重跑相关测试，不覆盖远端历史。无源分支推送权限时先说明，再商量修订分支方案。
- 推送到同一 head 分支会更新原 PR，无需重开；更新说明并请朋友复审自己修订的部分。

## 7. 合并与本地部署分开

- 合并须有明确指示、相关检查通过及人工审阅。执行前再次确认提交版本；新增代码应补齐相关验证和复审，不沿用旧结论。
- 合并后按约定同步干净本地副本；朋友自行同步自己的电脑，不声称已替其完成操作。
- 项目默认双方各自本地运行。安装开发依赖、启动测试、更新 Git 代码和更新正在演示的运行版本是不同动作。
- 部署另行确认目标电脑、可追踪的已合并版本和运行方式；先保留必要的恢复信息与上一个可用版本，不直接覆盖正在演示的成果。
- 不因测试通过或 PR 合并而自动部署、迁移数据库或重启服务。Candidate 可运行已构建的 Vite preview 作为本机演示服务，尚无生产部署脚本。

## 8. 公开仓库与交接

- 不提交密码、Token、私钥、真实用户数据、本机专属配置、运行日志、数据库、依赖目录或构建产物。环境示例仅使用占位值。
- 检查 MCP／CLI 的实际能力；只读 MCP 用于读取，不自行放宽权限。已授权的写操作使用本人可用工具执行，工具可用不等于所有写操作都已获准。
- 每次结束简要说明：完成了什么、分支／提交／PR、实际测试结果、遗留问题、下一步由谁处理、部署是否执行。没有 PR 或未运行的测试明确标注。

## 9. GitNexus MCP：当前项目独立索引

- Windows 入口是 [scripts/gitnexus.ps1](scripts/gitnexus.ps1)，复用已安装的 GitNexus，不自动安装或升级工具。安装与本项目索引就绪是不同状态。
- 从项目根目录运行 `pwsh -NoProfile -File scripts/gitnexus.ps1 -Action analyze` 建立或刷新索引；使用 `-Action status` 检查，`-Action mcp` 启动 STDIO 服务。终端命令退出码非零时先排查，不声称成功。
- 入口将注册表设为 `.gitnexus/home/registry.json`，索引设为 `.gitnexus/index/`，进程结束后恢复调用者环境。不要直接运行裸 `gitnexus analyze`，否则可能使用全局注册表或其他存储配置。
- 使用 `analyze --index-only`，禁止自动注入或覆盖 AGENTS.md、CLAUDE.md 和 skills；不启用 embeddings、远程向量接口或自动提交。
- Codex 使用本机忽略文件 `.codex/config.toml` 中的项目级 `gitnexus` 服务，覆盖本项目内继承的同名服务入口；不得为此改写用户级配置。配置与注册表不随 Git 同步，其他机器需各自配置。
- MCP 查询明确指定 `repo: "hackathon-1"`。先确认服务列出的仓库路径是本工作副本，再按需使用 query、context、impact 和 detect_changes；不能把其他项目或分支的索引当成本项目证据。
- 切分支、拉取代码或修改相关代码后刷新索引；status 主要检查索引提交，还须核对未提交工作区。无结果不证明代码不存在，静态关系不代替测试或运行时验证。
- 索引覆盖当前仓库代码与文档；索引成功只说明文件可检索，不代表应用运行、测试或部署通过。

## 10. 沟通与工程复盘

默认简洁中文，把用户当作正在成长中的 AI 产品工程师。优先完成交付，不逐行讲解代码；大型改动前列计划和预计文件，完成后列实际文件，不无说明地整文件重写。

重要代码或架构改动完成后，在回复末尾加入【工程复盘】，简洁回答：解决的问题及输入输出；请求、数据和状态经过的模块、服务及数据库；最可能的三个故障及复现方式、日志位置；实际测试命令与结果；最关键的技术取舍及原因。仅规则或简单文档修改不编造应用测试。

用户说“快速模式”时只保留改动摘要、测试结果和风险；“学习模式”时展开解释并抽查关键数据流和故障点。

仅在用户授权 CC 协作时调用本机官方 Claude Code CLI；交接具体任务、验收标准、允许修改范围和适用规则。并行写入使用独立 worktree，Codex 负责整合及实际验证。授权委派不扩大提交、推送、合并或部署范围。

## 11. EvidenceBridge 产品依据与两端协作

- 开展产品功能、页面、交互、演示数据或验收相关工作前，先阅读 [产品蓝图](docs/product/EvidenceBridge_PRODUCT_BLUEPRINT.md) 和 [UI 与交互基线](docs/product/EvidenceBridge_BASELINE.md)。视觉工作还须查看两份文档链接的原始概念图。
- 产品蓝图负责产品定位、角色流程、功能范围和演示闭环；Baseline 负责视觉、交互、共享状态语义和固定演示场景；[PROJECT_PLAN.md](PROJECT_PLAN.md) 记录技术选择、实施阶段和待决事项；本文件负责开发与协作规则。产品细节不重复维护多套。
- 图 1 是候选人核心工作台参考，图 2 是双端页面与流程参考。已知差异按 Baseline 落实：侧栏随日夜主题变化、HR 蓝色、Candidate 绿色；候选人核心输入采用调查板，不照搬图 2 的单一大文本框。图片外围注释不作为产品界面内容；图本身不新增后端要求；当前共享 API 与有限两版范围来自用户明确确认的修订 3。其他实质冲突先指出具体位置并确认。
- HR 与 Candidate 由用户和朋友分别设计、实现，具体角色以当前任务为准。已建立 [app/hr/](app/hr/README.md) 与 [app/candidate/](app/candidate/README.md) 两个独立开发目录。Candidate 已实现独立 React / TypeScript / Vite 本地演示；HR 已有独立 React + Vite 本地演示。根目录没有统一构建；已建立 `app/shared/` 共享主题与侧栏，正式业务接口以 API 2.0 合同为准，前端不自行改变补交次数或历史只读规则。
- 双方在各自本地副本、独立分支中开发，通过 PR 整合。默认只修改本次负责的一端；接手另一端、修改重叠或触及共享部分时先协调，禁止同时写同一工作副本。
- 两端共用产品基线、基础组件风格、状态命名和演示场景。跨端的任务、提交、证据、审核状态及演示重置方式须先约定输入输出与文件归属，再并行实现；共享外壳、组件、数据结构或接口变更遵循第 2 节的确认规则。
- MVP 是面向浏览器演示的 Web 应用，优先候选人工作台、HR 证据审核与完整补证闭环；允许静态数据、本地状态和预生成 AI 输出。模拟演示通过不等于真实 AI、持久化或生产后端已经验证。
- 阅读产品资料不构成提交、推送、合并、部署或调用外部付费服务的额外授权；以当前任务明确的执行范围为准。


## API 2.0 前端接入补充

本机联调默认 Candidate 5173、HR 5186、后端 8787；Node.js 24 可满足三端。具体映射和边界见 [前端交接](docs/FRONTEND_API_HANDOFF.md)。app/shared 现同时承载轻量外观和 API 客户端源代码，仍不新增根级 npm 项目或依赖。既有“跨端未接入”的历史描述以此补充为准。

新增根目录命令：

```sh
python scripts/frontend-types.py
python scripts/package_frontend.py --output frontend-api2.zip
npm ci --prefix app/backend
npm run dev --prefix app/backend
npm run test:api --prefix app/candidate
```

API 浏览器测试使用独立内存数据库 / 8789 后端和 5373 / 5386 前端，无外部模型调用；test:e2e 使用 5473 standalone，test:ui 使用 5573 / 5586 standalone，均不复用已运行服务。新共享 TypeScript 与 HR ApiApp 由 Candidate build 一并严格检查；生成的 api-types.ts 来自提交中的 OpenAPI。

## 修订 5 前端预览补充

`VITE_APP_MODE=revision5-preview` 是显式前端模拟模式，默认 `connected` 不变。四人材料和成绩为前端合成示例；人工评分修改只保存草稿，真实计算与 reviewed revision 等待后端合同。不得把本地模拟通过报告为新版后端联调成功。运行、修改文件与后续接口清单见 [修订 5 前端说明](docs/FRONTEND_REVISION5_PREVIEW.md)。

根目录命令 `npm run test:revision5 --prefix app/candidate` 自动启动 5673 / 5686，无后端或模型调用；失败截图和 trace 在 `.ci-results/revision5-ui/`。Candidate build 同时检查两端共享预览的 TypeScript。启动预览前在当前终端设置该模式，再以独立端口运行现有 dev 命令，不替换已运行的 API 演示。
