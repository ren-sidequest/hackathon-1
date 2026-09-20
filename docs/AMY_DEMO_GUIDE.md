# Amy Demo：只切换一次，约 2 分 20 秒

这是彩排时间分配，不是主办方规则的重新确认。建议 PPT 合计 4 分钟、Demo 2 分 20 秒、切屏与停顿留 40 秒，总计 7 分钟。PPT 超过 4 分钟时，先删减 PPT 或缩短演示，不能靠加快点按钮补时间。

**主线：明确能力缺口 → 候选人给出有来源的推理 → HR 核验证据并作出人工判断。**

现场从 Candidate 开始，再切一次 HR 结束。HR 发布任务提前做好，不在台上来回切三遍。

## 上台前准备（不计入演示）

1. 打开 Candidate，确认选择 **Amy Chen**。侧栏点 **Reset demo**，保留 **Ready for Candidate V1**，勾选共享影响确认，点 **Archive and restart demo**。这会归档并重置共享 Amy 案例；同伴不要同时操作 Amy。
2. 在 **My task** 点 **Start V1 draft**，进入 **Investigation**，点 **Fill demo draft**。确认四栏均为 `(1)`，Executive summary 非空。不要提前提交本轮 V1。
3. 每次 Create a card / Add card 会预填该栏尚未使用的样例，点 **Save card** 才保存。本次短演示不需要额外造卡，四张足够。每栏四个示例用完后，关闭预填开关才可手写；取消/删除的例子可再次使用。
4. 读一遍摘要和 Additional Evidence Needed 的第一张卡。HR 评语预先放剪贴板，见下文，省去现场打字。
5. 确认右上角 **Connected**。关闭通知；投屏比例先试好。演示从 **My task** 开始，已填草稿保留。结束一轮后重复第 1–2 步即可。

## 现场照表操作

第四列专门标明 HR / Candidate；只有第 5 行切换角色。

| 时间 | 屏幕操作 | 这一刻讲什么 | 所在端／页面 |
| --- | --- | --- | --- |
| 0:00–0:15 | 在 My task 展示 Conversion Drop Investigation，点 Continue V1 draft | “This is Amy. The reviewer needs more evidence of how she distinguishes competing explanations. She receives a focused task, rather than a general interview question.” | **Candidate／My task → Investigation** |
| 0:15–0:35 | 默认 Key Findings；指向已有卡片和左侧公司材料 | “Using the supplied data, Amy shows that visits increased, but orders and conversion fell. Her reasoning is linked to the source.” 不现场计算、不下载文件。 | **Candidate／Investigation** |
| 0:35–1:00 | 点 Hypotheses，再点 Additional Evidence Needed，停在第一张卡 | “Campaign mix and landing-page friction are hypotheses. She asks for matched campaign and device data: stable within-group rates support a mix explanation; falling rates suggest another problem.” 重点是不同结果如何改变判断。 | **Candidate／Investigation** |
| 1:00–1:15 | 点 Recommended Next Steps 快速指一下；滚动到摘要，点 Preview & submit V1，再点 Confirm V1 submission | “She recommends a measured next step and submits a reviewable work sample.” 等待提交成功，不连点。 | **Candidate／Investigation → Work & feedback** |
| 1:15–1:25 | 右下角 **Demo → Return to HR**；在 HR 侧栏点 **Tasks & review** | “Now the reviewer can inspect exactly what Amy submitted.” **这是现场唯一一次角色切换。** | **Candidate → HR／Tasks & review** |
| 1:25–1:50 | 阅读工作摘要；点 Investigation cards 或 View complete work，指向 Additional Evidence 的原文；若打开弹窗则关闭 | “The decision is supported by inspectable evidence. We can see the comparison she proposes and the uncertainty she still acknowledges.” 不声称这些预填文字是实时 AI 生成。 | **HR／Tasks & review** |
| 1:50–2:10 | 点 **Confirm evidence**，在 **Public review comment** 粘贴预备评语，点 **Save evidence review**，等成功状态 | “The reviewer confirms the evidence and records a reason. This does not automatically change the marks or make a hiring decision.” | **HR／Tasks & review** |
| 2:10–2:20 | 停留审核结果，交还 PPT | “EvidenceBridge makes the evidence and remaining gaps visible, while keeping the final decision with people.” | **HR／Tasks & review → PPT** |

**Investigation cards** 和 **View complete work** 均已核对实际代码；短演示选其中一个即可。

可复制的 HR 评语（读过并认同后再使用）：

> The submitted example separates observations from hypotheses and explains how matched campaign/device comparisons would distinguish the alternatives. The underlying cause remains unverified; confirm the reasoning evidence, not a causal claim or a hiring outcome.

## 为什么重点展示 Additional Evidence Needed

Amy 原申请材料的 B3 缺口是：提出需要 campaign/device 数据，但未充分解释不同结果会如何影响结论。该栏目最直接对应这个缺口。现在 Key Findings、Hypotheses、Recommended Next Steps 也有内容，形成完整推理；只是现场把最多时间留给 B3 的关键对比，不需要逐张读完。

无需另添材料。已有 business_context.md、website_traffic.csv、channel_comparison.csv、orders.csv、current_paid_search_devices.csv、product_catalog.csv 足够。缺失的历史设备细分、页面速度、checkout 事件应当作为“索取什么来验证”的内容，不能伪造成已拿到的数据。

## AI 如何讲，避免混淆

**Fill demo draft / 新建卡片预填是预写合成样例，不调用模型。**申请基线是预先制作的 AI-authored demo assessment，仍待人工校准；分数由固定规则计算。

分析入口在 **HR → Tasks & review → Run evidence analysis**，必须已有正式提交、尚未终审且服务可用。它从提交中提取带原文引用的观察；不是自动录用或自动评分。已成功的结果会显示分析详情与来源引文，展示时需按界面标注区分 live、replay、manual simulation。

2026-09-20 本次部署前已读取线上 capabilities：analysisMode = manual_simulation，界面标签 Rule-based simulation；当前按钮运行规则模拟，不能称为实时大模型调用。本次不改变分析模式。

本表为固定时间的证据闭环。如果组员要求实际展示 AI，把分析安排在人工审核之前：先点 Run evidence analysis，趁等待讲解卡片；在原定时间内返回结果才展示 **Analysis details and source quotations**，否则直接人工阅读并审核，不停在加载页。审核完成后不要再寻找运行按钮。正式上台前可另做一次分析彩排核对界面模式；切换真实模型属于另一个明确配置事项，本轮自动化测试不冒充真实模型质量验证。

## 需要从 HR 发布开始时

用 Reset demo 的 **Before HR sends a task**。HR 的 **Compare candidates → Amy → View full evidence → B3 → Prepare task from B3 → Preview work brief → Continue to confirmation → Send task**，再去 Candidate。这是完整练习路线；若还要返回 HR 审核，就至少切换两次，不适合作为这版 2 分 20 秒、一次切换的现场路线。

重置、填草稿和复制评语都属于上台前准备。同步和测试不放进现场流程；测试问答也不混入本指南。
