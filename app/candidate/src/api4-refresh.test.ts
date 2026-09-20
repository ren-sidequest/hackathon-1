import { afterEach, expect, it, vi } from 'vitest';
import type { CandidateId, Comparison, Demo } from '../../shared/api4-types';
import { readSharedSnapshot } from '../../shared/api4/controller';

// Transport fixtures only; the browser suite exercises the complete API4 DTOs.
const snapshot = { sessionId: 'refresh-session', revision: 1, fixtureVersion: 'fixture-a', jdVersion: 'jd-a', rubricVersion: 'rubric-a', datasetVersion: 'dataset-a' };
const demo = { ...snapshot, candidate: { id: 'amy-chen' } } as unknown as Demo;
const comparison = { ...snapshot, candidates: [{ candidate: { id: 'amy-chen' } }] } as unknown as Comparison;
const delay = <T>(value: T, ms = 100) => new Promise<T>(resolve => setTimeout(() => resolve(value), ms));

afterEach(() => vi.useRealTimers());

it('starts both reads immediately for an explicit candidate and waits one network delay', async () => {
  vi.useFakeTimers();
  const client = {
    read: vi.fn((_id: CandidateId) => delay(demo)),
    comparison: vi.fn(() => delay(comparison)),
  };
  let finished = false;
  const result = readSharedSnapshot(client, 'amy-chen').then(value => { finished = true; return value; });
  expect(client.read).toHaveBeenCalledWith('amy-chen');
  expect(client.comparison).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(99);
  expect(finished).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  expect(finished).toBe(true);
  await expect(result).resolves.toEqual({ next: demo, list: comparison });
});

it('reads the candidate list first when the initial identity is unknown', async () => {
  vi.useFakeTimers();
  const client = {
    read: vi.fn((_id: CandidateId) => delay(demo)),
    comparison: vi.fn(() => delay(comparison)),
  };
  let finished = false;
  const result = readSharedSnapshot(client, null).then(value => { finished = true; return value; });
  expect(client.comparison).toHaveBeenCalledOnce();
  expect(client.read).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(100);
  expect(client.read).toHaveBeenCalledWith('amy-chen');
  expect(finished).toBe(false);
  await vi.advanceTimersByTimeAsync(100);
  await expect(result).resolves.toEqual({ next: demo, list: comparison });
});

it('does not fetch person data before explicit identity selection', async () => {
  const client = { read: vi.fn().mockResolvedValue(demo), comparison: vi.fn().mockResolvedValue(comparison) };
  await expect(readSharedSnapshot(client, 'amy-chen', true)).resolves.toEqual({ next: null, list: comparison });
  expect(client.read).not.toHaveBeenCalled();
});

it.each(['sessionId', 'revision', 'fixtureVersion', 'jdVersion', 'rubricVersion', 'datasetVersion'] as const)('re-reads both endpoints together when %s differs', async field => {
  vi.useFakeTimers();
  const newer = { ...snapshot, [field]: field === 'revision' ? 2 : 'new-snapshot' };
  const newDemo = { ...demo, ...newer } as Demo;
  const newComparison = { ...comparison, ...newer } as Comparison;
  const client = {
    read: vi.fn().mockImplementationOnce(() => delay(demo)).mockImplementationOnce(() => delay(newDemo)),
    comparison: vi.fn().mockImplementation(() => delay(newComparison)),
  };
  let finished = false;
  const result = readSharedSnapshot(client, 'amy-chen').then(value => { finished = true; return value; });
  await vi.advanceTimersByTimeAsync(100);
  expect(client.read).toHaveBeenCalledTimes(2);
  expect(client.comparison).toHaveBeenCalledTimes(2);
  expect(finished).toBe(false);
  expect(client.read.mock.calls).toEqual([['amy-chen'], ['amy-chen']]);
  await vi.advanceTimersByTimeAsync(100);
  await expect(result).resolves.toEqual({ next: newDemo, list: newComparison });
});

it('rejects a still-mixed snapshot after one retry instead of displaying it', async () => {
  const client = {
    read: vi.fn().mockResolvedValue(demo),
    comparison: vi.fn().mockResolvedValue({ ...comparison, revision: 2 }),
  };
  await expect(readSharedSnapshot(client, 'amy-chen')).rejects.toMatchObject({ code: 'REFRESH_CONFLICT' });
  expect(client.read).toHaveBeenCalledTimes(2);
  expect(client.comparison).toHaveBeenCalledTimes(2);
});

it('keeps the original selected candidate through a snapshot retry', async () => {
  const ann = { ...demo, revision: 2, candidate: { id: 'ann-li' } } as Demo;
  const list = { ...comparison, revision: 2 };
  const client = {
    read: vi.fn().mockResolvedValueOnce({ ...ann, revision: 1 }).mockResolvedValueOnce(ann),
    comparison: vi.fn().mockResolvedValue(list),
  };
  await expect(readSharedSnapshot(client, 'ann-li')).resolves.toEqual({ next: ann, list });
  expect(client.read.mock.calls).toEqual([['ann-li'], ['ann-li']]);
});

it('preserves transport errors without substituting data or retrying an unrelated failure', async () => {
  const failure = new Error('offline');
  const client = { read: vi.fn().mockRejectedValue(failure), comparison: vi.fn().mockResolvedValue(comparison) };
  await expect(readSharedSnapshot(client, 'amy-chen')).rejects.toBe(failure);
  expect(client.read).toHaveBeenCalledOnce();
  expect(client.comparison).toHaveBeenCalledOnce();
});
