# EvidenceBridge 演示执行包

## 交付边界与现场选择

- **现场方案仍是现有线上服务器＋电脑浏览器。** 本包不要求重新部署，也未修改公网数据；隔离 SQLite 仅用于可重复技术彩排、截图与离线备用。
- 公开 [HR](https://101.37.80.98/hr/) / [Candidate](https://101.37.80.98/candidate/) 允许访客共享写入；刷新时以实际状态为准。开始前核对四人、任务版本、评分与校准标签；共享状态变化时切本包录像，不清空他人的结果。
- 代码基线 `b5d0568c71fd51f4f39f3eb506654861c1b59695`；本包未修改应用源码、依赖、合同、评分或线上运行版本。产物中的业务审核与名单操作均为**隔离自动化合成演练**，不是任何真人的签收。
- 英文合成材料版本 `final-day-demo-v1`。基线四人的原始 assessment 保持不变，真人校准仍 pending。真人修改评分后应重做截图和录制，不继续使用旧分数画面。

## 直接打开

- `offline-index.html`：最终本地素材入口（由打包脚本依据成功运行结果生成）。
- `EXECUTION_SUMMARY.md` / `LATEST_RUN.txt`：本次实际结果及原始运行目录。
- `materials.json`：英文 Amy BPS V1／具体反馈／V2／独立名单理由，及 Ann SQL、David DA 补测文本。
- `run-demo.mjs`：一次真实跨端流程、C0/C1/C2备份、重启/恢复、错误场景、两次五分钟技术切屏与真实WebM录制。
- `serve-stage.mjs`：将阶段备份恢复到**新**本地路径并启动，无 `.env`、公网请求、模型或维护令牌。

以上文件位于 `[LOCAL_ARCHIVE]`。最终录像是无声 **WebM**，不是 MP4，也不是已完成真人上台彩排。Chromium本地播放、跳转与断网验证见执行结果；实际台上浏览器仍需操作者试播。ZIP内媒体采用相对路径，可移动到另一目录解压；真人阅读入口属于总交付包的独立文件。截图是当前版本真实运行捕获，未用假界面代替。

## 两类五分钟演练分开记录

自动技术演练按总方案 §16.2 真正经过完整 300 秒（两次墙钟300.004秒/300.006秒；原始录影媒体时长343.20秒/342.36秒，单独列示，不将两者混同），记录每次切屏的计划/实际起止时间；不模拟真人语速、不虚构讲者在场。2:10–3:00段读取已保存 C1/C2，明确是**预载合成工作**而非现场完成20分钟任务。

| 时间 | 实际页面/证据 | 旁白提示（英文） |
|---|---|---|
| 0:00–0:45 | Harbour Retail 公司与JD | The payer is an SME hiring for concrete junior analytical work. |
| 0:45–1:20 | JD到十项标准与B3标准弹层 | The rubric is explicit; NE is missing evidence, not a zero. |
| 1:20–2:10 | 四人比较→Amy B3原文 | Open the original source. Amy asks for a breakdown but has not yet explained how different results would change the conclusion. |
| 2:10–3:00 | C1 V1+反馈→C2 V2+审核 | These are preloaded synthetic examples. V2 adds a comparable-group method and conditional interpretations; the requested historical device detail is still missing. |
| 3:00–3:30 | 独立名单页面，保留全部四人 | Evidence confirmation, assessment revision and retention are different actions. This recorded retention is an automated synthetic rehearsal, not an actual human hiring decision. |
| 3:30–4:20 | 本地事实提示页 | Proposed employer-paid role-and-batch package. Time savings and evidence quality are not yet measured; the four-person study is prepared separately. |
| 4:20–5:00 | 本地技术/局限页 | Prepared fictional cases and rule-based analysis, no live model. Human calibration, real participant testing and official submission remain separate steps. |

实际讲者及分工维持展示组现有安排；本包不改 Slides 或指定替补讲者。

## 公网现场操作：先只读检查，业务写入由现场操作者选择

1. 电脑浏览器分别打开HR/Candidate，点击 **Refresh shared case**，确认四位身份及当前任务、提交、名单状态。核对英文和 **Human calibration pending** / 实际最新校准状态。
2. HR **Company & role → Compare candidates → Open Amy Chen → B3**。检查原文、Mark和贡献，不把公司任务数据与Amy旧项目数据混为一谈。
3. 仅在操作者决定使用共享服务器做真实写入且该人当前流程允许时：**Prepare task from B3 → Preview work brief → Continue to confirmation → Send task**。发送会改变其他访客看到的任务，不是本地草稿。
4. Candidate 刷新后 **My task → Start V1 draft**，使用 `materials.json` 的 V1与卡片。V1提交产生不可变正式快照；不要把填充文本说成候选人现场创作。
5. HR刷新，按实际需要点 **Run evidence analysis**（manual_simulation）→ **Needs More Evidence**，粘贴具体反馈。Candidate刷新，**Copy V1 public work into V2**，替换补证卡与摘要，提交V2。
6. HR刷新后查看V2与原始引用，可做一次终局 **Confirm evidence** 或不足审核；这不自动保存评分，也不自动保留。随后在 **Retained candidates** 单独填写真实操作者自己的理由/标签。**别把本包的自动化标签当真人姓名。**
7. 若上述状态已被其他访客推进、网络异常或时间不足，使用本地录像/截图讲解相同证明链；不重开旧审核、不清空公网库、不覆盖他人操作。

现有线上初始状态以主任务只读检查时间点为准，本包不锁定某人分数或业务状态。终端V2没有V3；完整现场操作留Q&A，不宣称50秒内完成20分钟任务。

## 本地复跑与恢复

前提：当前工作副本依赖及后端构建已在本次技术验收中完成。脚本只复用既有依赖。主运行端口为8916/6576/6586；与默认自动测试端口隔离。

[本机复跑命令留在内部交付包；公开版仅提供结果与使用说明。]

每次输出新的带时间戳目录，保留既有结果。`LATEST_RUN.txt` 指向最新运行，先核对该目录 `results.json` 的 `status`，失败运行不作最终通过证据。首次脚本定位错误及其失败日志留存，最终报告只引用成功轮次。

读取最新C0并启动独立可操作副本（全新目标库名；不会覆盖已存在路径）：

[本机复跑命令留在内部交付包；公开版仅提供结果与使用说明。]

默认新副本端口：API8917 / Candidate6577 / HR6587。Ctrl+C停止，仅关闭该进程，不清理或重置库。恢复到新库保留了阶段来源及不可变版本；C0/C1/C2通过项目现有维护CLI备份，恢复后逐人DTO相等。

试用原型组可附加 `--read-only`，此**专用本地副本**会拒绝POST并保留填写纸/记录表作为任务结果。它不改变网站产品权限；原型组与原材料组使用同一版本资料。技术试跑与真实4位参与者记录分别报告。

## 留给真人的最短事项

1. 从[真人阅读入口](HUMAN_READING_GUIDE.md)真正阅读40项/重点评分项并签收；需要调分时通过现有revision流程保存，再刷新/更新展示素材。
2. 在实际上台电脑、浏览器及网络做一次真人讲解计时；本包两次自动技术计时不替代这一步。
3. 找4位未参与开发者完成同材料试用，实际记录后再交展示组分析。本包没有省时、成本节省或录用准确率实测。
4. 展示组核对讲稿/Slides、组织规则、最终提交与回执。录像/截图交付不等于正式比赛提交。

---
公开交付副本：本次仅同步文档与媒体；本机路径、日志和数据库留在内部归档。产品基线 `b5d0568c71fd51f4f39f3eb506654861c1b59695`。真人签收、用户试用与比赛提交状态仍以实际记录为准。
