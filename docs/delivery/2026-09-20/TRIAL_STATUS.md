# 第4项：最小形成性测试执行包

**最终状态：准备完成、未实测。独立参与者 0；团队观察参与者 0。**

这是一套已生成材料、可执行计时与分析工具、已做技术自测的执行包，不是真人测试结果。技术 fixture 和真人记录分目录；真人背景、答案、计时、编码、签名均空白。真正的企业试点仍在赛后。

## 已交付

| 文件 | 内容/状态 |
|---|---|
| `materials.html` | 离线正常阅读入口；18个源文件链接、13份可搜索正文（1JD+4CV+8附件）。两组同等来源，不隐藏资料。 |
| `materials/` + `materials-manifest.json` | 1份原始JD PDF、4份原始CV PDF、8份合成附件、5份便于阅读的文本；逐文件复制并核对SHA-256。来源基线 `b5d0568c71fd51f4f39f3eb506654861c1b59695`；`harbour-retail-applications-v1`。 |
| `PARTICIPANT_BRIEF.md` | 全英文任务、同等正常搜索条件、20分钟统一时限、外部答题表与事后问题。 |
| `facilitator/PROTOCOL.md` | 招募资格、背景记录、分层随机分配、计时/帮助/中断/超时、编码和报告顺序。 |
| `facilitator/SCORING.md` | 引用正确/全部判断、条件化关键遗漏、NE误读/暴露机会的定义和分母；没有正确入选人。 |
| `facilitator/reference-checklist.json` | 12条源文定位及边界；内容复核agent已交叉核查；**human calibration pending**，不是评分真值。 |
| `facilitator/PROTOTYPE_ACCESS.md` | 独立C0只读技术环境，或用户已确认的桌面公网只读观察；不影响主讲/线上数据。 |
| `records/human/P1–P4.json` | 独立非开发同学原始记录空白：P1/P2原材料、P3/P4原型。匿名背景及分配文件同目录。 |
| `records/team/P1–P4.json` | 参与实现/熟悉项目者的单独观察记录空白；不计入独立研究，也不与其混算。 |
| `records/overhead-ledger.json` | 配置、预置报告制作维护、额外复核/协调与假设费用，空白待记；已经在计时内的成本不重复计入。 |
| `scripts/trial.py` | 标准库Python：哈希复核、随机分配、实际计时/事件/超时、分析。无会话就不产省时数字。 |
| `scripts/test_trial.py` | 可重跑技术单测；技术fixture不混入真人。 |
| `results.json` / `team-observations.json` | 当前真实状态的空数据报告：准备完成、未实测。 |
| `technical-fixture/` | 工具单测、只读环境、浏览器截图/结果；仅技术验证，非参与者证据。 |

## 最短执行顺序

[本机复跑命令留在内部交付包；公开版仅提供结果与使用说明。]

1. 招募者问是否参与实现/准备内容/已熟悉答案，记录背景。真正独立的四人填 `records/human/background.json`；项目团队只做 `records/team` 观察。用户+其他4同学“可以阅读”不等于4位非开发者已就位。
2. 一位真人先看参考清单及原文，记录其真实复核；必要争议请第二人看。此次脚本/agent检查不替代这一步。
3. 独立四人背景完整后，用预先约定seed执行分配，例如 `python3 scripts/trial.py allocate --seed 20260920`。这里示例seed不是已经实施的随机分配；生成后保留，不重复挑选分组。
4. 两组都打开 `materials.html`。原型组用同基线的隔离C0；若用公网，则按访问说明记录实时状态，只浏览。准备独立答题纸/Markdown；不把答案保存到app。
5. 逐一完成英文brief、两分钟中立导览，填实际资格/同意/设备/版本/主持人字段；运行 `python3 scripts/trial.py timer P1` 并展示材料。输入 `help 原话与答复` / `interrupt 原因` / `done`；时限自动标timeout。依次P1、P3、P2、P4。后台自动计时需保持终端输入打开。
6. 团队观察改用 `python3 scripts/trial.py timer P1 --team-observation`，实际参与实现状态照实填，别为通过独立资格检查填true。
7. 原话转录答案，按规范逐statement编码出处、未知、条件化遗漏、NE暴露/误读；不改写参与者答案，不给选择二人的准确率。补计时之外的成本。
8. `python3 scripts/trial.py analyze`；团队单独 `python3 scripts/trial.py analyze --team-observation`。检查个体缺失值/超时，向展示组交原始匿名记录与摘要。少量记录只讲观察，不算提升百分比。全部为空就继续“准备完成、未实测”。

## 招募短消息（可直接转发）

> 想请4位未参与EvidenceBridge开发/材料与演示准备的同学做一次约25分钟的小测试：看同一岗位的4份虚构CV和8份合成作品，选2位继续了解，并写依据和待确认点。会匿名记时间与困难，不评测你，也不是实际招聘。请先回复是否参与过本项目、是否看过材料/答案，以及数据分析或招聘相关经验。若你参与过项目，也欢迎做单独的团队内部可用性观察，我们会明确区分。

## 给展示组的当前事实句

> **Savings have not yet been measured; the next pilot will compare review time and evidence quality.**
>
> The trial package is ready: the same fictional JD, four CVs and eight synthetic work samples are available to both conditions. No participant sessions have been recorded. Technical checks are not user validation. The prototype contains prepared, AI-authored assessments with human calibration pending and uses manual rule simulation, not a live model.

若现有5人都是项目团队，称 `Team-internal formative observation`；经资格筛选的非开发同学称 `Internal formative study with classmates using synthetic materials`。两者都不是客户案例/真实雇主试点。请不要在PPT把准备完成写成效果验证完成。

## 本轮实际技术验证

详见 `TECHNICAL_VERIFICATION.md`：13项Python自测、18份文件hash、19项隔离只读API校验及桌面浏览器检查通过。初轮启动器错误已保留记录并修复重测；这些计数仅是本包本轮技术执行，不是真人结果。

## 真人剩余事项

- 确认4位非开发同学资格并实际招募；若只有项目团队，按团队观察执行并披露。
- 实际主持/记录，真人复核参考清单与参与者回答；原始记录回传后再分析。
- 展示组使用真实个体数据和局限；真实企業单岗位试点留在赛后。

---
公开交付副本：本次仅同步文档与媒体；本机路径、日志和数据库留在内部归档。产品基线 `b5d0568c71fd51f4f39f3eb506654861c1b59695`。真人签收、用户试用与比赛提交状态仍以实际记录为准。
