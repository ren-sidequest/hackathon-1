# 黑金前端与服务器 API3 发布

本轮将已验收的黑金／白金主题、磨砂层次、GlideSelect、标准可视化及双卡片证据审核同步到 API3 连接版。服务器数据优先：姓名、材料、rubric、分数、任务和名单全部来自既有 API3；不以预览 fixtures 替代请求结果。保留预置合成材料、AI 标注来源和人工校准未完成等说明。

## 实现与边界

- `app/shared/api3/overview.tsx`：读取 API rubric 的十项权重、三个技能组及公司约束；coverage、任务量与提醒从 comparison 派生。隐藏提醒只影响当前面板，未调用写接口。
- `App.tsx`、`hr.tsx`：身份、比较排序及任务技能复用金色选择器。
- `assessment.tsx`：阶段选择、顶部标准导航、原文／判断双卡片；普通切换只滚动原文容器，明确点击引用才定位整页。服务端评估修订、历史只读、非目标申请评分显式复用等行为保留。
- `candidate.tsx`：材料 Spotlight、任务 StarBorder、金属空状态按钮。正式提交仍经原 API3 controller/client；私人草稿继续保存在浏览器，不进入提交。
- `glide-select.tsx`、`revision5/revision5.css`：选择值标识及连接版评分摘要样式；无新增依赖、DTO、后端或数据库改动。
- `app/candidate/tests/api3-integration.spec.ts`：更新自定义选择器回归并新增日夜、标准焦点、服务器来源、页面滚动及响应式验证。
- `app/candidate/tests/api3-server.mjs`：临时 SQLite 重开控制由 POSIX 信号改为测试目录文件，兼容 Windows；不新增生产管理路由。

## 部署目标与配置

用户指定的当前目标为 `101.37.80.98`；HR 入口 `https://101.37.80.98/hr/`，Candidate 入口 `https://101.37.80.98/candidate/`。

现有 Nginx 提供 HTTPS 与同源 `/gateway/api/demo` 代理。读取公开，写入沿用现有 `/gateway/write-access` 登录。服务器密码及网站登录凭据不保存在仓库；管理员 reset 不公开。已有后端使用 API3、SQLite 与 `manual_simulation` 规则分析，不能描述为实时模型调用。

前端构建参数（合并后的干净提交，从仓库根运行）：

```powershell
$env:VITE_APP_MODE='api3-connected'
$env:VITE_API_BASE_URL='/gateway'
npm run build --prefix app/candidate -- --base=/candidate/ --outDir ../../.ci-results/server-release/www/candidate
npm run build --prefix app/hr -- --base=/hr/ --outDir ../../.ci-results/server-release/www/hr
```

部署只上传静态产物。各版本保留在 `/opt/evidencebridge/frontend-releases/<release>/www`，`frontend-current` 为当前前端链接；Nginx root 指向该链接。既有 `/opt/evidencebridge/current`、后端进程、数据库和环境文件不变。首次切换前备份站点配置；`nginx -t` 通过才 reload；后续原子切换前端链接。每版 manifest 记录合并 SHA、构建参数与文件 SHA-256。

回滚：恢复备份 Nginx root 或将 `frontend-current` 原子指回上一前端，再 `nginx -t` 和 reload。只回滚前端，不恢复或清空业务数据。发布后核对 HTTP 重定向、HTTPS 证书、双端资源、API3 schema、黑金默认主题和错误日志；线上流程只做读取和浏览器本地操作，完整写入闭环在临时 SQLite 测试中验证。

## 验证与排错

实际执行命令：`npm test --prefix app/candidate`、`npm test --prefix app/hr`、`npm run test:api3 --prefix app/candidate -- --reporter=line`、`npm run test:revision5 --prefix app/candidate -- --reporter=line`、`npm run test:ui --prefix app/candidate -- --workers=2 --reporter=line`、`npm run test:api --prefix app/candidate -- --reporter=line`、双端 build、`python scripts/frontend-types-v3.py --check`、`python scripts/check_repository.py`、`git diff --check`。

测试日志和截图在忽略目录 `.ci-results/server-release/`、`.ci-results/api3-ui/`。首轮 API3 定位仍匹配原生 select，更新为 combobox/listbox；随后发现 Windows 无 SIGUSR2，改为测试文件控制并复测。未运行外部模型或 AI Eval。

1. 页面加载失败：检查产物 base 是否 `/hr/` 或 `/candidate/`，浏览器 Network 与 `/var/log/nginx/evidencebridge.error.log`。
2. API 不可达或版本不符：检查请求是否同源 `/gateway/api/demo`；查看页面错误码／Request ID、Nginx 日志和 `journalctl -u evidencebridge`，不切回模拟。
3. 保存返回 `WRITE_AUTH_REQUIRED`：在现有写入登录入口认证后重试；不使用服务器 root 登录代替网站访问认证，不放宽代理限制。

发布结果以相应 PR 最新 CI、合并记录及服务器 manifest 为准；构建成功不等于线上已更新。

本轮最终本地结果：Candidate 单元 79/79、HR 8/8、API3 24/24、revision5 20/20、共享 UI 12/12、API2 11/11、原 Candidate 浏览器 9/9；双端 API3 发布构建、类型生成一致性、20份既有协作文档链接和 diff 检查通过。API2 旧会话测试改为在实际 POST 发出后重置临时库，避免自动刷新合法地先移除旧表单；原错误断言与后端拒绝行为保留。
