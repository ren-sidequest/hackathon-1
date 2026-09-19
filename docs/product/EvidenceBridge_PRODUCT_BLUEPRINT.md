# EvidenceBridge Product Blueprint

> **修订 5 范围说明：**用户已批准四人统一流程、公开 rubric、人工评分与规则百分比、同技能比较和人工保留。本文下方修订 3 内容保留为当前 API 2.0 单案例基础的阶段记录，不再以旧“无数值比较”表述覆盖新目标。PR #7 完成接入基础；后续仍按已确认的前端／后端清单实施，具体交付边界见[前端交接](../FRONTEND_API_HANDOFF.md)。新范围获准不等于功能已交付。

## Repository References / 仓库引用

本文件负责产品定位、角色流程、功能范围与演示闭环；视觉与交互规范及图文差异处理见 [UI / Product Baseline](EvidenceBridge_BASELINE.md)，技术决策与实施安排见 [项目计划](../../PROJECT_PLAN.md)，开发规则见 [AGENTS.md](../../AGENTS.md)。HR 与 Candidate 分别设计实现，共用本产品蓝图。

本文的 first concept image 指 [候选人核心工作台概念图](assets/candidate-workspace-concept.jpg)，second concept image 指 [HR / Candidate 双端流程概念图](assets/dual-role-flow-concept.png)。两张原图可在 Baseline 中直接预览。图 2 的文本框、配色和共享后端示意不覆盖 Baseline 的调查板、统一视觉与前端演示优先要求。

## 当前执行范围：修订 3 有限两版（2026-09-19）

用户已确认本节覆盖早期仅前端模拟/单轮约定；视觉布局、主题、调查板与固定人物场景继续保留。正式任务、作品、分析、审核与报告使用共享 API 2.0；下面保留的前端展示优先原则不把正式双端同步降回各自 localStorage。实现结果与联调完成情况以[实际测试](../backend/TEST_RESULTS.md)为准，不由文档更新推断。

- 一个 HarbourCart / Junior Data Analyst / Alex Chen 案例、三个要求、Business Problem Solving 一个缺口、同一 Conversion Drop Investigation 与 datasetVersion。
- V1 可直接 Confirm 或 Evidence Still Insufficient 终局；仅 V1 Needs More Evidence 提供具体缺证意见，并开放同 session/task 的一次 V2。V2 只允许 Confirm / Evidence Still Insufficient；不开放 V3 或重开原审核。
- V1 More 后目标仍 Uncertain，状态为 awaiting_revision。Candidate 看到真实 comment、在隔离的 V2 草稿补充；V1 正式作品和既有分析/审核保持不变，不重新出题/更换资源或从头重做。
- V2 创建独立 submissionId/指纹，analysis 初始 not_started、review=null。最多两版作品及各自分析/意见只读回看；引用先选版本再定位，旧观察不显示为 V2 结果。
- UI 读取 workflow.canSubmit/canResubmit/nextSubmissionVersion/allowedReviewDecisions/isTerminal 控制动作；remainingSubmissions 只是额度，不代表终局后仍可提交。
- 只有当前版人工 Confirm 更新目标要求；SQL 与 Data Analysis 保持初始支持。两种不足仍 Uncertain，提交/AI 成功不自动确认，不构成录用决定。
- 申请/初始报告/任务仍明确 preset；AI 仅做各版工作样本五维观察。保留上传外观时不把任意本地文件伪装成已被预置报告分析。私人 notes 留本地；真实模型实验与双端浏览器验收分别记录。

固定两版只读回看属于本轮；无限轮次、复杂 diff、通用历史、PDF/OCR、动态出题、账号/多租户、通知与公网部署仍后置。见[实施计划](../backend/REVISION_PLAN.md)、[API](../backend/API.md)与[前端接入](../backend/HANDOFF.md)。


---

## 1. What This MVP Is

EvidenceBridge is not primarily a recruitment ranking system, a quiz platform, or a generic ATS.

Its core job is:

> **Find capabilities that the candidate’s existing materials cannot prove, create a targeted realistic task to generate new evidence, extract observable evidence from the candidate’s process and output, and let HR make the final human decision.**

The product is therefore an **evidence-gap closure workflow**.

### Core loop

`Candidate materials -> Evidence mapping -> Uncertain capability -> Targeted micro-task -> New observable evidence -> HR review -> Updated evidence report`

This is the central product story and should remain visible throughout the MVP.

### 1.1 MVP Form Factor and Acceptance Standard

This MVP is a **Web Application**, designed to run in a browser for a live hackathon demonstration. It is not intended to be delivered as a native desktop application.

The main acceptance criterion is not backend completeness. The goal is to produce a **presentation-ready, end-to-end product demo** that makes the EvidenceBridge concept understandable and believable to the organizers / judges.

Therefore:

- Front-end experience is the primary deliverable.
- The supplied concept images are the visual and interaction reference.
- Candidate task execution and HR evidence review should look complete and convincing.
- Back-end systems should be minimized unless they are necessary for the visible demo.
- Static or predetermined data is fully acceptable.
- Labelled mock state and pre-generated visual material remain acceptable for supporting demonstrations; formal V1/V2 submissions, review and shared evidence reports use the confirmed API scope above.
- Production authentication, database platforms, upload pipelines and full AI orchestration remain outside the core MVP; the confirmed local SQLite persistence and API are required for the formal workflow.

The intended standard is:

> **It should look and behave like a finished product during the demo, even if much of the underlying data and system behavior is intentionally simulated.**


---

## 2. What the Core Concept Image Represents

The first concept image represents the most important part of the product: the targeted candidate work-sample experience used when existing materials cannot prove a capability.

It contains seven major product ideas.

### 2.1 Task Brief

The candidate receives a realistic business problem rather than a quiz question.

Example:

- Website traffic has increased
- Conversion has dropped
- Ad spend has increased
- The candidate must investigate likely causes and recommend next steps

The task brief should communicate:

- Business context
- Target capability
- What the candidate is expected to investigate
- What kind of output is expected

The candidate should feel that they are completing a small piece of real work.

---

### 2.2 Data & Resources

The candidate receives multiple realistic data sources and context files.

Example resources:

- `website_traffic.csv`
- `campaigns.csv`
- `orders.csv`
- `landing_pages.csv`
- `product_catalog.csv`
- `business_context.md`

The key product message is:

> The candidate is not answering from imagination. They have evidence to explore.

For the MVP, these resources can be static files or fixed front-end data.

---

### 2.3 Analysis Workspace

The central workspace makes the task feel like real analysis work.

It may show:

- KPI cards
- Traffic and conversion charts
- Channel comparisons
- Performance tables
- Explore / SQL / Python / Notebook / Charts tabs

The MVP does not need a production-grade SQL or Python environment.

The purpose is to visually communicate:

> The candidate is exploring data, not merely typing an answer.

---

### 2.4 Investigation Board

The Investigation Board is the most important structured interaction area.

It turns the candidate’s thinking into visible, reviewable artifacts.

Recommended sections:

1. **Key Findings**
2. **Hypotheses**
3. **Additional Evidence Needed**
4. **Recommended Next Steps**

This structure allows EvidenceBridge to observe behaviors such as:

- Can the candidate identify the important issue?
- Can the candidate form reasonable hypotheses?
- Can the candidate identify what further evidence is required?
- Can the candidate turn analysis into an action recommendation?

This is more useful than a single open-ended answer because it exposes the reasoning process.

---

### 2.5 Final Work Sample

The candidate’s work is transformed into a polished final output.

Suggested structure:

- Executive Summary
- Key Findings
- Hypotheses
- Data Needed
- Recommended Next Steps

This is the candidate’s final mini-deliverable.

It gives HR something concrete to review and makes the micro-task feel like a real work sample rather than a test.

---

### 2.6 AI Evidence Extraction / HR View

After the task is submitted, the product turns the candidate’s work into observable evidence.

Recommended dimensions:

- Problem Framing
- Evidence Navigation
- Hypothesis Formation
- Evidence Seeking
- Decision Making

The AI should not primarily say:

- “Candidate score = 87”

Instead it should say things such as:

- The candidate identified the conversion decline as the main issue.
- The candidate drilled down from channel to device and landing page.
- The candidate proposed multiple testable hypotheses.
- The candidate requested additional evidence before making a stronger recommendation.

The important product principle is:

> AI extracts evidence; HR makes the final judgement.

---

### 2.7 Process Evidence Timeline

The product also captures how the candidate worked.

Example events:

- Opened a data file
- Filtered a channel
- Viewed a landing page dataset
- Created a chart
- Added a finding
- Added a hypothesis
- Requested more evidence
- Finalised a recommendation
- Submitted the work sample

This timeline makes the process itself reviewable.

It reinforces the product idea:

> EvidenceBridge evaluates observable work behavior, not only the final answer.

For the MVP, the timeline may be simulated with fixed front-end data.

---

## 3. Product Definition

A concise definition:

> **EvidenceBridge is an AI-assisted evidence completion workflow for hiring. It identifies missing evidence in a candidate’s application, issues a targeted work-sample task, and turns the candidate’s work process and output into observable evidence for human review.**

Chinese interpretation:

> EvidenceBridge 是一个用于招聘场景的 AI 能力补证工作流。它帮助 HR 找到候选人材料里的证据缺口，通过一个小型真实工作任务补充证据，并把候选人的过程和结果转化为可审核的能力证据。

---

## 4. Two-role Product Structure

EvidenceBridge has two roles inside one product.

### HR role

HR is responsible for:

- Understanding job requirements
- Reviewing existing candidate evidence
- Identifying uncertainty / evidence gaps
- Reviewing a targeted micro-task
- Sending the task to the candidate
- Reviewing the candidate’s new work sample
- Reviewing AI-extracted observable evidence
- Making the final human confirmation
- Updating the original evidence report

### Candidate role

Candidate is responsible for:

- Submitting initial materials
- Receiving a targeted evidence request
- Completing the work-sample task
- Exploring provided data and resources
- Building findings, hypotheses, evidence requests, and recommendations
- Producing a final work sample
- Submitting it for review

Both roles belong to the same EvidenceBridge product.

---

## 5. Overall Product Flow

### HR-side flow

1. View job requirements
2. View candidate Evidence Report
3. Identify `Uncertain` capability
4. Review the preset targeted micro-task
5. Confirm and send task
6. Receive candidate submission
7. Review final work sample
8. Review process evidence
9. Review AI-extracted observable evidence
10. V1: Confirm / request one V2 revision / mark still insufficient; V2: Confirm / mark still insufficient
11. View updated Evidence Report

### Candidate-side flow

1. Submit application materials
2. Wait for evidence review
3. Receive targeted task
4. Open task workspace
5. Explore data / resources
6. Build investigation board
7. Produce final work sample
8. Submit work sample
9. Wait for HR review
10. View review status; only V1 Needs More Evidence opens a separate V2 draft, followed by one terminal review

---

## 6. Candidate-side Product Skeleton

### 6.1 Application

Purpose: submit the candidate’s existing evidence.

Main content:

- Company and role information
- CV / Resume
- Project materials
- Submit Application
- Demo shortcut such as `Load Demo Application`

This page is required but is not the product core.

---

### 6.2 Targeted Task Workspace — Product Core

This is the most important page in the Candidate experience and should receive the highest visual polish.

It contains six major modules.

#### Module A — Task Brief

Show:

- Task title
- Targeted Task badge
- Company + role
- Business context
- What the candidate needs to investigate
- Save / submit actions

The language must feel like a real work assignment, not an exam.

#### Module B — Data & Resources

Show realistic data files and context resources.

The candidate should be able to inspect or simulate opening these resources.

#### Module C — Analysis Workspace

Show realistic analytical material:

- KPIs
- Charts
- Tables
- Explore / SQL / Python / Notebook / Charts tabs

Only the front-end effect needs to be complete for the MVP.

#### Module D — Investigation Board

Candidate builds the analysis through structured artifacts:

- Key Findings
- Hypotheses
- Additional Evidence Needed
- Recommended Next Steps

This is the main interaction model for the micro-task.

#### Module E — Final Work Sample

The candidate’s analysis is presented as a structured mini-report.

Suggested sections:

- Executive Summary
- Key Findings
- Hypotheses
- Data Needed
- Recommended Next Steps

#### Module F — Process Evidence

Show a timeline of the candidate’s major actions.

The timeline does not need perfect backend instrumentation in the MVP. It needs to convincingly demonstrate the product concept.

---

### 6.3 Submission Status

Show the candidate’s workflow state.

Recommended stages:

- Application Submitted
- Task Received / Task Completed
- In Review (current submitted version)
- Awaiting Revision (V1 Needs More Evidence only)
- Review Complete (terminal V1 or V2)

The page should be simple.

---

## 7. HR-side Product Skeleton

### 7.1 Job Requirements

Show:

- Company
- Role
- Role metadata
- Key requirements

Demo requirements:

1. SQL
2. Data Analysis
3. Business Problem Solving

This establishes what the candidate is expected to prove.

---

### 7.2 Evidence Report

The Evidence Report should be slightly more detailed than the simple second concept image.

For each requirement, show:

- Requirement name
- Evidence status
- Evidence summary
- Source
- Explanation
- Why uncertain, when relevant

Expandable details may show:

- Evidence snippet
- Source material
- Mapping rationale
- Remaining uncertainty

The report should make the evidence gap obvious.

Example:

- SQL -> Supported
- Data Analysis -> Supported
- Business Problem Solving -> Uncertain

---

### 7.3 Review Micro-task

The task review page explains why the micro-task exists.

Show:

- Target requirement
- Why current evidence is insufficient
- Generated task
- Business scenario
- Candidate instructions

Actions:

- Regenerate
- Confirm & Send to Candidate

---

### 7.4 Review Candidate Work Sample

This page is the core HR review page.

It should contain three evidence layers.

#### Layer 1 — Candidate Final Work Sample

Show:

- Executive Summary
- Key Findings
- Hypotheses
- Recommended Next Steps

#### Layer 2 — Process Evidence

Show the Investigation Timeline.

This shows how the candidate explored the problem.

#### Layer 3 — AI Extracted Observable Evidence

Recommended dimensions:

- Problem Framing
- Evidence Navigation
- Hypothesis Formation
- Evidence Seeking
- Decision Making

Each dimension may include:

- Observable behavior
- Evidence source
- Strength / support label

Actions:

- Confirm
- Needs More Evidence (V1 only; requests at most one targeted V2 revision)
- Evidence Still Insufficient

V2 supports only Confirm or Evidence Still Insufficient; each version has one immutable review. AI assists the review; it does not replace HR.

---

### 7.5 Updated Evidence Report

This page shows the result of closing the evidence gap.

Example:

**Before**

`Business Problem Solving -> Uncertain`

**After**

`Business Problem Solving -> Verified through targeted task`

Also retain:

- New evidence
- Source
- Human review state
- Remaining uncertainty

This is the final proof that the EvidenceBridge loop worked.

---

## 8. Micro-task Interaction Model

The micro-task should not be implemented as only:

- Multiple choice questions
- A generic text box
- A short quiz

The preferred format is:

> **Real business scenario + realistic data/resources + analysis workspace + structured investigation board + final work sample + process evidence**

The reason is simple:

A final answer alone tells HR what the candidate wrote.

The structured task tells HR **how the candidate thought, what they looked at, what they inferred, what evidence they asked for, and how they reached a recommendation**.

That process is the evidence.

---

## 9. Evidence Report Depth

The product should use two evidence views at different stages.

### Stage 1 — Initial Evidence Report

Organized around **job requirements**.

For each requirement:

- Status
- Evidence
- Source
- Explanation
- Uncertainty reason

This answers:

> “What can the candidate’s existing materials prove?”

### Stage 2 — Post-task Observable Evidence

Organized around **behavior / capability dimensions**.

Recommended dimensions:

- Problem Framing
- Evidence Navigation
- Hypothesis Formation
- Evidence Seeking
- Decision Making

This answers:

> “What did we actually observe when the candidate worked?”

This two-layer model is intentional and should be preserved.

---

## 10. MVP Priority: Front-end First

For this hackathon version, the MVP should be treated as a **presentation-first Web Application**. The browser experience should demonstrate the complete intended product experience even when most underlying behavior is simulated. A production backend is not required for acceptance.

### Front-end priority

High priority:

- Visual quality
- Clear workflow
- Realistic task workspace
- Evidence transparency
- Observable process
- Strong HR review experience
- Clear before / after evidence update

### Backend priority

A lightweight shared service for the confirmed V1/V2 evidence flow is in scope. Production infrastructure remains secondary; do not broaden the service beyond the approved workflow.

Acceptable shortcuts:

- Fixed role data
- Fixed candidate data
- Preloaded candidate materials
- Fixed charts
- Fixed resource files
- Mocked investigation timeline
- Local browser state
- Static JSON
- Pre-generated AI outputs

The hackathon goal is not production infrastructure, backend completeness, or production readiness.

The goal is to make the browser-based product experience feel real, coherent, and presentation-ready. Supporting visual previews may remain simulated and labelled. Formal V1/V2 handoff and human-review acceptance use the shared service, not independent simulated business state.

---

## 11. Fixed Demo Scenario

Use a single scenario so both sides stay aligned.

### Company

HarbourCart Pty Ltd

### Role

Junior Data Analyst

### Requirements

- SQL
- Data Analysis
- Business Problem Solving

### Initial evidence result

- SQL -> Supported
- Data Analysis -> Supported
- Business Problem Solving -> Uncertain

### Targeted task

**Conversion Drop Investigation**

Scenario:

- Website traffic increased by 18%
- Conversion rate dropped from 3.4% to 2.6%
- Ad spend increased by 15%

Candidate should investigate:

- What is driving the conversion decline?
- What evidence supports the finding?
- What hypotheses should be tested?
- What additional evidence would help?
- What should the business do next?

---

## 12. The Most Important Product Principle

If only one part of the MVP can be highly polished, it should be this loop:

`Uncertain capability -> Targeted realistic task -> Candidate working process -> Observable evidence -> HR confirmation -> Updated report`

Everything else is supporting structure.

The strongest demo should make the audience understand this without explanation.
