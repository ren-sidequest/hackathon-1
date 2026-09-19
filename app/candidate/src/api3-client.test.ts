import { beforeEach, describe, expect, it, vi } from 'vitest';
import initial from '../../../docs/backend/r5/examples/initial-alex-chen.response.json';
import comparison from '../../../docs/backend/r5/examples/comparison-initial.response.json';
import analyzedFixture from '../../../docs/backend/r5/examples/alex-chen-v1-analysis.response.json';
import v2Fixture from '../../../docs/backend/r5/examples/alex-chen-v2-submission.response.json';
import { Api3Client, baseBinding, stageContext, submissionBinding, taskBinding } from '../../shared/api3/client';
import type { Demo } from '../../shared/api3-types';

const data = initial.data as Demo;
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
});
describe('independent API3 client', () => {
  it('reads an explicitly bound person and the whole comparison', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(initial)).mockResolvedValueOnce(response(comparison));
    const client = new Api3Client('http://127.0.0.1:8793', 'test', fetcher);
    expect((await client.read('alex-chen')).candidate.id).toBe('alex-chen');
    expect(fetcher.mock.calls[0][0]).toContain('?candidateId=alex-chen');
    expect((await client.comparison()).candidates).toHaveLength(4);
  });
  it('rejects API2 rather than falling back to a mock', async () => {
    const client = new Api3Client('', 'test', vi.fn().mockResolvedValue(response({ ...initial, data: { ...data, schemaVersion: '2.0' } })));
    await expect(client.read('alex-chen')).rejects.toMatchObject({ code: 'SCHEMA_MISMATCH' });
  });
  it('rejects a valid-looking response owned by another candidate', async () => {
    const client = new Api3Client('', 'test', vi.fn().mockResolvedValue(response(initial)));
    await expect(client.read('maya-patel')).rejects.toMatchObject({ code: 'IDENTITY_MISMATCH' });
  });
  it('keeps the exact public body and idempotency key after network uncertainty and reload', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('lost response')).mockResolvedValueOnce(response(initial));
    const client = new Api3Client('', 'receipt', fetcher);
    const body = { ...baseBinding(data), taskId: data.task.taskId, instructions: 'original public input' };
    await expect(client.write('/task/send', body)).rejects.toMatchObject({ code: 'CONNECTION_UNCERTAIN', uncertain: true });
    const first = client.pending!;
    body.instructions = 'edited after uncertain result';
    await expect(client.write('/review', body)).rejects.toMatchObject({ code: 'PENDING_ACTION' });
    const restored = new Api3Client('', 'receipt', fetcher);
    expect(restored.pending).toEqual(first);
    await restored.retry();
    expect(fetcher.mock.calls[0][1].body).toEqual(fetcher.mock.calls[1][1].body);
    expect(fetcher.mock.calls[0][1].headers['Idempotency-Key']).toEqual(fetcher.mock.calls[1][1].headers['Idempotency-Key']);
    expect(restored.pending).toBeNull();
  });
  it('clears a definitive 409 receipt so corrected content can be a new operation', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ error: { code: 'ASSESSMENT_CONFLICT', message: 'Refresh', requestId: 'test-id' } }, 409));
    const client = new Api3Client('', 'test', fetcher);
    await expect(client.write('/assessment', baseBinding(data))).rejects.toMatchObject({ code: 'ASSESSMENT_CONFLICT', status: 409, requestId: 'test-id', uncertain: false });
    expect(client.pending).toBeNull();
  });
  it('preserves receipts when a successful write returns malformed JSON or wrong identity', async () => {
    const wrong = { ...initial, data: { ...data, candidate: { ...data.candidate, id: 'maya-patel' } } };
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('<html>')).mockResolvedValueOnce(response(wrong));
    const client = new Api3Client('', 'test', fetcher);
    await expect(client.write('/review', baseBinding(data))).rejects.toMatchObject({ code: 'INVALID_RESPONSE', uncertain: true });
    const key = client.pending?.key;
    await expect(client.retry()).rejects.toMatchObject({ code: 'IDENTITY_MISMATCH', uncertain: true });
    expect(client.pending?.key).toBe(key);
  });
  it('holds 202 analysis receipts until a final read settles the exact current submission', async () => {
    const analyzed = analyzedFixture.data as Demo;
    const running: Demo = { ...analyzed, analysis: { ...analyzed.analysis, status: 'running', result: null }, versions: analyzed.versions.map(v => ({ ...v, analysis: { ...v.analysis, status: 'running', result: null } })) };
    const client = new Api3Client('', 'test', vi.fn().mockResolvedValue(response({ data: running, meta: { replayed: false } }, 202)));
    await client.write('/analysis', submissionBinding(analyzed));
    expect(client.pending).not.toBeNull();
    client.reconcile(running);
    expect(client.pending).not.toBeNull();
    client.reconcile({ ...analyzed, versions: analyzed.versions.map(v => ({ ...v, analysis: { ...v.analysis, status: 'failed', submissionId: 'other-work' } })) });
    expect(client.pending).not.toBeNull();
    client.reconcile({ ...analyzed, versions: analyzed.versions.map(v => ({ ...v, analysis: { ...v.analysis, status: 'failed', contentFingerprint: 'f'.repeat(64) } })) });
    expect(client.pending).not.toBeNull();
    client.reconcile({ ...analyzed, versions: analyzed.versions.map(v => ({ ...v, analysis: { ...v.analysis, status: 'failed', result: null } })) });
    expect(client.pending).toBeNull();
  });
  it('settles an exact completed V1 receipt from history when V2 is current', async () => {
    const analyzed = analyzedFixture.data as Demo, current = v2Fixture.data as Demo;
    const running = { ...analyzed, analysis: { ...analyzed.analysis, status: 'running', result: null } };
    const client = new Api3Client('', 'history-receipt', vi.fn().mockResolvedValue(response({ data: running, meta: { replayed: false } }, 202)));
    await client.write('/analysis', submissionBinding(analyzed));
    expect(current.currentSubmissionVersion).toBe(2);
    expect(current.analysis.status).toBe('not_started');
    client.reconcile(current);
    expect(client.pending).toBeNull();
    expect(new Api3Client('', 'history-receipt').pending).toBeNull();
  });
  it('preserves a V1 receipt for running, missing, foreign or mismatched historical evidence', async () => {
    const analyzed = analyzedFixture.data as Demo, current = v2Fixture.data as Demo;
    const running = { ...analyzed, analysis: { ...analyzed.analysis, status: 'running', result: null } };
    const client = new Api3Client('', 'history-receipt', vi.fn().mockResolvedValue(response({ data: running, meta: { replayed: false } }, 202)));
    await client.write('/analysis', submissionBinding(analyzed));
    const original = structuredClone(client.pending);
    const cases: Demo[] = [
      { ...current, candidate: { ...current.candidate, id: 'maya-patel' } },
      { ...current, versions: current.versions.filter(v => v.submission.submissionVersion === 2) },
      ...(['running', 'not_started'] as const).map(status => ({ ...current, versions: current.versions.map(v => v.submission.submissionVersion === 1 ? { ...v, analysis: { ...v.analysis, status, result: null } } : v) })),
      { ...current, versions: current.versions.map(v => ({ ...v, submission: { ...v.submission, candidateId: 'maya-patel' as const } })) },
      { ...current, versions: current.versions.map(v => ({ ...v, submission: { ...v.submission, submissionId: 'other-work' } })) },
      { ...current, versions: current.versions.map(v => ({ ...v, submission: { ...v.submission, contentFingerprint: 'f'.repeat(64) } })) },
      { ...current, versions: current.versions.map(v => ({ ...v, analysis: { ...v.analysis, contentFingerprint: 'f'.repeat(64) } })) },
    ];
    for (const next of cases) { client.reconcile(next); expect(client.pending).toEqual(original); }
  });
  it('invalidates old-session receipts and rejects admin/oversized writes', async () => {
    const client = new Api3Client('', 'test', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(client.write('/reset', baseBinding(data))).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    await expect(client.write('/submission', { ...baseBinding(data), summary: '😀'.repeat(40000) })).rejects.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
    await expect(client.write('/review', baseBinding(data))).rejects.toThrow();
    client.reconcile({ ...data, sessionId: 'a-new-session' });
    expect(client.pending).toBeNull();
  });
  it('requires real task/submission binding and preserves application source ownership', () => {
    expect(() => taskBinding(data)).toThrow();
    expect(() => submissionBinding(data)).toThrow();
    const app = stageContext(data, 'application_review')!;
    expect(app.fingerprint).toBe(data.application.fingerprint);
    expect(app.sources).toEqual(data.application.sources);
    expect(app.submissionId).toBeNull();
    expect(stageContext(data, 'task_v2')).toBeNull();
  });
});
