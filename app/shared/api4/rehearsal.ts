import type { Demo, Finding } from '../api4-types';
import { appendDraftEvent, event, sections, type CandidateDraft } from './candidate-draft';

// Authored rehearsal text, never a model response or evidence of independent candidate work.
type Example = [title: string, detail: string, source: string];
export const examples: Record<Finding['section'], Example[]> = {
  'Key Findings': [
    ['More visits, fewer completed orders', 'Sessions rose from 1,000,000 to 1,180,000 (+18%), while orders fell from 34,000 to 30,680 (-9.76%). Conversion = orders / sessions: 3.4% to 2.6%, a drop of 0.8 percentage points. Traffic growth alone is not evidence of business improvement.', 'website_traffic.csv'],
    ['Paid Search is a priority segment', 'Paid Search conversion fell from 3.2% to 1.8%. Its current 426,000 sessions produced 7,668 orders. Compare it with other channels before attributing the overall decline to a single cause.', 'channel_comparison.csv'],
    ['Current device split is not a historical trend', 'Current Paid Search mobile conversion is 4,200 / 300,000 = 1.4%; desktop is 3,468 / 126,000 = 2.75%. These groups reconcile to 426,000 sessions and 7,668 orders. No previous-period device split is supplied.', 'current_paid_search_devices.csv'],
    ['The two CSVs overlap', 'website_traffic.csv and orders.csv describe the same channel-period aggregates. Join by record_id if needed; do not add their populations. Calculate total conversion as SUM(orders) / SUM(sessions), not an average of channel rates.', 'business_context.md']
  ],
  'Hypotheses': [
    ['Traffic mix or landing-page friction?', 'New Paid Search campaigns may have brought lower-intent visitors; the changed Spring Sale landing page may also have added friction. Both changes coincide with the current period. Neither explanation is proven by aggregate conversion.', 'business_context.md'],
    ['Device composition may explain part of the drop', 'A greater share of low-converting mobile traffic could lower aggregate Paid Search conversion even if within-device performance were stable. Historical device counts are missing, so this remains a hypothesis.', 'current_paid_search_devices.csv'],
    ['A within-segment conversion decline is possible', 'If conversion fell within the same campaign and device groups, a pure traffic-mix explanation would be incomplete. Landing-page or checkout friction would need investigation, not an assumed diagnosis.', 'business_context.md'],
    ['Product availability is an alternative to investigate', 'The catalogue lists limited availability for one product, but no order-level product attribution is provided. Stock constraints might affect conversion; catalogue status alone cannot explain this decline.', 'product_catalog.csv']
  ],
  'Additional Evidence Needed': [
    ['Compare matched campaign and device groups', 'Request sessions and orders by campaign × device for the same two four-week periods. If within-group rates stay stable but traffic shifts toward lower-converting groups, that supports a mix explanation. If matched groups also deteriorate, investigate within-group friction. Current channel totals cannot distinguish these results.', 'business_context.md'],
    ['Test the changed landing page', 'Request landing-page × device counts, load-time distributions and checkout-step events for both periods. A decline concentrated on the changed page with slower loading or extra drop-off supports friction; comparable unchanged pages declining too would weaken that explanation.', 'business_context.md'],
    ['Separate device mix from device performance', 'Request previous-period Paid Search device sessions and orders using the same definitions. Reweight current device rates with previous device shares. A small within-device effect suggests composition; lower rates in both devices suggest an additional performance issue.', 'current_paid_search_devices.csv'],
    ['Check availability against lost orders', 'Request product-level availability history and product-view-to-order funnels across the two periods. Losses concentrated in unavailable products support a stock hypothesis; losses across in-stock products would weaken it. No such attribution is supplied yet.', 'product_catalog.csv']
  ],
  'Recommended Next Steps': [
    ['Validate before scaling the advertising budget', 'Ask an experienced analyst to validate the matched campaign/device comparison before increasing spend. If evidence points to page friction, propose a bounded controlled test with a product colleague. Compare orders / sessions and cost per order over equivalent windows, monitor checkout failures, and stop if guardrails worsen.', 'business_context.md'],
    ['Audit denominators and overlapping data', 'Reconcile channel totals to 1,180,000 sessions and 30,680 orders. Check one record per channel-period, aligned four-week windows, missing counts and zero denominators. Resolve discrepancies before recommending investment.', 'website_traffic.csv'],
    ['Run a bounded landing-page experiment', 'With product-team approval, compare the current and revised page on comparable traffic. Define orders / sessions as the primary metric, track spend and checkout failure guardrails, and agree duration and sample requirements before starting. No experiment result is claimed here.', 'business_context.md'],
    ['Report findings and remaining uncertainty separately', 'Present the observed conversion drop, competing explanations and requested comparisons as separate statements. Ask a senior colleague to review attribution and experiment design. Update the recommendation when the missing comparison arrives; do not treat a hypothesis as a confirmed cause.', 'business_context.md']
  ]
};
export const demoSummary = 'Synthetic rehearsal example — not independent candidate work. Harbour Retail sessions increased 18% but orders fell 9.76%; conversion declined from 3.4% to 2.6%. Paid Search is a priority for investigation. New campaign traffic and the changed landing page are competing explanations, not proven causes. Compare matched campaign/device groups across both periods: stable within-group rates with changing traffic shares support a mix explanation; deteriorating matched groups warrant friction checks. Validate the missing evidence before scaling spend, then agree a bounded test and guardrails with an experienced colleague.';

export function supportsExamples(data: Demo) {
  return data.datasetVersion === 'harbour-retail-2026-09-v1' && data.task.targetRequirementId === 'business-problem-solving';
}
export function nextExample(section: Finding['section'], findings: Finding[]): Finding | null {
  const index = examples[section].findIndex(([title], i) => !findings.some(f => f.section === section
    && (f.title === title || f.id.startsWith(`sample-${sections.indexOf(section)}-${i}-`))));
  if (index < 0) return null;
  const [title, detail, source] = examples[section][index];
  return { id: `sample-${sections.indexOf(section)}-${index}-${crypto.randomUUID()}`, section, title,
    detail: `Synthetic rehearsal example. ${detail}`, source, confidence: section === 'Hypotheses' ? 'Low' : 'Medium' };
}
export function fillDemoDraft(draft: CandidateDraft): CandidateDraft {
  const findings = [...draft.findings];
  for (const section of sections) {
    if (findings.length >= 40 || findings.some(f => f.section === section)) continue;
    const sample = nextExample(section, findings); if (sample) findings.push(sample);
  }
  const summary = draft.summary.trim() ? draft.summary : demoSummary;
  if (summary === draft.summary && findings.length === draft.findings.length) return draft;
  return appendDraftEvent({ ...draft, summary, findings }, event('Loaded synthetic rehearsal examples', 'Authored sample text; existing work and private notes preserved. Not a live AI action.'));
}
