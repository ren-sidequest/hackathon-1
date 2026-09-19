import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest, type FastifyError } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { timingSafeEqual, randomUUID } from 'node:crypto';
import { Type } from '@sinclair/typebox';
import { Store, type StoredResponse } from './store.js';
import { DemoService, type Analyzer } from './service.js';
import { createAnalyzer } from './analysis.js';
import { createSeed } from './seed.js';
import { defaultOrigins, type AppConfig } from './config.js';
import { ApiError } from './errors.js';
import { EnvelopeSchema } from './response-schema.js';
import { SendSchema, SubmitSchema, AnalyzeSchema, ReviewSchema, ResetSchema, ErrorSchema, WriteHeaders,
  type SendRequest, type SubmitRequest, type AnalyzeRequest, type ReviewRequest, type ResetRequest } from './schema.js';

export type AppOptions = Partial<AppConfig> & { analyzer?: Analyzer; log?: (entry: Record<string, unknown>) => void };
export async function createApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const port = options.port ?? 8787; const adminToken = options.adminToken ?? '';
  if (adminToken && (adminToken.length < 24 || adminToken.length > 256)) throw new Error('Invalid demo admin token length');
  const store = new Store(options.databasePath ?? ':memory:');
  let service: DemoService;
  try {
    const context = createSeed().dataset.resources.map(r => `SOURCE ${r.id}\n${r.content}`).join('\n\n');
    service = new DemoService(store, options.analyzer ?? createAnalyzer({
      mode: options.analysisMode ?? 'disabled', apiKey: options.apiKey ?? '', model: options.model ?? '',
      timeoutMs: options.aiTimeoutMs ?? 20000, caseContext: context,
    }));
  } catch (error) { store.close(); throw error; }
  const app = Fastify({ logger: false, requestIdHeader: false,
    genReqId: () => randomUUID(), bodyLimit: 128 * 1024, requestTimeout: 10000, connectionTimeout: 15000,
    ajv: { customOptions: { removeAdditional: false, coerceTypes: false, useDefaults: false, allErrors: false } },
  });
  app.addHook('onClose', async () => store.close());
  const origins = new Set(options.allowedOrigins ?? defaultOrigins);
  const log = options.log ?? (() => undefined);
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store').header('X-Content-Type-Options', 'nosniff');
    const address = app.server.address(); const boundPort = address && typeof address === 'object' ? address.port : port;
    const hosts = new Set([`127.0.0.1:${boundPort}`, `localhost:${boundPort}`]);
    if (!request.headers.host || !hosts.has(request.headers.host.toLowerCase())) throw new ApiError('HOST_NOT_ALLOWED', 403, 'Host is not allowed.');
    const origin = request.headers.origin;
    const ownOrigins = new Set([...hosts].map(h => `http://${h}`));
    if (origin && (!origins.has(origin) && !ownOrigins.has(origin))) throw new ApiError('ORIGIN_NOT_ALLOWED', 403, 'Origin is not allowed.');
    if (!origin && request.headers['sec-fetch-site'] === 'cross-site') throw new ApiError('ORIGIN_NOT_ALLOWED', 403, 'Cross-site request is not allowed.');
    if (origin) reply.header('Access-Control-Allow-Origin', origin).header('Vary', 'Origin');
    if (request.method === 'OPTIONS') {
      const requested = String(request.headers['access-control-request-headers'] ?? '').toLowerCase().split(',').map(h => h.trim()).filter(Boolean);
      if (requested.some(h => !['content-type', 'idempotency-key', 'x-demo-admin-token'].includes(h))) throw new ApiError('HEADER_NOT_ALLOWED', 403, 'Requested header is not allowed.');
      reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        .header('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key, X-Demo-Admin-Token').code(204).send();
    }
  });
  app.addHook('onResponse', async (request, reply) => {
    // No raw URL/query, request body, arbitrary headers, prompt, credential or provider payload.
    log({ requestId: request.id, method: request.method, route: request.routeOptions.url ?? 'unmatched', status: reply.statusCode });
  });
  app.setErrorHandler((unknownError, request, reply) => {
    const error = unknownError as FastifyError;
    let code = 'INTERNAL_ERROR'; let status = 500; let message = 'Request failed. The saved case has not been replaced.'; let retryable = false;
    if (error instanceof ApiError) ({ code, status, message, retryable } = error);
    else if (error.validation) { code = 'INVALID_REQUEST'; status = 400; message = 'Request does not match the API schema. Check required fields, types and limits.'; }
    else if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      status = error.statusCode; code = status === 413 ? 'PAYLOAD_TOO_LARGE' : status === 415 ? 'UNSUPPORTED_MEDIA_TYPE' : 'INVALID_REQUEST';
      message = 'Request encoding, size or content type is invalid.';
    }
    log({ requestId: request.id, code, status });
    reply.code(status).send({ error: { code, message, requestId: request.id, retryable } });
  });
  app.setNotFoundHandler((request, reply) => reply.code(404).send({ error: {
    code: 'NOT_FOUND', message: 'Endpoint was not found.', requestId: request.id, retryable: false,
  } }));
  await app.register(swagger, { openapi: { openapi: '3.0.3', info: {
    title: 'EvidenceBridge local demo API', version: '1.0', description: 'One synthetic case. Human evidence review, not a hiring decision. Model keys remain server-side.',
  }, servers: [{ url: `http://127.0.0.1:${port}` }], components: { securitySchemes: {
    demoAdmin: { type: 'apiKey', in: 'header', name: 'X-Demo-Admin-Token' },
  } } } });
  await app.register(swaggerUi, { routePrefix: '/docs', staticCSP: true });
  app.addSchema({ ...EnvelopeSchema, $id: 'DemoEnvelope' });
  app.addSchema({ ...ErrorSchema, $id: 'ApiError' });
  const errorResponses = { '4xx': { $ref: 'ApiError#' }, '5xx': { $ref: 'ApiError#' } };
  const responses = { 200: { $ref: 'DemoEnvelope#' }, ...errorResponses };
  const submissionResponses = { 201: { $ref: 'DemoEnvelope#' }, ...errorResponses };
  const analysisResponses = { ...responses, 202: { $ref: 'DemoEnvelope#' } };
  const deliver = (reply: FastifyReply, result: StoredResponse) => reply.code(result.status).send(result.body);
  const key = (request: FastifyRequest) => request.headers['idempotency-key'] as string;
  const preWrite = async (request: FastifyRequest) => {
    if (!/^application\/json(?:\s*;.*)?$/i.test(request.headers['content-type'] ?? '')) throw new ApiError('UNSUPPORTED_MEDIA_TYPE', 415, 'Use application/json.');
  };
  app.get('/healthz', { schema: { summary: 'Storage readiness; never invokes a model', response: { 200: Type.Object({ status: Type.Literal('ok'), storage: Type.Literal('sqlite') }) } } }, async () => {
    if (!store.health()) throw new Error('Database health check failed'); return { status: 'ok', storage: 'sqlite' };
  });
  app.get('/api/demo', { schema: { summary: 'Read the single shared case and current report', response: responses } }, async () => service.read());
  app.post<{ Body: SendRequest }>('/api/demo/task/send', { preValidation: preWrite, schema: { summary: 'Send the preset task once', headers: WriteHeaders, body: SendSchema, response: responses } }, async (request, reply) => deliver(reply, service.send(request.body, key(request))));
  app.post<{ Body: SubmitRequest }>('/api/demo/submission', { preValidation: preWrite, schema: { summary: 'Save an immutable public work sample; private notes are excluded', headers: WriteHeaders, body: SubmitSchema, response: submissionResponses } }, async (request, reply) => deliver(reply, service.submit(request.body, key(request))));
  app.post<{ Body: AnalyzeRequest }>('/api/demo/analysis', { preValidation: preWrite, schema: { summary: 'Extract and validate observations from the exact saved submission', headers: WriteHeaders, body: AnalyzeSchema, response: analysisResponses } }, async (request, reply) => deliver(reply, await service.analyze(request.body, key(request))));
  app.post<{ Body: ReviewRequest }>('/api/demo/review', { preValidation: preWrite, schema: { summary: 'Save one human evidence decision; only the target requirement changes', headers: WriteHeaders, body: ReviewSchema, response: responses } }, async (request, reply) => deliver(reply, service.review(request.body, key(request))));
  app.post<{ Body: ResetRequest }>('/api/demo/reset', { preValidation: preWrite, preHandler: async request => {
    if (!adminToken) throw new ApiError('RESET_DISABLED', 503, 'Demo reset is disabled until an admin token is configured.');
    const incoming = request.headers['x-demo-admin-token'];
    if (typeof incoming !== 'string' || Buffer.byteLength(incoming) !== Buffer.byteLength(adminToken) || !timingSafeEqual(Buffer.from(incoming), Buffer.from(adminToken)))
      throw new ApiError('ADMIN_TOKEN_REQUIRED', 403, 'Demo admin token is required.');
  }, schema: { summary: 'Reset synthetic case; old submission references become stale', security: [{ demoAdmin: [] }], headers: WriteHeaders, body: ResetSchema, response: responses } }, async (request, reply) => deliver(reply, service.reset(request.body, key(request))));
  return app;
}
