> **修订5新增API3**：四人、rubric、名单见 [新版交接](../../docs/backend/R5_HANDOFF.md)。以下保留API2兼容资料；API2用 `npm run start:legacy`，默认 `npm start` 已切到独立API3新库。两端现有UI仍为API2，四人UI待接入。

# EvidenceBridge 本地共享后端

用户确认方案：**TypeScript strict + Fastify + 原生 SQLite + 自动 OpenAPI**。单案例、同一任务、V1 + 最多一次 V2 补交，每版最多一次人工审核；不修改现有 HR/Candidate 页面。完整合同见 [API](../../docs/backend/API.md)、[小傅接入清单](../../docs/backend/HANDOFF.md)、[唯一数据](../../docs/backend/DATA.md)、[ADR](../../docs/backend/ADR.md)、[实际验证记录](../../docs/backend/TEST_RESULTS.md)。

延续分支 `codex/evidencebridge-backend`，扩展基线 `6fb19a9`（已交付单轮版本）。用户确认修订 3，先行计划见 [REVISION_PLAN](../../docs/backend/REVISION_PLAN.md)。本次到本地实现、验证与交接；不包含远端写入/PR 更新、合并或部署。旧测试结果不代表两版已通过，当前实际结果见 TEST_RESULTS。

## 1. 安装、配置、启动

推荐 Node.js 24 LTS；本后端最低 **22.23.0**，本轮本地验证使用 22.23.2，实际运行显示 `node:sqlite` experimental warning。这是运行时提示，不是测试失败；模块说明见 [Node 22 SQLite 文档](https://nodejs.org/download/release/v22.17.0/docs/api/sqlite.html)。不要用旧前端的最低 Node 版本推定本后端也支持。

从仓库根目录进入后端目录后执行：

```sh
cd app/backend
npm ci
npm run build
# 仅首次设置时复制；已有 .env 请保留。
cp -n .env.example .env
# macOS/Linux：填写密钥前将配置设为仅当前用户读写。
chmod 600 .env
npm start
```

- 默认只监听 `127.0.0.1:8787`，不支持公网或局域网监听配置。
- [健康检查](http://127.0.0.1:8787/healthz)：`{"status":"ok","storage":"sqlite"}`；只检查本地数据库就绪，不调用模型。
- [共享案例](http://127.0.0.1:8787/api/demo)、[交互接口文档](http://127.0.0.1:8787/docs)、[运行时 OpenAPI JSON](http://127.0.0.1:8787/docs/json)。Swagger 的 Try it out 会执行真实本机操作，演示前注意当前状态。
- `npm run dev` 是“编译后启动”，不是自动 watch。
- `Ctrl+C` 正常关闭数据库并释放单实例锁。启动失败不会自动重置案例。

| 环境变量 | 默认值 / 限制 | 说明 |
| --- | --- | --- |
| `PORT` | `8787`，1–65535 | 本地监听端口 |
| `DATABASE_PATH` | `./var/evidencebridge-v2.sqlite` | 相对启动目录解析；服务重启使用同一绝对路径恢复 |
| `DEMO_ADMIN_TOKEN` | 空；设置时 24–256 字符 | **仅 reset 使用**；空值时 reset 返回 503 |
| `ALLOWED_ORIGINS` | `http://127.0.0.1:5173,http://127.0.0.1:4173,http://127.0.0.1:5186` | 显式 loopback HTTP origin，逗号分隔；`localhost` 与 `127.0.0.1` 不视为相同 origin |
| `ANALYSIS_MODE` | `disabled` | `disabled / manual_simulation / live`，没有自动模式切换 |
| `OPENAI_API_KEY` | 空 | 仅服务端读取；不设置在 `VITE_*`、请求正文或浏览器中 |
| `OPENAI_MODEL` | 空 | 显式产品 API 模型 ID；与开发代理模型选择独立 |
| `AI_TIMEOUT_MS` | `20000`，100–60000 | 包含网络、最多一次重试及响应读取的总时间 |
| `BASE_URL` | 客户端默认 `http://127.0.0.1:${PORT}` | 仅 demo/reset 测试脚本使用；只接受 loopback HTTP |

`.env`、数据库、WAL/SHM、锁文件、依赖与构建产物是本地文件。改动配置后需要重启；不把配置、真实数据或日志提交 Git。

其他系统使用相应文件权限设置，使 `.env` 仅当前用户可读写；不要假设 `.gitignore` 同时限制了本机读取权限。

## 2. 明确的演示与重置

默认 `disabled` 能演示提交和人工审核。需要观察卡片时，在本地 `.env` 显式设 `ANALYSIS_MODE=manual_simulation` 后启动；这是手工编写规则展示，不是真实模型结果。

```sh
# 单独终端，从同一后端目录执行：
npm run demo
# V1 More 后停在 awaiting_revision（非终局）：
npm run demo -- --decision needs_more_evidence
# 新会话的完整 V1 More → V2 终局：
npm run demo -- --resubmit
npm run demo -- --resubmit --decision evidence_still_insufficient
# V1 直接终局不足：
npm run demo -- --decision evidence_still_insufficient
```

`demo` 是合成 API 测试客户端：健康检查→读初始状态→发任务→含唯一测试句的提交→分析→脚本化人工决定→两次读回核对。`--resubmit` 在同 session/task 内记录 V1 More 再创建 V2，V2 默认 confirm；V2 More 是无效选择。默认 `confirm` 仅用于测试流程，产品服务从不自动 Confirm。分析关闭或失败时，脚本先确认作品仍在，再继续审核，并在输出报告 `analysisError`；“客户端通过”不表示 AI 成功。

**已有任务/提交/审核时，demo 退出并保留数据**。它从不隐式 reset。单独执行 reset 表示清空当前合成案例并生成新会话；旧引用失效。

可在当前 shell 生成控制令牌而不打印其值，再启动服务；同一 shell 或另一个配置同值的本地终端执行 reset：

```sh
export DEMO_ADMIN_TOKEN="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')"
# 在该环境启动 npm start；需要重置时：
npm run reset
npm run demo
```

若使用 `.env`，私下填入同一个随机值；不要把令牌写入命令参数、截图或日志。reset 脚本从环境读令牌、GET 最新 session、发 UUID 幂等键、再读回初始状态；不打印令牌。没有配置令牌时可选新的 `DATABASE_PATH`，保留原数据库，而不是删除旧成果。

## 3. 持久化与故障处理

- SQLite 保存共享状态、最多两份不可变作品、各版分析/审核及请求收据；刷新或同库重启保留 V1、awaiting_revision、V2 与历史。WAL + FULL 同步，事务仅包围短数据库操作，外部模型调用不持有事务。
- 每个文件库只允许一个后端进程。`DATABASE_PATH + '.lock'` 保存 PID 与随机所有权标记；第二个存活实例启动失败。正常退出只移除自己的锁；已确认 PID 消失的残留锁在下次启动回收。
- 锁文件损坏、权限不明确或进程仍在时保留文件并报启动失败。先核查占用进程及路径，确认没有进程使用后再人工处理锁；不删除数据库来“修复”。此锁面向本机单实例，不是网络文件系统分布式锁。
- 回收死亡 PID 的残留锁时，使用 `.lock.reclaim` 短锁串行处理；若该短锁因崩溃残留，后续启动保守失败。核查没有后端存活后再人工清理残留锁文件，保留数据库与配套文件。
- 备份前先正常停止服务，再复制 SQLite 文件和仍存在的 `-wal`、`-shm` 配套文件到本地私有目录。恢复使用完整备份并保留旧文件；不复制运行中单个 SQLite 文件作为可靠备份，不把旧 `.lock` 复制为新运行实例。
- schema 2.0 默认新文件；旧 `.env` 若仍指向 1.0 库，请保留旧文件并显式设置新的 DATABASE_PATH。旧库不迁移、不清空，启动检测报兼容性失败而非初始化。
- 数据版本不匹配、提交指纹/引用或状态关联损坏时，启动校验失败而非加载空案例。保留原数据库供诊断；使用新的路径建立演示，不自动迁移/修补旧库。
- 审核时若该版分析运行，冻结为 `failed / AI_REVIEW_CLOSED`；迟到结果不进入已审核版或 V2。已有结果在所属版本只读留存。
- 模型运行中进程中断：重启将该次分析置 `failed / AI_INTERRUPTED`，原 202 收据改为 503。GET 看最新状态；需要新尝试时用**新幂等键**，原作品保留。
- 启动终端输出经过收敛的 JSON 元数据（requestId、方法、已知路由、状态/错误代码），不记请求正文、查询字符串、token、模型原始响应。默认无日志文件；需要本地保存时由操作者重定向终端到仓库外私有文件。

常见问题：端口占用→先检查本机运行实例；403→核对 Host/前端 origin/reset 令牌；409→GET 刷新绑定或原操作收据；502/503 AI→保留作品供人审、检查服务端模式/配置；坏库/锁→按上面保留诊断，不自动清空。

## 4. 测试与合同导出

```sh
npm run typecheck
npm test
npm run test:coverage
npm run docs:generate
# 使用编译产物启动独立临时服务，不复用当前演示库：
npm run build
node scripts/verify-revisions.mjs
# 可选：node scripts/verify-revisions.mjs --output-dir /absolute/path/to/local-artifacts
# 从仓库根目录另执行：
python3 scripts/check_repository.py
git diff --check
```

`docs:generate` 在独立内存库中使用 `manual_simulation`，不绑定公网端口、不读取产品模型配置、不调用模型；生成 [OpenAPI](../../docs/backend/openapi.json) 与 [示例清单](../../docs/backend/examples/manifest.json)。JSON 示例包含 V1 直接终局与 V1 More→V2 的两组独立会话、各版请求/响应、历史投影及上限/旧引用错误。ID、指纹、时间来自本次运行，每次生成可变化；它们是配套 fixture，不是前端应硬编码的常量。修改 API schema 后重新生成并检查差异。

verify-revisions 使用临时文件库、独立真实 HTTP 服务与 CLI，保存分阶段 JSON/检查报告并清理临时服务和数据库；输出目录可用 `--output-dir` 指定。脚本使用 disabled/manual_simulation，无真实模型或 UI 操作。

实际测试范围与计数统一见 [TEST_RESULTS](../../docs/backend/TEST_RESULTS.md)。客户端自检证明 HTTP API 流程，不等于浏览器双端已接通。真实模型调用/质量实验、真人验收与远端部署均另行记录。

旧 `6fb19a9` 单轮交付曾用临时文件库和真实 `node dist/server.js` 进程运行 demo/reset 脚本，10 项客户端检查通过：三分支、独特快照及引文、进程重启恢复、已有案例保护、显式重置、错误令牌、远程 URL 阻止、AI disabled 后作品可审和日志凭据排除。检查使用 manual_simulation/disabled，无模型调用；临时服务与文件已清理。这 10 项是旧单轮记录，不叠加到 Node 单测计数，也不替代本次有限两版验证；新脚本检查结果见本轮 TEST_RESULTS。

## 5. 本轮边界

六个业务接口加 `/healthz`；Fastify Swagger 提供 `/docs`、JSON/YAML 及静态资源等自动文档辅助路由，不增加岗位/候选人/文件 CRUD。前端继续由原 Vite 服务运行；不在本轮由后端托管两端构建产物。GitHub Pages 仍是静态备份，不代表新后端已经发布。

公开服务、真实候选人资料、账号/角色权限、付费模型使用与新基础设施另行确认。当前模型键空缺，**真实 AI 效果待验证**；手工模拟与确定性 stub 不计作真实模型实验。双端 UI 联调待小傅接入。


## 2026-09-19 双端本地整合补充

基于PR9前端与本地修订5后端新增真实API3模式，保留原页面成果。默认 `api3-connected` 匹配后端默认3.0；显式 `connected` 仍用于旧API2，`revision5-preview` 仍是独立本地模拟。旧段落中的“新版待接入”是此前阶段记录，当前行为以[API3整合交接](../../docs/FRONTEND_API3_INTEGRATION.md)为准。新检查 `python3 scripts/frontend-types-v3.py --check` 与 `npm run test:api3 --prefix app/candidate`；各命令从仓库根执行。API3浏览器用独立端口与临时SQLite，普通页面不持有reset令牌。此轮未提交、推送、合并或部署；实际验收状态以本轮报告为准。
