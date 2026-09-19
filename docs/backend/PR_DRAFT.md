# 修订 3 后端变更说明草稿

延续分支 `codex/evidencebridge-backend`，本轮扩展基线 `6fb19a9`（此前单轮交付）。用户已确认同一任务 V1 + 最多一次 V2；本草稿记录本地实现和验证阶段；该阶段未执行提交、推送、PR 更新、合并或部署。后续发布与合并状态以 GitHub PR 为准，旧版 CI 不替代新版检查。

## 1. 目的

让候选人依据 HR 的具体缺证意见，在同一 HarbourCart / Junior Data Analyst / Alex Chen 任务里补充一次证据。原 V1 作品、分析和审核意见留存，V2 独立提交、分析与终局审核；不以重置或覆盖原文伪装补交。继续证明可定位证据与人工判断，不做候选人总分或自动录用。

## 2. 方案

沿用 TypeScript + Fastify + SQLite、六个业务端点及本机三个服务。API schema 2.0：V1 More → awaiting_revision → V2；V1 Confirm/Insufficient 可直接结束，V2 只接受两个终局。每版最多一次审核；GET 增加两版只读 versions 与明确 workflow，保留当前投影。两版仍使用同 session/task/dataset，V2 精确绑定 V1 ID/指纹。

运行中分析遇人审时冻结为 AI_REVIEW_CLOSED，迟到结果不改历史或 V2；幂等旧收据与当前 GET 分开。默认新库 `var/evidencebridge-v2.sqlite`，旧 1.0 库保留、启动显式报兼容错误，不自动迁移/清空。取舍见 [REVISION_PLAN](REVISION_PLAN.md)、[ADR](ADR.md)、[API](API.md)。不加入无限轮次、复杂 diff、上传/OCR、动态出题、岗位/账号平台或公网部署。

## 3. 实际改动

- 后端 schema/service/store：两版状态、前版绑定、只读历史、当前报告、原子审核与分析关闭、版本/数据库兼容性检查。
- API/持久化/安全测试：适配旧基线，并补两版主线、非法版本、旧引用、竞争、重启、重置和旧库保留。
- demo `--resubmit`、独立进程 HTTP 两版验收脚本、2.0 OpenAPI 与配套 synthetic/manual 样例；零真实模型调用。
- 根 README/PROJECT_PLAN/AGENTS、两份产品基线的最小范围同步，API/DATA/ADR/验收/交接更新；新增先行计划入口。
- 前端、共享 UI 源码与锁文件不修改；浏览器 API 接入仍由小傅完成。数据业务事实版本仍为 harbourcart-2026-09-v1。

## 4. 本地验证与证据边界

| 范围 | 命令 / 方法 | 本轮记录 |
| --- | --- | --- |
| 类型与构建 | `npm run typecheck --prefix app/backend`、`npm run build --prefix app/backend` | 通过；实际命令/环境见 TEST_RESULTS |
| 后端套件 | `npm test --prefix app/backend` | 145/145：适配原 116 项 + 新增 29 项 |
| 代码覆盖 | `npm run test:coverage --prefix app/backend` | 同 145 项；模块覆盖见 TEST_RESULTS，不叠加测试总数 |
| 真实 HTTP + 独立服务进程 | build 后 `node app/backend/scripts/verify-revisions.mjs` | 42/42；含两种 V2 终局、分阶段同库重启及 demo CLI；单列于 node:test |
| 自动合同 | `npm run docs:generate --prefix app/backend` | 2.0 OpenAPI 与配套样例；生成记录见 TEST_RESULTS |
| 既有前端回归 | Candidate test/build/E2E/shared UI，HR test/build | 本轮重新运行 48 项 + 两端构建通过；不是 API 联调 |
| 仓库文档与空白 | `python3 scripts/check_repository.py`、`git diff --check` | 17 文档入口/本地链接通过，空白检查通过 |

具体运行环境、日志、修复前失败与重测、检查者身份见 [TEST_RESULTS](TEST_RESULTS.md)和[安全审查](SECURITY_REVIEW.md)。原单轮的 116 项与 10 项客户端检查仅作历史基线，不加到本轮计数，不替代两版验证。所有内容审查是 AI agent 审查，不冒称真人验收。

尚未验证：真实模型输入输出效果实验、双端浏览器 API 联调、真人试用、跨平台运行、本轮远端 CI 和公网部署。manual_simulation、stub 与 HTTP 工程验证都不是模型质量实验。现有前端依赖公告与 chunk 警告继续如实记录，本轮不升级前端。

## 5. 审阅重点

- V1 More 才开放 V2；remainingSubmissions 是容量不是许可；V1 终局不误开放，V2 无 More/V3。
- 两版快照/评论/引文不可串用；V2 初始无继承的分析或审核；当前报告与只读历史分清。
- 运行中人审冻结、模型迟到、旧 key 历史重放后 GET、新 key 旧提交冲突、并发补交及重启/reset。
- 私人 notes 两版均留在本地；公开 comment 白名单；旧 1.0 文件保持、显式新路径；原本机访问/令牌/日志保护保留。
- 小傅按 [HANDOFF](HANDOFF.md) 接线并逐项完成真实 UI 验收；真实模型实验独立补证。后端工程通过不代替这两项。
