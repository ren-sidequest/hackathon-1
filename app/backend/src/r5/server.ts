import { createRevision5App } from './app.js';
import { createApp as createLegacyApp } from '../app.js';
import { loadConfig } from '../config.js';
let app: Awaited<ReturnType<typeof createRevision5App>> | undefined;
try {
  process.umask(0o077);
  const contract = process.env['DEMO_CONTRACT'] ?? '4.0';
  if (![
    '2.0', '4.0'
  ].includes(contract))
    throw new Error('Invalid DEMO_CONTRACT');
  const config = loadConfig({
    ...process.env, DATABASE_PATH: process.env['DATABASE_PATH'] ?? `./var/evidencebridge-v${contract[0]}.sqlite`
  });
  const factory = contract === '4.0' ? createRevision5App : createLegacyApp;
  app = await factory({
    ...config, log: entry => process.stdout.write(`${JSON.stringify(entry)}\n`)
  });
  await app.listen({
    host: '127.0.0.1', port: config.port
  });
  process.stdout.write(`${JSON.stringify({
    event: 'ready', schemaVersion: contract, url: `http://127.0.0.1:${config.port}`, analysisMode: config.analysisMode, resetEnabled: Boolean(config.adminToken)
  })}\n`);
  for (const signal of [
    'SIGINT', 'SIGTERM'
  ] as const)
    process.once(signal, () => {
      void app!.close().then(() => process.exit(0));
    });
}
catch {
  if (app)
    await app.close();
  process.stderr.write('EvidenceBridge startup failed. Check contract, config, port and database version/integrity. Preserve existing files; no case was reset.\n');
  process.exitCode = 1;
}
