import { describe, expect, it } from 'vitest';
import initial from '../../../docs/backend/r5/examples/initial-alex-chen.response.json';
import comparisonFixture from '../../../docs/backend/r5/examples/comparison-initial.response.json';
import v2Fixture from '../../../docs/backend/r5/examples/alex-chen-v2-submission.response.json';
import type { Comparison, Demo } from '../../shared/api3-types';
import { comparisonCounts } from '../../shared/api3/hr-model';
import { assessmentReport } from '../../shared/api3/report';
import { nextStep, savedActionDestination } from '../../shared/api3/next-step';
import { writeAccessUrl } from '../../shared/api3/access';

const data = initial.data as Demo;
describe('frontend-only clarity and export', () => {
  it('counts reviewed NE judgments separately from complete evidence', () => {
    const list = structuredClone(comparisonFixture.data) as Comparison;
    const counts = comparisonCounts(list);
    expect(counts.reviewed).toBe(4);
    expect(counts.complete).toBeLessThan(counts.reviewed);
    list.candidates[0].assessment = null;
    expect(comparisonCounts(list).reviewed).toBe(3);
  });
  it('offers only the existing same-origin gateway login', () => {
    expect(writeAccessUrl('/gateway', 'https://example.org')).toBe('https://example.org/gateway/write-access');
    expect(writeAccessUrl('https://other.org/gateway', 'https://example.org')).toBeNull();
    expect(writeAccessUrl('http://127.0.0.1:8787', 'http://127.0.0.1:6373')).toBeNull();
  });
  it('exports NE distinctly, server points, standards and valid source locations', () => {
    const report = assessmentReport(data, 'application_review');
    expect(report).toContain('Mark: NE');
    expect(report).toContain(`${data.assessment.application_review!.score.accruedScore.toFixed(1)}/100`);
    expect(report).toContain('human calibration remains pending');
    expect(report).toContain('UTF-16');
    expect(report).toContain('not a full JD match');
    expect(report).toContain(data.rubric.criteria[0].anchors['4']);
  });
  it('omits invalid cross-person quotes instead of attributing them to this person', () => {
    const record = structuredClone(data.assessment.application_review!);
    record.items[0].sourceRefs[0].candidateId = 'maya-patel';
    record.items[0].sourceRefs[0].quote = 'WRONG_PERSON_SECRET';
    const report = assessmentReport(data, 'application_review', record);
    expect(report).not.toContain('WRONG_PERSON_SECRET');
    expect(report).toContain('quotation binding could not be verified');
    record.candidateId = 'maya-patel';
    expect(() => assessmentReport(data, 'application_review', record)).toThrow('do not match');
  });
  it('keeps selected V1 and V2 public work and analysis separate and excludes draft fields', () => {
    const demo = Object.assign(structuredClone(v2Fixture.data) as Demo, { notes: 'PRIVATE_DRAFT_NOT_FOR_EXPORT' });
    demo.versions[0].submission.summary = 'UNIQUE_V1_TEXT';
    demo.versions[1].submission.summary = 'UNIQUE_V2_TEXT';
    const report = assessmentReport(demo, 'task_v2');
    expect(report).toContain('UNIQUE_V2_TEXT');
    expect(report).not.toContain('UNIQUE_V1_TEXT');
    expect(report).not.toContain(demo.notes);
    expect(report).toContain('Mark: Not assessed');
    expect(report).toContain('Analysis status: not_started');
  });
  it('routes saved assessment and shortlist actions to their own results', () => {
    expect(savedActionDestination('/assessment', 'hr').page).toBe('evidence');
    expect(savedActionDestination('/assessment', 'hr', 'task_v1').page).toBe('tasks');
    expect(savedActionDestination('/assessment', 'hr', 'task_v2').page).toBe('tasks');
    expect(savedActionDestination('/shortlist', 'hr').page).toBe('shortlist');
    expect(savedActionDestination('/submission', 'candidate').page).toBe('history');
    expect(nextStep(data, 'hr', 'company').page).toBe('evidence');
    expect(nextStep(v2Fixture.data as Demo, 'hr', 'evidence').page).toBe('tasks');
  });
});
