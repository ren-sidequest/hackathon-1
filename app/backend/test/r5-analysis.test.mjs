import test from 'node:test';
import assert from 'node:assert/strict';
import { createTargetAnalyzer, profileFor } from '../dist/r5/analysis.js';
import { AnalysisError } from '../dist/analysis.js';
// Transport stubs only. These verify provider payload/profile contracts, not real model quality.
const work = target => ({sessionId:'session-test',candidateId:'ann-li',jobId:'junior-data-analyst',taskId:'task-test',targetRequirementId:target,
  datasetVersion:'harbour-retail-2026-09-v1',submissionId:'submission-test',contentFingerprint:'f'.repeat(64),
  summary:'🔎 中文\nA cause remains unverified; test matched groups.',findings:[],processEvidence:[],notes:'PRIVATE-NOTES-MUST-NOT-ENTER'});
const observations = target => profileFor(target).dimensions.map(dimension=>({dimension,status:'not_observed',statement:'TEST-STUB: insufficient direct support.',citations:[],scope:'Synthetic work only.',uncertainty:'Human review required.'}));
const response = values => Response.json({id:'resp_r5_test',model:'test-model',status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({observations:values})}]}]});
for(const target of ['sql','data-analysis','business-problem-solving'])test(`R5 ${target} provider TEST-STUB has correct profile, owner context and no private notes`,async()=>{
  let calls=0;
  const input=work(target);
  const analyze=createTargetAnalyzer({mode:'live',apiKey:'test-only-not-a-secret',model:'test-model',caseContext:'Synthetic public case data.',fetchImpl:async(url,options)=>{
    calls++;assert.equal(url,'https://api.openai.com/v1/responses');const body=JSON.parse(options.body);
    assert.equal(body.store,false);assert.equal(body.text.format.strict,true);
    assert.deepEqual(body.text.format.schema.properties.observations.items.properties.dimension.enum,profileFor(target).dimensions);
    assert.equal(body.text.format.schema.properties.observations.minItems,profileFor(target).dimensions.length);
    assert.match(body.input[0].content,new RegExp(target));assert.doesNotMatch(body.input[0].content,/Alex Chen/);
    assert.match(body.input[0].content,/statement, scope and uncertainty in English/);assert.match(body.input[0].content,/source quotes verbatim/);
    assert.match(body.input[0].content,/untrusted data/);assert.match(body.input[0].content,/not.*score|Do not score/);
    const publicInput=body.input[1].content;
    assert.match(publicInput,/ann-li/);assert.match(publicInput,/session-test/);assert.match(publicInput,/junior-data-analyst/);
    assert.doesNotMatch(JSON.stringify(body),/PRIVATE-NOTES-MUST-NOT-ENTER/);
    return response(observations(target));
  }});
  const result=await analyze(input);assert.equal(calls,1);assert.equal(result.mode,'live');
  assert.equal(result.promptVersion,profileFor(target).promptVersion);assert.equal(result.submissionId,input.submissionId);
  assert.deepEqual(result.observations.map(o=>o.dimension),profileFor(target).dimensions);
});
test('R5 SQL rejects a provider returning the BPS observation group',async()=>{
  const analyze=createTargetAnalyzer({mode:'live',apiKey:'test-only',model:'test-model',fetchImpl:async()=>response(observations('business-problem-solving'))});
  await assert.rejects(analyze(work('sql')),error=>error instanceof AnalysisError&&error.code==='AI_OUTPUT_INVALID');
});
test('R5 actual bounded timeout path retains 504 and retryable metadata without provider text',async()=>{
  const analyze=createTargetAnalyzer({mode:'live',apiKey:'test-only',model:'test-model',timeoutMs:10,fetchImpl:async()=>new Promise(()=>{})});
  await assert.rejects(analyze(work('sql')),error=>error instanceof AnalysisError&&error.code==='AI_TIMEOUT'&&error.statusCode===504&&error.retryable===true);
});
