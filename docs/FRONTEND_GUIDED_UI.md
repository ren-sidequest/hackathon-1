# 四块引导式前端设计

本轮为本地设计实现，不发布、不合并。独立分支 `codex/guided-four-panels`，工作副本 `hackathon-1-guided-ui`，基于 API3 main 与已提交的黑金主题 `03d6e93`。发布工作副本及其未提交文件未修改。

## 页面与交互

1. Company：紧凑岗位概览、业务目标、三步工作链。背景和岗位要求按需展开；十格权重从服务端 rubric 派生，不是候选人成绩。
2. Evidence：顶部十项标准、桌面等高双栏。原文和判断各自滚动，底部操作承接当前标准。选择标准只滚动原文区域，显式 Locate 可以定位页面。移动端上下排列。
3. Journey：保留候选人与已查看的证据上下文；任务草稿在同一候选人的页面间保留。Candidate 工作区有资源、调查板、检查提交入口。后端确认提交后转到公开作品与反馈页。
4. Target Task：确认缺口 → 预览任务单 → 确认发送。选中的能力及缺口可从证据页带入，继续复用服务端固定模板。只有最后一步调用原发送接口，不修改业务合同、评分规则、V1/V2权限或人工审核边界。

Toast 使用现有主题色、磨砂背景。成功提示停留7秒，鼠标悬停或键盘焦点停留时暂停；错误不自动消失。成功仅来自服务端回执。提交成功但刷新失败会保留真实回执和刷新要求，不声称新数据已经加载。

跨端仍读取共享 API3 服务；另一窗口的操作通过现有 Refresh shared case 获取。本轮没有新增后台推送、邮件、通知服务或模型调用。草稿仍有原来的浏览器存储边界；HR任务编辑跨页保留但不承诺刷新后保存。预览模式 `revision5-preview` 保持原样，本次设计入口是 `api3-connected`。

## 实际修改文件

- [App.tsx](../app/shared/api3/App.tsx)：共享流程导航和浮动反馈。
- [guidance.tsx](../app/shared/api3/guidance.tsx)、[guidance.css](../app/shared/api3/guidance.css)：岗位概览、服务端权重、任务单、Toast及响应式样式。
- [assessment.tsx](../app/shared/api3/assessment.tsx)：证据工作台和上下文任务入口。
- [hr.tsx](../app/shared/api3/hr.tsx)：任务三步编辑和同人跨页状态。
- [candidate.tsx](../app/shared/api3/candidate.tsx)：任务单、页内入口、提交后导航和检查提示。
- [controller.ts](../app/shared/api3/controller.ts)：基于真实操作结果的反馈文案。
- [api3-integration.spec.ts](../app/candidate/tests/api3-integration.spec.ts)：回归与新流程截图。
- [playwright.api3.config.ts](../app/candidate/playwright.api3.config.ts)、[api3-server.mjs](../app/candidate/tests/api3-server.mjs)：可配置隔离测试端口和 Windows 可用的测试专用重启控制。
- 本文、[共享 UI 说明](../app/shared/README.md)、[AGENTS.md](../AGENTS.md)：运行与交接说明。

## 验证和本地预览

依赖均来自原锁文件，没有新增包。常规命令：

```powershell
npm run build --prefix app/candidate
npm run build --prefix app/hr
npm test --prefix app/candidate
# 与另一个工作副本同时测试时隔离端口；默认端口不变
$env:EB_API3_TEST_BACKEND_PORT='8894'
$env:EB_API3_TEST_CANDIDATE_PORT='6473'
$env:EB_API3_TEST_HR_PORT='6486'
npm run test:api3 --prefix app/candidate -- --reporter=line
python scripts/check_repository.py
git diff --check
```

浏览器测试只使用本工作副本控制文件和临时SQLite。Windows重启检查通过临时数据库目录中的generation控制文件请求关闭／重开测试服务，不向正式服务发送控制请求。检查包含四人V1/V2、回执重试、来源绑定、私有内容隔离、冲突、持久化、新任务向导和日夜移动截图。截图与失败trace在 `.ci-results/api3-ui/`。

本地设计预览：HR `http://127.0.0.1:6586/#company`，Candidate `http://127.0.0.1:6573/`；独立服务8896，只使用 `.ci-results/guided-preview/` 中的合成案例SQLite和日志，不读取正式.env，不启用模型。首次从HR选Alex、打开B3并拟定任务，再到Candidate继续相同人。页面保留真实服务与合成资料标识。

## 故障检查

- 任务不出现：确认两窗口选同一人，并刷新。看浏览器Network的 `/api/demo?candidateId=…` 和本预览 `service.stderr.log`。
- 发送／提交失败：故意断开服务或制造版本冲突可复现。错误Toast和表单保留，查看浏览器Network响应、requestId；不重新生成请求冒充成功。
- 布局或定位异常：切换B3/S2、移动到390px、切日夜主题复现。查浏览器Console及上述截图／trace；外部页面滚动不应因普通标准选择改变。

主要取舍：保持后端为正式状态来源，新增轻量React组件而不新增流程/通知依赖。证据页状态在组件内保留，换人或换会话时隔离重建；不把候选人状态或人类判断合并成单一自动步骤。

### 本轮实际结果

- Candidate与HR默认构建、8896独立预览构建均通过。
- npm test --prefix app/candidate：9个文件、79项通过。
- 隔离端口的API3浏览器测试：23/23通过，含新四块流程与日夜/移动截图。初轮21通过、2失败，失败为原测试SIGUSR2不适配Windows和旧默认日间假设，已修复测试并完整复测。
- 未调用真实模型，未推送、合并或线上部署。

## 覆盖率与累计分数标签迭代

本轮新增 [coverage-cell.tsx](../app/shared/api3/coverage-cell.tsx)，并修改 App.tsx、hr.tsx、assessment.tsx、guidance.css 和 api3-integration.spec.ts：覆盖完整使用青绿、缺项使用琥珀，未评估保持中性；累计分数统一金色，固定显示服务端 accruedScore，不随覆盖率缩放。数字0计入已评估，NE与未评估分别标明。十格按服务端rubric顺序排列，悬停/键盘标签提供标准名和状态，点击携带候选人与标准进入申请材料证据页。

实际验证：隔离端口运行 npm run test:api3 --prefix app/candidate -- --grep 'T02|T24|T25' --reporter=line，3/3通过；Candidate及HR的8896预览构建通过。T25逐人核对服务端覆盖数、累计分数、色彩状态，验证跨人和同人不同标准的定位。日夜截图在 .ci-results/api3-ui/ 的T25目录。未声称本轮重新执行完整23项或79项单测。

故障排查：值不符时对比GET comparison；跳错人时从Sam B4切回Alex S1/B4复现，检查Current candidate和高亮标准；窄屏时表格内部横向滚动，查看Console和T25 trace。信息提示解释累计分数与覆盖率的区别；无新依赖、无后端合同或分数计算改动。仍未上传、合并或部署。

### 紧凑标签调整

本轮只修改 coverage-cell.tsx、guidance.css、T25测试和本文。覆盖/累计分数改为并排小标签，模块约63px高；十格视觉6px，桌面点击区22px高。移除新加的1240px表格最小宽度，覆盖列180px，沿用原950px表格底线。完整/缺项说明收进标签title和信息提示，数值、颜色语义和跨人定位不变。

实际执行隔离端口 test:api3 -- --grep T25 --reporter=line：1/1通过，逐人检查模块不超过66px、标签同排、1440px窗口表格无额外横向滚动、数据和定位正确；日夜截图已查看。两端独立预览构建、git diff --check通过。未新增依赖或修改后端。已更新6573/6586本地预览，未上传合并部署。

## 与服务器版本整合及发布准备

本节记录用户授权上传、合并、部署后的状态；前文各阶段“未发布”为当时的历史记录。

整合 origin/main 的 PR11（3ef673b）时，保留 API3 金色选择器、比较看板、Candidate Spotlight/StarBorder 和标准弹窗的精确定位。公司信息保留本轮紧凑布局；关闭标准弹窗后恢复触发按钮焦点。测试沿用主分支临时 SQLite 目录内的 generation 重启请求，并保留独立端口配置；未改生产接口。

实际运行：Candidate 单元79/79、HR单元8/8、API3全套26/26、双端build、frontend-types-v3一致性、20份文档链接与diff检查通过。首轮整合回归发现自定义选择器的label同时匹配隐藏listbox，以及标准弹窗焦点未返回；修复精确combobox定位和焦点恢复后，完整26项通过。T23/T24保留主分支黑金回归，T25/T26验证新引导及紧凑标签。

实际文件范围：App.tsx、assessment.tsx、candidate.tsx、controller.ts、hr.tsx、guidance.tsx、guidance.css、coverage-cell.tsx；API3浏览器测试与配置、共享README、AGENTS.md和本文。无新增依赖、后端源代码或数据库结构变化。

发布沿用 [服务器发布说明](FRONTEND_SERVER_RELEASE.md)：从合并后的干净提交构建，API指向同源 /gateway；版本化静态目录并原子切换 frontend-current。保留前一版本及旧哈希资源；后端进程和数据库不重启、不清空。发布结果以PR、服务器release manifest和线上只读验收为准。
