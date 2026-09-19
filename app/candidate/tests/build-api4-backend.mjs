import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
const root = resolve(process.env.EB_API4_BACKEND_ROOT || '../..');
// Build the supplied backend unchanged. Fail clearly if the API4 dependency is absent.
const contract = resolve(root, 'app/shared/api4-types.ts');
if (!readFileSync(contract, 'utf8').includes('"schemaVersion": "4.0"')) throw new Error('Select the frozen API4 backend with EB_API4_BACKEND_ROOT.');
const result = spawnSync(process.execPath, [resolve(root, 'app/backend/node_modules/typescript/bin/tsc'), '-p', resolve(root, 'app/backend/tsconfig.json')], { stdio: 'inherit' });
process.exit(result.status ?? 1);
