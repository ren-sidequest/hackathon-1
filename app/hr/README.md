# EvidenceBridge HR

可独立演示的 HR Web 应用。使用 React 19 + Vite 7，遵循 [产品蓝图](../../docs/product/EvidenceBridge_PRODUCT_BLUEPRINT.md)、[UI 基线](../../docs/product/EvidenceBridge_BASELINE.md) 与 [仓库规则](../../AGENTS.md)。深色侧栏、浅色工作区、蓝色 HR 强调色；固定使用 HarbourCart / Junior Data Analyst 场景。

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
- `src/styles.css`：Baseline 视觉 token、桌面布局与窄屏适配。
- `src/data.js`：合成申请材料、六个资源、工作样本、时间线、预生成 AI 观察。
- `src/workflow.js`：明确的工作流转换与本地状态恢复；`test/workflow.test.js`：状态、边界和证据链接检查。
- 状态保存在当前浏览器 origin 的 `evidencebridge.hr.demo.v1`；刷新保留进度。Reset demo 只重置本 HR 应用数据。浏览器禁用存储时显示提示，当前会话仍可使用。
- Candidate 目录、根目录构建配置和跨端接口没有改变。发送与收到样本是 HR 端本地模拟，不会向真实人员发消息；没有真实上传、AI 请求或两端同步。跨端任务、提交、审核与重置合同仍需双方约定。
- 内置候选人、材料、分析、身份均为演示数据。按钮改变的是证据审核状态，不执行真实招聘决定。

## 验证

`npm test --prefix app/hr` 使用 Node 内置 test runner，覆盖完整确认链路、两种非确认分支、空任务、重复发送/提交、任务锁定、重新生成、重新审核、刷新恢复、重置及固定指标一致性。CI 执行这些测试和生产构建；浏览器验收步骤见上方演示路径。

常见问题：端口被占用会在启动终端报错；未收到提交时 Review 显示等待页；旧演示进度可用 Reset demo 清除。浏览器运行错误见开发者控制台，Vite 启动/构建日志在启动终端。
