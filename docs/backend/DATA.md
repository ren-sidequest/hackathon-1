# EvidenceBridge 唯一案例数据 v1

数据实现：[seed.ts](../../app/backend/src/seed.ts)。自动验证：[seed.test.mjs](../../app/backend/test/seed.test.mjs)。接口和状态以 [API.md](API.md) 为准。

## 1. 固定身份与来源

- API `schemaVersion: "2.0"`；资源 `datasetVersion: "harbourcart-2026-09-v1"` 保持不变。V1/V2 是 `submissionVersion`，不是新资源版本；同一补交流程不换题、不换数据。
- HarbourCart Pty Ltd / Junior Data Analyst / Alex Chen；ID 分别使用岗位 `junior-data-analyst`、候选人 `alex-chen`。
- 要求 ID：`sql`、`data-analysis`、`business-problem-solving`。前两项初始 `supported`，第三项 `uncertain`。
- 任务模板 ID：`conversion-drop-investigation`，名称 Conversion Drop Investigation，唯一目标 `business-problem-solving`。正式 `taskId` 由共享服务生成，前端从 GET 取得，不把模板 ID 用作本轮提交绑定。
- 本轮建议时长统一 **20 分钟，不强制计时截止**；前端旧的 15–20 与 35–45 分钟口径同时替换。
- 所有材料均为合成样例。初始申请、报告和任务带 `mode: "preset"`；这不是实际上传、材料解析、模型运行或独立人工认证。正式提交、AI 提取及人审状态按 V1/V2 由服务分别保存；`versions` 只含实际产生的记录，不预填第二版。

初始申请只含三个固定来源，所有 `sourceRefs[].quote` 在对应 `content` 中逐字存在：

| 来源 ID / 文件名 | 类型 | 支持范围 | 保留未知 |
| --- | --- | --- | --- |
| `customer_churn_analysis.sql` | `sql_example` | 可见聚合、CTE、窗口函数 | 未执行该 SQL；性能及运行正确性未观察 |
| `sales_analysis_project.md` | `calculation_table` | 早期销售样例的月度比较、平均订单金额与增长率 | 原始数据清洗、独立复算过程及业务建议未观察 |
| `alex_chen_resume.md` | `self_statement` | 候选人自述工具与项目经验 | 不把自述当作独立行为验证 |

计算表是初始申请的独立项目，不是本次调查数据：April/May/June 订单 400/450/500、收入 AUD 12,000/13,500/15,000、均单 AUD 30，增长 12.50%/11.11%。业务缺口表示“材料未展示”，不推断候选人缺少能力。无通用申请/解析端点，修改初始样例应修改种子并递增数据版本，而不是保留旧固定分析。

## 2. 唯一事实表与精度

`dataset.records` 的 **10 条 channel × period 聚合记录**是总体指标和图表的唯一事实来源。两个期间分别为连续、不重叠的 `Previous 4 weeks` 和 `Last 4 weeks`；不是一个月与四周混比。`sessions`、`orders` 为整数；金额存储为整数 AUD cents。

| 渠道 | 上期 sessions | 本期 sessions | 上期 orders | 本期 orders | 上期 CVR % | 本期 CVR % | 流量变化 % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Organic | 300,000 | 324,000 | 11,400 | 11,340 | 3.800000 | 3.500000 | +8.00 |
| Paid Search | 300,000 | 426,000 | 9,600 | 7,668 | 3.200000 | 1.800000 | +42.00 |
| Social | 160,000 | 200,000 | 4,480 | 4,200 | 2.800000 | 2.100000 | +25.00 |
| Email | 80,000 | 77,600 | 3,600 | 3,414 | 4.500000 | 4.399485 | −3.00 |
| Direct | 160,000 | 152,400 | 4,920 | 4,058 | 3.075000 | 2.662730 | −4.75 |
| **总体** | **1,000,000** | **1,180,000** | **34,000** | **30,680** | **3.4** | **2.6** | **+18.00** |

- CVR = `100 × sum(orders) / sum(sessions)`，不平均渠道转化率。
- 变化百分比 = `100 × (current − previous) / previous`；转化百分点变化 = `current CVR − previous CVR`。
- 订单变化 **−9.764705882…%**，两位显示 **−9.76%**，一位显示 **−9.8%**。转化变化 **−0.8 个百分点**，不是 −0.8%。
- 花费：上期 **AUD 41,739.13**（Paid Search 33,913.04、Social 7,826.09），本期 **AUD 48,000.00**（Paid Search 39,000.00、Social 9,000.00）。从整数 cents 计算增长 **15.0000011979…%**，两位显示 **+15.00%**。上期金额按最小货币单位舍入，故不声称未舍入比率恰好为 15%。
- 收入仅按合成均单 AUD 30 生成：上期 **1,020,000.00**，本期 **920,400.00**。这不是产品级成交归因。
- JSON 指标保留 JS number 计算精度。CSV 百分比显示六位，金额显示两位；UI 百分比推荐两位，概览 CVR 用一位。显示格式使用 `toFixed`，只在展示时舍入，不用已舍入百分比反推订单。图表与表格应直接读 API 数据。
- Paid Search 本期流量占比 **36.1016949…%**（显示 **36.10%**），转化下滑 1.4 个百分点，为本案例最大的渠道下滑。此相关模式并不证明广告质量或移动页面是原因。

## 3. 六个任务资源

每项通过 `dataset.resources[]` 返回 `{id,name,datasetVersion,provenance,mimeType,description,columns,rows,content,sizeBytes}`。文件名同时是稳定来源 ID，前端 `finding.source` 可直接使用；空 source 可表达尚无依据，任意非空陌生 ID 应由服务校验。资源可从 `content` 下载，不依赖虚构静态 URL；`sizeBytes` 是实际 UTF-8 长度，不沿用旧的 6/12/28 KB 标签。

| ID | 内容 / 范围 |
| --- | --- |
| `website_traffic.csv` | 10 条记录及精确整数 sessions/orders，附派生 CVR；`record_id` 可定位 |
| `campaigns.csv` | 5 个渠道的前后比较及花费；明确是渠道汇总，不是逐广告系列表现 |
| `orders.csv` | 与 traffic 同一批 channel-period 聚合，附收入/花费；不要与 traffic 叠加订单 |
| `landing_pages.csv` | 当前 Paid Search 的设备分区，Mobile 300,000 sessions / 4,200 orders / 1.4%，Desktop 126,000 / 3,468 / 2.752381%；合计正好 426,000 / 7,668 |
| `product_catalog.csv` | 四个示例产品、价格和库存描述；不把有限库存直接当成转化原因 |
| `business_context.md` | 派生总体数字、背景、同总体重叠规则、精度规则和缺失证据 |

`landing_pages.csv` 名称为兼容来源引用保留，但本轮仅有设备聚合，没有具体页面归因、页面速度或过去设备明细。尚缺 campaign × device × landing page、历史可比分组、load times、checkout events。这些正是候选人可请求的补充证据；不把旧 Candidate 的 4.8 秒或特定页面转化数混入。背景中的新广告与 Spring Sale 页面变化是待验证假设背景。

`dataset.trafficTrend` 只含两个完整期间，提供 `{period,label,sessions,traffic,orders,conversion}`；`traffic` 单位为千 sessions。旧的五个周度 snapshot 没有底层周数据，已弃用。前端 X 轴改用 `label`，图标题改为“四周期间比较”，勿把两点显示成真实周趋势。

## 4. 小傅接入替换清单（本轮未修改前端）

以下行号基于审查基线 `8b0231e`，以符号定位为主。请两端读同一 GET 的 `dataset`，不要分别维护另一套硬编码。

| 文件 / 符号 | 必须替换的数据或行为 |
| --- | --- |
| [Candidate data.ts](../../app/candidate/src/data.ts) 第 7–36 行 `channels / trafficTrend / resources` | 渠道本期流量从 320k/410k/220k/90k/160k 改为 324k/426k/200k/77.6k/152.4k；订单改为 11340/7668/4200/3414/4058；增长、CVR、收入均从新 channels 读取。资源、图表和下载完全替换成 API 对象。 |
| Candidate `data.ts` 第 38 行 `demoFindings` | Paid Search 份额 34% 改 36.10%；删除旧 Spring Sale 1.0%/2.7%/4.8s 和 campaign 1.1%/3.1% 的无本版本来源结论；设备事实可用 1.4%/2.752381%，但仍只支持待验证假设。示例按钮内容继续明确标注示例。 |
| [Candidate Workspace.tsx](../../app/candidate/src/Workspace.tsx) 第 22–25 行 KPI/图表 | 1.2M 改 1.18M；31,200 改 30,680；48,000、3.4→2.6、18%与15%保留但读派生值。图表 X 轴 `week` 改 `label`，去除周 snapshot 文案。 |
| Candidate `Workspace.tsx` 第 46–47 行 SQL/Python 示例 | CSV 现在有 `period` 和数值 `conversion_pct`；筛选 `period === 'current'`。Python 不再 strip `%` 或读旧 `Conversion` 列。示例输出仍不意味着实际执行查询。 |
| [Candidate ui.tsx](../../app/candidate/src/ui.tsx) `ResourceBrowser` | 名称保持；由 `sizeBytes` 格式化大小；预览用 `columns/rows/text`，下载直接使用 `content`。 |
| [Candidate App.tsx](../../app/candidate/src/App.tsx) 第 61 行 My Tasks | 35–45 分钟改读 `timeboxMinutes` = 20；未发送的 preset 任务不显示为已发送。 |
| [Candidate state.test.ts](../../app/candidate/src/state.test.ts) 第 63–66 行旧总量断言 | 前端接入后将 1,200,000 / 31,200 改为 1,180,000 / 30,680；不能保留旧数字“通过”的演示说法。 |
| [HR data.js](../../app/hr/src/data.js) `requirements/resources/channels` | 初始支持来自后端三种来源与可定位引用；移除未有代码/计算表支持的“joins / cleaning / dashboard”固定描述。Direct 上期 3.4875%/3.49% 改 3.075%；本期约 2.662730%。Email 本期由整数 3414 / 77600 计算；图中可展示 4.4%。全部 CSV 从 API 读。 |
| [HR components.jsx](../../app/hr/src/components.jsx) 第 256 行 `ChannelChart` | 另有独立的固定渠道数组，尤其 Direct 3.49；改为 API channel 数据，期间文案 Previous month 改 Previous 4 weeks。 |
| [HR main.jsx](../../app/hr/src/main.jsx) 第 861 行及 `workSections / dimensions / timeline` 渲染处 | 15–20 分钟改读 20；正式作品、事件、AI 观察读服务当前提交；原固定样例只在明确示例区展示。打开文件事件仅证明客户端报告了访问，不代表已掌握能力。 |
| [Candidate state.ts](../../app/candidate/src/state.ts) / [HR workflow.js](../../app/hr/src/workflow.js) | 本地草稿可保留；正式状态由 API 映射。仅当前 V1 的 Needs More Evidence 开放隔离 V2 草稿；读取真实 comment 与 workflow；V2/终局禁止再补交，不重开旧审核。禁止本地 LOAD_SUBMISSION/REVIEW/REOPEN 模拟覆盖共享状态。Candidate 私人 notes 不发 API；HR 公开审核备注用合同字段，不发送全 state。 |

`dataset.channels` 兼容 Candidate 的 `channel/traffic/growth/orders/conversion/previous/revenue`，另附 `id/before/current/trafficSharePct`。HR 可把 `channel` 映射为 `name`、`conversion` 映射为 `current`，金额和百分比在 UI 格式化；不要把格式化字符串存成事实数据。

## 5. 两版数据关联与验证范围

- sessionId 是演示会话，taskId 是同一任务，datasetVersion 是固定资源版本；submissionVersion 为 1/2，revision 为状态更新次数。
- V1 前版 ID/指纹为 null；V2 明确关联同会话 V1。两个 submissionId/指纹和 sources 各自保存，哪怕复用 finding.id，来源定位也要以所属 submissionId 为外层作用域。
- V2 可保留或修订 V1 的公开卡片，但其提交是新快照；原版保持不变。补充意见不意味着后端补发隐藏数据/参考答案，仍围绕现有资源说明推理与缺失证据。
- 正常、薄弱、错误推理与 V1→V2 成对案例可在独立 session/测试库运行；不因此增加候选人或岗位管理。


在后端目录执行 `npm run build && node --test test/seed.test.mjs`。种子套件验证：固定身份与 preset 状态、10 条整数事实、总体/渠道/图表复算、六资源内容与 UTF-8 大小、Paid Search 设备精确分区、初始真实引文与计算表、重置确定性及深拷贝、无私人 notes 字段。

这只是后端种子和合同数据验证，不是双端 UI 联调、真实模型实验或招聘有效性验证。完整后端测试结论由根任务交付记录汇总；双端 UI 联调待小傅接入。
