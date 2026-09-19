# 项目总方案

> API 2.0 前端接入现已实现；原有“UI 待接入”记载为此前阶段状态。两端默认使用共享后端，独立模拟需显式启用；本轮范围、验收和未提供的能力见 [前端接入交接](docs/FRONTEND_API_HANDOFF.md)。提交 PR 供审阅，不含批准、合并或部署。

## 当前状态

- 仓库：`ren-sidequest/hackathon-1`。
- 阶段：两端独立前端与共享后端单轮基线已交付；本次修订 3 有限 V1/V2 后端扩展已完成本地实现与验证，双端 API 接入与浏览器联调待小傅完成。
- 已确定：使用分支和 PR 协作；先本地验证，再提交审阅；合并与部署分开。
- 运行目标：沿用同机 Candidate Vite、HR Vite、后端 API 三服务；端口与 Origin 见后端 README。不预设公网部署或云服务。
- 产品需求以 [产品蓝图](docs/product/EvidenceBridge_PRODUCT_BLUEPRINT.md) 为依据，视觉与交互以 [Baseline](docs/product/EvidenceBridge_BASELINE.md) 为依据；两份文档包含概念图引用。本文件记录实施安排与技术决策，不复制整套产品规范。执行准则见 [AGENTS.md](AGENTS.md)。

## 本轮后端执行覆盖（2026-09-19 · 修订 3）

沿用已确认 TypeScript + Fastify + SQLite 和自动 OpenAPI，基于已交付单轮后端 `6fb19a9` 继续实施。小傅负责 HR/Candidate 页面与 API 接入；本任务负责后端、统一案例、合同、测试与交接。先行改动与验收见 [REVISION_PLAN](docs/backend/REVISION_PLAN.md)。

当前范围：HarbourCart / Junior Data Analyst / Alex Chen，三个要求、一个任务；V1 + 最多一次 V2，每版最多一次人工审核。仅 V1 Needs More Evidence 开放 V2；V1 Confirm/Insufficient 和 V2 Confirm/Insufficient 终局，V2 More/V3 不开放。不足保持 Uncertain，保留两版只读历史而非无限重提/重开原审核。唯一产品 AI 是各版作品的五维观察；申请/任务预置，3.4%→2.6% 案例不变。

[API](docs/backend/API.md)是共享合同，[DATA](docs/backend/DATA.md)是统一事实来源，[验收矩阵](docs/backend/ACCEPTANCE.md)和[实际测试](docs/backend/TEST_RESULTS.md)分开记录。旧版 116 项测试及 10 项客户端检查是历史结果；两版扩展已新增并重跑，当前结果以 TEST_RESULTS 第 0 节为准。本次到本地实现、测试、AI agent 审查和交接，不包含远端推送、PR 更新、合并或部署；现有前端与历史审查副本受保护。

## 1. 项目目标

| 项目 | 当前决定 |
| --- | --- |
| 比赛／活动名称与截止时间 | 待定 |
| 面向的用户 | HR 与候选人（Candidate） |
| 要解决的问题 | 候选人现有材料不足以证明岗位所需能力，HR 缺少可审核的补充证据 |
| 产品的一句话介绍 | EvidenceBridge 通过定向工作样本任务，把候选人的过程和产出转化为可观察证据，辅助 HR 人工审核 |
| 核心演示场景 | HarbourCart Pty Ltd 的 Junior Data Analyst 招聘：SQL、Data Analysis 已有支持证据；通过 Conversion Drop Investigation 为 Business Problem Solving 补证 |
| 比赛对公开源码、许可证和外部服务的要求 | 待核对 |

## 2. MVP 范围

以浏览器中完整、稳定、可理解的补证演示为目标；申请/任务可预置，辅助模拟与预生成输出须标注。正式两版作品、审核与共享报告由本轮 API/SQLite 承载；生产平台完整性不是 MVP 验收条件。

| 功能 | 必须／可选／不做 | 完成标准 | 当前状态 |
| --- | --- | --- | --- |
| 候选人申请与 HR 初始证据报告 | 必须 | 可加载演示材料，显示 SQL、Data Analysis 为 Supported，Business Problem Solving 为 Uncertain | Candidate 申请与 HR 初始报告均已实现 |
| HR 审阅并发送定向任务 | 必须 | 显示补证原因、任务场景和发送反馈，候选人侧能收到对应任务 | HR 发送与收到预设样本已模拟；真实跨端待接入 |
| 候选人工作台 | 必须，最高视觉优先级 | 资源、分析图表、可编辑调查板、最终工作样本和过程时间线组成连贯体验 | Candidate 已实现本地演示 |
| HR 审核与更新报告 | 必须 | 查看最终样本、过程与提取证据，V1 提供三种动作、V2 两个终局；确认后显示补证前后变化 | HR 本地演示已实现 |
| 候选人提交状态 | 必须 | V1/V2 提交、等待补交、审核中、终局与共享 workflow 一致 | 已实现；HR 三种结果通过 Demo controls 模拟 |
| 共享 API、SQLite、有限两版 | 必须 | V1 More 才开放 V2；两版作品/分析/审核独立，终局/上限/恢复可验证 | 本地后端验证完成，UI 待接入；实际结果见 TEST_RESULTS |
| 生产认证、上传和完整 AI 编排 | 后置 | 不扩建账号、PDF/OCR 或动态出题平台 | 不属本轮 |
| 原生桌面／移动应用、候选人数值排名系统 | 不做 | 保持 Web 应用与证据补充、人类审核定位 | 不适用 |

## 3. 技术方案

| 项目 | 当前决定 |
| --- | --- |
| 应用形态与技术栈 | 浏览器 Web 应用，桌面演示优先；Candidate 已批准 React + TypeScript + Vite、Lucide、Recharts、普通 CSS；HR 使用 React 19 + Vite 7 |
| 运行时、包管理器及版本 | Candidate 使用 Node.js 24 LTS（最低 22.12）；HR 使用 Node.js 22.12+；各端使用 npm 和独立 package-lock.json |
| 模块划分与代码目录 | HR 与 Candidate 分别设计实现；已建立 [app/hr/](app/hr/README.md) 与 [app/candidate/](app/candidate/README.md)，两端均有独立应用与锁文件；共享主题、侧栏和 UI 偏好位于 [app/shared/](app/shared/README.md)，草稿/交互归各端，正式工作流与版本归后端 |
| 接口、数据结构与存储方式 | schema 2.0 返回当前投影、最多两版记录和 workflow 动作；SQLite 保存正式作品/分析/审核。前端 localStorage 只保存草稿/偏好，JSON 为备份 |
| 外部服务及离线／模拟方案 | 申请/任务/资源明确预置；唯一 AI 为分版作品观察，disabled/manual_simulation/live/真实回放分开，真实实验另验 |
| 本地运行方式和演示设备 | Candidate：dev（5173）、build + preview（4173）；HR：dev / build / preview（--prefix app/hr，5186）；本机浏览器 |

技术选择应服务于 MVP、团队熟悉程度和活动时间。引入外部服务时说明网络、成本和凭据需求，不默认已有账号或额度。

小傅负责 HR 与 Candidate 全部页面及 API 接入，本任务负责后端、合同、统一数据、测试和交接。双方使用各自本地副本和独立分支，通过 PR 整合；共享外壳、基础组件风格、状态命名和演示场景遵循 Baseline。跨端变更先协调输入输出及文件归属，不覆盖另一端工作。

## 3.1 本轮界面统一范围

两端已接入共享日夜主题与折叠侧栏，使用现有 React / CSS，不新增第三方运行依赖。主题和侧栏偏好与业务存储分离，正式业务 API 联调仍待接入；共享 UI 偏好不是作品/审核同步。额外 HR 评分暂缓，后续明确评价对象、标准与候选人可见性后再设计。

竞赛要求记录（依据用户补充）：允许合成与模拟数据，同时要求有意义地使用 AI 或 AI-enabled technology、诚实说明成果；目前未确认有现场必须联网调用模型的条款。具体预生成展示方式是否满足本场要求，待向 mentor 确认。现有模拟流程和预生成证据不据此宣称已经满足赛事 AI 要求。

## 4. 开发阶段

1. 根据已接入的产品资料确定技术栈、共享数据与状态约定、演示重置方式，补齐项目命令。
2. 按 HR／Candidate 边界分别实现，整合一条可演示的核心流程，再添加次要功能。
3. 完成相关自动检查和本地交互验收，修复影响演示的问题。
4. 审阅、合并，双方更新本地运行副本并验证演示。

每个任务在 PR 中记录具体范围和负责人，不要求日常开工先收集所有人的工作计划。

## 5. 验收与演示

- 核心流程：预置材料/缺口→发送原任务→提交 V1→HR 直接终局，或具体补证意见→同会话 V2→终局审核→当前报告；两版历史只读。
- 审核分支：仅 V1 More→awaiting_revision；目标仍 Uncertain，Candidate 根据真实 comment 编辑隔离的 V2 草稿。每版原审核不重开；V2 More/V3、未经补证请求的 V2、旧版新操作与错误前版绑定返回明确错误。
- 边界：除原单轮输入/时序/幂等/隐私/来源外，验证同 session/task 的两版、终局/上限、分版观察、审核/分析迟到竞态、重启/reset、旧 1.0 库保留。已有前端单测/构建也保留并重跑，不用旧绿灯代替新联调。
- 演示准备：统一使用文档中的 HarbourCart 场景（流量 +18%、转化率 3.4% → 2.6%、广告支出 +15%）；Candidate 的操作脚本和 Demo controls 重置入口见 [运行说明](app/candidate/README.md)；HR 操作脚本见 [HR README](app/hr/README.md)，侧栏提供 Reset demo。
- 模型网络失败时的演示安排：本机 API/SQLite 保留原作品和人工审核；disabled/manual_simulation/真实回放分别标注。真实模型实验另行留存输入输出证据，不以模拟成功代替。
- 通过标准：相关测试和构建通过，核心场景在目标电脑实际运行；未完成验证明确记录，不由 CI 绿灯代替。

## 6. 方案维护

影响目标、MVP、架构、接口或演示方式的变更，先与用户确认，并在同一 PR 更新本文件及相关规则。普通实现细节放在代码和 PR，不重复堆进总方案。

保留重要取舍的原因与对应 PR，避免把个人设想写成团队已确认的决定。方案与实际代码有差异时先说明并协调，不擅自改写需求或覆盖已有实现。

入库后的产品资料以本仓库版本为维护来源，不同时维护 Downloads 等目录中的另一套最新版。涉及产品或视觉规范变化时，同一 PR 更新对应依据与受影响引用；图片和文字的已知差异见 Baseline 的参考说明，其他实质冲突先确认。
