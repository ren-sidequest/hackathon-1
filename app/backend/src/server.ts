import { createApp } from './app.js';
import { loadConfig } from './config.js';
let app: Awaited<ReturnType<typeof createApp>> | undefined;
try {
  process.umask(0o077);
  const config = loadConfig();
  app = await createApp({ ...config, log: entry => process.stdout.write(`${JSON.stringify(entry)}\n`) });
  await app.listen({ host: '127.0.0.1', port: config.port });
  process.stdout.write(`${JSON.stringify({ event: 'ready', url: `http://127.0.0.1:${config.port}`, analysisMode: config.analysisMode, resetEnabled: Boolean(config.adminToken) })}\n`);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void app!.close().then(() => process.exit(0)); });
} catch {
  if (app) await app.close();
  process.stderr.write('EvidenceBridge startup failed. Check config, port, database permissions/integrity and the documented Node version. No case was reset.\n');
  process.exitCode = 1;
}
