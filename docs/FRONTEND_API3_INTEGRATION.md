# 修订5双端 API3 本地整合

本地整合基线：PR9 `4cf45fea3949d1abce2c3ff9658d9352c018f135`（包含已合并PR8），加本地修订5后端。保留小傅的主题、侧栏、比较、证据详情、卡片编辑器、资源转卡、并排审核和版本差异；新增API3数据与请求层，不覆盖原前端预览。第一阶段止于本地验收；随后用户明确要求提交整合PR并合并。发布进展以对应PR的最新head、CI和合并记录为准；部署、正式库迁移不随代码合并执行。

## 1. 模式与启动

| VITE_APP_MODE | 数据与用途 |
|---|---|
| `api3-connected`（未设置时也默认此模式） | 四人真实共享API3，正式状态在SQLite |
| `connected` | 保留原单Alex API2，后端使用 `start:legacy` |
| `revision5-preview` | 原PR8/9四人本地模拟，明确标注，独立存储 |
| `standalone` | 更早的独立演示回归 |

API失败不会自动切换模拟模式。已有本地 `.env` 优先核对，特别是旧 `VITE_APP_MODE=connected`；示例现对应API3。前端只配置地址，管理员令牌及模型密钥不进入VITE变量。

从仓库根安装各自锁定依赖，分别开三个终端。以下是本机开发配置，不代表公网服务：

```sh
npm ci --prefix app/backend
npm ci --prefix app/candidate
npm ci --prefix app/hr
npm run build --prefix app/backend

# 终端1：进入后端目录；先核对已有.env与数据库路径，使用独立v3库
cd app/backend
npm start

# 终端2：仓库根，Candidate 5173
npm run dev --prefix app/candidate

# 终端3：仓库根，HR 5186
npm run dev --prefix app/hr
```

在两端选择同一候选人，并使用“Refresh shared case”接收另一窗口的操作。演示身份不是认证账号。预览端口或地址变化时将两端精确本机Origin加入后端ALLOWED_ORIGINS；不使用通配符。

默认分析关闭；manual_simulation是规则演示，live需要另行配置并核验。实时模型和评估效果不是这次本地整合通过的含义。

## 2. 实现与数据边界

- `scripts/frontend-types-v3.py` 从冻结的 [API3 OpenAPI](backend/r5/openapi.json) 生成独立 `app/shared/api3-types.ts`；API2类型保留。`--check`检查漂移，无新增运行依赖。
- `app/shared/api3/client.ts`：显式候选人、任务、版本、指纹绑定；128KiB；稳定幂等收据；JSON/合同/归属校验；无管理员写入口。
- `controller.ts`：读取当前人及比较；不混用session/revision；请求序号隔离迟到响应；写后重读；409刷新但保留输入。分析与普通写有独立通道，慢模型不占用人工审核通道。
- `App.tsx`：复用PR9外壳、主题、侧栏，显示连接、刷新、错误、原收据重试和显式身份。切人或重置不让旧响应覆盖当前页面。
- `hr.tsx`、`assessment.tsx`、`hr-model.ts`：公司/标准、四人同阶段比较、十项判定/引文、正式评估修订、任务与分析、人工review、独立名单及历史。评分只展示服务端结果。
- `candidate.tsx`、`candidate-draft.ts`、`work.tsx`：原资源和卡片工作台、独立私人草稿、正式提交与版本回看、公开导出。草稿key含session/candidate/task/目标version；不提交页面整体state。
- 申请材料、姓名、rubric、评分、snapshot和sourceRefs统一读取后端，不沿用preview人物或旧引文偏移。
- Mark0、NE、未评分分别显示；申请比较不混入task_v1/v2。目标任务评分按完整目标组保存；非目标申请评分只在用户勾选后显式复用。
- 人工评分、证据审核、名单各有独立操作；Confirm不自动给满分或保留。新材料或依赖评估变化由服务端标记名单待重新确认。
- 原文按文本渲染，引用核对人物、快照、指纹、来源与UTF-16范围。取消勾选已引用来源时本地提示该项，而不是只等服务端统一错误。
- 审核／评估弹窗固定打开时的材料依据。并发出现新版本后保留旧输入供检查/复制，不自动转绑新版本；历史材料新增操作禁用。
- 只有V1 More开放V2；终局不出现V3。私人notes不进入请求、版本比较、HR快照或公共导出。

初始材料与基准为合成数据；预置标注的实际AI来源与待真人校准状态保持可见。人工操作的operatorLabel仅供demo审计，不冒充登录身份。

## 3. 原预览竞态与管理员重演

PR8/9预览草稿改为独立存储键；草稿输入不再将旧名单/任务整包回写。兼容旧预览草稿读取，storage事件以最新存储为准，避免迟到事件回退revision。真实API3的正式业务从未使用此预览存储。

后端 `npm run reset` 先读取health与当前合同：API2重置单人；API3重置后检查四人均回到新session、空任务/版本/名单。原令牌要求和本机边界保留；只在明确要重演的独立库运行，不自动清空旧库或执行迁移。

## 4. 验证命令与证据含义

```sh
python3 scripts/frontend-types-v3.py --check
npm test --prefix app/candidate
npm test --prefix app/hr
npm run build --prefix app/candidate
npm run build --prefix app/hr
npm test --prefix app/backend
node app/backend/scripts/verify-r5.mjs
npm run test:api3 --prefix app/candidate
npm run test:api --prefix app/candidate
npm run test:revision5 --prefix app/candidate
npm run test:ui --prefix app/candidate -- --workers=2
npm run test:e2e --prefix app/candidate -- --workers=2
python3 scripts/check_repository.py
git diff --check
```

API3浏览器验收使用独立8793后端、6373 Candidate、6386 HR与临时SQLite；不读取.env、正式库、用户凭据或外部模型。专用测试服务的重启控制只属于该测试进程，不存在于业务HTTP路由。失败截图与trace在 `.ci-results/api3-ui/`。API2、preview、standalone仍分别记录，互不冒充。

本轮实际通过项、失败修正及最终数量见本地交付报告；没有远端CI的新提交结果。类型/构建通过也不代替浏览器真闭环。测试用规则分析不证明真实模型质量。

## 5. 手动签收顺序

1. HR看公司与十项标准，再看四人申请材料比较；点击Alex的B3核对原文、理由与贡献。
2. 打开Sam，按具体依据人工保留；刷新，核对名单仍在且不被前三行视图隐藏。
3. HR为Alex发送BPS任务；Candidate选Alex并刷新，填写独特摘要/卡片及私人notes后提交V1。
4. HR刷新，确认看到同一句公开文字且没有私人notes；可分析或直接人工审核。More加公开意见后Candidate才出现V2。
5. 提交V2并终局审核；历史V1保留、目标评分待重新评估，无V3。
6. HR修改申请评估并保存新修订，确认服务端分数和历史；涉及原名单依据时显示待重新确认，再手动复核。
7. 换Maya验证SQL，另选人验证DA；各人的材料、任务、历史与草稿分开。SQL保持静态审阅。

故障检查：地址/Origin/合同不匹配看页面错误与requestId；409先刷新再检查固定表单依据；网络不确定用弹窗或状态区“Retry original action”，不要复制同一操作另发新键。刷新失败仍保留草稿；重置后旧草稿不自动导入新session。


## 6. 整合发布验收记录（2026-09-19）

发布分支 `codex/revision5-integration`，包含PR9原提交而非覆盖协作者分支。提交前已核对实际写入账号为rRenrenn；GitHub MCP用于读取，写入使用同账号已登录CLI。业务源码与本地验收哈希一致，本阶段只补交接记录。

| 本地检查 | 实际结果 |
|---|---|
| Candidate／共享API3单测 | 79/79 |
| HR旧工作流单测 | 8/8 |
| 后端API2+API3全量测试 | 242/242 |
| API3真实双端浏览器 | 22/22，0重试、0pageerror |
| 后端独立进程HTTP／中断恢复／迁移 | 65/65 |
| API2浏览器 | 11/11 |
| revision5-preview浏览器 | 13/13 |
| 共享UI浏览器 | 10/10 |
| standalone浏览器 | 9/9 |
| 两端构建、API3类型漂移、文档链接、diff检查 | 通过 |

本地Node22.23.2/npm10.9.8；CI使用Node24。命令见第4节；当前提交的GitHub Actions须另行通过，不把本地结果当作远端CI。模型调用0，数据库均为隔离测试库；没有真实模型效果或真人标注校准结论。

本轮修复预览草稿覆盖名单、慢分析阻塞人工操作、409刷新丢评论、取消勾选引用来源后校验缺失、POST成功但GET失败提前关表单。分析收据按当前或历史版本的候选人／提交ID／指纹精确清理。预置标注显示“AI-authored preset · human calibration pending”，人工保存后显示“Human assessment”，不直接把合同码preset_human解释为真人已标注。

已知非阻塞体验限制：分析与普通写仍共享提示区，极端并发时迟到分析提示可能替换普通操作提示；输入、版本绑定与服务端冲突校验保留。真实模型实验、真人校准、上传解析、账号系统、公网联通另行安排；没有扩大本轮发布范围。
