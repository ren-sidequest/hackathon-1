# Evidence coding specification

> **用户最新状态更新（2026-09-20）：前端仍在修改，存在尚未跑通的流程和待修复问题。以下工程通过记录仅对应历史测试基线 b5d0568 及所列覆盖，不代表当前前端定稿或最终参赛验收。后端暂保持现状，待最终前端接入后联合验证。截图与录像仅是旧基线技术演练，暂不发布为最终素材；前端冻结后统一重录。真人复核、试用和比赛提交仍待真实记录。**

**Provisional assistant-authored reference; human calibration pending.** Evaluate traceability and limits, not which two names were selected. Never use rank, total core score, degree prestige or supposed employer truth as the answer key.

## Unit and denominator

- Each distinct factual claim in the four reasons is one judgement. Split compound statements if their source support differs. `statement_ref` identifies e.g. `choices[0].reasons[1]#claim2`; copy the exact wording into `claim_text`.
- `correct_source = true` only if the cited file belongs to the named person, the locator resolves (allow page + clear quotation), the passage supports the claim and its degree of certainty, and attribution/provenance is accurate. A CV claim accurately presented as a claim can pass. Synthetic work presented as verified employment performance fails. SQL comments presented as an executed test fail.
- `unsupported = true` means the claim exceeds the accessible evidence (including a valid citation used to overclaim); `correct_source = false`. A missing/wrong locator can fail citation quality without proving that the factual content is false; explain it. Use null while uncoded, not false or zero.
- Report `correct_source_count / judgements_total` with raw counts. Uncoded records do not produce an apparent zero-error score. The two unknowns are separate: one each, linked to a real gap and a concrete check (`appropriate: true/false/null`), not counted as affirmative source claims unless they contain an additional factual assertion (then code that assertion separately).

## Critical omissions (conditional, not an arbitrary answer count)

The reference contains three checkpoints per person. For each selected person, inspect all their checkpoints. `applicable` is true only when omission would materially change a stated reason/unknown. Example: “Amy's SQL was successfully run” activates the static-only limit; failing to mention an unrelated unused figure is not an error. `missed = true` when the relevant limiting evidence or important contradiction is absent from the participant's response. Cite their statement and the omitted source passage. Mark unselected people/checkpoints not applicable; do not penalise selecting a different pair. A missed positive clue across all four people is an exploration observation, not automatically a critical omission.

Enter each inspected checkpoint in `coding.omissions` as `{checkpoint_id, applicable, missed, participant_statement_ref, source_locator, explanation}`. `missed` must be false when not applicable. Sum misses over applicable checkpoints and report that denominator; one issue is counted once even if repeated. A second human checks all flagged omissions.

## NE and missing-evidence interpretation

An event is an explicit statement that insufficient material demonstrates low ability, a zero mark, a failed test, or automatic rejection. Examples of errors: “NE proves no SQL ability” or “missing overall total means lowest score.” Saying “I would ask for a SQL sample because none is visible” is not an error. Lower confidence in the available evidence is not equivalent to low ability. No SQL sample in Jamie's accessible pack proves a material gap, not inability.

Record `{phase: "during_task" | "post_task", verbatim, interpretation, source_or_ui_context, at_seconds}` for each distinct event. Record `ne_interpretation_opportunities` separately: observed exposures or direct post-task answers where an interpretation could be evaluated. A person who never saw NE has zero observed exposures, not a perfect comprehension result. The raw condition can show the analogous “absence implies inability” error without seeing the literal label. Flag this distinction in `source_or_ui_context` rather than implying identical UI exposure.

## Coding JSON example (template only; not a participant result)

```json
{
  "status": "pending",
  "human_coder": null,
  "coded_at": null,
  "reference_version": "trial-reference-v1",
  "judgements": [{"statement_ref": null, "claim_text": null, "correct_source": null, "unsupported": null, "source_locator": null, "notes": null}],
  "unknowns": [{"choice_index": 0, "appropriate": null, "why": null}, {"choice_index": 1, "appropriate": null, "why": null}],
  "omissions": [{"checkpoint_id": null, "applicable": null, "missed": null, "participant_statement_ref": null, "source_locator": null, "explanation": null}],
  "ne_events": [],
  "ne_interpretation_opportunities": null,
  "notes": null
}
```

A reviewer marks `status: complete` only after all judgement rows, two unknowns, selected-person checkpoints and NE observations have been checked. Still-disputed fields remain pending. Store the actual human calibration and discussion separately from app assessment calibration; this study does not alter app `Human calibration pending` or the 40-item human review table.

---
阶段性文档副本：本次仅推送文档审阅PR，媒体与服务器发布暂缓；本机路径、日志和数据库留在内部归档。产品基线 `b5d0568c71fd51f4f39f3eb506654861c1b59695`。真人签收、用户试用与比赛提交状态仍以实际记录为准。
