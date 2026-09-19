import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import initial from '../../../docs/backend/r5/examples/initial-alex-chen.response.json';
import sentExample from '../../../docs/backend/r5/examples/alex-chen-send.response.json';
import moreExample from '../../../docs/backend/r5/examples/alex-chen-v1-more.response.json';
import type { Demo, Submission } from '../../shared/api3-types';
import type { Api3Controller } from '../../shared/api3/controller';
import CandidateConnected from '../../shared/api3/candidate';
import { appendDraftEvent, copyPublicSnapshot, draftKey, emptyDraft, event, publicWork, readDraft, submissionIssues, submissionPayload } from '../../shared/api3/candidate-draft';

const data = initial.data as Demo, sent = sentExample.data as Demo, more = moreExample.data as Demo;
const card = { id: 'f1', section: 'Key Findings' as const, title: 'Finding', detail: 'Evidence', source: '', confidence: 'Low' as const };
describe('API3 Candidate integration', () => {
  it('renders only the selected server identity and its server materials', () => {
    const named = { ...data, candidate: { ...data.candidate, name: 'SERVER IDENTITY' }, application: { ...data.application, sources: [{ sourceId: 'server-person-source', location: '/cv', text: 'SERVER MATERIAL', kind: 'application' as const }] } };
    const markup = renderToStaticMarkup(React.createElement(CandidateConnected, { data: named, page: 'application', controller: { busy: false, pending: null } as Api3Controller, go: () => {} }));
    expect(markup).toContain('SERVER IDENTITY'); expect(markup).toContain('server-person-source'); expect(markup).not.toContain('local mock');
  });
  it('binds V1 to current API3 person/task/target and whitelists nested public fields', () => {
    const draft = { ...emptyDraft(), summary: 'Public', notes: 'PRIVATE', findings: [{ ...card, private: 'PRIVATE_NESTED' }], events: [{ ...event('Viewed a resource'), private: 'PRIVATE_EVENT' }] };
    const body = submissionPayload(sent, draft);
    expect(body.schemaVersion).toBe('3.0'); expect(body.candidateId).toBe(sent.candidate.id); expect(body.jobId).toBe(sent.job.id);
    expect(body.taskId).toBe(sent.task.taskId); expect(body.targetRequirementId).toBe(sent.task.targetRequirementId);
    expect(body.previousSubmissionId).toBeNull(); expect(body.previousContentFingerprint).toBeNull();
    expect(JSON.stringify(body)).not.toContain('PRIVATE'); expect(publicWork(draft)).not.toHaveProperty('savedAt');
  });
  it('uses workflow permission rather than unused capacity', () => {
    expect(() => submissionPayload(data, emptyDraft())).toThrow();
    expect(() => submissionPayload({ ...sent, workflow: { ...sent.workflow, canSubmit: false, remainingSubmissions: 2 } }, emptyDraft())).toThrow();
    expect(() => submissionPayload({ ...sent, workflow: { ...sent.workflow, isTerminal: true } }, emptyDraft())).toThrow();
  });
  it('binds V2 to exact old snapshot without spreading its legacy schema', () => {
    const legacy = { ...more, versions: more.versions.map(v => ({ ...v, submission: { ...v.submission, schemaVersion: '2.0' as const } })) };
    const body = submissionPayload(legacy, { ...emptyDraft(), summary: 'New public work' });
    expect(body.schemaVersion).toBe('3.0'); expect(body.submissionVersion).toBe(2);
    expect(body.previousSubmissionId).toBe(more.versions[0].submission.submissionId);
    expect(body.previousContentFingerprint).toBe(more.versions[0].submission.contentFingerprint);
    expect(() => submissionPayload({ ...legacy, workflow: { ...legacy.workflow, canResubmit: false } }, emptyDraft())).toThrow();
  });
  it('isolates draft keys by person, session, task and proposed version', () => {
    const keys = [draftKey(sent, 1), draftKey(sent, 2), draftKey({ ...sent, sessionId: 'new-session' }, 1), draftKey({ ...sent, candidate: { ...sent.candidate, id: 'maya-patel' } }, 1), draftKey({ ...sent, task: { ...sent.task, taskId: 'other-task' } }, 1)];
    expect(new Set(keys).size).toBe(5); expect(keys[0]).toContain('api3.draft');
  });
  it('reads only the requested draft key and rejects corrupted data', () => {
    const requested: string[] = [], draft = { ...emptyDraft(), summary: 'Private browser draft', notes: 'Personal scratch', formalState: 'DROP' };
    const read = readDraft(draftKey(sent, 1), { getItem: key => { requested.push(key); return JSON.stringify(draft); } });
    expect(read.summary).toBe(draft.summary); expect(read.notes).toBe(draft.notes); expect(read).not.toHaveProperty('formalState');
    expect(requested).toEqual([draftKey(sent, 1)]);
    expect(readDraft('damaged', { getItem: () => '{' })).toEqual(emptyDraft());
    expect(readDraft('old-preview-key', { getItem: () => JSON.stringify({ tasks: {} }) })).toEqual(emptyDraft());
  });
  it('explicit copying preserves V1 and excludes notes/events from previous version', () => {
    const injected = { ...more.versions[0].submission, findings: [card], notes: 'PRIVATE' };
    const old: Submission = injected;
    const draft = copyPublicSnapshot(old); draft.findings[0].detail = 'Changed only in V2';
    expect(old.findings[0].detail).toBe('Evidence'); expect(draft.notes).toBe(''); expect(draft.started).toBe(true);
    expect(draft.events).toHaveLength(1); expect(draft.events[0].title).toBe('Started V2 draft');
    expect(JSON.stringify(publicWork(draft))).not.toContain('PRIVATE');
  });
  it('accepts incomplete work while enforcing every request limit and encoded bytes', () => {
    const draft = { ...emptyDraft(), summary: 'Thin but reviewable work' };
    expect(submissionIssues(sent, draft)).toEqual([]);
    expect(submissionIssues(sent, { ...draft, findings: Array.from({ length: 41 }, (_, i) => ({ ...card, id: `f${i}` })) })).toContain('Keep at most 40 investigation cards.');
    expect(submissionIssues(sent, { ...draft, findings: [{ ...card, title: 'x'.repeat(301) }] }).join(' ')).toContain('titles');
    expect(submissionIssues(sent, { ...draft, findings: [{ ...card, source: 'other-dataset' }] }).join(' ')).toContain('current dataset');
    expect(submissionIssues(sent, { ...draft, events: Array.from({ length: 101 }, () => event('View')) }).join(' ')).toContain('Process events');
    const findings = Array.from({ length: 30 }, (_, i) => ({ ...card, id: `f${i}`, detail: '字'.repeat(2000) }));
    expect(submissionIssues(sent, { ...draft, findings }).join(' ')).toContain('128 KiB');
  });
  it('reserves final process slot without dropping prior events', () => {
    const draft = { ...emptyDraft(), events: Array.from({ length: 99 }, () => event('View')) };
    const next = appendDraftEvent(draft, event('Extra view'));
    expect(next.events).toEqual(draft.events);
    const final = { ...next, summary: 'Submitted', events: [...next.events, event('Submitted')] };
    expect(submissionIssues(sent, final)).toEqual([]);
  });
});
