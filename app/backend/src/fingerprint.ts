import { createHash } from 'node:crypto';
/** Object keys are sorted; arrays and text (including whitespace) stay unchanged. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
}
export const fingerprint = (value: unknown): string => createHash('sha256').update(canonicalJson(value)).digest('hex');
