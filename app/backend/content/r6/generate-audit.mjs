/** Generate/check inspectable R6 content artifacts from the actual built fixtures; no database or network. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { CANDIDATE_IDS, getApplication, JOB, B3_EXPLANATION, FIXTURE_VERSION, validateSourceRef } from '../../dist/r5/fixtures.js';
import { RUBRIC_VERSION } from '../../dist/r5/rubric.js';
import { DATASET_VERSION, createSeed } from '../../dist/r5/task-seed.js';
const mode = process.argv[2] ?? '--check';
if (!['--check', '--write'].includes(mode)) throw new Error('Usage: generate-audit.mjs [--check|--write]');
const root = new URL('./', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8'));
for (const entry of manifest.files) {
  const bytes = readFileSync(new URL(entry.file, root));
  assert.equal(bytes.length, entry.sizeBytes, `${entry.file} size`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, `${entry.file} SHA-256`);
}
const candidates = CANDIDATE_IDS.map(candidateId => {
  const a = getApplication(candidateId);
  return { candidateId, evidenceSnapshotId: a.evidenceSnapshotId, fingerprint: a.fingerprint,
    annotationMode: a.baseline.annotationMode, humanCalibration: a.baseline.provenance.humanCalibration,
    assessmentComplete: a.baseline.assessmentComplete, items: a.baseline.items, score: a.baseline.score, jdAlignment: a.jdAlignment };
});
const refs = candidates.flatMap(c => [...c.items.flatMap(i => i.sourceRefs), ...c.jdAlignment.flatMap(i => i.sourceRefs)]);
assert.ok(refs.every(ref => validateSourceRef(getApplication(ref.candidateId), ref)));
const audit = {
  fixtureVersion: FIXTURE_VERSION, rubricVersion: RUBRIC_VERSION, jdVersion: JOB.jd.version, datasetVersion: DATASET_VERSION,
  status: 'ai_authored_local_review_human_calibration_pending',
  checks: { candidates: candidates.length, assessmentItems: candidates.flatMap(c => c.items).length,
    ownedUtf16Citations: refs.length, jdRequirements: JOB.jd.requirements.length,
    jdAlignmentRows: candidates.flatMap(c => c.jdAlignment).length,
    scoreMethod: 'mark / 4 * 10, with NE producing null overall; fixed 30/30/40 weights',
    sourceHashVerification: `All ${manifest.files.length} manifest file hashes and sizes checked; original PDF page checks are recorded separately.` },
  notPerformed: ['Human rubric calibration', 'Independent expert validation', 'Original SQL execution',
    'CV employment or education verification', 'Model execution or measured AUC', 'New frontend browser integration', 'Deployment'],
  candidates, b3Explanation: B3_EXPLANATION,
};
for (const [file, value] of [['assessment-audit.json', audit], ['harbour-retail-task-dataset.json', createSeed().dataset]]) {
  const bytes = `${JSON.stringify(value, null, 2)}\n`;
  if (mode === '--write') writeFileSync(new URL(file, root), bytes);
  else assert.equal(readFileSync(new URL(file, root), 'utf8'), bytes, `${file} matches actual runtime fixtures`);
}
console.log(`PASS: ${mode}, ${candidates.length} applicants, ${audit.checks.assessmentItems} items, ${refs.length} owned citations, ${manifest.files.length} file hashes/sizes.`);
