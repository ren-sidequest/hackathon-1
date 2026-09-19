/** Versioned repository materials. This is fixed content loading, not a general upload facility. */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fingerprint } from '../fingerprint.js';
import type { CriterionId, Mark } from './rubric.js';
export const CONTENT_ROOT = new URL('../../content/r6/', import.meta.url);
export const JD_VERSION = 'harbour-retail-junior-analyst-jd-v1' as const;
interface ManifestFile {
  file: string; sha256: string; sizeBytes: number; origin: string; publication: string;
  pages?: number; originalSha256?: string; changedFromInput?: boolean;
  redaction?: { removedFields: string[]; originalSha256: string; note: string };
}
export interface ContentManifest {
  packVersion: string; jdVersion: string; rubricVersion: string; datasetVersion: string; websiteLanguage: 'en';
  status: string; candidateProvenance: string; originalPdfCount: number; syntheticCompanionCount: number;
  files: ManifestFile[]; changes: { file: string; reason: string; originalSha256: string; sha256: string }[];
  calibration: { actualAnnotation: string; actualReview: string; humanCalibration: 'pending'; externalExpertValidation: false };
}
export const CONTENT_MANIFEST: ContentManifest = JSON.parse(readFileSync(new URL('manifest.json', CONTENT_ROOT), 'utf8')) as ContentManifest;
export function readContentText(file: string): string {
  const entry = CONTENT_MANIFEST.files.find(item => item.file === file);
  if (!entry || file.includes('..') || file.startsWith('/')) throw new Error('Unknown fixed content file.');
  const bytes = readFileSync(new URL(file, CONTENT_ROOT));
  if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw new Error(`Content integrity mismatch: ${file}`);
  return bytes.toString('utf8');
}
export interface CitationDraft { sourceId: string; quote: string }
export interface AnnotationDraft {
  criterionId: CriterionId; mark: Mark; rationale: string; support: string; gaps: string;
  uncertainty: string; nextStep: string; citations: CitationDraft[];
}
export type JDAlignmentStatus = 'not_reviewed' | 'claimed_in_cv' | 'work_sample_evidence' | 'further_evidence_needed';
export interface JDAlignmentDraft {
  jdRequirementId: string; statuses: JDAlignmentStatus[]; summary: string; remainingUnknowns: string; citations: CitationDraft[];
}
export interface JDRequirement {
  id: string; category: 'essential' | 'desirable' | 'responsibility'; statement: string;
  page: number; start: number; end: number; quote: string; criterionIds: CriterionId[];
}
export interface SourceProvenance {
  origin: 'user_supplied_fictional_cv' | 'synthetic_demo_work_sample';
  filePath: string; sha256: string; pageNumbers: number[]; disclosure: string; downloadUrl?: string;
  redaction?: { removedFields: string[]; originalSha256: string };
}
const jdText = readContentText('job-description-extracted.txt');
export const JD = {
  version: JD_VERSION, sourceId: 'job-description', filePath: 'app/backend/content/r6/job-description.pdf',
  sha256: CONTENT_MANIFEST.files.find(x => x.file === 'job-description.pdf')!.sha256, pages: 4,
  source: { sourceId: 'job-description', location: '/job/jd/source/text', text: jdText,
    fingerprint: fingerprint({ version: JD_VERSION, sourceId: 'job-description', text: jdText }),
    sha256: CONTENT_MANIFEST.files.find(x => x.file === 'job-description-extracted.txt')!.sha256,
    downloadUrl: '/api/demo/materials/job-description.pdf' },
  requirements: JSON.parse(readContentText('jd-requirements.json')) as JDRequirement[],
  scope: 'The unchanged user-supplied demonstration JD defines the role. Requirements are a traceable implementation interpretation, not extra employer-authored criteria. The ten-item 30/30/40 core rubric is a prior team demo policy; this wider JD evidence matrix has no additional percentage.',
};
for (const requirement of JD.requirements) {
  if (jdText.slice(requirement.start, requirement.end) !== requirement.quote) throw new Error('Invalid JD source range.');
}
export const ANNOTATION_DRAFTS = JSON.parse(readContentText('annotations.json')) as Record<string, AnnotationDraft[]>;
export const JD_ALIGNMENT_DRAFTS = JSON.parse(readContentText('jd-alignment.json')) as Record<string, JDAlignmentDraft[]>;
export function applicationContent(candidateId: string): { sourceId: string; text: string; provenance: SourceProvenance }[] {
  const samples = CONTENT_MANIFEST.files.filter(f => f.file.startsWith(`${candidateId}/`)
    && (f.origin === 'redacted_public_cv_text' || f.origin === 'synthetic_demo_work_sample'));
  if (samples.length !== 3) throw new Error('Unexpected fixed candidate material set.');
  return samples.sort((a, b) => a.origin === 'redacted_public_cv_text' ? -1 : b.origin === 'redacted_public_cv_text' ? 1 : a.file.localeCompare(b.file)).map(f => ({
    sourceId: f.file.slice(candidateId.length + 1), text: readContentText(f.file),
    provenance: f.origin === 'redacted_public_cv_text' ? {
      origin: 'user_supplied_fictional_cv', filePath: `app/backend/content/r6/${f.file}`, sha256: f.sha256,
      pageNumbers: [1], downloadUrl: `/api/demo/materials/${candidateId}/cv.pdf`,
      disclosure: 'User-supplied fictional CV. Public text omits unnecessary contact headers. The explicit Original CV download preserves the unredacted fictional PDF bytes and may include fictional contact details. CV statements are not independently verified.',
      redaction: { removedFields: f.redaction!.removedFields, originalSha256: f.redaction!.originalSha256 },
    } : {
      origin: 'synthetic_demo_work_sample', filePath: `app/backend/content/r6/${f.file}`, sha256: f.sha256,
      pageNumbers: [], disclosure: 'Synthetic demo work sample newly authored from the fictional CV scope; not attached to the original CV, not independently recovered work, and not a formal employer-task submission.',
    },
  }));
}
