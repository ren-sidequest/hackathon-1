import assert from 'node:assert/strict';
import test from 'node:test';
import { fingerprint } from '../dist/fingerprint.js';
import { createSeed, DATASET_VERSION } from '../dist/seed.js';
import { CRITERIA, CRITERION_IDS, REQUIREMENT_IDS, RUBRIC, RUBRIC_VERSION } from '../dist/r5/rubric.js';
import { calculateScores, isMark } from '../dist/r5/scoring.js';
import { B3_EXPLANATION, CANDIDATES, CANDIDATE_IDS, COMPANY, FIXTURE_VERSION, JOB, TASK_TEMPLATES,
  getApplication, validateAssessmentItems, validateSourceRef } from '../dist/r5/fixtures.js';

const items = marks => CRITERION_IDS.map((criterionId, index) => ({ criterionId, mark: marks[index] }));
const percentages = result => result.skills.map(s => s.percentage === null ? null : s.percentage.toFixed(1));
const vectors = [
  { id: 'A', marks: [3, 3, 3, 3, 3, 3, 2, 2, 'NE', 'NE'], skills: ['75.0', '75.0', null], overall: null, coverage: 80, accrued: 55 },
  { id: 'B', marks: [2, 2, 'NE', 3, 3, 3, 3, 3, 3, 3], skills: [null, '75.0', '75.0'], overall: null, coverage: 90, accrued: 62.5 },
  { id: 'C', marks: [3, 3, 3, 4, 3, 3, 3, 3, 3, 4], skills: ['75.0', '83.3', '81.3'], overall: 80, coverage: 100, accrued: 80 },
  { id: 'D', marks: [4, 4, 3, 3, 3, 2, 2, 1, 1, 1], skills: ['91.7', '66.7', '31.3'], overall: 60, coverage: 100, accrued: 60 },
];
for (const vector of vectors) test(`R5 independent arithmetic vector ${vector.id}`, () => {
  const input = items(vector.marks);
  const result = calculateScores(input);
  assert.deepEqual(percentages(result), vector.skills);
  assert.equal(result.overallScore, vector.overall);
  assert.equal(result.overallPercentage, vector.overall);
  assert.equal(result.coveragePercent, vector.coverage);
  assert.equal(result.accruedScore, vector.accrued);
  assert.equal(result.assessmentComplete, true);
  assert.equal(result.complete, vector.overall !== null);
  assert.equal(result.status, vector.overall === null ? 'needs_evidence' : 'complete');
  assert.deepEqual(calculateScores(input.toReversed()), result, 'criterion ordering is fixed, not caller-dependent');
  assert.deepEqual(input, items(vector.marks), 'scoring leaves input untouched');
});

test('R5 raw values drive sums and percentages, without intermediate display rounding', () => {
  const result = calculateScores(items(vectors[2].marks));
  assert.equal(result.skills[1].percentage, 25 / 30 * 100);
  assert.equal(result.skills[2].percentage, 32.5 / 40 * 100);
  assert.equal(result.overallScore, 22.5 + 25 + 32.5);
});


test('R5 fixed 100-point overall percentage retains every exact 2.5-point total', () => {
  for (let totalMarks = 0; totalMarks <= 40; totalMarks++) {
    let remaining = totalMarks;
    const marks = Array.from({ length: 10 }, () => { const mark = Math.min(4, remaining); remaining -= mark; return mark; });
    const result = calculateScores(items(marks));
    assert.equal(result.overallScore, totalMarks * 2.5);
    assert.equal(result.overallPercentage, result.overallScore);
  }
});

test('R5 zero, NE and unassessed states stay separate', () => {
  const zero = calculateScores(items(Array(10).fill(0)));
  const ne = calculateScores(items(Array(10).fill('NE')));
  const pending = calculateScores([], { allowPartial: true });
  assert.equal(zero.overallScore, 0); assert.equal(zero.coveragePercent, 100); assert.equal(zero.status, 'complete');
  assert.equal(ne.overallScore, null); assert.equal(ne.coveragePercent, 0); assert.equal(ne.status, 'needs_evidence');
  assert.equal(pending.overallScore, null); assert.equal(pending.coveragePercent, null); assert.equal(pending.status, 'pending');
  assert.ok(ne.criteria.every(c => c.mark === 'NE' && c.contribution === null));
  assert.ok(pending.criteria.every(c => c.mark === null && c.contribution === null));
  assert.ok(zero.criteria.every(c => c.mark === 0 && c.contribution === 0));
  assert.ok(ne.skills.every(s => s.assessmentComplete && !s.complete && s.score === null));
  assert.ok(pending.skills.every(s => !s.assessmentComplete && !s.complete && s.score === null));
});

test('R5 exact targeted criterion groups leave all non-targets pending instead of borrowing baseline scores', () => {
  for (const targetRequirementId of REQUIREMENT_IDS) {
    const target = CRITERIA.filter(c => c.requirementId === targetRequirementId).map(c => ({ criterionId: c.id, mark: 4 }));
    const result = calculateScores(target, { targetRequirementId });
    assert.equal(result.overallScore, null); assert.equal(result.coveragePercent, null); assert.equal(result.status, 'pending');
    assert.equal(result.skills.find(s => s.requirementId === targetRequirementId).percentage, 100);
    assert.ok(result.criteria.filter(c => c.requirementId !== targetRequirementId).every(c => c.mark === null && c.status === 'pending'));
    assert.throws(() => calculateScores(target.slice(1), { targetRequirementId }), /complete criterion group/);
    assert.throws(() => calculateScores(items(Array(10).fill(4)), { targetRequirementId }), /non-target criterion/);
  }
});

test('R5 rejects invalid marks, duplicate/unknown criteria and incomplete final groups', () => {
  for (const mark of [-1, 5, 0.5, NaN, Infinity, '0', null, undefined, true, 'ne']) {
    assert.equal(isMark(mark), false);
    assert.throws(() => calculateScores([{ criterionId: 'S1', mark }], { allowPartial: true }), /Mark/);
  }
  for (const mark of [0, 1, 2, 3, 4, 'NE']) assert.equal(isMark(mark), true);
  assert.throws(() => calculateScores([{ criterionId: 'S1', mark: 2 }, { criterionId: 'S1', mark: 3 }], { allowPartial: true }), /Duplicate/);
  assert.throws(() => calculateScores([{ criterionId: 'B5', mark: 2 }], { allowPartial: true }), /Unknown/);
  assert.throws(() => calculateScores([], { targetRequirementId: 'python' }), /Unknown target/);
  assert.throws(() => calculateScores([]), /complete criterion group/);
  assert.throws(() => calculateScores({}), /array/);
});

test('R5 company, job and complete fixed rubric expose detailed 4/2/0 anchors', () => {
  assert.equal(COMPANY.provenance, 'synthetic'); assert.equal(COMPANY.name, 'HarbourCart Pty Ltd');
  assert.equal(COMPANY.approximateHeadcount, 25); assert.equal(COMPANY.dedicatedRecruitingTeam, false);
  assert.equal(JOB.id, 'junior-data-analyst'); assert.deepEqual(JOB.requirements.map(r => r.id), REQUIREMENT_IDS);
  assert.equal(RUBRIC.version, 'harbourcart-rubric-v1');
  assert.deepEqual(CRITERIA.map(c => c.id), CRITERION_IDS);
  assert.deepEqual(RUBRIC.requirements.map(r => r.maxScore), [30, 30, 40]);
  for (const criterion of CRITERIA) {
    assert.equal(criterion.maxScore, 10);
    for (const mark of [4, 2, 0]) assert.ok(criterion.anchors[mark].length >= 15);
    assert.equal(new Set(Object.values(criterion.anchors)).size, 3);
  }
  assert.equal(RUBRIC.rules.neIsZero, false); assert.equal(RUBRIC.rules.autoPassThreshold, null);
  assert.equal(RUBRIC.calibrationStatus, 'human_calibration_pending');
  assert.throws(() => { CRITERIA[0].maxScore = 20; }, TypeError);
});

test('R5 every fixture has distinct owned texts, stable fingerprint and ten fully bound source-backed annotations', () => {
  assert.deepEqual(CANDIDATES.map(c => c.id), ['alex-chen', 'maya-patel', 'leo-zhang', 'sam-taylor']);
  const snapshots = CANDIDATE_IDS.map(getApplication);
  assert.equal(new Set(snapshots.map(s => s.fingerprint)).size, 4);
  for (const snapshot of snapshots) {
    const { candidateId, jobId, fixtureVersion, materialVersion, evidenceSnapshotId, sources, baseline } = snapshot;
    assert.equal(snapshot.provenance, 'synthetic'); assert.equal(fixtureVersion, 'harbourcart-applications-v1');
    assert.equal(snapshot.fingerprint, fingerprint({ candidateId, jobId, fixtureVersion, materialVersion, evidenceSnapshotId, sources }));
    assert.ok(sources.length >= 3); assert.ok(sources.every(s => s.kind === 'application'));
    assert.equal(baseline.candidateId, candidateId); assert.equal(baseline.evidenceSnapshotId, evidenceSnapshotId);
    assert.equal(baseline.fingerprint, snapshot.fingerprint); assert.equal(baseline.rubricVersion, RUBRIC_VERSION);
    assert.equal(baseline.fixtureVersion, FIXTURE_VERSION); assert.equal(baseline.jobId, JOB.id);
    assert.equal(baseline.stage, 'application_review'); assert.equal(baseline.assessmentRevision, 1);
    assert.equal(baseline.annotationMode, 'preset_human'); assert.equal(baseline.label, '合成案例·预置人工评估');
    assert.equal(baseline.provenance.actualAnnotation, 'ai_agent_authored_fixture');
    assert.equal(baseline.provenance.actualReview, 'ai_agent_review');
    assert.equal(baseline.provenance.humanCalibration, 'pending'); assert.equal(baseline.provenance.externalExpertValidation, false);
    assert.deepEqual(baseline.items.map(i => i.criterionId), CRITERION_IDS);
    validateAssessmentItems(snapshot, baseline.items, CRITERION_IDS);
    for (const item of baseline.items) {
      assert.ok(item.rationale && item.support && item.gaps && item.nextStep && item.uncertainty);
      assert.ok(item.checkedSourceIds.length > 0);
      if (item.mark !== 'NE') assert.ok(item.sourceRefs.length > 0);
      for (const ref of item.sourceRefs) assert.ok(validateSourceRef(snapshot, ref));
    }
    assert.deepEqual(baseline.score, calculateScores(baseline.items));
    assert.ok(vectors.every(vector => JSON.stringify(vector.marks) !== JSON.stringify(baseline.items.map(i => i.mark))), 'arithmetic vectors are not assigned to people');
    assert.deepEqual(snapshot.initialReport.map(r => r.requirementId), REQUIREMENT_IDS);
    for (const report of snapshot.initialReport) {
      assert.equal(report.mode, 'preset'); assert.ok(report.summary && report.uncertainty);
      assert.ok(report.sourceRefs.every(ref => validateSourceRef(snapshot, ref)));
    }
  }
  assert.notEqual(snapshots[1].sources.find(s => s.sourceId === 'analysis.md').text, snapshots[2].sources.find(s => s.sourceId === 'analysis.md').text);
});

test('R5 source validation rejects cross-person same-name files, stale snapshots, bad offsets and unbound reasons', () => {
  const maya = getApplication('maya-patel'); const leo = getApplication('leo-zhang');
  const sourceRef = maya.baseline.items.find(i => i.criterionId === 'D1').sourceRefs[0];
  assert.ok(leo.sources.some(s => s.sourceId === sourceRef.sourceId), 'same source ID is valid in distinct namespaces');
  assert.equal(validateSourceRef(leo, sourceRef), false);
  for (const patch of [{ candidateId: 'leo-zhang' }, { evidenceSnapshotId: 'stale' }, { fingerprint: '0'.repeat(64) },
    { location: '/wrong' }, { sourceId: 'other.md' }, { start: -1 }, { start: 0.5 }, { end: Infinity }, { end: sourceRef.end + 1 }, { quote: '' }, { quote: `${sourceRef.quote}x` }]) {
    assert.equal(validateSourceRef(maya, { ...sourceRef, ...patch }), false);
  }
  const base = maya.baseline.items;
  for (const patch of [{ sourceRefs: [] }, { checkedSourceIds: [] }, { checkedSourceIds: ['foreign.sql'] }, { rationale: ' ' }, { gaps: '' }, { support: '' }, { nextStep: '' }, { uncertainty: '' }]) {
    const revised = structuredClone(base); Object.assign(revised[3], patch);
    assert.throws(() => validateAssessmentItems(maya, revised));
  }
  const ne = structuredClone(base); ne[0].checkedSourceIds = [];
  assert.throws(() => validateAssessmentItems(maya, ne));
  const mismatch = structuredClone(base); mismatch[0].mark = 0;
  assert.throws(() => validateAssessmentItems(maya, mismatch), /source binding/);
  assert.throws(() => validateAssessmentItems(maya, [...base, base[0]]));
  assert.throws(() => validateAssessmentItems(maya, base.slice(0, 3), CRITERION_IDS), /expected criterion/);
  validateAssessmentItems(maya, base.slice(0, 3), ['S1', 'S2', 'S3']);
});

test('R5 actual Alex B3 example includes Chinese, newline and emoji with exact UTF-16 offsets', () => {
  const application = getApplication('alex-chen');
  const b3 = application.baseline.items.find(i => i.criterionId === 'B3'); const ref = b3.sourceRefs[0];
  assert.equal(b3.mark, 2); assert.equal(B3_EXPLANATION.contribution, 5);
  assert.match(ref.quote, /🔎.*\n.*campaign × device/);
  assert.ok(ref.quote.length > Array.from(ref.quote).length, 'emoji occupies two UTF-16 code units');
  const source = application.sources.find(s => s.sourceId === ref.sourceId);
  assert.equal(source.text.slice(ref.start, ref.end), ref.quote);
  assert.equal(ref.end - ref.start, ref.quote.length);
  assert.equal(validateSourceRef(application, { ...ref, end: ref.start + Array.from(ref.quote).length }), false);
  assert.deepEqual(B3_EXPLANATION.sourceRefs, b3.sourceRefs);
});

test('R5 immutable preset fixtures return detached snapshots and reject implicit Alex selection', () => {
  const first = getApplication('alex-chen'); const second = getApplication('alex-chen');
  assert.deepEqual(first, second);
  first.sources[0].text = 'changed'; first.baseline.items[0].mark = 0;
  assert.deepEqual(second, getApplication('alex-chen'));
  for (const invalid of ['', undefined, null, 'alex', '__proto__']) assert.throws(() => getApplication(invalid), /Unknown candidate/);
  assert.throws(() => { CANDIDATES[0].name = 'changed'; }, TypeError);
});

test('R5 all three templates use the unchanged seed resources and are not restricted by candidate name', () => {
  const seed = createSeed();
  assert.equal(Object.keys(TASK_TEMPLATES).length, 3);
  for (const targetRequirementId of REQUIREMENT_IDS) {
    const template = TASK_TEMPLATES[targetRequirementId];
    assert.equal(template.targetRequirementId, targetRequirementId); assert.equal(template.timeboxMinutes, 20);
    assert.equal(template.timeboxEnforced, false); assert.equal(template.datasetVersion, DATASET_VERSION);
    assert.deepEqual(template.resourceIds, seed.dataset.resources.map(r => r.id));
    assert.ok(template.instructions.includes(DATASET_VERSION));
    assert.equal(Object.hasOwn(template, 'candidateId'), false);
  }
  assert.deepEqual(TASK_TEMPLATES.sql.observationDimensions, ['S1', 'S2', 'S3']);
  assert.deepEqual(TASK_TEMPLATES['data-analysis'].observationDimensions, ['D1', 'D2', 'D3']);
  assert.equal(TASK_TEMPLATES['business-problem-solving'].observationDimensions.length, 5);
  assert.equal(seed.dataset.metrics.previous.sessions, 1000000);
  assert.equal(seed.dataset.metrics.current.sessions, 1180000);
  assert.equal(seed.dataset.metrics.previous.orders, 34000);
  assert.equal(seed.dataset.metrics.current.orders, 30680);
  assert.equal(seed.dataset.metrics.previous.adSpendCents, 4173913);
  assert.equal(seed.dataset.metrics.current.adSpendCents, 4800000);
});
