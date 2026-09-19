import { resolve } from 'node:path';
export type AppConfig = {
  port: number; databasePath: string; adminToken: string;
  allowedOrigins: string[]; analysisMode: 'disabled' | 'manual_simulation' | 'live';
  apiKey: string; model: string; aiTimeoutMs: number;
};
export const defaultOrigins = ['http://127.0.0.1:5173', 'http://127.0.0.1:4173', 'http://127.0.0.1:5186'];
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const port = Number(env['PORT'] ?? 8787); const timeout = Number(env['AI_TIMEOUT_MS'] ?? 20000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
  if (!Number.isInteger(timeout) || timeout < 100 || timeout > 60000) throw new Error('Invalid AI_TIMEOUT_MS');
  const mode = env['ANALYSIS_MODE'] ?? 'disabled';
  if (!['disabled', 'manual_simulation', 'live'].includes(mode)) throw new Error('Invalid ANALYSIS_MODE');
  const adminToken = env['DEMO_ADMIN_TOKEN'] ?? '';
  if (adminToken && (adminToken.length < 24 || adminToken.length > 256)) throw new Error('DEMO_ADMIN_TOKEN must contain 24–256 characters');
  const allowedOrigins = (env['ALLOWED_ORIGINS'] ?? defaultOrigins.join(',')).split(',').map(s => s.trim());
  for (const origin of allowedOrigins) {
    const parsed = new URL(origin);
    if (parsed.origin !== origin || parsed.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(parsed.hostname))
      throw new Error('Only explicit loopback HTTP ALLOWED_ORIGINS are supported');
  }
  return { port, databasePath: resolve(env['DATABASE_PATH'] ?? './var/evidencebridge.sqlite'), adminToken,
    allowedOrigins, analysisMode: mode as AppConfig['analysisMode'], apiKey: env['OPENAI_API_KEY'] ?? '',
    model: env['OPENAI_MODEL'] ?? '', aiTimeoutMs: timeout };
}
