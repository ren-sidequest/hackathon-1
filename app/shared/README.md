# Shared appearance and navigation

修订 5 新增 `revision5/` 共享前端预览模块；UI 模型不是后端 DTO，默认 API 2.0 接入保持独立。`card-editor.tsx` 从现有连接版抽取，由连接版与新预览复用。详情见 [修订 5 前端说明](../../docs/FRONTEND_REVISION5_PREVIEW.md)。下文“尚未实现数字评分”仅指既有 API 2.0 连接版。

HR 与 Candidate 共用的轻量 UI 源码，不是第三个应用。使用现有 React 和普通 CSS，未新增第三方依赖；保留两端独立的 npm 锁文件和构建。

## 文件与边界

- `tokens.css`：日夜主题、状态语义与双端统一金色强调色。
- `shell.css`：232px / 64px 侧栏、700px 以下抽屉、主题滑动开关及图表主题适配。
- `ui.tsx`：`Sidebar`、`ThemeSwitch`、`useSidebar`；导航内容、图标和操作回调由各端传入。
- `preferences.ts`：启动时读取偏好、主题解析和可失败的本地存储。入口在 React 挂载前执行 `initializeTheme()`。

先导入各端页面 CSS，再导入共享 tokens 与 shell。两端 Vite 配置显式允许读取 `app/` 下的共享源码，并通过 `resolve.dedupe` 从本端依赖解析 React，避免混用两端的 React 版本。Candidate 的 TypeScript `paths` 将共享源码的 React 类型解析到本端已安装的类型包；HR 继续使用 JavaScript，由 Vite 转译共享 TSX。

原外观组件不读取或迁移业务 reducer；新增 api-types / api / use-api / api-ui / connected.css 负责 API 2.0 接入，详见 [前端交接](../../docs/FRONTEND_API_HANDOFF.md)。浏览器通过本机后端读取共享案例，不直接访问数据库或模型。本 PR 尚未实现数字评分；修订 5 已批准公开 rubric、人工评估与确定性计算，后续按新版合同接入。既有证据审核不等同于评分或人工名单操作。

## 偏好与交互

- 主题存储键：`evidencebridge.ui.theme.v1`，值为 `light` / `dark`。没有有效偏好时默认 dark，不跟随系统自动切换；主动选择白天或夜间后记住选择。
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

测试覆盖：明暗切换、首次默认夜间及手动选择持久化、同源标签页更新、刷新、业务状态隔离、桌面折叠、移动端焦点/布局、存储拒绝、减少动画、图表/弹窗及 HR 完整确认链路。主题策略单元测试位于 Candidate 的 `src/preferences.test.ts`。不涉及模型输出质量，未运行 AI Eval。

常见排错：

1. 改主题后某组件仍发白：查看浏览器 Computed Styles，检查该组件是否残留硬编码色值或未使用共享语义变量。
2. 导航抽屉关闭后不能点击：在浏览器检查 `[data-eb-content]` 的 inert 与 body overflow；回归测试保留对应截图和 trace。
3. 偏好刷新后不保留：检查是否变更了端口/origin，或浏览器拒绝 localStorage；主题失败不会删除业务草稿。

构建与端口错误查看启动终端；运行时错误查看浏览器控制台。共享代码变化同时触发 Candidate 和 HR CI。


## 黑金 / 白金主题（2026-09-19）

配色参考 [Leobai03 的黑金模板](https://github.com/Leobai03/personal-portfolio-template/blob/main/src/styles/global.css)，仅提取视觉方向，没有引入 Astro、模板业务或依赖。

- 夜间：纯黑底 `#030303`、暖白文字、金属金 `#DBB85C`；白天：暖白底、较深金色文字与金色按钮。
- HR 和 Candidate 共用强调色；角色通过名称、导航与上下文区分。成功／警告／错误继续使用独立语义颜色。
- `--accent-*` 是主题源；旧 `--blue-*`、`--green-*` 作为兼容别名映射到金色，避免重写业务组件。分析图表采用金色与米灰色，使用条纹区分历史周期。
- 默认 CSS 为夜间，React 挂载前读取既有 `evidencebridge.ui.theme.v1`；有效手动偏好优先，存储失败不影响当页切换。HTML theme-color 随主题更新。
- 修改文件：`tokens.css`、`shell.css`、`connected.css`、`preferences.ts`、`ui.tsx`、`revision5/revision5.css`、双端 `index.html`；Candidate 的 `preferences.test.ts`、`tests/shared-ui.spec.ts`、`tests/revision5.spec.ts`、`tests/api-integration.spec.ts`；本说明、产品 Baseline 与项目 AGENTS。
- 主题回归增加浅色系统下默认夜间、手动白天刷新／跨标签页保持、存储失败与常用文本配色 4.5:1 对比度检查；业务状态不因主题改变而重置。

本轮实际验证（2026-09-19）：

- `npm test --prefix app/candidate`：42/42。
- `npm run test:ui --prefix app/candidate -- --workers=2`：12/12。
- `npm run test:revision5 --prefix app/candidate`：12/12。
- `npm run test:api --prefix app/candidate`：11/11；隔离后端测试，不调用外部模型。
- `npm run build --prefix app/candidate` 与 `npm run build --prefix app/hr`：默认连接版构建通过；设置 `VITE_APP_MODE=revision5-preview` 后，两端预览构建也通过。
- `python scripts/check_repository.py`：19 份文档通过；`git diff --check`：通过。

本机本轮独立预览：Candidate `http://127.0.0.1:6073`，HR `http://127.0.0.1:6086`。使用合成数据；可在同一端口内切换 Preview role 查看完整演示流程。启动日志在根目录 `.ci-results/gold-preview/`，浏览器测试截图／trace 在 `.ci-results/shared-ui/`、`.ci-results/revision5-ui/`。这些端口仅用于本轮本地预览，不代表合并或发布。

## 第三版金属黑金与交互（2026-09-19）

以上 6073 / 6086 是上一版保留预览；第三版使用 Candidate `http://127.0.0.1:6173`、HR `http://127.0.0.1:6186`。构建和启动日志在 `.ci-results/gilded-preview/`。本轮没有上传、合并或发布。

- 采用用户选定的第三张视觉稿：纯黑底、细金边、金属高光；HR 按“标准导航 / 原始材料 / 审核判断”组织三栏，保留十项标准、原始引用及草稿编辑。
- 主按钮 hover 保留金属渐变，不移动或缩放点击区域；背景与高亮装饰 `pointer-events:none`。修正自定义选择器选中后被外层 label 再次打开的问题。
- `glide-select.tsx` / `glide-select.css` 参考用户提供的 React Bits GlideSelect，保留滑动高亮、受控选值、键盘、鼠标拖选和触控滚动；用浏览器 popover 顶层解决容器裁切，无新增图标或动画依赖。主要导航／筛选采用新控件；评分与历史版本仍用原生选择框。现代 Chromium 已验证，其他浏览器未专测。
- `gold-backdrop.tsx` 是独立 Canvas 实现，参考 Blinking Squares 的公开效果，不含 Pro 源码。每秒最多约 15 次绘制、DPR 上限 1.5、隐藏标签暂停、减少动画时静止；无网络请求和光标追踪。
- `revision5/review-dashboard.tsx` 借鉴 Dashboard 11 的覆盖率／队列结构，以现有合成材料、任务和审核状态派生。隐藏提醒只是当前面板显示偏好，不完成审核、不删除材料，支持恢复；不编造时间序列或新增后端接口。
- React Bits Pro 未安装，未配置许可密钥或 registry。GlideSelect 来源与许可见 [React Bits 许可](../../docs/third-party/react-bits-license.md)；独立背景与概览不是原版 Pro 组件。

本轮实际文件（不含上一轮已完成的默认夜间逻辑）：新增 `glide-select.tsx`、`glide-select.css`、`gold-backdrop.tsx`、`revision5/review-dashboard.tsx`；修改 `tokens.css`、`shell.css`、`connected.css`、`ui.tsx`、`preferences.ts`、`revision5/Revision5App.tsx`、`revision5/hr-preview.tsx`、`revision5/assessment-ui.tsx`、`revision5/revision5.css`、双端 `index.html`、Candidate 三份 UI / API / revision5 测试；更新本说明、产品 Baseline、视觉 QA 与第三方许可。

验证命令沿用上节：Candidate 单元 42/42，共享 UI 12/12，revision5 15/15，隔离 API 11/11。新增回归覆盖按钮边缘悬停 20 帧的几何与背景稳定性、拖选只关闭一次、键盘 Escape / Tab / Home / End、触摸选择、减少动画、待办隐藏不删除证据。两端默认连接版和 revision5-preview 构建通过；未运行 AI Eval。

排错：悬停闪动时把指针停在按钮边缘，检查 Computed Styles 的 background / transform；选择菜单问题用键盘与拖选复现，查看浏览器控制台及 `.ci-results/revision5-ui/` trace；队列与预期不符时先恢复隐藏提醒并核对同一端口的预览任务状态。外观偏好不等于业务状态同步。

## React Bits 轻量交互接入（2026-09-19）

本次延续第三版主题，只保留三个效果；用户取消 ClickSpark，最终代码不包含点击火花组件或事件。

- GlideSelect：沿用现有候选人、角色、排序、来源等选择器，不新增依赖。
- SpotlightCard：HR 证据覆盖率面板、Candidate 材料面板与共用数据指标卡。参考 [官方组件](https://github.com/DavidHDev/react-bits/tree/main/src/content/Components/SpotlightCard)，指针坐标写入卡片 CSS 变量，叠加淡金色光斑；不移动卡片、不拦截点击，触屏不跟随指针。白天使用较深且更淡的金色。
- StarBorder：HR 审核待办区、Candidate 材料页的任务状态入口；参考 [官方组件](https://github.com/DavidHDev/react-bits/tree/main/src/content/Animations/StarBorder)，改成九秒缓慢移动的上下细金边，不给评分或提交结果附加成功暗示。浏览器开启 reduced motion 后静止，Spotlight 停止。

实际修改文件：新增 `gold-interactions.tsx`、`gold-interactions.css`；修改 `revision5/review-dashboard.tsx`、`revision5/candidate-preview.tsx`、`workspace-ui.tsx`、`../candidate/tests/revision5.spec.ts`、本说明和根目录 `design-qa.md`。GlideSelect 没有再次修改；侧栏帮助入口保持普通按钮。

本轮验证：`npm run test:revision5 --prefix app/candidate` 16/16；`npm run test:ui --prefix app/candidate -- --workers=2` 12/12；Candidate 默认构建及两端 revision5-preview 构建通过。截图在 `.ci-results/revision5-ui/revision5-gold-card-effect-5fe92-and-stop-for-reduced-motion/`，现有 6173 / 6186 预览已重新构建，刷新即可查看。未提交、推送、合并或生产部署；本轮未重跑 API 测试或 AI Eval。

排错：①卡片不能点击：悬停后点击材料／覆盖率行，检查装饰层 `pointer-events:none`；②金边不可见：检查系统 reduced motion 及动画 `eb-gold-perimeter`，静态边框仍保留；③主题颜色不更新：切换侧栏 Night mode，检查根节点 `data-theme` 和 `--interaction-*`。运行异常查看浏览器控制台，失败截图／trace 使用上述测试输出目录。

## 夜间对比度与磨砂层次修订（2026-09-19）

本节覆盖前面的纯黑色值：侧栏保持 `#060606`，页面改为 `#181A1C`，阅读底色 `#2B2D2F`，内层底色 `#343638`，按用户后续澄清建立侧栏 / 页面 / 模块三档亮度，提升辅助文字和边框亮度。新增静态暖金光晕，与已有低频方格背景组合；不新增依赖或鼠标跟随动画。HR / Candidate 外层卡片、概览、身份栏和工作台框架使用高不透明度磨砂渐变与 14px backdrop blur；表格、输入、原文等保留实底，内层面板避免重复模糊。无 blur 支持时使用实色回退。

Candidate 调查页空状态的 `View task and work` 和反馈页空状态的 `View task status` 改用现有 primary 金属按钮。其他普通操作统一淡金色文字与轻微高光；危险和状态语义颜色保留。

本轮实际文件：`tokens.css`、`gold-backdrop.tsx`、`shell.css`、`connected.css`、`revision5/revision5.css`、`revision5/candidate-preview.tsx`、Candidate `tests/revision5.spec.ts` / `tests/shared-ui.spec.ts`、本说明、产品 Baseline 和 `design-qa.md`。

验证：`npm run test:revision5 --prefix app/candidate` 17/17，`npm run test:ui --prefix app/candidate -- --workers=2` 12/12；`npm run build --prefix app/candidate` / `npm run build --prefix app/hr` 及两端 revision5-preview 构建通过。对比度测试覆盖正文四种颜色在 surface、surface-soft、实色回退及玻璃渐变两端（以最不利黑/白背景进行 alpha 合成）均至少 4.5:1。新增两处入口在日夜主题的渐变、悬停尺寸和目标页面回归。截图包括 HR 概览／审核、Candidate 调查工作台及两个空状态页面。未重跑后端/API 测试或 AI Eval。

预览仍为 Candidate 6173 / HR 6186，刷新即可查看。外层磨砂不改变业务状态、请求、评分或数据库。模糊异常查浏览器 Computed Styles 的 backdrop-filter 与 @supports；遮挡查 `.eb-gold-atmosphere` 的 pointer-events；按钮不变色先核对预览端口和页面是否刷新。日志与失败截图沿用 `.ci-results/revision5-ui/`。其他浏览器和低端设备未专项实测；当前 Chromium 测试通过。

## 评分标准可视化与证据双卡片（2026-09-19）

- 公司页面新增 `revision5/standards-overview.tsx`：从现有 criteria 派生十个等宽权重格与 SQL / DA / BPS 三张等高磨砂卡（30 / 30 / 40）。明确是固定标准组成，不是个人成绩；悬停或键盘聚焦联动对应分组，点击打开同一 Rubric 的准确标准。角色约束改为简短标签。
- `Rubric` 支持可选的初始标准，保留所有十项既有规则。打开时仅滚动弹窗自身；关闭后恢复到触发格子或卡片按钮，不滚动背景页面。
- 证据审核采用顶部标准导航 + 原文 / 判断双卡片，两张卡片顶端对齐、独立高度，移除左侧长导航撑高整体的布局。宽屏十列、较窄桌面五列；手机原文与判断上下排列，完整标准名保留在按钮的可访问名称及当前判断标题中。
- 修复点击标准后整页跳动：自动定位仅修改原文 `pre.scrollTop`；只有用户明确点击 Locate exact source 时才滚动整页定位原文。现有引用绑定、候选人隔离和判断内容不变。

实际文件：新增 `revision5/standards-overview.tsx`；修改 `revision5/hr-preview.tsx`、`revision5/assessment-ui.tsx`、`revision5/revision5.css`、Candidate `tests/revision5.spec.ts`、本说明和根目录 `design-qa.md`。无新增依赖、接口或评分计算。

验收命令：`npm run test:revision5 --prefix app/candidate -- --reporter=line`；设置 `VITE_APP_MODE=revision5-preview` 后执行两端 `npm run build`，产物仍指向 `.ci-results/gilded-preview/{candidate,hr}`。新增回归检查权重/格子尺寸、卡片高度、标准定位、键盘焦点恢复、日夜和 390px/1100px/1536px 布局，以及标准切换/弹窗开关前后 `window.scrollY` 不变。启动时遇到遗留测试服务占用 5673 已识别并只清理该测试进程；6173/6186 用户预览未停止。

排错：①切换标准跳页：检查 InlineSource 是否只滚动原文容器；②点击格子打开错误规则：核对 criterion id 和 Rubric 的 initialCriterion；③窄屏溢出：检查导航网格与侧栏过渡后的布局。运行错误查看浏览器控制台，截图/trace 位于 `.ci-results/revision5-ui/`。本轮只更新本地预览，未上传、合并或部署。

本轮补充：标准导航使用更深底板 / 更亮卡片；hover 在 180ms 内渐亮金边和柔光，不平移或缩放；键盘 focus 可见，reduced motion 关闭过渡。Material stage 改为复用 GlideSelect，保留 application / V1 / V2 的原有可用选项和切换清理逻辑。Human mark 等未涉及控件保持原状。

最终实际结果：`npm run test:revision5 --prefix app/candidate -- --reporter=line` 19/19 通过；两端 revision5-preview 构建通过，Candidate 构建包含共享 TypeScript 检查；仓库 19 份文档检查和 `git diff --check` 通过。当前 6173 / 6186 服务可访问。未运行新的 API / 后端测试或 AI Eval。
## 2026-09-19 双端本地整合补充

基于PR9前端与本地修订5后端新增真实API3模式，保留原页面成果。默认 `api3-connected` 匹配后端默认3.0；显式 `connected` 仍用于旧API2，`revision5-preview` 仍是独立本地模拟。旧段落中的“新版待接入”是此前阶段记录，当前行为以[API3整合交接](../../docs/FRONTEND_API3_INTEGRATION.md)为准。新检查 `python3 scripts/frontend-types-v3.py --check` 与 `npm run test:api3 --prefix app/candidate`；各命令从仓库根执行。API3浏览器用独立端口与临时SQLite，普通页面不持有reset令牌。此轮未提交、推送、合并或部署；实际验收状态以本轮报告为准。

### 四块引导式设计（独立本地版本）

API3岗位概览、证据双栏、流程联动与任务向导已在独立工作副本实现。详见[设计与验证交接](../../docs/FRONTEND_GUIDED_UI.md)。默认API3合同和原revision5-preview均保持原边界。
