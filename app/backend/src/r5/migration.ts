import type { State } from '../store.js';
import type { Submission } from '../schema.js';

export type LegacySubmissionRow = {
  id: string; session_id: string; submission_version: number; content_fingerprint: string; snapshot_json: string;
};
export type LegacyReceiptRow = {
  session_id: string; path: string; key: string; request_hash: string; status: number; body_json: string;
};
export type OldMigrationPayload = {
  legacyState: State;
  submissions: Submission[];
  receipts: { sessionId: string; path: string; key: string; hash: string; status: number; body: unknown }[];
  raw: { stateJson: string; submissionRows: LegacySubmissionRow[]; receiptRows: LegacyReceiptRow[] };
  source: { path: string; fingerprint: string; schema: unknown[] };
};
export type ConvertedMigration = { state: unknown; sourceMap?: unknown };
export type MigrationOptions = {
  source: string; destination: string; backup: string;
  /** The domain converter validates old bindings and builds/validates the four-candidate aggregate. */
  convert: (payload: OldMigrationPayload) => ConvertedMigration;
};
export type MigrationReport = {
  source: string; destination: string; backup: string; sourceFingerprint: string;
  archivedSubmissions: number; archivedReceipts: number; formatVersion: 3;
};
export class MigrationError extends Error {
  constructor(message: string, public readonly diagnosticPaths: string[], options?: ErrorOptions) { super(message, options); }
}

/** API4 has new people: no legacy identity conversion or source-file access occurs. */
export async function migrateV2Database(_options: MigrationOptions): Promise<MigrationReport> {
  throw new MigrationError('API4 requires a fresh applicant database. Preserve the old database and run its historical application version to inspect it. Use manage-r6-database.mjs for a separate API4 initialization.', []);
}
