import { describe, expect, it } from 'vitest';
import initial from '../../../docs/backend/r5/examples/initial-alex-chen.response.json';
import comparisonFixture from '../../../docs/backend/r5/examples/comparison-initial.response.json';
import analyzedFixture from '../../../docs/backend/r5/examples/alex-chen-v1-analysis.response.json';
import type { Comparison, Demo, SourceRef } from '../../shared/api3-types';
import { stageContext } from '../../shared/api3/client';
import { annotationLabel, analysisSource, assessmentProblem, compareValue, latestStage, percent, resolveSourceRef, sortComparison, type DraftItem } from '../../shared/api3/hr-model';
const data = initial.data as Demo;
const comparison = comparisonFixture.data as Comparison;
const context = stageContext(data, 'application_review')!;
const entries = () => structuredClone(data.assessment.application_review!.items) as DraftItem[];

describe('API3 HR evidence binding and grouped assessments', () => {
  it('accepts the service-authored application rubric without recalculating it', () => {
    expect(assessmentProblem(data.candidate.id, context, entries())).toBeNull();
    for (const item of entries()) for (const ref of item.sourceRefs) expect(resolveSourceRef(data.candidate.id, context, ref)).not.toBeNull();
  });
  it('validates UTF-16 emoji and newline boundaries, not unicode-codepoint offsets', () => {
    const text = 'A🔎\n中文证据', source = { sourceId: 'source', location: 'public', text };
    const local = { ...context, sources: [source] };
    const ref: SourceRef = { candidateId: data.candidate.id, evidenceSnapshotId: context.evidenceSnapshotId, fingerprint: context.fingerprint, sourceId: source.sourceId, location: source.location, start: 4, end: text.length, quote: '中文证据' };
    expect(resolveSourceRef(data.candidate.id, local, ref)).toEqual(source);
    expect(resolveSourceRef(data.candidate.id, local, { ...ref, start: 3 })).toBeNull();
    expect(resolveSourceRef(data.candidate.id, local, { ...ref, end: 999 })).toBeNull();
  });
  it('rejects cross-person, location, fingerprint and snapshot citations even when words match', () => {
    const ref = entries().flatMap(e => e.sourceRefs)[0];
    expect(resolveSourceRef('sam-taylor', context, ref)).toBeNull();
    expect(resolveSourceRef(data.candidate.id, context, { ...ref, location: 'other' })).toBeNull();
    expect(resolveSourceRef(data.candidate.id, context, { ...ref, fingerprint: 'f'.repeat(64) })).toBeNull();
    expect(resolveSourceRef(data.candidate.id, context, { ...ref, evidenceSnapshotId: 'other' })).toBeNull();
  });
  it('requires all five explanations and a reviewed source for NE', () => {
    const items = entries(); items[0].mark = 'NE'; items[0].sourceRefs = [];
    expect(assessmentProblem(data.candidate.id, context, items)).toBeNull();
    items[0].checkedSourceIds = [];
    expect(assessmentProblem(data.candidate.id, context, items)).toContain('sources you checked');
    items[0].checkedSourceIds = [context.sources[0].sourceId]; items[0].uncertainty = '';
    expect(assessmentProblem(data.candidate.id, context, items)).toContain('uncertainty');
  });
  it('requires every quoted source to be explicitly checked', () => {
    const items = entries(); const quote = items[0].sourceRefs[0];
    items[0].checkedSourceIds = [context.sources.find(s => s.sourceId !== quote.sourceId)!.sourceId];
    expect(assessmentProblem(data.candidate.id, context, items)).toContain('mark every quoted source as checked');
  });
  it('does not treat an observed zero as missing evidence or permit uncited numerical marks', () => {
    const items = entries(); items[0].mark = 0;
    expect(assessmentProblem(data.candidate.id, context, items)).toBeNull();
    items[0].sourceRefs = [];
    expect(assessmentProblem(data.candidate.id, context, items)).toContain('including 0');
  });
  it('does not partially save an unassessed criterion', () => {
    const items = entries(); items[items.length - 1].mark = null;
    expect(assessmentProblem(data.candidate.id, context, items)).toContain('All criteria in this group');
  });
  it('rejects a quotation longer than the API source reference contract', () => {
    const items = entries(); items[0].sourceRefs[0].quote = 'x'.repeat(2001);
    expect(assessmentProblem(data.candidate.id, context, items)).toContain('quotation');
  });
});

describe('API3 HR comparison and task observations', () => {
  it('labels synthetic AI annotation separately from actual human assessment', () => {
    expect(annotationLabel('preset_human')).toBe('AI-authored preset · human calibration pending');
    expect(annotationLabel('human')).toBe('Human assessment');
    expect(annotationLabel('human_reviewed')).toBe('Human assessment');
    expect(annotationLabel(undefined)).toBe('Not assessed');
  });
  it('formats service score once and distinguishes no result from zero', () => {
    expect(percent(null)).toBe('—'); expect(percent(0)).toBe('0.0%'); expect(percent(83.333333)).toBe('83.3%');
  });
  it('sorts only comparable application values and preserves ties without a name tie-break', () => {
    const rows = structuredClone(comparison.candidates);
    rows[0].assessment!.score.overallPercentage = 50;
    rows[1].assessment!.score.overallPercentage = 50;
    rows[2].assessment!.score.overallPercentage = null;
    rows[3].assessment!.score.overallPercentage = 75;
    const sorted = sortComparison(rows, 'overall');
    expect(sorted.map(row => row.candidate.id)).toEqual([rows[3].candidate.id, rows[0].candidate.id, rows[1].candidate.id, rows[2].candidate.id]);
    expect(compareValue(sorted[3], 'overall')).toBeNull();
    expect(rows[0].candidate.id).toBe(comparison.candidates[0].candidate.id);
  });
  it('retains the backend display order until the person explicitly selects a sort', () => {
    expect(sortComparison(comparison.candidates, 'default')).toBe(comparison.candidates);
  });
  it('binds analysis quotes to the selected formal submission and its exact source', () => {
    const analyzed = analyzedFixture.data as Demo, version = analyzed.versions[0];
    const quote = version.analysis.result!.observations.flatMap(o => o.citations)[0];
    expect(analysisSource(version, quote)).not.toBeNull();
    expect(analysisSource({ ...version, analysis: { ...version.analysis, contentFingerprint: 'f'.repeat(64) } }, quote)).toBeNull();
    expect(analysisSource(version, { ...quote, location: 'wrong' })).toBeNull();
    expect(analysisSource(version, { ...quote, end: 100000 })).toBeNull();
    expect(latestStage(analyzed)).toBe('task_v1');
    expect(latestStage(data)).toBe('application_review');
  });
});
