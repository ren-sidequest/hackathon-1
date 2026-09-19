# 后端 PR 说明草稿

分支 `codex/evidencebridge-backend`；开发基线 `31edc5319ee40b1d5d6e9e658a1526d7a3ab2f35`。此文件记录提交前的本地验证与说明，实际发布及 CI 状态以对应 PR 为准。初始基线为 `8b0231e`，执行期间发现远端新增 #5 主题与侧栏更新后快进同步并补跑最新回归，没有改写前端代码。

## 1. 目的

让固定 HarbourCart / Junior Data Analyst / Alex Chen 案例通过一个共享 API 保存同一任务、正式作品、来源观察、人工决定和报告。证明真实作品可传递、可定位、可由人审核；不做候选人总分或自动录用判断。

## 2. 方案

用户确认 TypeScript + Fastify + SQLite + 自动 OpenAPI。独立后端包、单本机进程、单 SQLite 文件；一次提交快照、一次人工审核，两个不足分支保持 uncertain 并结束本轮。统一事实从整数数据计算。五维提取使用服务端模型适配，schema/逐字引用校验；默认 disabled，手工模拟明确标注。

取舍见 [ADR](ADR.md)，业务/错误合同见 [API](API.md)。无上传、OCR、岗位/账号 CRUD、微服务、多轮历史、生产身份体系或公网部署。

## 3. 实际改动

- `app/backend/`：源码、锁定依赖、配置示例、测试、测试客户端与运行说明。
- `docs/backend/`：合同、OpenAPI 与配对合成样例、数据来源/前端替换清单、验收、测试、审查及交接。
- 根 README、PROJECT_PLAN、AGENTS 增补本轮状态与真实命令；仓库文档检查增加后端交付入口；新增后端检查 workflow（本地验证不代替远端运行）。
- 项目忽略规则覆盖数据库、sidecar、锁与本地配置。前端和共享 UI 相对最终基线 diff 为空。

## 4. 验证结果

| 范围 | 实际命令/步骤 | 结果 |
|---|---|---|
| 后端安装与类型 | `npm ci --prefix app/backend`、`npm run typecheck --prefix app/backend` | 通过 |
| 后端套件 | `npm test --prefix app/backend` | 116/116 |
| 核心代码覆盖 | `npm run test:coverage --prefix app/backend` | 116/116，分模块记录见 TEST_RESULTS |
| 实际 HTTP + 独立进程 | demo/reset 客户端，三结果、同库重启、失效引用/凭据保护 | 10/10 |
| 自动合同 | `npm run docs:generate --prefix app/backend` 连续两次 | 通过，OpenAPI 内容哈希一致 |
| 最新前端基线 | Candidate test/build/E2E/shared UI，HR test/build | 21+9+10+8 项测试与两端构建通过 |
| 仓库检查 | `python3 scripts/check_repository.py`、`git diff --check` | 16 文档入口/链接与空白检查通过 |
| 后端依赖公告 | `npm audit --prefix app/backend` | 查询时 0 个已知漏洞 |

以上为 macOS arm64、Node.js 22.23.2、npm 10.9.8 上的本地验证，对应最终基线及本轮后端改动。具体环境、日志、修复前失败与最终重测记录见 [TEST_RESULTS](TEST_RESULTS.md)及[安全审查](SECURITY_REVIEW.md)。现有 HR Vite 依赖有 high 级公告，Candidate 有既存 chunk 警告，本轮未升级或重构前端。

本地记录尚未验证：真实模型效果与人工评估、双端 UI API 联调、真人试用、跨平台、远端 CI、公网部署。远端 CI 后续结果另列于 PR；55 项 AI 适配测试都是确定性工程测试，实际 HTTP 模拟也不是模型效果实验。

## 5. 审阅重点

- 白名单字段与私人 notes 排除；共享 HR 理由单独用 comment。
- 提交和审核绑定、幂等、reset/模型迟到结果、崩溃恢复与 PID 锁竞态。
- 初始来源与当前作品分开；datasetVersion/指纹/逐字引用一致；仅 Confirm 改变目标要求。
- 本地 reset 令牌、模型凭据、日志及 SQLite 文件的边界；Node 22 原生 SQLite experimental 提示。
- 小傅按 [HANDOFF](HANDOFF.md) 接页面后，独立完成真正双端 UI 验证；后端 API 通过不替代这一环节。

部署状态：未部署。交付执行到独立分支推送和创建 PR；合并与部署分别确认。提交作者及远端操作均核对为本人账号，不使用其他协作者身份。
