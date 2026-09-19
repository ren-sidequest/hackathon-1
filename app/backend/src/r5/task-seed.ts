/** R6 company-task-only seed. Reuses legacy integer facts, not applicant records or history. */
export const DATASET_VERSION = 'harbour-retail-2026-09-v1';
export const SECTIONS = ['Key Findings', 'Hypotheses', 'Additional Evidence Needed', 'Recommended Next Steps'] as const;

export type Period = 'previous' | 'current';
export type DatasetRecord = {
  id: string; period: Period; channel: string; sessions: number; orders: number;
  adSpendCents: number; revenueCents: number;
};
const channels = ['Organic', 'Paid Search', 'Social', 'Email', 'Direct'];
const periods: Period[] = ['previous', 'current'];
const periodLabels = { previous: 'Previous 4 weeks', current: 'Last 4 weeks' };
const percent = (numerator: number, denominator: number) => 100 * numerator / denominator;
const change = (previous: number, current: number) => percent(current - previous, previous);
const fixed = (n: number, places = 2) => n.toFixed(places);

function createRecords(): DatasetRecord[] {
  // [sessions, orders, advertising spend in cents]; revenue = orders × AUD 30.
  const facts = {
    previous: [[300000, 11400, 0], [300000, 9600, 3391304], [160000, 4480, 782609], [80000, 3600, 0], [160000, 4920, 0]],
    current: [[324000, 11340, 0], [426000, 7668, 3900000], [200000, 4200, 900000], [77600, 3414, 0], [152400, 4058, 0]],
  };
  return periods.flatMap(period => channels.map((channel, i) => {
    const [sessions, orders, adSpendCents] = facts[period][i]!;
    return { id: `${period}-${channel.toLowerCase().replaceAll(' ', '-')}`, period, channel,
      sessions: sessions!, orders: orders!, adSpendCents: adSpendCents!, revenueCents: orders! * 3000 };
  }));
}

export function aggregateDataset(records: readonly DatasetRecord[]) {
  const aggregate = (period: Period) => {
    const result = records.filter(r => r.period === period).reduce((sum, r) => ({
      sessions: sum.sessions + r.sessions, orders: sum.orders + r.orders,
      adSpendCents: sum.adSpendCents + r.adSpendCents, revenueCents: sum.revenueCents + r.revenueCents,
    }), { sessions: 0, orders: 0, adSpendCents: 0, revenueCents: 0 });
    return { ...result, conversionPct: percent(result.orders, result.sessions) };
  };
  const previous = aggregate('previous'); const current = aggregate('current');
  return { previous, current, change: {
    trafficPct: change(previous.sessions, current.sessions), ordersPct: change(previous.orders, current.orders),
    adSpendPct: change(previous.adSpendCents, current.adSpendCents),
    conversionPercentagePoints: current.conversionPct - previous.conversionPct,
  } };
}

type Cell = string | number;
function resource(id: string, description: string, columns: string[], values: Cell[][], text?: string) {
  const rows = values.map(row => row.map(String));
  const content = text ?? [columns, ...rows].map(row => row.map(cell => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\r\n');
  return { id, name: id, datasetVersion: DATASET_VERSION, provenance: 'synthetic' as const,
    mimeType: text === undefined ? 'text/csv' : 'text/markdown', description, columns, rows, content,
    sizeBytes: new TextEncoder().encode(content).length, ...(text === undefined ? {} : { text }) };
}

export function createSeed() {
  const records = createRecords();
  const metrics = aggregateDataset(records);
  const channelMetrics = channels.map(channel => {
    const before = records.find(r => r.channel === channel && r.period === 'previous')!;
    const current = records.find(r => r.channel === channel && r.period === 'current')!;
    return { id: channel.toLowerCase().replaceAll(' ', '-'), channel, traffic: current.sessions,
      growth: change(before.sessions, current.sessions), orders: current.orders,
      conversion: percent(current.orders, current.sessions), previous: percent(before.orders, before.sessions),
      revenue: current.revenueCents / 100, trafficSharePct: percent(current.sessions, metrics.current.sessions), before, current };
  });
  const paidDevices = [
    { id: 'current-paid-mobile', device: 'Mobile', sessions: 300000, orders: 4200 },
    { id: 'current-paid-desktop', device: 'Desktop', sessions: 126000, orders: 3468 },
  ];
  const context = `# Harbour Retail · Business context

Synthetic company task data, separate from every applicant's past project and not supplied by the JD. Product, campaign and investment details are demonstration assumptions, not JD company facts. Two consecutive, non-overlapping four-week windows use the same session and order definitions. No customer-level data is included.

Sessions rose from ${metrics.previous.sessions.toLocaleString('en-AU')} to ${metrics.current.sessions.toLocaleString('en-AU')} (+${fixed(metrics.change.trafficPct)}%). Conversion fell from ${fixed(metrics.previous.conversionPct, 1)}% to ${fixed(metrics.current.conversionPct, 1)}%. Orders changed from ${metrics.previous.orders.toLocaleString('en-AU')} to ${metrics.current.orders.toLocaleString('en-AU')} (${fixed(metrics.change.ordersPct)}%). Advertising spend rose from AUD ${fixed(metrics.previous.adSpendCents / 100)} to AUD ${fixed(metrics.current.adSpendCents / 100)} (+${fixed(metrics.change.adSpendPct)}%).

New Paid Search campaigns launched at the start of the current period. The Spring Sale landing page also changed. These changes are possible explanations, not established causes. The business is considering increasing the advertising budget.

website_traffic.csv and orders.csv contain the same ten channel-period aggregates, not separate populations. channel_comparison.csv is a channel comparison, not individual campaign attribution. current_paid_search_devices.csv contains a current-period Paid Search device partition only: it reconciles to Paid Search but adds no new sessions. It contains no page-specific attribution or speed measurements. product_catalog.csv is context, not evidence of a conversion cause. Revenue uses a synthetic AUD 30 average order value; no order-level product attribution is implied.

Campaign × device × landing-page detail, historical device comparisons, load times and checkout events are still missing. Rates are derived from integer totals; displayed percentages round to two decimals. Do not average channel percentages or add overlapping resources. The chart compares whole four-week periods, not weekly trend points.

Investigate the strongest signals, separate observations from hypotheses, request discriminating evidence, and recommend a measured next step. No single prescribed conclusion or hiring decision is implied.`;
  const resources = [
    resource('website_traffic.csv', 'Canonical channel-period session and order counts; conversion is orders / sessions.',
      ['record_id', 'period', 'channel', 'sessions', 'orders', 'conversion_pct'],
      records.map(r => [r.id, r.period, r.channel, r.sessions, r.orders, fixed(percent(r.orders, r.sessions), 6)])),
    resource('channel_comparison.csv', 'Derived acquisition-channel comparison, not individual campaign-level data.',
      ['channel', 'previous_sessions', 'current_sessions', 'previous_conversion_pct', 'current_conversion_pct', 'traffic_change_pct', 'previous_spend_aud', 'current_spend_aud'],
      channelMetrics.map(c => [c.channel, c.before.sessions, c.traffic, fixed(c.previous, 6), fixed(c.conversion, 6), fixed(c.growth, 6), fixed(c.before.adSpendCents / 100), fixed(c.current.adSpendCents / 100)])),
    resource('orders.csv', 'Same channel-period aggregates with integer orders, synthetic revenue and advertising spend.',
      ['record_id', 'period', 'channel', 'orders', 'revenue_aud', 'ad_spend_aud'],
      records.map(r => [r.id, r.period, r.channel, r.orders, fixed(r.revenueCents / 100), fixed(r.adSpendCents / 100)])),
    resource('current_paid_search_devices.csv', 'Current Paid Search device partition; page identity, history and speed are not provided.',
      ['record_id', 'period', 'channel', 'device', 'sessions', 'orders', 'conversion_pct'],
      paidDevices.map(r => [r.id, 'current', 'Paid Search', r.device, r.sessions, r.orders, fixed(percent(r.orders, r.sessions), 6)])),
    resource('product_catalog.csv', 'Illustrative product context; availability is not a proven explanation.',
      ['product', 'category', 'price_aud', 'availability'],
      [['Everyday Tote', 'Accessories', '30.00', 'In stock'], ['Canvas Carryall', 'Accessories', '45.00', 'Limited'], ['Studio Notebook', 'Stationery', '18.00', 'In stock'], ['Travel Organiser', 'Accessories', '35.00', 'In stock']]),
    resource('business_context.md', 'Business brief, overlap rules, precision and remaining unknowns.', [], [], context),
  ];
  const requirements = [
    { id: 'sql', title: 'SQL', statement: 'Write basic SQL queries to extract, filter, group and summarise business data.' },
    { id: 'data-analysis', title: 'Data Analysis', statement: 'Calculate business metrics and compare appropriate periods or groups.' },
    { id: 'business-problem-solving', title: 'Business Problem Solving', statement: 'Investigate questions, explain uncertainty and recommend evidence-led next steps.' },
  ];
  return {
    schemaVersion: '4.0' as const, datasetVersion: DATASET_VERSION,
    job: { id: 'junior-data-analyst', title: 'Junior Data Analyst', company: 'Harbour Retail', requirements },
    dataset: { version: DATASET_VERSION, provenance: 'synthetic', records, metrics, channels: channelMetrics,
      trafficTrend: periods.map(period => ({ period, label: periodLabels[period], sessions: metrics[period].sessions,
        traffic: metrics[period].sessions / 1000, orders: metrics[period].orders, conversion: metrics[period].conversionPct })),
      resources },
  };
}
