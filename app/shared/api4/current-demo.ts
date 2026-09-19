import type { CandidateId } from '../api4-types';
import { candidateIds } from './client';

/** An obsolete URL is a selection request, never an alias for a current person. */
export function candidateSelection(href: string): { candidateId: CandidateId | null; needsSelection: boolean } {
  const id = new URL(href).searchParams.get('candidateId');
  const current = candidateIds.find(value => value === id);
  return { candidateId: current ?? null, needsSelection: !!id && !current };
}

/** Remove only retired demo storage; current drafts, receipts and appearance survive. */
export function clearRetiredDemoStorage(storage: Pick<Storage, 'length' | 'key' | 'removeItem'>) {
  try {
    const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i));
    for (const key of keys) {
      if (key && /^evidencebridge\.api3\.(draft|receipt|analysis-receipt)\./.test(key)) storage.removeItem(key);
    }
  } catch { /* Storage may be disabled. URL recovery and API state remain usable. */ }
}
