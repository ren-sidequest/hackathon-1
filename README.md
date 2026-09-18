# hackathon-1

`ren-sidequest` 的黑客松项目 **EvidenceBridge**：找出候选人材料中的能力证据缺口，通过定向工作样本任务补充证据，供 HR 人工审核。MVP 是前端演示优先的浏览器 Web 应用；HR 端已有可本地运行的 React + Vite 演示，Candidate 与跨端集成待实现。

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

HR 与 Candidate 由两位协作者分别设计和实现，各自分支、各自 PR。已建立 [app/hr/](app/hr/README.md) 与 [app/candidate/](app/candidate/README.md) 两个开发目录；HR 已有独立应用，Candidate 保留初始化说明。两端共享产品基线，跨端数据与状态同步仍需双方约定。

## 当前检查

```sh
python3 scripts/check_repository.py
git diff --check
```

Windows 若 `python3` 不可用，执行 `python scripts/check_repository.py`。

这些命令仅检查协作及产品文档、本地链接（含概念图路径）和工作区空白错误；仓库基础 Actions 不包含应用测试，HR 应用另有独立测试与构建工作流。**通过不代表图片内容正确或应用测试、构建、演示、部署成功。**

HR 应用入口（Node.js 22.12+）：

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

以两份产品文档为依据，完成 Candidate 端，并共同确定任务、提交、审核与重置的跨端数据合同，再整合双端演示。不要复制其他项目的业务、运行目录、凭据或部署配置。
