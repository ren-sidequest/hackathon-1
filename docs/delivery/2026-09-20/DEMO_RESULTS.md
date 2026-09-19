# 第2项实际执行摘要

- 结果：**passed**。版本：`b5d0568c71fd51f4f39f3eb506654861c1b59695`；`final-day-demo-v1`。
- 开始UTC：2026-09-19T17:35:12.640Z；结束UTC：2026-09-19T17:51:20.169Z。
- 源码、依赖、Git提交/推送、线上发布/数据库写入：本子任务均未执行。
- 真实本地跨端：Amy BPS V1→More→V2→Confirm→独立名单；Ann SQL和David DA各自发送→提交→规则分析→终局审核。
- 所有 application assessment 与原始快照逐对象相等；未写human assessment；评分仍为预编写基线。名单及业务审核均有明确SYNTHETIC自动演练文案。
- 产物：24张截图；4份命名WebM录像；C0/C1/C2三份项目维护CLI备份及JSON来源快照。未交付MP4，无旁白音轨。
- 可用录像：本地离线HTML实播，网络禁用，实际推进至0.373秒，1440×1000，媒体时长343.200秒。
- 时间口径：两次脚本墙钟分别300.004秒/300.006秒；原始技术录像媒体时长343.20秒/342.36秒。二者不同，保留原录制，不假定差值来源、不剪辑或加速冒充原始五分钟片段。
- 归档可移动性：已在另一新目录解压，以网络禁用的Chromium验证24图片完整、4视频实播与seek、HTTP请求0、ZIP完整性通过；明细为本目录OFFLINE_VERIFICATION.json（单独交付，非同包自证）。
- 浏览器未捕获未处理JS错误：0。

## 逐项实测

| 检查 | 结果 |
|---|---|
| Fresh isolated four-person API4 with manual_simulation and no submissions | pass |
| Amy B3 exact original-source quotation and unchanged baseline | pass |
| Draft survives full page reload | pass |
| Injected local network error preserves draft and explicit error; refresh recovers | pass |
| Amy BPS cross-end V1 -> rules analysis -> precise More feedback -> V2 available | pass |
| V2 terminal confirmation preserves V1, scores and separate not-retained state | pass |
| Both immutable versions accessible from Candidate and independent retain recorded with synthetic operator label | pass |
| ann-li sql actual HR send / Candidate submit / HR rules analysis / terminal review; no score or shortlist change | pass |
| david-liu data-analysis actual HR send / Candidate submit / HR rules analysis / terminal review; no score or shortlist change | pass |
| SQLite service restart preserves final state | pass |
| CLI backup and restore to new isolated path verifies every candidate DTO | pass |
| 390x844 Chromium emulation opens hr/comparison | pass |
| 390x844 Chromium emulation opens hr/evidence | pass |
| 390x844 Chromium emulation opens candidate/application | pass |
| All four pre-authored assessments and pending calibration retained; no human assessment writes | pass |
| No uncaught browser runtime errors in supplemental flow | pass |
| Local WebM recording plays and advances with browser offline | pass |

以上17个脚本检查点不是另计为单元测试套件条数；原始结果包含每个检查的细节。390×844只是附加模拟，不称实体手机或台上设备验收，用户现场仅电脑。

## 两次完整计时技术演练

### 第1次
- 总时长：300.004秒；无真人语速/讲者签收；无声。
- 录像：`[LOCAL_ARCHIVE]`

| 计划秒 | 实际开始 | 实际结束 | 切屏/证明点 |
|---:|---:|---:|---|
| 0 | 0.002 | 0.002 | SME problem, payer and Harbour Retail JD |
| 45 | 45.002 | 45.143 | JD to 10 criteria; NE and scope |
| 80 | 80.002 | 80.232 | Four candidates, pending calibration, no auto elimination |
| 108 | 108.003 | 108.149 | Amy B3 original quotation and bounded contribution |
| 130 | 130.001 | 134.192 | Preloaded C1: submitted V1 and precise feedback |
| 151 | 151.001 | 154.000 | Preloaded C2: V2 response, not a live twenty-minute task |
| 171 | 171.002 | 171.934 | Version-bound rules analysis and evidence review |
| 180 | 180.001 | 180.086 | Independent synthetic retention; all candidates stay visible |
| 210 | 210.004 | 210.099 | Differentiation, proposed package and unmeasured trial method |
| 260 | 260.004 | 260.017 | Actual architecture, rule simulation, limitations and next steps |
| 300 | 300.002 | 300.003 | Five-minute technical rehearsal end |

### 第2次
- 总时长：300.006秒；无真人语速/讲者签收；无声。
- 录像：`[LOCAL_ARCHIVE]`

| 计划秒 | 实际开始 | 实际结束 | 切屏/证明点 |
|---:|---:|---:|---|
| 0 | 0.001 | 0.001 | SME problem, payer and Harbour Retail JD |
| 45 | 45.002 | 45.088 | JD to 10 criteria; NE and scope |
| 80 | 80.001 | 80.162 | Four candidates, pending calibration, no auto elimination |
| 108 | 108.002 | 108.172 | Amy B3 original quotation and bounded contribution |
| 130 | 130.000 | 133.161 | Preloaded C1: submitted V1 and precise feedback |
| 151 | 151.001 | 153.565 | Preloaded C2: V2 response, not a live twenty-minute task |
| 171 | 171.001 | 171.922 | Version-bound rules analysis and evidence review |
| 180 | 180.000 | 180.073 | Independent synthetic retention; all candidates stay visible |
| 210 | 210.001 | 210.101 | Differentiation, proposed package and unmeasured trial method |
| 260 | 260.003 | 260.020 | Actual architecture, rule simulation, limitations and next steps |
| 300 | 300.004 | 300.004 | Five-minute technical rehearsal end |

## 状态快照

- **C0**：Amy task=draft, versions=0, shortlist=not_retained；application ai_authored，82.5%。
  - 数据库：`[LOCAL_ARCHIVE]`
  - 逐人API：`[LOCAL_ARCHIVE]`
- **C1**：Amy task=awaiting_revision, versions=1, shortlist=not_retained；application ai_authored，82.5%。
  - 数据库：`[LOCAL_ARCHIVE]`
  - 逐人API：`[LOCAL_ARCHIVE]`
- **C2**：Amy task=reviewed, versions=2, shortlist=retained；application ai_authored，82.5%。
  - 数据库：`[LOCAL_ARCHIVE]`
  - 逐人API：`[LOCAL_ARCHIVE]`

C2中Ann SQL、David DA已完成补充回归；Jamie保持初始流程。C0/C1/C2不是新快照产品功能，仅本地已有维护工具备份。恢复均用全新目标库，服务关闭后备份，不访问线上。

## 诚实记录首次失败

首次运行`2026-09-19T17-33-08.430Z`在末尾校准标签验证使用了过严格exact匹配，标签实际存在于组合文案中。已只修本包定位器为body包含；从新库完整重跑并通过。首次日志与失败JSON保留，不混入成功计数。未修改产品来迁就断言。

同一成功跨端运行的首次计时片段在C1→C2切换后冗余选择默认V2时遇到脚本定位竞态；改为刷新并等待默认V2，保留results-before-timed-retry.json及EXECUTION-timed-attempt1.log。以下两次完整计时为重新从0秒执行的实测，不将失败片段称为完成。

试用只读helper初版漏响应schema必填retryable，部分写操作保护显示500；输出目录脚本补retryable:false后，由独立trial agent从新C0库复测7类真实POST均为403（独立19项通过）且comparison前后一致，详见../trial/technical-fixture/read-only-check.json。应用源码未变。

## 未完成真人事项

- 人工阅读与校准签收；如保存新评分，应重新生成相关素材。
- 实际台上电脑/浏览器的真人旁白与切屏彩排。
- 四位未参与开发者实际试用与原始记录。
- Slides/讲稿最终合稿及主办方规则确认、正式提交回执。

当前网页已部署事实由主任务在线只读报告证明；本包没有发布新代码，也没有在公网发送任务、提交、审核或保留。

---
公开交付副本：本次仅同步文档与媒体；本机路径、日志和数据库留在内部归档。产品基线 `b5d0568c71fd51f4f39f3eb506654861c1b59695`。真人签收、用户试用与比赛提交状态仍以实际记录为准。
