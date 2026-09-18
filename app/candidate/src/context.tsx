import { createContext, useContext, type Dispatch } from 'react';
import type { State, Action } from './state';
export type Page = 'home' | 'tasks' | 'workspace' | 'resources' | 'sample' | 'status';
export const CandidateContext = createContext<{
  storageAvailable: boolean; state: State; dispatch: Dispatch<Action>; navigate: (page: Page) => void; notify: (message: string) => void;
} | null>(null);
export function useCandidate() { const context = useContext(CandidateContext); if (!context) throw new Error('Candidate context missing'); return context; }
