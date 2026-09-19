# EvidenceBridge HR

修订 5 公司标准、四人比较、原文评估和人工名单预览使用显式 `VITE_APP_MODE=revision5-preview`，见 [运行与接入边界](../../docs/FRONTEND_REVISION5_PREVIEW.md)。评分修改只保存本地草稿，不发布已评成绩。

> 默认运行 API 2.0 连接版：接收 Candidate 的真实提交快照并进行人工证据审核。启动、接口映射、限制和验证见 [前端接入交接](../../docs/FRONTEND_API_HANDOFF.md)。下文无需 API 的独立演示和模拟提交仅适用于显式 `VITE_APP_MODE=standalone`。

可独立演示的 HR Web 应用。使用 React 19 + Vite 7，遵循 [产品蓝图](../../docs/product/EvidenceBridge_PRODUCT_BLUEPRINT.md)、[UI 基线](../../docs/product/EvidenceBridge_BASELINE.md) 与 [仓库规则](../../AGENTS.md)。随主题变化的共享折叠侧栏、日夜工作区、蓝色 HR 强调色；固定使用 HarbourCart / Junior Data Analyst 场景。

## 本地运行

要求 Node.js 22.12+、npm。命令均从仓库根目录执行：

```sh
npm ci --prefix app/hr
npm run dev --prefix app/hr
```

打开 `http://127.0.0.1:5186`。端口被占用时明确报错，不自动跳转到其他端口。

```sh
npm test --prefix app/hr
npm run build --prefix app/hr
npm run preview --prefix app/hr
```

`preview` 在同一地址提供 `app/hr/dist/` 的构建产物；先停止 dev 再启动 preview。数据和资源随应用打包，运行时无需外部网络或 API。

## 3 分钟演示路径

1. **Job Requirements**：介绍 SQL、Data Analysis、Business Problem Solving 三项要求。
2. **Candidates → View report**：Alex Chen 的前两项 Supported，业务问题解决能力 Uncertain。打开 View details 和来源材料，说明缺口。
3. **Review targeted task**：查看 Conversion Drop Investigation、六个资源和四种调查产出。可编辑 instructions、Regenerate；空 instructions 无法发送。
4. **Confirm & Send to Candidate → Load demo submission**：模拟收到预设候选人提交；发送后任务说明锁定。
5. **Review**：依次查看 Final work sample、Process evidence（可筛选）、AI-extracted evidence（五个观察维度，均可追溯来源）。
6. **Confirm → Confirm evidence**：更新报告展示 Uncertain → Verified through targeted task，并保留来源、人工审核和剩余不确定性。可对照 Initial report、导出 Markdown 报告。
7. **Reset demo**：确认后回到初始状态，可重复演示。

两条其他审核分支均要求备注：Needs More Evidence、Evidence Still Insufficient 都保留 Uncertain，不会误标已验证。Reopen human review 撤销当前确认，回到 In Review，可演示其他结果。

## 实现与协作边界

- `src/main.jsx`：HR 页面、导航、任务与审核交互；`components.jsx`：HR 本地界面组件。
- `src/styles.css`：本端布局与语义颜色引用；主题 token 与侧栏来自 [共享 UI](../shared/README.md)。
- `src/data.js`：合成申请材料、六个资源、工作样本、时间线、预生成 AI 观察。
- `src/workflow.js`：明确的工作流转换与本地状态恢复；`test/workflow.test.js`：状态、边界和证据链接检查。
- 状态保存在当前浏览器 origin 的 `evidencebridge.hr.demo.v1`；刷新保留进度。Reset demo 只重置本 HR 应用数据。浏览器禁用存储时显示提示，当前会话仍可使用。
- 两端共用外观层，保留独立构建与业务状态。发送与收到样本是 HR 端本地模拟，不会向真实人员发消息；没有真实上传、AI 请求或两端同步。跨端任务、提交、审核与重置合同仍需双方约定。
- 内置候选人、材料、分析、身份均为演示数据。按钮改变的是证据审核状态，不执行真实招聘决定。

## 外观偏好

侧栏底部太阳/月亮滑动开关控制日夜主题；侧栏支持 232px / 64px 折叠与小屏抽屉。业务重置保留外观偏好，本地不同端口分别记忆。数字评分尚未加入，原有三种人工审核结果不变。跨端界面回归复用 Candidate 的 Playwright：根目录执行 `npm run test:ui --prefix app/candidate`，需先安装两端既有依赖；截图与失败 trace 见 `.ci-results/shared-ui/`。

## 验证

`npm test --prefix app/hr` 使用 Node 内置 test runner，覆盖完整确认链路、两种非确认分支、空任务、重复发送/提交、任务锁定、重新生成、重新审核、刷新恢复、重置及固定指标一致性。CI 执行这些测试和生产构建；浏览器验收步骤见上方演示路径。

常见问题：端口被占用会在启动终端报错；未收到提交时 Review 显示等待页；旧演示进度可用 Reset demo 清除。浏览器运行错误见开发者控制台，Vite 启动/构建日志在启动终端。


## 2026-09-19 双端本地整合补充

基于PR9前端与本地修订5后端新增真实API3模式，保留原页面成果。默认 `api3-connected` 匹配后端默认3.0；显式 `connected` 仍用于旧API2，`revision5-preview` 仍是独立本地模拟。旧段落中的“新版待接入”是此前阶段记录，当前行为以[API3整合交接](../../docs/FRONTEND_API3_INTEGRATION.md)为准。新检查 `python3 scripts/frontend-types-v3.py --check` 与 `npm run test:api3 --prefix app/candidate`；各命令从仓库根执行。API3浏览器用独立端口与临时SQLite，普通页面不持有reset令牌。此轮未提交、推送、合并或部署；实际验收状态以本轮报告为准。
