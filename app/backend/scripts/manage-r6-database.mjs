#!/usr/bin/env node
/** Local-only, explicit-path maintenance. No network, reset, identity remapping or overwrite. */
import { DatabaseSync, backup as sqliteBackup } from 'node:sqlite';
import { closeSync, existsSync, fsyncSync, linkSync, lstatSync, openSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { acquireDatabaseLock, canonicalDatabasePath, inspectDatabaseHeader, RevisionStore, DATABASE_FORMAT_VERSION } from '../dist/r5/store.js';
import { validateState } from '../dist/r5/state-schema.js';
import { freshState } from '../dist/r5/service.js';

const usage = 'Usage: node scripts/manage-r6-database.mjs inspect|init --database /absolute/file.sqlite [--dry-run]; backup|restore --source /absolute/source.sqlite --destination /absolute/new.sqlite [--dry-run]';
const sidecars = ['-wal', '-shm', '-journal'];
function explicitPath(value) {
  if (!value || value === ':memory:' || !isAbsolute(value)) throw new Error('An explicit absolute filesystem path is required');
  return resolve(value);
}
function absent(path) {
  try { lstatSync(path); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  throw new Error(`Destination already exists: ${path}`);
}
function destinationPath(value) {
  const path = explicitPath(value); absent(path);
  if (!statSync(dirname(path)).isDirectory()) throw new Error('Destination parent must already exist');
  for (const suffix of sidecars) absent(`${path}${suffix}`);
  return canonicalDatabasePath(path);
}
function sourcePath(value) {
  const path = canonicalDatabasePath(explicitPath(value));
  if (!lstatSync(path).isFile()) throw new Error('Source must be an existing regular SQLite file');
  return path;
}
function sync(path) { const fd = openSync(path, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); } }
function sha(path) { return `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`; }
function lockSource(source, supplied) {
  const release = [acquireDatabaseLock(source)];
  try { if (resolve(supplied) !== source) release.push(acquireDatabaseLock(resolve(supplied))); }
  catch (error) { release.reverse().forEach(fn => fn()); throw error; }
  return () => release.reverse().forEach(fn => fn());
}
function inspectOpen(db, requireCurrent = false) {
  const integrity = db.prepare('PRAGMA integrity_check').all();
  if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok') throw new Error('SQLite integrity check failed; preserve original files');
  const version = db.prepare('PRAGMA user_version').get().user_version;
  if (requireCurrent && version !== DATABASE_FORMAT_VERSION) throw new Error('Restore requires a revision-6 format-4 backup; keep historical databases paired with their historical executable');
  if (![1, 2, 3, 4].includes(version)) throw new Error('Unrecognized initialized database format');
  const report = { databaseFormat: version, currentContractCompatible: version === 4, integrity: 'ok' };
  if (version === 4) {
    const row = db.prepare('SELECT state_json FROM revision_state WHERE id=1').get();
    if (!row) throw new Error('Revision-6 state is not initialized');
    const state = JSON.parse(row.state_json); validateState(state);
    Object.assign(report, { schemaVersion: state.schemaVersion, fixtureVersion: state.fixtureVersion,
      datasetVersion: state.datasetVersion, rubricVersion: state.rubricVersion, sessionId: state.sessionId,
      candidateIds: Object.keys(state.people), revision: state.revision,
      receiptCount: db.prepare('SELECT count(*) AS n FROM revision_receipts').get().n });
  }
  return report;
}
function inspectFile(path, requireCurrent = false) {
  const db = new DatabaseSync(path, { readOnly: true });
  try { return inspectOpen(db, requireCurrent); } finally { db.close(); }
}
function publish(stage, destination) {
  sync(stage);
  // hard-link publication is atomic and fails on files, symlinks and concurrently created destinations.
  linkSync(stage, destination); sync(dirname(destination)); unlinkSync(stage);
}
function cleanupStage(stage) {
  for (const path of [stage, ...sidecars.map(suffix => `${stage}${suffix}`)]) if (existsSync(path)) unlinkSync(path);
}
async function main() {
  const { values, positionals } = parseArgs({ args: process.argv.slice(2), options: { help: { type: 'boolean', short: 'h' }, database: { type: 'string' }, source: { type: 'string' }, destination: { type: 'string' }, 'dry-run': { type: 'boolean', default: false } }, allowPositionals: true, strict: true });
  if (values.help) return { usage, commands: ['inspect', 'init', 'backup', 'restore'], notes: 'Build the backend first. Use native absolute paths. Existing destinations are preserved. Dry-run performs preflight only.', changes: 0 };
  const command = positionals[0];
  if (positionals.length !== 1 || !['inspect', 'init', 'backup', 'restore'].includes(command)) throw new Error(usage);
  const dryRun = values['dry-run'];
  if (command === 'inspect') {
    if (values.source || values.destination) throw new Error(usage);
    const source = sourcePath(values.database); const version = inspectDatabaseHeader(source);
    // Historical inspection never opens SQLite: preserve legacy WAL/SHM and permissions bit-for-bit.
    if (version !== 4) return { operation: command, source, dryRun, databaseFormat: version, currentContractCompatible: false, inspection: 'header_only', changes: 0 };
    if (dryRun) return { operation: command, source, dryRun, databaseFormat: version, inspection: 'header_only', changes: 0 };
    const release = lockSource(source, values.database);
    try { return { operation: command, source, ...inspectFile(source, true), changes: 0 }; } finally { release(); }
  }
  if (command === 'init') {
    if (values.source || values.destination) throw new Error(usage);
    const destination = destinationPath(values.database);
    if (dryRun) return { operation: command, destination, dryRun, schemaVersion: '4.0', databaseFormat: 4, existingDataConverted: false, changes: 0 };
    const release = acquireDatabaseLock(destination); const stage = `${destination}.r6-${randomUUID()}.tmp`;
    try {
      absent(destination);
      const fd = openSync(stage, 'wx', 0o600); closeSync(fd);
      const store = new RevisionStore(stage, validateState);
      try { const state = freshState(); validateState(state); store.transaction(() => store.setState(state)); } finally { store.close(); }
      const report = inspectFile(stage, true); publish(stage, destination);
      return { operation: command, destination, ...report, sha256: sha(destination), existingDataConverted: false };
    } finally { cleanupStage(stage); release(); }
  }
  if (values.database) throw new Error(usage);
  const source = sourcePath(values.source); const destination = destinationPath(values.destination);
  if (source === destination) throw new Error('Source and destination must differ');
  const version = inspectDatabaseHeader(source);
  if (command === 'restore' && version !== 4) throw new Error('Restore requires a revision-6 format-4 backup; no identity conversion is supported');
  if (![1, 2, 3, 4].includes(version)) throw new Error('Unrecognized initialized database format');
  if (dryRun) return { operation: command, source, destination, dryRun, databaseFormat: version, inspection: 'header_only; full integrity checked during execution', changes: 0 };
  const releaseSource = lockSource(source, values.source); let releaseDestination;
  const stage = `${destination}.r6-${randomUUID()}.tmp`; let sourceDb;
  try {
    releaseDestination = acquireDatabaseLock(destination); absent(destination);
    sourceDb = new DatabaseSync(source, { readOnly: true });
    inspectOpen(sourceDb, command === 'restore');
    const fd = openSync(stage, 'wx', 0o600); closeSync(fd);
    // Native backup API reads committed WAL pages too. Copying only the main database is not equivalent.
    await sqliteBackup(sourceDb, stage); sourceDb.close(); sourceDb = undefined;
    const report = inspectFile(stage, command === 'restore'); publish(stage, destination);
    return { operation: command, source, destination, ...report, sha256: sha(destination), method: 'sqlite_online_backup', sessionPreserved: version === 4 };
  } finally { sourceDb?.close(); cleanupStage(stage); releaseDestination?.(); releaseSource(); }
}
process.umask(0o077);
try { process.stdout.write(`${JSON.stringify(await main(), null, 2)}\n`); }
catch (error) { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; }
