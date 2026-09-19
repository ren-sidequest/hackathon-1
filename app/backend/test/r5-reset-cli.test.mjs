import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createRevision5App } from '../dist/r5/app.js';
import { createApp } from '../dist/app.js';
const exec = promisify(execFile), token = 'SYNTHETIC-reset-cli-test-admin-token';
const cli = fileURLToPath(new URL('../scripts/reset.mjs', import.meta.url));
async function serve(t, version) {
  const app = await (version === '4.0' ? createRevision5App : createApp)({ databasePath: ':memory:', adminToken: token });
  await app.listen({host:'127.0.0.1',port:0}); t.after(()=>app.close()); return `http://127.0.0.1:${app.server.address().port}`;
}
async function get(base,path) { return (await (await fetch(`${base}${path}`)).json()).data; }
async function post(base,path,body) { const r=await fetch(`${base}${path}`,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:JSON.stringify(body)});assert.equal(r.status,200);return (await r.json()).data; }
function invoke(base, admin=token, args=[]) { return exec(process.execPath,[cli,...args],{env:{PATH:process.env.PATH,BASE_URL:base,DEMO_ADMIN_TOKEN:admin}}); }

test('reset CLI detects API4 and resets all four owned cases through real HTTP', async t=>{
  const base=await serve(t,'4.0'), before=await get(base,'/api/demo/comparison');
  for(const row of before.candidates) {
    const d=await get(base,`/api/demo?candidateId=${row.candidate.id}`);
    await post(base,'/api/demo/task/send',{schemaVersion:'4.0',sessionId:d.sessionId,candidateId:d.candidate.id,jobId:d.job.id,datasetVersion:d.datasetVersion,taskId:d.task.taskId,targetRequirementId:'sql',templateId:'harbour-retail-sql-v1',instructions:'Synthetic reset test task',gapReason:'Synthetic source gap'});
  }
  const result=await invoke(base);const output=JSON.parse(result.stdout);
  assert.deepEqual(output,{status:'reset',schemaVersion:'4.0',candidatesReset:4,taskStatus:'draft',oldReferencesInvalidated:true});assert.ok(!result.stdout.includes(token));
  const after=await get(base,'/api/demo/comparison');assert.notEqual(after.sessionId,before.sessionId);assert.ok(after.candidates.every(p=>p.task.status==='draft'));
});
test('reset CLI keeps API2 compatibility',async t=>{
  const base=await serve(t,'2.0'), before=await get(base,'/api/demo');
  const output=JSON.parse((await invoke(base)).stdout);assert.equal(output.schemaVersion,'2.0');assert.equal(output.candidatesReset,1);
  assert.notEqual((await get(base,'/api/demo')).sessionId,before.sessionId);
});
test('invalid token leaves the case untouched and credentials out of logs',async t=>{
  const base=await serve(t,'4.0'), before=await get(base,'/api/demo/comparison'), wrong='WRONG-SYNTHETIC-reset-cli-admin-token';
  await assert.rejects(invoke(base,wrong),e=>{assert.ok(!`${e.stdout}${e.stderr}`.includes(wrong));assert.match(e.stderr,/ADMIN_TOKEN_REQUIRED/);return true;});
  assert.deepEqual(await get(base,'/api/demo/comparison'),before);
});
test('missing token and command-line arguments stop before reset',async t=>{
  const base=await serve(t,'4.0'), before=await get(base,'/api/demo/comparison');
  await assert.rejects(invoke(base,''),e=>{assert.match(e.stderr,/ADMIN_TOKEN_REQUIRED/);return true;});
  await assert.rejects(invoke(base,token,['--token','never-log-me']),e=>{assert.match(e.stderr,/INVALID_ARGUMENTS/);assert.ok(!e.stderr.includes('never-log-me'));return true;});
  assert.deepEqual(await get(base,'/api/demo/comparison'),before);
});
test('unknown service contract stops before any reset write',async t=>{
  const {createServer}=await import('node:http');let writes=0;
  const server=createServer((req,res)=>{if(req.method==='POST')writes++;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({status:'ok',storage:'sqlite',schemaVersion:'99.0'}));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  await assert.rejects(invoke(`http://127.0.0.1:${server.address().port}`),e=>{assert.match(e.stderr,/UNSUPPORTED_CONTRACT/);return true;});assert.equal(writes,0);
});
