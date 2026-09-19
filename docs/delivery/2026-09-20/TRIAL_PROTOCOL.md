# Facilitator protocol — version 1

> **用户最新状态更新（2026-09-20）：前端仍在修改，存在尚未跑通的流程和待修复问题。以下工程通过记录仅对应历史测试基线 b5d0568 及所列覆盖，不代表当前前端定稿或最终参赛验收。后端暂保持现状，待最终前端接入后联合验证。截图与录像仅是旧基线技术演练，暂不发布为最终素材；前端冻结后统一重录。真人复核、试用和比赛提交仍待真实记录。**

**状态：准备完成、未实测。真人记录空白。** 依据：总方案 §11–13、§18 与六项收尾方案第4项。研究对象为准备好的证据报告辅助审阅，不是实时AI提取、招人准确率或真实雇主效果。

## Before recruitment

1. Freeze source commit/material hashes and a separate clean C0 prototype state for this study. Check all four people and all 13 source documents are accessible. Both conditions receive the identical `materials.html`; no work sample is restricted to the prototype condition. PDFs remain unchanged; contact-minimised extracts supplement, not replace, them.
2. A real human reads `reference-checklist.json`, the cited passages and `SCORING.md`, records the calibration fields in that file, and agrees the omission rules before first participant exposure. The assistant's reference is provisional; `human_calibration.status` remains pending until this happens. A pending reference allows setup/technical rehearsal, not an assertion of calibrated human study results.
3. Recruit four consenting classmates who did not develop the product. Do not relabel agents, developers or employers as eligible classmates. Assign anonymous volunteer IDs (e.g. V1–V4); keep any contact list outside this package. Record prior hiring/data experience and prior prototype exposure in `records/human/background.json`. No need to collect protected attributes.
4. Block randomisation: agree a public integer seed before opening results, sort experience bands, pair adjacent experience levels, randomly allocate one raw and one prototype volunteer in each pair. Run `trial.py allocate --seed INTEGER`. This maps anonymous volunteers to P1/P2 raw and P3/P4 prototype; P1 is not automatically the first recruit. Save the resulting assignments; do not re-randomise to obtain a desired balance. If ties exist, seeded shuffle decides. Record residual differences; n=2 per group does not establish balance.
5. Prefer the same laptop/browser/room and individual sessions. If devices or adjustments differ, document them and preserve real elapsed time. No participant should see another participant's answer. One fixed task; no crossover or learning-effect claim. Facilitator order may alternate raw/prototype (P1, P3, P2, P4).

## Neutral two-minute orientation (identical timing)

Read the brief aloud or allow reading. Demonstrate browser/PDF search on the brief, not candidate evidence. Show where answers are written. For prototype, show navigation affordances without opening candidate results; for raw, show file navigation without opening source contents. Explain that preparation differs between conditions. Do not teach the meaning of NE before the timed task; the post-task question checks interpretation. A participant may read definitions already in the prototype.

## Timed session

- Fill eligibility, consent, facilitator and environment in that participant's JSON. Record manifest SHA-256, C0 snapshot, code commit, device/browser, prototype URL for prototype condition and network notes. Keep output outside the prototype; no main demonstration or online state changes.
- Start with `python3 scripts/trial.py timer P1` (change ID). Reveal the materials/prototype at the first “Clock running” line. Record disclosure/opening lag as an interruption if material access is delayed.
- The clock includes all reading, searching, source verification, deciding, writing, technical delays and facilitator help. Never silently subtract a delay. Say only neutral navigation responses, e.g. “The source library is in the candidate view.” No evidence interpretation or candidate recommendation. Enter `help <what was asked and answered>` or `interrupt <reason>`; log multiple events separately.
- At the participant's “Done”, enter `done`. At 20 minutes the script automatically marks timeout. Enter `stop <reason>` if the person withdraws or a technical issue ends the session. Preserve partial answers. If the CLI is force-closed, `in_progress` is retained; record an incident and missing elapsed time instead of inventing completion. Do not rerun that record as though it were a first exposure.
- `completed` means the participant declared completion. Analysis additionally requires two distinct candidates, two cited reasons each and one unknown each; missing components are displayed and excluded from completed-task timing summaries. A wrong citation is still a cited response, then fails content coding rather than being silently discarded.
- Copy the participant's wording faithfully into `choices`; use additional statement-level coding rows for compound claims. Do not rewrite a weak answer. Save the contemporaneous note separately if helpful. Mark candidate pages opened, actual initial comparison set and outside-set exploration from observation, not from guessed UI defaults.
- After the timer, ask the four post-task questions in the brief. Observed wrong NE usage during the task and a wrong post-task explanation are distinct events, labelled by phase; do not multiply one repeated phrase into several events. Record exposure opportunities; “did not see NE” is not a misread.

## Coding and reporting

Use `SCORING.md`. A human codes all records against the frozen source checklist, before group comparison. A second person checks disputed judgements and all alleged critical omissions; log disagreement instead of silently forcing consensus. It is acceptable to leave pending/null fields when evidence is missing. Record coder name only when they actually did the work. The agent's technical self-test does not populate these fields.

Report individual times, timeouts, missingness, counts/denominators, background and help. No prescribed candidate pair. Check exploration of people outside the actual default comparison set; report observed exploration rather than rewarding any particular selection. Include the full cost ledger: manual report preparation, maintenance, configuration, review and coordination. Costs already included inside participant timing stay inside it once. Shared preparation is recorded once and not allocated twice.

Run analysis only after saving records. With no sessions the result stays “准备完成、未实测”; percentage savings are never generated. With 1–2 sessions, report qualitative usability observations and individual data only. Four sessions remain a small convenience sample, not a causal comparison. A successful technical run says nothing about recruitment effectiveness or willingness to pay.

Real-company interviews and one consented, appropriately de-identified role/batch pilot remain post-hackathon work.

## 可用人员是项目团队时（用户最新现场条件）

用户与其他4位同学可阅读演示，但“未参与开发”尚未确认。先问背景，不按人数推断独立性。若参与实现、编写材料/评分、展示准备或已熟悉参考答案，标记实际角色与接触程度，转入**团队内部形成性观察**，记录在 `records/team`，使用 `trial.py timer P1 --team-observation` / `trial.py analyze --team-observation`。这些记录单独报告，不计入4位独立非开发同学设计，不与独立组混算，不给效应数字。仍可执行相同任务发现导航/文案误解；熟悉答案的影响必须披露。填写资格为实际 true/false，不为运行而填 true。独立研究记录继续空白，招募完成后另做。

当前桌面公网也可只读浏览，避免新增部署：开始前刷新并记录真实时间点状态/版本，四人来源及所有文件应可访问，使用外部响应表；不要点 Send / Submit / Review / Retain / Save。共享状态若发生访客变化，记录事件、结束该次比较或降级为个体可用性观察，不将不同初始状态视为受控比较。更严格的组间比较优先用隔离C0，详情见 `PROTOTYPE_ACCESS.md`。

---
阶段性文档副本：本次仅推送文档审阅PR，媒体与服务器发布暂缓；本机路径、日志和数据库留在内部归档。产品基线 `b5d0568c71fd51f4f39f3eb506654861c1b59695`。真人签收、用户试用与比赛提交状态仍以实际记录为准。
