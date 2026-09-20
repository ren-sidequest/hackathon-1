import { readFileSync } from 'node:fs';
import { CONTENT_MANIFEST } from './content.js';
import { validateState } from './state-schema.js';
import { SCHEMA_VERSION } from './schema.js';
import { RestartSchema, type RestartRequest } from './schema.js';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest, type FastifyError } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { timingSafeEqual, randomUUID, createHash } from 'node:crypto';
import { Type } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import { RevisionStore as Store, type StoredResponse } from './store.js';
import { RevisionService as DemoService } from './service.js';
import { type Analyzer } from './analysis.js';
import { createTargetAnalyzer as createAnalyzer } from './analysis.js';
import { createSeed } from './task-seed.js';
import { defaultOrigins, type AppConfig } from '../config.js';
import { ApiError } from '../errors.js';
import { EnvelopeSchema, ComparisonEnvelopeSchema } from './response-schema.js';
import { SendSchema, SubmitSchema, AnalyzeSchema, ReviewSchema, ResetSchema, ErrorSchema, WriteHeaders, QuerySchema, AssessmentSchema, ShortlistSchema, type SendRequest, type SubmitRequest, type AnalyzeRequest, type ReviewRequest, type ResetRequest, type AssessmentRequest, type ShortlistRequest, type PersonId } from './schema.js';
export type AppOptions = Partial<AppConfig> & {
  analyzer?: Analyzer;
  log?: (entry: Record<string, unknown>) => void;
};
export async function createRevision5App(options: AppOptions = {}): Promise<FastifyInstance> {
  const port = options.port ?? 8787;
  const adminToken = options.adminToken ?? '';
  if (adminToken && (adminToken.length < 24 || adminToken.length > 256))
    throw new Error('Invalid demo admin token length');
  const store = new Store(options.databasePath ?? ':memory:', validateState);
  let service: DemoService;
  try {
    const context = createSeed().dataset.resources.map(r => `SOURCE ${r.id}\n${r.content}`).join('\n\n');
    service = new DemoService(store, options.analyzer ?? createAnalyzer({
      mode: options.analysisMode ?? 'disabled', apiKey: options.apiKey ?? '', model: options.model ?? '',
      timeoutMs: options.aiTimeoutMs ?? 20000, caseContext: context,
    }), options.analysisMode ?? 'disabled', options.analysisMode === 'live' && !options.analyzer && (!options.apiKey || !options.model) ? 'AI_NOT_CONFIGURED' : (options.analysisMode ?? 'disabled') === 'disabled' ? 'AI_DISABLED' : null);
  }
  catch (error) {
    store.close();
    throw error;
  }
  const app = Fastify({
    logger: false, requestIdHeader: false,
    genReqId: () => randomUUID(), bodyLimit: 128 * 1024, requestTimeout: 10000, connectionTimeout: 15000,
    ajv: {
      customOptions: {
        removeAdditional: false, coerceTypes: false, useDefaults: false, allErrors: false
      }
    },
  });
  app.addHook('onClose', async () => store.close());
  // Reject contract drift rather than silently stripping fields during serialization.
  app.addHook('preSerialization', async (request, reply, payload) => {
    if (reply.statusCode < 300 && request.routeOptions.url?.startsWith('/api/demo') && !request.routeOptions.url.startsWith('/api/demo/materials/')) {
      const schema = [
        '/api/demo/comparison', '/api/demo/reset'
      ].includes(request.routeOptions.url) ? ComparisonEnvelopeSchema : EnvelopeSchema;
      if (!Value.Check(schema, payload))
        throw new Error('Response schema mismatch');
    }
    return payload;
  });
  const origins = new Set(options.allowedOrigins ?? defaultOrigins);
  const log = options.log ?? (() => undefined);
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store').header('X-Content-Type-Options', 'nosniff');
    const address = app.server.address();
    const boundPort = address && typeof address === 'object' ? address.port : port;
    const hosts = new Set([
      `127.0.0.1:${boundPort}`, `localhost:${boundPort}`
    ]);
    if (!request.headers.host || !hosts.has(request.headers.host.toLowerCase()))
      throw new ApiError('HOST_NOT_ALLOWED', 403, 'Host is not allowed.');
    const origin = request.headers.origin;
    const ownOrigins = new Set([
      ...hosts
    ].map(h => `http://${h}`));
    if (origin && (!origins.has(origin) && !ownOrigins.has(origin)))
      throw new ApiError('ORIGIN_NOT_ALLOWED', 403, 'Origin is not allowed.');
    if (!origin && request.headers['sec-fetch-site'] === 'cross-site')
      throw new ApiError('ORIGIN_NOT_ALLOWED', 403, 'Cross-site request is not allowed.');
    if (origin)
      reply.header('Access-Control-Allow-Origin', origin).header('Vary', 'Origin');
    const requestedVersion = request.headers['x-evidencebridge-schema-version'];
    if (requestedVersion && requestedVersion !== SCHEMA_VERSION)
      throw new ApiError('SCHEMA_MISMATCH', 409, 'This service uses API 4.0 and new applicant identities. Use a compatible client; old drafts and IDs are not remapped.');
    if (request.method === 'OPTIONS') {
      const requested = String(request.headers['access-control-request-headers'] ?? '').toLowerCase().split(',').map(h => h.trim()).filter(Boolean);
      if (requested.some(h => ![
        'content-type', 'idempotency-key', 'x-demo-admin-token', 'x-evidencebridge-schema-version'
      ].includes(h)))
        throw new ApiError('HEADER_NOT_ALLOWED', 403, 'Requested header is not allowed.');
      reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        .header('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key, X-Demo-Admin-Token, X-EvidenceBridge-Schema-Version').code(204).send();
    }
  });
  app.addHook('onResponse', async (request, reply) => {
    // No raw URL/query, request body, arbitrary headers, prompt, credential or provider payload.
    log({
      requestId: request.id, method: request.method, route: request.routeOptions.url ?? 'unmatched', status: reply.statusCode
    });
  });
  app.setErrorHandler((unknownError, request, reply) => {
    const error = unknownError as FastifyError;
    let code = 'INTERNAL_ERROR';
    let status = 500;
    let message = 'Request failed. The saved case has not been replaced.';
    let retryable = false;
    if (error instanceof ApiError)
      ({
        code, status, message, retryable
      } = error);
    else if (error.validation) {
      code = 'INVALID_REQUEST';
      status = 400;
      message = 'Request does not match the API schema. Check required fields, types and limits.';
    }
    else if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      status = error.statusCode;
      code = status === 413 ? 'PAYLOAD_TOO_LARGE' : status === 415 ? 'UNSUPPORTED_MEDIA_TYPE' : 'INVALID_REQUEST';
      message = 'Request encoding, size or content type is invalid.';
    }
    log({
      requestId: request.id, code, status
    });
    reply.code(status).send({
      error: {
        code, message, requestId: request.id, retryable
      }
    });
  });
  app.setNotFoundHandler((request, reply) => reply.code(404).send({
    error: {
      code: 'NOT_FOUND', message: 'Endpoint was not found.', requestId: request.id, retryable: false,
    }
  }));
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3', info: {
        title: 'EvidenceBridge local demo API', version: '4.0', description: 'Four owned synthetic candidate workflows, fixed job/rubric and three targeted templates. V1 plus at most one approved V2 per person. Assessment, evidence review and human shortlist are separate. Loopback demo; no authentication or automated hiring rank.',
      }, servers: [
        {
          url: `http://127.0.0.1:${port}`
        }
      ], components: {
        securitySchemes: {
          demoAdmin: {
            type: 'apiKey', in: 'header', name: 'X-Demo-Admin-Token'
          },
        }
      }
    }
  });
  await app.register(swaggerUi, {
    routePrefix: '/docs', staticCSP: true
  });
  app.addSchema({
    ...EnvelopeSchema, $id: 'DemoEnvelope'
  });
  app.addSchema({
    ...ComparisonEnvelopeSchema, $id: 'ComparisonEnvelope'
  });
  app.addSchema({
    ...ErrorSchema, $id: 'ApiError'
  });
  const errorResponses = {
    '4xx': {
      $ref: 'ApiError#'
    }, '5xx': {
      $ref: 'ApiError#'
    }
  };
  const responses = {
    200: {
      $ref: 'DemoEnvelope#'
    }, ...errorResponses
  };
  const comparisonResponses = {
    200: {
      $ref: 'ComparisonEnvelope#'
    }, ...errorResponses
  };
  const submissionResponses = {
    201: {
      $ref: 'DemoEnvelope#'
    }, ...errorResponses
  };
  const analysisResponses = {
    ...responses, 202: {
      $ref: 'DemoEnvelope#'
    }
  };
  const deliver = (reply: FastifyReply, result: StoredResponse) => reply.code(result.status).send(result.body);
  const key = (request: FastifyRequest) => request.headers['idempotency-key'] as string;
  const preWrite = async (request: FastifyRequest) => {
    if (!/^application\/json(?:\s*;.*)?$/i.test(request.headers['content-type'] ?? ''))
      throw new ApiError('UNSUPPORTED_MEDIA_TYPE', 415, 'Use application/json.');
    const body = request.body as {schemaVersion?: unknown} | null;
    if (body && typeof body === 'object' && body.schemaVersion !== undefined && body.schemaVersion !== SCHEMA_VERSION)
      throw new ApiError('SCHEMA_MISMATCH', 409, 'Use API 4.0 with a fresh session and the new applicant IDs. Preserve legacy data separately.');
  };
  app.get('/healthz', {
    schema: {
      summary: 'Storage readiness; never invokes a model', response: {
        200: Type.Object({
          status: Type.Literal('ok'), storage: Type.Literal('sqlite'), schemaVersion: Type.Literal('4.0')
        })
      }
    }
  }, async () => {
    if (!store.health())
      throw new Error('Database health check failed');
    return {
      status: 'ok', storage: 'sqlite', schemaVersion: '4.0'
    };
  });
  app.get<{
    Querystring: {
      candidateId: PersonId;
    };
  }>('/api/demo', {
    preValidation: async request => {
      if (['alex-chen','maya-patel','leo-zhang','sam-taylor'].includes(String(request.query?.candidateId)))
        throw new ApiError('SCHEMA_MISMATCH', 409, 'Legacy applicant IDs belong to API3. Select an API4 applicant explicitly; histories are not renamed.');
    },
    schema: {
      summary: 'Read one explicitly selected applicant; no legacy ID aliases', querystring: QuerySchema, response: responses
    }
  }, async (request) => service.read(request.query.candidateId));
  app.get('/api/demo/comparison', {
    schema: {
      summary: 'Same-stage application comparison; task assessments kept separate', querystring: Type.Object({}, {
        additionalProperties: false
      }), response: comparisonResponses
    }
  }, async () => service.comparison());
  // Fixed, fictional originals only. No user-supplied filesystem path is read.
  const materialFiles = new Map([
    ['job-description.pdf', 'job-description.pdf'],
    ...['amy-chen', 'ann-li', 'david-liu', 'jamie-parker'].map(id => [`${id}/cv.pdf`, `${id}/cv.pdf`] as [string, string])
  ]);
  app.get<{Params:{'*':string}}>('/api/demo/materials/*', {
    schema: {summary:'Download a fixed fictional original PDF; default displayed CV text is minimized',
      querystring:Type.Object({}, {additionalProperties:false}),
      response:{200:Type.String({format:'binary'}), ...errorResponses}}
  }, async (request, reply) => {
    const path = materialFiles.get(request.params['*']);
    if (!path) throw new ApiError('NOT_FOUND',404,'This fixed material is not available.');
    const bytes = readFileSync(new URL(`../../content/r6/${path}`, import.meta.url));
    const expected = CONTENT_MANIFEST.files.find(file => file.file === path)?.sha256;
    if (createHash('sha256').update(bytes).digest('hex') !== expected)
      throw new ApiError('MATERIAL_INTEGRITY_MISMATCH', 503, 'The original material differs from the frozen content manifest. Preserve the release and request an integrity check.');
    return reply.type('application/pdf').header('Content-Disposition', `attachment; filename="${path.replace('/', '-') }"`)
      .header('X-Content-Provenance', 'User-supplied fictional original; not independently verified').send(bytes);
  });
  app.post<{
    Body: AssessmentRequest;
  }>('/api/demo/assessment', {
    preValidation: preWrite, schema: {
      summary: 'Save an entire owned criterion group atomically; deterministic server scores', headers: WriteHeaders, body: AssessmentSchema, response: submissionResponses
    }
  }, async (request, reply) => deliver(reply, service.assess(request.body, key(request))));
  app.post<{
    Body: ShortlistRequest;
  }>('/api/demo/shortlist', {
    preValidation: preWrite, schema: {
      summary: 'Human retain/remove/reconfirm with material and assessment basis', headers: WriteHeaders, body: ShortlistSchema, response: responses
    }
  }, async (request, reply) => deliver(reply, service.shortlist(request.body, key(request))));
  app.post<{
    Body: SendRequest;
  }>('/api/demo/task/send', {
    preValidation: preWrite, schema: {
      summary: 'Send one fixed SQL, DA or BPS target template per candidate', headers: WriteHeaders, body: SendSchema, response: responses
    }
  }, async (request, reply) => deliver(reply, service.send(request.body, key(request))));
  app.post<{
    Body: SubmitRequest;
  }>('/api/demo/submission', {
    preValidation: preWrite, schema: {
      summary: 'Save V1 or an explicitly permitted V2; private notes are excluded', headers: WriteHeaders, body: SubmitSchema, response: submissionResponses
    }
  }, async (request, reply) => deliver(reply, service.submit(request.body, key(request))));
  app.post<{
    Body: AnalyzeRequest;
  }>('/api/demo/analysis', {
    preValidation: preWrite, schema: {
      summary: 'Extract and validate observations from the exact saved submission', headers: WriteHeaders, body: AnalyzeSchema, response: analysisResponses
    }
  }, async (request, reply) => deliver(reply, await service.analyze(request.body, key(request))));
  app.post<{
    Body: ReviewRequest;
  }>('/api/demo/review', {
    preValidation: preWrite, schema: {
      summary: 'Save one human evidence decision; only the target requirement changes', headers: WriteHeaders, body: ReviewSchema, response: responses
    }
  }, async (request, reply) => deliver(reply, service.review(request.body, key(request))));
  app.post<{ Body: RestartRequest }>('/api/demo/rehearsal/restart', {
    preValidation: preWrite, schema: {
      summary: 'Archive and restart one shared synthetic candidate rehearsal; other candidates are unchanged',
      headers: WriteHeaders, body: RestartSchema, response: responses
    }
  }, async (request, reply) => deliver(reply, service.restart(request.body, key(request))));
  app.post<{
    Body: ResetRequest;
  }>('/api/demo/reset', {
    preValidation: preWrite, preHandler: async (request) => {
      if (!adminToken)
        throw new ApiError('RESET_DISABLED', 503, 'Demo reset is disabled until an admin token is configured.');
      const incoming = request.headers['x-demo-admin-token'];
      if (typeof incoming !== 'string' || Buffer.byteLength(incoming) !== Buffer.byteLength(adminToken) || !timingSafeEqual(Buffer.from(incoming), Buffer.from(adminToken)))
        throw new ApiError('ADMIN_TOKEN_REQUIRED', 403, 'Demo admin token is required.');
    }, schema: {
      summary: 'Reset synthetic case; old submission references become stale', security: [
        {
          demoAdmin: []
        }
      ], headers: WriteHeaders, body: ResetSchema, response: comparisonResponses
    }
  }, async (request, reply) => deliver(reply, service.reset(request.body, key(request))));
  return app;
}
