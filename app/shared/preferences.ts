export type Theme = 'light' | 'dark';
export const themeKey = 'evidencebridge.ui.theme.v1';
export const sidebarKey = (role: string) => `evidencebridge.ui.sidebar.${role}.v1`;

export function readPreference(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function writePreference(key: string, value: string): void {
  // UI preferences are optional. Business-state warnings remain owned by each app.
  try { localStorage.setItem(key, value); } catch { /* Keep this tab usable. */ }
}

export function resolveTheme(saved: string | null, systemDark: boolean): Theme {
  return saved === 'light' || saved === 'dark' ? saved : systemDark ? 'dark' : 'light';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

// Called before React mounts, so the first app frame uses the saved preference.
export function initializeTheme(): void {
  applyTheme(resolveTheme(readPreference(themeKey), matchMedia('(prefers-color-scheme: dark)').matches));
}
