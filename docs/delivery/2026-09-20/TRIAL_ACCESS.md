# Prototype access and state integrity

> **用户最新状态更新（2026-09-20）：前端仍在修改，存在尚未跑通的流程和待修复问题。以下工程通过记录仅对应历史测试基线 b5d0568 及所列覆盖，不代表当前前端定稿或最终参赛验收。后端暂保持现状，待最终前端接入后联合验证。截图与录像仅是旧基线技术演练，暂不发布为最终素材；前端冻结后统一重录。真人复核、试用和比赛提交仍待真实记录。**

## Preferred controlled comparison: isolated C0

Use the demo package's C0 SQLite backup copied to a new **trial-only** database. The main rehearsal database and online state stay intact. Source commit/material hash must match this package. Dedicated suggested ports: API 8917 / Candidate 6577 / HR 6587. The demo package supplies its stage launcher; its executable path and verified command are linked in the final handoff once available. Never point a trial launcher at an existing production or main rehearsal database.

For the timed review task, navigate only to HR candidate/comparison/material views. All task outcomes stay outside the app in the response form. No send, submission, review or shortlist mutation is part of this trial. P3/P4 should begin with the same C0, and the facilitator records snapshot and initial visible comparison set. Raw condition uses `materials.html` from this same pack.

## Available desktop public demo: browse-only observation

The user confirmed a desktop browser and the deployed demo can be used. If isolated setup time is unavailable, an individual browse-only observation can use the existing HR page at <https://101.37.80.98/hr/>. This package makes no online request or write. Participant task answers are recorded in the external form, not in the app. The gateway allows shared public writes by other visitors, so a frozen baseline is not assumed.

Before each session, manually record the timestamp, commit/version information if visible, material sources, current scores, task/submission status and default comparison set. Confirm all four people and the same materials are present. If state/source content changes during the session, record the interruption and describe the run as uncontrolled usability observation, not an equivalent-condition timed comparison. Do not restore, reset or lock the public database to keep a demonstration story intact.

Public visitors need no sign-in for workflow actions, but this task only browses. Administrator maintenance remains separately protected. Do not enter, display or copy admin credentials into trial records.

## 已技术复测的启动命令

2026-09-20澳洲悉尼时间，本包实际恢复并检验了最终演示运行的C0；所有公开来源/原始PDF与本包一致，7个写端点均被本机只读模式阻止。下面每次使用全新目标路径，离开后按Ctrl+C关闭服务：

[本机复跑命令留在内部交付包；公开版仅提供结果与使用说明。]

HR：<http://127.0.0.1:6587/?candidateId=amy-chen#comparison>；Candidate：<http://127.0.0.1:6577/>；API：<http://127.0.0.1:8917/>。只读模式是学习副本的临时保护，不改变公开访客的产品权限。启动器沿用已安装Node与项目依赖，不自动安装依赖，不改线上。

主讲C0保持原样；技术测试库留在 `technical-fixture/study-readonly-final.sqlite` 作为证据，不重复当新实验库。原型版本或原文变更时，先重新生成同源包/复核reference再招募；不要让两个条件跨内容版本。

---
阶段性文档副本：本次仅推送文档审阅PR，媒体与服务器发布暂缓；本机路径、日志和数据库留在内部归档。产品基线 `b5d0568c71fd51f4f39f3eb506654861c1b59695`。真人签收、用户试用与比赛提交状态仍以实际记录为准。
