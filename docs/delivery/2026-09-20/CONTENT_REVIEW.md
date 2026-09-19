# EvidenceBridge 四人 40 项：独立助手内容复核

> **用户最新状态更新（2026-09-20）：前端仍在修改，存在尚未跑通的流程和待修复问题。以下工程通过记录仅对应历史测试基线 b5d0568 及所列覆盖，不代表当前前端定稿或最终参赛验收。后端暂保持现状，待最终前端接入后联合验证。截图与录像仅是旧基线技术演练，暂不发布为最终素材；前端冻结后统一重录。真人复核、试用和比赛提交仍待真实记录。**

**2026-09-20｜助手已逐项阅读 40/40；真人已签收 0/40；Human calibration pending。**

本报告是本次助手的只读语义审阅及程序验证，不是新评估revision、真人批准或招聘效果证明。原40项真人表保持原样。评分标准已在 HR 端可见；下列“重点复核／解释边界”是帮助实际读者应用同一标准，不是标准缺失、算分故障或必须改分才能演示。

## 1. 基线、范围与结论

- 基线：`b5d0568c71fd51f4f39f3eb506654861c1b59695`；只读工作副本 final-day-closeout（本地证据归档／不随公开包发布）；同副本当前分支由主协调任务管理。
- 版本：`harbour-retail-applications-v1` / `harbour-retail-junior-analyst-rubric-v1` / `harbour-retail-junior-analyst-jd-v1` / `harbour-retail-2026-09-v1`；4人初始申请评估revision 1。
- 实读：四份公开CV全文、原CV提取文本与PDF、八份合成作品、JD四页、40条support/gaps/rationale/uncertainty/nextStep、十标准锚点、评分代码及来源构建逻辑。五份PDF八页已渲染并可视核对，正文可读，人物/项目/日期与提取文本一致。
- **本轮没有发现确定性的引文、归属、哈希或分数计算阻断；主讲 Amy B3=2 与原文及2分锚点直接吻合。** 所有基准分数保留，零线上/数据库写入，零human revision、零真人签名。
- 重点解释边界：Amy静态SQL满分；Ann S2与B3；David S3；Jamie B3。Ann D3的4分也明确限于书面程序与准备算例，未扩大成已复现模型实验。这些范围选择留给同一名实际阅读者确认，不要求第二人假签。
- 适用完成度：助手语义复核完成；确定性来源/算术检查通过；真人校准待做。已有工程历史计数不计为这次重跑。

## 2. 本次实跑证据（与语义判断分开）

| 实际检查 | 结果 | 范围 |
|---|---:|---|
| 清单SHA-256与大小 | 27/27 | 当前版本声明的内容文件 |
| 原PDF页数＋内容提取 | 5/5文件、8页 | 逐页文本去空白后与保存提取对应；原件哈希对照 |
| 独立快照指纹 | 4/4 | Python排序键规范JSON独立重算，而非复用后端验证函数 |
| 引文所有权/UTF-16/位置 | 145/145 | **29个评分引文＋116个JD对照引文**；不是145个评分项 |
| 核心评估字段/范围 | 40/40 | 29个数值项有本人正向引文；11个NE有全3份材料检查范围与缺证理由 |
| 独立算分 | 4/4 | 40项贡献、技能、累计、覆盖与整体null；NE不重归一化 |
| JD原句/页码定位 | 19/19 | 76行JD矩阵引文结构通过；本报告不宣称76行已全部重新人工语义校准 |
| 候选人书面算例 | 3组通过 | Amy渠道率、Ann cohort/分配、Jamie互动/粉丝/预算 |
| 公司任务资料 | 6份一致 | 5 CSV下载=展示行列；两期总量及当期Paid Search设备分区对账 |
| 当前fixture生成审核 | 通过 | `generate-audit.mjs --check`本轮重跑 |

检查机器结果：deterministic-checks.json（本地证据归档／不随公开包发布）；完整日志：verification.log（本地证据归档／不随公开包发布）；生成器本次日志：generate-audit.log（本地证据归档／不随公开包发布）。

重跑（源文件保持只读，输出写本报告目录）：

[本机复跑命令留在内部交付包；公开版仅提供结果与使用说明。]

该脚本读取已构建后端；主协调任务负责本版build。PDF视觉检查与语义判断由本助手完成，未将它们列成程序断言通过。原SQL运行、模型训练/推理、真实就业/学历核验和人工校准均未执行。

## 3. 十项标准与同一应用范围

固定权重SQL/DA/BPS=30/30/40，是团队demo政策，不是JD提供的招聘成功率。4/2/0锚点见 [rubric.ts](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/src/r5/rubric.ts) 第13–42行；3/1/NE含义见同文件第53–59行；计算实现见 [scoring.ts](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/src/r5/scoring.ts) 第23–64行。

| 项 | 本次逐项检查问题 | 4、2、NE的应用边界 |
|---|---|---|
| S1 | 粒度、聚合/连接、重复风险是否匹配问题？ | 不为复杂join加分；任务不需要时不强制join。 |
| S2 | 窗口、组、比较对象与代码是否一致？ | 单快照是否构成部分可审时序是Ann解释边界；缺比较不自动是错误。 |
| S3 | 适用检查是否可操作且有预期结果？ | 当前标准明确允许静态检查；执行日志是未验证项，不选择性追加门槛。 |
| D1 | 分母、单位、期间和数字能否复算？ | 小型算例也能充分支持，但不等于完整工作交付。 |
| D2 | 比较是否超出总量复述且处理权重/重叠？ | 准备基线/比较方案的支持弱于已观测比较结果。 |
| D3 | 计算依据、来源与局限是否明确？ | 书面程序可审，不宣称模型运行或原始导出已重现。 |
| B1 | 是否明确业务决策、问题与现实约束？ | 不从公司共同任务替个人历史项目补决策。 |
| B2 | 事实、假设、原因及竞争解释是否分开？ | 谨慎因果措辞加缺竞争解释可解释3，并非默认4。 |
| B3 | 请求具体吗；如何比；不同结果说明什么？ | Amy具具体请求但缺后两项=2；Ann技术证据范围、Jamie弱尝试由真人解释。 |
| B4 | 行动、顺序、理由与验证是否相连？ | 合理第一步支持2；不强制初级角色承担高级战略责任。 |

0必须有可见明确问题，本基准没有0。NE表示对该criterion的作品不足，已审不等于分数完整。待评与NE分开。

## 4. 40项逐项助手结果

每行都阅读了该人的CV及两份作品，不只看短引文。表中路径/行号给阅读定位；机器JSON保留每项原始判断、sourceId、location、UTF-16 start/end、快照及指纹。NE行的路径是缺证范围上下文，不伪装成证明“缺能力”的正向引文。所有行仍待真人实际阅读后签收。

### Amy Chen

已检查全部来源：[cv-public.txt](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/amy-chen/cv-public.txt)；[channel_analysis.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/amy-chen/channel_analysis.md)；[channel_analysis.sql](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/amy-chen/channel_analysis.sql)。

| 项/原Mark/贡献 | 助手结论及理由 | 限制 | 建议 | 原文定位 |
|---|---|---|---|---|
| S1 / 4 / 10/10 | **静态范围支持**：一行一个期间×渠道；按相同粒度聚合，无额外join，重复检查预期零行，4分符合冻结静态范围。 | 上游表约束、实际运行和个人独立完成均未验证。 | 真人确认全员同用静态尺度；操作性使用前看源表及重复检查输出。 | [channel_analysis.sql](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/amy-chen/channel_analysis.sql) 第4–5行<br>[channel_analysis.sql](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/amy-chen/channel_analysis.sql) 第4–24行 |
| S2 / 4 / 10/10 | **静态范围支持**：两个相邻不重叠四周窗口、DATE过滤和period/channel分组一致，可按结果重建两期比较。 | 查询信任预置period_start；原始时间戳归期质量未验证。 | 暂保留4；不要把满分解释为生产查询或时间映射已执行。 | [channel_analysis.sql](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/amy-chen/channel_analysis.sql) 第6–6行<br>[channel_analysis.sql](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/amy-chen/channel_analysis.sql) 第4–16行 |
| S3 / 4 / 10/10 | **静态范围支持**：重复、空/负值、零分母、总量对账和上游边界均有检查指向；预期行为清楚，符合4分静态检查锚点。 | 注释是拟议检查而非测试输出；并非所有检查均给出完整可运行SQL。 | 暂保留4；与David同尺度看方法与预期，若要求运行证明应另行统一校准。 | [channel_analysis.sql](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/amy-chen/channel_analysis.sql) 第18–24行 |
| D1 / 4 / 10/10 | **支持原Mark**：4,000→5,000和200→225可复算25%/12.5%；5%→4.5%为-0.5百分点、-10%相对。 | 基于合成准备表；未验证原交易/导出。 | 保留4；展示原整数和分母，不与公司百万级任务混用。 | [channel_analysis.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/amy-chen/channel_analysis.md) 第21–23行<br>[channel_analysis.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/amy-chen/channel_analysis.md) 第9–28行 |
| D2 / 4 / 10/10 | **支持原Mark**：渠道率、Paid Search权重变化及总量加权齐备，明确防止直接平均率与重复计数。 | 描述性渠道比较不等于campaign归因或因果识别。 | 保留4；若要解释变化，追加同口径细分而不是从描述直接归因。 | [channel_analysis.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/amy-chen/channel_analysis.md) 第24–26行<br>[channel_analysis.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/amy-chen/channel_analysis.md) 第24–28行 |
| D3 / 4 / 10/10 | **有限范围支持**：准备数据、公式和期间使书面算例可复算，原始导出及时间映射的缺失被披露。 | 4分仅覆盖这份小算例的可复核性，不是完整独立数据项目验证。 | 保留4与现有边界；缺失原始记录继续显式说明。 | [channel_analysis.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/amy-chen/channel_analysis.md) 第28–28行<br>[channel_analysis.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/amy-chen/channel_analysis.md) 第6–28行 |
| B1 / 2 / 5/10 | **支持原Mark**：发现转化下降但订单增加，并建议看付费流量构成；未明确要作什么业务决策及现实约束，符合2。 | 公司共同任务的预算问题不属于Amy这份历史项目。 | 保留2；请求补一句决策目标及可用分析时间，避免借用公司任务补足。 | [channel_analysis.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/amy-chen/channel_analysis.md) 第31–31行<br>[channel_analysis.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/amy-chen/channel_analysis.md) 第30–31行 |
| B2 / 3 / 7.5/10 | **支持原Mark**：观察与campaign-mix假设分离且否认已证明因果；缺竞争解释，3较4更准确。 | 因果谨慎本身不是完整区分性推理。 | 保留3；补一个具体竞争解释及尚未排除的范围。 | [channel_analysis.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/amy-chen/channel_analysis.md) 第31–31行<br>[channel_analysis.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/amy-chen/channel_analysis.md) 第30–31行 |
| B3 / 2 / 5/10 | **主讲依据明确**：明确请求同两期campaign/device，但未给比较方法或相反结果含义；与2分锚点直接相符，贡献5/10。 | 没有历史设备比较或任何判别结果；本次助手意见仍不是真人签收。 | 建议保留2；反馈点聚焦同口径比较及不同结果支持/削弱何种解释。 | [channel_analysis.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/amy-chen/channel_analysis.md) 第31–31行 |
| B4 / 2 / 5/10 | **支持原Mark**：解释推广前先看流量构成是一项相关第一步；缺后续顺序及推荐结果验证，符合2。 | 不将一句谨慎请求补写成完整业务行动计划。 | 保留2；补比较之后的行动和如何检查效果。 | [channel_analysis.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/amy-chen/channel_analysis.md) 第31–31行<br>[channel_analysis.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/amy-chen/channel_analysis.md) 第30–31行 |

### Ann Li

已检查全部来源：[cv-public.txt](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/ann-li/cv-public.txt)；[churn_method_note.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/ann-li/churn_method_note.md)；[cohort_extract.sql](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/ann-li/cohort_extract.sql)。

| 项/原Mark/贡献 | 助手结论及理由 | 限制 | 建议 | 原文定位 |
|---|---|---|---|---|
| S1 / 4 / 10/10 | **静态范围支持**：customer×snapshot粒度、单快照过滤及唯一客户检查匹配；此提取无须join或聚合，4合理。 | 特征生成和真实表约束不在片段内；复杂模型名不加分。 | 保留4；检查上游表定义后才作运行保证。 | [cohort_extract.sql](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/ann-li/cohort_extract.sql) 第4–4行<br>[cohort_extract.sql](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/ann-li/cohort_extract.sql) 第4–18行 |
| S2 / 2 / 5/10 | **重点复核：解释边界**：已有as-of过滤、特征截止与未来标签时序，可支持宽读2分；未实现期间/组间比较及标签窗口审计，严格读可为NE。 | NE表示片段不足，不表示时序错误；CV更广泛的SQL声称不替代作品。 | 本届按现有“有查询但边界不完整”锚点保留2可解释；真人需确认此口径是否涵盖单快照。 | [cohort_extract.sql](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/ann-li/cohort_extract.sql) 第5–6行<br>[cohort_extract.sql](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/ann-li/cohort_extract.sql) 第4–18行 |
| S3 / 3 / 7.5/10 | **支持原Mark**：行数/类别数、唯一性、标签域和fold-local缺失处理均具体；缺失值检查方法及窗口审计不全，3合理。 | 预期计数是合成值，不是检查执行结果。 | 保留3；补关键检查SQL与预期输出，继续披露未运行。 | [cohort_extract.sql](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/ann-li/cohort_extract.sql) 第15–18行<br>[cohort_extract.sql](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/ann-li/cohort_extract.sql) 第13–18行 |
| D1 / 4 / 10/10 | **支持原Mark**：6,750+38,250=45,000；15%正类、85%多数类准确率和零召回区分正确。 | 这是新编cohort算例；.82 AUC是另一个实习CV声称。 | 保留4；演示避免把.82挪到capstone或当岗位匹配率。 | [churn_method_note.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/ann-li/churn_method_note.md) 第18–18行<br>[churn_method_note.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/ann-li/churn_method_note.md) 第8–18行 |
| D2 / 2 / 5/10 | **有限范围支持**：有多数类基线及相同fold模型比较方案，但没有模型比较输出或业务分组变化；部分支持2可解释。 | 这是“比较方案＋可算基线”，不是已观测模型优劣。 | 保留2并明确范围；若后续称模型更优，要补共同样本上的结果。 | [churn_method_note.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/ann-li/churn_method_note.md) 第23–23行<br>[churn_method_note.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/ann-li/churn_method_note.md) 第18–28行 |
| D3 / 4 / 10/10 | **有限范围支持**：人数与分配可复算，训练fold处理、holdout边界与缺失实施材料清楚；4限于准备算例和书面方法。 | 完整模型运行复现仍缺特征实现、参数、运行和窗口审计。现有4不应讲成模型可复现性已验证。 | 保留现有4时读出范围说明；若真人把D3专指完整模型结果，应与所有静态小作品一并校准。 | [churn_method_note.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/ann-li/churn_method_note.md) 第28–28行<br>[churn_method_note.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/ann-li/churn_method_note.md) 第20–28行 |
| B1 / 2 / 5/10 | **支持原Mark**：将风险分与联系优先次序关联且列出容量/成本等考虑；缺特定决策和可行限制值，2合理。 | 泛用业务设想不等于已选定干预策略。 | 保留2；补岗位具体决策、需要回答的问题与实际限制。 | [churn_method_note.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/ann-li/churn_method_note.md) 第30–30行 |
| B2 / 3 / 7.5/10 | **支持原Mark**：明确SHAP关联不证明流失原因或干预效果；尚未展开竞争解释，因此3而非4。 | 不因列出高级方法自动抬高判断。 | 保留3；补一个业务或模型现象的其他解释。 | [churn_method_note.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/ann-li/churn_method_note.md) 第25–25行<br>[churn_method_note.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/ann-li/churn_method_note.md) 第25–30行 |
| B3 / 2 / 5/10 | **重点复核：解释边界**：特征构建、label-window审计与执行记录是具体技术证据，原2采用“实施解释”宽范围；与业务假设区分的直接联系较弱。 | 严格限定业务因果解释时，1或NE也有根据；不是缺引文或算术错误。 | 真人确认B3是否接受技术有效性解释；若接受可留2，若收窄需记录理由并经revision保存。 | [churn_method_note.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/ann-li/churn_method_note.md) 第28–28行<br>[churn_method_note.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/ann-li/churn_method_note.md) 第27–30行 |
| B4 / 2 / 5/10 | **支持原Mark**：提到联系政策前要看容量、成本、同意及结果；未给顺序和明确验证量，2合理。 | 没有选定留存干预，也无营收改进事实。 | 保留2；与业务负责人约定小范围行动及检查方式。 | [churn_method_note.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/ann-li/churn_method_note.md) 第30–30行 |

### David Liu

已检查全部来源：[cv-public.txt](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/david-liu/cv-public.txt)；[project_readme.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/david-liu/project_readme.md)；[task_queries.sql](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/david-liu/task_queries.sql)。

| 项/原Mark/贡献 | 助手结论及理由 | 限制 | 建议 | 原文定位 |
|---|---|---|---|---|
| S1 / 4 / 10/10 | **静态范围支持**：唯一users.id与task主键支撑many-to-one连接；WHERE按用户过滤，单task一行预期一致。 | 这是应用取数而非销售分析；身份访问控制在另一个未附handler内。 | 保留4；不要把命名参数本身说成完整访问控制已实现。 | [task_queries.sql](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/david-liu/task_queries.sql) 第7–7行<br>[task_queries.sql](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/david-liu/task_queries.sql) 第4–21行 |
| S2 / NE / 不计作0 | **支持原NE**：全部材料中仅当前用户任务列表，无时间/分析分组对比；NE与检查范围一致。 | 排序按created_at不等于期间比较；CV软件经验不证明该项。 | 保留NE；请求已有基础SQL期间/分组比较，不据此判能力差。 | [project_readme.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/david-liu/project_readme.md) 第5–14行 |
| S3 / 4 / 10/10 | **重点复核：解释边界**：空结果、一次出现、ID对账与缺名称均给明确预期，按静态谓词检查范围4可支持。 | 未附执行步骤/固定输入夹具及日志；若“可操作”要求更细方法，3也合理。 | 建议与Amy同用“检查方法＋预期”静态尺度；不要只因未运行单独降David。 | [task_queries.sql](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/david-liu/task_queries.sql) 第16–19行<br>[task_queries.sql](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/david-liu/task_queries.sql) 第15–21行 |
| D1 / NE / 不计作0 | **支持原NE**：三份材料无业务指标分母、单位或分析计算；软件查询不等于D1分析证据。 | 缺证不是看到了计算错误，也不等于0。 | 保留NE；请求小型业务指标计算和原始数值。 | [project_readme.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/david-liu/project_readme.md) 第13–14行 |
| D2 / NE / 不计作0 | **支持原NE**：未见期间或业务分组比较；列表检索不提供比较输出。 | CV系统开发范围保留，不额外推断数据分析。 | 保留NE；补同口径比较与意义解释。 | [project_readme.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/david-liu/project_readme.md) 第13–14行 |
| D3 / NE / 不计作0 | **支持原NE**：数据库说明可复核取数意图，但无分析计算过程供本criterion复核。 | 技术文档质量可在更宽JD矩阵体现，不借给D3。 | 保留NE；请求简单分析的过程、来源与局限。 | [project_readme.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/david-liu/project_readme.md) 第8–14行 |
| B1 / NE / 不计作0 | **支持原NE**：作品说明软件功能范围，未提出业务分析决策问题。 | 应用用户需求与本rubric的商业调查范围分别记录。 | 保留NE；要求描述一个业务问题及支持的决定。 | [project_readme.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/david-liu/project_readme.md) 第5–14行 |
| B2 / NE / 不计作0 | **支持原NE**：无业务现象解释或因果假设可判断；没有明确错误断言。 | NE不意味着缺少推理能力。 | 保留NE；提供观察和假设分开的分析例。 | [project_readme.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/david-liu/project_readme.md) 第13–14行 |
| B3 / NE / 不计作0 | **支持原NE**：无待区分业务解释及进一步数据请求；全部本人材料已检查。 | 功能测试建议不是本次业务调查补证。 | 保留NE；请求说明哪份证据会如何改变业务解释。 | [project_readme.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/david-liu/project_readme.md) 第11–14行 |
| B4 / NE / 不计作0 | **支持原NE**：功能检查存在，但没有证据驱动的业务建议或结果验证。 | 不强行把软件检查转写成商业行动。 | 保留NE；请求下一步业务动作及判断结果的方法。 | [project_readme.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/david-liu/project_readme.md) 第11–14行 |

### Jamie Parker

已检查全部来源：[cv-public.txt](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/jamie-parker/cv-public.txt)；[campaign_brief.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/jamie-parker/campaign_brief.md)；[social_reporting.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/jamie-parker/social_reporting.md)。

| 项/原Mark/贡献 | 助手结论及理由 | 限制 | 建议 | 原文定位 |
|---|---|---|---|---|
| S1 / NE / 不计作0 | **支持原NE**：CV与两份营销附件均无SQL；基础Excel/SUM不等于SQL聚合或join。 | 未见SQL错误；只是材料不覆盖。 | 保留NE；先问是否有已有SQL例，不编新履历。 | [cv-public.txt](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/jamie-parker/cv-public.txt) 第52–56行 |
| S2 / NE / 不计作0 | **支持原NE**：月度社媒变化属于书面分析，不包含SQL过滤/分组/时间窗代码。 | 不要把D2支持借给SQL S2。 | 保留NE；请求带边界说明的简短SQL比较。 | [social_reporting.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/jamie-parker/social_reporting.md) 第8–22行 |
| S3 / NE / 不计作0 | **支持原NE**：全部本人来源无SQL方法及查询检查；表格公式不是SQL测试。 | 缺证不同于无技能或错误。 | 保留NE；已有SQL片段旁加检查和预期即可开始评。 | [cv-public.txt](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/jamie-parker/cv-public.txt) 第52–56行 |
| D1 / 4 / 10/10 | **支持原Mark**：360+24+16=400，450+45+25=520；净粉100/80正确，区分actions、followers与reach。 | 书面worksheet非实际Excel工作簿；未证实工具熟练度。 | 保留4；口径为小型书面算例，不称已验证Excel高级能力。 | [social_reporting.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/jamie-parker/social_reporting.md) 第16–16行<br>[social_reporting.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/jamie-parker/social_reporting.md) 第8–16行 |
| D2 / 2 / 5/10 | **支持原Mark**：月份总量方向有用且避免reach重叠求和；缺per-post/内容组与曝光细分，2相符。 | 整体月度变化不是具体内容导致变化。 | 保留2；追加同口径逐帖或内容组比较。 | [social_reporting.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/jamie-parker/social_reporting.md) 第19–19行<br>[social_reporting.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/jamie-parker/social_reporting.md) 第16–22行 |
| D3 / 4 / 10/10 | **有限范围支持**：原表和SUM/减法可复算，源平台与缺失export/per-post明确，4限书面依据。 | 未附实际图表、Excel或dashboard导出；不是完整数据采集验证。 | 保留4及范围；主张真实工具能力前查看对应产物。 | [social_reporting.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/jamie-parker/social_reporting.md) 第22–22行<br>[social_reporting.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/jamie-parker/social_reporting.md) 第16–22行 |
| B1 / 3 / 7.5/10 | **支持原Mark**：目标学生、weekday awareness、两周内容与AUD300预算清楚；成功识别未定义，因此3。 | 素材是方案，未说明已上线、销量或客户转化。 | 保留3；定义recognition进展的可观察证据。 | [campaign_brief.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/jamie-parker/campaign_brief.md) 第9–9行<br>[campaign_brief.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/jamie-parker/campaign_brief.md) 第8–14行 |
| B2 / 3 / 7.5/10 | **支持原Mark**：计划/结果及因果界限明确，未声称销售提升；未分析其他解释，3可支持。 | 谨慎措辞不是已完成因果调查。 | 保留3；讨论变化前补竞争解释。 | [campaign_brief.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/jamie-parker/campaign_brief.md) 第6–6行<br>[campaign_brief.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/jamie-parker/campaign_brief.md) 第5–14行 |
| B3 / 1 / 2.5/10 | **重点复核：解释边界**：建议将calendar/popular-post与export同看，是相关尝试，但请求不具体、无对照或结果含义；1可解释。 | 若真人认定这里只是资料浏览而没有调查意图，可选NE；两者均非0。 | 本助手偏向保留1并说明弱支持；真人确认是否认可该句为调查尝试。 | [social_reporting.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/jamie-parker/social_reporting.md) 第19–19行<br>[social_reporting.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/jamie-parker/social_reporting.md) 第18–22行 |
| B4 / 2 / 5/10 | **支持原Mark**：发布前核查、两周后看reach/actions和收集问题有顺序；缺目标阈值及如何改变决策，2相符。 | 无需为初级角色强加复杂实验；缺的是自身awareness目标的判断连接。 | 保留2；补观察结果到下一次内容计划的规则。 | [campaign_brief.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/jamie-parker/campaign_brief.md) 第14–14行<br>[campaign_brief.md](https://github.com/ren-sidequest/hackathon-1/blob/b5d0568c71fd51f4f39f3eb506654861c1b59695/app/backend/content/r6/jamie-parker/campaign_brief.md) 第13–14行 |

## 5. 独立复算与展示边界

| 人物 | 原Mark顺序 S1–S3 / D1–D3 / B1–B4 | SQL% | DA% | BPS% | 完整核心% | 累计支持分 | 覆盖率 |
|---|---|---:|---:|---:|---:|---:|---:|
| Amy | 4/4/4 · 4/4/4 · 2/3/2/2 | 100 | 100 | 56.25 | 82.5 | 82.5 | 100% |
| Ann | 4/2/3 · 4/2/4 · 2/3/2/2 | 75 | 83.333… | 56.25 | 70 | 70 | 100% |
| David | 4/NE/4 · NE/NE/NE · NE/NE/NE/NE | null | null | null | null | 20 | 20% |
| Jamie | NE/NE/NE · 4/2/4 · 3/3/1/2 | null | 83.333… | 56.25 | null | 47.5 | 70% |

数值为完整精度；网页按一位小数显示。David 20和Jamie47.5是**累计支持分**，不是可排序的完整核心匹配率。11个NE分别是David8、Jamie3。四份申请均已由原编写方法完成判断；真人校准仍全pending。

## 6. 重点复核／解释边界，不是新增bug列表

1. **Amy静态SQL4**：看代码是否满足静态粒度/窗口/检查标准；原rubric明确静态审阅不证明执行。对Amy、Ann、David采取一致尺度。无需为演示追加SQL执行开发。
2. **Amy B3=2**：原句只给数据请求，缺比较和不同结果含义，作为当前主讲链条有直接依据。真人实际读后可同意，也可写自己的理由；本助手没有代签。
3. **Ann S2=2或NE**：分歧是单快照＋特征/标签时序能否满足“部分时间逻辑”；不是SQL已知错误。按当前宽锚点2可解释；若真人严格要求比较，记录NE与范围。
4. **Ann B3=2或1/NE**：原2将实施有效性的证据请求纳入范围；严格业务假设判别范围可更弱。先说清解释，再决定Mark，保持同标准。
5. **David S3=4或3**：期待结果具体但执行细节少；按静态检查计划4可解释。未执行这个共同限制不单独处罚David。
6. **Jamie B3=1或NE**：资料同读是相关弱尝试；真人若认为无调查意图则NE。没有明确错误，不转0。

这些边界在当前诚实标签下**不阻断原型流程演示**；它们阻止的是宣称“40项已经真人校准”或“成绩等于真实能力”。若真人日后改Mark，通过既有assessment revision保存并检查相关名单重确认；共享线上写入先说明影响并取得本次确认，不直接覆盖基准或旧历史。

## 7. 给唯一实际复核人的最短入口

[打开逐项阅读／签收入口](HUMAN_READING_GUIDE.md) 提供每项判断问题、现值、原文与重点边界。实际签收仍填写 [原40项真人记录表](HUMAN_REVIEW_FORM.md)：同意/调整/保留解释边界、真实已读范围、理由、姓名/日期。**一人可复核40项，但不虚构第二复核人；主讲另一人复核仍单列尚未进行。**

请实际阅读后只需回复：已读哪些人/项目；每项同意或具体调整；重点边界采用哪种解释；你的姓名或真实使用称呼与时间。未读项继续pending。不得因收到“继续”或这份助手报告而自动填写已审。

## 8. 给演示组与试用组的内容事实

- Amy主讲英文可用：`The source requests campaign and device breakdowns for the same two periods. It does not yet explain the comparison or what different results would mean. The current prepared assessment is Mark 2, contributing 5 out of 10. Human calibration is pending.`
- 初始申请三份来源、公司公共任务、实际提交V1/V2分别保存；公司任务数据是新的合成共同资料，不是Amy过去项目。
- 公司设备资源只含**当期Paid Search**，跨期设备/campaign×device×landing-page detail仍需获取。禁止把V2条件性推理说成已观测历史趋势。
- V2改善、证据Confirm、新评分revision及retain名单是独立事件；本报告未执行任何这些业务动作。
- 试用答案不设“正确入选二人”：核验四条理由出处、两条待确认、NE误读与关键遗漏。参考清单是合成材料证据点，不是真实人才能力真值。
- 已向演示子任务和试用子任务发送上述来源与边界；共享PPT未编辑，真人试用未执行。

## 9. 交付与未执行

主报告本文件；40行结构结果 assistant-review.json（本地证据归档／不随公开包发布）；便于筛选 assistant-review-40.csv（本地证据归档／不随公开包发布）；当前运行时基准 runtime-baseline.json（本地证据归档／不随公开包发布）；确定性证据与脚本见§2。机器文件中的humanReviewer/decision/timestamp全部null，humanReviewStatus全部pending。

未执行：源码变更、内容/分数变更、原真人表写入、线上写入、真实模型、真实SQL执行、真人校准、招聘效果验证、PPT修改、发布/提交。当前报告的Git提交仅标内容基线，不宣称当前线上状态或共享访客最新revision；公网刷新由主协调任务独立报告。

---
阶段性文档副本：本次仅推送文档审阅PR，媒体与服务器发布暂缓；本机路径、日志和数据库留在内部归档。产品基线 `b5d0568c71fd51f4f39f3eb506654861c1b59695`。真人签收、用户试用与比赛提交状态仍以实际记录为准。
