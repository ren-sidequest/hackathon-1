# EvidenceBridge — verified facts for the presentation team

> **用户最新状态更新（2026-09-20）：前端仍在修改，存在尚未跑通的流程和待修复问题。以下工程通过记录仅对应历史测试基线 b5d0568 及所列覆盖，不代表当前前端定稿或最终参赛验收。后端暂保持现状，待最终前端接入后联合验证。截图与录像仅是旧基线技术演练，暂不发布为最终素材；前端冻结后统一重录。真人复核、试用和比赛提交仍待真实记录。**

**Handoff date: 20 September 2026 (Sydney).** These are product facts and usable copy, not edits to your slides or speaker assignments. The running frontend and this package use Git `b5d0568c71fd51f4f39f3eb506654861c1b59695`.

## One consistent description

> This prototype uses prepared fictional cases, pre-authored demo assessments and rule-based evidence analysis. Scores follow a fixed rubric, and people make the final decision. No live model call is used in this demo.

Short footer: **Hackathon prototype · Prepared demo assessments · Rule-based analysis · Human decisions**

## What is actually implemented

- One employer, **Harbour Retail**, and one **Junior Data Analyst** role.
- Four fictional applicants: Amy Chen, Ann Li, David Liu and Jamie Parker. Original supplied fictional PDFs remain unchanged; eight newly authored work samples are explicitly synthetic.
- Nineteen JD requirements are visible separately from the ten scored analytical criteria. SQL / Data Analysis / Business Problem Solving have demo-policy weights of 30 / 30 / 40; these weights were not supplied by the employer's JD.
- Each numeric mark contributes `mark / 4 × 10`. NE means insufficient evidence, not zero. Incomplete core evidence produces no overall percentage or artificial last-place rank.
- Users can inspect the actual source text and quotations, compare the same material stage, request a targeted task, submit V1, and receive at most one V2 opportunity after V1 “Needs More Evidence”. V2 is final.
- Evidence review, assessment revision and retention are independent actions. “Confirm evidence” does not increase the score, retain a person, or make a hiring decision automatically.
- React/Vite frontends share API4 through Fastify and SQLite, with bound source/version identifiers, persisted state and request receipts. No general upload/OCR, live SQL execution, production role accounts, multi-tenancy or payment flow is claimed.

## Online demo and permissions

[HR workspace](https://101.37.80.98/hr/) · [Candidate workspace](https://101.37.80.98/candidate/)

Viewing and business edits need no sign-in. Visitors share the same dataset; other visitors' writes can change what you see. Administrative reset and server maintenance remain separate and protected. The on-stage plan is a desktop browser using this existing server, not a new deployment.

Before presenting, refresh both workspaces and inspect the current person, task/version and retained state. Do not reset the shared service to reproduce a scene. Switch to the labelled offline recording if another visitor has advanced the workflow or the network is unreliable.

## Scoring snapshot, not fixed outcomes

At this task's timestamped public checks, Amy's application score was 82.5, Ann's was 70.0, and David/Jamie had no complete overall score. All four baseline assessments remained **AI-authored demo assessment · Human calibration pending**. The snapshot must not override later legitimate edits.

Amy B3 is a useful explanation: her past-project note requests campaign and device breakdowns for the same periods, but does not explain how to compare them or what contrasting outcomes would imply. The existing mark is 2/4, contributing 5/10. Her historical project data (4,000→5,000 sessions) is not the employer task dataset (1,000,000→1,180,000 sessions).

The assistant inspected all 40 initial judgments and found no deterministic source-ownership or arithmetic blocker. This is not a human calibration claim. Static SQL marks do not prove query execution, independent authorship or future performance.

## Demonstration media disclosure

The local C0/C1/C2 material is **preloaded synthetic work in an isolated rehearsal database**. The V1→feedback→V2 passage is not a candidate completing a twenty-minute task live in fifty seconds. Recorded review and retention operations were automated synthetic rehearsal actions, not real HR approvals. The initial assessment scores were not edited to create a dramatic ranking.

Use only the final successful run linked from the demo package. Recording format is **silent WebM**, not MP4; the two timed automated runs are technical playback rehearsals, not rehearsals by the actual speakers.

## Validation: four different claims

| Layer | Actual status |
|---|---|
| Engineering | This task reran backend 282, process HTTP 27, Candidate unit 114, HR unit 8, API4 browser 38; both builds and contract checks passed. Suite counts overlap and should not be summed as independent features. Public checks and isolated recovery are separately documented. |
| Content | 40/40 assistant review; 27 content hashes, 145 quotations (29 assessment + 116 JD), four independent score/fingerprint checks passed. Actual human calibration has not been recorded. |
| Runtime model | Manual rule simulation only. No live model call or model accuracy experiment. This is the approved scope, not a last-minute integration task. |
| User / employer value | Four-person study materials and recording tools are ready; no actual participant records received. Team-internal observations must be labelled separately. No employer pilot yet. |

> **Savings have not yet been measured; the next pilot will compare review time and evidence quality.**

Both conditions receive the same JD, four fictional CVs and eight synthetic attachments. We assess source-supported reasoning, not agreement on which two people to select.

The proposed paid package is per role and candidate batch. Price, batch size and net benefit remain hypotheses. Any time-value example must include report preparation, setup and review costs without double-counting time already measured. Any net-value example also accounts for report maintenance, coordination, software fees and other additional costs; time already measured is counted only once. No payroll savings, hiring accuracy or retention improvement has been established.

## Presentation team actions that remain yours

Keep your existing speaker allocation. Update/verify your own slides and notes against these facts, use current labelled assets, and check any external competitor/industry claims with their sources. Confirm organizer rules, file formats and access requirements, export the final presentation, and retain the official submission receipt. This handoff has not edited shared Google Slides or submitted the competition entry.

---
阶段性文档副本：本次仅推送文档审阅PR，媒体与服务器发布暂缓；本机路径、日志和数据库留在内部归档。产品基线 `b5d0568c71fd51f4f39f3eb506654861c1b59695`。真人签收、用户试用与比赛提交状态仍以实际记录为准。
