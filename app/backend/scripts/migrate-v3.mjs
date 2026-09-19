import { parseArgs } from 'node:util';
import { migrateV2Database } from '../dist/r5/migration.js';

// No default database path: an explicit backup and a new destination are mandatory.
try {
  const { values } = parseArgs({ options: {
    source: { type: 'string' }, destination: { type: 'string' }, backup: { type: 'string' },
  }, allowPositionals: false, strict: true });
  if (!values.source || !values.destination || !values.backup)
    throw new Error('Usage: node scripts/migrate-v3.mjs --source /absolute/v2.sqlite --destination /absolute/new-v3.sqlite --backup /absolute/backup-v2.sqlite');
  const { convertLegacyState } = await import('../dist/r5/service.js');
  if (typeof convertLegacyState !== 'function') throw new Error('Build must export the revision-5 domain converter before migration');
  const report = await migrateV2Database({ ...values, convert: convertLegacyState });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  if (error && typeof error === 'object' && 'diagnosticPaths' in error)
    process.stderr.write(`Retained diagnostics: ${JSON.stringify(error.diagnosticPaths)}\n`);
  process.exitCode = 1;
}
