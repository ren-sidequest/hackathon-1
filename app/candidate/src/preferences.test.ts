import { afterEach, describe, expect, it, vi } from 'vitest';
import { readPreference, resolveTheme, sidebarKey, writePreference } from '../../shared/preferences';

afterEach(() => vi.unstubAllGlobals());
describe('shared UI preference policy', () => {
  it('uses the system only when no valid explicit preference exists', () => {
    expect(resolveTheme(null, true)).toBe('dark');
    expect(resolveTheme('invalid', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
  it('survives browsers that reject storage access', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw Error('blocked'); }, setItem: () => { throw Error('quota'); } });
    expect(readPreference('theme')).toBeNull();
    expect(() => writePreference('theme', 'dark')).not.toThrow();
  });
  it('keeps role-specific collapse preferences separate from each other and business state', () => {
    const saved = new Map<string, string>([['evidencebridge.hr.demo.v1', 'business data']]);
    vi.stubGlobal('localStorage', { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value) });
    writePreference(sidebarKey('hr'), 'collapsed');
    writePreference(sidebarKey('candidate'), 'expanded');
    expect(readPreference(sidebarKey('hr'))).toBe('collapsed');
    expect(readPreference(sidebarKey('candidate'))).toBe('expanded');
    expect(saved.get('evidencebridge.hr.demo.v1')).toBe('business data');
  });
});
