# 本次实际技术验证

**基线：`b5d0568c71fd51f4f39f3eb506654861c1b59695`；2026-09-20 Australia/Sydney。**
运行目录：`[LOCAL_ARCHIVE]`。
本页数字均来自本次实际执行，不沿用历史计数。各套件覆盖重叠，不能相加当独立产品验收数。

| 命令／检查 | 实际结果 | 日志 |
|---|---|---|
| `npm run typecheck --prefix app/backend` | 退出0 | typecheck（本地证据归档／不随公开包发布） |
| `npm test --prefix app/backend` | 282 passed，0 failed | 后端（本地证据归档／不随公开包发布） |
| `node app/backend/scripts/verify-r6.mjs` | 27 checks passed | 进程HTTP/持久化（本地证据归档／不随公开包发布） |
| `npm test --prefix app/candidate` | 114 passed | Candidate（本地证据归档／不随公开包发布） |
| `npm test --prefix app/hr` | 8 passed | HR（本地证据归档／不随公开包发布） |
| `npm run build --prefix app/candidate` | 退出0；含共享API4 TS | Candidate构建（本地证据归档／不随公开包发布） |
| `npm run build --prefix app/hr` | 退出0 | HR构建（本地证据归档／不随公开包发布） |
| `python3 scripts/frontend-types-v4.py --check` | 退出0 | 合同类型（本地证据归档／不随公开包发布） |
| `EB_API4_BACKEND_ROOT="$PWD" npm run test:api4 --prefix app/candidate` | 38 passed，0 failed，3.1分钟 | API4浏览器（本地证据归档／不随公开包发布） |
| `python3 scripts/check_repository.py` / `git diff --check` | 退出0 | 仓库（本地证据归档／不随公开包发布） / diff（本地证据归档／不随公开包发布） |
| `verify-live-readonly.mjs` | 41 passed；纯GET与浏览器读取 | 公网只读结果（本地证据归档／不随公开包发布） |
| `verify-gateway-and-downloads.mjs` | 22 passed；无有效业务修改体 | 网关及下载（本地证据归档／不随公开包发布） |
| 内容检查脚本／PDF审阅 | 27文件hash、145引用、40项结构、19 JD定位、4人算术；5PDF8页 | 内容证据（本地证据归档／不随公开包发布） |

## 工程范围

- API4的38例来自本工作副本，使用独立临时SQLite、8894/6474/6487端口，没有连接公网或真实模型。现有所有测试保留，无跳过或放宽断言。
- T03–T06：Amy BPS双版，Ann SQL、David DA、Jamie SQL；有限审核、V2终局和无V3。
- T07/T08/T19/T21：评分revision、历史不变、独立名单、重新确认、旧表单冲突；测试操作者是合成测试fixture，不算实际人审。
- T09–T16/T18/T20/T22/T30/T33/T35/T37：幂等请求、旧会话、冲突、网络失败、迟到响应/分析、重启、草稿隔离、401、版本不兼容、旧书签。
- T02/T23/T24/T26/T27/T29/T31/T34：标准/Mark/来源、键盘返回、报告、JD多状态、原PDF。
- 本轮没有单独再跑API2/API3/standalone的全部历史浏览器套件；后端本次全套包含其既有保留测试，不能称所有历史前端模式均重测。

## 公网范围与数据保护

公网 [HR](https://101.37.80.98/hr/) / [Candidate](https://101.37.80.98/candidate/) 检查保留TLS校验，没有忽略证书错误。

- 1440×1050桌面9视图，当前四人双端切换/刷新，旧书签显式四人选择，英文模式与公开共享提示、网络读取故障与恢复。
- 390×844是额外Chromium视口模拟，9视图未见整页横向溢出；用户已确定仅电脑现场演示，实体手机未测试，也不列发布门槛。
- 两端HTML与`b5d0568`已发布构建一致，8个JS/CSS等资产哈希一致；JD及4CV原PDF字节匹配冻结资料。
- 6类业务POST仅发送不符合schema的空对象，均400且无认证挑战，证明免登录到达校验；没有创建有效任务/作品/审核/评分/名单。管理reset POST404，外来Origin／cross-site403。
- 两组检查前后四人完整公开快照相同；零有效业务写入、零真实模型调用。此次没有SSH维护、服务重启、线上备份切换、迁移或reset。
- 快照时间点四人均revision0、任务draft、无提交/未保留，Amy82.5、Ann70、David/Jamie完整总分null，Human calibration pending。公开访客随后可改变状态，登台前刷新，不锁死示例。

只读检查脚本（本地证据归档／不随公开包发布） · 无效体网关检查脚本（本地证据归档／不随公开包发布） · 截图目录（本地证据归档／不随公开包发布）

## 复现与历史区分

本机Node v22.23.2；复用既有锁定依赖，无新依赖/锁文件变更。后端全套先运行，再跑浏览器，避免高并发影响。生成dist、.ci-results及本地node_modules符号链接不作为业务源码交付或提交。

旧部署事实来源保留：`output/public-demo-cleanup/DELIVERY_REPORT.md`（前端b5d0568）、`output/api4-deployment/DEPLOYMENT_REPORT.md`（后端93062f8）、`output/api4-public-access/README.md`（公开共享网关）；后两文件中的旧登录说明有阶段时效，当前以PUBLIC_DEMO及本次公网结果为准。此次未重启检查服务器PID；“后端版本/回环绑定”继承部署回执与源树一致性，不冒称新做SSH检查。

## 第4项交叉复核

主协调任务另实际重跑试用工具13项自测及18文件hash验证，退出0；日志 自测（本地证据归档／不随公开包发布） / 材料（本地证据归档／不随公开包发布）。这仍是工具验证，不新增真人参与者。

---
公开交付副本：本次仅同步文档与媒体；本机路径、日志和数据库留在内部归档。产品基线 `b5d0568c71fd51f4f39f3eb506654861c1b59695`。真人签收、用户试用与比赛提交状态仍以实际记录为准。
