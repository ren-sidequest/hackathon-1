# 后端安全与交付审查

审查对象：本地单服务、合成案例的 TypeScript / Fastify / SQLite 后端。此文件记录 AI 子代理的独立检查与可复现测试，不代表真人审批、生产安全认证或招聘效果验证。审查日期：2026-09-19。

## 1. 已发现并修复的缺口

| 发现 | 复现与影响 | 当前结果 |
| --- | --- | --- |
| TypeBox 持久化验证未注册 `date-time` | 合法 `2026-09-19T02:00:00.000Z` 事件通过 API 后，直接 `Value.Check(EventSchema, event)` 返回 false；正常提交重启被误判损坏 | 格式校验现注册在 `schema.ts`，无须先导入 HTTP 层；合法恢复与日期负例通过 |
| 恢复时只检查人审对象形状，未核对引用 | 完成 Confirm 后把已存 review 的 submissionId 改成旧 ID、requirementId 改成 SQL；初版恢复仍显示业务能力 verified | 恢复时检查 review 的 session/task/dataset/submission/fingerprint/requirement 绑定及状态一致性；8 类篡改反例与合法基线通过 |
| 分析元数据恢复未核对当前提交 | 把已保存 analysis.submissionId 改为其他 ID，存在错误关联风险 | 当前分析绑定检查通过独立恢复反例 |
| 同 DB 第二个进程会误判正在执行的分析为中断 | SQLite 交易并不自动提供应用单实例，第二个服务构造器可修改 running 状态 | 使用 PID + nonce 的独占文件锁；重复进程启动失败，真实 SIGKILL 后支持重新启动 |
| 并发恢复死 PID 锁存在 read/probe/unlink 竞态 | 两个恢复者可能先后删掉对方刚取得的新锁 | 回收分支增加独占 `.lock.reclaim` 后重新读 owner；3 轮 × 5 子进程并发恢复，每轮恰好一个 owner |

回归测试位于 [security.test.mjs](../../app/backend/test/security.test.mjs)。每个损坏存储负例先断言未修改基线可正常恢复，避免因其他故障而假通过。

## 2. 已核对的边界

- **请求/响应白名单**：所有写入 body 和子对象使用明确 schema，`additionalProperties: false`，AJV 未启用静默删除额外字段。私人 notes 整字段被拒绝，不靠字符串替换“脱敏”。正式提交显式投影公开字段；返回对象有响应 schema，未暴露服务配置和凭据。用户主动粘贴进公开作品的文本属于公开作品，而不是可自动辨认的私人 notes。
- **日志**：Fastify 默认请求日志关闭，自定义日志只写生成的 requestId、method、固定 route、status、code。不记原始 URL/query、headers、请求体、完整异常、模型提示词或输出。独立哨兵测试把标记放进 authorization、admin header、x-request-id、query、非法 notes，验证共享响应与结构化日志均未出现标记或 token。
- **浏览器访问**：默认服务仅监听 `127.0.0.1`，检查 Host 与明确的本地 Origin；拒绝 `Origin: null`、陌生域名、DNS-rebinding 样式 Host 和无 Origin 的 cross-site fetch；preflight 限定必要 headers。返回 `Cache-Control: no-store` / `X-Content-Type-Options: nosniff`。
- **演示重置**：默认未配置 token 时禁用。配置后要求 `X-Demo-Admin-Token`，使用长度检查和 timing-safe 比较。token 只在服务端环境与操作者受控请求中使用，不硬编码进页面或提交仓库。不把 reset 凭据当成普通 HR/Candidate 账号系统。
- **SQLite**：参数化 SQL；正式提交唯一约束、不可变 UPDATE 触发器；状态与幂等响应在同一事务保存。Unix 新建数据目录权限 0700，DB 0600，WAL/SHM 无组或其他用户访问权限。`.env`、DB 与 sidecar、构建产物和依赖目录均被 Git 忽略。
- **单实例和恢复**：同一数据库路径的存活进程锁阻止第二实例；进程 SIGKILL 后留下的死 PID 锁可自动回收。旧 running 分析变成 `AI_INTERRUPTED`，旧幂等键返回 503 而非永久 202，新键可重新分析，原提交保留。非法锁、未知 owner nonce 与既有 reclaim 锁保守保留供检查，不自动抹除。
- **AI**：服务端固定 Responses API 地址，禁止重定向，`store:false`；显式配置后才网络调用。输入白名单、总大小、超时、最多一次重试、输出大小、固定五维、严格结构、来源存在及 UTF-16 起止逐字引文校验。仅过程事件不足以得到观察到能力的判定。失败保留作品，实时/留存回放/手工规则演示区分标记。
- **状态与人工决定**：人审绑定当前提交与 fingerprint；只有目标 requirement 由 Confirm 变成 verified。两个不足结果保留 uncertain；正式提交与 AI 成功都不自动确认。Reset 换 session/task，迟到 AI 结果由绑定检查阻止写入新案例。
- **CLI**：`demo.mjs` / `reset.mjs` 仅接受无凭据、query、hash、路径的 loopback HTTP BASE_URL；fetch 禁止重定向。reset token 从环境取得，不接受命令行 token。独立负向子进程测试确认错误参数和错误地址在网络请求之前退出，错误输出仅含稳定代码，无 token 回显。示例生成器使用内存数据库与显式 manual_simulation，manifest 标注 0 次模型调用。

## 3. 实际执行记录

在 `app/backend` 目录执行（不是仓库根）：

```sh
npm run build
node --test test/security.test.mjs
npm audit --omit=dev --json
npm audit --json
git check-ignore .env var/evidencebridge.sqlite var/evidencebridge.sqlite-wal var/evidencebridge.sqlite-shm node_modules dist
```

截至最后复测：strict TypeScript 编译通过；安全回归 **23/23** 通过。包含真实测试子进程的重复启动、SIGKILL 后恢复，以及 3 轮 × 5 个并发启动者的死锁回收压力用例。生产依赖及含开发依赖的两次 npm audit 均报告 **0** 个已知漏洞；这只是查询时的依赖公告结果，并非代码无漏洞保证。忽略规则逐项匹配。一次误在仓库根执行的 audit 因没有根锁文件报 ENOLOCK，已在后端正确目录重跑，没有为审计另建根 package-lock。

种子数据回归另 **7/7** 通过；API/AI 套件及最终总数由完整测试记录汇总。本审查没有使用真实模型密钥、真实候选人数据或收费调用。

## 4. 明确保留的限制与交付检查

1. **仅本机单案例演示，不是公网权限平台。** 合法本地 Origin 和本机程序可调用普通工作流接口；没有完整身份认证、多租户或权限审计。Origin/Host 检查不等同于身份认证。本机操作系统账户应受信任；任何公网绑定、代理转发、真实数据接入须重新设计访问边界。
2. **本地文件完整性不是密码学防篡改认证。** 指纹用于防止陈旧/不一致关联，不证明独立作者或抵御已控制本机磁盘的攻击者。存储恢复遇到损坏应保留文件并提示选择新路径，不静默覆盖成新样例。
3. **引文有效不等于结论正确。** 模型输出结构和引文经过机器检查，相关性、因果、事实和能力解释仍需人审。测试 stub / 手工规则并不构成模型真实效果证据；真实运行待显式配置与验证。
4. **环境边界。** Node 22.23.0+ 的 `node:sqlite` 在此环境仍打印 experimental warning；开发检查不冒充跨平台或生产可用性验证。当前锁定版本范围内测试，不在本轮升级技术栈。
5. **交接终点。** 后端完成与双端 UI 联调是两件事；小傅仍需按 [DATA.md](DATA.md) / [API.md](API.md) 接两端并验证独特测试句。无远端推送、PR、部署或真实数据迁移由本审查执行。
6. **锁边界。** 这是本机文件路径级互斥，不是分布式锁。使用同一规范 DATABASE_PATH，不用软/硬链接为同一个 DB 建别名，不放网络共享盘。PID 被系统复用或异常退出留下 malformed/reclaim 锁时保守停止；先确认没有相关存活进程、保留 DB 和锁供排查，再处理对应锁。不要通过删除存活 owner 的锁启动第二实例。

上述已复测范围内未保留阻断本机合成案例交付的发现；完整运行演示和双端 UI 集成由各自验收记录说明，不由此审查结论替代。
