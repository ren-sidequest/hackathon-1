// Test-only in-memory backend; never reads the user's database or model credentials.
import { createApp } from '../../backend/dist/app.js';
import { createAnalyzer } from '../../backend/dist/analysis.js';
const manual = createAnalyzer({ mode:'manual_simulation', apiKey:'', model:'', timeoutMs:2000, caseContext:'' });
const app = await createApp({ port:8789, databasePath:':memory:',
  adminToken:'api-ui-test-only-reset-token', allowedOrigins:['http://127.0.0.1:5373','http://127.0.0.1:5386'],
  analyzer: async submission => {
    if (submission.summary.includes('TEST_DISABLED')) throw Object.assign(new Error('Test disabled'), { code:'AI_DISABLED' });
    if (submission.summary.includes('TEST_DELAY')) await new Promise(resolve => setTimeout(resolve, 4500));
    return manual(submission);
  },
});
await app.listen({ host:'127.0.0.1', port:8789 });
for (const signal of ['SIGINT','SIGTERM']) process.once(signal, () => { void app.close().then(() => process.exit(0)); });
