export const company = 'HarbourCart Pty Ltd';
export const role = 'Junior Data Analyst';
export const taskTitle = 'Conversion Drop Investigation';
export const sections = ['Key Findings', 'Hypotheses', 'Additional Evidence Needed', 'Recommended Next Steps'] as const;
export type Section = typeof sections[number];
export type Finding = { id: string; section: Section; title: string; detail: string; source: string; confidence: 'High' | 'Medium' | 'Low' };
export const channels = [
  { channel: 'Organic', traffic: 320000, growth: 4.4, orders: 11200, conversion: 3.5, previous: 3.6, revenue: 336000 },
  { channel: 'Paid Search', traffic: 410000, growth: 42, orders: 7380, conversion: 1.8, previous: 3.2, revenue: 221400 },
  { channel: 'Social', traffic: 220000, growth: 20, orders: 4620, conversion: 2.1, previous: 2.8, revenue: 138600 },
  { channel: 'Email', traffic: 90000, growth: -3, orders: 3960, conversion: 4.4, previous: 4.5, revenue: 118800 },
  { channel: 'Direct', traffic: 160000, growth: 10, orders: 4040, conversion: 2.525, previous: 3.1, revenue: 121200 },
];
export const trafficTrend = [
  { week: 'Aug 18', traffic: 240, conversion: 3.4 }, { week: 'Aug 25', traffic: 266, conversion: 3.2 },
  { week: 'Sep 1', traffic: 281, conversion: 3.0 }, { week: 'Sep 8', traffic: 304, conversion: 2.7 },
  { week: 'Sep 15', traffic: 320, conversion: 2.6 },
];
export type Resource = { name: string; size: string; description: string; columns: string[]; rows: string[][]; text?: string };
export const resources: Resource[] = [
  { name: 'website_traffic.csv', size: '12 KB', description: 'Traffic and conversion by acquisition channel · last 4 weeks',
    columns: ['Channel', 'Sessions', 'Traffic change', 'Orders', 'Conversion'],
    rows: channels.map(c => [c.channel, String(c.traffic), `${c.growth}%`, String(c.orders), `${c.conversion}%`]) },
  { name: 'campaigns.csv', size: '28 KB', description: 'Paid campaign performance · compare intent and acquisition cost',
    columns: ['Campaign', 'Channel', 'Sessions', 'Spend (AUD)', 'Conversion'],
    rows: [['Brand intent', 'Paid Search', '120000', '12000', '3.1%'], ['Spring discovery', 'Paid Search', '190000', '18000', '1.1%'], ['Shopping launch', 'Paid Search', '100000', '9000', '1.57%'], ['Social prospecting', 'Social', '220000', '9000', '2.1%']] },
  { name: 'orders.csv', size: '18 KB', description: 'Aggregated orders and revenue by channel · all amounts in AUD',
    columns: ['Channel', 'Orders', 'Revenue (AUD)'], rows: channels.map(c => [c.channel, String(c.orders), String(c.revenue)]) },
  { name: 'landing_pages.csv', size: '14 KB', description: 'Illustrative landing-page segments · not additive to channel totals',
    columns: ['Page', 'Device', 'Sessions', 'Conversion', 'Load time'],
    rows: [['/spring-sale', 'Mobile', '96000', '1.0%', '4.8 s'], ['/spring-sale', 'Desktop', '54000', '2.7%', '1.6 s'], ['/collections/new', 'Mobile', '76000', '1.6%', '3.6 s'], ['/collections/new', 'Desktop', '38000', '3.2%', '1.4 s']] },
  { name: 'product_catalog.csv', size: '8 KB', description: 'Product availability and pricing context',
    columns: ['Product', 'Category', 'Price (AUD)', 'Availability'],
    rows: [['Everyday Tote', 'Accessories', '30', 'In stock'], ['Canvas Carryall', 'Accessories', '45', 'Limited'], ['Studio Notebook', 'Stationery', '18', 'In stock'], ['Travel Organiser', 'Accessories', '35', 'In stock']] },
  { name: 'business_context.md', size: '6 KB', description: 'The business brief, recent changes and known data limitations', columns: [], rows: [],
    text: '# HarbourCart · Business context\n\nHarbourCart is an Australian online retailer. In the last four weeks, website traffic increased by 18%, while the conversion rate fell from 3.4% to 2.6%. Advertising spend increased by 15% to AUD 48,000.\n\nA new broad-intent Paid Search campaign launched at the start of the period. The Spring Sale landing page also changed. These changes are possible explanations, not proven causes.\n\nYour task: investigate the likely drivers, distinguish observations from hypotheses, identify missing evidence, and recommend a measured next step.\n\nData notes: this workspace contains synthetic demonstration data. Channel totals are comparable within the four-week window. Landing-page segments are illustrative and are not additive to those totals. Weekly charts show trend snapshots. No customer-level data is included.\n\nThere is no single prescribed answer. Your reasoning and the evidence you use matter.' },
];
export const demoFindings: Finding[] = [
  { id: 'demo-1', section: 'Key Findings', title: 'Paid Search has the sharpest conversion decline', detail: 'Traffic rose 42%, while conversion fell from 3.2% to 1.8%. The channel now contributes 34% of sessions.', source: 'website_traffic.csv', confidence: 'High' },
  { id: 'demo-2', section: 'Key Findings', title: 'The mobile sale page underperforms desktop', detail: 'Spring Sale mobile converts at 1.0%, compared with 2.7% on desktop. Mobile page load time is 4.8 seconds.', source: 'landing_pages.csv', confidence: 'High' },
  { id: 'demo-3', section: 'Hypotheses', title: 'New campaigns may be bringing lower-intent visitors', detail: 'Spring discovery converts at 1.1%, below the brand campaign at 3.1%. Compare equivalent audience and device segments before attributing causality.', source: 'campaigns.csv', confidence: 'Medium' },
  { id: 'demo-4', section: 'Additional Evidence Needed', title: 'Break down campaign conversion by device and landing page', detail: 'Request a comparable pre/post launch cohort, funnel drop-off, and page-speed measurements to distinguish traffic quality from page experience.', source: 'landing_pages.csv', confidence: 'High' },
  { id: 'demo-5', section: 'Recommended Next Steps', title: 'Validate mobile performance before increasing ad spend', detail: 'Test the Spring Sale page on mobile and compare campaign cohorts. Hold incremental spend until the cause is better supported.', source: 'business_context.md', confidence: 'Medium' },
];
export function csv(resource: Resource) {
  return [resource.columns, ...resource.rows].map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(',')).join('\r\n');
}
export function download(name: string, contents: string, mime = 'text/plain') {
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
