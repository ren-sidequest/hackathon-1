# EvidenceBridge Candidate

修订 5 多人前端预览使用显式 `VITE_APP_MODE=revision5-preview`，见 [运行与接入边界](../../docs/FRONTEND_REVISION5_PREVIEW.md)。该模式为合成材料和本地模拟，不代表新版后端已完成。

> 默认运行 API 2.0 连接版：任务、提交和审核来自共享后端，本浏览器只保存私人调查草稿。完整启动、接口映射、限制和验证见 [前端接入交接](../../docs/FRONTEND_API_HANDOFF.md)。下文原有上传和本地模拟审核路径仅适用于显式 `VITE_APP_MODE=standalone`，不代表连接版功能。

Candidate 端独立 React / TypeScript / Vite Web 应用。使用 Lucide、Recharts、普通 CSS 和浏览器本地状态，实现申请 → 定向任务 → 调查工作台 → 工作样本 → 提交与审核结果演示。

开发前阅读 [仓库规则](../../AGENTS.md)、[产品蓝图](../../docs/product/EvidenceBridge_PRODUCT_BLUEPRINT.md) 和 [UI 与交互基线](../../docs/product/EvidenceBridge_BASELINE.md)。技术栈与共享数据约定见 [项目计划](../../PROJECT_PLAN.md)。

负责申请材料、任务接收、核心分析工作台、可编辑调查板、最终工作样本、过程时间线和提交状态。使用随主题变化的共享折叠侧栏、日夜主题和 Candidate 绿色强调色，分析图表可使用共享蓝色。

## 运行与验证

使用 Node.js 24 LTS（最低 22.12）和 npm，在本目录执行：

```sh
npm ci
npm run dev
```

开发地址为 `http://127.0.0.1:5173`，使用 hash 路由，无需服务器路由重写。

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run preview -- --port 4173 --strictPort
```

最后一条运行已构建的本地演示版本，地址为 `http://127.0.0.1:4173`。开发服务与预览服务的端口不同，浏览器草稿也相互独立。应用只监听本机回环地址；不是公网部署。关闭终端会停止服务，按以上命令可重新启动。

Vitest 覆盖状态迁移、提交校验、数据一致性与损坏草稿恢复。Playwright 覆盖九条浏览器场景，并在 `test-results/` 生成六个页面、过程时间线和移动端截图；失败时保留 trace。CI 从锁文件安装，在 Linux 上运行同样检查。

## 共享界面

侧栏底部太阳/月亮滑动开关控制日夜主题，侧栏支持桌面折叠和小屏抽屉。偏好在本 origin 记忆，业务演示重置保留外观设置。共享接口、存储边界与跨端回归命令见 [共享 UI 说明](../shared/README.md)。`npm run test:ui` 复用本端 Playwright 检查两端，需先安装 HR 既有依赖；产物在根目录 `.ci-results/shared-ui/`。

## 三分钟演示

1. Home → **Load Demo Application** → **Submit Application**。
2. My Tasks → **Start investigation**；展示任务原因与固定 HarbourCart 场景。
3. 打开 `campaigns.csv`，在 Explore 筛选 Paid Search；所有打开、筛选、编辑等行为进入过程时间线。
4. **Load example investigation** → 确认载入示例；编辑一张调查卡片。四个板块均支持添加、修改、删除、来源与置信度。
5. **Preview work sample**，编辑 Executive summary，展示来源图示与 Process evidence。
6. **Submit Work Sample** → 确认，进入 In review。提交后工作样本只读，可下载 Markdown / JSON。
7. **Demo controls** → 模拟 HR 确认，查看 Verified through targeted task；或演示更多证据请求（重开草稿、允许重提）与证据仍不足（不显示已验证）。

**Demo controls → Reset all demo work** 清除本浏览器中的申请、调查板、笔记和时间线。**Open populated workspace** 可直接载入完整示例，也会替换当前本地草稿。时间线明确标注载入示例，避免将预填内容伪装为真实操作记录。

## 实现边界与交接

- `src/data.ts`：合成演示数据和资源内容。订单与渠道总量一致；落地页是局部示例，趋势图为周快照，不能直接相加。
- `src/state.ts`：状态机、提交校验、草稿恢复；`src/context.tsx`：Candidate 内部上下文。
- `src/App.tsx`：申请、任务、资源、状态与外壳；`src/Workspace.tsx`：分析工具、调查板、最终报告；`src/ui.tsx` / `src/styles.css`：本端组件与视觉样式。
- 仅保存文件名、大小和本地演示状态，不读取或上传 PDF 内容。SQL / Python 只展示明确标记的预定义输出，不执行任意代码。无真实认证、AI 调用、数据库或邮件。
- 草稿保存在 `evidencebridge.candidate.demo.v1`。禁用存储时显示警告，当前标签页仍可工作并下载；损坏或旧格式数据回到初始状态。
- 私人笔记不进入工作样本和 JSON 导出；最近 100 条过程事件保存在本地演示状态。
- JSON 导出是 Candidate 独立演示产物，**不是已约定的两端 API**，没有 HR 导入或跨电脑同步。HR 团队可以继续独立实现，连接两端时再约定共享结构。
- 字体使用 Baseline 的系统字体 fallback，无远程字体依赖；核心演示在资源加载后无需外部服务。
- `npm run build` 当前有图表依赖导致的约 686 KB 主包体积提示（gzip 约 202 KB），不影响本地构建或演示。

视觉核对与已知差异见 [design-qa.md](design-qa.md)。默认不修改 HR 端；涉及共享组件或跨端数据时先协调。

排错：端口占用或缺少依赖看启动终端；运行时错误看浏览器控制台；测试失败看 `test-results/` 的截图和 trace（`npx playwright show-trace <trace.zip>`）。
