import type { AssessmentRecord, Demo, Stage } from '../api3-types';
import { stageContext } from './client';
import { annotationLabel, percent, resolveSourceRef, stageNames } from './hr-model';
import { workMarkdown } from '../api';

/** Export only a selected server-owned stage. Never reads browser drafts or private notes. */
export function assessmentReport(data: Demo, stage: Stage, selected?: AssessmentRecord | null): string {
  const context = stageContext(data, stage);
  if (!context) throw new Error('This material stage is unavailable.');
  const record = selected === undefined ? context.assessment : selected;
  if (record && (record.candidateId !== data.candidate.id || record.stage !== stage || record.evidenceSnapshotId !== context.evidenceSnapshotId || record.fingerprint !== context.fingerprint)) throw new Error('Assessment and selected material do not match.');
  const version = data.versions.find(v => `task_v${v.submission.submissionVersion}` === stage);
  const lines = [
    `# ${data.candidate.name} · evidence assessment report`,
    `${data.company.name} · ${data.job.title}`, `Material stage: ${stageNames[stage]}`,
    `Assessment revision: ${record?.assessmentRevision ?? 'Not assessed'}`,
    `Assessment provenance: ${annotationLabel(record?.annotationMode)}`,
    `Rubric: ${record?.rubricVersion ?? data.rubricVersion}`,
    `Rubric calibration: ${data.rubric.calibrationStatus}`,
    '', '## Reading these results',
    'Core analytical evidence match covers SQL, Data Analysis and Business Problem Solving only. It is not a full JD match, hiring probability or hiring decision.',
    'NE means insufficient evidence, not zero. Not assessed means no saved judgment. Assessed points are accumulated, never scaled up.',
    'This is a synthetic demonstration. Application preset annotations were AI-authored; human calibration remains pending. Quoted text does not prove execution or independent authorship. SQL is reviewed statically.',
    '', '## Server-calculated results',
    `Core analytical evidence match: ${record?.score.overallPercentage == null ? 'Not available · incomplete evidence or assessment' : percent(record.score.overallPercentage)}`,
    `Evidence coverage: ${percent(record?.score.coveragePercent)}`,
    `Assessed points: ${record ? `${record.score.accruedScore.toFixed(1)}/100` : 'Not assessed'}`,
    ...data.rubric.requirements.map(r => `${r.title}: ${percent(record?.score.skills.find(s => s.requirementId === r.id)?.percentage)} · maximum ${r.maxScore} points`),
    '', '## Public standards and judgments',
    'Criterion contribution = mark / 4 × 10. Values below are supplied by the server.',
  ];
  for (const criterion of data.rubric.criteria) {
    const direct = record?.items.find(item => item.criterionId === criterion.id);
    const reused = !direct ? record?.reusedItems.find(item => item.criterionId === criterion.id) : undefined;
    const item = direct ?? reused;
    const sourceContext = reused ? stageContext(data, 'application_review')! : context;
    const contribution = record?.score.criteria.find(c => c.criterionId === criterion.id)?.contribution;
    lines.push('', `### ${criterion.id} · ${criterion.title}`, criterion.observableSupport,
      `Anchors: 0/4 — ${criterion.anchors['0']}; 2/4 — ${criterion.anchors['2']}; 4/4 — ${criterion.anchors['4']}`,
      `Mark: ${item?.mark ?? 'Not assessed'}`, `Contribution: ${contribution == null ? 'Not available' : `${contribution.toFixed(1)}/10`}`);
    if (!item) continue;
    if (reused) lines.push(`Explicitly reused application assessment revision ${record?.reuseApplication?.assessmentRevision}. This is not task-authored evidence.`);
    lines.push(`Judgment: ${item.rationale}`, `Support: ${item.support}`, `Gap: ${item.gaps}`, `Uncertainty: ${item.uncertainty}`, `Next step: ${item.nextStep}`, `Checked sources: ${item.checkedSourceIds.join(', ')}`);
    for (const ref of item.sourceRefs) {
      if (resolveSourceRef(data.candidate.id, sourceContext, ref)) lines.push(`Source: ${ref.sourceId} · ${ref.location} · snapshot ${ref.evidenceSnapshotId} · UTF-16 ${ref.start}–${ref.end}`, `Quotation: ${ref.quote}`);
      else lines.push('Source warning: quotation binding could not be verified; passage omitted.');
    }
  }
  if (version) {
    lines.push('', `## V${version.submission.submissionVersion} public work`, workMarkdown(version.submission),
      '', '## Evidence review and analysis',
      version.review ? `Human review: ${version.review.decision}\nPublic feedback: ${version.review.comment}` : 'Human review: pending',
      `Analysis status: ${version.analysis.status}`,
      `Analysis mode: ${version.analysis.result?.mode ?? 'No result for this version'}`,
      `Configured service mode: ${data.capabilities.analysisMode}`,
      'Manual simulation is a deterministic rules run, not a live model call. Evidence review, rubric assessment and shortlist decisions are independent.');
  }
  lines.push('', '## Source inventory', ...context.sources.map(source => `${source.sourceId} · ${source.location}`),
    '', '## Reproducibility details', `Candidate: ${data.candidate.id}`, `Session: ${data.sessionId}`, `Dataset: ${data.datasetVersion}`, `Fixture: ${data.fixtureVersion}`, `Snapshot: ${context.evidenceSnapshotId}`, `Fingerprint: ${context.fingerprint}`,
    'Private notes and unsubmitted drafts are excluded. This export describes only the selected material stage and assessment revision.');
  return lines.join('\n\n');
}
