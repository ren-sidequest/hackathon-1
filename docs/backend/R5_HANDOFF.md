# 修订5后端 → 小傅：实际合同交接

基线 main `e9d6de634c9a6c384d780e89145ead8fa4b56a07`（PR7 已合并）。新增本地分支 `codex/revision5-backend`；本轮没有新提交、推送、PR、合并或部署。最终执行结果见 [R5_TEST_RESULTS](R5_TEST_RESULTS.md)，验收责任见 [R5_DELIVERY](R5_DELIVERY.md)。

## 保留与切换

现有 HR/Candidate API2 接线、有限 V1/V2、私人草稿与主题原样保留。本轮未修改两端业务 UI。先用 `npm run start:legacy --prefix app/backend` 回归单 Alex；四人 UI 改好后，用 `npm start` 启动新合同。旧 API2 客户端接默认 API3 会收到 schema/query 错误，这是显式版本边界，不是自动降级。

新资料入口：[API3说明](R5_API.md)、[OpenAPI](r5/openapi.json)、[43项实际执行样例索引](r5/examples/manifest.json)、[四人材料/标注](R5_FIXTURES.md)、[迁移与回滚](R5_MIGRATION.md)。API2 原 OpenAPI 与样例仍保留在原目录，前端已有 `api-types.ts` 继续对应2.0；不要用旧生成脚本假装得到3.0类型。

## 前端接入顺序

1. 生成/核对 **API3独立类型**；入口选择候选人，GET 带 candidateId。全局比较页使用 comparison，全4人不截断成淘汰结论。
2. 迁移历史的嵌套submission/review可能仍为2.0，新请求用顶层3.0绑定；不要直接spread历史快照。显示 company/job/rubric 和 application.sources 的真实材料；预置基准需带 provenance/真人待校准说明。报告状态、分数、名单三个不同 UI 概念。
3. taskTemplates 是按目标ID的对象，先选缺口目标再发送。使用服务端 workflow 按钮能力，而不是剩余容量推断V2权限。
4. POST 只组装公开 DTO；草稿按 session/candidate/task 分区。findings/event/comment/128KiB限制保留；新 session 不自动导入旧草稿。
5. assessment 按完整 criterion 组保存，整组乐观锁；未评(null)、NE、数值0独立显示。引用使用UTF16下标；同名文件必须带人/快照/指纹。
6. V2目标待评；复用非目标申请分数需要显式选择及当前申请revision。history只读；主比较不混入task阶段总分。
7. shortlist独立retain/remove/reconfirm，保存理由+basis。needs_reconfirmation保留原理由与版本，让人确认，不自动移出。
8. 提交成功后GET刷新。网络不确定用同键重试；409刷新并提示；分析可用性先读capabilities。reset令牌只在本机管理操作，普通页面不持有。

## 最低双端签收（当前待联调）

- Alex BPS 和 Maya SQL 分别 HR发任务→Candidate V1→HR More→Candidate V2→终局；另测DA模板。
- Sam保留→刷新→评估修订→待重新确认→reconfirm；第四人始终可见；Leo可不做任务。
- 两窗口候选人不同、同名source、旧浏览器草稿、409冲突、模型失败/disabled、引用跳转逐一验收。
- 重启后读回；管理员重演后四人新会话；旧前端保留API2回归与API3新联调分开记录。

上述是前后端共同验收依赖，不把后端inject/HTTP测试当新版UI通过。真人内部标注校准、真实模型实验、雇主/用户效果与录屏/部署另列，当前无成功率或ROI实测。

## 技术事实图

```text
小傅新 UI（待接入）
  → API3 严格DTO / Host+Origin / 幂等键
  → 同一四人业务服务（目标任务 + V1/V2）
  → 人工 assessment → 固定 rubric 计算
  → 人工 review / shortlist（各自独立）
  → SQLite3 聚合状态+收据事务 / 版本历史
  ↘ 可选观察器：disabled | manual_simulation | live → 引文校验 → replay
```

真实实现：持久化、归属、冲突、评分和名单。预置：公司/岗位/四人材料/基准/模板。模拟：manual_simulation 和测试桩。真实模型：本轮未调用。正式演示库：未操作。仅本机，无通用上传/鉴权/SQL执行/自动招聘决策。


## 2026-09-19 双端本地整合补充

基于PR9前端与本地修订5后端新增真实API3模式，保留原页面成果。默认 `api3-connected` 匹配后端默认3.0；显式 `connected` 仍用于旧API2，`revision5-preview` 仍是独立本地模拟。旧段落中的“新版待接入”是此前阶段记录，当前行为以[API3整合交接](../FRONTEND_API3_INTEGRATION.md)为准。新检查 `python3 scripts/frontend-types-v3.py --check` 与 `npm run test:api3 --prefix app/candidate`；各命令从仓库根执行。API3浏览器用独立端口与临时SQLite，普通页面不持有reset令牌。此轮未提交、推送、合并或部署；实际验收状态以本轮报告为准。
