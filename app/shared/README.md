# Shared appearance and navigation

修订 5 新增 `revision5/` 共享前端预览模块；UI 模型不是后端 DTO，默认 API 2.0 接入保持独立。`card-editor.tsx` 从现有连接版抽取，由连接版与新预览复用。详情见 [修订 5 前端说明](../../docs/FRONTEND_REVISION5_PREVIEW.md)。下文“尚未实现数字评分”仅指既有 API 2.0 连接版。

HR 与 Candidate 共用的轻量 UI 源码，不是第三个应用。使用现有 React 和普通 CSS，未新增第三方依赖；保留两端独立的 npm 锁文件和构建。

## 文件与边界

- `tokens.css`：日夜主题、状态语义、HR 蓝色与 Candidate 绿色。
- `shell.css`：232px / 64px 侧栏、700px 以下抽屉、主题滑动开关及图表主题适配。
- `ui.tsx`：`Sidebar`、`ThemeSwitch`、`useSidebar`；导航内容、图标和操作回调由各端传入。
- `preferences.ts`：启动时读取偏好、主题解析和可失败的本地存储。入口在 React 挂载前执行 `initializeTheme()`。

先导入各端页面 CSS，再导入共享 tokens 与 shell。两端 Vite 配置显式允许读取 `app/` 下的共享源码，并通过 `resolve.dedupe` 从本端依赖解析 React，避免混用两端的 React 版本。Candidate 的 TypeScript `paths` 将共享源码的 React 类型解析到本端已安装的类型包；HR 继续使用 JavaScript，由 Vite 转译共享 TSX。

原外观组件不读取或迁移业务 reducer；新增 api-types / api / use-api / api-ui / connected.css 负责 API 2.0 接入，详见 [前端交接](../../docs/FRONTEND_API_HANDOFF.md)。浏览器通过本机后端读取共享案例，不直接访问数据库或模型。本 PR 尚未实现数字评分；修订 5 已批准公开 rubric、人工评估与确定性计算，后续按新版合同接入。既有证据审核不等同于评分或人工名单操作。

## 偏好与交互

- 主题存储键：`evidencebridge.ui.theme.v1`，值为 `light` / `dark`。没有有效偏好时跟随系统；主动切换后优先使用手动选择。
- 侧栏键：`evidencebridge.ui.sidebar.hr.v1` / `evidencebridge.ui.sidebar.candidate.v1`，值为 `expanded` / `collapsed`，分别记住两端偏好。
- 同源标签页通过 `storage` 事件更新主题；本地不同端口属于不同 origin，各自记忆，不承诺跨端口或跨设备同步。
- 业务演示重置不清除外观偏好。存储不可用时开关仍在当前标签页有效；两端原有业务存储警告保留。
- 小屏抽屉独立于桌面折叠状态：焦点进入抽屉、背景 inert、Tab 循环、Escape / 遮罩关闭并返回菜单按钮；跨回桌面解除背景锁定。
- 侧栏背景、品牌文字、图标、边框与用户信息随日夜主题切换；主题开关位于侧栏底部，折叠时缩为紧凑滑动开关，手机端在抽屉内使用。
- 折叠图标可悬停或聚焦查看名称；主题开关支持 Space / Enter，遵守 reduced motion。

## 验证与排错

根目录执行两端已有单元测试和构建。跨端 Chromium 回归复用 Candidate 已有 Playwright，无需为 HR 增加测试依赖：

```sh
npm ci --prefix app/candidate
npm ci --prefix app/hr
npm exec --prefix app/candidate -- playwright install chromium
npm run test:ui --prefix app/candidate
```

共享测试自动启动本机 `5573`（Candidate）与 `5586`（HR），不替换默认演示端口；本地与 CI 均强制启动独立 standalone 测试服务。报告、截图与失败 trace 写入根目录 `.ci-results/shared-ui/`，不提交 Git。原 Candidate 浏览器测试仍为 `npm run test:e2e --prefix app/candidate`。

测试覆盖：明暗切换、首次跟随系统及手动优先、同源标签页更新、刷新、业务状态隔离、桌面折叠、移动端焦点/布局、存储拒绝、减少动画、图表/弹窗及 HR 完整确认链路。主题策略单元测试位于 Candidate 的 `src/preferences.test.ts`。不涉及模型输出质量，未运行 AI Eval。

常见排错：

1. 改主题后某组件仍发白：查看浏览器 Computed Styles，检查该组件是否残留硬编码色值或未使用共享语义变量。
2. 导航抽屉关闭后不能点击：在浏览器检查 `[data-eb-content]` 的 inert 与 body overflow；回归测试保留对应截图和 trace。
3. 偏好刷新后不保留：检查是否变更了端口/origin，或浏览器拒绝 localStorage；主题失败不会删除业务草稿。

构建与端口错误查看启动终端；运行时错误查看浏览器控制台。共享代码变化同时触发 Candidate 和 HR CI。
