// Authored UI-only synthetic fixtures. Not backend fixtures, actual assessments, or AI output.
import type { AssessmentEntry, Criterion, Mark, Profile, Skill } from './model';
import { rubricVersion } from './model';

export const criteria: Criterion[] = [
  { id:'S1', skill:'SQL', title:'Query grain, aggregation & joins', looksFor:'Explain what one row represents and how joins preserve it.', anchors:{4:'Correct grain and joins; duplication risks are checked.',2:'Relevant aggregation with an unresolved join or grain assumption.',0:'Visible join or aggregation error changes the answer.'} },
  { id:'S2', skill:'SQL', title:'Time windows & reproducibility', looksFor:'Comparable periods, explicit boundaries and a reviewable query.', anchors:{4:'Explicit, comparable windows and reproducible query steps.',2:'A comparison exists but a time boundary remains ambiguous.',0:'Incompatible periods or a visible boundary error.'} },
  { id:'S3', skill:'SQL', title:'Validation & edge cases', looksFor:'Checks for missing values, duplicates, zero denominators and limits.', anchors:{4:'Relevant checks plus clear limitations.',2:'Some checks; an important edge case is unaddressed.',0:'Provided validation is incorrect or ignores a demonstrated failure.'} },
  { id:'D1', skill:'DA', title:'Metrics, denominators & units', looksFor:'Define each metric and show its denominator, units and calculation.', anchors:{4:'Definitions and calculations are explicit and consistent.',2:'Relevant metrics with an unresolved denominator or unit.',0:'A visible calculation or denominator error invalidates the metric.'} },
  { id:'D2', skill:'DA', title:'Meaningful comparisons', looksFor:'Comparable periods or groups, with a reason for choosing them.', anchors:{4:'Appropriate groups and periods; composition effects considered.',2:'A useful comparison with limited control for group differences.',0:'An invalid comparison is presented as reliable evidence.'} },
  { id:'D3', skill:'DA', title:'Reviewable process & limitations', looksFor:'Traceable steps, assumptions and limits another reviewer can follow.', anchors:{4:'Reproducible steps and explicit limits.',2:'Some steps are clear; assumptions or checks are missing.',0:'The supplied process contradicts the conclusion or cannot support it.'} },
  { id:'B1', skill:'BPS', title:'Business question & decision', looksFor:'The decision, business objective and scope of the investigation.', anchors:{4:'Specific decision, objective, constraints and success measure.',2:'Relevant business issue with a loosely defined decision.',0:'The proposed decision conflicts with the stated business need.'} },
  { id:'B2', skill:'BPS', title:'Observation, hypothesis & causality', looksFor:'Separate measured patterns from explanations and causal claims.', anchors:{4:'Competing hypotheses and clearly bounded causal claims.',2:'Some separation, but alternatives or causal limits are incomplete.',0:'A stated causal conclusion contradicts or exceeds the evidence.'} },
  { id:'B3', skill:'BPS', title:'Discriminating evidence plan', looksFor:'What to request and how the result would distinguish explanations.', anchors:{4:'Specific data request, comparison and a discriminating result.',2:'Relevant data requested, without a method to distinguish explanations.',0:'The requested evidence cannot test the stated explanation.'} },
  { id:'B4', skill:'BPS', title:'Priorities, actions & validation', looksFor:'A feasible first action, ordering and measurable validation.', anchors:{4:'Prioritised feasible actions with a validation measure.',2:'A relevant action with incomplete priorities or measurement.',0:'The proposed action is unsupported or conflicts with the evidence.'} },
];

const descriptions = [
  { id:'preview-alex',name:'Alex Chen',initials:'AC',subtitle:'Technical project evidence · business questions remain',suggestedSkill:'BPS' as Skill,
    strength:'Reviewable SQL and metric calculations.',question:'Which evidence would distinguish the conversion explanations?',
    cv:'Alex Chen · Synthetic frontend preview\nJunior analyst applicant with coursework in SQL and ecommerce reporting. The supplied project is a static portfolio sample; no code execution or independent authorship has been verified.',
    lines:[
      'I aggregate orders to session-channel-period grain before joining channel totals; the join key is channel and period.',
      'I compare the previous four weeks with the last four weeks and use half-open timestamp bounds.',
      'I inspect null channel keys and compare joined counts with input counts; a full automated test suite is not supplied.',
      'Conversion = orders / sessions. Current 30,680 / 1,180,000 = 2.6%; previous 34,000 / 1,000,000 = 3.4%.',
      'Paid Search has 426,000 sessions and 7,668 orders. I compare its 1.8% conversion with other channels before interpreting the aggregate.',
      'The calculation table records period totals and denominators; the supplied aggregates cannot establish user-level behaviour.',
      'The team needs to understand falling conversion before increasing advertising spend. I have not yet specified a decision threshold.',
      '',
      '😀 Evidence request\nRequest campaign × device and checkout-step data.',
      '',
    ], marks:[3,3,3,3,3,3,2,'NE',2,'NE'] as Mark[], scores:{skills:{SQL:75,DA:75,BPS:null},overall:null,coverage:8,reviewedPoints:55} },
  { id:'preview-maya',name:'Maya Patel',initials:'MP',subtitle:'Business analysis evidence · SQL validation gap',suggestedSkill:'SQL' as Skill,
    strength:'Useful segmentation and a bounded business recommendation.',question:'Can the query reproduce the comparison and handle edge cases?',
    cv:'Maya Patel · Synthetic frontend preview\nOperations analyst applicant. Portfolio includes a conversion investigation and an incomplete SQL sketch. These documents are authored UI samples, not verified employment history.',
    lines:[
      'My query joins session rows to order rows and groups by channel; I have not yet checked whether the join duplicates sessions.',
      'I compare this month to last month; the exact timestamp boundaries are still to be specified.',
      '',
      'I define conversion as orders divided by sessions and report the percentage-point change separately from relative change.',
      'I compare Paid Search and Organic over the same four-week windows, while noting their different traffic composition.',
      'The spreadsheet keeps formulas and source tabs so a reviewer can reproduce the reported rates; event-level data is unavailable.',
      'The immediate decision is whether to defer increasing ad spend until the source of the conversion change is better understood.',
      'The pattern is consistent with a traffic-mix change or checkout friction; aggregate channel totals do not distinguish these causes.',
      'Request campaign-by-device conversion and compare within-device changes; a common drop across campaigns would favour a shared funnel issue.',
      'First validate the funnel by segment, then run a limited experiment with completed-order rate as the primary metric and spend as a guardrail.',
    ], marks:[2,2,'NE',3,3,3,3,3,3,3] as Mark[], scores:{skills:{SQL:null,DA:75,BPS:75},overall:null,coverage:9,reviewedPoints:62.5} },
  { id:'preview-leo',name:'Leo Nguyen',initials:'LN',subtitle:'Broad material coverage · task optional',suggestedSkill:'DA' as Skill,
    strength:'Traceable calculations with practical next steps.',question:'How robust are the conclusions beyond the supplied aggregates?',
    cv:'Leo Nguyen · Synthetic frontend preview\nGraduate analyst applicant. The project includes SQL notes, a calculation log and a bounded action plan. Sufficient material for a comparison does not mean hiring is decided.',
    lines:[
      'I aggregate orders and sessions independently by channel-period, then join those aggregates and check the row count.',
      'The two windows each contain four complete weeks with explicit start-inclusive and end-exclusive boundaries.',
      'I check duplicates, null channel labels and zero-session groups, while noting that synthetic aggregates omit event-level anomalies.',
      'Orders divided by sessions gives 3.4% previously and 2.6% currently: a fall of 0.8 percentage points. All rates use the same unit.',
      'I compare both channel conversion and channel mix before drawing a conclusion from the overall rate.',
      'Each figure links to a source row and calculation. These steps are reviewable, but attribution and customer intent remain unknown.',
      'Decide whether to hold the budget increase while investigating the largest volume channel; limit the first investigation to conversion drivers.',
      'A lower rate is an observation. Different visitor mix and checkout friction are competing explanations, not established causes.',
      'Request cohort-by-device funnel rates and compare within-cohort changes. Stable cohort rates with shifting mix would support a composition explanation.',
      'Validate tracking first, inspect matched cohorts second, then test one change on a limited budget; monitor completed orders per session and acquisition cost.',
    ], marks:[3,3,3,4,3,3,3,3,3,4] as Mark[], scores:{skills:{SQL:75,DA:83.3333333333,BPS:81.25},overall:80,coverage:10,reviewedPoints:80} },
  { id:'preview-sam',name:'Sam Rivera',initials:'SR',subtitle:'Strong SQL example · causal overreach',suggestedSkill:'BPS' as Skill,
    strength:'Detailed SQL checks and reproducible time windows.',question:'Does the evidence support the proposed causal claim and action?',
    cv:'Sam Rivera · Synthetic frontend preview\nApplicant with a detailed SQL portfolio. The business commentary contains intentional reasoning weaknesses to exercise the UI; these are not judgments about a real person.',
    lines:[
      'I state the session-channel-period grain, aggregate before joining, test key uniqueness and reconcile counts before and after the join.',
      'The query uses explicit half-open four-week windows and includes the parameter values and a rerunnable query script.',
      'Checks cover nulls, duplicate keys and zero denominators; event-level attribution limits are recorded.',
      'I calculate conversion as orders / sessions and distinguish the 0.8 percentage-point fall from a relative percentage change.',
      'I compare channel-period rates using the same denominator and period length, while noting changes in traffic composition.',
      'My calculation steps are visible, but I did not document how the event tracking was checked.',
      'The business wants higher conversion, so my proposed goal is to change the largest channel; I have not specified a success threshold.',
      'Paid Search conversion fell, so the advertisements caused the overall decline. I did not test other explanations.',
      'I would ask for more channel totals. I have not said which result would distinguish traffic mix from checkout friction.',
      'I would stop all Paid Search immediately. A bounded experiment, budget guardrail and validation metric are not specified.',
    ], marks:[4,4,3,3,3,2,2,1,1,1] as Mark[], scores:{skills:{SQL:91.6666666667,DA:66.6666666667,BPS:31.25},overall:60,coverage:10,reviewedPoints:60} },
];

export const profiles: Profile[] = descriptions.map(p => {
  const snapshotId = `${p.id}-application-1`;
  const source = { id:`${p.id}-project`, candidateId:p.id, snapshotId, name:`${p.name.split(' ')[0].toLowerCase()}_project_notes.md`, kind:'application' as const, text:p.lines.filter(Boolean).join('\n\n') };
  const entries: AssessmentEntry[] = criteria.map((c,i) => {
    const quote = p.lines[i], start = source.text.indexOf(quote), mark = p.marks[i];
    return { criterionId:c.id, mark, reason:mark === 'NE' ? 'No assessable passage for this criterion in the supplied CV and project notes.' : p.id === 'preview-alex' && c.id === 'B3' ? 'The request names relevant campaign/device and checkout data, but gives no comparison or result that distinguishes hypotheses. The 2/4 anchor applies in this illustrative fixture.' : mark === 4 ? 'The cited passage addresses the full anchor within the limits of a static sample.' : mark === 3 ? 'The main requirement is addressed; review the stated limit before generalising.' : 'A related attempt is visible, but the cited gap prevents a stronger mark.',
      scope:'Static review of the supplied synthetic CV and project notes; no execution or independent authorship verification.',
      gap:mark === 'NE' ? `Supply reviewable evidence for ${c.title.toLowerCase()}.` : p.id === 'preview-alex' && c.id === 'B3' ? 'Explain which comparison you would run and which result would favour one explanation over another.' : mark <= 2 ? c.anchors[2] : 'Confirm that this approach remains valid on the real business data.',
      citation:quote ? {candidateId:p.id,snapshotId,sourceId:source.id,start,end:start+quote.length,text:quote} : null };
  });
  return { ...p, snapshotId, sources:[{id:`${p.id}-cv`,candidateId:p.id,snapshotId,name:`${p.name.split(' ')[0].toLowerCase()}_cv.md`,text:p.cv,kind:'application'},source], assessment:{id:`${p.id}-assessment-1`,revision:1,rubricVersion,candidateId:p.id,snapshotId,stage:'application_review',mode:'illustrative_fixture',entries,results:p.scores} };
});

export const templates: Record<Skill, {title:string;reason:string;instructions:string;hint:string}> = {
  SQL:{title:'Reproducible conversion query',reason:'Clarify query grain, comparable windows and validation.',instructions:'Using the supplied channel-period resources, provide a reviewable SQL query or snippet. Explain the grain, time windows, joins and at least one validation check. State what the aggregates cannot establish. Code is submitted for static review; it is not executed here.',hint:'Use cards for query logic, assumptions, validation checks and limitations. Include code in the reasoning field.'},
  DA:{title:'Metric and comparison investigation',reason:'Clarify metric definitions, calculations and meaningful comparisons.',instructions:'Reproduce the conversion-rate comparison using the supplied data. Show denominators, units, calculations and a useful segmentation. Explain what remains uncertain and how another analyst could check your work.',hint:'Use cards for formulas, comparisons, checks and limitations. Distinguish percentage change from percentage points.'},
  BPS:{title:'Conversion drop investigation',reason:'Clarify the business decision and the evidence needed to distinguish causes.',instructions:'Investigate the conversion decline before a proposed advertising budget increase. Separate observations from hypotheses, request discriminating evidence and recommend a feasible next action with a validation measure.',hint:'Separate findings, testable hypotheses, additional evidence and prioritised next steps.'},
};
