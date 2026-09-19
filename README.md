# hackathon-1

`ren-sidequest` 的黑客松项目 **EvidenceBridge**：找出候选人材料中的能力证据缺口，通过定向工作样本任务补充证据，供 HR 人工审核。MVP 是前端演示优先的浏览器 Web 应用；产品文档与概念图已接入，HR 与 Candidate 的独立前端演示均已实现，共享后端已交付单轮基线，本轮按修订 3 扩展为 V1 + 最多一次 V2，双端 UI API 接入待小傅完成。

## 从这里开始

| 文件 | 用途 |
| --- | --- |
| [产品蓝图](docs/product/EvidenceBridge_PRODUCT_BLUEPRINT.md) | 产品定位、HR／Candidate 流程与功能范围 |
| [UI 与交互基线](docs/product/EvidenceBridge_BASELINE.md) | 两端统一的视觉、交互、状态和演示数据 |
| [候选人工作台概念图](docs/product/assets/candidate-workspace-concept.jpg) | 核心工作台、最终工作样本和过程证据参考 |
| [双端流程概念图](docs/product/assets/dual-role-flow-concept.png) | HR／Candidate 页面与流程参考 |
| [PROJECT_PLAN.md](PROJECT_PLAN.md) | 实施计划：技术选择、阶段、待决事项和验收 |
| [AGENTS.md](AGENTS.md) | 开发与修改准则：AI 和协作者如何开展工作 |
| [PR 模板](.github/pull_request_template.md) | 每次提交审阅的固定说明区域 |

日常流程：明确自己的任务 → 独立分支开发 → 本地验证 → PR 与 Actions → 人工审阅 → 确认合并 → 单独安排本地部署。

开工不要求汇报朋友在做什么；接手同一分支、修改重叠或共用接口受影响时再协调。双方各用自己的 GitHub 账号和本地副本，无需安装同一套个人 Skill。

现有作品继续保留；当前小傅负责 HR/Candidate 两端页面和 API 接入，本任务负责后端与合同。已建立 [app/hr/](app/hr/README.md) 与 [app/candidate/](app/candidate/README.md) 两个开发目录。Candidate 使用 React / TypeScript / Vite，HR 使用 React + Vite；两端共享产品基线，尚无真实数据联通或统一根构建。

## 本轮共享后端：修订 3 有限两版

新增 [TypeScript + Fastify + SQLite 后端](app/backend/README.md)，保存同一任务、不可变作品、五维观察、人工决定与报告。只运行一个本机 API 服务，保留原两端 Vite 页面。仅 V1 Needs More Evidence 开放同任务 V2；每版最多一次审核，V2 只作终局判断；保留两版作品/分析/意见，不扩展无限轮次或复杂版本平台。

- [先行计划与新增验收](docs/backend/REVISION_PLAN.md)
- [接口合同与自动 OpenAPI](docs/backend/API.md)、[小傅接入清单](docs/backend/HANDOFF.md)
- [统一案例事实与前端替换位置](docs/backend/DATA.md)、[架构取舍](docs/backend/ADR.md)
- [实际测试结果及未验证事项](docs/backend/TEST_RESULTS.md)、[产品验收标准](docs/backend/ACCEPTANCE.md)

当前 GitHub Pages 和双端 `localStorage` 演示仍是旧前端路径；后端 API 测试与旧页面回归都不等同于双端 UI 已联通。schema 升为 2.0，默认新库 `var/evidencebridge-v2.sqlite`，旧 1.0 库保留且不自动迁移。本次只实施/测试/交接；远端写入、PR、合并和部署另行确认，真实模型效果仍待实际输入输出核验。

后端两版独立进程验收（仓库根目录；临时合成数据库和服务由脚本清理）：

```sh
npm run build --prefix app/backend
node app/backend/scripts/verify-revisions.mjs
# 可选保存目录：追加 --output-dir /absolute/path/to/local-artifacts
```

结果与服务日志写入本地 artifacts，不提交；这项检查不调用模型，也不打开双端浏览器。手工演示的 `--resubmit`、配置和 reset 见后端 README。

## 当前检查

```sh
python3 scripts/check_repository.py
git diff --check
```

Windows 若 `python3` 不可用，执行 `python scripts/check_repository.py`。

这些命令仅检查协作及产品文档、本地链接（含概念图路径）和工作区空白错误；HR 与 Candidate 另有各自的 Actions 执行应用测试与构建。**通过不代表图片内容正确或应用测试、构建、演示、部署成功。**

Candidate 本地运行（Node.js 24 LTS）：

```sh
cd app/candidate
npm ci
npm run dev
```

打开 `http://127.0.0.1:5173`。使用 **Load Demo Application** 开始完整流程，或通过 **Demo controls** 快速载入工作台。测试、构建、本机预览和三分钟演示步骤见 [Candidate README](app/candidate/README.md)。项目总方案中的“待定”仍表示未决定的事项。

HR 应用入口（Node.js 22.12+，回到仓库根目录执行）：

```sh
npm ci --prefix app/hr
npm run dev --prefix app/hr
```

浏览器打开 `http://127.0.0.1:5186`。测试、生产构建、预览及 3 分钟演示脚本见 [HR README](app/hr/README.md)。HR 端本地模拟任务发送、候选人工作样本和 AI 证据，浏览器刷新保留状态。

## 本机 GitNexus MCP

项目使用已有 GitNexus 安装建立独立索引。Windows / PowerShell 7 从仓库根目录执行：

```powershell
pwsh -NoProfile -File scripts/gitnexus.ps1 -Action analyze
pwsh -NoProfile -File scripts/gitnexus.ps1 -Action status
```

索引和注册信息均在被 Git 忽略的 `.gitnexus/` 内。使用上述入口以保持隔离；操作规则见 [AGENTS.md](AGENTS.md)。本机的 `.codex/config.toml` 同样不提交：其中 `gitnexus` STDIO 服务应通过 PowerShell 7 的绝对路径调用本副本 `scripts/gitnexus.ps1 -Action mcp`，并将 cwd 设为本副本根目录。移动目录后需要更新该本机配置；其他机器单独配置，不复制 Windows 绝对路径。

Codex 需要信任并重新打开该项目才能加载项目级配置。连接后调用 `list_repos`，应只列出本副本的 `hackathon-1`，然后查询 `repo: "hackathon-1"` 下的 `check_repository`。若列出其他项目，当前服务仍使用旧配置，不能视为本项目接入成功。

配置机制参考 [Codex 官方 MCP 文档](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)。索引检查不替代上面的仓库检查，更不代表应用已经实现或验证。

## 下一步

HR 与 Candidate 均已有独立本地演示和重置入口。小傅按 API 2.0/HANDOFF 分别接通 V1 直接终局与 V1→补证→V2，验证历史回看、引文、隐私及恢复；旧单轮结果不代替新验收。不要复制其他项目的业务、运行目录、凭据或部署配置。
