# 修订 5：SQLite 持久化、迁移与回滚

## 格式边界

| 程序／文件 | SQLite `user_version` | 处理方式 |
| --- | --- | --- |
| 原 API 2.0 程序 | 2 | 继续使用原文件；识别到 3 时启动报错 |
| 修订 5 程序 | 3 | 新默认文件 `var/evidencebridge-v3.sqlite`；恢复四人聚合状态 |
| 显式迁移工具 | 2 → 新文件 3 | 先备份、转换临时副本、验证，再独占发布新文件 |
| 未知旧版、未来版或不完整结构 | 非兼容格式 | 启动报错，保留原文件；没有自动清库或自动升级 |

空白新文件可初始化为 3；`user_version=0` 但已有表、视图等对象的文件保留。格式检查在 journal 设置、DDL 和权限修改之前完成。SQLite 格式版本与对外 API `schemaVersion` 是两个独立概念。

## 存储边界

`RevisionStore` 在 `revision_state` 保存一个 JSON 聚合快照：session 下四位候选人的任务、两版作品、分析、审核、assessment 修订与名单历史由同一业务服务管理。业务服务负责验证归属、历史不可变性及指纹，存储层负责事务持久化。业务状态和幂等收据必须放在同一个同步 `transaction` 中提交；抛错整体回滚。异步操作在事务外执行，完成时重新绑定当前状态再提交。

`revision_receipts` 的唯一键是 `(session_id, path, key)`，行同时记录 `candidate_id` 和请求 hash。读取时先核对候选人，不向其他候选人返回响应体；复用另一人的键报 `IDEMPOTENCY_OWNER_MISMATCH`，不同 hash 报 `IDEMPOTENCY_CONFLICT`。不同 session 不共享收据。`settleAnalysisReceipts` 只更新同 session／candidate／attempt 的 202 收据，供中断恢复和人工审核关闭异步分析使用。业务服务还须验证 task、submission 和 contentFingerprint；收据不是身份认证机制。

一个数据库只交给一个本地进程。v2/v3 使用兼容的 PID／nonce `.lock` 协议，退出时仅清除自己持有的锁。已退出 PID 可恢复；活跃 PID、格式损坏的锁以及异常 `.lock.reclaim` 保留并报错。确认所有旧进程已退出再诊断，不按文件存在与否盲删锁。v3 规范化符号链接路径；仍应统一使用同一个数据库绝对路径，不创建文件硬链接作为第二个运行入口。

## 迁移前准备

1. 记录旧程序版本、原 `DATABASE_PATH`、session／task／V1/V2 ID；停止所有持有原数据库的后端进程。
2. 保留原数据库和它尚存的 `-wal`／`-shm` 文件。不要只拷贝 `.sqlite` 文件代替备份，已提交记录可能还在 WAL 中。
3. 准备三个不同的绝对路径：已存在的 v2 源、新 v3 目标、新 v2 备份。目标与备份及其 SQLite sidecar 均须不存在；父目录预先存在且有足够空间。仅在 SQLite 文件支持的本地文件系统使用。
4. 构建完成，并检查 domain converter 和迁移测试；迁移工具不默认选择实际演示库，也不自动更换正在运行的配置。

从仓库根目录构建，然后在 `app/backend` 执行；以下是显式占位路径，执行前逐项替换：

```sh
npm run build --prefix app/backend
cd app/backend
node scripts/migrate-v3.mjs \
  --source /ABSOLUTE/OLD/evidencebridge-v2.sqlite \
  --destination /ABSOLUTE/NEW/evidencebridge-v3.sqlite \
  --backup /ABSOLUTE/BACKUP/evidencebridge-v2-before-r5.sqlite
```

CLI 缺任意参数即退出，且没有默认源、目标或备份。成功输出 JSON 包含三条规范化路径、sourceFingerprint、归档 submission／receipt 数和 formatVersion=3；失败为非零退出，并列出保留的诊断文件。输出与 JSON 数据库包含用户材料信息，仅保存在本地，不提交到 Git。

## 实际转换顺序

1. 获取源／备份／目标进程锁，源以只读连接打开，检查格式 2、必要表和 `integrity_check`。
2. SQLite 原生 backup API 创建 WAL 一致的 v2 临时备份；`fsync` 后用独占 hard-link 发布备份。备份路径已出现则停止，绝不覆盖。
3. 从一致备份读取 `OldMigrationPayload`：解析后的 legacyState、submissions、receipts，以及原始 JSON 字符串／行、原 schema 和快照 SHA-256。sourceFingerprint 是**一致备份文件**的 SHA-256，不是忽略 WAL 的源主文件 hash。
4. 独占创建迁移临时副本，调用业务层 `convertLegacyState(payload)` 验证旧领域数据并生成 `{state, sourceMap}`。转换器收到独立副本，原始归档校验基线另行保留。
5. 在一笔 SQLite 事务中重命名原表为 `legacy_v2_demo_state`、`legacy_v2_submissions`、`legacy_v2_idempotency`，创建 v3 表并写入聚合状态。原 JSON 的空白、文本、submissionId、指纹、analysis、review、收据正文和 hash 均保留。
6. `legacy_v2_migration` 保存迁移时间、源路径、原 schema、sourceFingerprint 和领域 sourceMap。归档四表禁止 INSERT／UPDATE／DELETE。旧收据只归档，不在 API 3.0 请求上重放。
7. 比较全部原始行、执行 `integrity_check`，提交后关闭数据库，`fsync` 临时文件，用独占 hard-link 发布新目标并同步目录。发布时出现同名目标即停止，不替换它。

领域转换器负责旧 Alex 的 session／task／submission 绑定、原指纹、完整 V1/V2 状态机和引用验证，其他三人从新 fixture 初始化；评分不是迁移器从旧 AI 输出推导的数值。API 外层映射与原始 2.0 快照的关系写入 sourceMap，SQLite 归档是保留原内容的权威依据。

## 检查与启用

- 原文件、备份仍为格式 2；新目标为格式 3，原内容归档和 sourceMap 齐全。
- 在单独的验证实例中检查四人详情、Alex 两版原 ID／指纹／引用和审核历史，执行关闭／重启恢复。
- 新程序指向明确的新路径。已评估／未评／待补证状态以领域转换结果为准，不把旧分析结果直接转成已审分数。
- 实际演示配置切换、重启与部署是后续独立操作；创建新文件本身不表示已切换。

## 失败与回滚

迁移对原库仅做只读读取；失败时不删除原文件或已完成备份。转换器失败保留格式 2 的临时副本；DDL／归档校验失败回滚整笔事务，仍保留诊断副本。发布前失败没有新目标；独占发布成功后的极少数文件系统错误可能已经留下完整格式 3 目标，先核对诊断输出和 `user_version`，不要将路径存在直接视为成功验收。进程骤停可留下带 UUID 的临时文件和 PID 锁；保留诊断，确认进程已结束后检查再用全新目标／备份路径重试。

回滚：停止 v3 实例，恢复原程序及其原 `DATABASE_PATH`；原库从未被升级。也可把已验证的 v2 备份复制到**另一个新路径**供旧程序运行，保留源、备份和新库以便审计。v3 启用后新增的评分／名单／作品不会自动反向写回 v2；回滚不代表这些新操作已迁回。旧程序打开格式 3 时应报不兼容，而非写入。

## 本地验收

```sh
npm run build --prefix app/backend
node --test app/backend/test/r5-storage.test.mjs
```

存储测试覆盖四人重启、读写无对象别名、事务／收据一起回滚、跨人键冲突、异步收据精确归属、同步事务约束、旧／未来／残缺格式的逐字节保护、活跃／过期／损坏锁、符号链接同库锁、替换 nonce 保护、全量原始归档、旧程序回滚打开、崩溃源 WAL 备份、转换与事务 DDL 故障、目标竞争、锁释放及 CLI 参数。这里只验证存储基础；领域转换与 HTTP 端到端验证另由业务/API 测试确认。

补充领域验收：集成后的存储／领域测试24项涵盖22种快照破坏、原始API2分析引文校验、模板/归属/评估/名单历史漂移和发布前失败；独立HTTP迁移验证见[R5_TEST_RESULTS](R5_TEST_RESULTS.md)。旧程序与新程序分别拒绝对方格式，测试只操作临时合成库。
