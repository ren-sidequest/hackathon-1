# 可重复彩排：重置与预填

双端 API4 侧栏的 **Reset demo** 是当前候选人的共享彩排操作；不是浏览器清缓存，也不是管理员的全局 reset。确认框明确说明共享影响，默认未勾选确认。

## 重置起点

- **Ready for Candidate V1**：原始申请材料/基线评分，加上已发布的 Business Problem Solving 合成任务，无提交。适合 Candidate → HR 一次切换的短演示。
- **Before HR sends a task**：回到原始申请材料/基线评分，没有已发布任务。适合练习 HR 从 B3 准备并发布任务。

`POST /api/demo/rehearsal/restart` 要求 API4 基础身份、当前 taskId、expectedRevision 和 checkpoint，以及 Idempotency-Key。复用现有同源检查、请求体上限、错误和回执机制。全局 `/api/demo/reset` 的管理员限制及公网阻断保持不变。

同一 SQLite 事务内：校验当前任务/聚合 revision、拒绝运行中分析 → 把当前候选人完整状态及其回执归档到 `rehearsal_archives` → 清除此候选人的旧回执 → 生成新 taskId、重建指定起点 → 验证状态并保存新回执。其他候选人、全局 sessionId 不变；聚合 revision 增加一次。旧任务的提交/审核请求被拒绝。旧浏览器草稿按旧 taskId 隔离保留，不自动载入新任务。当前候选人的未保存 HR 表单会在新任务载入时丢弃，确认框已有说明。

归档表按首次成功重置延迟创建，是 format 4 的兼容性附加表，不改变既有表结构。回滚旧程序可以继续读取主状态，归档保留；不自动恢复整个数据库覆盖新写入。归档不提供公网读取/恢复接口，需操作者在备份副本中按 session、candidate、task 取出记录检查后恢复。

## 预填边界

仅 `harbour-retail-2026-09-v1` 的 BPS V1 草稿提供示例。**Fill demo draft** 为没有卡片的栏目各补一张，并填空摘要；已有文字、卡片和私人笔记不被覆盖。重复点不会重复添加。V2 仍按 HR 反馈自行修订，不把同一 V1 示例冒充新的补证。

每类 4 个不同示例，共 16 个。启用 **Prefill new cards with demo examples** 时，Create a card / Add card 挑选当前草稿尚未使用的示例，打开可编辑预览后由用户保存。保存过的示例通过稳定 ID 前缀识别，改标题不会导致重复。取消创建不消耗示例，删除后允许重新选用；四个均已使用时提示关闭示例开关写自己的卡片，不循环生成重复文本。

全部内容来自已有六份公司合成材料。事实、假设、待索取材料及行动建议分开；不虚构历史设备数据、页面测速、实验结果，也不混用 Amy 个人项目数据。卡片、摘要及加载事件标注为预写合成示例，绝不声称来自实时 AI 或候选人独立作答。最终仍须 Preview & submit V1 → Confirm V1 submission。摘要必填，卡片可选。

## 验证与排错

- `npm test --prefix app/backend`：含候选人隔离、归档、幂等、旧请求拒绝、并发 revision 冲突、磁盘重启。
- `npm test --prefix app/candidate`：预填完整性、不覆盖、示例唯一、40 张上限、私人笔记边界。
- `npm run test:api4 --prefix app/candidate`：T67 实测侧栏重置 → 填四类/摘要 → 新卡不同 → 提交 → 切 HR 审核 → 再次重置。
- `npm test --prefix app/hr`、双端 build、后端 build、OpenAPI 与类型检查。

重置失败：先看 Network 中 `rehearsal/restart` 的错误码；`STALE_REHEARSAL` 先刷新再确认，`ANALYSIS_RUNNING` 等待分析结束。服务日志用 `journalctl -u evidencebridge`，只有状态和 requestId，不记录材料正文或密钥。离线时草稿保持在当前页面；重置不会用本地清空冒充服务器成功。
