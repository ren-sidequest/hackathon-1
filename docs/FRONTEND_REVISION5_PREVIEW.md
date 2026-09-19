# 修订 5 前端预览与后续接入

本轮基于 PR7 合并后的 `e9d6de6`，仅实现前端。未修改后端、数据库、OpenAPI 或生成的 API 类型；没有新增依赖。用户提供的 2026-09-19 修订 5 实施清单是本轮输入。

## 当前能验收什么

- 公司与岗位：HarbourCart SME 背景、角色权限、SQL / DA / BPS 的 30 / 30 / 40 权重及十项公开标准。
- 四人比较：Alex、Maya、Leo、Sam 各自材料与固定示例评估；同岗位、同 rubric、application_review 阶段。完整技能可排序，缺证不按零分排序；总体不完整不展示总百分比；覆盖率单列，已评贡献不重新缩放。前三行仅显示选项，第四人始终可访问。
- 证据详情：原始文本、候选人及快照绑定、UTF-16 起止偏移精确核对后高亮；十项标准的锚点、理由、范围和下一步。Alex B3 是 2/4、贡献 5/10，提出数据请求不自动变成满分。
- 人工评估：每项 0–4、NE、未评估分开；有效原文或 NE 范围/缺口校验。只保存本地草稿，比较页继续使用固定示例成绩。不存在前端正式总分计算或伪造 reviewed revision。
- 人工名单：留存、移除、重新确认都有理由和依据；不限三人，不删除申请；提交新材料后提醒重新确认。证据确认、评分、名单分别操作。
- 四人均可分配 SQL / DA / BPS 中一项任务；目标发出后固定。V1 可申请一次 More Evidence，V2 只能结束；版本历史只读，当前版本不显示旧审核结果，不存在 V3。
- Candidate：按会话、候选人、任务、版本隔离草稿；共享原有卡片编辑器；SQL 明示静态审查。私人笔记不复制到 V2，不进入 HR 工作快照或公共导出；仅正式模拟提交快照可导出。
- 继续使用现有日夜主题、侧栏开关、角色强调色、移动抽屉及焦点行为。

## 明确的模拟边界

`revision5-preview` 与默认 `connected`、旧 `standalone` 是三个显式模式，不会在 API 失败时自动回退。页面顶部和保存文案均标注本地模拟。

四人 CV / 项目文本与成绩由前端制作，**不是后端交付 fixtures，也不是实际 AI 评估**。共享任务数据引用现有 `docs/backend/examples/initial.response.json`，不另维护渠道业务数字。没有运行 SQL、调用模型、解析 PDF、发送邮件或执行真实招聘决定。

状态保存在当前 origin 的 localStorage，键为 `evidencebridge.revision5.ui-preview.v1`。HR 页的 Preview role 可在同一 origin 切换候选人视角完成模拟闭环；不同端口的数据独立，不能宣称跨端口或多设备同步。演示身份不是鉴权账号。私人笔记的隔离是 UI/快照边界，localStorage 不是安全隔离数据库。

重置时只删除上述预览键并刷新该 origin；不要清空全部浏览器存储或调用 API 重置。保存失败保留输入并显示错误；损坏的基础存储结构会给出警告。异步写入检查会话与 revision，避免旧窗口提交覆盖新状态。该本地机制不替代服务端并发控制。

## 运行

从仓库根目录，在 PowerShell 当前进程设置模式；两个服务分别在终端启动：

```powershell
$env:VITE_APP_MODE='revision5-preview'
npm run dev --prefix app/hr -- --port 5786 --strictPort
```

```powershell
$env:VITE_APP_MODE='revision5-preview'
npm run dev --prefix app/candidate -- --port 5773 --strictPort
```

建议从 HR 入口 http://127.0.0.1:5786 使用角色切换完成闭环。Candidate 独立入口 http://127.0.0.1:5773 有独立预览存储。需要回到 API 2.0 时设置 `VITE_APP_MODE=connected` 后重启相应新服务；不要覆盖正在演示的旧服务。

## 等待后端后再接入的事项

| 接入领域 | 后端需交付 | 前端当前行为 |
| --- | --- | --- |
| 多人案例 | 版本化合同、显式 candidateId、四人 fixtures、统一身份与会话 | 前端固定四人模型，无新 API 请求 |
| 原文快照 | 候选人/来源/快照标识、原文、offset 编码与指纹约定 | 对本地文本做精确 UTF-16 比较 |
| 评估与分数 | 十项 rubric、逐项理由/引用/范围、确定性计算、保存及 immutable reviewed revisions、阶段继承规则 | 固定示例成绩；修改仅草稿 |
| 人工名单 | 当前依据、留存/移除/重新确认、并发冲突及过期依据状态 | localStorage 模拟，不写实际名单 |
| 定向任务 | SQL/DA/BPS 合同、发题、权限、V1/V2 提交/历史/审核、资源与材料绑定 | 本地有界流程；未调用旧 Alex 接口伪装多人 |
| AI 分析 | 各技能适用结构、mode/provenance、disabled/错误状态 | 明示不可用，不把 BPS 五维结果套给 SQL/DA |

以上是需要的数据能力，不是指定新增路径或自建后端 DTO。收到新版合同和 fixtures 后，新增独立转换/请求层替换本地 controller，并用真实 HTTP 集成验证候选人、版本、错误和隐私边界。API 2.0 继续按 [原前端交接](FRONTEND_API_HANDOFF.md) 运行。

## 实际修改文件

- `app/shared/revision5/`：`model.ts`、`fixtures.ts`、`preview-store.ts`、`work-validation.ts`、`Revision5App.tsx`、`hr-preview.tsx`、`candidate-preview.tsx`、`assessment-ui.tsx`、`revision5.css`。
- `app/shared/card-editor.tsx` 与 `app/candidate/src/ApiWorkspace.tsx`：抽取复用既有卡片编辑器，保留连接版行为。
- 两端 `src/Revision5App.tsx`、`app/candidate/src/main.tsx`、`app/hr/src/main.jsx`：独立懒加载入口；两端 `.env.example` 说明模式。
- `app/candidate/src/revision5.test.ts`、`tests/revision5.spec.ts`、`playwright.revision5.config.ts`、`package.json`、`tsconfig.json`：新增验证入口与类型检查。
- `.github/workflows/candidate-checks.yml`：接入新版浏览器测试。
- 本文件、`AGENTS.md`、两端 README、`app/shared/README.md`、`scripts/check_repository.py`：使用、交接和检查说明。

## 验证与排错

```sh
npm test --prefix app/candidate
npm test --prefix app/hr
npm run build --prefix app/candidate
npm run build --prefix app/hr
npm run test:revision5 --prefix app/candidate
npm run test:api --prefix app/candidate
npm run test:ui --prefix app/candidate -- --workers=2
npm run test:e2e --prefix app/candidate -- --workers=2
python scripts/check_repository.py
git diff --check
```

浏览器测试需要本机已安装 Chromium。新版测试自动使用 5673 / 5686，不启动后端；API 回归使用隔离测试后端 8789，不能据此宣称新版多人 API 验证通过。没有外部模型调用，未进行 AI Eval。

2026-09-19 本轮实际结果：Candidate 单元测试 37/37、HR 工作流 8/8、新版浏览器 11/11、API 2.0 HTTP 集成 11/11、共享 UI 10/10、原 Candidate 浏览器 9/9 均通过。两端默认连接版和显式新版预览构建均通过；19 份文档链接检查与 `git diff --check` 通过。构建后的 5773 / 5786 页面加载、人工评估弹窗、共享卡片编辑器已额外烟测，未出现浏览器运行时异常。截图仅保存在 `.ci-results/`。

验证中修复了抽取组件在 HR JSX 转换环境下缺少 React 引用的问题，以及旧全局 table 样式影响新比较表换行的问题。共享 UI 首次启动中断遗留了本次测试进程，确认路径并停止该进程后重新运行通过。GitNexus 本机索引分析未完成，不将其报告为成功；代码验证使用实际类型检查、测试和构建。

主要排错点：切人/版本串数据看浏览器身份及 localStorage 的复合草稿键；缺少或错位引用看 SourceDialog 的 candidate/snapshot/offset 拒绝提示；禁用存储后保存失败看页面 alert 与浏览器控制台。新版失败截图和 trace 在 `.ci-results/revision5-ui/`，连接版在 `.ci-results/api-ui/`。启动错误在对应终端；出现端口冲突先核对进程归属，不终止其他演示服务。
